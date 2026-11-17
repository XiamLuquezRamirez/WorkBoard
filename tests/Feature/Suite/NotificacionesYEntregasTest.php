<?php

namespace Tests\Feature\Suite;

use App\Mail\AvisoTareaCorreo;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * La campana de notificaciones (leerlas y marcarlas) y los casos de aceptar,
 * devolver y verificarTarea (legado) que no cubren CriteriosAceptacionTest ni
 * RevisionTareasTest: estados equivocados, ids inexistentes, quién no puede y
 * administración sin ficha de empleado.
 */
class NotificacionesYEntregasTest extends TestCase
{
    use DatabaseTransactions;
    use DatosDeEquipo;

    protected $connectionsToTransact = ['mysql2'];

    private int $admin;
    private int $supervisor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararEquipo();
        Mail::fake();
        $this->withoutDefer();

        $this->admin = $this->empleado('Adela', 'Administradora');
        $this->usuario($this->admin, 'admin@prueba.test', 'No', 'No', 'Administrador');
        $this->supervisor = $this->empleado('Sergio', 'Supervisor');
        $this->usuario($this->supervisor, 'supervisor@prueba.test', 'No', 'No', 'Supervisor');
    }

    // ─── Ayudas ─────────────────────────────────────────────────────────────

    private function db()
    {
        return DB::connection('mysql2');
    }

    private function usuarioId(int $empleado): int
    {
        return (int) $this->db()->table('users')->where('empleado', $empleado)->value('id');
    }

    private function aviso(int $empleado, string $mensaje, int $leido = 0): int
    {
        return (int) $this->db()->table('notif_generales')->insertGetId([
            'id_emisor' => $this->usuarioId($this->lider), 'tipo_emisor' => 'empleado',
            'id_receptor' => $this->usuarioId($empleado), 'tipo_receptor' => 'empleado',
            'mensaje' => $mensaje, 'tarea_id' => null, 'leido' => $leido,
            'fecha' => now()->toDateString(), 'tipo' => 'Observacion',
        ]);
    }

    private function leerCampana(int $quien, int $deEmpleado)
    {
        return $this->como($quien)->getJson('/api/notificaciones?tipo=empleado&id=' . $this->usuarioId($deEmpleado));
    }

    private function leido(int $id): int
    {
        return (int) $this->db()->table('notif_generales')->where('id', $id)->value('leido');
    }

    private function avisos(int $empleado, string $tipo)
    {
        return $this->db()->table('notif_generales')
            ->where('id_receptor', $this->usuarioId($empleado))->where('tipo', $tipo)->get();
    }

    private function aceptaciones(int $tarea): int
    {
        return $this->db()->table('tarea_aceptaciones')->where('tarea_id', $tarea)->count();
    }

    /** Un administrador con sesión pero sin ficha de empleado, como en producción. */
    private function comoAdminSinFicha(): static
    {
        $id = $this->db()->table('users')->insertGetId([
            'name' => 'Admin sin ficha', 'email' => 'admin-sin-ficha@prueba.test', 'password' => 'x',
            'tipo_usuario' => 'Administrador', 'empleado' => null, 'lider' => 'No', 'independencia' => 'No', 'estado' => 'Activo',
        ]);
        $u = new User();
        $u->id = $id;
        $u->email = 'admin-sin-ficha@prueba.test';
        return $this->actingAs($u, 'sanctum');
    }

    // ─── Sin sesión ─────────────────────────────────────────────────────────

    public static function rutasProtegidas(): array
    {
        return [
            'notificaciones'      => ['get', '/api/notificaciones'],
            'marcar leída'        => ['get', '/api/cambioEstadoNotificaciones/1'],
            'aceptar'             => ['put', '/api/tareas/1/aceptar'],
            'devolver'            => ['put', '/api/tareas/1/devolver'],
            'verificar (legado)'  => ['put', '/api/verificarTarea/1'],
        ];
    }

    #[DataProvider('rutasProtegidas')]
    public function test_sin_sesion_responde_401(string $metodo, string $ruta): void
    {
        $this->{$metodo . 'Json'}($ruta, [])->assertStatus(401);
    }

    // ─── Campana ────────────────────────────────────────────────────────────

    public function test_cada_uno_ve_sus_notificaciones_primero_las_no_leidas(): void
    {
        $vieja = $this->aviso($this->colaborador, 'Aviso ya leído', 1);
        $nueva = $this->aviso($this->colaborador, 'Aviso sin leer');
        $this->aviso($this->ajeno, 'Aviso de otra persona');

        $lista = $this->leerCampana($this->colaborador, $this->colaborador)->assertOk()->json();

        $this->assertSame([$nueva, $vieja], array_map(fn ($n) => (int) $n['id'], $lista));
        $this->assertFalse($lista[0]['leida']);
        $this->assertTrue($lista[1]['leida']);
    }

    public function test_las_leidas_se_limitan_a_las_50_mas_recientes(): void
    {
        for ($i = 0; $i < 55; $i++) {
            $this->aviso($this->colaborador, "Leído {$i}", 1);
        }
        $this->aviso($this->colaborador, 'Pendiente de leer');

        $lista = $this->leerCampana($this->colaborador, $this->colaborador)->assertOk()->json();

        $this->assertCount(51, $lista);
        $this->assertSame('Pendiente de leer', $lista[0]['mensaje']);
        $this->assertSame('Leído 54', $lista[1]['mensaje']);
    }

    public function test_marcar_como_leida_una_notificacion_propia(): void
    {
        $id = $this->aviso($this->colaborador, 'Aviso sin leer');

        $this->como($this->colaborador)->getJson("/api/cambioEstadoNotificaciones/{$id}")->assertOk();
        $this->assertSame(1, $this->leido($id));
    }

    public function test_nadie_lee_la_campana_de_otro_cambiando_el_id(): void
    {
        $this->aviso($this->colaborador, 'Tu evaluación de desempeño está lista');

        $respuesta = $this->leerCampana($this->ajeno, $this->colaborador);

        $mensajes = $respuesta->status() === 200 ? array_column($respuesta->json(), 'mensaje') : [];
        $this->assertNotContains('Tu evaluación de desempeño está lista', $mensajes,
            'El receptor debe salir de la sesión, no del parámetro id.');
    }

    public function test_nadie_marca_como_leida_una_notificacion_ajena(): void
    {
        $id = $this->aviso($this->colaborador, 'Aviso sin leer');

        $respuesta = $this->como($this->ajeno)->getJson("/api/cambioEstadoNotificaciones/{$id}");

        $this->assertSame(0, $this->leido($id), 'Ana no debe poder silenciar los avisos de Carlos.');
        $this->assertContains($respuesta->status(), [403, 404]);
    }

    public function test_marcar_una_notificacion_inexistente_responde_404(): void
    {
        $this->como($this->colaborador)->getJson('/api/cambioEstadoNotificaciones/999999')->assertStatus(404);
    }

    // ─── Aceptar y devolver: estado equivocado ──────────────────────────────

    public static function estadosNoEnRevision(): array
    {
        return [
            'pendiente'  => ['Pendiente'],
            'en proceso' => ['En Proceso'],
            'completada' => ['Completada'],
            'cancelada'  => ['Cancelada'],
        ];
    }

    #[DataProvider('estadosNoEnRevision')]
    public function test_solo_se_acepta_o_devuelve_lo_que_esta_en_revision(string $estado): void
    {
        $tarea = $this->tareaSinCriterios($estado);

        $this->como($this->lider)->putJson("/api/tareas/{$tarea}/aceptar")->assertStatus(409);
        $this->como($this->lider)->putJson("/api/tareas/{$tarea}/devolver", ['observacion' => 'Falta el informe'])->assertStatus(409);
        $this->como($this->lider)->putJson("/api/verificarTarea/{$tarea}", ['cumple' => true])->assertStatus(409);

        $this->assertSame($estado, $this->estadoTarea($tarea));
        $this->assertSame(0, $this->aceptaciones($tarea));
        $this->assertCount(0, $this->avisos($this->colaborador, 'Aceptada'));
        Mail::assertNothingSent();
    }

    public function test_una_tarea_inexistente_responde_404(): void
    {
        $this->como($this->lider)->putJson('/api/tareas/999999/aceptar')->assertStatus(404);
        $this->como($this->lider)->putJson('/api/tareas/999999/devolver', ['observacion' => 'Falta el informe'])->assertStatus(404);
        $this->como($this->lider)->putJson('/api/verificarTarea/999999', ['cumple' => false, 'observacion' => 'Falta el informe'])->assertStatus(404);
    }

    // ─── Aceptar y devolver: quién no puede ─────────────────────────────────

    public static function quienesNoAceptan(): array
    {
        return [
            'un ajeno'                         => ['ajeno'],
            'el propio responsable'            => ['colaborador'],
            'un compañero de equipo'           => ['independiente'],
            'el verificador no designado'      => ['verificador'],
        ];
    }

    #[DataProvider('quienesNoAceptan')]
    public function test_quien_no_lidera_al_responsable_no_acepta_ni_devuelve(string $quien): void
    {
        $tarea = $this->tareaSinCriterios('En Revisión');

        $this->como($this->{$quien})->putJson("/api/tareas/{$tarea}/aceptar")->assertStatus(403);
        $this->como($this->{$quien})->putJson("/api/tareas/{$tarea}/devolver", ['observacion' => 'Falta el informe'])->assertStatus(403);
        $this->como($this->{$quien})->putJson("/api/verificarTarea/{$tarea}", ['cumple' => true])->assertStatus(403);

        $this->assertSame('En Revisión', $this->estadoTarea($tarea));
        $this->assertSame(0, $this->aceptaciones($tarea));
        $this->assertCount(0, $this->avisos($this->colaborador, 'Aceptada'));
        $this->assertCount(0, $this->avisos($this->colaborador, 'Devuelta'));
        Mail::assertNothingSent();
    }

    public function test_el_supervisor_mueve_tareas_pero_no_acepta_entregas(): void
    {
        // Comportamiento vigente (ver «dudas»): aceptar es del líder o de administración.
        $tarea = $this->tareaSinCriterios('En Revisión');

        $this->como($this->supervisor)->putJson("/api/tareas/{$tarea}/aceptar")->assertStatus(403);
        $this->assertSame('En Revisión', $this->estadoTarea($tarea));
    }

    // ─── Aceptar y devolver: administración ─────────────────────────────────

    public function test_el_administrador_acepta_y_avisa_al_responsable(): void
    {
        $tarea = $this->tareaSinCriterios('En Revisión');

        $this->como($this->admin)->putJson("/api/tareas/{$tarea}/aceptar", ['observacion' => 'Buen trabajo'])
            ->assertOk()->assertJsonPath('estado', 'Completada');

        $this->assertSame('Completada', $this->estadoTarea($tarea));
        $this->assertSame($this->usuarioId($this->admin), (int) $this->campoTarea($tarea, 'verificada_por'));
        $this->assertCount(1, $this->avisos($this->colaborador, 'Aceptada'));
        Mail::assertSent(AvisoTareaCorreo::class, fn ($m) => $m->hasTo('colaborador@prueba.test') && $m->tipo === 'aceptada');
    }

    public function test_un_administrador_sin_ficha_de_empleado_devuelve_la_entrega(): void
    {
        $tarea = $this->tareaSinCriterios('En Revisión');

        $this->comoAdminSinFicha()->putJson("/api/tareas/{$tarea}/devolver", ['observacion' => 'Falta el anexo B'])
            ->assertOk()->assertJsonPath('estado', 'En Proceso');

        $this->assertSame('En Proceso', $this->estadoTarea($tarea));
        $this->assertSame('Falta el anexo B', $this->campoTarea($tarea, 'observacion_entrega'));
        $avisos = $this->avisos($this->colaborador, 'Devuelta');
        $this->assertCount(1, $avisos);
        $this->assertStringContainsString('Falta el anexo B', $avisos[0]->mensaje);
    }

    public function test_un_administrador_sin_ficha_de_empleado_acepta_la_entrega(): void
    {
        $tarea = $this->tareaSinCriterios('En Revisión');

        $this->comoAdminSinFicha()->putJson("/api/tareas/{$tarea}/aceptar")->assertOk();
        $this->assertSame('Completada', $this->estadoTarea($tarea));
        $this->assertSame(1, $this->aceptaciones($tarea));
    }

    // ─── Aceptar y devolver: validaciones y repeticiones ────────────────────

    public static function observacionesInvalidas(): array
    {
        return [
            'sin observación'      => [[]],
            'observación vacía'    => [['observacion' => '']],
            'observación corta'    => [['observacion' => 'mal']],
            'observación enorme'   => [['observacion' => str_repeat('x', 2001)]],
        ];
    }

    #[DataProvider('observacionesInvalidas')]
    public function test_devolver_exige_una_observacion_util(array $datos): void
    {
        $tarea = $this->tareaSinCriterios('En Revisión');

        $this->como($this->lider)->putJson("/api/tareas/{$tarea}/devolver", $datos)->assertStatus(422);
        $this->assertSame('En Revisión', $this->estadoTarea($tarea));
    }

    public function test_aceptar_rechaza_una_observacion_demasiado_larga(): void
    {
        $tarea = $this->tareaSinCriterios('En Revisión');

        $this->como($this->lider)->putJson("/api/tareas/{$tarea}/aceptar", ['observacion' => str_repeat('x', 2001)])->assertStatus(422);
        $this->assertSame('En Revisión', $this->estadoTarea($tarea));
    }

    public function test_devolver_dos_veces_no_duplica_el_registro_ni_el_aviso(): void
    {
        $tarea = $this->tareaSinCriterios('En Revisión');

        $this->como($this->lider)->putJson("/api/tareas/{$tarea}/devolver", ['observacion' => 'Falta el informe'])->assertOk();
        $this->como($this->lider)->putJson("/api/tareas/{$tarea}/devolver", ['observacion' => 'Falta el informe'])->assertStatus(409);

        $this->assertSame(1, $this->aceptaciones($tarea));
        $this->assertCount(1, $this->avisos($this->colaborador, 'Devuelta'));
    }

    public function test_aceptar_dos_veces_no_reescribe_la_aceptacion(): void
    {
        $tarea = $this->tareaSinCriterios('En Revisión');

        $this->como($this->lider)->putJson("/api/tareas/{$tarea}/aceptar")->assertOk();
        $this->como($this->admin)->putJson("/api/tareas/{$tarea}/aceptar")->assertStatus(409);

        $this->assertSame(1, $this->aceptaciones($tarea));
        $this->assertSame($this->usuarioId($this->lider), (int) $this->campoTarea($tarea, 'verificada_por'));
    }

    public function test_el_independiente_que_devuelve_su_tarea_no_se_avisa_a_si_mismo(): void
    {
        $tarea = $this->tareaSinCriterios('En Revisión', $this->independiente);

        $this->como($this->independiente)->putJson("/api/tareas/{$tarea}/devolver", ['observacion' => 'Me falta pulir el anexo'])->assertOk();

        $this->assertSame('En Proceso', $this->estadoTarea($tarea));
        $this->assertCount(0, $this->avisos($this->independiente, 'Devuelta'));
        Mail::assertNothingSent();
    }

    // ─── verificarTarea (legado) ────────────────────────────────────────────

    public function test_legado_cumple_true_acepta_una_tarea_sin_criterios(): void
    {
        $tarea = $this->tareaSinCriterios('En Revisión');

        $this->como($this->lider)->putJson("/api/verificarTarea/{$tarea}", ['cumple' => true])
            ->assertOk()->assertJsonPath('estado', 'Completada');
        $this->assertSame('Completada', $this->estadoTarea($tarea));
    }

    public function test_legado_cumple_false_devuelve_con_la_observacion(): void
    {
        $tarea = $this->tareaSinCriterios('En Revisión');

        $this->como($this->lider)->putJson("/api/verificarTarea/{$tarea}", ['cumple' => false, 'observacion' => 'Falta el anexo'])
            ->assertOk()->assertJsonPath('estado', 'En Proceso');
        $this->assertSame('Falta el anexo', $this->campoTarea($tarea, 'observacion_entrega'));
        $this->assertCount(1, $this->avisos($this->colaborador, 'Devuelta'));
    }

    public static function legadoInvalido(): array
    {
        return [
            'sin cumple'                 => [[]],
            'cumple no booleano'         => [['cumple' => 'tal vez']],
            'no cumple sin observación'  => [['cumple' => false]],
            'no cumple con observación corta' => [['cumple' => false, 'observacion' => 'no']],
            'no cumple con espacios'     => [['cumple' => false, 'observacion' => '        ']],
        ];
    }

    #[DataProvider('legadoInvalido')]
    public function test_legado_con_datos_invalidos_responde_422(array $datos): void
    {
        $tarea = $this->tareaSinCriterios('En Revisión');

        $this->como($this->lider)->putJson("/api/verificarTarea/{$tarea}", $datos)->assertStatus(422);
        $this->assertSame('En Revisión', $this->estadoTarea($tarea));
    }

    public function test_legado_no_acepta_si_faltan_criterios_obligatorios(): void
    {
        $tarea = $this->crearTarea();
        $this->enviarARevision($tarea);

        $this->como($this->lider)->putJson("/api/verificarTarea/{$tarea}", ['cumple' => true])
            ->assertStatus(422)->assertJsonStructure(['bloqueos']);
        $this->assertSame('En Revisión', $this->estadoTarea($tarea));
    }
}
