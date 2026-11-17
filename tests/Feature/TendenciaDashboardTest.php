<?php

namespace Tests\Feature;

use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/** Tendencia semanal del dashboard: creadas, entregadas y personas activas. */
class TendenciaDashboardTest extends TestCase
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
        // Viernes 14 de noviembre de 2026: la semana en curso empieza el lunes 9.
        $this->travelTo(Carbon::parse('2026-11-14 10:00', 'America/Bogota'));

        $this->admin = $this->empleado('Adela', 'Administradora');
        $this->usuario($this->admin, 'admin@prueba.test', 'No', 'No', 'Administrador');
    }

    private function tarea(int $empleado, array $campos): int
    {
        return DB::connection('mysql2')->table('tareas_empleados')->insertGetId(array_merge([
            'empleado' => $empleado, 'titulo' => 'Tarea', 'descripcion' => 'x',
            'estado' => 'Pendiente', 'prioridad' => 'Media', 'estado_reg' => 'Activo',
        ], $campos));
    }

    private function semana(array $r, string $lunes): array
    {
        return collect($r['semanas'])->firstWhere('inicio', $lunes);
    }

    public function test_cuenta_por_semana_creadas_entregadas_y_personas(): void
    {
        $this->tarea($this->colaborador, ['fecha_creacion' => '2026-11-10']);
        $this->tarea($this->colaborador, ['fecha_creacion' => '2026-11-03', 'estado' => 'Completada', 'fecha_entregada' => '2026-11-12']);
        $t = $this->tarea($this->ajeno, ['fecha_creacion' => '2026-05-01']);
        // El ajeno sólo cambió el estado de una tarea vieja: también movió trabajo.
        DB::connection('mysql2')->table('notif_generales')->insert([
            ['id_emisor' => 0, 'tipo_emisor' => 'sistema', 'id_receptor' => 1, 'tipo_receptor' => 'empleado',
             'mensaje' => 'x', 'tarea_id' => $t, 'leido' => 0, 'fecha_creacion' => '2026-11-11 09:00:00', 'tipo' => 'Estado'],
            // El recordatorio automático no cuenta.
            ['id_emisor' => 0, 'tipo_emisor' => 'sistema', 'id_receptor' => 1, 'tipo_receptor' => 'empleado',
             'mensaje' => 'x', 'tarea_id' => $t, 'leido' => 0, 'fecha_creacion' => '2026-11-04 08:00:00', 'tipo' => 'TareaAtrasada'],
        ]);

        $r = $this->como($this->admin)->getJson('/api/dashboard/tendencia?semanas=12')->assertOk()->json();

        $this->assertCount(12, $r['semanas']);
        $this->assertSame('2026-11-09', end($r['semanas'])['inicio']);

        $esta = $this->semana($r, '2026-11-09');
        $this->assertSame(1, $esta['creadas']);
        $this->assertSame(1, $esta['entregadas']);
        $this->assertSame(2, $esta['personas']);

        $anterior = $this->semana($r, '2026-11-02');
        $this->assertSame(1, $anterior['creadas']);
        $this->assertSame(1, $anterior['personas'], 'El recordatorio de atraso no es actividad.');
    }

    public function test_se_acota_por_area_y_por_alcance(): void
    {
        $area = DB::connection('mysql2')->table('departamentos')->insertGetId(['nombre' => 'Área de Prueba']);
        DB::connection('mysql2')->table('empleados')->where('id', $this->colaborador)->update(['departamento' => $area]);
        $this->tarea($this->colaborador, ['fecha_creacion' => '2026-11-10']);
        $this->tarea($this->ajeno, ['fecha_creacion' => '2026-11-10']);

        $r = $this->como($this->admin)->getJson('/api/dashboard/tendencia?' . http_build_query(['departamento' => 'Área de Prueba']))
            ->assertOk()->json();
        $this->assertSame(1, $this->semana($r, '2026-11-09')['creadas']);
        $this->assertSame(1, $r['total_personas']);

        // Un líder ve a su equipo (él y sus colaboradores), no al ajeno.
        $r = $this->como($this->lider)->getJson('/api/dashboard/tendencia')->assertOk()->json();
        $this->assertCount(26, $r['semanas']);
        $this->assertSame(1, $this->semana($r, '2026-11-09')['creadas']);
        $this->assertSame(3, $r['total_personas']);
    }

    public function test_el_rango_admitido_es_12_26_o_52(): void
    {
        $this->como($this->admin)->getJson('/api/dashboard/tendencia?semanas=7')->assertStatus(422);
        $this->assertCount(52, $this->como($this->admin)->getJson('/api/dashboard/tendencia?semanas=52')->json('semanas'));
    }
}
