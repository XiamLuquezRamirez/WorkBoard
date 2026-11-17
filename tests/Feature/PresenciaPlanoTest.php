<?php

namespace Tests\Feature;

use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * Presencia en el plano: el estado que cada quien elige, lo que se deduce de
 * la agenda, el chat y las tareas, y los saludos entre compañeros.
 */
class PresenciaPlanoTest extends TestCase
{
    use DatabaseTransactions;
    use DatosDeEquipo;

    protected $connectionsToTransact = ['mysql2'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararEquipo();
        Mail::fake();
        $this->withoutDefer();
        // Un martes a las tres de la tarde en Bogotá: lejos de la medianoche,
        // donde «hoy» en UTC y en Bogotá ya no coinciden.
        $this->travelTo(Carbon::parse('2026-11-10 15:00:00', 'America/Bogota'));
    }

    private function db()
    {
        return DB::connection('mysql2');
    }

    /** Presencia de $quien tal como la ve $vista en el plano. */
    private function presencia(int $quien, ?int $vista = null): array
    {
        $plano = $this->como($vista ?? $this->ajeno)->getJson('/api/tablero/plano')->assertOk()->json();
        foreach ($plano['zonas'] as $z) {
            foreach ($z['puestos'] as $p) {
                if ($p['id'] === $quien) {
                    return $p['presencia'];
                }
            }
        }
        $this->fail("El empleado {$quien} no aparece en el plano.");
    }

    private function latido(int $quien): void
    {
        $this->como($quien)->getJson('/api/equipo/chat/avisos')->assertOk();
    }

    private function reunionAhora(int $organizador, array $asistentes = [], ?string $fin = '15:30:00'): int
    {
        $id = $this->db()->table('reuniones')->insertGetId([
            'titulo' => 'Revisión semanal', 'fecha' => '2026-11-10',
            'hora_inicio' => '14:45:00', 'hora_fin' => $fin,
            'organizador' => $organizador, 'estado' => 'Programada',
        ]);
        foreach ($asistentes as $empleado => $respuesta) {
            $this->db()->table('reuniones_asistentes')->insert(
                ['reunion' => $id, 'empleado' => $empleado, 'respuesta' => $respuesta]
            );
        }
        return $id;
    }

    public function test_sin_la_aplicacion_abierta_sale_desconectado_y_con_ella_disponible(): void
    {
        $this->assertSame('desconectado', $this->presencia($this->colaborador)['estado']);

        $this->latido($this->colaborador);
        $p = $this->presencia($this->colaborador);
        $this->assertSame('disponible', $p['estado']);
        $this->assertFalse($p['elegido']);

        // Pasados unos minutos sin latido, vuelve a desconectado.
        $this->travel(4)->minutes();
        $this->assertSame('desconectado', $this->presencia($this->colaborador)['estado']);
    }

    public function test_el_estado_elegido_lo_ven_los_demas_con_su_nota(): void
    {
        $this->como($this->colaborador)->postJson('/api/equipo/presencia', ['estado' => 'ocupado', 'nota' => '  Cerrando el informe  '])
            ->assertOk()
            ->assertJsonPath('presencia.estado', 'ocupado')
            ->assertJsonPath('presencia.nota', 'Cerrando el informe');

        $p = $this->presencia($this->colaborador, $this->ajeno);
        $this->assertSame('ocupado', $p['estado']);
        $this->assertTrue($p['elegido']);
        $this->assertSame('Cerrando el informe', $p['nota']);
    }

    public function test_ocupado_caduca_al_cerrar_la_aplicacion_pero_ausente_y_almuerzo_no(): void
    {
        $this->como($this->colaborador)->postJson('/api/equipo/presencia', ['estado' => 'ocupado'])->assertOk();
        $this->como($this->lider)->postJson('/api/equipo/presencia', ['estado' => 'almuerzo'])->assertOk();
        $this->como($this->independiente)->postJson('/api/equipo/presencia', ['estado' => 'ausente'])->assertOk();

        $this->travel(10)->minutes();

        $this->assertSame('desconectado', $this->presencia($this->colaborador)['estado']);
        $this->assertSame('almuerzo', $this->presencia($this->lider)['estado']);
        $this->assertSame('ausente', $this->presencia($this->independiente)['estado']);
    }

    public function test_el_estado_de_ayer_no_vale_hoy(): void
    {
        $this->como($this->colaborador)->postJson('/api/equipo/presencia', ['estado' => 'ausente'])->assertOk();

        $this->travelTo(Carbon::parse('2026-11-11 08:00:00', 'America/Bogota'));
        $this->latido($this->colaborador);

        $p = $this->presencia($this->colaborador);
        $this->assertSame('disponible', $p['estado']);
        $this->assertFalse($p['elegido']);
    }

    public function test_volver_a_automatico_borra_estado_y_nota(): void
    {
        $this->como($this->colaborador)->postJson('/api/equipo/presencia', ['estado' => 'ocupado', 'nota' => 'no molestar'])->assertOk();
        $this->como($this->colaborador)->postJson('/api/equipo/presencia', ['estado' => null])->assertOk()
            ->assertJsonPath('presencia.estado', 'disponible')
            ->assertJsonPath('presencia.nota', null);
    }

    public function test_estados_y_notas_invalidos_se_rechazan(): void
    {
        $this->como($this->colaborador)->postJson('/api/equipo/presencia', ['estado' => 'de vacaciones'])->assertStatus(422);
        $this->como($this->colaborador)->postJson('/api/equipo/presencia', ['estado' => 'ocupado', 'nota' => str_repeat('a', 81)])
            ->assertStatus(422);
        $this->como($this->colaborador)->postJson('/api/equipo/presencia', [])->assertStatus(422);
    }

    public function test_la_agenda_pone_en_reunion_a_quienes_asisten(): void
    {
        $this->reunionAhora($this->lider, [
            $this->colaborador   => 'Acepta',
            $this->verificador   => 'Pendiente',
            $this->independiente => 'Rechaza',
        ]);
        foreach ([$this->lider, $this->colaborador, $this->verificador, $this->independiente] as $e) {
            $this->latido($e);
        }

        $this->assertSame('reunion', $this->presencia($this->lider)['estado']);
        $this->assertSame('reunion', $this->presencia($this->colaborador)['estado']);
        $this->assertSame('reunion', $this->presencia($this->verificador)['estado']);
        $this->assertSame('disponible', $this->presencia($this->independiente)['estado']);
    }

    public function test_todos_los_asistentes_van_a_la_misma_sala_y_cambian_solos(): void
    {
        // Habían elegido estar disponibles: la reunión manda igual.
        $this->como($this->colaborador)->postJson('/api/equipo/presencia', ['estado' => 'disponible'])->assertOk();
        $id = $this->reunionAhora($this->lider, [$this->colaborador => 'Acepta', $this->verificador => 'Pendiente']);

        foreach ([$this->lider, $this->colaborador, $this->verificador] as $e) {
            $p = $this->presencia($e);
            $this->assertSame('reunion', $p['estado']);
            $this->assertSame($id, $p['reunion']);
            $this->assertSame('juntas', $p['sala']);
        }

        // Al terminar, vuelven solos a lo que tenían.
        $this->travelTo(Carbon::parse('2026-11-10 15:31:00', 'America/Bogota'));
        $this->latido($this->colaborador);
        $p = $this->presencia($this->colaborador);
        $this->assertSame('disponible', $p['estado']);
        $this->assertNull($p['sala']);
    }

    public function test_el_lugar_decide_la_sala_de_la_reunion(): void
    {
        $id = $this->reunionAhora($this->lider, [$this->colaborador => 'Acepta']);
        $this->db()->table('reuniones')->where('id', $id)->update(['lugar' => 'Salón de capacitación']);

        $this->assertSame('salon', $this->presencia($this->colaborador)['sala']);
        $this->assertSame('juntas', \App\Support\Presencia::salaDeReunion('Sala de juntas'));
        $this->assertSame('juntas', \App\Support\Presencia::salaDeReunion(null));
        $this->assertSame('salon', \App\Support\Presencia::salaDeReunion('SALON 2'));
    }

    public function test_en_reunion_elegido_a_mano_no_trae_sala(): void
    {
        $this->como($this->colaborador)->postJson('/api/equipo/presencia', ['estado' => 'reunion'])->assertOk();
        $p = $this->presencia($this->colaborador);
        $this->assertSame('reunion', $p['estado']);
        $this->assertNull($p['sala']);
    }

    public function test_una_reunion_cancelada_o_ya_terminada_no_cuenta(): void
    {
        $cancelada = $this->reunionAhora($this->lider);
        $this->db()->table('reuniones')->where('id', $cancelada)->update(['estado' => 'Cancelada']);
        $this->reunionAhora($this->colaborador, [], '14:55:00');
        // Sin hora de fin se supone una hora: empezó hace más de una hora.
        $this->db()->table('reuniones')->insert([
            'titulo' => 'Mañanera', 'fecha' => '2026-11-10', 'hora_inicio' => '13:30:00', 'hora_fin' => null,
            'organizador' => $this->verificador, 'estado' => 'Programada',
        ]);
        foreach ([$this->lider, $this->colaborador, $this->verificador] as $e) {
            $this->latido($e);
        }

        $this->assertSame('disponible', $this->presencia($this->lider)['estado']);
        $this->assertSame('disponible', $this->presencia($this->colaborador)['estado']);
        $this->assertSame('disponible', $this->presencia($this->verificador)['estado']);
    }

    public function test_ausente_gana_a_la_agenda(): void
    {
        $this->reunionAhora($this->lider, [$this->colaborador => 'Acepta']);
        $this->como($this->colaborador)->postJson('/api/equipo/presencia', ['estado' => 'ausente'])->assertOk();

        $this->assertSame('ausente', $this->presencia($this->colaborador)['estado']);
    }

    public function test_la_actividad_anima_a_quien_trabaja_o_escribe(): void
    {
        $tarea = $this->crearTarea(null, $this->colaborador);
        $this->db()->table('tareas_empleados')->where('id', $tarea)->update(['estado' => 'En Proceso']);
        $this->latido($this->colaborador);
        $this->latido($this->lider);

        $this->assertSame('tarea', $this->presencia($this->colaborador)['actividad']);
        $this->assertNull($this->presencia($this->lider)['actividad']);

        $conv = $this->db()->table('chat_conversaciones')->insertGetId([
            'clave' => 'prueba-presencia', 'tipo' => 'directo', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->db()->table('chat_mensajes')->insert([
            'conversacion' => $conv, 'empleado' => $this->colaborador, 'mensaje' => 'hola',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->assertSame('escribiendo', $this->presencia($this->colaborador)['actividad']);

        // Quien está ausente no se anima aunque tenga la tarea abierta.
        $this->como($this->colaborador)->postJson('/api/equipo/presencia', ['estado' => 'ausente'])->assertOk();
        $this->assertNull($this->presencia($this->colaborador)['actividad']);
    }

    public function test_una_tarea_pausada_no_cuenta_como_trabajo_en_curso(): void
    {
        $tarea = $this->crearTarea(null, $this->colaborador);
        $this->db()->table('tareas_empleados')->where('id', $tarea)->update(['estado' => 'En Proceso', 'pausada' => 1]);
        $this->latido($this->colaborador);

        $this->assertNull($this->presencia($this->colaborador)['actividad']);
    }

    public function test_saludar_avisa_en_la_campana_y_el_personaje_saluda(): void
    {
        $this->como($this->colaborador)->postJson("/api/equipo/saludar/{$this->ajeno}")->assertOk();

        $receptor = $this->db()->table('users')->where('empleado', $this->ajeno)->value('id');
        $aviso = $this->db()->table('notif_generales')->where('id_receptor', $receptor)->where('tipo', 'Saludo')->first();
        $this->assertNotNull($aviso);
        $this->assertStringContainsString('Carlos Colaborador te saludó', $aviso->mensaje);

        $this->assertTrue($this->presencia($this->colaborador, $this->lider)['saluda']);

        // El gesto dura unos segundos.
        $this->travel(1)->minutes();
        $this->assertFalse($this->presencia($this->colaborador, $this->lider)['saluda']);
    }

    public function test_no_se_puede_saludar_en_rafaga_ni_a_uno_mismo_ni_a_quien_no_existe(): void
    {
        $this->como($this->colaborador)->postJson("/api/equipo/saludar/{$this->ajeno}")->assertOk();
        $this->como($this->colaborador)->postJson("/api/equipo/saludar/{$this->ajeno}")->assertStatus(429);
        // A otra persona sí.
        $this->como($this->colaborador)->postJson("/api/equipo/saludar/{$this->lider}")->assertOk();

        $this->como($this->colaborador)->postJson("/api/equipo/saludar/{$this->colaborador}")->assertStatus(422);
        $this->como($this->colaborador)->postJson('/api/equipo/saludar/99999999')->assertStatus(404);
    }

    private function uso(int $quien, string $uso): void
    {
        $this->como($quien)->postJson('/api/equipo/presencia/uso', ['uso' => $uso])->assertOk()->assertJsonPath('guardado', true);
    }

    public function test_usar_el_equipo_anima_aunque_no_haya_tarea_en_curso(): void
    {
        $this->uso($this->colaborador, 'activo');

        $p = $this->presencia($this->colaborador);
        $this->assertSame('disponible', $p['estado']);
        $this->assertSame('equipo', $p['actividad']);
        $this->assertSame('activo', $p['uso_equipo']);
    }

    public function test_sin_usar_el_equipo_o_con_la_pantalla_bloqueada_pasa_a_ausente_y_vuelve_solo(): void
    {
        $this->uso($this->colaborador, 'inactivo');
        $p = $this->presencia($this->colaborador);
        $this->assertSame('ausente', $p['estado']);
        $this->assertFalse($p['elegido']);
        $this->assertSame('Sin usar el equipo hace unos minutos', $p['nota']);

        $this->uso($this->colaborador, 'bloqueado');
        $this->assertSame('Pantalla bloqueada', $this->presencia($this->colaborador)['nota']);

        // Vuelve a usarlo: disponible otra vez, sin hacer nada más.
        $this->uso($this->colaborador, 'activo');
        $this->assertSame('disponible', $this->presencia($this->colaborador)['estado']);
    }

    public function test_lo_elegido_a_mano_manda_sobre_el_uso_del_equipo(): void
    {
        $this->como($this->colaborador)->postJson('/api/equipo/presencia', ['estado' => 'ocupado'])->assertOk();
        $this->uso($this->colaborador, 'bloqueado');

        $this->assertSame('ocupado', $this->presencia($this->colaborador)['estado']);
    }

    public function test_un_aviso_de_uso_viejo_ya_no_cuenta(): void
    {
        $this->uso($this->colaborador, 'inactivo');
        $this->travel(4)->minutes();
        $this->latido($this->colaborador);

        $p = $this->presencia($this->colaborador);
        $this->assertSame('disponible', $p['estado']);
        $this->assertNull($p['uso_equipo']);
    }

    public function test_el_uso_del_equipo_solo_admite_tres_valores(): void
    {
        $this->como($this->colaborador)->postJson('/api/equipo/presencia/uso', ['uso' => 'jugando'])->assertStatus(422);
        $this->como($this->colaborador)->postJson('/api/equipo/presencia/uso', [])->assertStatus(422);
    }

    public function test_el_plano_dice_quien_soy(): void
    {
        $this->como($this->colaborador)->getJson('/api/tablero/plano')->assertOk()->assertJsonPath('yo', $this->colaborador);
    }
}
