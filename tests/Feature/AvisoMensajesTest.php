<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * Aviso de mensajes del chat: a quién se le avisa y de qué.
 */
class AvisoMensajesTest extends TestCase
{
    use DatabaseTransactions;
    use DatosDeEquipo;

    protected $connectionsToTransact = ['mysql2'];

    private int $depto;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararEquipo();

        $this->depto = DB::connection('mysql2')->table('departamentos')->insertGetId(['nombre' => 'Depto de prueba']);
        DB::connection('mysql2')->table('empleados')
            ->whereIn('id', [$this->lider, $this->colaborador])
            ->update(['departamento' => $this->depto]);
    }

    private function directo(int $a, int $b): string
    {
        return 'dir:' . min($a, $b) . '-' . max($a, $b);
    }

    private function escribir(int $quien, string $clave, string $texto = 'Hola, ¿revisaste el informe?'): void
    {
        $this->como($quien)->postJson('/api/equipo/chat/mensajes', ['clave' => $clave, 'mensaje' => $texto])->assertCreated();
    }

    private function avisos(int $quien, int $desde): array
    {
        return $this->como($quien)->getJson('/api/equipo/chat/avisos?desde=' . $desde)->assertOk()->json('mensajes');
    }

    private function inicio(int $quien): int
    {
        $r = $this->como($quien)->getJson('/api/equipo/chat/avisos')->assertOk();
        $this->assertSame([], $r->json('mensajes'), 'La primera consulta sólo fija el punto de partida.');
        return (int) $r->json('ultimo');
    }

    public function test_un_mensaje_directo_avisa_al_destinatario_y_no_al_que_escribe(): void
    {
        $desde = $this->inicio($this->lider);
        $this->escribir($this->colaborador, $this->directo($this->lider, $this->colaborador));

        $avisos = $this->avisos($this->lider, $desde);
        $this->assertCount(1, $avisos);
        $this->assertTrue($avisos[0]['directo']);
        $this->assertSame($this->colaborador, $avisos[0]['empleado']);
        $this->assertSame($this->directo($this->lider, $this->colaborador), $avisos[0]['clave']);

        $this->assertSame([], $this->avisos($this->colaborador, $desde));
    }

    public function test_avisa_aunque_nunca_haya_abierto_esa_conversacion(): void
    {
        // El conteo de no leídos del chat ignora las conversaciones nunca
        // abiertas; el aviso no puede hacerlo, o el primer directo no llegaría.
        $desde = $this->inicio($this->independiente);
        $this->escribir($this->colaborador, $this->directo($this->independiente, $this->colaborador));

        $this->assertCount(1, $this->avisos($this->independiente, $desde));
    }

    public function test_lo_ya_leido_no_se_avisa(): void
    {
        $desde = $this->inicio($this->lider);
        $clave = $this->directo($this->lider, $this->colaborador);
        $this->escribir($this->colaborador, $clave);

        $this->como($this->lider)->getJson('/api/equipo/chat/mensajes?clave=' . urlencode($clave))->assertOk();

        $this->assertSame([], $this->avisos($this->lider, $desde));
    }

    public function test_un_directo_ajeno_no_se_avisa(): void
    {
        $desde = $this->inicio($this->ajeno);
        $this->escribir($this->colaborador, $this->directo($this->lider, $this->colaborador));

        $this->assertSame([], $this->avisos($this->ajeno, $desde));
    }

    public function test_el_canal_avisa_solo_a_su_departamento(): void
    {
        $desde = $this->inicio($this->lider);
        $this->escribir($this->colaborador, 'dep:' . $this->depto, 'Reunión a las 3');

        $avisos = $this->avisos($this->lider, $desde);
        $this->assertCount(1, $avisos);
        $this->assertFalse($avisos[0]['directo']);
        $this->assertSame('Depto de prueba', $avisos[0]['canal']);

        $this->assertSame([], $this->avisos($this->ajeno, $desde));
    }
}
