<?php

namespace Tests\Feature;

use App\Mail\ConvocatoriaReunionCorreo;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * Reuniones: cualquiera convoca a cualquiera, y el convocado se entera en la
 * campana, por correo y en sus pendientes.
 */
class ReunionesTest extends TestCase
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

    private function datosReunion(array $extra = []): array
    {
        return array_merge([
            'titulo'      => 'Revisión del módulo de solicitudes',
            'descripcion' => 'Repasar los criterios pendientes',
            'fecha'       => now()->addDays(2)->toDateString(),
            'hora_inicio' => '09:00',
            'hora_fin'    => '10:00',
            'lugar'       => 'Sala de juntas',
            'asistentes'  => [$this->ajeno],
        ], $extra);
    }

    private function idUsuario(int $empleado): int
    {
        return (int) DB::connection('mysql2')->table('users')->where('empleado', $empleado)->value('id');
    }

    private function avisosReunion(int $empleado): \Illuminate\Support\Collection
    {
        return DB::connection('mysql2')->table('notif_generales')
            ->where('id_receptor', $this->idUsuario($empleado))
            ->where('tipo', 'Reunion')
            ->get();
    }

    public function test_un_colaborador_ve_a_toda_la_organizacion_para_convocar(): void
    {
        $ids = collect($this->como($this->colaborador)->getJson('/api/equipo/convocables')->assertOk()->json())
            ->pluck('id')->all();

        // Ana no tiene relación con Carlos y aun así se la puede convocar.
        $this->assertContains($this->ajeno, $ids);
        $this->assertContains($this->lider, $ids);
        $this->assertNotContains($this->colaborador, $ids, 'Uno no se convoca a sí mismo.');
    }

    public function test_convocar_avisa_en_la_campana_y_por_correo(): void
    {
        $id = $this->como($this->colaborador)->postJson('/api/equipo/reuniones', $this->datosReunion())
            ->assertCreated()->json('id');

        $respuestas = DB::connection('mysql2')->table('reuniones_asistentes')
            ->where('reunion', $id)->pluck('respuesta', 'empleado');
        $this->assertSame('Pendiente', $respuestas[$this->ajeno]);
        $this->assertSame('Acepta', $respuestas[$this->colaborador]);

        $avisos = $this->avisosReunion($this->ajeno);
        $this->assertCount(1, $avisos);
        $this->assertStringContainsString('Revisión del módulo de solicitudes', $avisos[0]->mensaje);
        $this->assertSame('empleado', $avisos[0]->tipo_receptor);

        Mail::assertSent(ConvocatoriaReunionCorreo::class, fn ($m) => $m->hasTo('ajeno@prueba.test') && $m->tipo === 'convocatoria');
        Mail::assertNotSent(ConvocatoriaReunionCorreo::class, fn ($m) => $m->hasTo('colaborador@prueba.test'));
    }

    public function test_el_convocado_la_ve_como_pendiente(): void
    {
        $this->como($this->colaborador)->postJson('/api/equipo/reuniones', $this->datosReunion())->assertCreated();

        $mias = $this->como($this->ajeno)->getJson('/api/equipo/reuniones')->assertOk()->json('reuniones');
        $this->assertCount(1, $mias);
        $this->assertSame('Pendiente', $mias[0]['mi_respuesta']);
        $this->assertFalse($mias[0]['soy_organizador']);
    }

    public function test_sin_participantes_no_se_crea(): void
    {
        $this->como($this->colaborador)
            ->postJson('/api/equipo/reuniones', $this->datosReunion(['asistentes' => []]))
            ->assertStatus(422)->assertJsonValidationErrors('asistentes');

        // Convocarse sólo a sí mismo tampoco es una reunión.
        $this->como($this->colaborador)
            ->postJson('/api/equipo/reuniones', $this->datosReunion(['asistentes' => [$this->colaborador]]))
            ->assertStatus(422);
    }

    public function test_no_se_convoca_a_quien_esta_inactivo(): void
    {
        DB::connection('mysql2')->table('empleados')->where('id', $this->verificador)->update(['estado' => 'Inactivo']);

        $id = $this->como($this->colaborador)
            ->postJson('/api/equipo/reuniones', $this->datosReunion(['asistentes' => [$this->ajeno, $this->verificador]]))
            ->assertCreated()->json('id');

        $this->assertFalse(DB::connection('mysql2')->table('reuniones_asistentes')
            ->where('reunion', $id)->where('empleado', $this->verificador)->exists());
    }

    public function test_responder_avisa_al_organizador(): void
    {
        $id = $this->como($this->colaborador)->postJson('/api/equipo/reuniones', $this->datosReunion())->json('id');

        $this->como($this->ajeno)->putJson("/api/equipo/reuniones/{$id}/respuesta", ['respuesta' => 'Acepta'])->assertOk();

        $avisos = $this->avisosReunion($this->colaborador);
        $this->assertCount(1, $avisos);
        $this->assertStringContainsString('asistirá', $avisos[0]->mensaje);
    }

    public function test_cancelar_avisa_a_quien_podia_ir(): void
    {
        $id = $this->como($this->colaborador)
            ->postJson('/api/equipo/reuniones', $this->datosReunion(['asistentes' => [$this->ajeno, $this->lider]]))
            ->json('id');
        $this->como($this->lider)->putJson("/api/equipo/reuniones/{$id}/respuesta", ['respuesta' => 'Rechaza'])->assertOk();

        $this->como($this->colaborador)->deleteJson("/api/equipo/reuniones/{$id}")->assertOk();

        Mail::assertSent(ConvocatoriaReunionCorreo::class, fn ($m) => $m->hasTo('ajeno@prueba.test') && $m->tipo === 'cancelacion');
        Mail::assertNotSent(ConvocatoriaReunionCorreo::class, fn ($m) => $m->hasTo('lider@prueba.test') && $m->tipo === 'cancelacion');

        // Ya cancelada, no se puede confirmar asistencia.
        $this->como($this->ajeno)->putJson("/api/equipo/reuniones/{$id}/respuesta", ['respuesta' => 'Acepta'])->assertStatus(409);
    }

    public function test_un_colaborador_ve_el_puesto_de_otro_sin_sus_tareas(): void
    {
        $this->tareaSinCriterios('Pendiente', $this->ajeno);

        $r = $this->como($this->colaborador)->getJson("/api/equipo/puesto/{$this->ajeno}")->assertOk();
        $this->assertFalse($r->json('ver_trabajo'));
        $this->assertSame([], $r->json('tareas'));
        $this->assertNotNull($r->json('chat'), 'Puede escribirle aunque no vea su trabajo.');

        $r = $this->como($this->lider)->getJson("/api/equipo/puesto/{$this->ajeno}")->assertOk();
        $this->assertTrue($r->json('ver_trabajo'));
        $this->assertCount(1, $r->json('tareas'));
    }
}
