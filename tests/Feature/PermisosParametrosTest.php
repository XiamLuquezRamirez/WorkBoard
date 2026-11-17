<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * Parámetros solo para administración, sin datos privados en los listados, y
 * las sesiones de usuarios desactivados se cierran.
 *
 * El detalle de cada ruta cerrada a un empleado común está en
 * Suite\AdministracionParametrosTest; aquí va lo que la acompaña: que
 * administración sigue pudiendo, el límite del Supervisor y lo que un
 * empleado necesita para trabajar.
 */
class PermisosParametrosTest extends TestCase
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
        $this->supervisor = $this->empleado('Sofía', 'Supervisora');
        $this->usuario($this->supervisor, 'supervisor@prueba.test', 'No', 'No', 'Supervisor');
    }

    private function db()
    {
        return DB::connection('mysql2');
    }

    private function uid(int $empleado): int
    {
        return (int) $this->db()->table('users')->where('empleado', $empleado)->value('id');
    }

    public function test_administracion_sigue_usando_parametros(): void
    {
        foreach ([$this->admin, $this->supervisor] as $quien) {
            $this->como($quien)->getJson('/api/cargarUsuarios')->assertOk();
            $this->como($quien)->getJson('/api/listaEmpleados')->assertOk();
            $this->como($quien)->getJson('/api/cargarLideres')->assertOk();
            $this->como($quien)->getJson('/api/parametros/cargos')->assertOk();
            $this->como($quien)->getJson("/api/cargarFunciones/{$this->colaborador}")->assertOk();
        }
    }

    public function test_un_lider_tampoco_entra_a_parametros(): void
    {
        // Ser líder no es administrar: su equipo lo ve en sus propias pantallas.
        $this->como($this->lider)->getJson('/api/cargarUsuarios')->assertStatus(403);
        $this->como($this->lider)->getJson("/api/cargarEmpleadosLider/{$this->lider}")->assertStatus(403);
        $this->como($this->independiente)->postJson("/api/parametros/usuarios/{$this->uid($this->independiente)}/independencia")
            ->assertStatus(403);
    }

    public function test_un_empleado_sigue_cargando_los_proyectos_para_sus_tareas(): void
    {
        $this->como($this->colaborador)->getJson('/api/cargarProyectos')->assertOk();
    }

    public function test_el_mantenimiento_es_solo_del_administrador(): void
    {
        $this->como($this->supervisor)->postJson('/api/admin/migrar-fotos')->assertStatus(403);
        $this->como($this->supervisor)->postJson('/api/admin/importar-proyectos')->assertStatus(403);
    }

    public function test_el_listado_de_usuarios_trae_lo_necesario_sin_lo_privado(): void
    {
        $fila = collect($this->como($this->admin)->getJson('/api/cargarUsuarios')->assertOk()->json())
            ->firstWhere('email', 'colaborador@prueba.test');

        $this->assertSame('Empleado', $fila['tipo_usuario']);
        $this->assertSame('Carlos Colaborador', $fila['nombre_empleado']);
        $this->assertArrayHasKey('estado', $fila);
        $this->assertArrayNotHasKey('password', $fila);
        $this->assertArrayNotHasKey('remember_token', $fila);
    }

    public function test_el_listado_de_empleados_conserva_sus_datos_de_ficha(): void
    {
        $empresa = $this->db()->table('empresas')->insertGetId(['nombre' => 'Empresa Prueba', 'estado' => 'ACTIVO']);
        $depto = $this->db()->table('departamentos')->insertGetId(['nombre' => 'Depto Prueba']);
        $cargo = $this->db()->table('cargos')->insertGetId(['nombre' => 'CARGO PRUEBA', 'estado' => 'Activo']);
        $this->db()->table('empleados')->where('id', $this->colaborador)->update([
            'empresa' => $empresa, 'departamento' => $depto, 'cargo' => $cargo, 'pw_temporal' => 'secreta',
        ]);

        $fila = collect($this->como($this->admin)->postJson('/api/cargarEmpleados')->assertOk()->json())
            ->firstWhere('id', $this->colaborador);

        $this->assertSame('Carlos', $fila['nombres']);
        $this->assertSame('Empresa Prueba', $fila['nombre_empresa']);
        $this->assertSame('CARGO PRUEBA', $fila['nombre_cargo']);
        $this->assertArrayNotHasKey('pw_temporal', $fila);
    }

    public function test_el_supervisor_no_desactiva_ni_da_de_baja_a_un_administrador(): void
    {
        $otro = $this->empleado('Óscar', 'Admin');
        $this->usuario($otro, 'otroadmin@prueba.test', 'No', 'No', 'Administrador');

        $this->como($this->supervisor)->postJson("/api/usuarios/{$this->uid($otro)}/estado", ['estado' => 'Inactivo'])
            ->assertStatus(403);
        $this->como($this->supervisor)->deleteJson("/api/eliminarUsuario/{$this->uid($otro)}")->assertStatus(403);
        $this->assertSame('Activo', $this->db()->table('users')->where('id', $this->uid($otro))->value('estado'));

        // A un empleado sí.
        $this->como($this->supervisor)->postJson("/api/usuarios/{$this->uid($this->colaborador)}/estado", ['estado' => 'Inactivo'])
            ->assertOk();
    }

    public function test_un_administrador_si_da_de_baja_a_otro_administrador(): void
    {
        $otro = $this->empleado('Óscar', 'Admin');
        $this->usuario($otro, 'otroadmin@prueba.test', 'No', 'No', 'Administrador');

        $this->como($this->admin)->deleteJson("/api/eliminarUsuario/{$this->uid($otro)}")->assertOk();
        $this->assertSame('Inactivo', $this->db()->table('users')->where('id', $this->uid($otro))->value('estado'));
    }

    public function test_asignar_el_equipo_de_un_lider_reemplaza_el_anterior(): void
    {
        $this->como($this->admin)->postJson('/api/guardarAsignacionesLider', [
            'lider_id' => $this->lider, 'empleados' => [['id' => $this->ajeno]],
        ])->assertOk();

        $equipo = $this->db()->table('lideres_empleados')->where('lider', $this->lider)->pluck('empleado')->map(fn ($i) => (int) $i)->all();
        $this->assertSame([$this->ajeno], $equipo);

        // Una lista vacía deja al líder sin equipo, a propósito.
        $this->como($this->admin)->postJson('/api/guardarAsignacionesLider', ['lider_id' => $this->lider, 'empleados' => []])->assertOk();
        $this->assertFalse($this->db()->table('lideres_empleados')->where('lider', $this->lider)->exists());
    }

    public function test_un_usuario_desactivado_pierde_la_sesion_en_cualquier_pantalla(): void
    {
        $this->db()->table('users')->where('id', $this->uid($this->colaborador))->update(['estado' => 'Inactivo']);

        $this->como($this->colaborador)->getJson('/api/notificaciones')->assertStatus(401);
        $this->como($this->colaborador)->getJson("/api/cargarTareas/{$this->colaborador}")->assertStatus(401);
        $this->como($this->colaborador)->getJson('/api/tablero/plano')->assertStatus(401);

        // Los demás siguen trabajando.
        $this->como($this->lider)->getJson('/api/tablero/plano')->assertOk();
    }

    public function test_un_administrador_desactivado_tampoco_entra_a_parametros(): void
    {
        $this->db()->table('users')->where('id', $this->uid($this->admin))->update(['estado' => 'Inactivo']);

        $this->como($this->admin)->getJson('/api/cargarUsuarios')->assertStatus(401);
    }
}
