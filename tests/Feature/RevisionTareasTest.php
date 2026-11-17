<?php

namespace Tests\Feature;

use App\Mail\AvisoTareaCorreo;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * El paso por «En Revisión»: quién mueve la tarea, por dónde sale, qué fecha
 * de entrega queda y a quién se avisa.
 */
class RevisionTareasTest extends TestCase
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
    }

    private function mover(int $quien, int $tarea, string $estado)
    {
        return $this->como($quien)->putJson("/api/actualizarEstadoTarea/{$tarea}", ['estado' => $estado]);
    }

    private function avisos(int $empleado, string $tipo)
    {
        $usuario = DB::connection('mysql2')->table('users')->where('empleado', $empleado)->value('id');

        return DB::connection('mysql2')->table('notif_generales')
            ->where('id_receptor', $usuario)->where('tipo', $tipo)->get();
    }

    private function hoyOficina(): string
    {
        return Carbon::today('America/Bogota')->toDateString();
    }

    public function test_nadie_ajeno_mueve_una_tarea(): void
    {
        $tarea = $this->tareaSinCriterios('Pendiente');

        $this->mover($this->ajeno, $tarea, 'En Proceso')->assertStatus(403);
        $this->assertSame('Pendiente', $this->estadoTarea($tarea));
    }

    public function test_sin_criterios_tampoco_se_cierra_moviendola(): void
    {
        $tarea = $this->tareaSinCriterios('En Proceso');

        $this->mover($this->colaborador, $tarea, 'Completada')
            ->assertStatus(409)->assertJson(['requiere_verificacion' => true]);
        $this->mover($this->lider, $tarea, 'Completada')->assertStatus(409);
        $this->assertSame('En Proceso', $this->estadoTarea($tarea));
    }

    public function test_enviar_a_revision_fija_la_entrega_y_avisa_a_todos_sus_lideres(): void
    {
        // Carlos tiene dos líderes: los dos deben enterarse.
        DB::connection('mysql2')->table('lideres_empleados')->insert(['lider' => $this->verificador, 'empleado' => $this->colaborador]);
        $tarea = $this->tareaSinCriterios('En Proceso');

        $this->mover($this->colaborador, $tarea, 'En Revisión')->assertOk();

        $this->assertSame($this->hoyOficina(), $this->campoTarea($tarea, 'fecha_entregada'));
        $this->assertCount(1, $this->avisos($this->lider, 'Revision'));
        $this->assertCount(1, $this->avisos($this->verificador, 'Revision'));
        Mail::assertSent(AvisoTareaCorreo::class, fn ($m) => $m->hasTo('lider@prueba.test') && $m->tipo === 'revision');
        Mail::assertSent(AvisoTareaCorreo::class, fn ($m) => $m->hasTo('verificador@prueba.test') && $m->tipo === 'revision');

        // El aviso de siempre («actualizó el estado») no se duplica.
        $this->assertCount(0, $this->avisos($this->lider, 'Estado'));
    }

    public function test_la_tarea_de_un_independiente_se_cierra_sin_avisar_a_nadie(): void
    {
        $tarea = $this->tareaSinCriterios('En Proceso', $this->independiente);

        $this->mover($this->independiente, $tarea, 'En Revisión')->assertOk()->assertJsonPath('auto_aceptada', true);

        $this->assertSame('Completada', $this->estadoTarea($tarea));
        $this->assertCount(0, $this->avisos($this->lider, 'Revision'));
    }

    public function test_la_tarea_de_un_lider_avisa_a_su_propio_lider(): void
    {
        // Inés es líder (lider = Si) y la lidera Laura. Antes su envío a
        // revisión no le llegaba a nadie. Sin independencia: con ella, su
        // tarea se acepta sola y no hay revisión que avisar.
        \Illuminate\Support\Facades\DB::connection('mysql2')->table('users')
            ->where('empleado', $this->independiente)->update(['independencia' => 'No']);
        $tarea = $this->tareaSinCriterios('En Proceso', $this->independiente);

        $this->mover($this->independiente, $tarea, 'En Revisión')->assertOk();

        $this->assertCount(1, $this->avisos($this->lider, 'Revision'));
    }

    public function test_en_revision_el_responsable_no_puede_retirarla(): void
    {
        $tarea = $this->tareaSinCriterios('En Proceso');
        $this->mover($this->colaborador, $tarea, 'En Revisión')->assertOk();

        foreach (['En Proceso', 'Pendiente'] as $estado) {
            $this->mover($this->colaborador, $tarea, $estado)->assertStatus(409)->assertJson(['en_revision' => true]);
        }
        // Tampoco el líder la saca moviéndola: la acepta o la devuelve.
        $this->mover($this->lider, $tarea, 'En Proceso')->assertStatus(409);
        $this->assertSame('En Revisión', $this->estadoTarea($tarea));
    }

    public function test_devolver_borra_la_entrega_y_avisa_con_la_observacion(): void
    {
        $tarea = $this->tareaSinCriterios('En Proceso');
        $this->mover($this->colaborador, $tarea, 'En Revisión')->assertOk();

        $this->como($this->lider)
            ->putJson("/api/tareas/{$tarea}/devolver", ['observacion' => 'Falta el anexo de costos'])
            ->assertOk();

        $this->assertSame('En Proceso', $this->estadoTarea($tarea));
        $this->assertNull($this->campoTarea($tarea, 'fecha_entregada'));

        $aviso = $this->avisos($this->colaborador, 'Devuelta');
        $this->assertCount(1, $aviso);
        $this->assertStringContainsString('Falta el anexo de costos', $aviso[0]->mensaje);
        $this->assertStringNotContainsString('rechaz', $aviso[0]->mensaje);
        Mail::assertSent(AvisoTareaCorreo::class, fn ($m) => $m->hasTo('colaborador@prueba.test') && $m->tipo === 'devuelta');
    }

    public function test_aceptar_conserva_la_fecha_del_envio(): void
    {
        $tarea = $this->tareaSinCriterios('En Proceso');
        $this->mover($this->colaborador, $tarea, 'En Revisión')->assertOk();
        // El líder revisa días después: la entrega sigue siendo la del envío.
        DB::connection('mysql2')->table('tareas_empleados')->where('id', $tarea)->update(['fecha_entregada' => '2026-11-02']);

        $this->como($this->lider)->putJson("/api/tareas/{$tarea}/aceptar")->assertOk();

        $this->assertSame('Completada', $this->estadoTarea($tarea));
        $this->assertSame('2026-11-02', $this->campoTarea($tarea, 'fecha_entregada'));
        $this->assertCount(1, $this->avisos($this->colaborador, 'Aceptada'));
        Mail::assertSent(AvisoTareaCorreo::class, fn ($m) => $m->hasTo('colaborador@prueba.test') && $m->tipo === 'aceptada');
    }

    public function test_solo_el_lider_reabre_una_tarea_cerrada(): void
    {
        $tarea = $this->tareaSinCriterios('Completada');
        DB::connection('mysql2')->table('tareas_empleados')->where('id', $tarea)->update(['fecha_entregada' => '2026-11-02']);

        $this->mover($this->colaborador, $tarea, 'En Proceso')->assertStatus(403);
        $this->assertSame('Completada', $this->estadoTarea($tarea));

        $this->mover($this->lider, $tarea, 'En Proceso')->assertOk();
        $this->assertSame('En Proceso', $this->estadoTarea($tarea));
        $this->assertNull($this->campoTarea($tarea, 'fecha_entregada'));
        $this->assertCount(1, $this->avisos($this->colaborador, 'Reabierta'));
    }

    public function test_editar_no_es_otra_puerta(): void
    {
        $tarea = $this->tareaSinCriterios('En Proceso');
        $base = ['accion' => 'editar', 'id' => $tarea, 'titulo' => 'Tarea heredada', 'descripcion' => 'Sin criterios de aceptación',
                 'fecha_pactada' => now()->addDays(3)->toDateString(), 'empleado' => $this->colaborador, 'prioridad' => 'Media'];

        $this->como($this->lider)->postJson('/api/guardarTarea', $base + ['estado' => 'Completada'])->assertStatus(409);
        $this->como($this->lider)->postJson('/api/guardarTarea', $base + ['estado' => 'En Revisión'])->assertStatus(409);
        $this->assertSame('En Proceso', $this->estadoTarea($tarea));
    }

    public function test_en_revision_no_cuenta_como_atrasada_en_el_plano(): void
    {
        $tarea = $this->tareaSinCriterios('En Proceso');
        DB::connection('mysql2')->table('tareas_empleados')->where('id', $tarea)
            ->update(['fecha_pactada' => now()->subDays(5)->toDateString()]);
        $this->mover($this->colaborador, $tarea, 'En Revisión')->assertOk();

        $puesto = collect($this->como($this->lider)->getJson('/api/tablero/plano')->assertOk()->json('zonas'))
            ->flatMap(fn ($z) => $z['puestos'])
            ->firstWhere('id', $this->colaborador);

        $this->assertSame(0, $puesto['conteos']['atrasadas']);
        $this->assertSame(1, $puesto['conteos']['revision']);
    }
}
