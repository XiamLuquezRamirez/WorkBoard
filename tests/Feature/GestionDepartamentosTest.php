<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * Gestión de departamentos (líder, activar y desactivar) y estado de usuarios.
 *
 * Antes desactivar un departamento lo sacaba de la lista sin forma de
 * reactivarlo, y asignar el líder no cambiaba a quién reportaba el equipo.
 */
class GestionDepartamentosTest extends TestCase
{
    use DatabaseTransactions;
    use DatosDeEquipo;

    protected $connectionsToTransact = ['mysql2'];

    private int $admin;
    private int $depto;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararEquipo();

        $this->admin = $this->empleado('Adela', 'Administradora');
        $this->usuario($this->admin, 'admin@prueba.test', 'No', 'No', 'Administrador');

        $this->depto = DB::connection('mysql2')->table('departamentos')->insertGetId(['nombre' => 'Depto de prueba', 'estado' => null]);
        DB::connection('mysql2')->table('empleados')
            ->whereIn('id', [$this->colaborador, $this->ajeno, $this->verificador])
            ->update(['departamento' => $this->depto]);
    }

    private function idsListados(string $ruta): array
    {
        return collect($this->como($this->admin)->getJson($ruta)->assertOk()->json())
            ->pluck('id')->map(fn ($i) => (int) $i)->all();
    }

    private function db()
    {
        return DB::connection('mysql2');
    }

    // ─── Activar, desactivar y eliminar ─────────────────────────────────────

    public function test_desactivar_lo_deja_en_la_gestion_pero_no_en_las_listas(): void
    {
        $this->como($this->admin)
            ->putJson("/api/parametros/departamentos/{$this->depto}", ['nombre' => 'Depto de prueba', 'estado' => 'Inactivo'])
            ->assertOk();

        $this->assertContains($this->depto, $this->idsListados('/api/parametros/departamentos'));
        $this->assertNotContains($this->depto, $this->idsListados('/api/parametros/cargarDepartamentos'));

        $this->como($this->admin)
            ->putJson("/api/parametros/departamentos/{$this->depto}", ['nombre' => 'Depto de prueba', 'estado' => 'Activo'])
            ->assertOk();
        $this->assertContains($this->depto, $this->idsListados('/api/parametros/cargarDepartamentos'));
    }

    public function test_un_departamento_sin_estado_se_lista_como_activo(): void
    {
        $fila = collect($this->como($this->admin)->getJson('/api/parametros/departamentos')->json())
            ->firstWhere('id', $this->depto);
        $this->assertSame('Activo', $fila['estado']);
    }

    public function test_activar_y_desactivar_no_quita_el_lider(): void
    {
        $this->como($this->admin)->postJson("/api/parametros/departamentos/{$this->depto}/lider", ['lider_id' => $this->lider])->assertOk();

        $this->como($this->admin)
            ->putJson("/api/parametros/departamentos/{$this->depto}", ['nombre' => 'Depto de prueba', 'estado' => 'Inactivo'])
            ->assertOk();

        $this->assertSame($this->lider, (int) $this->db()->table('departamentos')->where('id', $this->depto)->value('lider_id'));
    }

    public function test_eliminar_lo_saca_de_la_gestion(): void
    {
        DB::connection('mysql2')->table('empleados')->where('departamento', $this->depto)->update(['departamento' => null]);

        $this->como($this->admin)->deleteJson("/api/parametros/departamentos/{$this->depto}")->assertOk();

        $this->assertSame('Eliminado', $this->db()->table('departamentos')->where('id', $this->depto)->value('estado'));
        $this->assertNotContains($this->depto, $this->idsListados('/api/parametros/departamentos'));
    }

    // ─── Líder ──────────────────────────────────────────────────────────────

    public function test_asignar_lider_hace_que_el_equipo_le_reporte(): void
    {
        $this->como($this->admin)->postJson("/api/parametros/departamentos/{$this->depto}/lider", ['lider_id' => $this->lider])->assertOk();

        $this->assertSame('Si', $this->db()->table('empleados')->where('id', $this->lider)->value('lider'));
        $this->assertSame('Si', $this->db()->table('users')->where('empleado', $this->lider)->value('lider'));

        $equipo = $this->db()->table('lideres_empleados')->where('lider', $this->lider)
            ->pluck('empleado')->map(fn ($i) => (int) $i)->sort()->values()->all();
        $esperado = collect([$this->colaborador, $this->ajeno, $this->verificador, $this->independiente])->sort()->values()->all();
        $this->assertSame($esperado, $equipo);
    }

    public function test_cambiar_de_lider_traspasa_el_equipo(): void
    {
        $this->como($this->admin)->postJson("/api/parametros/departamentos/{$this->depto}/lider", ['lider_id' => $this->lider])->assertOk();
        $this->como($this->admin)->postJson("/api/parametros/departamentos/{$this->depto}/lider", ['lider_id' => $this->verificador])->assertOk();

        // El anterior ya no lidera ningún departamento: deja de ser líder.
        $this->assertSame('No', $this->db()->table('empleados')->where('id', $this->lider)->value('lider'));
        $this->assertSame(0, $this->db()->table('lideres_empleados')->where('lider', $this->lider)
            ->whereIn('empleado', [$this->colaborador, $this->ajeno])->count());

        // El nuevo recibe al equipo, sin reportarse a sí mismo.
        $this->assertSame(2, $this->db()->table('lideres_empleados')->where('lider', $this->verificador)
            ->whereIn('empleado', [$this->colaborador, $this->ajeno])->count());
        $this->assertFalse($this->db()->table('lideres_empleados')
            ->where('lider', $this->verificador)->where('empleado', $this->verificador)->exists());
    }

    public function test_se_puede_dejar_sin_lider(): void
    {
        $this->como($this->admin)->postJson("/api/parametros/departamentos/{$this->depto}/lider", ['lider_id' => $this->lider])->assertOk();
        $this->como($this->admin)->postJson("/api/parametros/departamentos/{$this->depto}/lider", ['lider_id' => null])->assertOk();

        $this->assertNull($this->db()->table('departamentos')->where('id', $this->depto)->value('lider_id'));
        $this->assertSame('No', $this->db()->table('empleados')->where('id', $this->lider)->value('lider'));
    }

    public function test_el_lider_se_puede_elegir_al_crear_el_departamento(): void
    {
        $id = $this->como($this->admin)
            ->postJson('/api/parametros/departamentos', ['nombre' => 'Otro depto', 'lider_id' => $this->lider])
            ->assertOk()->json('id');

        $this->assertSame($this->lider, (int) $this->db()->table('departamentos')->where('id', $id)->value('lider_id'));
    }

    public function test_un_empleado_inactivo_no_puede_ser_lider(): void
    {
        $this->db()->table('empleados')->where('id', $this->ajeno)->update(['estado' => 'Inactivo']);

        $this->como($this->admin)->postJson("/api/parametros/departamentos/{$this->depto}/lider", ['lider_id' => $this->ajeno])
            ->assertStatus(422);
        $this->assertNull($this->db()->table('departamentos')->where('id', $this->depto)->value('lider_id'));
    }

    public function test_un_empleado_no_gestiona_departamentos(): void
    {
        $this->como($this->colaborador)->postJson("/api/parametros/departamentos/{$this->depto}/lider", ['lider_id' => $this->colaborador])
            ->assertStatus(403);
        $this->como($this->colaborador)
            ->putJson("/api/parametros/departamentos/{$this->depto}", ['nombre' => 'X', 'estado' => 'Inactivo'])
            ->assertStatus(403);
        $this->assertNull($this->db()->table('departamentos')->where('id', $this->depto)->value('lider_id'));
    }

    // ─── Usuarios ───────────────────────────────────────────────────────────

    public function test_desactivar_un_usuario_lo_deja_en_la_lista(): void
    {
        $id = (int) $this->db()->table('users')->where('email', 'ajeno@prueba.test')->value('id');

        $this->como($this->admin)->postJson("/api/usuarios/{$id}/estado", ['estado' => 'Inactivo'])
            ->assertOk()->assertJson(['estado' => 'Inactivo']);

        $this->assertContains($id, $this->idsListados('/api/cargarUsuarios'));

        $this->como($this->admin)->postJson("/api/usuarios/{$id}/estado", ['estado' => 'Activo'])->assertOk();
        $this->assertSame('Activo', $this->db()->table('users')->where('id', $id)->value('estado'));
    }

    public function test_nadie_se_desactiva_a_si_mismo_ni_lo_hace_un_empleado(): void
    {
        $propio = (int) $this->db()->table('users')->where('email', 'admin@prueba.test')->value('id');
        $this->como($this->admin)->postJson("/api/usuarios/{$propio}/estado", ['estado' => 'Inactivo'])->assertStatus(422);

        $otro = (int) $this->db()->table('users')->where('email', 'ajeno@prueba.test')->value('id');
        $this->como($this->colaborador)->postJson("/api/usuarios/{$otro}/estado", ['estado' => 'Inactivo'])->assertStatus(403);

        $this->assertSame(0, $this->db()->table('users')->whereIn('id', [$propio, $otro])->where('estado', 'Inactivo')->count());
    }
}
