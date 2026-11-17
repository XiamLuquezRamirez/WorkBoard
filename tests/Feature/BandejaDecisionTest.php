<?php

namespace Tests\Feature;

use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/** Bandeja «Necesita tu decisión»: las vencidas propias sin decidir. */
class BandejaDecisionTest extends TestCase
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
        $this->travelTo(Carbon::parse('2026-11-14 10:00', 'America/Bogota'));
    }

    private function db()
    {
        return DB::connection('mysql2');
    }

    private function tarea(array $campos = [], ?int $empleado = null): int
    {
        return $this->db()->table('tareas_empleados')->insertGetId(array_merge([
            'empleado' => $empleado ?? $this->colaborador, 'titulo' => 'Tarea', 'descripcion' => 'x',
            'estado' => 'Pendiente', 'prioridad' => 'Media', 'estado_reg' => 'Activo',
            'fecha_creacion' => '2026-10-01', 'fecha_pactada' => '2026-11-01',
        ], $campos));
    }

    private function bandeja(int $quien): array
    {
        return collect($this->como($quien)->getJson('/api/mis-decisiones')->assertOk()->json('tareas'))->pluck('id')->all();
    }

    public function test_muestra_solo_las_vencidas_propias_sin_decidir(): void
    {
        $vieja = $this->tarea(['fecha_pactada' => '2026-01-29']);
        $reciente = $this->tarea(['fecha_pactada' => '2026-11-10', 'estado' => 'En Proceso']);
        $this->tarea(['fecha_pactada' => '2026-11-14']);                          // vence hoy
        $this->tarea(['estado' => 'En Revisión']);                                // entregada
        $this->tarea(['pausada' => 1]);                                           // en pausa
        $this->tarea(['bloqueada' => 1, 'motivo_bloqueo' => 'Falta el contrato']); // ya declarada
        $this->tarea(['archivar' => 1]);
        $this->tarea(['estado' => 'Completada', 'fecha_entregada' => '2026-11-02']);
        $conSolicitud = $this->tarea();
        $this->db()->table('reprogramaciones_tareas')->insert([
            'tarea_id' => $conSolicitud, 'solicitado_por' => $this->colaborador,
            'solicitado_por_user' => $this->db()->table('users')->where('empleado', $this->colaborador)->value('id'), 'fecha_actual' => '2026-11-01',
            'fecha_nueva' => '2026-12-01', 'motivo' => 'Espera', 'estado' => 'Pendiente', 'tipo_aprobador' => 'lider',
            'fecha_solicitud' => now(),
        ]);
        $this->tarea([], $this->ajeno); // de otra persona

        $this->assertSame([$vieja, $reciente], $this->bandeja($this->colaborador));

        $fila = $this->como($this->colaborador)->getJson('/api/mis-decisiones')->json('tareas.0');
        $this->assertSame(289, $fila['dias']);
    }

    public function test_pedir_nueva_fecha_la_saca_de_la_bandeja_pero_no_a_una_fecha_pasada(): void
    {
        $t = $this->tarea();

        $this->como($this->colaborador)->postJson('/api/reprogramaciones/solicitar', [
            'tarea_id' => $t, 'fecha_nueva' => '2026-11-13', 'motivo' => 'Falta información',
        ])->assertStatus(422)->assertJsonValidationErrors('fecha_nueva');

        // Sin fecha_actual también funciona (antes daba 500).
        $this->como($this->colaborador)->postJson('/api/reprogramaciones/solicitar', [
            'tarea_id' => $t, 'fecha_nueva' => '2026-11-28', 'motivo' => 'Falta información del cliente',
        ])->assertCreated();

        $this->assertSame([], $this->bandeja($this->colaborador));
    }

    public function test_declararla_bloqueada_la_saca_de_la_bandeja(): void
    {
        $t = $this->tarea();

        $this->como($this->colaborador)->putJson("/api/bloquearTarea/{$t}", [
            'bloqueada' => true, 'motivo' => 'Esperando la firma del contrato del cliente',
        ])->assertOk();

        $this->assertSame([], $this->bandeja($this->colaborador));
    }

    public function test_ya_no_aplica_la_archiva_con_motivo_y_avisa_al_lider(): void
    {
        $t = $this->tarea(['titulo' => 'Folleto de feria']);

        $this->como($this->colaborador)->postJson("/api/mis-decisiones/{$t}/ya-no-aplica", ['motivo' => 'corto'])
            ->assertStatus(422);
        $this->como($this->colaborador)->postJson("/api/mis-decisiones/{$t}/ya-no-aplica", ['motivo' => 'La feria se canceló este año'])
            ->assertOk();

        $this->assertSame(1, (int) $this->db()->table('tareas_empleados')->where('id', $t)->value('archivar'));
        $this->assertTrue($this->db()->table('notif_generales')->where('tarea_id', $t)->where('tipo', 'Archivada')
            ->where('mensaje', 'like', '%La feria se canceló este año%')->exists());

        $uidLider = $this->db()->table('users')->where('empleado', $this->lider)->value('id');
        $aviso = $this->db()->table('notif_generales')->where('id_receptor', $uidLider)->where('tarea_id', $t)->first();
        $this->assertNotNull($aviso);
        $this->assertStringContainsString('«Folleto de feria» porque ya no aplica', $aviso->mensaje);

        $this->assertSame([], $this->bandeja($this->colaborador));
    }

    public function test_ya_no_aplica_solo_sobre_tareas_propias_y_pendientes(): void
    {
        $deOtro = $this->tarea([], $this->colaborador);
        $noVencida = $this->tarea(['fecha_pactada' => '2026-12-01']);

        // El líder resuelve las de su equipo desde el dashboard, no desde aquí.
        $this->como($this->lider)->postJson("/api/mis-decisiones/{$deOtro}/ya-no-aplica", ['motivo' => 'No es necesaria ya'])
            ->assertStatus(403);
        $this->como($this->colaborador)->postJson("/api/mis-decisiones/{$noVencida}/ya-no-aplica", ['motivo' => 'No es necesaria ya'])
            ->assertStatus(409);
        $this->como($this->colaborador)->postJson('/api/mis-decisiones/99999999/ya-no-aplica', ['motivo' => 'No es necesaria ya'])
            ->assertStatus(404);
    }

    public function test_no_se_reprograma_una_tarea_ya_aceptada(): void
    {
        $t = $this->tarea(['estado' => 'Completada', 'fecha_entregada' => '2026-11-02']);

        $this->como($this->colaborador)->postJson('/api/reprogramaciones/solicitar', [
            'tarea_id' => $t, 'fecha_nueva' => '2026-11-28', 'motivo' => 'Quiero más tiempo',
        ])->assertStatus(409);
    }

    public function test_quien_no_tiene_ficha_de_empleado_ve_la_bandeja_vacia(): void
    {
        $u = new \App\Models\User();
        $u->id = 999999;
        $u->email = 'sinficha@prueba.test';
        $this->db()->table('users')->insert(['name' => 'Sin ficha', 'email' => 'sinficha@prueba.test', 'password' => 'x',
            'tipo_usuario' => 'Administrador', 'estado' => 'Activo']);

        $this->actingAs($u, 'sanctum')->getJson('/api/mis-decisiones')->assertOk()->assertJsonPath('tareas', []);
    }
}
