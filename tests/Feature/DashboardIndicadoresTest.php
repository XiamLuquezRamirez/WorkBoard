<?php

namespace Tests\Feature;

use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/** El dashboard de administración recibe los indicadores ya calculados. */
class DashboardIndicadoresTest extends TestCase
{
    use DatabaseTransactions;
    use DatosDeEquipo;

    protected $connectionsToTransact = ['mysql2'];

    private int $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararEquipo();
        Mail::fake();
        $this->travelTo(Carbon::parse('2026-11-14 10:00', 'America/Bogota'));

        $this->admin = $this->empleado('Adela', 'Administradora');
        $this->usuario($this->admin, 'admin@prueba.test', 'No', 'No', 'Administrador');
    }

    private function tarea(array $campos): int
    {
        return DB::connection('mysql2')->table('tareas_empleados')->insertGetId(array_merge([
            'empleado' => $this->colaborador, 'titulo' => 'Tarea', 'descripcion' => 'x',
            'estado' => 'Pendiente', 'prioridad' => 'Media', 'estado_reg' => 'Activo',
            'fecha_creacion' => '2026-11-01',
        ], $campos));
    }

    private function fila(int $empleado): array
    {
        return collect($this->como($this->admin)->getJson('/api/dashboard/cargarEmpleadosTareas')->assertOk()->json())
            ->firstWhere('id', $empleado);
    }

    public function test_cada_persona_trae_sus_indicadores(): void
    {
        $this->tarea(['estado' => 'Completada', 'fecha_pactada' => '2026-11-05', 'fecha_entregada' => '2026-11-04']);
        $this->tarea(['estado' => 'En Proceso', 'fecha_pactada' => '2026-11-01']);
        $this->tarea(['estado' => 'En Revisión', 'fecha_pactada' => '2026-11-01']);

        $ind = $this->fila($this->colaborador)['indicadores'];

        $this->assertSame(1, $ind['vencidas'], 'En Revisión ya está entregada: no cuenta como vencida.');
        $this->assertSame(1, $ind['completadas']);
        $this->assertSame(1, $ind['a_tiempo']);
        $this->assertSame(90, $ind['ventana_dias']);
        $this->assertNotNull($ind['indice']);
        $this->assertSame('2026-11-04', $ind['ultima_actividad']);
    }

    public function test_el_ultimo_movimiento_sale_del_historial_pero_no_de_los_recordatorios(): void
    {
        $tarea = $this->tarea(['estado' => 'En Proceso', 'fecha_creacion' => '2026-03-01', 'fecha_pactada' => '2026-12-01']);
        $aviso = fn (string $tipo, string $cuando) => DB::connection('mysql2')->table('notif_generales')->insert([
            'id_emisor' => 0, 'tipo_emisor' => 'sistema', 'id_receptor' => 1, 'tipo_receptor' => 'empleado',
            'mensaje' => 'x', 'tarea_id' => $tarea, 'leido' => 0, 'fecha_creacion' => $cuando, 'tipo' => $tipo,
        ]);

        // El recordatorio automático llega aunque nadie toque nada.
        $aviso('TareaAtrasada', '2026-11-14 08:00:00');
        $ind = $this->fila($this->colaborador)['indicadores'];
        $this->assertSame('2026-03-01', $ind['ultima_actividad']);
        $this->assertContains('sin-movimiento', $ind['atencion']);

        // Un cambio de estado sí es trabajo.
        $aviso('Estado', '2026-11-12 15:00:00');
        $ind = $this->fila($this->colaborador)['indicadores'];
        $this->assertSame('2026-11-12', $ind['ultima_actividad']);
        $this->assertTrue($ind['activo_semana']);
        // La tarea no tiene criterios de aceptación.
        $this->assertSame(1, $ind['sin_criterio']);
    }

    public function test_las_recientes_traen_su_fecha_y_no_hay_ranking_al_azar(): void
    {
        $this->tarea(['titulo' => 'Vieja', 'fecha_creacion' => '2026-05-12']);
        $fila = $this->fila($this->colaborador);

        $this->assertSame('2026-05-12', $fila['tareasRecientes'][0]['fecha_creacion']);
        $this->assertArrayNotHasKey('ranking', $fila['rendimiento']);
        $this->assertSame('sin-datos', $this->fila($this->ajeno)['indicadores']['nivel']);
    }
}
