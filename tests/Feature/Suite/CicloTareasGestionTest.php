<?php

namespace Tests\Feature\Suite;

use PHPUnit\Framework\Attributes\Group;

/**
 * Gestión de una tarea ya creada: eliminar, archivar, observaciones (del
 * líder y de entrega), casos de supervisión no cubiertos por
 * SupervisionTareasTest, checklist (subtareas) y actividades del empleado.
 */
class CicloTareasGestionTest extends CicloTareasCaso
{
    private function contar(string $tabla, string $columna, int $valor): int
    {
        return $this->db()->table($tabla)->where($columna, $valor)->count();
    }

    // ─── eliminarTarea ──────────────────────────────────────────────────────

    public function test_el_lider_elimina_una_tarea_con_sus_criterios_evidencias_y_avisos(): void
    {
        $tarea = $this->crearTarea();
        $this->db()->table('evidencia_tarea')->insert(['tarea' => $tarea, 'evidencia' => 'r/e.pdf', 'nombre' => 'e.pdf', 'tipo' => 'application/pdf']);
        $this->assertGreaterThan(0, $this->contar('notif_generales', 'tarea_id', $tarea));

        $this->como($this->lider)->deleteJson("/api/eliminarTarea/{$tarea}")->assertOk();

        $this->assertFalse($this->existeTarea($tarea));
        $this->assertSame(0, $this->contar('tarea_criterios', 'tarea_id', $tarea));
        $this->assertSame(0, $this->contar('evidencia_tarea', 'tarea', $tarea));
        $this->assertSame(0, $this->contar('notif_generales', 'tarea_id', $tarea));
    }

    public function test_el_responsable_elimina_su_tarea_no_aprobada(): void
    {
        $tarea = $this->tarea();

        $this->como($this->colaborador)->deleteJson("/api/eliminarTarea/{$tarea}")->assertOk();

        $this->assertFalse($this->existeTarea($tarea));
    }

    #[Group('hallazgo')]
    public function test_eliminar_una_tarea_no_deja_subtareas_ni_comentarios_huerfanos(): void
    {
        $tarea = $this->tarea();
        $this->subtarea($tarea, 'Punto suelto');
        $this->db()->table('observaciones_tareas')->insert([
            'id_tarea' => $tarea, 'observaciones' => 'Comentario', 'creador' => $this->idUsuario($this->lider), 'fecha' => now()->toDateString(),
        ]);

        $this->como($this->lider)->deleteJson("/api/eliminarTarea/{$tarea}")->assertOk();

        $this->assertSame(0, $this->contar('subtareas', 'tarea_id', $tarea), 'Quedan subtareas de una tarea que ya no existe.');
        $this->assertSame(0, $this->contar('observaciones_tareas', 'id_tarea', $tarea), 'Quedan comentarios de una tarea que ya no existe.');
    }

    public function test_un_ajeno_no_elimina_tareas_de_otro_equipo(): void
    {
        $tarea = $this->crearTarea();

        $this->como($this->ajeno)->deleteJson("/api/eliminarTarea/{$tarea}")->assertStatus(403);

        $this->assertTrue($this->existeTarea($tarea));
        $this->assertCount(3, $this->criterios($tarea));
    }

    public function test_el_responsable_no_elimina_su_tarea_aprobada_sin_edicion_habilitada(): void
    {
        // La pantalla sólo ofrece «Eliminar» al responsable si la tarea no está
        // aprobada o tiene la edición habilitada; el servidor no lo comprueba.
        $tarea = $this->tarea(['aprobada' => 1, 'editable' => 0]);

        $this->como($this->colaborador)->deleteJson("/api/eliminarTarea/{$tarea}")->assertStatus(403);

        $this->assertTrue($this->existeTarea($tarea));
    }

    public function test_eliminar_una_tarea_inexistente_responde_404(): void
    {
        $this->como($this->lider)->deleteJson('/api/eliminarTarea/' . self::INEXISTENTE)->assertStatus(404);
    }

    // ─── archivarTarea / desarchivarTarea ───────────────────────────────────

    public function test_el_lider_archiva_y_desarchiva_una_tarea_cerrada(): void
    {
        $tarea = $this->tarea(['visto_bueno' => 1], null, 'Completada');

        $this->como($this->lider)->putJson("/api/archivarTarea/{$tarea}")->assertOk();
        $this->assertSame(1, (int) $this->campoTarea($tarea, 'archivar'));
        $this->assertSame(now()->toDateString(), $this->campoTarea($tarea, 'fecha_archivada'));
        $this->assertSame('Completada', $this->estadoTarea($tarea), 'Archivar no cambia el estado.');

        $this->como($this->lider)->putJson("/api/desarchivarTarea/{$tarea}")->assertOk();
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'archivar'));
    }

    public function test_un_ajeno_no_archiva_ni_desarchiva_tareas_de_otro_equipo(): void
    {
        $tarea = $this->tarea(['visto_bueno' => 1], null, 'Completada');

        $this->como($this->ajeno)->putJson("/api/archivarTarea/{$tarea}")->assertStatus(403);
        $this->assertNull($this->campoTarea($tarea, 'archivar'));

        $this->db()->table('tareas_empleados')->where('id', $tarea)->update(['archivar' => 1]);
        $this->como($this->ajeno)->putJson("/api/desarchivarTarea/{$tarea}")->assertStatus(403);
        $this->assertSame(1, (int) $this->campoTarea($tarea, 'archivar'));
    }

    public function test_archivar_o_desarchivar_una_tarea_inexistente_responde_404(): void
    {
        $this->como($this->lider)->putJson('/api/archivarTarea/' . self::INEXISTENTE)->assertStatus(404);
        $this->como($this->lider)->putJson('/api/desarchivarTarea/' . self::INEXISTENTE)->assertStatus(404);
    }

    // ─── realizarObservaciones ──────────────────────────────────────────────

    public function test_el_lider_comenta_y_el_responsable_recibe_el_aviso(): void
    {
        $tarea = $this->tarea();

        $this->como($this->lider)->putJson("/api/realizarObservaciones/{$tarea}", ['observaciones' => 'Falta el anexo B'])->assertOk();

        $obs = $this->db()->table('observaciones_tareas')->where('id_tarea', $tarea)->get();
        $this->assertCount(1, $obs);
        $this->assertSame('Falta el anexo B', $obs[0]->observaciones);
        $this->assertSame($this->idUsuario($this->lider), (int) $obs[0]->creador);
        $this->assertSame(now()->toDateString(), $obs[0]->fecha);
        $this->assertCount(1, $this->avisos($this->colaborador, 'Observacion'));
        $this->assertCount(0, $this->avisos($this->lider, 'Observacion'));
    }

    public function test_el_responsable_comenta_su_tarea_y_avisa_a_su_lider(): void
    {
        $tarea = $this->tarea();

        $this->como($this->colaborador)->putJson("/api/realizarObservaciones/{$tarea}", ['observaciones' => 'Necesito acceso al servidor'])
            ->assertOk();

        $this->assertCount(1, $this->avisos($this->lider, 'Observacion'));
    }

    #[Group('hallazgo')]
    public function test_el_aviso_al_lider_dice_que_el_responsable_comento(): void
    {
        // En el caso «empleado» guardarNotificacion sólo redacta Tarea y
        // Estado: el aviso queda como «El empleado Carlos Colaborador (Tarea heredada)».
        $tarea = $this->tarea();

        $this->como($this->colaborador)->putJson("/api/realizarObservaciones/{$tarea}", ['observaciones' => 'Necesito acceso al servidor'])
            ->assertOk();

        $this->assertStringContainsStringIgnoringCase('observ', (string) $this->avisos($this->lider, 'Observacion')->first()?->mensaje);
    }

    public function test_un_ajeno_no_comenta_tareas_de_otro_equipo(): void
    {
        $tarea = $this->tarea();

        $this->como($this->ajeno)->putJson("/api/realizarObservaciones/{$tarea}", ['observaciones' => 'Opino sin ser del equipo'])
            ->assertStatus(403);

        $this->assertSame(0, $this->contar('observaciones_tareas', 'id_tarea', $tarea));
        $this->assertCount(0, $this->avisos($this->colaborador, 'Observacion'));
    }

    #[Group('hallazgo')]
    public function test_comentar_sin_texto_responde_422(): void
    {
        // Sin el campo hoy revienta (clave indefinida, 500); vacío se guarda.
        $tarea = $this->tarea();

        $this->como($this->lider)->putJson("/api/realizarObservaciones/{$tarea}", [])->assertStatus(422);
        $this->como($this->lider)->putJson("/api/realizarObservaciones/{$tarea}", ['observaciones' => '   '])->assertStatus(422);

        $this->assertSame(0, $this->contar('observaciones_tareas', 'id_tarea', $tarea));
    }

    public function test_comentar_una_tarea_inexistente_responde_404(): void
    {
        $this->como($this->lider)->putJson('/api/realizarObservaciones/' . self::INEXISTENTE, ['observaciones' => 'Hola'])
            ->assertStatus(404);

        $this->assertSame(0, $this->contar('observaciones_tareas', 'id_tarea', self::INEXISTENTE));
    }

    // ─── guardarObservacionesEmpleado (observación de entrega) ──────────────

    public function test_el_responsable_deja_su_observacion_de_entrega(): void
    {
        $tarea = $this->tarea([], null, 'En Proceso');

        $this->como($this->colaborador)->putJson("/api/guardarObservacionesEmpleado/{$tarea}", [
            'observacion_entrega' => 'Entregado en la carpeta compartida',
        ])->assertOk();

        $this->assertSame('Entregado en la carpeta compartida', $this->campoTarea($tarea, 'observacion_entrega'));
        $this->assertSame('En Proceso', $this->estadoTarea($tarea), 'Dejar la observación no entrega la tarea.');
    }

    public function test_un_ajeno_no_escribe_la_observacion_de_entrega_de_otro(): void
    {
        $tarea = $this->tarea(['observacion_entrega' => 'Original del responsable']);

        $this->como($this->ajeno)->putJson("/api/guardarObservacionesEmpleado/{$tarea}", ['observacion_entrega' => 'Sobrescrita'])
            ->assertStatus(403);

        $this->assertSame('Original del responsable', $this->campoTarea($tarea, 'observacion_entrega'));
    }

    #[Group('hallazgo')]
    public function test_la_observacion_de_entrega_sin_texto_o_sin_tarea_no_responde_500(): void
    {
        $tarea = $this->tarea(['observacion_entrega' => 'Original']);

        $this->como($this->colaborador)->putJson("/api/guardarObservacionesEmpleado/{$tarea}", [])->assertStatus(422);
        $this->assertSame('Original', $this->campoTarea($tarea, 'observacion_entrega'));

        $this->como($this->colaborador)->putJson('/api/guardarObservacionesEmpleado/' . self::INEXISTENTE, ['observacion_entrega' => 'x'])
            ->assertStatus(404);
    }

    // ─── Supervisión: casos no cubiertos ────────────────────────────────────

    public function test_el_visto_bueno_limpia_el_rechazo_y_avisa_al_responsable(): void
    {
        $tarea = $this->tarea(['rechazada' => 1], null, 'Completada');

        $this->como($this->lider)->putJson("/api/vistoBueno/{$tarea}", ['visto_bueno' => true])->assertOk();

        $this->assertSame(1, (int) $this->campoTarea($tarea, 'visto_bueno'));
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'rechazada'));
        $this->assertCount(1, $this->avisos($this->colaborador, 'VistoBueno'));
    }

    public function test_aprobar_bloquea_la_edicion_y_retirarla_la_devuelve_sin_avisar(): void
    {
        $tarea = $this->tarea();

        $this->como($this->lider)->putJson("/api/aprobarTarea/{$tarea}", ['aprobada' => true])->assertOk();
        $this->assertSame(1, (int) $this->campoTarea($tarea, 'aprobada'));
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'editable'));
        $this->assertSame(now()->toDateString(), $this->campoTarea($tarea, 'fecha_aprobacion'));
        $this->assertCount(1, $this->avisos($this->colaborador, 'Aprobada'));

        $this->como($this->lider)->putJson("/api/aprobarTarea/{$tarea}", ['aprobada' => false])->assertOk();
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'aprobada'));
        $this->assertSame(1, (int) $this->campoTarea($tarea, 'editable'));
        $this->assertNull($this->campoTarea($tarea, 'fecha_aprobacion'));
        $this->assertCount(1, $this->avisos($this->colaborador, 'Aprobada'), 'Retirar la aprobación no genera otro aviso.');
    }

    public function test_rechazar_quita_el_visto_bueno_y_avisa_al_responsable(): void
    {
        $tarea = $this->tarea(['visto_bueno' => 1], null, 'Completada');

        $this->como($this->lider)->putJson("/api/rechazarTarea/{$tarea}", ['rechazada' => true])->assertOk();

        $this->assertSame(1, (int) $this->campoTarea($tarea, 'rechazada'));
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'visto_bueno'));
        $this->assertCount(1, $this->avisos($this->colaborador, 'Rechazada'));
    }

    public function test_rechazar_con_valor_no_booleano_responde_422(): void
    {
        $tarea = $this->tarea([], null, 'Completada');

        $this->como($this->lider)->putJson("/api/rechazarTarea/{$tarea}", ['rechazada' => 'quizás'])->assertStatus(422);
        $this->assertSame('Completada', $this->estadoTarea($tarea));
    }

    #[Group('hallazgo')]
    public function test_rechazar_no_saca_una_tarea_de_revision(): void
    {
        // De «En Revisión» sólo se sale aceptando o devolviendo (devolver exige
        // decir qué corregir y deja constancia). rechazarTarea es otra salida:
        // la pasa a En Proceso sin observación ni registro de la devolución.
        $tarea = $this->tarea([], null, 'En Proceso');
        $this->enviarARevision($tarea);

        $this->como($this->lider)->putJson("/api/rechazarTarea/{$tarea}", ['rechazada' => true])->assertStatus(409);

        $this->assertSame('En Revisión', $this->estadoTarea($tarea));
        $this->assertNotNull($this->campoTarea($tarea, 'fecha_entregada'));
    }

    public function test_un_administrador_sin_empleado_supervisa(): void
    {
        $tarea = $this->tarea([], null, 'Completada');

        $this->comoAdminSinEmpleado()->putJson("/api/vistoBueno/{$tarea}", ['visto_bueno' => true])->assertOk();
        $this->comoAdminSinEmpleado()->putJson("/api/habilitarEdicion/{$tarea}", ['editable' => false])->assertOk();

        $this->assertSame(1, (int) $this->campoTarea($tarea, 'visto_bueno'));
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'editable'));
        $this->assertCount(1, $this->avisos($this->colaborador, 'VistoBueno'));
    }

    // ─── Subtareas (checklist) ──────────────────────────────────────────────

    public function test_el_lider_arma_el_checklist_y_queda_en_el_historial(): void
    {
        $tarea = $this->tarea();

        $r = $this->como($this->lider)->postJson('/api/subtareas', [
            'tarea_id' => $tarea, 'titulo' => 'Diseñar', 'orden' => 2, 'checklist_titulo' => 'Plan', 'fecha_vencimiento' => '',
        ])->assertOk()->assertJson(['success' => true]);
        $this->assertNull($r->json('subtarea.fecha_vencimiento'), 'Una fecha vacía se guarda como null.');
        $this->assertSame('Plan', $r->json('subtarea.checklist_titulo'));
        $this->assertSame(0, (int) $r->json('subtarea.completada'));

        $this->como($this->lider)->postJson('/api/subtareas', ['tarea_id' => $tarea, 'titulo' => 'Investigar', 'orden' => 1])->assertOk();

        $lista = $this->como($this->colaborador)->getJson("/api/subtareas/{$tarea}")->assertOk()->json();
        $this->assertSame(['Investigar', 'Diseñar'], array_column($lista, 'titulo'));

        $historial = $this->historial($tarea, 'Checklist');
        $this->assertCount(2, $historial);
        $this->assertStringContainsString('agregó el punto "Diseñar"', $historial[0]);
    }

    public function test_marcar_y_renombrar_un_punto_queda_en_el_historial_pero_cambiar_la_fecha_no(): void
    {
        $tarea = $this->tarea();
        $punto = $this->subtarea($tarea, 'Probar');

        $this->como($this->colaborador)->putJson("/api/subtareas/{$punto}", ['completada' => true])->assertOk();
        $this->como($this->colaborador)->putJson("/api/subtareas/{$punto}", ['fecha_vencimiento' => '2026-12-24'])->assertOk();
        $this->como($this->colaborador)->putJson("/api/subtareas/{$punto}", ['titulo' => 'Probar en móvil'])
            ->assertOk()->assertJsonPath('subtarea.titulo', 'Probar en móvil');
        $this->como($this->colaborador)->putJson("/api/subtareas/{$punto}", ['completada' => false])->assertOk();

        $fila = $this->db()->table('subtareas')->where('id', $punto)->first();
        $this->assertSame(0, (int) $fila->completada);
        $this->assertSame('2026-12-24', $fila->fecha_vencimiento);

        $historial = $this->historial($tarea, 'Checklist')->all();
        $this->assertCount(3, $historial);
        $this->assertStringContainsString('completó el punto "Probar"', $historial[0]);
        $this->assertStringContainsString('renombró un punto del checklist: "Probar" → "Probar en móvil"', $historial[1]);
        $this->assertStringContainsString('reabrió el punto "Probar en móvil"', $historial[2]);
    }

    public function test_eliminar_un_punto_deja_constancia(): void
    {
        $tarea = $this->tarea();
        $punto = $this->subtarea($tarea, 'Sobrante');

        $this->como($this->lider)->deleteJson("/api/subtareas/{$punto}")->assertOk();

        $this->assertFalse($this->db()->table('subtareas')->where('id', $punto)->exists());
        $this->assertStringContainsString('eliminó el punto "Sobrante"', $this->historial($tarea, 'Checklist')->first());
    }

    public function test_un_ajeno_no_toca_el_checklist_de_otro_equipo(): void
    {
        $tarea = $this->tarea();
        $punto = $this->subtarea($tarea, 'Punto del equipo');

        $this->como($this->ajeno)->getJson("/api/subtareas/{$tarea}")->assertStatus(403);
        $this->como($this->ajeno)->postJson('/api/subtareas', ['tarea_id' => $tarea, 'titulo' => 'Intruso'])->assertStatus(403);
        $this->como($this->ajeno)->putJson("/api/subtareas/{$punto}", ['completada' => true, 'titulo' => 'Cambiado'])->assertStatus(403);
        $this->como($this->ajeno)->deleteJson("/api/subtareas/{$punto}")->assertStatus(403);

        $this->assertSame(1, $this->contar('subtareas', 'tarea_id', $tarea));
        $fila = $this->db()->table('subtareas')->where('id', $punto)->first();
        $this->assertSame('Punto del equipo', $fila->titulo);
        $this->assertSame(0, (int) $fila->completada);
    }

    #[Group('hallazgo')]
    public function test_una_subtarea_sin_titulo_responde_422(): void
    {
        // La columna es NOT NULL y no se valida: hoy responde 500.
        $tarea = $this->tarea();

        $this->como($this->lider)->postJson('/api/subtareas', ['tarea_id' => $tarea])
            ->assertStatus(422)->assertJsonValidationErrors('titulo');
    }

    public function test_subtareas_de_tareas_o_puntos_inexistentes_responden_404(): void
    {
        $this->como($this->lider)->postJson('/api/subtareas', ['tarea_id' => self::INEXISTENTE, 'titulo' => 'Huérfana'])
            ->assertStatus(404);
        $this->assertSame(0, $this->contar('subtareas', 'tarea_id', self::INEXISTENTE));

        $this->como($this->lider)->putJson('/api/subtareas/' . self::INEXISTENTE, ['completada' => true])->assertStatus(404);
        $this->como($this->lider)->deleteJson('/api/subtareas/' . self::INEXISTENTE)->assertStatus(404);
    }

    // ─── Actividades del empleado (gestión de empleados) ───────────────────

    public function test_el_administrador_gestiona_las_actividades_de_un_empleado(): void
    {
        $r = $this->como($this->admin)->postJson('/api/guardarActividad', [
            'empleado' => $this->colaborador, 'actividad' => 'Atender la mesa de ayuda',
        ])->assertOk();
        $id = (int) $r->json('actividad.id');
        $this->assertSame('Atender la mesa de ayuda', $r->json('actividad.descripcion'));

        $this->como($this->admin)->getJson("/api/cargarActividades/{$this->colaborador}")
            ->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $id);

        $this->como($this->admin)->putJson("/api/actualizarActividad/{$id}", ['descripcion' => 'Atender soporte nivel 1'])->assertOk();
        $this->assertSame('Atender soporte nivel 1', $this->db()->table('actividades_empleado')->where('id', $id)->value('descripcion'));

        $this->como($this->admin)->deleteJson("/api/eliminarActividad/{$id}")->assertOk();
        $this->assertFalse($this->db()->table('actividades_empleado')->where('id', $id)->exists());
    }

    public function test_un_empleado_no_gestiona_las_actividades_de_otro(): void
    {
        // Se gestionan desde Parámetros (administración/supervisión); el
        // servidor no comprueba nada.
        $actividad = $this->db()->table('actividades_empleado')->insertGetId([
            'empleado' => $this->colaborador, 'descripcion' => 'Original',
        ]);

        $this->como($this->ajeno)->postJson('/api/guardarActividad', ['empleado' => $this->colaborador, 'actividad' => 'Inventada'])
            ->assertStatus(403);
        $this->como($this->ajeno)->putJson("/api/actualizarActividad/{$actividad}", ['descripcion' => 'Cambiada'])->assertStatus(403);
        $this->como($this->ajeno)->deleteJson("/api/eliminarActividad/{$actividad}")->assertStatus(403);

        $this->assertSame(['Original'], $this->db()->table('actividades_empleado')
            ->where('empleado', $this->colaborador)->pluck('descripcion')->all());
    }

    #[Group('hallazgo')]
    public function test_una_actividad_sin_texto_responde_422(): void
    {
        // Hoy lee claves que no vienen y responde 500.
        $actividad = $this->db()->table('actividades_empleado')->insertGetId([
            'empleado' => $this->colaborador, 'descripcion' => 'Original',
        ]);

        $this->como($this->admin)->postJson('/api/guardarActividad', ['empleado' => $this->colaborador])->assertStatus(422);
        $this->como($this->admin)->putJson("/api/actualizarActividad/{$actividad}", [])->assertStatus(422);

        $this->assertSame('Original', $this->db()->table('actividades_empleado')->where('id', $actividad)->value('descripcion'));
    }
}
