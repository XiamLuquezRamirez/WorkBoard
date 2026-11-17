<?php

namespace Tests\Feature\Suite;

use App\Mail\NotificacionMailable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * Pausas, bloqueos y reprogramaciones: quién puede pausar, bloquear o mover la
 * fecha pactada de una tarea, el circuito de solicitud y resolución, y qué
 * queda en la base de datos.
 */
class PausasYReprogramacionesTest extends TestCase
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

    private function hoy(): Carbon
    {
        return Carbon::today('America/Bogota');
    }

    /** Tarea heredada con fecha pactada conocida. */
    private function tarea(string $estado = 'Pendiente', ?int $responsable = null, ?string $fecha = null): int
    {
        $id = $this->tareaSinCriterios($estado, $responsable);
        $this->db()->table('tareas_empleados')->where('id', $id)
            ->update(['fecha_pactada' => $fecha ?? $this->hoy()->addDays(5)->toDateString()]);
        return $id;
    }

    private function solicitarPausa(int $quien, int $tarea, array $extra = [])
    {
        return $this->como($quien)->postJson('/api/solicitarPausa', array_merge([
            'tarea_id'          => $tarea,
            'motivo'            => 'Espero insumos del proveedor',
            'fecha_reanudacion' => $this->hoy()->addDays(3)->toDateString(),
        ], $extra));
    }

    private function pausaPendiente(int $tarea): int
    {
        $this->solicitarPausa($this->colaborador, $tarea)->assertStatus(201);
        return (int) $this->db()->table('pausas_solicitadas')->where('tarea_id', $tarea)->value('id');
    }

    private function solicitarReprogramacion(int $quien, int $tarea, array $extra = [])
    {
        return $this->como($quien)->postJson('/api/reprogramaciones/solicitar', array_merge([
            'tarea_id'     => $tarea,
            'fecha_actual' => $this->campoTarea($tarea, 'fecha_pactada'),
            'fecha_nueva'  => $this->hoy()->addDays(10)->toDateString(),
            'motivo'       => 'El cliente cambió el alcance',
        ], $extra));
    }

    private function reprogramacionPendiente(int $tarea): int
    {
        return (int) $this->solicitarReprogramacion($this->colaborador, $tarea)->assertStatus(201)->json('id');
    }

    private function avisos(int $empleado, string $tipo)
    {
        return $this->db()->table('notif_generales')
            ->where('id_receptor', $this->usuarioId($empleado))->where('tipo', $tipo)->get();
    }

    private function filaTarea(int $id): array
    {
        return (array) $this->db()->table('tareas_empleados')->where('id', $id)->first();
    }

    // ─── Sin sesión ─────────────────────────────────────────────────────────

    public static function rutasProtegidas(): array
    {
        return [
            'pausar'                   => ['put',  '/api/pausarTarea/1'],
            'bloquear'                 => ['put',  '/api/bloquearTarea/1'],
            'solicitar pausa'          => ['post', '/api/solicitarPausa'],
            'resolver pausa'           => ['put',  '/api/pausas/1/resolver'],
            'historial de pausas'      => ['get',  '/api/pausas/tarea/1'],
            'reprogramar'              => ['put',  '/api/reprogramarTarea/1'],
            'solicitar reprogramación' => ['post', '/api/reprogramaciones/solicitar'],
            'resolver reprogramación'  => ['put',  '/api/reprogramaciones/1/resolver'],
            'historial reprogramación' => ['get',  '/api/reprogramaciones/tarea/1'],
            'pendientes'               => ['get',  '/api/reprogramaciones/pendientes'],
        ];
    }

    #[DataProvider('rutasProtegidas')]
    public function test_sin_sesion_responde_401(string $metodo, string $ruta): void
    {
        $this->{$metodo . 'Json'}($ruta, [])->assertStatus(401);
    }

    // ─── pausarTarea ────────────────────────────────────────────────────────

    public function test_el_lider_pausa_directamente_y_queda_en_el_historial(): void
    {
        $tarea = $this->tarea();

        $this->como($this->lider)->putJson("/api/pausarTarea/{$tarea}", ['pausada' => true, 'motivo' => 'Cambio de prioridades'])
            ->assertOk();

        $this->assertSame(1, (int) $this->campoTarea($tarea, 'pausada'));
        $this->assertTrue($this->db()->table('notif_generales')
            ->where('tarea_id', $tarea)->where('tipo', 'Pausada')
            ->where('mensaje', 'like', '%Cambio de prioridades%')->exists());
    }

    public function test_independiente_administrador_y_supervisor_pausan(): void
    {
        $propia = $this->tarea('Pendiente', $this->independiente);
        $this->como($this->independiente)->putJson("/api/pausarTarea/{$propia}", ['pausada' => true])->assertOk();
        $this->assertSame(1, (int) $this->campoTarea($propia, 'pausada'));

        foreach ([$this->admin, $this->supervisor] as $quien) {
            $tarea = $this->tarea();
            $this->como($quien)->putJson("/api/pausarTarea/{$tarea}", ['pausada' => true])->assertOk();
            $this->assertSame(1, (int) $this->campoTarea($tarea, 'pausada'));
        }
    }

    public function test_reanudar_limpia_la_fecha_de_reanudacion_y_conserva_el_motivo_de_una_reprogramada(): void
    {
        $tarea = $this->tarea();
        $this->db()->table('tareas_empleados')->where('id', $tarea)->update([
            'pausada' => 1, 'fecha_reprogramacion' => $this->hoy()->addDay()->toDateString(),
            'motivo_reprogramacion' => 'Motivo de una reprogramación anterior', 'reprogramada' => 1,
        ]);

        // El propio responsable reanuda: es el botón «Reanudar» de su detalle.
        $this->como($this->colaborador)->putJson("/api/pausarTarea/{$tarea}", ['pausada' => 'false'])->assertOk();

        $this->assertSame(0, (int) $this->campoTarea($tarea, 'pausada'));
        $this->assertNull($this->campoTarea($tarea, 'fecha_reprogramacion'));
        $this->assertSame('Motivo de una reprogramación anterior', $this->campoTarea($tarea, 'motivo_reprogramacion'));
    }

    public function test_un_ajeno_no_pausa_una_tarea_ajena(): void
    {
        $tarea = $this->tarea();

        $this->como($this->ajeno)->putJson("/api/pausarTarea/{$tarea}", ['pausada' => true])->assertStatus(403);
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'pausada'));
    }

    public function test_el_colaborador_sin_independencia_no_se_salta_la_solicitud_de_pausa(): void
    {
        // En su detalle sólo ve «Solicitar pausa»: pausar debe pasar por su líder.
        $tarea = $this->tarea();

        $this->como($this->colaborador)->putJson("/api/pausarTarea/{$tarea}", ['pausada' => true])->assertStatus(403);
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'pausada'));
    }

    public function test_pausar_sin_el_campo_pausada_responde_422_y_no_500(): void
    {
        $tarea = $this->tarea();

        $this->como($this->lider)->putJson("/api/pausarTarea/{$tarea}", ['motivo' => 'Sin campo'])->assertStatus(422);
    }

    public function test_pausar_una_tarea_inexistente_responde_404_y_no_deja_rastro(): void
    {
        $this->como($this->lider)->putJson('/api/pausarTarea/999999', ['pausada' => true])->assertStatus(404);
        $this->assertFalse($this->db()->table('notif_generales')->where('tarea_id', 999999)->exists());
    }

    public function test_el_lider_no_pausa_una_tarea_ya_aceptada(): void
    {
        $tarea = $this->tarea('Completada');

        $respuesta = $this->como($this->lider)->putJson("/api/pausarTarea/{$tarea}", ['pausada' => true]);

        $this->assertContains($respuesta->status(), [409, 422]);
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'pausada'));
    }

    // ─── bloquearTarea ──────────────────────────────────────────────────────

    public function test_el_responsable_declara_y_levanta_un_impedimento(): void
    {
        $tarea = $this->tarea('En Proceso');

        $this->como($this->colaborador)->putJson("/api/bloquearTarea/{$tarea}", [
            'bloqueada' => true, 'motivo' => 'Falta el acceso al servidor de pruebas',
        ])->assertOk();
        $this->assertSame(1, (int) $this->campoTarea($tarea, 'bloqueada'));
        $this->assertSame('Falta el acceso al servidor de pruebas', $this->campoTarea($tarea, 'motivo_bloqueo'));

        $this->como($this->lider)->putJson("/api/bloquearTarea/{$tarea}", ['bloqueada' => false])->assertOk();
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'bloqueada'));
        $this->assertNull($this->campoTarea($tarea, 'motivo_bloqueo'));

        $this->assertSame(['Bloqueada', 'Desbloqueada'], $this->db()->table('notif_generales')
            ->where('tarea_id', $tarea)->whereIn('tipo', ['Bloqueada', 'Desbloqueada'])
            ->orderBy('id')->pluck('tipo')->all());
    }

    public static function bloqueosInvalidos(): array
    {
        return [
            'sin el campo bloqueada' => [['motivo' => 'Falta el acceso al servidor']],
            'bloqueada no booleano'  => [['bloqueada' => 'quizás', 'motivo' => 'Falta el acceso al servidor']],
            'sin motivo'             => [['bloqueada' => true]],
            'motivo muy corto'       => [['bloqueada' => true, 'motivo' => 'corto']],
            'motivo de espacios'     => [['bloqueada' => true, 'motivo' => '                ']],
            'motivo demasiado largo' => [['bloqueada' => true, 'motivo' => str_repeat('a', 1001)]],
        ];
    }

    #[DataProvider('bloqueosInvalidos')]
    public function test_bloquear_con_datos_invalidos_responde_422_y_no_cambia_nada(array $datos): void
    {
        $tarea = $this->tarea('En Proceso');

        $this->como($this->colaborador)->putJson("/api/bloquearTarea/{$tarea}", $datos)->assertStatus(422);
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'bloqueada'));
    }

    public function test_bloquear_una_tarea_inexistente_responde_404(): void
    {
        $this->como($this->lider)->putJson('/api/bloquearTarea/999999', [
            'bloqueada' => true, 'motivo' => 'Falta el acceso al servidor',
        ])->assertStatus(404);
    }

    public function test_un_ajeno_no_bloquea_una_tarea_ajena(): void
    {
        $tarea = $this->tarea('En Proceso');

        $this->como($this->ajeno)->putJson("/api/bloquearTarea/{$tarea}", [
            'bloqueada' => true, 'motivo' => 'Bloqueo puesto por alguien ajeno',
        ])->assertStatus(403);
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'bloqueada'));
    }

    // ─── solicitarPausa ─────────────────────────────────────────────────────

    public function test_el_colaborador_solicita_pausa_y_se_avisa_a_su_lider(): void
    {
        $tarea = $this->tarea();

        $this->solicitarPausa($this->colaborador, $tarea)->assertStatus(201);

        $fila = $this->db()->table('pausas_solicitadas')->where('tarea_id', $tarea)->first();
        $this->assertSame('Pendiente', $fila->estado);
        $this->assertSame('lider', $fila->tipo_aprobador);
        $this->assertSame($this->colaborador, (int) $fila->solicitado_por);
        $this->assertSame($this->usuarioId($this->colaborador), (int) $fila->solicitado_por_user);
        $this->assertSame($this->hoy()->addDays(3)->toDateString(), $fila->fecha_reanudacion);

        // Solicitar no pausa: eso lo decide el líder.
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'pausada'));

        $this->assertCount(1, $this->avisos($this->lider, 'PausaSolicitada'));
        $this->assertCount(0, $this->avisos($this->colaborador, 'PausaSolicitada'));
        Mail::assertSent(NotificacionMailable::class, fn ($m) => $m->hasTo('lider@prueba.test'));
    }

    public function test_el_lider_que_solicita_pausa_la_eleva_a_administracion(): void
    {
        $this->db()->table('users')->where('empleado', $this->admin)->update(['lider_seguimiento' => 'Si']);
        $tarea = $this->tarea();

        $this->solicitarPausa($this->lider, $tarea)->assertStatus(201);

        $this->assertSame('admin', $this->db()->table('pausas_solicitadas')->where('tarea_id', $tarea)->value('tipo_aprobador'));
        $this->assertCount(1, $this->avisos($this->admin, 'PausaSolicitada'));
        $this->assertCount(0, $this->avisos($this->lider, 'PausaSolicitada'));
        Mail::assertSent(NotificacionMailable::class, fn ($m) => $m->hasTo('admin@prueba.test'));
    }

    public function test_un_ajeno_no_solicita_pausa_en_una_tarea_ajena(): void
    {
        $tarea = $this->tarea();

        $this->solicitarPausa($this->ajeno, $tarea)->assertStatus(403);
        $this->assertFalse($this->db()->table('pausas_solicitadas')->where('tarea_id', $tarea)->exists());
        Mail::assertNothingSent();
    }

    public function test_solicitar_pausa_de_una_tarea_inexistente_responde_404(): void
    {
        $this->solicitarPausa($this->colaborador, 999999)->assertStatus(404);
    }

    public static function pausasInvalidas(): array
    {
        return [
            'sin tarea'        => [['tarea_id' => null]],
            'tarea no numérica'=> [['tarea_id' => 'abc']],
            'sin motivo'       => [['motivo' => null]],
            'motivo corto'     => [['motivo' => 'ya']],
            'sin fecha'        => [['fecha_reanudacion' => null]],
            'fecha inválida'   => [['fecha_reanudacion' => 'pasado mañana']],
        ];
    }

    #[DataProvider('pausasInvalidas')]
    public function test_solicitar_pausa_con_datos_invalidos_responde_422(array $extra): void
    {
        $tarea = $this->tarea();

        $this->solicitarPausa($this->colaborador, $tarea, $extra)->assertStatus(422);
        $this->assertSame(0, $this->db()->table('pausas_solicitadas')->count());
    }

    public function test_no_se_duplica_una_solicitud_de_pausa_pendiente(): void
    {
        $tarea = $this->tarea();
        $this->pausaPendiente($tarea);

        $this->solicitarPausa($this->colaborador, $tarea)->assertStatus(422);
        $this->assertSame(1, $this->db()->table('pausas_solicitadas')->where('tarea_id', $tarea)->count());
    }

    public function test_la_fecha_de_reanudacion_no_puede_estar_en_el_pasado(): void
    {
        $tarea = $this->tarea();

        $this->solicitarPausa($this->colaborador, $tarea, [
            'fecha_reanudacion' => $this->hoy()->subDays(3)->toDateString(),
        ])->assertStatus(422);
        $this->assertFalse($this->db()->table('pausas_solicitadas')->where('tarea_id', $tarea)->exists());
    }

    public static function estadosEntregados(): array
    {
        return [
            'completada'  => ['Completada'],
            'en revisión' => ['En Revisión'],
        ];
    }

    #[DataProvider('estadosEntregados')]
    public function test_no_se_solicita_pausa_de_una_tarea_entregada_o_cerrada(string $estado): void
    {
        $tarea = $this->tarea($estado);

        $respuesta = $this->solicitarPausa($this->colaborador, $tarea);

        $this->assertContains($respuesta->status(), [409, 422]);
        $this->assertFalse($this->db()->table('pausas_solicitadas')->where('tarea_id', $tarea)->exists());
        Mail::assertNothingSent();
    }

    public function test_la_solicitud_de_pausa_avisa_a_todos_los_lideres_activos(): void
    {
        // Carlos tiene dos líderes; el envío a revisión ya avisa a los dos.
        $this->db()->table('lideres_empleados')->insert(['lider' => $this->verificador, 'empleado' => $this->colaborador]);
        $tarea = $this->tarea();

        $this->solicitarPausa($this->colaborador, $tarea)->assertStatus(201);

        $this->assertCount(1, $this->avisos($this->lider, 'PausaSolicitada'));
        $this->assertCount(1, $this->avisos($this->verificador, 'PausaSolicitada'));
    }

    public function test_la_solicitud_de_pausa_no_avisa_a_un_lider_inactivo(): void
    {
        $this->db()->table('lideres_empleados')->insert(['lider' => $this->verificador, 'empleado' => $this->colaborador]);
        $this->db()->table('empleados')->where('id', $this->lider)->update(['estado' => 'Inactivo', 'estado_registro' => 'Inactivo']);
        $this->db()->table('users')->where('empleado', $this->lider)->update(['estado' => 'Inactivo']);
        $tarea = $this->tarea();

        $this->solicitarPausa($this->colaborador, $tarea)->assertStatus(201);

        $this->assertCount(0, $this->avisos($this->lider, 'PausaSolicitada'), 'Laura está inactiva: no debe recibir el aviso.');
        $this->assertCount(1, $this->avisos($this->verificador, 'PausaSolicitada'), 'El líder activo debe enterarse.');
        Mail::assertNotSent(NotificacionMailable::class, fn ($m) => $m->hasTo('lider@prueba.test'));
    }

    // ─── Resolver pausa ─────────────────────────────────────────────────────

    public function test_el_lider_aprueba_la_pausa_y_la_aprobacion_queda_a_su_nombre(): void
    {
        $tarea = $this->tarea();
        $id = $this->pausaPendiente($tarea);

        // aprobado_por del cliente se ignora: queda quien resolvió.
        $this->como($this->lider)->putJson("/api/pausas/{$id}/resolver", [
            'accion' => 'aprobar', 'aprobado_por' => $this->usuarioId($this->ajeno),
        ])->assertOk();

        $fila = $this->db()->table('pausas_solicitadas')->where('id', $id)->first();
        $this->assertSame('Aprobada', $fila->estado);
        $this->assertSame($this->usuarioId($this->lider), (int) $fila->aprobado_por);
        $this->assertNotNull($fila->fecha_resolucion);

        $this->assertSame(1, (int) $this->campoTarea($tarea, 'pausada'));
        $this->assertSame($this->hoy()->addDays(3)->toDateString(), $this->campoTarea($tarea, 'fecha_reprogramacion'));
        $this->assertSame('Espero insumos del proveedor', $this->campoTarea($tarea, 'motivo_reprogramacion'));
    }

    public function test_rechazar_la_pausa_no_pausa_la_tarea(): void
    {
        $tarea = $this->tarea();
        $id = $this->pausaPendiente($tarea);

        $this->como($this->lider)->putJson("/api/pausas/{$id}/resolver", [
            'accion' => 'rechazar', 'observacion_rechazo' => 'La entrega es prioritaria',
        ])->assertOk();

        $fila = $this->db()->table('pausas_solicitadas')->where('id', $id)->first();
        $this->assertSame('Rechazada', $fila->estado);
        $this->assertSame('La entrega es prioritaria', $fila->observacion_rechazo);
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'pausada'));
    }

    public static function rutasDeResolucion(): array
    {
        return [
            'pausa'          => ['pausa'],
            'reprogramación' => ['reprogramacion'],
        ];
    }

    #[DataProvider('rutasDeResolucion')]
    public function test_rechazar_sin_observacion_no_responde_500_tras_guardar_el_rechazo(string $tipo): void
    {
        // observacion_rechazo es opcional en la validación; omitirla rompía
        // después de haber marcado ya la solicitud como Rechazada.
        $tarea = $this->tarea();
        [$ruta, $tabla, $id] = $tipo === 'pausa'
            ? ['pausas', 'pausas_solicitadas', $this->pausaPendiente($tarea)]
            : ['reprogramaciones', 'reprogramaciones_tareas', $this->reprogramacionPendiente($tarea)];

        $this->como($this->lider)->putJson("/api/{$ruta}/{$id}/resolver", ['accion' => 'rechazar'])->assertOk();

        $this->assertSame('Rechazada', $this->db()->table($tabla)->where('id', $id)->value('estado'));
        $this->assertTrue($this->db()->table('notif_generales')->where('tarea_id', $tarea)
            ->where('tipo', $tipo === 'pausa' ? 'Pausa rechazada' : 'Reprogramación rechazada')->exists(),
            'El rechazo debe quedar en el historial de la tarea.');
    }

    public function test_el_administrador_resuelve_cualquier_pausa(): void
    {
        $tarea = $this->tarea();
        $id = $this->pausaPendiente($tarea);

        $this->como($this->admin)->putJson("/api/pausas/{$id}/resolver", ['accion' => 'aprobar'])->assertOk();
        $this->assertSame(1, (int) $this->campoTarea($tarea, 'pausada'));
    }

    public static function quienesNoResuelven(): array
    {
        return [
            'el propio solicitante' => ['colaborador'],
            'un ajeno'              => ['ajeno'],
            'un compañero de equipo'=> ['independiente'],
        ];
    }

    #[DataProvider('quienesNoResuelven')]
    public function test_quien_no_es_lider_ni_admin_no_resuelve_la_pausa(string $quien): void
    {
        $tarea = $this->tarea();
        $id = $this->pausaPendiente($tarea);

        $this->como($this->{$quien})->putJson("/api/pausas/{$id}/resolver", ['accion' => 'aprobar'])->assertStatus(403);

        $this->assertSame('Pendiente', $this->db()->table('pausas_solicitadas')->where('id', $id)->value('estado'));
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'pausada'));
    }

    public function test_el_independiente_no_aprueba_su_propia_pausa(): void
    {
        $tarea = $this->tarea('Pendiente', $this->independiente);
        $this->solicitarPausa($this->independiente, $tarea)->assertStatus(201);
        $id = (int) $this->db()->table('pausas_solicitadas')->where('tarea_id', $tarea)->value('id');

        $this->como($this->independiente)->putJson("/api/pausas/{$id}/resolver", ['accion' => 'aprobar'])->assertStatus(403);
        $this->assertSame('Pendiente', $this->db()->table('pausas_solicitadas')->where('id', $id)->value('estado'));
    }

    public function test_una_pausa_no_se_resuelve_dos_veces(): void
    {
        $tarea = $this->tarea();
        $id = $this->pausaPendiente($tarea);

        $this->como($this->lider)->putJson("/api/pausas/{$id}/resolver", ['accion' => 'rechazar', 'observacion_rechazo' => 'No procede'])->assertOk();
        $this->como($this->lider)->putJson("/api/pausas/{$id}/resolver", ['accion' => 'aprobar'])->assertStatus(422);

        $this->assertSame('Rechazada', $this->db()->table('pausas_solicitadas')->where('id', $id)->value('estado'));
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'pausada'));
    }

    public function test_resolver_pausa_con_accion_invalida_o_inexistente(): void
    {
        $tarea = $this->tarea();
        $id = $this->pausaPendiente($tarea);

        $this->como($this->lider)->putJson("/api/pausas/{$id}/resolver", ['accion' => 'posponer'])->assertStatus(422);
        $this->como($this->lider)->putJson("/api/pausas/{$id}/resolver", [])->assertStatus(422);
        $this->como($this->lider)->putJson('/api/pausas/999999/resolver', ['accion' => 'aprobar'])->assertStatus(404);
        $this->assertSame('Pendiente', $this->db()->table('pausas_solicitadas')->where('id', $id)->value('estado'));
    }

    public function test_el_historial_de_pausas_muestra_solicitante_y_aprobador(): void
    {
        $tarea = $this->tarea();
        $id = $this->pausaPendiente($tarea);
        $this->como($this->lider)->putJson("/api/pausas/{$id}/resolver", ['accion' => 'aprobar'])->assertOk();

        $this->como($this->colaborador)->getJson("/api/pausas/tarea/{$tarea}")
            ->assertOk()->assertJsonCount(1)
            ->assertJsonPath('0.nombre_solicitante', 'Carlos Colaborador')
            ->assertJsonPath('0.nombre_aprobador', 'Laura Líder');
    }

    public function test_un_ajeno_no_lee_el_historial_de_pausas_de_otra_tarea(): void
    {
        $tarea = $this->tarea();
        $this->pausaPendiente($tarea);

        $respuesta = $this->como($this->ajeno)->getJson("/api/pausas/tarea/{$tarea}");

        $this->assertTrue(
            $respuesta->status() === 403 || $respuesta->json() === [],
            'Un ajeno no debe leer los motivos de pausa de una tarea que no le corresponde.'
        );
    }

    // ─── reprogramarTarea (directo) ─────────────────────────────────────────

    public function test_el_lider_reprograma_directamente(): void
    {
        $tarea = $this->tarea();
        $nueva = $this->hoy()->addDays(20)->toDateString();

        $this->como($this->lider)->putJson("/api/reprogramarTarea/{$tarea}", [
            'fecha_pactada' => $nueva, 'motivo_reprogramacion' => 'Dependencia externa',
        ])->assertOk();

        $this->assertSame($nueva, $this->campoTarea($tarea, 'fecha_pactada'));
        $this->assertSame(1, (int) $this->campoTarea($tarea, 'reprogramada'));
        $this->assertSame('Dependencia externa', $this->campoTarea($tarea, 'motivo_reprogramacion'));
        $this->assertTrue($this->db()->table('notif_generales')->where('tarea_id', $tarea)->where('tipo', 'Reprogramada')->exists());
    }

    public function test_un_ajeno_no_reprograma_una_tarea_ajena(): void
    {
        $tarea = $this->tarea();
        $antes = $this->filaTarea($tarea);

        $this->como($this->ajeno)->putJson("/api/reprogramarTarea/{$tarea}", [
            'fecha_pactada' => $this->hoy()->addDays(60)->toDateString(), 'motivo_reprogramacion' => 'Porque sí',
        ])->assertStatus(403);

        $this->assertSame($antes, $this->filaTarea($tarea));
    }

    public static function reprogramacionesDirectasInvalidas(): array
    {
        return [
            'sin fecha'      => [['motivo_reprogramacion' => 'Motivo válido']],
            'fecha inválida' => [['fecha_pactada' => 'la semana que viene', 'motivo_reprogramacion' => 'Motivo válido']],
            'sin motivo'     => [['fecha_pactada' => '2030-01-15']],
        ];
    }

    #[DataProvider('reprogramacionesDirectasInvalidas')]
    public function test_reprogramar_con_datos_invalidos_responde_422_y_no_500(array $datos): void
    {
        $tarea = $this->tarea();
        $antes = $this->campoTarea($tarea, 'fecha_pactada');

        $this->como($this->lider)->putJson("/api/reprogramarTarea/{$tarea}", $datos)->assertStatus(422);
        $this->assertSame($antes, $this->campoTarea($tarea, 'fecha_pactada'));
    }

    public function test_reprogramar_una_tarea_inexistente_responde_404(): void
    {
        $this->como($this->lider)->putJson('/api/reprogramarTarea/999999', [
            'fecha_pactada' => $this->hoy()->addDays(5)->toDateString(), 'motivo_reprogramacion' => 'Motivo válido',
        ])->assertStatus(404);
        $this->assertFalse($this->db()->table('notif_generales')->where('tarea_id', 999999)->exists());
    }

    public function test_no_se_reprograma_directamente_a_una_fecha_pasada(): void
    {
        $tarea = $this->tarea();
        $antes = $this->campoTarea($tarea, 'fecha_pactada');

        $this->como($this->lider)->putJson("/api/reprogramarTarea/{$tarea}", [
            'fecha_pactada' => $this->hoy()->subDays(10)->toDateString(), 'motivo_reprogramacion' => 'Al pasado',
        ])->assertStatus(422);

        $this->assertSame($antes, $this->campoTarea($tarea, 'fecha_pactada'));
    }

    // ─── Solicitud de reprogramación ────────────────────────────────────────

    public function test_el_colaborador_solicita_reprogramacion_y_no_elige_su_aprobador(): void
    {
        $tarea = $this->tarea();

        // Los campos del cliente que intentan suplantar o elegir aprobador se ignoran.
        $id = $this->solicitarReprogramacion($this->colaborador, $tarea, [
            'solicitado_por' => $this->ajeno, 'solicitado_por_user' => $this->usuarioId($this->ajeno), 'tipo_aprobador' => 'admin',
        ])->assertStatus(201)->json('id');

        $fila = $this->db()->table('reprogramaciones_tareas')->where('id', $id)->first();
        $this->assertSame('Pendiente', $fila->estado);
        $this->assertSame('lider', $fila->tipo_aprobador);
        $this->assertSame($this->colaborador, (int) $fila->solicitado_por);
        $this->assertSame($this->usuarioId($this->colaborador), (int) $fila->solicitado_por_user);
        $this->assertSame($this->campoTarea($tarea, 'fecha_pactada'), $fila->fecha_actual);

        // Solicitar no cambia la fecha pactada.
        $this->assertSame($this->hoy()->addDays(5)->toDateString(), $this->campoTarea($tarea, 'fecha_pactada'));
    }

    public function test_sin_fecha_actual_la_solicitud_de_reprogramacion_no_rompe_ni_queda_a_medias(): void
    {
        // fecha_actual es opcional (nullable) y tiene valor por defecto: omitirla
        // no debe dar 500 después de haber insertado ya la solicitud.
        $tarea = $this->tarea();

        $respuesta = $this->como($this->colaborador)->postJson('/api/reprogramaciones/solicitar', [
            'tarea_id' => $tarea, 'fecha_nueva' => $this->hoy()->addDays(10)->toDateString(), 'motivo' => 'El cliente cambió el alcance',
        ]);

        $respuesta->assertStatus(201);
        $this->assertSame($this->campoTarea($tarea, 'fecha_pactada'),
            $this->db()->table('reprogramaciones_tareas')->where('tarea_id', $tarea)->value('fecha_actual'));
    }

    public function test_el_lider_que_solicita_reprogramacion_la_eleva_a_administracion(): void
    {
        $tarea = $this->tarea();

        $id = $this->solicitarReprogramacion($this->lider, $tarea)->assertStatus(201)->json('id');
        $this->assertSame('admin', $this->db()->table('reprogramaciones_tareas')->where('id', $id)->value('tipo_aprobador'));
    }

    public function test_un_ajeno_no_solicita_reprogramacion(): void
    {
        $tarea = $this->tarea();

        $this->solicitarReprogramacion($this->ajeno, $tarea)->assertStatus(403);
        $this->assertFalse($this->db()->table('reprogramaciones_tareas')->where('tarea_id', $tarea)->exists());
    }

    public function test_solicitar_reprogramacion_de_tarea_inexistente_responde_404(): void
    {
        $this->solicitarReprogramacion($this->colaborador, 999999)->assertStatus(404);
    }

    public static function reprogramacionesInvalidas(): array
    {
        return [
            'sin fecha nueva'     => [['fecha_nueva' => null]],
            'fecha nueva inválida'=> [['fecha_nueva' => '31/02/2030']],
            'sin motivo'          => [['motivo' => null]],
            'motivo corto'        => [['motivo' => 'ya']],
            'aprobador inventado' => [['tipo_aprobador' => 'gerente']],
            'sin tarea'           => [['tarea_id' => null]],
        ];
    }

    #[DataProvider('reprogramacionesInvalidas')]
    public function test_solicitar_reprogramacion_con_datos_invalidos_responde_422(array $extra): void
    {
        $tarea = $this->tarea();

        $this->solicitarReprogramacion($this->colaborador, $tarea, $extra)->assertStatus(422);
        $this->assertSame(0, $this->db()->table('reprogramaciones_tareas')->count());
    }

    public function test_no_se_duplica_una_reprogramacion_pendiente(): void
    {
        $tarea = $this->tarea();
        $this->reprogramacionPendiente($tarea);

        $this->solicitarReprogramacion($this->colaborador, $tarea)->assertStatus(422);
        $this->assertSame(1, $this->db()->table('reprogramaciones_tareas')->where('tarea_id', $tarea)->count());
    }

    public function test_no_se_solicita_reprogramar_a_una_fecha_pasada(): void
    {
        $tarea = $this->tarea();

        $this->solicitarReprogramacion($this->colaborador, $tarea, [
            'fecha_nueva' => $this->hoy()->subDays(7)->toDateString(),
        ])->assertStatus(422);
        $this->assertFalse($this->db()->table('reprogramaciones_tareas')->where('tarea_id', $tarea)->exists());
    }

    public function test_no_se_solicita_reprogramar_una_tarea_ya_aceptada(): void
    {
        $tarea = $this->tarea('Completada');

        $respuesta = $this->solicitarReprogramacion($this->colaborador, $tarea);

        $this->assertContains($respuesta->status(), [409, 422]);
        $this->assertFalse($this->db()->table('reprogramaciones_tareas')->where('tarea_id', $tarea)->exists());
    }

    public function test_un_administrador_sin_empleado_solicita_reprogramacion_sin_error_500(): void
    {
        // En producción un administrador puede no tener ficha de empleado.
        $this->db()->table('users')->insert([
            'name' => 'Admin sin ficha', 'email' => 'admin-sin-ficha@prueba.test', 'password' => 'x',
            'tipo_usuario' => 'Administrador', 'empleado' => null, 'lider' => 'No', 'independencia' => 'No', 'estado' => 'Activo',
        ]);
        $u = new \App\Models\User();
        $u->id = 1;
        $u->email = 'admin-sin-ficha@prueba.test';
        $tarea = $this->tarea();

        $respuesta = $this->actingAs($u, 'sanctum')->postJson('/api/reprogramaciones/solicitar', [
            'tarea_id' => $tarea, 'fecha_nueva' => $this->hoy()->addDays(9)->toDateString(), 'motivo' => 'Ajuste de calendario',
        ]);

        $this->assertLessThan(500, $respuesta->status(), 'Debe crear la solicitud o rechazarla con un error claro, no romper con 500.');
    }

    // ─── Resolver reprogramación ────────────────────────────────────────────

    public function test_aprobar_la_reprogramacion_mueve_la_fecha_pactada(): void
    {
        $tarea = $this->tarea();
        $id = $this->reprogramacionPendiente($tarea);

        $this->como($this->lider)->putJson("/api/reprogramaciones/{$id}/resolver", [
            'accion' => 'aprobar', 'aprobado_por' => $this->usuarioId($this->ajeno),
        ])->assertOk();

        $fila = $this->db()->table('reprogramaciones_tareas')->where('id', $id)->first();
        $this->assertSame('Aprobada', $fila->estado);
        $this->assertSame($this->usuarioId($this->lider), (int) $fila->aprobado_por);
        $this->assertSame($this->hoy()->addDays(10)->toDateString(), $this->campoTarea($tarea, 'fecha_pactada'));
        $this->assertSame(1, (int) $this->campoTarea($tarea, 'reprogramada'));
        $this->assertSame('El cliente cambió el alcance', $this->campoTarea($tarea, 'motivo_reprogramacion'));
    }

    public function test_rechazar_la_reprogramacion_deja_la_fecha_como_estaba(): void
    {
        $tarea = $this->tarea();
        $antes = $this->campoTarea($tarea, 'fecha_pactada');
        $id = $this->reprogramacionPendiente($tarea);

        $this->como($this->admin)->putJson("/api/reprogramaciones/{$id}/resolver", [
            'accion' => 'rechazar', 'observacion_rechazo' => 'La fecha se mantiene',
        ])->assertOk();

        $this->assertSame('Rechazada', $this->db()->table('reprogramaciones_tareas')->where('id', $id)->value('estado'));
        $this->assertSame($antes, $this->campoTarea($tarea, 'fecha_pactada'));
        $this->assertNull($this->campoTarea($tarea, 'reprogramada'));
    }

    #[DataProvider('quienesNoResuelven')]
    public function test_quien_no_es_lider_ni_admin_no_resuelve_la_reprogramacion(string $quien): void
    {
        $tarea = $this->tarea();
        $antes = $this->campoTarea($tarea, 'fecha_pactada');
        $id = $this->reprogramacionPendiente($tarea);

        $this->como($this->{$quien})->putJson("/api/reprogramaciones/{$id}/resolver", ['accion' => 'aprobar'])->assertStatus(403);

        $this->assertSame('Pendiente', $this->db()->table('reprogramaciones_tareas')->where('id', $id)->value('estado'));
        $this->assertSame($antes, $this->campoTarea($tarea, 'fecha_pactada'));
    }

    public function test_una_reprogramacion_no_se_resuelve_dos_veces(): void
    {
        $tarea = $this->tarea();
        $antes = $this->campoTarea($tarea, 'fecha_pactada');
        $id = $this->reprogramacionPendiente($tarea);

        $this->como($this->lider)->putJson("/api/reprogramaciones/{$id}/resolver", ['accion' => 'rechazar', 'observacion_rechazo' => 'No procede'])->assertOk();
        $this->como($this->admin)->putJson("/api/reprogramaciones/{$id}/resolver", ['accion' => 'aprobar'])->assertStatus(422);

        $this->assertSame('Rechazada', $this->db()->table('reprogramaciones_tareas')->where('id', $id)->value('estado'));
        $this->assertSame($antes, $this->campoTarea($tarea, 'fecha_pactada'));
    }

    public function test_resolver_reprogramacion_con_accion_invalida_o_inexistente(): void
    {
        $tarea = $this->tarea();
        $id = $this->reprogramacionPendiente($tarea);

        $this->como($this->lider)->putJson("/api/reprogramaciones/{$id}/resolver", ['accion' => 'quizás'])->assertStatus(422);
        $this->como($this->lider)->putJson('/api/reprogramaciones/999999/resolver', ['accion' => 'aprobar'])->assertStatus(404);
        $this->assertSame('Pendiente', $this->db()->table('reprogramaciones_tareas')->where('id', $id)->value('estado'));
    }

    public function test_el_historial_de_reprogramaciones_muestra_los_nombres(): void
    {
        $tarea = $this->tarea();
        $id = $this->reprogramacionPendiente($tarea);
        $this->como($this->lider)->putJson("/api/reprogramaciones/{$id}/resolver", ['accion' => 'aprobar'])->assertOk();

        $this->como($this->lider)->getJson("/api/reprogramaciones/tarea/{$tarea}")
            ->assertOk()->assertJsonCount(1)
            ->assertJsonPath('0.estado', 'Aprobada')
            ->assertJsonPath('0.nombre_solicitante', 'Carlos Colaborador')
            ->assertJsonPath('0.nombre_aprobador', 'Laura Líder');
    }

    public function test_el_historial_de_una_tarea_inexistente_no_rompe(): void
    {
        $this->assertLessThan(500, $this->como($this->lider)->getJson('/api/reprogramaciones/tarea/999999')->status());
        $this->assertLessThan(500, $this->como($this->lider)->getJson('/api/pausas/tarea/999999')->status());
    }

    public function test_un_ajeno_no_lee_el_historial_de_reprogramaciones_de_otra_tarea(): void
    {
        $tarea = $this->tarea();
        $this->reprogramacionPendiente($tarea);

        $respuesta = $this->como($this->ajeno)->getJson("/api/reprogramaciones/tarea/{$tarea}");

        $this->assertTrue(
            $respuesta->status() === 403 || $respuesta->json() === [],
            'Un ajeno no debe leer los motivos de reprogramación de una tarea que no le corresponde.'
        );
    }

    // ─── Pendientes ─────────────────────────────────────────────────────────

    public function test_el_lider_ve_las_reprogramaciones_pendientes_de_su_equipo(): void
    {
        $tarea = $this->tarea();
        $id = $this->reprogramacionPendiente($tarea);

        $ids = collect($this->como($this->lider)
            ->getJson('/api/reprogramaciones/pendientes?user_id=' . $this->usuarioId($this->lider))
            ->assertOk()->json())->pluck('id')->all();

        $this->assertContains($id, $ids);
    }

    public function test_una_reprogramacion_resuelta_ya_no_aparece_como_pendiente(): void
    {
        $tarea = $this->tarea();
        $id = $this->reprogramacionPendiente($tarea);
        $this->como($this->lider)->putJson("/api/reprogramaciones/{$id}/resolver", ['accion' => 'rechazar', 'observacion_rechazo' => 'No procede'])->assertOk();

        $ids = collect($this->como($this->admin)
            ->getJson('/api/reprogramaciones/pendientes?user_id=' . $this->usuarioId($this->admin))
            ->assertOk()->json())->pluck('id')->all();

        $this->assertNotContains($id, $ids);
    }

    public function test_un_ajeno_no_ve_las_reprogramaciones_pendientes_de_otro_equipo(): void
    {
        $tarea = $this->tarea();
        $id = $this->reprogramacionPendiente($tarea);

        $ids = collect($this->como($this->ajeno)
            ->getJson('/api/reprogramaciones/pendientes?user_id=' . $this->usuarioId($this->ajeno))
            ->json())->pluck('id')->all();

        $this->assertNotContains($id, $ids, 'Ana no lidera a Carlos: no debe ver su solicitud ni su motivo.');
    }

    public function test_el_user_id_de_la_consulta_no_da_vista_de_administrador(): void
    {
        // Laura pide reprogramar: la aprueba administración (tipo_aprobador admin).
        $tarea = $this->tarea();
        $id = (int) $this->solicitarReprogramacion($this->lider, $tarea)->assertStatus(201)->json('id');

        // Carlos se hace pasar por el administrador cambiando el parámetro.
        $ids = collect($this->como($this->colaborador)
            ->getJson('/api/reprogramaciones/pendientes?user_id=' . $this->usuarioId($this->admin))
            ->json())->pluck('id')->all();

        $this->assertNotContains($id, $ids, 'El rol debe salir de la sesión, no de ?user_id.');
    }
}
