<?php

namespace Tests\Feature\Suite;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;

/**
 * Lectura de tareas: cargarTareas, buscarTareas, cargarTareaSeleccionada,
 * checklists-empleado, tarea/{id}/actividades-comentarios y
 * obtenerObservacion. Qué devuelven, a quién, y el aviso de tareas atrasadas
 * que cargarTareas genera de paso.
 */
class CicloTareasConsultaTest extends CicloTareasCaso
{
    private function ids($respuesta, string $ruta = 'tareas'): array
    {
        return collect($respuesta->json($ruta))->pluck('id')->map(fn ($i) => (int) $i)->sort()->values()->all();
    }

    private function observacion(int $tarea, int $autorEmpleado, string $texto): int
    {
        return $this->db()->table('observaciones_tareas')->insertGetId([
            'id_tarea' => $tarea, 'observaciones' => $texto,
            'creador' => $this->idUsuario($autorEmpleado), 'fecha' => now()->toDateString(),
        ]);
    }

    /** Tarea aprobada y vencida: la que debe avisarse como atrasada. */
    private function tareaVencida(array $extra = []): int
    {
        return $this->tarea($extra + [
            'aprobada' => 1, 'fecha_pactada' => now()->subDays(4)->toDateString(),
        ]);
    }

    // ─── Sin sesión ─────────────────────────────────────────────────────────

    public static function endpointsDelArea(): array
    {
        return [
            'cargarTareas'            => ['GET', '/api/cargarTareas/1'],
            'buscarTareas'            => ['GET', '/api/buscarTareas/1'],
            'cargarTareaSeleccionada' => ['GET', '/api/cargarTareaSeleccionada/1'],
            'guardarTarea'            => ['POST', '/api/guardarTarea'],
            'actualizarTarea'         => ['PUT', '/api/actualizarTarea/1'],
            'eliminarTarea'           => ['DELETE', '/api/eliminarTarea/1'],
            'archivarTarea'           => ['PUT', '/api/archivarTarea/1'],
            'desarchivarTarea'        => ['PUT', '/api/desarchivarTarea/1'],
            'habilitarEdicion'        => ['PUT', '/api/habilitarEdicion/1'],
            'realizarObservaciones'   => ['PUT', '/api/realizarObservaciones/1'],
            'vistoBueno'              => ['PUT', '/api/vistoBueno/1'],
            'aprobarTarea'            => ['PUT', '/api/aprobarTarea/1'],
            'rechazarTarea'           => ['PUT', '/api/rechazarTarea/1'],
            'observación de entrega'  => ['PUT', '/api/guardarObservacionesEmpleado/1'],
            'obtenerObservacion'      => ['GET', '/api/obtenerObservacion/1'],
            'listar subtareas'        => ['GET', '/api/subtareas/1'],
            'crear subtarea'          => ['POST', '/api/subtareas'],
            'actualizar subtarea'     => ['PUT', '/api/subtareas/1'],
            'eliminar subtarea'       => ['DELETE', '/api/subtareas/1'],
            'checklists del empleado' => ['GET', '/api/checklists-empleado/1'],
            'cargarActividades'       => ['GET', '/api/cargarActividades/1'],
            'guardarActividad'        => ['POST', '/api/guardarActividad'],
            'actualizarActividad'     => ['PUT', '/api/actualizarActividad/1'],
            'eliminarActividad'       => ['DELETE', '/api/eliminarActividad/1'],
            'actividades-comentarios' => ['GET', '/api/tarea/1/actividades-comentarios'],
        ];
    }

    #[DataProvider('endpointsDelArea')]
    public function test_sin_sesion_responde_401(string $metodo, string $ruta): void
    {
        $this->json($metodo, $ruta, ['titulo' => 'x'])->assertStatus(401);
    }

    // ─── cargarTareas ───────────────────────────────────────────────────────

    public function test_cargar_tareas_devuelve_las_activas_ordenadas_y_con_su_detalle(): void
    {
        $baja = $this->tarea(['prioridad' => 'Baja', 'titulo' => 'Baja']);
        $alta = $this->tarea(['prioridad' => 'Alta', 'titulo' => 'Alta']);
        $this->tarea(['estado_reg' => 'Inactivo', 'titulo' => 'Dada de baja']);
        $this->tarea(['titulo' => 'De otra persona'], $this->ajeno);

        $this->observacion($alta, $this->lider, 'Revisa el alcance');
        $this->db()->table('evidencia_tarea')->insert(['tarea' => $alta, 'evidencia' => 'ruta/x.pdf', 'nombre' => 'x.pdf', 'tipo' => 'application/pdf']);
        $this->subtarea($alta, 'Paso uno', ['completada' => 1]);
        $this->subtarea($alta, 'Paso dos');

        $r = $this->como($this->lider)->getJson("/api/cargarTareas/{$this->colaborador}")->assertOk();

        $tareas = $r->json('tareas');
        $this->assertSame([$alta, $baja], array_map(fn ($t) => (int) $t['id'], $tareas), 'Sólo las activas del empleado, Alta antes que Baja.');
        $this->assertSame('lider@prueba.test', $tareas[0]['observaciones'][0]['creador']);
        $this->assertCount(1, $tareas[0]['evidencias']);
        $this->assertSame(2, $tareas[0]['subtareas_total']);
        $this->assertSame(1, $tareas[0]['subtareas_completadas']);
        $this->assertSame(0, $tareas[1]['subtareas_total']);
    }

    public function test_el_responsable_y_el_administrador_cargan_las_tareas(): void
    {
        $tarea = $this->tarea();

        $this->assertSame([$tarea], $this->ids($this->como($this->colaborador)->getJson("/api/cargarTareas/{$this->colaborador}")->assertOk()));
        $this->assertSame([$tarea], $this->ids($this->como($this->admin)->getJson("/api/cargarTareas/{$this->colaborador}")->assertOk()));
    }

    public function test_cargar_las_tareas_de_un_id_inexistente_devuelve_lista_vacia(): void
    {
        $this->como($this->admin)->getJson('/api/cargarTareas/' . self::INEXISTENTE)
            ->assertOk()->assertExactJson(['tareas' => []]);
    }

    public function test_un_ajeno_no_carga_las_tareas_de_otro_equipo(): void
    {
        // El propio sistema lo da por sentado en el espacio de equipo: un
        // colaborador ve el puesto de otro «sin sus tareas».
        $this->tarea(['titulo' => 'Confidencial']);

        $this->como($this->ajeno)->getJson("/api/cargarTareas/{$this->colaborador}")->assertStatus(403);
    }

    public function test_un_colaborador_no_carga_las_tareas_de_un_companero(): void
    {
        $this->tarea([], $this->independiente);

        $this->como($this->colaborador)->getJson("/api/cargarTareas/{$this->independiente}")->assertStatus(403);
    }

    // ─── Aviso de tareas atrasadas (efecto de cargarTareas) ─────────────────

    public function test_una_tarea_aprobada_y_vencida_avisa_al_lider_una_vez_al_dia(): void
    {
        $tarea = $this->tareaVencida();

        $this->como($this->colaborador)->getJson("/api/cargarTareas/{$this->colaborador}")->assertOk();
        $this->como($this->colaborador)->getJson("/api/cargarTareas/{$this->colaborador}")->assertOk();

        $avisos = $this->avisos($this->lider, 'TareaAtrasada');
        $this->assertCount(1, $avisos);
        $this->assertSame($tarea, (int) $avisos[0]->tarea_id);
        $this->assertStringContainsString('Carlos Colaborador', $avisos[0]->mensaje);
        $this->assertCount(0, $this->avisos($this->colaborador, 'TareaAtrasada'));
    }

    public function test_no_se_avisan_como_atrasadas_las_pausadas_en_revision_completadas_o_no_aprobadas(): void
    {
        $this->tareaVencida(['pausada' => 1]);
        $this->tareaVencida(['estado' => 'En Revisión']);
        $this->tareaVencida(['estado' => 'Completada']);
        $this->tareaVencida(['aprobada' => 0]);
        $this->tareaVencida(['estado_reg' => 'Inactivo']);
        $this->tarea(['aprobada' => 1, 'fecha_pactada' => now()->toDateString()]);

        $this->como($this->colaborador)->getJson("/api/cargarTareas/{$this->colaborador}")->assertOk();

        $this->assertSame(0, $this->db()->table('notif_generales')->where('tipo', 'TareaAtrasada')->count());
    }

    #[Group('hallazgo')]
    public function test_una_tarea_cancelada_no_se_avisa_como_atrasada(): void
    {
        $this->tareaVencida(['estado' => 'Cancelada']);

        $this->como($this->colaborador)->getJson("/api/cargarTareas/{$this->colaborador}")->assertOk();

        $this->assertCount(0, $this->avisos($this->lider, 'TareaAtrasada'));
    }

    #[Group('hallazgo')]
    public function test_una_tarea_atrasada_avisa_a_todos_los_lideres(): void
    {
        $this->db()->table('lideres_empleados')->insert(['lider' => $this->verificador, 'empleado' => $this->colaborador]);
        $this->tareaVencida();

        $this->como($this->colaborador)->getJson("/api/cargarTareas/{$this->colaborador}")->assertOk();

        $this->assertCount(1, $this->avisos($this->lider, 'TareaAtrasada'));
        $this->assertCount(1, $this->avisos($this->verificador, 'TareaAtrasada'));
    }

    // ─── buscarTareas ───────────────────────────────────────────────────────

    public function test_buscar_filtra_por_titulo_descripcion_estado_y_prioridad(): void
    {
        // Hoy responde 500 siempre: el LEFT JOIN con proyectos hace ambigua la
        // columna «descripcion» del WHERE (las dos tablas la tienen).
        $informe = $this->tarea(['titulo' => 'Informe mensual', 'prioridad' => 'Baja']);
        $soporte = $this->tarea(['titulo' => 'Soporte', 'descripcion' => 'Atender el informe del cliente', 'prioridad' => 'Baja']);
        $alta    = $this->tarea(['titulo' => 'Migración', 'prioridad' => 'Alta']);
        $proceso = $this->tarea(['titulo' => 'Despliegue', 'prioridad' => 'Baja'], null, 'En Proceso');
        $this->tarea(['titulo' => 'Informe antiguo', 'estado_reg' => 'Inactivo']);
        $this->tarea(['titulo' => 'Informe de Ana'], $this->ajeno);

        $buscar = fn (string $q) => $this->ids($this->como($this->lider)
            ->getJson("/api/buscarTareas/{$this->colaborador}?search=" . urlencode($q))->assertOk());

        $this->assertSame(collect([$informe, $soporte])->sort()->values()->all(), $buscar('informe'));
        $this->assertSame([$alta], $buscar('Alta'));
        $this->assertSame([$proceso], $buscar('En Proceso'));
        $this->assertSame(collect([$informe, $soporte, $alta, $proceso])->sort()->values()->all(), $buscar(''));
        $this->assertSame([], $buscar('nada que coincida'));
    }

    public function test_buscar_con_comodines_no_rompe_la_consulta(): void
    {
        // Mismo origen que el anterior: la búsqueda nunca llega a responder.
        $this->tarea(['titulo' => 'Cien por ciento']);

        $this->como($this->lider)->getJson("/api/buscarTareas/{$this->colaborador}?search=" . urlencode("%' OR 1=1 --"))
            ->assertOk()->assertExactJson(['tareas' => []]);
    }

    public function test_un_ajeno_no_busca_en_las_tareas_de_otro(): void
    {
        $this->tarea(['titulo' => 'Salarios del equipo']);

        $this->como($this->ajeno)->getJson("/api/buscarTareas/{$this->colaborador}?search=Salarios")->assertStatus(403);
    }

    // ─── cargarTareaSeleccionada ────────────────────────────────────────────

    public function test_el_lider_carga_el_detalle_con_observaciones_y_evidencias(): void
    {
        $tarea = $this->tarea(['titulo' => 'Detalle']);
        $this->observacion($tarea, $this->lider, 'Primera observación');
        $this->db()->table('evidencia_tarea')->insert(['tarea' => $tarea, 'evidencia' => 'r/a.png', 'nombre' => 'a.png', 'tipo' => 'image/png']);

        $this->como($this->lider)->getJson("/api/cargarTareaSeleccionada/{$tarea}")
            ->assertOk()
            ->assertJsonPath('titulo', 'Detalle')
            ->assertJsonPath('observaciones.0.observaciones', 'Primera observación')
            ->assertJsonPath('observaciones.0.creador', 'lider@prueba.test')
            ->assertJsonPath('evidencias.0.nombre', 'a.png');
    }

    public function test_el_detalle_de_una_tarea_inexistente_responde_404(): void
    {
        // Hoy lee ->id de null y responde 500.
        $this->como($this->lider)->getJson('/api/cargarTareaSeleccionada/' . self::INEXISTENTE)->assertStatus(404);
    }

    public function test_un_ajeno_no_carga_el_detalle_de_una_tarea_de_otro_equipo(): void
    {
        $tarea = $this->tarea();

        $this->como($this->ajeno)->getJson("/api/cargarTareaSeleccionada/{$tarea}")->assertStatus(403);
    }

    // ─── tarea/{id}/actividades-comentarios ─────────────────────────────────

    public function test_el_historial_mezcla_actividad_y_comentarios_y_agrupa_repetidos(): void
    {
        $tarea = $this->tarea();
        $this->observacion($tarea, $this->lider, 'Falta el anexo');
        foreach ([1, 2] as $_) {
            $this->db()->table('notif_generales')->insert([
                'id_emisor' => 0, 'tipo_emisor' => 'sistema', 'id_receptor' => 0, 'tipo_receptor' => 'sistema',
                'mensaje' => 'Laura marcó un punto', 'tarea_id' => $tarea, 'leido' => 1, 'fecha' => now(), 'tipo' => 'Checklist',
            ]);
        }

        $r = $this->como($this->lider)->getJson("/api/tarea/{$tarea}/actividades-comentarios")->assertOk();

        $entradas = collect($r->json());
        $this->assertCount(2, $entradas);
        $comentario = $entradas->firstWhere('tipo_entrada', 'comentario');
        $this->assertSame('Falta el anexo', $comentario['texto']);
        $this->assertSame('lider@prueba.test', $comentario['autor']);
        $this->assertSame('Laura marcó un punto (×2)', $entradas->firstWhere('tipo_entrada', 'actividad')['texto']);
    }

    public function test_un_ajeno_no_lee_el_historial_de_una_tarea_de_otro_equipo(): void
    {
        $tarea = $this->tarea();
        $this->observacion($tarea, $this->lider, 'Comentario interno del equipo');

        $this->como($this->ajeno)->getJson("/api/tarea/{$tarea}/actividades-comentarios")->assertStatus(403);
    }

    // ─── checklists-empleado/{id} ───────────────────────────────────────────

    public function test_los_checklists_del_empleado_se_agrupan_por_tarea(): void
    {
        $con = $this->tarea(['titulo' => 'Con checklist']);
        $this->tarea(['titulo' => 'Sin checklist']);
        $this->subtarea($con, 'Segundo', ['orden' => 2, 'checklist_titulo' => 'Despliegue']);
        $this->subtarea($con, 'Primero', ['orden' => 1, 'checklist_titulo' => 'Despliegue', 'fecha_vencimiento' => '2026-12-01']);
        $deAna = $this->tarea([], $this->ajeno);
        $this->subtarea($deAna, 'De Ana');

        $r = $this->como($this->lider)->getJson("/api/checklists-empleado/{$this->colaborador}")->assertOk();

        $this->assertSame([[
            'tarea_id' => $con, 'tarea_titulo' => 'Con checklist', 'checklist_titulo' => 'Despliegue',
            'items' => [
                ['titulo' => 'Primero', 'fecha_vencimiento' => '2026-12-01'],
                ['titulo' => 'Segundo', 'fecha_vencimiento' => null],
            ],
        ]], $r->json());
    }

    public function test_un_ajeno_no_lee_los_checklists_de_otro_equipo(): void
    {
        $tarea = $this->tarea(['titulo' => 'Plan confidencial']);
        $this->subtarea($tarea, 'Listar personas');

        $this->como($this->ajeno)->getJson("/api/checklists-empleado/{$this->colaborador}")->assertStatus(403);
    }

    // ─── obtenerObservacion ─────────────────────────────────────────────────

    #[Group('hallazgo')]
    public function test_obtener_una_observacion_inexistente_responde_404(): void
    {
        // Hoy lee ->creador de null y responde 500. (El caso con observación
        // existente consulta la base del chat, que en pruebas no existe.)
        $this->como($this->lider)->getJson('/api/obtenerObservacion/' . self::INEXISTENTE)->assertStatus(404);
    }
}
