<?php

namespace Tests\Feature\Suite;

use App\Models\User;
use Closure;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * Administración y parámetros: empleados, usuarios, empresas, cargos,
 * funciones, líderes, proyectos, perfil propio y rutas admin/*.
 *
 * La conexión `mysql` (chat corporativo) apunta en pruebas a una base que no
 * existe: los caminos que sincronizan con el chat terminan en 500 después de
 * escribir en mysql2. Donde eso pasa, las pruebas miran el efecto en mysql2 y
 * no el código de respuesta del camino feliz. El login no se ejecuta.
 *
 * Las pruebas marcadas con el grupo «hallazgo» afirman el comportamiento
 * correcto y fallan a propósito mientras el defecto siga en el código.
 */
class AdministracionParametrosTest extends TestCase
{
    use DatabaseTransactions;
    use DatosDeEquipo;

    protected $connectionsToTransact = ['mysql2'];

    private int $admin;
    private int $supervisor;
    private int $empresa;
    private int $depto;
    private int $cargo;

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

        $this->empresa = $this->db()->table('empresas')->insertGetId(['nombre' => 'Empresa de prueba', 'estado' => 'ACTIVO', 'nit' => '900']);
        $this->depto = $this->db()->table('departamentos')->insertGetId(['nombre' => 'Depto de prueba', 'estado' => 'Activo', 'lider_id' => $this->lider]);
        $this->cargo = $this->db()->table('cargos')->insertGetId(['nombre' => 'ANALISTA', 'estado' => 'Activo']);

        // Con empresa, departamento y cargo aparecen en los listados (INNER JOIN).
        $this->db()->table('empleados')
            ->whereIn('id', [$this->lider, $this->colaborador, $this->ajeno, $this->verificador, $this->independiente, $this->admin, $this->supervisor])
            ->update([
                'empresa' => $this->empresa, 'departamento' => $this->depto, 'cargo' => $this->cargo,
                'identificacion' => DB::raw("CONCAT('10', id)"), 'pw_temporal' => 'Temporal123',
                'foto' => 'data:image/png;base64,AAAA',
            ]);
    }

    // ─── Ayudas ──────────────────────────────────────────────────────────────

    private function db()
    {
        return DB::connection('mysql2');
    }

    /**
     * Sustituye el chat corporativo (conexión mysql) por una SQLite en memoria
     * con una copia de cada usuario: los guardados de usuario y perfil son
     * atómicos con el chat y, sin él, no escriben nada.
     */
    private function chatDePrueba(): void
    {
        config(['database.connections.mysql' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
        DB::purge('mysql');
        \Illuminate\Support\Facades\Schema::connection('mysql')->create('users', function (\Illuminate\Database\Schema\Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('email');
            $t->string('password')->nullable();
            $t->string('avatar')->nullable();
            $t->unsignedBigInteger('id_usuario_tarea')->nullable();
        });
        foreach ($this->db()->table('users')->get() as $u) {
            DB::connection('mysql')->table('users')->insert(['name' => $u->name, 'email' => $u->email, 'id_usuario_tarea' => $u->id]);
        }
    }

    private function uid(int $empleado): int
    {
        return (int) $this->db()->table('users')->where('empleado', $empleado)->value('id');
    }

    private function usuarioDe(int $empleado): object
    {
        return $this->db()->table('users')->where('empleado', $empleado)->first();
    }

    private function funcion(int $empleado, string $texto = 'Atender soporte'): int
    {
        return $this->db()->table('funciones_empleado')->insertGetId(['empleado' => $empleado, 'descripcion' => $texto, 'estado' => 'Activo']);
    }

    private function proyecto(string $nombre = 'Proyecto de prueba', string $estado = 'Activo'): int
    {
        return $this->db()->table('proyectos')->insertGetId(['nombre' => $nombre, 'estado' => $estado, 'empresa' => $this->empresa]);
    }

    private function datosEmpleado(array $extra = []): array
    {
        return array_merge([
            'accion' => 'guardar', 'identificacion' => '99887766', 'nombres' => 'Nuevo', 'apellidos' => 'Empleado',
            'email' => 'nuevo@prueba.test', 'departamento' => $this->depto, 'empresa' => $this->empresa,
            'cargo' => $this->cargo, 'telefono' => '3000000000', 'fecha_nacimiento' => '1990-01-01',
            'fecha_ingreso' => '2024-01-01', 'tipo_contrato' => 'Fijo', 'direccion' => 'Calle 1',
            'foto' => null, 'estado' => 'Activo', 'lider' => 'No',
        ], $extra);
    }

    private function datosUsuario(array $extra = []): array
    {
        return array_merge([
            'accion' => 'guardar', 'name' => 'Usuario Nuevo', 'email' => 'usuario.nuevo@prueba.test',
            'password' => 'secreto1', 'password_confirmation' => 'secreto1', 'role' => 'Empleado',
            'empleado' => null, 'estado' => 'Activo', 'foto' => null,
        ], $extra);
    }

    /** Edición de un usuario existente tal como la manda el modal de usuarios. */
    private function edicionUsuario(int $empleado, array $extra = []): array
    {
        $u = $this->usuarioDe($empleado);
        return array_merge([
            'accion' => 'editar', 'id' => $u->id, 'name' => $u->name, 'email' => $u->email,
            'role' => $u->tipo_usuario, 'empleado' => $u->empleado, 'estado' => 'Activo',
            'foto' => null, 'cambiar_password' => false,
        ], $extra);
    }

    private function idsDe($respuesta, string $campo = 'id'): array
    {
        return collect($respuesta->json())->pluck($campo)->map(fn ($i) => (int) $i)->all();
    }

    private function administradoresActivos(): int
    {
        return $this->db()->table('users')->where('tipo_usuario', 'Administrador')->where('estado', 'Activo')->count();
    }

    // ─── Sin sesión ──────────────────────────────────────────────────────────

    public static function rutasProtegidas(): array
    {
        return [
            'user'                      => ['get', '/api/user'],
            'logout'                    => ['post', '/api/logout'],
            'profile/update'            => ['post', '/api/profile/update'],
            'cargarEmpleados'           => ['post', '/api/cargarEmpleados'],
            'buscarEmpleados'           => ['post', '/api/buscarEmpleados'],
            'guardarEmpleados'          => ['post', '/api/guardarEmpleados'],
            'eliminarEmpleado'          => ['delete', '/api/eliminarEmpleado/1'],
            'cargarUsuarios'            => ['get', '/api/cargarUsuarios'],
            'buscarUsuarios'            => ['get', '/api/buscarUsuarios'],
            'listaEmpleados'            => ['get', '/api/listaEmpleados'],
            'guardarUsuario'            => ['post', '/api/guardarUsuario'],
            'eliminarUsuario'           => ['delete', '/api/eliminarUsuario/1'],
            'estado de usuario'         => ['post', '/api/usuarios/1/estado'],
            'cargarEmpresas'            => ['get', '/api/cargarEmpresas'],
            'parametros/cargarEmpresas' => ['get', '/api/parametros/cargarEmpresas'],
            'buscarEmpresas'            => ['get', '/api/buscarEmpresas'],
            'guardarEmpresa'            => ['post', '/api/guardarEmpresa'],
            'eliminarEmpresa'           => ['delete', '/api/eliminarEmpresa/1'],
            'cargarDepartamentos'       => ['get', '/api/parametros/cargarDepartamentos'],
            'independencia'             => ['post', '/api/parametros/usuarios/1/independencia'],
            'cargarCargos'              => ['get', '/api/parametros/cargarCargos'],
            'cargos'                    => ['get', '/api/parametros/cargos'],
            'crearCargo'                => ['post', '/api/parametros/cargos'],
            'actualizarCargo'           => ['put', '/api/parametros/cargos/1'],
            'eliminarCargo'             => ['delete', '/api/parametros/cargos/1'],
            'cargarFunciones'           => ['get', '/api/cargarFunciones/1'],
            'guardarFuncion'            => ['post', '/api/guardarFuncion'],
            'actualizarFuncion'         => ['put', '/api/actualizarFuncion/1'],
            'eliminarFuncion'           => ['delete', '/api/eliminarFuncion/1'],
            'cargarLideres'             => ['get', '/api/cargarLideres'],
            'cargarEmpleadosLider'      => ['get', '/api/cargarEmpleadosLider/1'],
            'guardarAsignacionesLider'  => ['post', '/api/guardarAsignacionesLider'],
            'verificarEmpleadoLider'    => ['get', '/api/verificarEmpleadoLider/1'],
            'cargarProyectos'           => ['get', '/api/cargarProyectos'],
            'guardarProyecto'           => ['post', '/api/guardarProyecto'],
            'proyectos/guardarProyecto' => ['post', '/api/proyectos/guardarProyecto'],
            'eliminarProyecto'          => ['delete', '/api/eliminarProyecto/1'],
            'migrar-fotos'              => ['post', '/api/admin/migrar-fotos'],
            'importar-proyectos'        => ['post', '/api/admin/importar-proyectos'],
        ];
    }

    #[DataProvider('rutasProtegidas')]
    public function test_sin_sesion_las_rutas_de_administracion_responden_401(string $metodo, string $ruta): void
    {
        $this->json($metodo, $ruta)->assertStatus(401);
    }

    // ─── Usuario autenticado ─────────────────────────────────────────────────

    public function test_api_user_devuelve_al_usuario_de_la_sesion_sin_password(): void
    {
        $this->como($this->colaborador)->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.email', 'colaborador@prueba.test')
            ->assertJsonMissingPath('user.password')
            ->assertJsonMissingPath('user.remember_token');
    }

    public function test_un_usuario_desactivado_con_sesion_abierta_no_puede_seguir_operando(): void
    {
        // El login niega la entrada a un inactivo, pero ninguna capa vuelve a
        // mirar el estado: quien ya tenía la sesión abierta sigue trabajando.
        $this->db()->table('users')->where('id', $this->uid($this->colaborador))->update(['estado' => 'Inactivo']);

        $estado = $this->como($this->colaborador)->getJson('/api/cargarProyectos')->status();
        $this->assertContains($estado, [401, 403], "Un usuario inactivo obtuvo {$estado} en vez de 401/403.");
    }

    // ─── Qué puede llamar un empleado común ──────────────────────────────────

    public function test_un_empleado_comun_carga_los_proyectos_activos(): void
    {
        $activo = $this->proyecto('Proyecto vigente');
        $cancelado = $this->proyecto('Proyecto cancelado', 'Cancelado');

        $ids = $this->idsDe($this->como($this->colaborador)->getJson('/api/cargarProyectos')->assertOk());
        $this->assertContains($activo, $ids);
        $this->assertNotContains($cancelado, $ids);

        $todos = $this->idsDe($this->como($this->admin)->getJson('/api/cargarProyectos?incluir_cancelados=1')->assertOk());
        $this->assertContains($cancelado, $todos);
    }

    /**
     * Endpoints del menú de Parámetros que hoy no comprueban el rol: cualquier
     * sesión los usa. Cada caso devuelve [método, ruta, cuerpo].
     */
    public static function operacionesSoloAdministracion(): array
    {
        return [
            'listar usuarios' => [fn ($t) => ['get', '/api/cargarUsuarios', []]],
            'buscar usuarios' => [fn ($t) => ['get', '/api/buscarUsuarios?search=prueba', []]],
            'listar empleados con datos personales' => [fn ($t) => ['post', '/api/cargarEmpleados', []]],
            'buscar empleados' => [fn ($t) => ['post', '/api/buscarEmpleados', ['params' => ['search' => '']]]],
            'listar líderes' => [fn ($t) => ['get', '/api/cargarLideres', []]],
            'ver el equipo de un líder' => [fn ($t) => ['get', "/api/cargarEmpleadosLider/{$t->lider}", []]],
            'crear empleado' => [fn ($t) => ['post', '/api/guardarEmpleados', $t->datosEmpleado()]],
            'eliminar empleado' => [fn ($t) => ['delete', "/api/eliminarEmpleado/{$t->ajeno}", []]],
            'eliminar usuario' => [fn ($t) => ['delete', '/api/eliminarUsuario/' . $t->uid($t->ajeno), []]],
            'crear empresa' => [fn ($t) => ['post', '/api/guardarEmpresa', ['accion' => 'guardar', 'nombre' => 'Empresa pirata', 'direccion' => 'x', 'telefono' => 'x', 'representante' => 'x', 'nit' => '1', 'logo' => null]]],
            'eliminar empresa' => [fn ($t) => ['delete', "/api/eliminarEmpresa/{$t->empresa}", []]],
            'crear cargo' => [fn ($t) => ['post', '/api/parametros/cargos', ['nombre' => 'Cargo pirata']]],
            'editar cargo' => [fn ($t) => ['put', "/api/parametros/cargos/{$t->cargo}", ['nombre' => 'Renombrado']]],
            'eliminar cargo' => [fn ($t) => ['delete', '/api/parametros/cargos/' . $t->db()->table('cargos')->insertGetId(['nombre' => 'SIN USO', 'estado' => 'Activo']), []]],
            'agregar función a otro' => [fn ($t) => ['post', '/api/guardarFuncion', ['empleado' => $t->ajeno, 'funcion' => 'Hacer el café']]],
            'editar función de otro' => [fn ($t) => ['put', '/api/actualizarFuncion/' . $t->funcion($t->ajeno), ['descripcion' => 'Cambiada']]],
            'borrar función de otro' => [fn ($t) => ['delete', '/api/eliminarFuncion/' . $t->funcion($t->ajeno), []]],
            'crear proyecto' => [fn ($t) => ['post', '/api/guardarProyecto', ['accion' => 'guardar', 'nombre' => 'Proyecto pirata']]],
            'crear proyecto (ruta alterna)' => [fn ($t) => ['post', '/api/proyectos/guardarProyecto', ['accion' => 'guardar', 'nombre' => 'Proyecto pirata']]],
            'cancelar proyecto' => [fn ($t) => ['delete', '/api/eliminarProyecto/' . $t->proyecto(), []]],
            'concederse independencia' => [fn ($t) => ['post', '/api/parametros/usuarios/' . $t->uid($t->colaborador) . '/independencia', []]],
            'asignarse un equipo' => [fn ($t) => ['post', '/api/guardarAsignacionesLider', ['lider_id' => $t->colaborador, 'empleados' => [['id' => $t->ajeno]]]]],
            'migrar fotos' => [fn ($t) => ['post', '/api/admin/migrar-fotos', []]],
            'importar proyectos' => [fn ($t) => ['post', '/api/admin/importar-proyectos', []]],
        ];
    }

    #[DataProvider('operacionesSoloAdministracion')]
    public function test_un_empleado_comun_no_usa_la_administracion(Closure $caso): void
    {
        [$metodo, $ruta, $cuerpo] = $caso($this);

        $this->como($this->colaborador)->json($metodo, $ruta, $cuerpo)->assertStatus(403);
    }

    public function test_un_empleado_comun_no_crea_un_usuario_administrador(): void
    {
        $this->como($this->colaborador)->postJson('/api/guardarUsuario', $this->datosUsuario([
            'email' => 'pirata@prueba.test', 'role' => 'Administrador',
        ]));

        // La fila se inserta en mysql2 antes de sincronizar con el chat: en
        // producción la cuenta queda creada con la contraseña elegida.
        $this->assertFalse(
            $this->db()->table('users')->where('email', 'pirata@prueba.test')->exists(),
            'Un empleado común creó un usuario Administrador con guardarUsuario.'
        );
    }

    public function test_un_empleado_comun_no_se_asciende_a_administrador_editando_su_usuario(): void
    {
        $this->como($this->colaborador)->postJson('/api/guardarUsuario',
            $this->edicionUsuario($this->colaborador, ['role' => 'Administrador']));

        $this->assertSame('Empleado', $this->usuarioDe($this->colaborador)->tipo_usuario,
            'Un empleado común se cambió a sí mismo el rol a Administrador.');
    }

    public function test_profile_update_no_cambia_la_contrasena_ni_el_email_de_otro_usuario(): void
    {
        $antes = $this->usuarioDe($this->admin);

        // El id viaja en el cuerpo y se usa tal cual: no se compara con la sesión.
        $this->como($this->colaborador)->postJson('/api/profile/update', [
            'id' => $antes->id, 'name' => 'Cuenta tomada', 'email' => 'pirata@prueba.test',
            'cambiar_password' => true, 'new_password' => 'tomada123', 'foto' => null,
        ]);

        $despues = $this->usuarioDe($this->admin);
        $this->assertSame($antes->email, $despues->email, 'Un empleado cambió el email del administrador.');
        $this->assertSame($antes->password, $despues->password, 'Un empleado cambió la contraseña del administrador.');
    }

    public function test_un_lider_no_se_asigna_empleados_que_no_son_suyos(): void
    {
        $this->como($this->lider)->postJson('/api/guardarAsignacionesLider', [
            'lider_id' => $this->lider,
            'empleados' => [['id' => $this->colaborador], ['id' => $this->independiente], ['id' => $this->ajeno]],
        ]);

        $this->assertFalse(
            $this->db()->table('lideres_empleados')->where('lider', $this->lider)->where('empleado', $this->ajeno)->exists(),
            'Un líder se asignó por su cuenta a una empleada de otro equipo.'
        );
    }

    // ─── Datos sensibles en los listados ─────────────────────────────────────

    public function test_cargar_usuarios_no_expone_hash_de_password_ni_remember_token(): void
    {
        $fila = collect($this->como($this->admin)->getJson('/api/cargarUsuarios')->assertOk()->json())
            ->firstWhere('email', 'colaborador@prueba.test');

        $this->assertNotNull($fila);
        $this->assertArrayNotHasKey('password', $fila, 'cargarUsuarios devuelve el hash de la contraseña.');
        $this->assertArrayNotHasKey('remember_token', $fila);
    }

    public function test_buscar_usuarios_no_expone_hash_de_password(): void
    {
        $fila = collect($this->como($this->admin)->getJson('/api/buscarUsuarios?search=colaborador')->assertOk()->json())
            ->firstWhere('email', 'colaborador@prueba.test');

        $this->assertNotNull($fila);
        $this->assertArrayNotHasKey('password', $fila, 'buscarUsuarios devuelve el hash de la contraseña.');
    }

    public static function listadosDeEmpleados(): array
    {
        return [
            'cargarEmpleados'      => [fn ($t) => ['post', '/api/cargarEmpleados', []]],
            'buscarEmpleados'      => [fn ($t) => ['post', '/api/buscarEmpleados', ['params' => ['search' => 'Carlos']]]],
            'cargarLideres'        => [fn ($t) => ['get', '/api/cargarLideres', []]],
            'cargarEmpleadosLider' => [fn ($t) => ['get', "/api/cargarEmpleadosLider/{$t->lider}", []]],
        ];
    }

    #[DataProvider('listadosDeEmpleados')]
    public function test_los_listados_de_empleados_no_exponen_la_contrasena_temporal(Closure $caso): void
    {
        [$metodo, $ruta, $cuerpo] = $caso($this);
        $filas = $this->como($this->admin)->json($metodo, $ruta, $cuerpo)->assertOk()->json();

        $this->assertNotEmpty($filas);
        foreach ($filas as $fila) {
            $this->assertArrayNotHasKey('pw_temporal', $fila, "{$ruta} devuelve empleados.pw_temporal.");
        }
    }

    // ─── Empleados ───────────────────────────────────────────────────────────

    public function test_cargar_empleados_lista_los_activos_con_empresa_departamento_y_cargo(): void
    {
        $this->db()->table('empleados')->where('id', $this->ajeno)->update(['estado_registro' => 'Eliminado']);

        $filas = collect($this->como($this->admin)->postJson('/api/cargarEmpleados')->assertOk()->json());
        $carlos = $filas->firstWhere('id', $this->colaborador);
        $laura = $filas->firstWhere('id', $this->lider);

        $this->assertNotNull($carlos);
        $this->assertSame('Empresa de prueba', $carlos['nombre_empresa']);
        $this->assertSame('Depto de prueba', $carlos['nombre_departamento']);
        $this->assertSame('ANALISTA', $carlos['nombre_cargo']);
        $this->assertSame('Depto de prueba', $laura['departamentos_liderados']);
        $this->assertNull($filas->firstWhere('id', $this->ajeno), 'Un empleado eliminado no debe listarse.');
    }

    public function test_buscar_empleados_filtra_por_nombre_apellido_o_identificacion(): void
    {
        $porNombre = $this->idsDe($this->como($this->admin)->postJson('/api/buscarEmpleados', ['params' => ['search' => 'Carl']])->assertOk());
        $this->assertSame([$this->colaborador], $porNombre);

        $porApellido = $this->idsDe($this->como($this->admin)->postJson('/api/buscarEmpleados', ['params' => ['search' => 'Independ']]));
        $this->assertSame([$this->independiente], $porApellido);

        $porDocumento = $this->idsDe($this->como($this->admin)->postJson('/api/buscarEmpleados', ['params' => ['search' => '10' . $this->ajeno]]));
        $this->assertContains($this->ajeno, $porDocumento);
    }

    public function test_eliminar_empleado_es_una_baja_logica(): void
    {
        $this->como($this->admin)->deleteJson("/api/eliminarEmpleado/{$this->ajeno}")->assertOk();

        $fila = $this->db()->table('empleados')->where('id', $this->ajeno)->first();
        $this->assertNotNull($fila, 'La fila del empleado se conserva.');
        $this->assertSame('Eliminado', $fila->estado_registro);
        $this->assertNotContains($this->ajeno, $this->idsDe($this->como($this->admin)->getJson('/api/listaEmpleados')));
    }

    public function test_no_se_desmarca_como_lider_a_quien_lidera_un_departamento(): void
    {
        $this->como($this->admin)->postJson('/api/guardarEmpleados', $this->datosEmpleado([
            'accion' => 'editar', 'id' => $this->lider, 'email' => 'lider@prueba.test', 'lider' => 'No',
        ]))->assertStatus(422)->assertJsonFragment(['error' => 'Es líder de Depto de prueba. Quítale ese liderazgo en Departamentos antes de desmarcarlo como líder.']);
    }

    public function test_crear_empleado_con_email_de_otro_usuario_responde_422(): void
    {
        $antes = $this->db()->table('empleados')->count();

        $this->como($this->admin)->postJson('/api/guardarEmpleados', $this->datosEmpleado(['email' => 'colaborador@prueba.test']))
            ->assertStatus(422);
        $this->assertSame($antes, $this->db()->table('empleados')->count());
    }

    public function test_crear_empleado_con_documento_repetido_responde_422(): void
    {
        // No hay ninguna comprobación de identificación repetida en guardarEmpleado.
        $this->como($this->admin)->postJson('/api/guardarEmpleados', $this->datosEmpleado(['identificacion' => '10' . $this->colaborador]))
            ->assertStatus(422);
    }

    public function test_un_error_al_guardar_un_empleado_no_devuelve_el_sql_al_cliente(): void
    {
        // El catch devuelve $e->getMessage(): la consulta completa, con el hash
        // de la contraseña inicial y los datos personales del empleado.
        $r = $this->como($this->admin)->postJson('/api/guardarEmpleados', $this->datosEmpleado(['email' => 'colaborador@prueba.test']));

        $this->assertStringNotContainsString('SQLSTATE', $r->getContent());
        $this->assertStringNotContainsString('$2y$', $r->getContent());
    }

    // ─── Usuarios ────────────────────────────────────────────────────────────

    public function test_lista_empleados_solo_expone_id_y_nombre_de_los_activos(): void
    {
        $this->db()->table('empleados')->where('id', $this->ajeno)->update(['estado_registro' => 'Eliminado']);

        $filas = collect($this->como($this->admin)->getJson('/api/listaEmpleados')->assertOk()->json());
        $carlos = $filas->firstWhere('id', $this->colaborador);

        $this->assertSame(['id', 'nombre'], array_keys($carlos));
        $this->assertSame('Carlos Colaborador', $carlos['nombre']);
        $this->assertNull($filas->firstWhere('id', $this->ajeno));
    }

    public function test_buscar_usuarios_filtra_por_nombre_email_o_empleado(): void
    {
        $emails = collect($this->como($this->admin)->getJson('/api/buscarUsuarios?search=Víctor')->assertOk()->json())->pluck('email')->all();
        $this->assertSame(['verificador@prueba.test'], $emails);

        $porEmail = collect($this->como($this->admin)->getJson('/api/buscarUsuarios?search=supervisor@')->json())->pluck('email')->all();
        $this->assertSame(['supervisor@prueba.test'], $porEmail);
    }

    public function test_guardar_usuario_exige_contrasena_de_seis_caracteres_y_confirmada(): void
    {
        $this->como($this->admin)->postJson('/api/guardarUsuario', $this->datosUsuario(['password' => '123', 'password_confirmation' => '123']))
            ->assertStatus(422)->assertJson(['error' => 'La contraseña debe tener al menos 6 caracteres.']);
        $this->como($this->admin)->postJson('/api/guardarUsuario', $this->datosUsuario(['password_confirmation' => 'otra-cosa']))
            ->assertStatus(422)->assertJson(['error' => 'Las contraseñas no coinciden.']);
        // Al editar con cambio de contraseña rige la misma regla.
        $this->como($this->admin)->postJson('/api/guardarUsuario', $this->edicionUsuario($this->colaborador, [
            'cambiar_password' => 'true', 'password' => 'abc', 'password_confirmation' => 'abc',
        ]))->assertStatus(422);

        $this->assertFalse($this->db()->table('users')->where('email', 'usuario.nuevo@prueba.test')->exists());
        $this->assertSame('x', $this->usuarioDe($this->colaborador)->password);
    }

    public function test_guardar_usuario_con_email_repetido_responde_422(): void
    {
        $this->como($this->admin)->postJson('/api/guardarUsuario', $this->datosUsuario(['email' => 'colaborador@prueba.test']))
            ->assertStatus(422);
    }

    public function test_guardar_usuario_rechaza_un_rol_que_no_existe(): void
    {
        $this->como($this->admin)->postJson('/api/guardarUsuario', $this->datosUsuario(['role' => 'SuperAdmin']));

        $this->assertFalse(
            $this->db()->table('users')->where('email', 'usuario.nuevo@prueba.test')->exists(),
            'Se guardó un usuario con tipo_usuario «SuperAdmin».'
        );
    }

    public function test_eliminar_usuario_lo_inactiva_sin_borrar_la_fila(): void
    {
        $id = $this->uid($this->ajeno);

        $this->como($this->admin)->deleteJson("/api/eliminarUsuario/{$id}")->assertOk();

        $this->assertSame('Inactivo', $this->db()->table('users')->where('id', $id)->value('estado'));
        $this->assertContains($id, $this->idsDe($this->como($this->admin)->getJson('/api/cargarUsuarios')));
    }

    public function test_eliminar_usuario_no_permite_darse_de_baja_a_si_mismo(): void
    {
        // usuarios/{id}/estado ya lo impide; eliminarUsuario es la puerta trasera.
        $propio = $this->uid($this->admin);

        $this->como($this->admin)->deleteJson("/api/eliminarUsuario/{$propio}")->assertStatus(422);
        $this->assertSame('Activo', $this->db()->table('users')->where('id', $propio)->value('estado'));
    }

    public function test_no_se_le_quita_el_rol_al_ultimo_administrador(): void
    {
        $this->assertSame(1, $this->administradoresActivos());

        $this->como($this->admin)->postJson('/api/guardarUsuario', $this->edicionUsuario($this->admin, ['role' => 'Empleado']));

        $this->assertSame(1, $this->administradoresActivos(), 'El sistema se quedó sin ningún Administrador activo.');
    }

    public function test_no_se_da_de_baja_al_ultimo_administrador(): void
    {
        $this->como($this->supervisor)->deleteJson('/api/eliminarUsuario/' . $this->uid($this->admin));

        $this->assertSame(1, $this->administradoresActivos(), 'El sistema se quedó sin ningún Administrador activo.');
    }

    public function test_no_se_desactiva_al_ultimo_administrador(): void
    {
        $this->como($this->supervisor)->postJson('/api/usuarios/' . $this->uid($this->admin) . '/estado', ['estado' => 'Inactivo']);

        $this->assertSame(1, $this->administradoresActivos(), 'El sistema se quedó sin ningún Administrador activo.');
    }

    public function test_cambiar_estado_de_usuario_valida_estado_e_id(): void
    {
        $this->como($this->admin)->postJson('/api/usuarios/' . $this->uid($this->ajeno) . '/estado', ['estado' => 'Borrado'])
            ->assertStatus(422);
        $this->como($this->admin)->postJson('/api/usuarios/' . $this->uid($this->ajeno) . '/estado', [])
            ->assertStatus(422);
        $this->como($this->admin)->postJson('/api/usuarios/999999/estado', ['estado' => 'Inactivo'])
            ->assertNotFound();
        $this->assertSame('Activo', $this->usuarioDe($this->ajeno)->estado);
    }

    public function test_un_supervisor_cambia_el_estado_pero_un_lider_no(): void
    {
        $id = $this->uid($this->ajeno);

        $this->como($this->lider)->postJson("/api/usuarios/{$id}/estado", ['estado' => 'Inactivo'])->assertForbidden();
        $this->como($this->independiente)->postJson("/api/usuarios/{$id}/estado", ['estado' => 'Inactivo'])->assertForbidden();
        $this->assertSame('Activo', $this->usuarioDe($this->ajeno)->estado);

        $this->como($this->supervisor)->postJson("/api/usuarios/{$id}/estado", ['estado' => 'Inactivo'])
            ->assertOk()->assertJson(['estado' => 'Inactivo']);
        $this->assertSame('Inactivo', $this->usuarioDe($this->ajeno)->estado);
    }

    public function test_un_administrador_sin_ficha_de_empleado_gestiona_usuarios(): void
    {
        // En producción hay administradores sin empleado vinculado.
        $this->db()->table('users')->insert([
            'name' => 'Admin sin ficha', 'email' => 'admin.sinficha@prueba.test', 'password' => 'x',
            'tipo_usuario' => 'Administrador', 'empleado' => null, 'lider' => 'No', 'estado' => 'Activo',
        ]);
        $u = new User();
        $u->id = 999001;
        $u->email = 'admin.sinficha@prueba.test';

        $id = $this->uid($this->ajeno);
        $this->actingAs($u, 'sanctum')->postJson("/api/usuarios/{$id}/estado", ['estado' => 'Inactivo'])->assertOk();
        $this->assertSame('Inactivo', $this->usuarioDe($this->ajeno)->estado);
        $this->actingAs($u, 'sanctum')->getJson('/api/cargarUsuarios')->assertOk();
    }

    // ─── Perfil propio ───────────────────────────────────────────────────────

    public function test_profile_update_no_cambia_el_propio_rol_ni_el_liderazgo(): void
    {
        $this->chatDePrueba();
        $this->como($this->colaborador)->postJson('/api/profile/update', [
            'id' => $this->uid($this->colaborador), 'name' => 'Carlos C.', 'email' => 'colaborador@prueba.test',
            'tipo_usuario' => 'Administrador', 'lider' => 'Si', 'independencia' => 'Si', 'estado' => 'Activo', 'foto' => null,
        ]);

        $u = $this->usuarioDe($this->colaborador);
        $this->assertSame('Carlos C.', $u->name, 'El nombre propio sí se actualiza.');
        $this->assertSame('Empleado', $u->tipo_usuario);
        $this->assertSame('No', $u->lider);
        $this->assertSame('No', $u->independencia);
    }

    public function test_profile_update_con_el_email_de_otro_usuario_responde_422(): void
    {
        $this->como($this->colaborador)->postJson('/api/profile/update', [
            'id' => $this->uid($this->colaborador), 'name' => 'Carlos', 'email' => 'admin@prueba.test', 'foto' => null,
        ])->assertStatus(422);
    }

    // ─── Empresas ────────────────────────────────────────────────────────────

    public function test_crear_y_editar_una_empresa(): void
    {
        $datos = ['accion' => 'guardar', 'nombre' => 'Zeta SAS', 'direccion' => 'Cra 1', 'telefono' => '555',
                  'representante' => 'Zoe', 'nit' => '901', 'logo' => null];
        $this->como($this->admin)->postJson('/api/guardarEmpresa', $datos)->assertOk();

        $id = (int) $this->db()->table('empresas')->where('nombre', 'Zeta SAS')->value('id');
        $this->assertSame('ACTIVO', $this->db()->table('empresas')->where('id', $id)->value('estado'));
        $this->assertContains($id, $this->idsDe($this->como($this->admin)->getJson('/api/cargarEmpresas')));
        $this->assertContains($id, $this->idsDe($this->como($this->admin)->getJson('/api/parametros/cargarEmpresas')));

        $this->como($this->admin)->postJson('/api/guardarEmpresa', array_merge($datos, ['accion' => 'editar', 'id' => $id, 'nombre' => 'Zeta Renombrada']))
            ->assertOk();
        $this->assertSame('Zeta Renombrada', $this->db()->table('empresas')->where('id', $id)->value('nombre'));
        $this->assertSame('ACTIVO', $this->db()->table('empresas')->where('id', $id)->value('estado'));
    }

    public function test_eliminar_una_empresa_la_saca_de_las_listas(): void
    {
        $this->como($this->admin)->deleteJson("/api/eliminarEmpresa/{$this->empresa}")->assertOk();

        $this->assertSame('ELIMINADO', $this->db()->table('empresas')->where('id', $this->empresa)->value('estado'));
        $this->assertNotContains($this->empresa, $this->idsDe($this->como($this->admin)->getJson('/api/cargarEmpresas')));
        $this->assertNotContains($this->empresa, $this->idsDe($this->como($this->admin)->getJson('/api/buscarEmpresas?search=prueba')));
    }

    public function test_eliminar_una_empresa_en_uso_conserva_el_vinculo_de_sus_empleados(): void
    {
        $this->como($this->admin)->deleteJson("/api/eliminarEmpresa/{$this->empresa}")->assertOk();

        $this->assertSame($this->empresa, (int) $this->db()->table('empleados')->where('id', $this->colaborador)->value('empresa'));
    }

    public function test_buscar_empresas_por_search(): void
    {
        $otra = $this->db()->table('empresas')->insertGetId(['nombre' => 'Zeta SAS', 'estado' => 'ACTIVO']);

        $ids = $this->idsDe($this->como($this->admin)->getJson('/api/buscarEmpresas?search=Zeta')->assertOk());
        $this->assertSame([$otra], $ids);
    }

    public function test_buscar_empresas_filtra_con_el_parametro_que_envia_el_modal(): void
    {
        // CompanyModal.jsx manda { term }, el controlador lee 'search': la
        // búsqueda del modal devuelve siempre todas las empresas.
        $otra = $this->db()->table('empresas')->insertGetId(['nombre' => 'Zeta SAS', 'estado' => 'ACTIVO']);

        $ids = $this->idsDe($this->como($this->admin)->getJson('/api/buscarEmpresas?term=Zeta')->assertOk());
        $this->assertSame([$otra], $ids);
    }

    // ─── Cargos ──────────────────────────────────────────────────────────────

    public function test_crear_un_cargo_lo_guarda_en_mayusculas_y_lo_lista(): void
    {
        $id = (int) $this->como($this->admin)->postJson('/api/parametros/cargos', ['nombre' => '  Disenador grafico '])
            ->assertOk()->json('id');

        $this->assertSame('DISENADOR GRAFICO', $this->db()->table('cargos')->where('id', $id)->value('nombre'));
        $this->assertContains($id, $this->idsDe($this->como($this->admin)->getJson('/api/parametros/cargos')));
        $this->assertContains($id, $this->idsDe($this->como($this->admin)->getJson('/api/parametros/cargarCargos')));

        $analista = collect($this->como($this->admin)->getJson('/api/parametros/cargos')->json())->firstWhere('id', $this->cargo);
        $this->assertSame(7, (int) $analista['total_empleados']);
    }

    public function test_un_cargo_con_tildes_o_enie_se_guarda_bien_en_mayusculas(): void
    {
        // strtoupper no es multibyte: «Diseñador» queda «DISEñADOR».
        $id = (int) $this->como($this->admin)->postJson('/api/parametros/cargos', ['nombre' => 'Diseñador técnico'])
            ->assertOk()->json('id');

        $this->assertSame('DISEÑADOR TÉCNICO', $this->db()->table('cargos')->where('id', $id)->value('nombre'));
    }

    public function test_crear_cargo_valida_nombre_vacio_y_repetido(): void
    {
        $this->como($this->admin)->postJson('/api/parametros/cargos', ['nombre' => '   '])->assertStatus(422);
        $this->como($this->admin)->postJson('/api/parametros/cargos', [])->assertStatus(422);
        $this->como($this->admin)->postJson('/api/parametros/cargos', ['nombre' => 'analista'])
            ->assertStatus(422)->assertJson(['message' => 'Ya existe un cargo con ese nombre']);
        $this->assertSame(1, $this->db()->table('cargos')->whereRaw('LOWER(nombre) = ?', ['analista'])->count());
    }

    public function test_crear_un_cargo_con_el_nombre_de_uno_inactivo_lo_reactiva(): void
    {
        $viejo = $this->db()->table('cargos')->insertGetId(['nombre' => 'MENSAJERO', 'estado' => 'Inactivo']);

        $this->como($this->admin)->postJson('/api/parametros/cargos', ['nombre' => 'Mensajero'])
            ->assertOk()->assertJson(['id' => $viejo, 'message' => 'Cargo reactivado']);
        $this->assertSame('Activo', $this->db()->table('cargos')->where('id', $viejo)->value('estado'));
    }

    public function test_renombrar_un_cargo_al_nombre_de_otro_responde_422(): void
    {
        $otro = $this->db()->table('cargos')->insertGetId(['nombre' => 'CONTADOR', 'estado' => 'Activo']);

        $this->como($this->admin)->putJson("/api/parametros/cargos/{$otro}", ['nombre' => 'Analista'])->assertStatus(422);
        $this->como($this->admin)->putJson("/api/parametros/cargos/{$otro}", ['nombre' => ''])->assertStatus(422);
        $this->como($this->admin)->putJson("/api/parametros/cargos/{$otro}", ['nombre' => 'Contador general'])->assertOk();
        $this->assertSame('CONTADOR GENERAL', $this->db()->table('cargos')->where('id', $otro)->value('nombre'));
    }

    public function test_no_se_elimina_un_cargo_con_empleados_activos(): void
    {
        $this->como($this->admin)->deleteJson("/api/parametros/cargos/{$this->cargo}")->assertStatus(422);
        $this->assertSame('Activo', $this->db()->table('cargos')->where('id', $this->cargo)->value('estado'));
    }

    public function test_eliminar_un_cargo_sin_empleados_activos_lo_inactiva_y_lo_saca_de_la_lista(): void
    {
        // Un empleado dado de baja no bloquea la eliminación.
        $cargo = $this->db()->table('cargos')->insertGetId(['nombre' => 'ARCHIVISTA', 'estado' => 'Activo']);
        $this->db()->table('empleados')->where('id', $this->ajeno)->update(['cargo' => $cargo, 'estado_registro' => 'Eliminado']);

        $this->como($this->admin)->deleteJson("/api/parametros/cargos/{$cargo}")->assertOk();

        $this->assertSame('Inactivo', $this->db()->table('cargos')->where('id', $cargo)->value('estado'));
        $this->assertNotContains($cargo, $this->idsDe($this->como($this->admin)->getJson('/api/parametros/cargos')));
    }

    public function test_inactivar_un_cargo_editandolo_respeta_la_guarda_de_empleados_activos(): void
    {
        // eliminarCargo lo impide; actualizarCargo con estado=Inactivo no.
        $this->como($this->admin)->putJson("/api/parametros/cargos/{$this->cargo}", ['nombre' => 'ANALISTA', 'estado' => 'Inactivo'])
            ->assertStatus(422);
        $this->assertSame('Activo', $this->db()->table('cargos')->where('id', $this->cargo)->value('estado'));
    }

    // ─── Independencia ───────────────────────────────────────────────────────

    public function test_el_administrador_alterna_la_independencia_de_un_usuario(): void
    {
        $id = $this->uid($this->colaborador);

        $this->como($this->admin)->postJson("/api/parametros/usuarios/{$id}/independencia")->assertOk()->assertJson(['independencia' => 'Si']);
        $this->assertSame('Si', $this->usuarioDe($this->colaborador)->independencia);
        $this->como($this->admin)->postJson("/api/parametros/usuarios/{$id}/independencia")->assertOk()->assertJson(['independencia' => 'No']);
        $this->assertSame('No', $this->usuarioDe($this->colaborador)->independencia);
    }

    // ─── Funciones ───────────────────────────────────────────────────────────

    public function test_ciclo_de_vida_de_una_funcion(): void
    {
        $r = $this->como($this->admin)->postJson('/api/guardarFuncion', ['empleado' => $this->colaborador, 'funcion' => 'Atender soporte'])
            ->assertOk();
        $id = (int) $r->json('funcion.id');
        $this->assertSame('Atender soporte', $r->json('funcion.descripcion'));

        $lista = collect($this->como($this->admin)->getJson("/api/cargarFunciones/{$this->colaborador}")->assertOk()->json());
        $this->assertSame([$id], $lista->pluck('id')->map(fn ($i) => (int) $i)->all());
        $this->assertSame('Carlos', $lista->first()['nombres']);

        $this->como($this->admin)->putJson("/api/actualizarFuncion/{$id}", ['descripcion' => 'Atender soporte nivel 2'])->assertOk();
        $this->assertSame('Atender soporte nivel 2', $this->db()->table('funciones_empleado')->where('id', $id)->value('descripcion'));

        $this->como($this->admin)->deleteJson("/api/eliminarFuncion/{$id}")->assertOk();
        $this->assertSame([], $this->como($this->admin)->getJson("/api/cargarFunciones/{$this->colaborador}")->json());
    }

    public function test_no_se_agregan_funciones_a_un_empleado_inexistente(): void
    {
        $this->como($this->admin)->postJson('/api/guardarFuncion', ['empleado' => 999999, 'funcion' => 'Fantasma'])
            ->assertStatus(422);
        $this->assertFalse($this->db()->table('funciones_empleado')->where('empleado', 999999)->exists());
    }

    // ─── Líderes ─────────────────────────────────────────────────────────────

    public function test_cargar_lideres_lista_a_los_lideres_de_departamento_con_su_equipo(): void
    {
        $filas = collect($this->como($this->admin)->getJson('/api/cargarLideres')->assertOk()->json());

        $this->assertSame([$this->lider], $filas->pluck('id')->map(fn ($i) => (int) $i)->all());
        $this->assertSame(2, (int) $filas->first()['empleados_asignados']);
    }

    public function test_cargar_empleados_lider_trae_solo_su_equipo_activo(): void
    {
        $this->db()->table('empleados')->where('id', $this->independiente)->update(['estado_registro' => 'Eliminado']);

        $ids = $this->idsDe($this->como($this->admin)->getJson("/api/cargarEmpleadosLider/{$this->lider}")->assertOk());
        $this->assertSame([$this->colaborador], $ids);
    }

    public function test_guardar_asignaciones_reemplaza_el_equipo_del_lider(): void
    {
        $this->como($this->admin)->postJson('/api/guardarAsignacionesLider', [
            'lider_id' => $this->lider, 'empleados' => [['id' => $this->ajeno], ['id' => $this->colaborador]],
        ])->assertOk();

        $equipo = $this->db()->table('lideres_empleados')->where('lider', $this->lider)->pluck('empleado')->map(fn ($i) => (int) $i)->sort()->values()->all();
        $esperado = collect([$this->ajeno, $this->colaborador])->sort()->values()->all();
        $this->assertSame($esperado, $equipo);

        $this->como($this->admin)->getJson("/api/verificarEmpleadoLider/{$this->ajeno}")->assertOk()->assertJson(['existe' => true]);
        $this->como($this->admin)->getJson("/api/verificarEmpleadoLider/{$this->independiente}")->assertOk()->assertJson(['existe' => false]);
    }

    public function test_guardar_asignaciones_con_lista_vacia_deja_al_lider_sin_equipo(): void
    {
        $this->como($this->admin)->postJson('/api/guardarAsignacionesLider', ['lider_id' => $this->lider, 'empleados' => []])->assertOk();

        $this->assertSame(0, $this->db()->table('lideres_empleados')->where('lider', $this->lider)->count());
    }

    public function test_un_lider_no_puede_ser_lider_de_si_mismo(): void
    {
        $this->como($this->admin)->postJson('/api/guardarAsignacionesLider', [
            'lider_id' => $this->lider, 'empleados' => [['id' => $this->lider], ['id' => $this->colaborador]],
        ])->assertStatus(422);

        $this->assertFalse($this->db()->table('lideres_empleados')->where('lider', $this->lider)->where('empleado', $this->lider)->exists());
    }

    public function test_las_asignaciones_rechazan_empleados_inexistentes_o_eliminados(): void
    {
        $this->db()->table('empleados')->where('id', $this->ajeno)->update(['estado_registro' => 'Eliminado']);

        $this->como($this->admin)->postJson('/api/guardarAsignacionesLider', [
            'lider_id' => $this->lider, 'empleados' => [['id' => 999999], ['id' => $this->ajeno]],
        ])->assertStatus(422);

        // Y el equipo anterior no se pierde por una petición rechazada.
        $this->assertSame(2, $this->db()->table('lideres_empleados')->where('lider', $this->lider)->count());
    }

    // ─── Proyectos ───────────────────────────────────────────────────────────

    public function test_crear_y_editar_un_proyecto_por_ambas_rutas(): void
    {
        $this->como($this->admin)->postJson('/api/guardarProyecto', [
            'accion' => 'guardar', 'nombre' => 'Aulas digitales', 'municipio' => 'Riohacha',
            'empresa' => $this->empresa, 'fechaInicio' => '2026-01-01', 'fechaFin' => '2026-12-31',
        ])->assertOk();
        $id = (int) $this->db()->table('proyectos')->where('nombre', 'Aulas digitales')->value('id');
        $this->assertSame('2026-12-31', $this->db()->table('proyectos')->where('id', $id)->value('fecha_fin_estimada'));

        $this->como($this->admin)->postJson('/api/proyectos/guardarProyecto', [
            'accion' => 'editar', 'id' => $id, 'nombre' => 'Aulas digitales fase 2', 'empresa' => $this->empresa,
        ])->assertOk();
        $this->assertSame('Aulas digitales fase 2', $this->db()->table('proyectos')->where('id', $id)->value('nombre'));

        $fila = collect($this->como($this->admin)->getJson('/api/cargarProyectos')->json())->firstWhere('id', $id);
        $this->assertSame('Empresa de prueba', $fila['empresa_nombre']);
    }

    public function test_eliminar_un_proyecto_en_uso_lo_cancela_y_conserva_sus_tareas(): void
    {
        $proyecto = $this->proyecto();
        $tarea = $this->tareaSinCriterios();
        $this->db()->table('tareas_empleados')->where('id', $tarea)->update(['proyecto_id' => $proyecto]);

        $this->como($this->admin)->deleteJson("/api/eliminarProyecto/{$proyecto}")
            ->assertOk()->assertJson(['tareas_conservadas' => 1]);

        $this->assertSame('Cancelado', $this->db()->table('proyectos')->where('id', $proyecto)->value('estado'));
        $this->assertSame($proyecto, (int) $this->campoTarea($tarea, 'proyecto_id'));
    }

    // ─── Ids inexistentes ────────────────────────────────────────────────────

    public static function idsInexistentesQueYaResponden404(): array
    {
        return [
            'eliminarUsuario'  => ['delete', '/api/eliminarUsuario/999999', []],
            'estado'           => ['post', '/api/usuarios/999999/estado', ['estado' => 'Activo']],
            'independencia'    => ['post', '/api/parametros/usuarios/999999/independencia', []],
            'eliminarProyecto' => ['delete', '/api/eliminarProyecto/999999', []],
        ];
    }

    #[DataProvider('idsInexistentesQueYaResponden404')]
    public function test_un_id_inexistente_responde_404(string $metodo, string $ruta, array $cuerpo): void
    {
        $this->como($this->admin)->json($metodo, $ruta, $cuerpo)->assertNotFound();
    }

    public static function idsInexistentesQueResponden200(): array
    {
        return [
            'eliminarEmpleado'  => ['delete', '/api/eliminarEmpleado/999999', []],
            'eliminarEmpresa'   => ['delete', '/api/eliminarEmpresa/999999', []],
            'editar empresa'    => ['post', '/api/guardarEmpresa', ['accion' => 'editar', 'id' => 999999, 'nombre' => 'X', 'direccion' => 'x', 'telefono' => 'x', 'representante' => 'x', 'nit' => '1', 'logo' => null]],
            'actualizarCargo'   => ['put', '/api/parametros/cargos/999999', ['nombre' => 'Fantasma']],
            'eliminarCargo'     => ['delete', '/api/parametros/cargos/999999', []],
            'actualizarFuncion' => ['put', '/api/actualizarFuncion/999999', ['descripcion' => 'x']],
            'eliminarFuncion'   => ['delete', '/api/eliminarFuncion/999999', []],
            'editar proyecto'   => ['post', '/api/guardarProyecto', ['accion' => 'editar', 'id' => 999999, 'nombre' => 'Fantasma']],
        ];
    }

    #[DataProvider('idsInexistentesQueResponden200')]
    public function test_operar_sobre_un_id_inexistente_responde_404_y_no_exito(string $metodo, string $ruta, array $cuerpo): void
    {
        $this->como($this->admin)->json($metodo, $ruta, $cuerpo)->assertNotFound();
    }

    // ─── Datos faltantes ─────────────────────────────────────────────────────

    public static function peticionesIncompletas(): array
    {
        return [
            'guardarEmpleados vacío'          => ['post', '/api/guardarEmpleados', []],
            'guardarEmpleados sin campos'     => ['post', '/api/guardarEmpleados', ['accion' => 'guardar']],
            'guardarUsuario vacío'            => ['post', '/api/guardarUsuario', []],
            'guardarUsuario sin nombre/email' => ['post', '/api/guardarUsuario', ['accion' => 'guardar', 'password' => 'secreto1', 'password_confirmation' => 'secreto1']],
            'guardarEmpresa vacío'            => ['post', '/api/guardarEmpresa', []],
            'guardarFuncion vacío'            => ['post', '/api/guardarFuncion', []],
            'guardarProyecto vacío'           => ['post', '/api/guardarProyecto', []],
            'guardarProyecto sin nombre'      => ['post', '/api/guardarProyecto', ['accion' => 'guardar']],
            'guardarAsignacionesLider vacío'  => ['post', '/api/guardarAsignacionesLider', []],
            'profile/update vacío'            => ['post', '/api/profile/update', []],
        ];
    }

    #[DataProvider('peticionesIncompletas')]
    public function test_una_peticion_incompleta_responde_422_y_no_500(string $metodo, string $ruta, array $cuerpo): void
    {
        $this->como($this->admin)->json($metodo, $ruta, $cuerpo)->assertStatus(422);
    }

    public function test_actualizar_funcion_sin_descripcion_responde_422(): void
    {
        $id = $this->funcion($this->colaborador);

        $this->como($this->admin)->putJson("/api/actualizarFuncion/{$id}", [])->assertStatus(422);
        $this->assertSame('Atender soporte', $this->db()->table('funciones_empleado')->where('id', $id)->value('descripcion'));
    }
}
