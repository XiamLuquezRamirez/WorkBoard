<?php

namespace Tests\Feature;

use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * Una tarea en pausa no vence: la pausa la aprueba el líder y al reanudar se
 * fija fecha nueva. El tablero, el plano, la ficha del puesto y el dashboard
 * aplican el mismo criterio.
 */
class PausadasNoVencenTest extends TestCase
{
    use DatabaseTransactions;
    use DatosDeEquipo;

    protected $connectionsToTransact = ['mysql2'];

    private int $vencida;
    private int $pausada;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararEquipo();
        Mail::fake();
        $this->travelTo(Carbon::parse('2026-11-14 10:00', 'America/Bogota'));

        $nueva = fn (array $c) => DB::connection('mysql2')->table('tareas_empleados')->insertGetId(array_merge([
            'empleado' => $this->colaborador, 'titulo' => 'Tarea', 'descripcion' => 'x', 'estado' => 'En Proceso',
            'prioridad' => 'Media', 'estado_reg' => 'Activo', 'fecha_creacion' => '2026-10-01', 'fecha_pactada' => '2026-11-01',
        ], $c));
        $this->vencida = $nueva(['titulo' => 'Vencida']);
        // Pausar marca pausada=1 sin cambiar el estado.
        $this->pausada = $nueva(['titulo' => 'Pausada', 'estado' => 'Pendiente', 'pausada' => 1]);
    }

    public function test_el_tablero_no_las_cuenta_como_vencidas(): void
    {
        $r = $this->como($this->lider)->getJson('/api/tablero/estado')->assertOk()->json();

        $this->assertSame(1, $r['alertas']['vencidas']);
        $this->assertSame(1, $r['alertas']['pausadas']);
    }

    public function test_el_plano_y_la_ficha_del_puesto_tampoco(): void
    {
        $plano = $this->como($this->lider)->getJson('/api/tablero/plano')->assertOk()->json();
        $puesto = collect($plano['zonas'])->flatMap(fn ($z) => $z['puestos'])->firstWhere('id', $this->colaborador);
        $this->assertSame(1, $puesto['conteos']['atrasadas']);

        $ficha = $this->como($this->lider)->getJson("/api/equipo/puesto/{$this->colaborador}")->assertOk()->json();
        $this->assertSame(1, $ficha['resumen']['atrasadas']);
        $this->assertFalse(collect($ficha['tareas'])->firstWhere('id', $this->pausada)['atrasada']);
    }

    public function test_una_reanudada_con_la_marca_puesta_si_vence(): void
    {
        // Llevarla a En Proceso es reanudarla, aunque la marca siga puesta.
        DB::connection('mysql2')->table('tareas_empleados')->where('id', $this->pausada)->update(['estado' => 'En Proceso']);

        $r = $this->como($this->lider)->getJson('/api/tablero/estado')->assertOk()->json();
        $this->assertSame(2, $r['alertas']['vencidas']);

        $ficha = $this->como($this->lider)->getJson("/api/equipo/puesto/{$this->colaborador}")->assertOk()->json();
        $this->assertSame(2, $ficha['resumen']['atrasadas']);
    }

    public function test_el_dashboard_tampoco(): void
    {
        $admin = $this->empleado('Adela', 'Administradora');
        $this->usuario($admin, 'admin@prueba.test', 'No', 'No', 'Administrador');

        $ind = collect($this->como($admin)->getJson('/api/dashboard/cargarEmpleadosTareas?ligero=1')->json())
            ->firstWhere('id', $this->colaborador)['indicadores'];
        $this->assertSame(1, $ind['vencidas']);

        $ids = collect($this->como($admin)->getJson("/api/dashboard/vencidas?empleado={$this->colaborador}")->json('tareas'))->pluck('id');
        $this->assertSame([$this->vencida], $ids->all());
    }
}
