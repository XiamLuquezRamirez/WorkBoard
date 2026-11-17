<?php

namespace Tests\Feature\Suite;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;

/**
 * Crear y editar tareas: guardarTarea (accion guardar / editar) y
 * actualizarTarea. Quién puede asignar a quién, qué se valida, qué cambia en
 * la base y a quién se avisa.
 */
class CicloTareasCrearEditarTest extends CicloTareasCaso
{
    private function crear(int $quien, array $extra = [])
    {
        return $this->como($quien)->postJson('/api/guardarTarea', $this->datosTarea($extra));
    }

    private function tareasDe(int $empleado): int
    {
        return $this->db()->table('tareas_empleados')->where('empleado', $empleado)->count();
    }

    /** Datos de edición por guardarTarea para una tarea existente. */
    private function datosEdicion(int $tarea, array $extra = []): array
    {
        $datos = $this->datosTarea(array_merge(['accion' => 'editar', 'id' => $tarea], $extra));
        unset($datos['criterios']);
        return $datos;
    }

    private function datosActualizar(array $extra = []): array
    {
        return array_merge([
            'titulo'        => 'Título actualizado de la tarea',
            'descripcion'   => 'Descripción actualizada de la tarea',
            'fecha_pactada' => now()->addDays(3)->toDateString(),
            'prioridad'     => 'Alta',
        ], $extra);
    }

    // ─── Crear: quién asigna a quién ────────────────────────────────────────

    public function test_el_lider_asigna_a_su_equipo_y_el_responsable_recibe_el_aviso(): void
    {
        $r = $this->crear($this->lider, ['proposito' => '   Que las solicitudes dejen de llegar por correo   '])->assertOk();
        $id = (int) $r->json('tarea_id');

        $t = $this->fila($id);
        $this->assertSame($this->colaborador, (int) $t['empleado']);
        $this->assertSame('Activo', $t['estado_reg']);
        $this->assertSame('Pendiente', $t['estado']);
        $this->assertSame(1, (int) $t['editable']);
        $this->assertSame(0, (int) $t['pausada']);
        $this->assertSame('Que las solicitudes dejen de llegar por correo', $t['proposito']);
        $this->assertCount(3, $this->criterios($id));

        $this->assertCount(1, $this->avisos($this->colaborador, 'Tarea'));
        $this->assertCount(0, $this->avisos($this->lider, 'Tarea'), 'Quien asigna no se avisa a sí mismo.');
        $this->assertContains($id, collect($r->json('tareas'))->pluck('id')->map(fn ($i) => (int) $i)->all());
    }

    public function test_el_colaborador_se_crea_una_tarea_propia_y_avisa_a_su_lider(): void
    {
        $this->crear($this->colaborador)->assertOk();

        $this->assertSame(1, $this->tareasDe($this->colaborador));
        $this->assertCount(1, $this->avisos($this->lider, 'Tarea'));
        $this->assertCount(0, $this->avisos($this->colaborador, 'Tarea'));
    }

    public function test_con_independencia_se_crea_tareas_propias(): void
    {
        $this->crear($this->independiente, ['empleado' => $this->independiente])->assertOk();

        $this->assertSame(1, $this->tareasDe($this->independiente));
    }

    public function test_el_administrador_asigna_a_cualquiera(): void
    {
        $this->crear($this->admin, ['empleado' => $this->ajeno])->assertOk();

        $this->assertSame(1, $this->tareasDe($this->ajeno));
        $this->assertCount(1, $this->avisos($this->ajeno, 'Tarea'));
    }

    public function test_un_administrador_sin_empleado_asigna_tareas(): void
    {
        $this->comoAdminSinEmpleado()->postJson('/api/guardarTarea', $this->datosTarea())->assertOk();

        $this->assertSame(1, $this->tareasDe($this->colaborador));
        $this->assertCount(1, $this->avisos($this->colaborador, 'Tarea'));
    }

    public function test_un_ajeno_no_asigna_tareas_a_otro_equipo(): void
    {
        // Ana no lidera a Carlos: no debería poder cargarle trabajo, ni de paso
        // recibir la lista de tareas de Carlos en la respuesta.
        $this->crear($this->ajeno)->assertStatus(403)->assertJsonMissingPath('tareas');

        $this->assertSame(0, $this->tareasDe($this->colaborador));
    }

    public function test_un_colaborador_no_asigna_tareas_a_un_companero(): void
    {
        $this->crear($this->colaborador, ['empleado' => $this->independiente])->assertStatus(403);

        $this->assertSame(0, $this->tareasDe($this->independiente));
    }

    public function test_el_lider_no_asigna_tareas_fuera_de_su_equipo(): void
    {
        // Después ni siquiera podría moverla: reglaDeEstado no la reconoce como suya.
        $this->crear($this->lider, ['empleado' => $this->ajeno])->assertStatus(403);

        $this->assertSame(0, $this->tareasDe($this->ajeno));
    }

    public function test_el_responsable_se_entera_cuando_un_supervisor_le_asigna_tarea(): void
    {
        $sup = $this->supervisor();

        $this->crear($sup, ['empleado' => $this->ajeno])->assertOk();

        $this->assertSame(1, $this->tareasDe($this->ajeno));
        $this->assertCount(1, $this->avisos($this->ajeno, 'Tarea'), 'El responsable debe enterarse de la tarea asignada.');
    }

    public function test_una_tarea_creada_por_el_colaborador_avisa_a_todos_sus_lideres(): void
    {
        // Igual que al enviar a revisión: con dos líderes, los dos deben enterarse.
        $this->db()->table('lideres_empleados')->insert(['lider' => $this->verificador, 'empleado' => $this->colaborador]);

        $this->crear($this->colaborador)->assertOk();

        $this->assertCount(1, $this->avisos($this->lider, 'Tarea'));
        $this->assertCount(1, $this->avisos($this->verificador, 'Tarea'));
    }

    // ─── Crear: validaciones ────────────────────────────────────────────────

    /** [cambios sobre datosTarea, campo con error] */
    public static function datosInvalidos(): array
    {
        $ayer = date('Y-m-d', strtotime('-2 days'));

        return [
            'sin título'               => [['titulo' => null], 'titulo'],
            'título demasiado largo'   => [['titulo' => str_repeat('a', 256)], 'titulo'],
            'sin descripción'          => [['descripcion' => null], 'descripcion'],
            'descripción corta'        => [['descripcion' => 'Corta'], 'descripcion'],
            'fecha pasada'             => [['fecha_pactada' => $ayer], 'fecha_pactada'],
            'fecha que no es fecha'    => [['fecha_pactada' => 'mañana temprano'], 'fecha_pactada'],
            'sin responsable'          => [['empleado' => null], 'empleado'],
            'responsable no numérico'  => [['empleado' => 'Carlos'], 'empleado'],
            'sin prioridad'            => [['prioridad' => null], 'prioridad'],
            'sin propósito'            => [['proposito' => null], 'proposito'],
            'propósito corto'          => [['proposito' => 'Porque sí'], 'proposito'],
            'propósito larguísimo'     => [['proposito' => str_repeat('p', 501)], 'proposito'],
            'acción desconocida'       => [['accion' => 'borrar'], 'accion'],
            'criterio corto'           => [['criterios' => [['descripcion' => 'Ok']]], 'criterios.0.descripcion'],
            'criterios no es lista'    => [['criterios' => 'que funcione bien'], 'criterios'],
            'demasiados criterios'     => [['criterios' => array_fill(0, 31, ['descripcion' => 'Criterio repetido'])], 'criterios'],
            'proyecto no numérico'     => [['proyecto_id' => 'abc'], 'proyecto_id'],
        ];
    }

    #[DataProvider('datosInvalidos')]
    public function test_crear_con_datos_invalidos_responde_422_y_no_crea_nada(array $cambios, string $campo): void
    {
        $this->crear($this->lider, $cambios)->assertStatus(422)->assertJsonValidationErrors($campo);

        $this->assertSame(0, $this->db()->table('tareas_empleados')->count());
        $this->assertSame(0, $this->db()->table('notif_generales')->count());
    }

    public function test_la_fecha_pactada_de_hoy_es_valida(): void
    {
        $this->crear($this->lider, ['fecha_pactada' => now()->toDateString()])->assertOk();

        $this->assertSame(1, $this->tareasDe($this->colaborador));
    }

    public function test_la_tarea_queda_ligada_a_su_proyecto(): void
    {
        $proyecto = $this->db()->table('proyectos')->insertGetId(['nombre' => 'Portal de solicitudes', 'estado' => 'Activo']);

        $r = $this->crear($this->lider, ['proyecto_id' => $proyecto])->assertOk();

        $id = (int) $r->json('tarea_id');
        $this->assertSame($proyecto, (int) $this->campoTarea($id, 'proyecto_id'));
        $fila = collect($r->json('tareas'))->firstWhere('id', $id);
        $this->assertSame('Portal de solicitudes', $fila['proyecto_nombre']);
    }

    public function test_crear_para_un_empleado_inexistente_responde_422(): void
    {
        // Hoy revienta en guardarNotificacion (lee ->id de un receptor nulo) y responde 500.
        $this->crear($this->lider, ['empleado' => self::INEXISTENTE])
            ->assertStatus(422)->assertJsonValidationErrors('empleado');

        $this->assertSame(0, $this->db()->table('tareas_empleados')->count());
    }

    public function test_no_se_asigna_una_tarea_a_un_empleado_inactivo(): void
    {
        $this->db()->table('empleados')->where('id', $this->ajeno)->update(['estado' => 'Inactivo']);

        $this->crear($this->admin, ['empleado' => $this->ajeno])->assertStatus(422);

        $this->assertSame(0, $this->tareasDe($this->ajeno));
    }

    public function test_un_proyecto_inexistente_se_rechaza(): void
    {
        $this->crear($this->lider, ['proyecto_id' => self::INEXISTENTE])
            ->assertStatus(422)->assertJsonValidationErrors('proyecto_id');

        $this->assertSame(0, $this->tareasDe($this->colaborador));
    }

    public function test_el_responsable_de_verificacion_debe_existir(): void
    {
        // POST /tareas/{id}/criterios ya lo exige (exists:mysql2.empleados,id);
        // al crear la tarea con sus criterios no.
        $this->crear($this->lider, ['criterios' => [
            ['descripcion' => 'Lo verifica alguien que no existe', 'responsable_verificacion' => self::INEXISTENTE],
        ]])->assertStatus(422)->assertJsonValidationErrors('criterios.0.responsable_verificacion');

        $this->assertSame(0, $this->tareasDe($this->colaborador));
    }

    public function test_la_prioridad_debe_ser_alta_media_o_baja(): void
    {
        // El orden de cargarTareas usa FIELD(prioridad, 'Alta', 'Media', 'Baja'):
        // cualquier otro texto queda fuera del orden y de los filtros.
        $this->crear($this->lider, ['prioridad' => 'Urgentísima'])
            ->assertStatus(422)->assertJsonValidationErrors('prioridad');

        $tarea = $this->tarea();
        $this->como($this->lider)->putJson("/api/actualizarTarea/{$tarea}", $this->datosActualizar(['prioridad' => 'Para ayer']))
            ->assertStatus(422);
        $this->assertSame('Media', $this->campoTarea($tarea, 'prioridad'));
    }

    // ─── Editar con guardarTarea (accion=editar) ───────────────────────────

    public function test_al_editar_se_relajan_la_fecha_y_la_descripcion(): void
    {
        // Las tareas antiguas tienen descripciones cortas y fechas vencidas.
        $tarea = $this->tarea();
        $ayer = now()->subDays(3)->toDateString();

        $this->como($this->lider)->postJson('/api/guardarTarea', $this->datosEdicion($tarea, [
            'descripcion' => 'Corta', 'fecha_pactada' => $ayer, 'titulo' => 'Tarea heredada renombrada',
        ]))->assertOk()->assertJson(['tarea_id' => $tarea]);

        $this->assertSame('Corta', $this->campoTarea($tarea, 'descripcion'));
        $this->assertSame($ayer, $this->campoTarea($tarea, 'fecha_pactada'));
        $this->assertSame('Tarea heredada renombrada', $this->campoTarea($tarea, 'titulo'));
        $this->assertCount(0, $this->avisos($this->colaborador, 'Tarea'), 'Editar no avisa como tarea nueva.');
    }

    public function test_editar_exige_el_id(): void
    {
        $datos = $this->datosEdicion(0);
        unset($datos['id']);

        $this->como($this->lider)->postJson('/api/guardarTarea', $datos)
            ->assertStatus(422)->assertJsonValidationErrors('id');
    }

    public function test_editar_no_reasigna_la_tarea(): void
    {
        $tarea = $this->tarea();

        $this->como($this->lider)->postJson('/api/guardarTarea', $this->datosEdicion($tarea, ['empleado' => $this->independiente]))
            ->assertOk();

        $this->assertSame($this->colaborador, (int) $this->campoTarea($tarea, 'empleado'));
    }

    public function test_editar_sin_proposito_conserva_el_pactado(): void
    {
        $tarea = $this->tarea(['proposito' => 'Que el equipo tenga trazabilidad']);
        $datos = $this->datosEdicion($tarea);
        unset($datos['proposito']);

        $this->como($this->lider)->postJson('/api/guardarTarea', $datos)->assertOk();

        $this->assertSame('Que el equipo tenga trazabilidad', $this->campoTarea($tarea, 'proposito'));
    }

    public function test_el_responsable_pasa_su_tarea_a_en_proceso_editandola(): void
    {
        $tarea = $this->tarea();

        $this->como($this->colaborador)->postJson('/api/guardarTarea', $this->datosEdicion($tarea, ['estado' => 'En Proceso']))
            ->assertOk();

        $this->assertSame('En Proceso', $this->estadoTarea($tarea));
    }

    public function test_editar_no_envia_a_revision(): void
    {
        $tarea = $this->tarea([], null, 'En Proceso');

        $this->como($this->colaborador)->postJson('/api/guardarTarea', $this->datosEdicion($tarea, ['estado' => 'En Revisión']))
            ->assertStatus(409);

        $this->assertSame('En Proceso', $this->estadoTarea($tarea));
        $this->assertNull($this->campoTarea($tarea, 'fecha_entregada'));
    }

    public function test_un_ajeno_no_edita_tareas_de_otro_equipo(): void
    {
        // reglaDeEstado sólo se consulta si cambia el estado: con el mismo
        // estado cualquiera reescribe título, descripción y fecha.
        $tarea = $this->tarea();

        $this->como($this->ajeno)->postJson('/api/guardarTarea', $this->datosEdicion($tarea, ['titulo' => 'Reescrita por Ana']))
            ->assertStatus(403);

        $this->assertSame('Tarea heredada', $this->campoTarea($tarea, 'titulo'));
    }

    public function test_editar_no_acepta_un_estado_inventado(): void
    {
        // actualizarEstadoTarea valida contra ESTADOS_TAREA; editar no.
        $tarea = $this->tarea();

        $this->como($this->lider)->postJson('/api/guardarTarea', $this->datosEdicion($tarea, ['estado' => 'Casi lista']))
            ->assertStatus(422);

        $this->assertSame('Pendiente', $this->estadoTarea($tarea));
    }

    public function test_editar_una_tarea_inexistente_responde_404(): void
    {
        $this->como($this->lider)->postJson('/api/guardarTarea', $this->datosEdicion(self::INEXISTENTE))
            ->assertStatus(404);
    }

    public function test_editar_no_devuelve_las_tareas_de_otro_empleado(): void
    {
        // La respuesta lista las tareas del «empleado» que manda el cliente,
        // no las del responsable real: basta cambiar ese número para leer las
        // tareas de cualquiera.
        $tarea = $this->tarea();
        $deAna = $this->tarea(['titulo' => 'Tarea privada de Ana'], $this->ajeno);

        $r = $this->como($this->lider)->postJson('/api/guardarTarea', $this->datosEdicion($tarea, ['empleado' => $this->ajeno]));

        $ids = collect($r->json('tareas') ?? [])->pluck('id')->map(fn ($i) => (int) $i)->all();
        $this->assertNotContains($deAna, $ids);
    }

    // ─── actualizarTarea ────────────────────────────────────────────────────

    public function test_el_responsable_actualiza_su_tarea_no_aprobada(): void
    {
        $tarea = $this->tarea();

        $this->como($this->colaborador)->putJson("/api/actualizarTarea/{$tarea}", $this->datosActualizar())->assertOk();

        $this->assertSame('Título actualizado de la tarea', $this->campoTarea($tarea, 'titulo'));
        $this->assertSame('Alta', $this->campoTarea($tarea, 'prioridad'));
    }

    public function test_actualizar_no_cambia_estado_ni_responsable(): void
    {
        $tarea = $this->tarea([], null, 'En Proceso');

        $this->como($this->lider)->putJson("/api/actualizarTarea/{$tarea}", $this->datosActualizar([
            'estado' => 'Completada', 'empleado' => $this->ajeno,
        ]))->assertOk();

        $this->assertSame('En Proceso', $this->estadoTarea($tarea));
        $this->assertSame($this->colaborador, (int) $this->campoTarea($tarea, 'empleado'));
    }

    public static function actualizacionesInvalidas(): array
    {
        return [
            'sin título'          => [['titulo' => null], 'titulo'],
            'sin descripción'     => [['descripcion' => ''], 'descripcion'],
            'fecha que no es'     => [['fecha_pactada' => '31/02/2026'], 'fecha_pactada'],
            'sin prioridad'       => [['prioridad' => null], 'prioridad'],
            'propósito larguísimo'=> [['proposito' => str_repeat('p', 501)], 'proposito'],
            'proyecto no numérico'=> [['proyecto_id' => 'x'], 'proyecto_id'],
        ];
    }

    #[DataProvider('actualizacionesInvalidas')]
    public function test_actualizar_con_datos_invalidos_responde_422_y_no_cambia_nada(array $cambios, string $campo): void
    {
        $tarea = $this->tarea();
        $antes = $this->fila($tarea);

        $this->como($this->lider)->putJson("/api/actualizarTarea/{$tarea}", $this->datosActualizar($cambios))
            ->assertStatus(422)->assertJsonValidationErrors($campo);

        $this->assertSame($antes, $this->fila($tarea));
    }

    public function test_actualizar_una_tarea_inexistente_responde_404(): void
    {
        $this->como($this->lider)->putJson('/api/actualizarTarea/' . self::INEXISTENTE, $this->datosActualizar())
            ->assertStatus(404);
    }

    public function test_un_proposito_pactado_no_se_vacia_ni_se_acorta(): void
    {
        $tarea = $this->tarea(['proposito' => 'Que el cliente reciba su respuesta a tiempo']);

        $this->como($this->lider)->putJson("/api/actualizarTarea/{$tarea}", $this->datosActualizar(['proposito' => '   ']))
            ->assertStatus(422);
        $this->como($this->lider)->putJson("/api/actualizarTarea/{$tarea}", $this->datosActualizar(['proposito' => 'Corto']))
            ->assertStatus(422);

        $this->assertSame('Que el cliente reciba su respuesta a tiempo', $this->campoTarea($tarea, 'proposito'));
        $this->assertSame('Tarea heredada', $this->campoTarea($tarea, 'titulo'), 'Un 422 no aplica los demás cambios.');
    }

    public function test_pactar_el_criterio_de_una_tarea_heredada_queda_en_el_historial_una_vez(): void
    {
        $tarea = $this->tarea();

        $this->como($this->lider)->putJson("/api/actualizarTarea/{$tarea}", $this->datosActualizar([
            'criterio' => 'El informe queda publicado en la intranet',
        ]))->assertOk();
        $this->como($this->lider)->putJson("/api/actualizarTarea/{$tarea}", $this->datosActualizar([
            'criterio' => 'El informe queda publicado y enlazado en la intranet',
        ]))->assertOk();

        $this->assertSame('El informe queda publicado y enlazado en la intranet', $this->campoTarea($tarea, 'criterio'));
        $this->assertCount(1, $this->historial($tarea, 'Criterio'), 'Sólo la primera vez cuenta como adopción del método.');
    }

    public function test_actualizar_devuelve_el_nombre_del_proyecto(): void
    {
        $proyecto = $this->db()->table('proyectos')->insertGetId(['nombre' => 'Mesa de ayuda', 'estado' => 'Activo']);
        $tarea = $this->tarea();

        $this->como($this->lider)->putJson("/api/actualizarTarea/{$tarea}", $this->datosActualizar(['proyecto_id' => $proyecto]))
            ->assertOk()->assertJson(['proyecto_nombre' => 'Mesa de ayuda']);

        $this->assertSame($proyecto, (int) $this->campoTarea($tarea, 'proyecto_id'));
    }

    public function test_un_ajeno_no_actualiza_tareas_de_otro_equipo(): void
    {
        $tarea = $this->tarea();

        $this->como($this->ajeno)->putJson("/api/actualizarTarea/{$tarea}", $this->datosActualizar([
            'fecha_pactada' => now()->addYear()->toDateString(),
        ]))->assertStatus(403);

        $this->assertSame('Tarea heredada', $this->campoTarea($tarea, 'titulo'));
        $this->assertNull($this->campoTarea($tarea, 'fecha_pactada'));
    }

    public function test_una_tarea_aprobada_sin_edicion_habilitada_no_la_edita_su_responsable(): void
    {
        // aprobarTarea deja editable=0 y habilitarEdicion existe para volver a
        // permitirlo, pero el servidor nunca mira «editable»: el bloqueo sólo
        // lo aplica la pantalla.
        $tarea = $this->tarea();
        $this->como($this->lider)->putJson("/api/aprobarTarea/{$tarea}", ['aprobada' => true])->assertOk();
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'editable'));

        $this->como($this->colaborador)->putJson("/api/actualizarTarea/{$tarea}", $this->datosActualizar())->assertStatus(403);
        $this->como($this->colaborador)->postJson('/api/guardarTarea', $this->datosEdicion($tarea, ['titulo' => 'Cambiada sin permiso']))
            ->assertStatus(403);
        $this->assertSame('Tarea heredada', $this->campoTarea($tarea, 'titulo'));

        // Con la edición habilitada por el líder, sí.
        $this->como($this->lider)->putJson("/api/habilitarEdicion/{$tarea}", ['editable' => true])->assertOk();
        $this->como($this->colaborador)->putJson("/api/actualizarTarea/{$tarea}", $this->datosActualizar())->assertOk();
        $this->assertSame('Título actualizado de la tarea', $this->campoTarea($tarea, 'titulo'));
    }
}
