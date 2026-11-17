<?php

namespace Tests\Feature;

use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/** Resolver vencidas desde el dashboard y su carga liviana. */
class DashboardVencidasTest extends TestCase
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
        $this->withoutDefer();
        $this->travelTo(Carbon::parse('2026-11-14 10:00', 'America/Bogota'));

        $this->admin = $this->empleado('Adela', 'Administradora');
        $this->usuario($this->admin, 'admin@prueba.test', 'No', 'No', 'Administrador');
    }

    private function db()
    {
        return DB::connection('mysql2');
    }

    private function tarea(int $empleado, array $campos = []): int
    {
        return $this->db()->table('tareas_empleados')->insertGetId(array_merge([
            'empleado' => $empleado, 'titulo' => 'Tarea', 'descripcion' => 'x',
            'estado' => 'Pendiente', 'prioridad' => 'Media', 'estado_reg' => 'Activo',
            'fecha_creacion' => '2026-01-10', 'fecha_pactada' => '2026-01-29',
        ], $campos));
    }

    private function ids(int $quien, array $params = []): array
    {
        return collect($this->como($quien)->getJson('/api/dashboard/vencidas?' . http_build_query($params))->assertOk()->json('tareas'))
            ->pluck('id')->all();
    }

    public function test_lista_solo_lo_vencido_de_la_mas_antigua_a_la_mas_reciente(): void
    {
        $vieja = $this->tarea($this->colaborador, ['fecha_pactada' => '2026-01-29']);
        $reciente = $this->tarea($this->colaborador, ['fecha_pactada' => '2026-11-10']);
        $this->tarea($this->colaborador, ['fecha_pactada' => '2026-11-14']);                 // vence hoy
        $this->tarea($this->colaborador, ['estado' => 'En Revisión']);                      // ya entregada
        $this->tarea($this->colaborador, ['pausada' => 1]);                                 // pausa aprobada
        $this->tarea($this->colaborador, ['archivar' => 1]);                                // archivada
        $this->tarea($this->colaborador, ['estado' => 'Completada', 'fecha_entregada' => '2026-02-01']);

        $this->assertSame([$vieja, $reciente], $this->ids($this->admin, ['empleado' => $this->colaborador]));

        $fila = collect($this->como($this->admin)->getJson('/api/dashboard/vencidas')->json('tareas'))->firstWhere('id', $vieja);
        $this->assertSame(289, $fila['dias']);
        $this->assertSame('Carlos Colaborador', $fila['empleado']);
    }

    public function test_un_lider_ve_las_de_su_equipo_y_un_colaborador_ninguna(): void
    {
        $deSuEquipo = $this->tarea($this->colaborador);
        $propia = $this->tarea($this->lider);
        $ajena = $this->tarea($this->ajeno);

        $delLider = $this->ids($this->lider);
        $this->assertContains($deSuEquipo, $delLider);
        $this->assertNotContains($propia, $delLider, 'Las propias no se resuelven por aquí.');
        $this->assertNotContains($ajena, $delLider);

        $this->assertSame([], $this->ids($this->colaborador));
    }

    public function test_pedir_actualizacion_avisa_una_vez_al_dia_y_no_cuenta_como_actividad(): void
    {
        $t = $this->tarea($this->colaborador, ['titulo' => 'Informe trimestral']);

        $r = $this->como($this->lider)->postJson('/api/dashboard/vencidas/resolver', ['accion' => 'pedir', 'tareas' => [$t]])
            ->assertOk()->json();
        $this->assertSame([$t], $r['hechas']);

        $uid = $this->db()->table('users')->where('empleado', $this->colaborador)->value('id');
        $aviso = $this->db()->table('notif_generales')->where('id_receptor', $uid)->where('tipo', 'PedidoActualizacion')->first();
        $this->assertStringContainsString('«Informe trimestral»: venció hace 289 días', $aviso->mensaje);

        // Repetir el mismo día no vuelve a avisar.
        $this->como($this->lider)->postJson('/api/dashboard/vencidas/resolver', ['accion' => 'pedir', 'tareas' => [$t]])
            ->assertStatus(422)->assertJsonPath('omitidas.0.motivo', 'Ya se pidió en las últimas 24 horas.');

        // Que el líder le escriba no hace que la persona parezca activa.
        $ind = collect($this->como($this->admin)->getJson('/api/dashboard/cargarEmpleadosTareas?ligero=1')->json())
            ->firstWhere('id', $this->colaborador)['indicadores'];
        $this->assertFalse($ind['activo_semana']);
    }

    public function test_reprogramar_exige_fecha_futura_y_motivo_y_deja_constancia(): void
    {
        $t = $this->tarea($this->colaborador);
        $url = '/api/dashboard/vencidas/resolver';

        $this->como($this->admin)->postJson($url, ['accion' => 'reprogramar', 'tareas' => [$t], 'motivo' => 'Cambió el alcance'])
            ->assertStatus(422)->assertJsonValidationErrors('fecha_pactada');
        $this->como($this->admin)->postJson($url, ['accion' => 'reprogramar', 'tareas' => [$t], 'fecha_pactada' => '2026-11-13', 'motivo' => 'Cambió el alcance'])
            ->assertStatus(422)->assertJsonValidationErrors('fecha_pactada');
        $this->como($this->admin)->postJson($url, ['accion' => 'reprogramar', 'tareas' => [$t], 'fecha_pactada' => '2026-12-01'])
            ->assertStatus(422)->assertJsonValidationErrors('motivo');

        $this->como($this->admin)->postJson($url, ['accion' => 'reprogramar', 'tareas' => [$t], 'fecha_pactada' => '2026-12-01', 'motivo' => 'Cambió el alcance'])
            ->assertOk();

        $fila = $this->db()->table('tareas_empleados')->where('id', $t)->first();
        $this->assertSame('2026-12-01', $fila->fecha_pactada);
        $this->assertSame(1, (int) $fila->reprogramada);
        $this->assertSame('Cambió el alcance', $fila->motivo_reprogramacion);
        $this->assertTrue($this->db()->table('notif_generales')->where('tarea_id', $t)->where('tipo', 'Reprogramada')->exists());
        $this->assertSame([], $this->ids($this->admin, ['empleado' => $this->colaborador]));
    }

    public function test_archivar_exige_motivo(): void
    {
        $t = $this->tarea($this->colaborador);
        $url = '/api/dashboard/vencidas/resolver';

        $this->como($this->admin)->postJson($url, ['accion' => 'archivar', 'tareas' => [$t]])->assertStatus(422);
        $this->como($this->admin)->postJson($url, ['accion' => 'archivar', 'tareas' => [$t], 'motivo' => 'El cliente canceló'])->assertOk();

        $this->assertSame(1, (int) $this->db()->table('tareas_empleados')->where('id', $t)->value('archivar'));
        $this->assertTrue($this->db()->table('notif_generales')->where('tarea_id', $t)->where('tipo', 'Archivada')->exists());
    }

    public function test_nadie_resuelve_sus_propias_vencidas_ni_las_ajenas(): void
    {
        $propia = $this->tarea($this->colaborador);
        $ajena = $this->tarea($this->ajeno);
        $url = '/api/dashboard/vencidas/resolver';

        $this->como($this->colaborador)->postJson($url, ['accion' => 'reprogramar', 'tareas' => [$propia], 'fecha_pactada' => '2026-12-01', 'motivo' => 'Me conviene'])
            ->assertStatus(422)->assertJsonPath('omitidas.0.motivo', 'No es de tu equipo.');
        $this->como($this->lider)->postJson($url, ['accion' => 'archivar', 'tareas' => [$ajena], 'motivo' => 'No es mía'])
            ->assertStatus(422);

        $this->assertSame('2026-01-29', $this->db()->table('tareas_empleados')->where('id', $propia)->value('fecha_pactada'));
        $this->assertSame(0, (int) $this->db()->table('tareas_empleados')->where('id', $ajena)->value('archivar'));
    }

    public function test_la_carga_ligera_trae_indicadores_sin_detalle_y_el_detalle_va_por_persona(): void
    {
        $this->tarea($this->colaborador);

        $ligera = collect($this->como($this->admin)->getJson('/api/dashboard/cargarEmpleadosTareas?ligero=1')->assertOk()->json())
            ->firstWhere('id', $this->colaborador);
        $this->assertSame([], $ligera['tareas']);
        $this->assertNull($ligera['foto']);
        $this->assertFalse($ligera['detalle']);
        $this->assertSame(1, $ligera['indicadores']['vencidas']);

        $una = $this->como($this->admin)->getJson("/api/dashboard/cargarEmpleadosTareas?empleado={$this->colaborador}")->assertOk()->json();
        $this->assertCount(1, $una);
        $this->assertCount(1, $una[0]['tareas']);
        $this->assertArrayHasKey('evidencias', $una[0]['tareas'][0]);
        $this->assertTrue($una[0]['detalle']);

        // Un líder no abre a quien no es de su equipo.
        $this->como($this->lider)->getJson("/api/dashboard/cargarEmpleadosTareas?empleado={$this->ajeno}")->assertStatus(403);
    }
}
