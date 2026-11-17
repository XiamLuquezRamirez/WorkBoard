<?php

namespace Tests\Feature\Suite;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * Espacio de equipo: flujo de actividad, puesto de una persona, llamadas,
 * chat y los casos de reuniones que ReunionesTest no cubre.
 */
class EspacioEquipoSuiteTest extends TestCase
{
    use DatabaseTransactions;
    use DatosDeEquipo;

    protected $connectionsToTransact = ['mysql2'];

    private int $depto;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararEquipo();
        Mail::fake();
        $this->withoutDefer();

        $this->depto = $this->db()->table('departamentos')->insertGetId(['nombre' => 'Desarrollo']);
        $this->db()->table('empleados')->whereIn('id', [$this->lider, $this->colaborador, $this->independiente])
            ->update(['departamento' => $this->depto]);
    }

    // ─── Ayudantes ─────────────────────────────────────────────────────────

    private function db()
    {
        return DB::connection('mysql2');
    }

    private function tarea(int $empleado, string $titulo, array $campos = []): int
    {
        return $this->db()->table('tareas_empleados')->insertGetId(array_merge([
            'titulo' => $titulo, 'descripcion' => 'Descripción de prueba', 'empleado' => $empleado,
            'estado' => 'Pendiente', 'prioridad' => 'Media', 'estado_reg' => 'Activo',
            'fecha_creacion' => now()->toDateString(), 'fecha_pactada' => now()->addDays(3)->toDateString(),
            'pausada' => 0, 'editable' => 1, 'aprobada' => 1, 'visto_bueno' => 0, 'rechazada' => 0,
        ], $campos));
    }

    /** Un evento del flujo, como los que deja registrarActividad(). */
    private function evento(int $tarea, string $tipo = 'Estado', string $mensaje = 'Cambió de estado'): int
    {
        return $this->db()->table('notif_generales')->insertGetId([
            'id_emisor' => 0, 'tipo_emisor' => 'sistema', 'id_receptor' => 0, 'tipo_receptor' => 'sistema',
            'mensaje' => $mensaje, 'tarea_id' => $tarea, 'leido' => 1, 'fecha' => now()->toDateString(), 'tipo' => $tipo,
        ]);
    }

    private function conRol(string $tipo): int
    {
        $emp = $this->empleado('Rol', $tipo);
        $this->usuario($emp, strtolower($tipo) . '@prueba.test', 'No', 'No', $tipo);

        return $emp;
    }

    private function sinEmpleado(string $tipo = 'Administrador'): static
    {
        $email = 'sinficha.' . strtolower($tipo) . '@prueba.test';
        $id = $this->db()->table('users')->where('email', $email)->value('id')
            ?? $this->db()->table('users')->insertGetId([
                'name' => "{$tipo} sin ficha", 'email' => $email, 'password' => 'x',
                'tipo_usuario' => $tipo, 'empleado' => null, 'lider' => 'No',
                'independencia' => 'No', 'estado' => 'Activo',
            ]);

        $u = new User();
        $u->id = (int) $id;
        $u->email = $email;

        return $this->actingAs($u, 'sanctum');
    }

    private function fantasma(): static
    {
        $u = new User();
        $u->id = 987654;
        $u->email = 'fantasma@prueba.test';

        return $this->actingAs($u, 'sanctum');
    }

    private function directo(int $a, int $b): string
    {
        return 'dir:' . min($a, $b) . '-' . max($a, $b);
    }

    // ─── Actividad ────────────────────────────────────────────────────────

    private function eventosVisibles(): array
    {
        return collect($this->getJson('/api/equipo/actividad')->assertOk()->json('eventos'))
            ->pluck('id')->sort()->values()->all();
    }

    /** Un evento por persona; devuelve los ids indexados por empleado. */
    private function eventoPorPersona(): array
    {
        $ids = [];
        foreach ([$this->lider, $this->colaborador, $this->independiente, $this->ajeno, $this->verificador] as $e) {
            $ids[$e] = $this->evento($this->tarea($e, "T{$e}"));
        }

        return $ids;
    }

    private function ordenados(array $ids): array
    {
        sort($ids);

        return array_values($ids);
    }

    public function test_actividad_el_colaborador_solo_ve_lo_de_sus_tareas(): void
    {
        $ev = $this->eventoPorPersona();

        $this->assertSame([$ev[$this->colaborador]], $this->como($this->colaborador)->eventosVisibles());
        $this->assertSame([$ev[$this->ajeno]], $this->como($this->ajeno)->eventosVisibles());
        // Inés lleva la marca de líder pero nadie le reporta.
        $this->assertSame([$ev[$this->independiente]], $this->como($this->independiente)->eventosVisibles());
    }

    public function test_actividad_el_lider_ve_a_su_equipo_y_no_a_otros(): void
    {
        $ev = $this->eventoPorPersona();

        $this->assertSame(
            $this->ordenados([$ev[$this->lider], $ev[$this->colaborador], $ev[$this->independiente]]),
            $this->como($this->lider)->eventosVisibles()
        );
    }

    public function test_actividad_administracion_y_supervision_ven_todo(): void
    {
        $ev = $this->eventoPorPersona();
        $todos = $this->ordenados(array_values($ev));

        $this->assertSame($todos, $this->como($this->conRol('Administrador'))->eventosVisibles());
        $this->assertSame($todos, $this->como($this->conRol('Supervisor'))->eventosVisibles());
        $this->assertSame($todos, $this->sinEmpleado()->eventosVisibles());
    }

    public function test_actividad_sin_usuario_o_sin_ficha_no_ve_nada(): void
    {
        $this->eventoPorPersona();

        $this->fantasma()->getJson('/api/equipo/actividad')->assertOk()->assertJson(['eventos' => [], 'hay_mas' => false]);
        $this->sinEmpleado('Empleado')->getJson('/api/equipo/actividad')->assertOk()->assertJson(['eventos' => []]);
    }

    public function test_actividad_omite_eliminadas_y_conserva_archivadas(): void
    {
        $viva = $this->evento($this->tarea($this->colaborador, 'Viva'));
        $archivada = $this->evento($this->tarea($this->colaborador, 'Archivada', ['archivar' => 1]));
        $this->evento($this->tarea($this->colaborador, 'Eliminada', ['estado_reg' => 'Eliminado']));
        // Avisos de persona a persona no son actividad del flujo.
        $this->db()->table('notif_generales')->insert([
            'id_emisor' => 1, 'tipo_emisor' => 'usuario', 'id_receptor' => 2, 'tipo_receptor' => 'usuario',
            'mensaje' => 'Aviso privado', 'tarea_id' => $this->tarea($this->colaborador, 'Otra'), 'tipo' => 'Tarea',
        ]);

        $this->assertSame($this->ordenados([$viva, $archivada]), $this->como($this->lider)->eventosVisibles());
    }

    public function test_actividad_filtra_por_tipo_y_pagina(): void
    {
        $t = $this->tarea($this->colaborador, 'T');
        $pausa = $this->evento($t, 'Pausa');
        for ($i = 0; $i < 41; $i++) {
            $this->evento($t, 'Estado');
        }

        $r = $this->como($this->lider)->getJson('/api/equipo/actividad?tipo=Pausa')->assertOk();
        $this->assertSame([$pausa], collect($r->json('eventos'))->pluck('id')->all());
        $this->assertSame(['Estado', 'Pausa'], $r->json('tipos'));

        $r = $this->como($this->lider)->getJson('/api/equipo/actividad')->assertOk();
        $this->assertCount(40, $r->json('eventos'));
        $this->assertTrue($r->json('hay_mas'));

        $r = $this->como($this->lider)->getJson('/api/equipo/actividad?pagina=2')->assertOk();
        $this->assertCount(2, $r->json('eventos'));
        $this->assertFalse($r->json('hay_mas'));

        $this->como($this->lider)->getJson('/api/equipo/actividad?pagina=abc')->assertOk();
    }

    // ─── Puesto ───────────────────────────────────────────────────────────

    public static function puestosInexistentes(): array
    {
        return ['id inexistente' => ['99999999'], 'texto' => ['abc'], 'cero' => ['0'], 'negativo' => ['-3']];
    }

    #[DataProvider('puestosInexistentes')]
    public function test_puesto_de_alguien_que_no_existe_responde_404(string $id): void
    {
        $this->como($this->lider)->getJson("/api/equipo/puesto/{$id}")->assertStatus(404);
    }

    public function test_puesto_de_un_empleado_inactivo_responde_404(): void
    {
        $this->db()->table('empleados')->where('id', $this->ajeno)->update(['estado' => 'Inactivo']);

        $this->como($this->lider)->getJson("/api/equipo/puesto/{$this->ajeno}")->assertStatus(404);
    }

    public function test_puesto_propio_muestra_el_trabajo_sin_chat_ni_sala(): void
    {
        $this->tarea($this->colaborador, 'Lo mío');

        $r = $this->como($this->colaborador)->getJson("/api/equipo/puesto/{$this->colaborador}")->assertOk();

        $this->assertTrue($r->json('soy_yo'));
        $this->assertTrue($r->json('ver_trabajo'));
        $this->assertCount(1, $r->json('tareas'));
        $this->assertNull($r->json('chat'));
        $this->assertNull($r->json('sala'));
    }

    public function test_puesto_un_companero_del_mismo_equipo_tampoco_ve_el_trabajo(): void
    {
        $this->tarea($this->independiente, 'De Inés');
        $this->evento($this->tarea($this->independiente, 'Otra de Inés'));

        $r = $this->como($this->colaborador)->getJson("/api/equipo/puesto/{$this->independiente}")->assertOk();

        $this->assertFalse($r->json('ver_trabajo'));
        $this->assertSame([], $r->json('tareas'));
        $this->assertSame([], $r->json('actividad'));
        $this->assertSame(0, $r->json('resumen.vivas'));
        $this->assertSame($this->directo($this->colaborador, $this->independiente), $r->json('chat'));
    }

    public function test_puesto_supervision_y_admin_sin_ficha_ven_el_trabajo(): void
    {
        $this->tarea($this->ajeno, 'De Ana');

        $r = $this->como($this->conRol('Supervisor'))->getJson("/api/equipo/puesto/{$this->ajeno}")->assertOk();
        $this->assertTrue($r->json('ver_trabajo'));
        $this->assertCount(1, $r->json('tareas'));

        $r = $this->sinEmpleado()->getJson("/api/equipo/puesto/{$this->ajeno}")->assertOk();
        $this->assertTrue($r->json('ver_trabajo'));
        $this->assertNull($r->json('chat'), 'Sin ficha no tiene con quién abrir un directo.');
        $this->assertNull($r->json('sala'));
    }

    public function test_puesto_sin_usuario_no_ve_trabajo(): void
    {
        $this->tarea($this->ajeno, 'De Ana');

        $r = $this->fantasma()->getJson("/api/equipo/puesto/{$this->ajeno}")->assertOk();

        $this->assertFalse($r->json('ver_trabajo'));
        $this->assertNull($r->json('chat'));
    }

    public function test_puesto_la_sala_y_el_chat_son_los_mismos_desde_ambos_lados(): void
    {
        $ida = $this->como($this->colaborador)->getJson("/api/equipo/puesto/{$this->ajeno}")->json();
        $vuelta = $this->como($this->ajeno)->getJson("/api/equipo/puesto/{$this->colaborador}")->json();

        $this->assertSame($ida['sala'], $vuelta['sala']);
        $this->assertSame($ida['chat'], $vuelta['chat']);
        $this->assertStringNotContainsString((string) $this->ajeno, $ida['sala'], 'La sala no debe ser adivinable a partir de los ids.');
    }

    public function test_puesto_resumen_cuadra_con_las_tareas_vivas(): void
    {
        $ayer = now()->subDay()->toDateString();
        $this->tarea($this->colaborador, 'Vencida', ['fecha_pactada' => $ayer]);
        $this->tarea($this->colaborador, 'En curso', ['estado' => 'En Proceso']);
        $this->tarea($this->colaborador, 'Entregada', ['estado' => 'En Revisión', 'fecha_pactada' => $ayer]);
        $this->tarea($this->colaborador, 'Bloqueada', ['bloqueada' => 1]);
        $this->tarea($this->colaborador, 'Cerrada', ['estado' => 'Completada', 'fecha_pactada' => $ayer]);
        $this->tarea($this->colaborador, 'Archivada', ['archivar' => 1, 'fecha_pactada' => $ayer]);

        $r = $this->como($this->lider)->getJson("/api/equipo/puesto/{$this->colaborador}")->assertOk();

        $this->assertSame(['vivas' => 4, 'proceso' => 1, 'revision' => 1, 'atrasadas' => 1, 'bloqueadas' => 1, 'pausadas' => 0],
            $r->json('resumen'));
    }

    #[Group('hallazgo')]
    public function test_puesto_no_muestra_tareas_eliminadas(): void
    {
        // El plano y el tablero filtran estado_reg = 'Activo'; el puesto no,
        // así que el detalle enseña tareas que el plano no cuenta.
        $this->tarea($this->colaborador, 'Viva');
        $this->tarea($this->colaborador, 'Eliminada', ['estado_reg' => 'Eliminado']);

        $r = $this->como($this->lider)->getJson("/api/equipo/puesto/{$this->colaborador}")->assertOk();

        $this->assertSame(['Viva'], collect($r->json('tareas'))->pluck('titulo')->all());
    }

    #[Group('hallazgo')]
    public function test_puesto_no_cuenta_como_pausada_una_tarea_reanudada(): void
    {
        // Misma tarea, dos lecturas: el plano dice 0 pausadas y el puesto 1.
        $this->tarea($this->colaborador, 'Reanudada', ['estado' => 'En Proceso', 'pausada' => 1]);

        $plano = collect($this->como($this->lider)->getJson('/api/tablero/plano')->json('zonas'))
            ->flatMap(fn ($z) => $z['puestos'])->firstWhere('id', $this->colaborador);
        $puesto = $this->como($this->lider)->getJson("/api/equipo/puesto/{$this->colaborador}")->json();

        $this->assertSame(0, $plano['conteos']['pausadas']);
        $this->assertSame($plano['conteos']['pausadas'], $puesto['resumen']['pausadas']);
    }

    #[Group('hallazgo')]
    public function test_puesto_a_las_nueve_de_la_noche_lo_de_hoy_no_esta_atrasado(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-12 21:00:00', 'America/Bogota'));
        $this->tarea($this->colaborador, 'Para hoy', ['fecha_pactada' => '2026-11-12']);

        $r = $this->como($this->lider)->getJson("/api/equipo/puesto/{$this->colaborador}")->assertOk();

        $this->assertSame(0, $r->json('resumen.atrasadas'));
    }

    // ─── Llamadas ─────────────────────────────────────────────────────────

    private function llamar(int $de, int $a): int
    {
        return (int) $this->como($de)->postJson('/api/equipo/llamar', ['receptor' => $a])->assertCreated()->json('id');
    }

    private function estadoLlamadaEnBd(int $id): string
    {
        return $this->db()->table('llamadas')->where('id', $id)->value('estado');
    }

    public function test_llamar_crea_la_llamada_y_no_la_duplica(): void
    {
        $r = $this->como($this->colaborador)->postJson('/api/equipo/llamar', ['receptor' => $this->ajeno])->assertCreated();
        $otra = $this->como($this->colaborador)->postJson('/api/equipo/llamar', ['receptor' => $this->ajeno])->assertOk();

        $this->assertSame($r->json('id'), $otra->json('id'));
        $this->assertSame(1, $this->db()->table('llamadas')->count());
    }

    public function test_llamar_valida_el_receptor(): void
    {
        $this->db()->table('empleados')->where('id', $this->verificador)->update(['estado' => 'Inactivo']);

        $this->como($this->colaborador)->postJson('/api/equipo/llamar', [])->assertStatus(422);
        $this->como($this->colaborador)->postJson('/api/equipo/llamar', ['receptor' => 'Ana'])->assertStatus(422);
        $this->como($this->colaborador)->postJson('/api/equipo/llamar', ['receptor' => $this->colaborador])->assertStatus(422);
        $this->como($this->colaborador)->postJson('/api/equipo/llamar', ['receptor' => 99999999])->assertStatus(404);
        $this->como($this->colaborador)->postJson('/api/equipo/llamar', ['receptor' => $this->verificador])->assertStatus(404);
        $this->sinEmpleado()->postJson('/api/equipo/llamar', ['receptor' => $this->ajeno])->assertStatus(403);

        $this->assertSame(0, $this->db()->table('llamadas')->count());
    }

    public function test_la_llamada_entrante_solo_suena_al_receptor_y_caduca(): void
    {
        $id = $this->llamar($this->colaborador, $this->ajeno);

        $this->como($this->ajeno)->getJson('/api/equipo/llamada-entrante')->assertOk()
            ->assertJsonPath('llamada.id', $id)->assertJsonPath('llamada.emisor', $this->colaborador);
        $this->como($this->lider)->getJson('/api/equipo/llamada-entrante')->assertOk()->assertJsonPath('llamada', null);
        $this->como($this->colaborador)->getJson('/api/equipo/llamada-entrante')->assertOk()->assertJsonPath('llamada', null);
        $this->sinEmpleado()->getJson('/api/equipo/llamada-entrante')->assertOk()->assertJson(['llamada' => null, 'activo' => false]);

        $this->travel(46)->seconds();
        $this->como($this->ajeno)->getJson('/api/equipo/llamada-entrante')->assertOk()->assertJsonPath('llamada', null);
        $this->como($this->colaborador)->getJson("/api/equipo/llamada/{$id}")->assertOk()->assertJsonPath('estado', 'Cancelada');
    }

    public function test_el_estado_de_una_llamada_solo_lo_ven_sus_dos_extremos(): void
    {
        $id = $this->llamar($this->colaborador, $this->ajeno);

        $this->como($this->colaborador)->getJson("/api/equipo/llamada/{$id}")->assertOk()->assertJsonPath('estado', 'Sonando');
        $this->como($this->ajeno)->getJson("/api/equipo/llamada/{$id}")->assertOk();
        $this->como($this->lider)->getJson("/api/equipo/llamada/{$id}")->assertStatus(403)->assertJsonMissing(['sala']);
        $this->sinEmpleado()->getJson("/api/equipo/llamada/{$id}")->assertStatus(403);

        // Inexistente: no revela nada y no rompe (hoy responde 403, no 404).
        $this->assertContains($this->como($this->colaborador)->getJson('/api/equipo/llamada/99999999')->status(), [403, 404]);
    }

    public function test_nadie_responde_una_llamada_que_no_es_suya(): void
    {
        $id = $this->llamar($this->colaborador, $this->ajeno);

        // Un tercero no acepta, rechaza ni cancela.
        foreach (['Aceptada', 'Rechazada', 'Cancelada'] as $estado) {
            $this->como($this->lider)->putJson("/api/equipo/llamada/{$id}", ['estado' => $estado])->assertStatus(403);
        }
        $this->sinEmpleado()->putJson("/api/equipo/llamada/{$id}", ['estado' => 'Aceptada'])->assertStatus(404);
        // Quien llama no puede «aceptar» por el otro; el receptor no cancela.
        $this->como($this->colaborador)->putJson("/api/equipo/llamada/{$id}", ['estado' => 'Aceptada'])->assertStatus(403);
        $this->como($this->ajeno)->putJson("/api/equipo/llamada/{$id}", ['estado' => 'Cancelada'])->assertStatus(403);

        $this->assertSame('Sonando', $this->estadoLlamadaEnBd($id));
    }

    public function test_responder_llamada_valida_estado_e_id(): void
    {
        $id = $this->llamar($this->colaborador, $this->ajeno);

        $this->como($this->ajeno)->putJson("/api/equipo/llamada/{$id}", ['estado' => 'Sonando'])->assertStatus(422);
        $this->como($this->ajeno)->putJson("/api/equipo/llamada/{$id}", [])->assertStatus(422);
        $this->como($this->ajeno)->putJson('/api/equipo/llamada/99999999', ['estado' => 'Aceptada'])->assertStatus(404);

        $this->como($this->ajeno)->putJson("/api/equipo/llamada/{$id}", ['estado' => 'Rechazada'])->assertOk();
        $this->assertSame('Rechazada', $this->estadoLlamadaEnBd($id));
    }

    public function test_quien_llama_cuelga_y_el_otro_lo_ve(): void
    {
        $id = $this->llamar($this->colaborador, $this->ajeno);

        $this->como($this->colaborador)->putJson("/api/equipo/llamada/{$id}", ['estado' => 'Cancelada'])->assertOk();

        $this->como($this->ajeno)->getJson("/api/equipo/llamada/{$id}")->assertJsonPath('estado', 'Cancelada');
        $this->como($this->ajeno)->getJson('/api/equipo/llamada-entrante')->assertJsonPath('llamada', null);
    }

    #[Group('hallazgo')]
    public function test_no_se_acepta_una_llamada_ya_colgada(): void
    {
        // responderLlamada no mira el estado actual: el receptor puede
        // convertir en «Aceptada» una llamada que el emisor ya canceló.
        $id = $this->llamar($this->colaborador, $this->ajeno);
        $this->como($this->colaborador)->putJson("/api/equipo/llamada/{$id}", ['estado' => 'Cancelada'])->assertOk();

        $this->como($this->ajeno)->putJson("/api/equipo/llamada/{$id}", ['estado' => 'Aceptada'])->assertStatus(409);
        $this->assertSame('Cancelada', $this->estadoLlamadaEnBd($id));
    }

    // ─── Chat ─────────────────────────────────────────────────────────────

    private function escribir(int $quien, string $clave, string $texto = 'Hola')
    {
        return $this->como($quien)->postJson('/api/equipo/chat/mensajes', ['clave' => $clave, 'mensaje' => $texto]);
    }

    private function leer(int $quien, string $clave)
    {
        return $this->como($quien)->getJson('/api/equipo/chat/mensajes?clave=' . urlencode($clave));
    }

    public function test_chat_un_tercero_no_lee_ni_escribe_en_un_directo_ajeno(): void
    {
        $clave = $this->directo($this->lider, $this->colaborador);
        $this->escribir($this->lider, $clave, 'Tu evaluación está lista')->assertCreated();

        $this->leer($this->ajeno, $clave)->assertStatus(403)->assertDontSee('evaluación');
        $this->escribir($this->ajeno, $clave, 'Me cuelo')->assertStatus(403);
        // Ni administración: un directo es de sus dos extremos.
        $this->leer($this->conRol('Administrador'), $clave)->assertStatus(403);
        $this->sinEmpleado()->getJson('/api/equipo/chat/mensajes?clave=' . urlencode($clave))->assertStatus(403);

        $this->assertSame(1, $this->db()->table('chat_mensajes')->count());
        $this->leer($this->colaborador, $clave)->assertOk()->assertJsonPath('mensajes.0.mensaje', 'Tu evaluación está lista');
    }

    public function test_chat_canales_no_listan_directos_ajenos(): void
    {
        $clave = $this->directo($this->lider, $this->colaborador);
        $this->escribir($this->lider, $clave)->assertCreated();

        $directos = fn (int $quien) => collect($this->como($quien)->getJson('/api/equipo/chat/canales')->assertOk()->json('directos'))->pluck('clave')->all();

        $this->assertSame([$clave], $directos($this->colaborador));
        $this->assertSame([], $directos($this->ajeno));
    }

    public function test_chat_canales_y_contactos(): void
    {
        $this->db()->table('empleados')->where('id', $this->verificador)->update(['estado' => 'Inactivo']);

        $r = $this->como($this->colaborador)->getJson('/api/equipo/chat/canales')->assertOk();

        $contactos = collect($r->json('contactos'))->pluck('id')->all();
        $this->assertNotContains($this->colaborador, $contactos);
        $this->assertNotContains($this->verificador, $contactos);
        $this->assertContains($this->ajeno, $contactos);
        $this->assertTrue(collect($r->json('canales'))->firstWhere('clave', "dep:{$this->depto}")['es_mio']);

        $this->sinEmpleado()->getJson('/api/equipo/chat/canales')->assertOk()
            ->assertExactJson(['canales' => [], 'directos' => [], 'contactos' => []]);
    }

    public function test_chat_los_canales_de_departamento_son_abiertos(): void
    {
        // Decisión documentada: cualquiera puede preguntar en otra área.
        $this->escribir($this->ajeno, "dep:{$this->depto}", 'Pregunta desde fuera')->assertCreated();
        $this->leer($this->colaborador, "dep:{$this->depto}")->assertOk()->assertJsonPath('mensajes.0.mensaje', 'Pregunta desde fuera');
    }

    public static function clavesNoValidas(): array
    {
        return [
            'vacía'               => [''],
            'departamento falso'  => ['dep:99999999'],
            'departamento texto'  => ['dep:abc'],
            'departamento cero'   => ['dep:0'],
            'prefijo desconocido' => ['grupo:1'],
            'directo consigo'     => ['dir:{yo}-{yo}'],
            'directo de tres'     => ['dir:{yo}-1-2'],
        ];
    }

    #[DataProvider('clavesNoValidas')]
    public function test_chat_claves_no_validas_no_se_leen_ni_se_escriben(string $clave): void
    {
        $clave = str_replace('{yo}', (string) $this->colaborador, $clave);

        $this->leer($this->colaborador, $clave)->assertStatus(403);
        $r = $this->escribir($this->colaborador, $clave);
        $this->assertContains($r->status(), [403, 422]);
        $this->assertSame(0, $this->db()->table('chat_mensajes')->count());
    }

    public function test_chat_mensajes_vacios_o_enormes_responden_422(): void
    {
        $clave = $this->directo($this->colaborador, $this->ajeno);

        $this->escribir($this->colaborador, $clave, '')->assertStatus(422);
        $this->escribir($this->colaborador, $clave, "   \n\t ")->assertStatus(422);
        $this->escribir($this->colaborador, $clave, str_repeat('a', 4001))->assertStatus(422);
        $this->como($this->colaborador)->postJson('/api/equipo/chat/mensajes', ['clave' => $clave, 'mensaje' => ['a']])->assertStatus(422);
        $this->como($this->colaborador)->postJson('/api/equipo/chat/mensajes', ['mensaje' => 'Sin clave'])->assertStatus(422);
        $this->como($this->colaborador)->postJson('/api/equipo/chat/mensajes', ['clave' => str_repeat('d', 61), 'mensaje' => 'x'])->assertStatus(422);
        $this->sinEmpleado()->postJson('/api/equipo/chat/mensajes', ['clave' => $clave, 'mensaje' => 'Hola'])->assertStatus(403);
        $this->assertSame(0, $this->db()->table('chat_mensajes')->count());

        $this->escribir($this->colaborador, $clave, str_repeat('a', 4000))->assertCreated();
    }

    public function test_chat_desde_devuelve_solo_lo_nuevo_y_marca_leido(): void
    {
        $clave = $this->directo($this->colaborador, $this->ajeno);
        $primero = (int) $this->escribir($this->colaborador, $clave, 'Uno')->json('id');
        $this->escribir($this->colaborador, $clave, 'Dos')->assertCreated();

        $r = $this->como($this->ajeno)->getJson('/api/equipo/chat/mensajes?clave=' . urlencode($clave) . '&desde=' . $primero)->assertOk();
        $this->assertSame(['Dos'], collect($r->json('mensajes'))->pluck('mensaje')->all());
        $this->assertFalse($r->json('mensajes.0.mio'));

        $canal = collect($this->como($this->ajeno)->getJson('/api/equipo/chat/canales')->json('directos'))->firstWhere('clave', $clave);
        $this->assertSame(0, $canal['sin_leer']);
    }

    #[Group('hallazgo')]
    public function test_chat_no_abre_directos_con_quien_no_existe(): void
    {
        // puedeVerConversacion() sólo comprueba que el usuario sea uno de los
        // dos ids: «dir:5-99999999» o «dir:5-abc» (que se lee como 5-0) crean
        // conversaciones con nadie.
        $yo = $this->colaborador;

        foreach (["dir:{$yo}-99999999", "dir:{$yo}-abc", "dir:0-{$yo}"] as $clave) {
            $r = $this->escribir($yo, $clave, 'Hola, ¿hay alguien?');
            $this->assertContains($r->status(), [404, 422], "La clave «{$clave}» debería rechazarse y respondió {$r->status()}.");
        }

        $this->assertSame(0, $this->db()->table('chat_conversaciones')->count());
    }

    #[Group('hallazgo')]
    public function test_chat_un_directo_con_la_clave_al_reves_no_crea_otra_conversacion(): void
    {
        // «dir:B-A» y «dir:A-B» son la misma pareja, pero se guardan como dos
        // conversaciones distintas: el historial se parte en dos.
        $menor = min($this->colaborador, $this->ajeno);
        $mayor = max($this->colaborador, $this->ajeno);

        $this->escribir($this->colaborador, "dir:{$menor}-{$mayor}", 'Por la clave buena');
        $this->escribir($this->colaborador, "dir:{$mayor}-{$menor}", 'Por la clave invertida');

        $this->assertLessThanOrEqual(1, $this->db()->table('chat_conversaciones')->count());
    }

    // ─── Reuniones: casos que ReunionesTest no cubre ─────────────────────

    private function datosReunion(array $extra = []): array
    {
        return array_merge([
            'titulo' => 'Planeación semanal', 'descripcion' => 'Revisar prioridades',
            'fecha' => now('America/Bogota')->addDays(2)->toDateString(), 'hora_inicio' => '09:00', 'hora_fin' => '10:00',
            'lugar' => 'Sala 2', 'asistentes' => [$this->colaborador],
        ], $extra);
    }

    private function reunion(?int $organizador = null, array $extra = []): int
    {
        return (int) $this->como($organizador ?? $this->lider)->postJson('/api/equipo/reuniones', $this->datosReunion($extra))
            ->assertCreated()->json('id');
    }

    private function respuesta(int $reunion, int $empleado): ?string
    {
        return $this->db()->table('reuniones_asistentes')->where('reunion', $reunion)->where('empleado', $empleado)->value('respuesta');
    }

    public function test_reunion_quien_no_esta_convocado_no_responde(): void
    {
        $id = $this->reunion();

        $this->como($this->ajeno)->putJson("/api/equipo/reuniones/{$id}/respuesta", ['respuesta' => 'Acepta'])->assertStatus(403);
        $this->sinEmpleado()->putJson("/api/equipo/reuniones/{$id}/respuesta", ['respuesta' => 'Acepta'])->assertStatus(403);

        $this->assertNull($this->respuesta($id, $this->ajeno));
        $this->assertSame(2, $this->db()->table('reuniones_asistentes')->where('reunion', $id)->count());
    }

    public function test_reunion_solo_la_cancela_su_organizador(): void
    {
        $id = $this->reunion();

        $this->como($this->colaborador)->deleteJson("/api/equipo/reuniones/{$id}")->assertStatus(403);
        $this->como($this->ajeno)->deleteJson("/api/equipo/reuniones/{$id}")->assertStatus(403);
        $this->como($this->conRol('Administrador'))->deleteJson("/api/equipo/reuniones/{$id}")->assertStatus(403);
        $this->sinEmpleado()->deleteJson("/api/equipo/reuniones/{$id}")->assertStatus(403);

        $this->assertSame('Programada', $this->db()->table('reuniones')->where('id', $id)->value('estado'));
    }

    public function test_reunion_inexistente_responde_404(): void
    {
        $this->como($this->colaborador)->putJson('/api/equipo/reuniones/99999999/respuesta', ['respuesta' => 'Acepta'])->assertStatus(404);
        $this->como($this->colaborador)->deleteJson('/api/equipo/reuniones/99999999')->assertStatus(404);
    }

    public function test_reunion_respuesta_invalida_responde_422(): void
    {
        $id = $this->reunion();

        $this->como($this->colaborador)->putJson("/api/equipo/reuniones/{$id}/respuesta", ['respuesta' => 'Quizás'])->assertStatus(422);
        $this->como($this->colaborador)->putJson("/api/equipo/reuniones/{$id}/respuesta", [])->assertStatus(422);
        $this->assertSame('Pendiente', $this->respuesta($id, $this->colaborador));
    }

    public function test_reunion_quien_no_esta_convocado_no_la_ve(): void
    {
        $id = $this->reunion();

        $ids = fn (int $quien) => collect($this->como($quien)->getJson('/api/equipo/reuniones')->assertOk()->json('reuniones'))->pluck('id')->all();

        $this->assertSame([$id], $ids($this->colaborador));
        $this->assertSame([$id], $ids($this->lider));
        $this->assertSame([], $ids($this->ajeno));
        $this->sinEmpleado()->getJson('/api/equipo/reuniones')->assertOk()->assertJsonPath('reuniones', []);
    }

    public function test_reunion_sin_ficha_no_se_puede_convocar(): void
    {
        $this->sinEmpleado()->postJson('/api/equipo/reuniones', $this->datosReunion())->assertStatus(403);
        $this->assertSame(0, $this->db()->table('reuniones')->count());
    }

    public static function reunionesInvalidas(): array
    {
        return [
            'enlace javascript'     => [['enlace' => 'javascript:alert(1)']],
            'enlace sin protocolo'  => [['enlace' => 'meet.google.com/abc']],
            'fin antes del inicio'  => [['hora_inicio' => '10:00', 'hora_fin' => '09:00']],
            'hora imposible'        => [['hora_inicio' => '25:00']],
            'fecha pasada'          => [['fecha' => '2020-01-01']],
            'fecha sin formato'     => [['fecha' => '12/11/2026']],
            'sin título'            => [['titulo' => '']],
            'asistentes no lista'   => [['asistentes' => 'todos']],
            'asistente texto'       => [['asistentes' => ['Ana']]],
            'solo yo'               => [['asistentes' => ['{lider}']]],
            'solo inexistentes'     => [['asistentes' => [99999999]]],
        ];
    }

    #[DataProvider('reunionesInvalidas')]
    public function test_reunion_datos_invalidos_responden_422(array $extra): void
    {
        if (($extra['asistentes'] ?? null) === ['{lider}']) {
            $extra['asistentes'] = [$this->lider];
        }

        $this->como($this->lider)->postJson('/api/equipo/reuniones', $this->datosReunion($extra))->assertStatus(422);
        $this->assertSame(0, $this->db()->table('reuniones')->count());
        Mail::assertNothingSent();
    }

    public function test_reunion_se_puede_convocar_para_hoy_de_noche_en_bogota(): void
    {
        // 21:00 en Bogotá ya es mañana en UTC: la validación usa la zona de la oficina.
        Carbon::setTestNow(Carbon::parse('2026-11-12 21:00:00', 'America/Bogota'));

        $this->como($this->lider)->postJson('/api/equipo/reuniones', $this->datosReunion([
            'fecha' => '2026-11-12', 'hora_inicio' => '21:30', 'hora_fin' => '22:00',
        ]))->assertCreated();
    }

    #[Group('hallazgo')]
    public function test_reunion_de_esta_noche_sigue_en_proximas_a_las_nueve(): void
    {
        // La lista usa Carbon::today() en UTC: a las 21:00 de Bogotá la
        // reunión de las 21:30 de hoy ya figura como «pasada».
        Carbon::setTestNow(Carbon::parse('2026-11-12 21:00:00', 'America/Bogota'));
        $id = $this->reunion($this->lider, ['fecha' => '2026-11-12', 'hora_inicio' => '21:30', 'hora_fin' => '22:00']);

        $proximas = collect($this->como($this->colaborador)->getJson('/api/equipo/reuniones')->assertOk()->json('reuniones'))->pluck('id')->all();

        $this->assertSame([$id], $proximas);
    }
}
