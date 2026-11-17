<?php

namespace Tests\Feature;

use App\Http\Controllers\CriteriosAceptacionController;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * Criterios de aceptación: permisos, flujo de aceptación e independencia
 * respecto del checklist.
 *
 * Corre contra la base workboard_test (phpunit.xml → DB_DATABASE_SECOND),
 * que tiene la estructura de workboard y ningún dato. Cada prueba se ejecuta
 * dentro de una transacción que se deshace al terminar.
 */
class CriteriosAceptacionTest extends TestCase
{
    use DatabaseTransactions;
    use DatosDeEquipo;

    protected $connectionsToTransact = ['mysql2'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararEquipo();
    }

    // ─── Creación ───────────────────────────────────────────────────────────

    public function test_una_tarea_nueva_exige_al_menos_un_criterio(): void
    {
        $this->como($this->lider)
            ->postJson('/api/guardarTarea', $this->datosTarea(['criterios' => []]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('criterios');
    }

    public function test_la_tarea_nace_con_sus_criterios(): void
    {
        $tarea = $this->crearTarea();

        $criterios = DB::connection('mysql2')->table('tarea_criterios')->where('tarea_id', $tarea)->orderBy('orden')->get();
        $this->assertCount(3, $criterios);
        $this->assertSame(['Pendiente'], $criterios->pluck('estado')->unique()->values()->all());
        $this->assertSame(0, (int) $criterios[2]->obligatorio);

        $this->assertSame(3, DB::connection('mysql2')->table('tarea_criterio_historial')
            ->where('tarea_id', $tarea)->where('evento', 'creado')->count());
    }

    public function test_el_texto_unico_antiguo_se_convierte_en_criterio(): void
    {
        $datos = $this->datosTarea();
        unset($datos['criterios']);
        $datos['criterio'] = 'El informe queda firmado por la gerencia';

        $id = $this->como($this->lider)->postJson('/api/guardarTarea', $datos)->assertOk()->json('tarea_id');

        $this->assertSame('El informe queda firmado por la gerencia', DB::connection('mysql2')
            ->table('tarea_criterios')->where('tarea_id', $id)->value('descripcion'));
    }

    // ─── Permisos de gestión ────────────────────────────────────────────────

    public function test_solo_el_lider_gestiona_los_criterios(): void
    {
        $tarea = $this->crearTarea();
        $nuevo = ['descripcion' => 'Los totales cuadran con el balance'];

        $this->como($this->colaborador)->postJson("/api/tareas/{$tarea}/criterios", $nuevo)->assertStatus(403);
        $this->como($this->ajeno)->postJson("/api/tareas/{$tarea}/criterios", $nuevo)->assertStatus(403);
        $this->como($this->lider)->postJson("/api/tareas/{$tarea}/criterios", $nuevo)->assertStatus(201);
    }

    public function test_un_ajeno_no_ve_los_criterios(): void
    {
        $tarea = $this->crearTarea();

        $this->como($this->ajeno)->getJson("/api/tareas/{$tarea}/criterios")->assertStatus(403);
        $this->como($this->colaborador)->getJson("/api/tareas/{$tarea}/criterios")->assertOk();
    }

    public function test_eliminar_un_criterio_conserva_la_trazabilidad(): void
    {
        $tarea = $this->crearTarea();
        $c = $this->criterios($tarea)[0];

        $this->como($this->lider)->deleteJson("/api/criterios/{$c}")->assertOk();

        $fila = DB::connection('mysql2')->table('tarea_criterios')->where('id', $c)->first();
        $this->assertNotNull($fila, 'El criterio no debe borrarse físicamente.');
        $this->assertNotNull($fila->eliminado_at);
        $this->assertCount(2, $this->como($this->lider)->getJson("/api/tareas/{$tarea}/criterios")->json('criterios'));
        $this->assertSame(1, DB::connection('mysql2')->table('tarea_criterio_historial')
            ->where('criterio_id', $c)->where('evento', 'eliminado')->count());
    }

    public function test_ordenar_exige_exactamente_los_criterios_de_la_tarea(): void
    {
        $tarea = $this->crearTarea();
        [$a, $b, $c] = $this->criterios($tarea);

        $this->como($this->lider)->putJson("/api/tareas/{$tarea}/criterios/orden", ['orden' => [$a, $b]])->assertStatus(422);
        $this->como($this->lider)->putJson("/api/tareas/{$tarea}/criterios/orden", ['orden' => [$c, $a, $b]])->assertOk();

        $this->assertSame([$c, $a, $b], $this->criterios($tarea));
    }

    // ─── Flujo de aceptación ────────────────────────────────────────────────

    public function test_no_se_cierra_arrastrando_la_tarjeta(): void
    {
        $tarea = $this->crearTarea();

        $this->como($this->colaborador)
            ->putJson("/api/actualizarEstadoTarea/{$tarea}", ['estado' => 'Completada'])
            ->assertStatus(409);
    }

    public function test_una_tarea_no_nace_completada_ni_en_revision(): void
    {
        foreach (['Completada', 'En Revisión'] as $estado) {
            $this->como($this->lider)
                ->postJson('/api/guardarTarea', $this->datosTarea(['estado' => $estado]))
                ->assertStatus(422)
                ->assertJsonValidationErrors('estado');
        }
        $this->assertSame(0, DB::connection('mysql2')
            ->table('tareas_empleados')->where('empleado', $this->colaborador)->count());
    }

    public function test_no_se_cierra_editando_la_tarea(): void
    {
        $tarea = $this->crearTarea();
        $datos = $this->datosTarea(['accion' => 'editar', 'id' => $tarea, 'estado' => 'Completada']);
        unset($datos['criterios']);

        $this->como($this->lider)->postJson('/api/guardarTarea', $datos)
            ->assertStatus(409)
            ->assertJson(['requiere_verificacion' => true]);
        $this->assertSame('Pendiente', $this->estadoTarea($tarea));
    }

    public function test_flujo_completo_con_devolucion_y_aceptacion(): void
    {
        $tarea = $this->crearTarea();
        [$c1, $c2, $c3] = $this->criterios($tarea);

        // 4. El colaborador ejecuta y declara. Su declaración no es el veredicto.
        $this->como($this->colaborador)->putJson("/api/criterios/{$c1}/declarar", ['cumplido' => true])->assertOk();
        $this->assertSame('Pendiente', $this->estadoCriterio($c1));

        // No se verifica antes de la entrega.
        $this->como($this->lider)->putJson("/api/criterios/{$c1}/verificar", ['estado' => 'Cumplido'])->assertStatus(409);

        // 5. Envía a revisión.
        $this->enviarARevision($tarea);

        // 6-8. Con pendientes no se acepta.
        $r = $this->como($this->lider)->putJson("/api/tareas/{$tarea}/aceptar")->assertStatus(422);
        $this->assertNotEmpty($r->json('bloqueos'));

        $this->como($this->lider)->putJson("/api/criterios/{$c1}/verificar", ['estado' => 'Cumplido'])->assertOk();

        // «No cumplido» exige decir qué falta.
        $this->como($this->lider)->putJson("/api/criterios/{$c2}/verificar", ['estado' => 'No cumplido'])->assertStatus(422);
        $this->como($this->lider)->putJson("/api/criterios/{$c2}/verificar", [
            'estado' => 'No cumplido', 'observacion' => 'Falta el identificador único',
        ])->assertOk();

        $this->como($this->lider)->putJson("/api/tareas/{$tarea}/aceptar")->assertStatus(422);

        // Devolver exige observación.
        $this->como($this->lider)->putJson("/api/tareas/{$tarea}/devolver", [])->assertStatus(422);
        $this->como($this->lider)->putJson("/api/tareas/{$tarea}/devolver", ['observacion' => 'Corrige el identificador'])->assertOk();
        $this->assertSame('En Proceso', $this->estadoTarea($tarea));

        // 9. Corrige y reenvía.
        $this->enviarARevision($tarea);

        // El criterio que exige evidencia no se da por cumplido sin ella.
        $this->como($this->lider)->putJson("/api/criterios/{$c2}/verificar", ['estado' => 'Cumplido'])->assertStatus(422);
        $this->como($this->colaborador)->postJson("/api/criterios/{$c2}/evidencias", [
            'tipo' => 'enlace', 'ruta' => 'https://drive.example.com/prueba', 'nombre' => 'Captura del identificador',
        ])->assertStatus(201);
        $this->como($this->lider)->putJson("/api/criterios/{$c2}/verificar", ['estado' => 'Cumplido'])->assertOk();

        // El tercero es opcional: no bloquea aunque siga pendiente.
        $this->assertSame('Pendiente', $this->estadoCriterio($c3));

        $this->como($this->lider)->putJson("/api/tareas/{$tarea}/aceptar")->assertOk();
        $this->assertSame('Completada', $this->estadoTarea($tarea));

        // La pantalla toma el estado de aquí: ya no ofrece aceptar otra vez.
        $this->como($this->lider)->getJson("/api/tareas/{$tarea}/criterios")
            ->assertOk()->assertJsonPath('estado_tarea', 'Completada');

        // Un segundo clic en «Aceptar entrega» no vuelve a cerrarla.
        $this->como($this->lider)->putJson("/api/tareas/{$tarea}/aceptar")->assertStatus(409);

        // Las dos decisiones quedan registradas, sin sobrescribirse.
        $this->assertSame(['Devuelta', 'Aceptada'], DB::connection('mysql2')->table('tarea_aceptaciones')
            ->where('tarea_id', $tarea)->orderBy('id')->pluck('resultado')->all());

        // El veredicto anterior de c2 sigue en el historial.
        $estados = DB::connection('mysql2')->table('tarea_criterio_historial')
            ->where('criterio_id', $c2)->where('evento', 'verificado')->orderBy('id')->pluck('despues')
            ->map(fn ($d) => json_decode($d, true)['estado'])->all();
        $this->assertSame(['No cumplido', 'Cumplido'], $estados);

        // Cerrada: lo pactado ya no se cambia.
        $this->como($this->lider)->putJson("/api/criterios/{$c1}", ['descripcion' => 'Otro texto distinto'])->assertStatus(409);
    }

    public function test_marcar_todos_cumplidos_no_acepta_la_tarea(): void
    {
        $tarea = $this->crearTarea([['descripcion' => 'Único criterio obligatorio']]);
        [$c] = $this->criterios($tarea);

        $this->enviarARevision($tarea);
        $this->como($this->lider)->putJson("/api/criterios/{$c}/verificar", ['estado' => 'Cumplido'])->assertOk();

        $this->assertSame('En Revisión', $this->estadoTarea($tarea));
        $this->assertSame('Lista para aceptar', $this->como($this->lider)
            ->getJson("/api/tareas/{$tarea}/criterios")->json('resumen.estado_general'));
        $this->assertSame(0, DB::connection('mysql2')->table('tarea_aceptaciones')->where('tarea_id', $tarea)->count());
    }

    // ─── Quién acepta ───────────────────────────────────────────────────────

    public function test_el_colaborador_no_acepta_su_propia_tarea(): void
    {
        $tarea = $this->crearTarea([['descripcion' => 'Único criterio obligatorio']]);
        [$c] = $this->criterios($tarea);
        $this->enviarARevision($tarea);

        // Ni verifica ni acepta: sólo declara.
        $this->como($this->colaborador)->putJson("/api/criterios/{$c}/verificar", ['estado' => 'Cumplido'])->assertStatus(403);
        $this->como($this->lider)->putJson("/api/criterios/{$c}/verificar", ['estado' => 'Cumplido'])->assertOk();
        $this->como($this->colaborador)->putJson("/api/tareas/{$tarea}/aceptar")->assertStatus(403);
        $this->como($this->ajeno)->putJson("/api/tareas/{$tarea}/aceptar")->assertStatus(403);
    }

    public function test_con_independencia_su_tarea_se_acepta_sola_al_completarla(): void
    {
        // Decisión de la empresa: quien tiene independencia no espera
        // revisión. Al entregarla, sus criterios pendientes quedan verificados
        // y la tarea se cierra.
        $tarea = $this->crearTarea([['descripcion' => 'Único criterio obligatorio']], $this->independiente);
        [$c] = $this->criterios($tarea);

        $this->como($this->independiente)->putJson("/api/actualizarEstadoTarea/{$tarea}", ['estado' => 'En Revisión'])
            ->assertOk()->assertJsonPath('auto_aceptada', true)->assertJsonPath('estado_final', 'Completada');

        $this->assertSame('Completada', $this->estadoTarea($tarea));
        $this->assertSame('Cumplido', $this->estadoCriterio($c));
        $this->assertNotNull($this->campoTarea($tarea, 'fecha_entregada'));
        $this->assertTrue(\Illuminate\Support\Facades\DB::connection('mysql2')->table('tarea_aceptaciones')
            ->where('tarea_id', $tarea)->where('resultado', 'Aceptada')->exists());
    }

    public function test_con_independencia_tambien_se_completa_arrastrandola_a_completada(): void
    {
        $tarea = $this->crearTarea([['descripcion' => 'Único criterio obligatorio']], $this->independiente);

        $this->como($this->independiente)->putJson("/api/actualizarEstadoTarea/{$tarea}", ['estado' => 'Completada'])
            ->assertOk()->assertJsonPath('auto_aceptada', true);

        $this->assertSame('Completada', $this->estadoTarea($tarea));
    }

    public function test_con_independencia_un_criterio_sin_su_evidencia_la_deja_en_revision(): void
    {
        $tarea = $this->crearTarea([['descripcion' => 'Adjuntar el acta firmada', 'requiere_evidencia' => true]], $this->independiente);

        $r = $this->como($this->independiente)->putJson("/api/actualizarEstadoTarea/{$tarea}", ['estado' => 'En Revisión'])
            ->assertOk()->assertJsonPath('auto_aceptada', false)->assertJsonPath('estado_final', 'En Revisión');

        $this->assertStringContainsString('exige evidencia', $r->json('bloqueos.0'));
        $this->assertSame('En Revisión', $this->estadoTarea($tarea));
    }

    public function test_sin_independencia_la_tarea_sigue_esperando_revision(): void
    {
        $tarea = $this->crearTarea([['descripcion' => 'Único criterio obligatorio']], $this->colaborador);

        $this->como($this->colaborador)->putJson("/api/actualizarEstadoTarea/{$tarea}", ['estado' => 'En Revisión'])->assertOk();
        $this->assertSame('En Revisión', $this->estadoTarea($tarea));

        // Ni arrastrándola a Completada.
        $otra = $this->crearTarea([['descripcion' => 'Único criterio obligatorio']], $this->colaborador);
        $this->como($this->colaborador)->putJson("/api/actualizarEstadoTarea/{$otra}", ['estado' => 'Completada'])->assertStatus(409);
    }

    public function test_el_lider_de_un_independiente_no_cierra_su_tarea_al_moverla(): void
    {
        // La aceptación automática es del responsable, no de quien la mueve.
        $tarea = $this->crearTarea([['descripcion' => 'Único criterio obligatorio']], $this->independiente);

        $this->como($this->lider)->putJson("/api/actualizarEstadoTarea/{$tarea}", ['estado' => 'En Revisión'])->assertOk();
        $this->assertSame('En Revisión', $this->estadoTarea($tarea));
    }

    public function test_el_responsable_de_verificacion_verifica_su_criterio_pero_no_acepta(): void
    {
        $tarea = $this->crearTarea([
            ['descripcion' => 'Lo verifica Víctor', 'responsable_verificacion' => null],
            ['descripcion' => 'Lo verifica el líder'],
        ]);
        [$c1, $c2] = $this->criterios($tarea);
        DB::connection('mysql2')->table('tarea_criterios')->where('id', $c1)->update(['responsable_verificacion' => $this->verificador]);

        $this->enviarARevision($tarea);

        $this->como($this->verificador)->getJson("/api/tareas/{$tarea}/criterios")->assertOk();
        $this->como($this->verificador)->putJson("/api/criterios/{$c1}/verificar", ['estado' => 'Cumplido'])->assertOk();
        $this->como($this->verificador)->putJson("/api/criterios/{$c2}/verificar", ['estado' => 'Cumplido'])->assertStatus(403);
        $this->como($this->verificador)->putJson("/api/tareas/{$tarea}/aceptar")->assertStatus(403);
    }

    // ─── Independencia de indicadores ───────────────────────────────────────

    public function test_completar_el_checklist_no_toca_los_criterios_ni_acepta(): void
    {
        $tarea = $this->crearTarea();

        DB::connection('mysql2')->table('subtareas')->insert([
            ['tarea_id' => $tarea, 'titulo' => 'Diseñar la interfaz', 'completada' => 1, 'orden' => 1],
            ['tarea_id' => $tarea, 'titulo' => 'Crear las migraciones', 'completada' => 1, 'orden' => 2],
        ]);

        $resumen = $this->como($this->lider)->getJson("/api/tareas/{$tarea}/criterios")->json('resumen');

        $this->assertSame(0, $resumen['cumplidos']);
        $this->assertSame(0, $resumen['porcentaje']);
        $this->assertSame('Pendiente', $this->estadoTarea($tarea));
    }

    public function test_los_criterios_no_alteran_el_checklist(): void
    {
        $tarea = $this->crearTarea([['descripcion' => 'Único criterio obligatorio']]);
        DB::connection('mysql2')->table('subtareas')->insert([
            'tarea_id' => $tarea, 'titulo' => 'Realizar pruebas', 'completada' => 0, 'orden' => 1,
        ]);
        [$c] = $this->criterios($tarea);

        $this->enviarARevision($tarea);
        $this->como($this->lider)->putJson("/api/criterios/{$c}/verificar", ['estado' => 'Cumplido'])->assertOk();

        $this->assertSame(0, (int) DB::connection('mysql2')->table('subtareas')->where('tarea_id', $tarea)->value('completada'));
    }

    public function test_la_regla_de_bloqueo_ignora_los_opcionales(): void
    {
        $regla = new CriteriosAceptacionController();
        $c = fn ($estado, $obligatorio, $evidencia = 0, $evidencias = []) => (object) [
            'descripcion' => 'x', 'estado' => $estado, 'obligatorio' => $obligatorio,
            'requiere_evidencia' => $evidencia, 'evidencias' => $evidencias,
        ];

        $this->assertSame([], $regla->bloqueosDeAceptacion([$c('Cumplido', 1), $c('Pendiente', 0)]));
        $this->assertCount(1, $regla->bloqueosDeAceptacion([$c('No cumplido', 1)]));
        $this->assertCount(1, $regla->bloqueosDeAceptacion([$c('Cumplido', 1, 1, [])]));
        $this->assertSame([], $regla->bloqueosDeAceptacion([$c('Cumplido', 1, 1, [['id' => 1]])]));
    }
}
