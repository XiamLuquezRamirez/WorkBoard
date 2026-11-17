<?php

namespace Tests\Feature\Suite;

use App\Mail\ResumenTableroCorreo;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * Informes (tareas, eficiencia, proyectos, reprogramaciones), el dashboard de
 * empleados y el resumen diario por correo: quién ve qué y si las cifras cuadran.
 *
 * Equipo del trait: Laura lidera a Carlos y a Inés (independiente); Ana es
 * ajena; Víctor no tiene relación con ellos.
 */
class InformesSuiteTest extends TestCase
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

    // ─── Ayudantes ─────────────────────────────────────────────────────────

    private function db()
    {
        return DB::connection('mysql2');
    }

    /** Inserta una tarea directamente, aprobada y viva salvo que se diga otra cosa. */
    private function tarea(int $empleado, string $titulo, array $campos = []): int
    {
        return $this->db()->table('tareas_empleados')->insertGetId(array_merge([
            'titulo' => $titulo, 'descripcion' => 'Descripción de prueba', 'empleado' => $empleado,
            'estado' => 'Pendiente', 'prioridad' => 'Media', 'estado_reg' => 'Activo',
            'fecha_creacion' => now()->toDateString(), 'fecha_pactada' => now()->addDays(3)->toDateString(),
            'pausada' => 0, 'editable' => 1, 'aprobada' => 1, 'visto_bueno' => 0, 'rechazada' => 0,
        ], $campos));
    }

    /** Un empleado con usuario de administración o supervisión. */
    private function conRol(string $tipo): int
    {
        $emp = $this->empleado('Rol', $tipo);
        $this->usuario($emp, strtolower($tipo) . '@prueba.test', 'No', 'No', $tipo);

        return $emp;
    }

    /**
     * Sesión de un usuario sin ficha de empleado, como el administrador real
     * del navegador.
     */
    private function sinEmpleado(string $tipo = 'Administrador'): static
    {
        $email = 'sinficha.' . strtolower($tipo) . '@prueba.test';
        $id = $this->db()->table('users')->where('email', $email)->value('id')
            ?? $this->db()->table('users')->insertGetId([
                'name' => "{$tipo} sin ficha", 'email' => $email, 'password' => 'x',
                'tipo_usuario' => $tipo, 'empleado' => null, 'lider' => 'No',
                'independencia' => 'No', 'estado' => 'Activo',
            ]);

        $u = new User();
        $u->id = (int) $id;
        $u->email = $email;

        return $this->actingAs($u, 'sanctum');
    }

    /** Sesión cuyo correo no existe en users. */
    private function fantasma(): static
    {
        $u = new User();
        $u->id = 987654;
        $u->email = 'fantasma@prueba.test';

        return $this->actingAs($u, 'sanctum');
    }

    private function titulos(string $uri, string $campo = 'titulo'): array
    {
        return collect($this->getJson($uri)->assertOk()->json())->pluck($campo)->sort()->values()->all();
    }

    /** Una tarea por persona del equipo, con títulos reconocibles. */
    private function unaTareaPorPersona(): void
    {
        $this->tarea($this->lider, 'T-Laura');
        $this->tarea($this->colaborador, 'T-Carlos');
        $this->tarea($this->independiente, 'T-Ines');
        $this->tarea($this->ajeno, 'T-Ana');
        $this->tarea($this->verificador, 'T-Victor');
    }

    // ─── Sin sesión ───────────────────────────────────────────────────────

    public static function rutasProtegidas(): array
    {
        return [
            'informes/tareas'          => ['get', '/api/informes/tareas'],
            'informes/eficiencia'      => ['get', '/api/informes/eficiencia'],
            'informes/proyectos'       => ['get', '/api/informes/proyectos'],
            'informes/reprogramaciones' => ['get', '/api/informes/reprogramaciones'],
            'dashboard'                => ['get', '/api/dashboard/cargarEmpleadosTareas'],
            'tablero/estado'           => ['get', '/api/tablero/estado'],
            'tablero/avatares'         => ['get', '/api/tablero/avatares'],
            'tablero/agenda'           => ['get', '/api/tablero/agenda'],
            'tablero/plano'            => ['get', '/api/tablero/plano'],
            'tablero/videos GET'       => ['get', '/api/tablero/videos'],
            'tablero/videos POST'      => ['post', '/api/tablero/videos'],
            'tablero/videos DELETE'    => ['delete', '/api/tablero/videos/1'],
            'equipo/actividad'         => ['get', '/api/equipo/actividad'],
            'equipo/puesto'            => ['get', '/api/equipo/puesto/1'],
            'equipo/llamar'            => ['post', '/api/equipo/llamar'],
            'equipo/llamada-entrante'  => ['get', '/api/equipo/llamada-entrante'],
            'equipo/llamada GET'       => ['get', '/api/equipo/llamada/1'],
            'equipo/llamada PUT'       => ['put', '/api/equipo/llamada/1'],
            'equipo/chat/canales'      => ['get', '/api/equipo/chat/canales'],
            'equipo/chat/mensajes GET' => ['get', '/api/equipo/chat/mensajes?clave=dep:1'],
            'equipo/chat/mensajes POST' => ['post', '/api/equipo/chat/mensajes'],
            'equipo/reuniones'         => ['get', '/api/equipo/reuniones'],
        ];
    }

    #[DataProvider('rutasProtegidas')]
    public function test_sin_sesion_responde_401(string $metodo, string $uri): void
    {
        $this->json(strtoupper($metodo), $uri)->assertStatus(401);
    }

    // ─── informes/tareas ──────────────────────────────────────────────────

    public function test_informe_de_tareas_el_colaborador_solo_ve_las_suyas(): void
    {
        $this->unaTareaPorPersona();

        $this->assertSame(['T-Carlos'], $this->como($this->colaborador)->titulos('/api/informes/tareas'));
    }

    public function test_informe_de_tareas_el_ajeno_no_ve_al_equipo_de_laura(): void
    {
        $this->unaTareaPorPersona();

        $this->assertSame(['T-Ana'], $this->como($this->ajeno)->titulos('/api/informes/tareas'));
    }

    public function test_informe_de_tareas_el_lider_ve_su_equipo_y_las_suyas(): void
    {
        $this->unaTareaPorPersona();

        $this->assertSame(['T-Carlos', 'T-Ines', 'T-Laura'], $this->como($this->lider)->titulos('/api/informes/tareas'));
    }

    public function test_informe_de_tareas_la_independiente_sin_equipo_solo_ve_las_suyas(): void
    {
        // Inés tiene la marca de líder y de independencia pero nadie le reporta.
        $this->unaTareaPorPersona();

        $this->assertSame(['T-Ines'], $this->como($this->independiente)->titulos('/api/informes/tareas'));
    }

    public function test_informe_de_tareas_administracion_y_supervision_ven_toda_la_organizacion(): void
    {
        $this->unaTareaPorPersona();
        $todas = ['T-Ana', 'T-Carlos', 'T-Ines', 'T-Laura', 'T-Victor'];

        $this->assertSame($todas, $this->como($this->conRol('Administrador'))->titulos('/api/informes/tareas'));
        $this->assertSame($todas, $this->como($this->conRol('Supervisor'))->titulos('/api/informes/tareas'));
    }

    public function test_informe_de_tareas_el_administrador_sin_ficha_de_empleado_ve_todo(): void
    {
        $this->unaTareaPorPersona();

        $this->assertCount(5, $this->sinEmpleado()->getJson('/api/informes/tareas')->assertOk()->json());
        $this->assertCount(5, $this->sinEmpleado('Supervisor')->getJson('/api/informes/tareas')->assertOk()->json());
    }

    public function test_informe_de_tareas_un_correo_sin_usuario_no_ve_nada(): void
    {
        $this->unaTareaPorPersona();

        $this->fantasma()->getJson('/api/informes/tareas')->assertOk()->assertExactJson([]);
    }

    public function test_un_empleado_sin_ficha_que_no_es_administrador_no_ve_nada(): void
    {
        $this->unaTareaPorPersona();

        $this->sinEmpleado('Empleado')->getJson('/api/informes/tareas')->assertOk()->assertExactJson([]);
        $this->sinEmpleado('Empleado')->getJson('/api/informes/eficiencia')->assertOk()->assertExactJson([]);
    }

    public function test_informe_de_tareas_omite_las_eliminadas_y_las_no_aprobadas(): void
    {
        $this->tarea($this->colaborador, 'Viva');
        $this->tarea($this->colaborador, 'Eliminada', ['estado_reg' => 'Eliminado']);
        $this->tarea($this->colaborador, 'Sin aprobar', ['aprobada' => 0]);

        $this->assertSame(['Viva'], $this->como($this->lider)->titulos('/api/informes/tareas'));
    }

    public function test_informe_de_tareas_conserva_el_trabajo_de_quien_ya_salio(): void
    {
        // Carlos se da de baja: su trabajo sigue contando y el nombre sale de users.
        $this->tarea($this->colaborador, 'De Carlos');
        $this->db()->table('empleados')->where('id', $this->colaborador)->update(['estado' => 'Inactivo']);

        $fila = collect($this->como($this->conRol('Administrador'))->getJson('/api/informes/tareas')->assertOk()->json())
            ->firstWhere('titulo', 'De Carlos');

        $this->assertNotNull($fila);
        $this->assertSame('colaborador@prueba.test', $fila['empleado']);
    }

    #[Group('hallazgo')]
    public function test_informe_de_tareas_no_duplica_filas_si_el_empleado_tiene_dos_usuarios(): void
    {
        // Nada impide dos cuentas para la misma ficha (guardarUsuario no lo
        // comprueba). El LEFT JOIN con users multiplica cada tarea por cuenta.
        $this->tarea($this->colaborador, 'Única');
        $this->db()->table('users')->insert([
            'name' => 'Carlos (cuenta nueva)', 'email' => 'carlos.nuevo@prueba.test', 'password' => 'x',
            'tipo_usuario' => 'Empleado', 'empleado' => $this->colaborador, 'lider' => 'No', 'estado' => 'Activo',
        ]);

        $this->assertSame(['Única'], $this->como($this->lider)->titulos('/api/informes/tareas'),
            'Cada tarea debe aparecer una sola vez en el informe.');
        $this->assertCount(1, $this->como($this->lider)->getJson('/api/informes/eficiencia')->json(),
            'La eficiencia se calcula sobre filas duplicadas.');
    }

    // ─── informes/eficiencia ──────────────────────────────────────────────

    public function test_informe_de_eficiencia_respeta_el_alcance(): void
    {
        $this->unaTareaPorPersona();

        $this->assertSame(['T-Carlos'], collect($this->como($this->colaborador)->getJson('/api/informes/eficiencia')->assertOk()->json())
            ->map(fn ($f) => $this->db()->table('tareas_empleados')->where('id', $f['id'])->value('titulo'))->all());

        $nombres = collect($this->como($this->lider)->getJson('/api/informes/eficiencia')->json())->pluck('nombre_empleado')->sort()->values()->all();
        $this->assertSame(['Carlos Colaborador', 'Inés Independiente', 'Laura Líder'], $nombres);

        $this->assertCount(5, $this->sinEmpleado()->getJson('/api/informes/eficiencia')->assertOk()->json());
    }

    public function test_informe_de_eficiencia_entrega_las_fechas_para_medir_a_tiempo_y_con_retraso(): void
    {
        $aTiempo = $this->tarea($this->colaborador, 'A tiempo', ['estado' => 'Completada',
            'fecha_pactada' => '2026-11-10', 'fecha_entregada' => '2026-11-09']);
        $tarde = $this->tarea($this->colaborador, 'Tarde', ['estado' => 'Completada',
            'fecha_pactada' => '2026-11-10', 'fecha_entregada' => '2026-11-12']);
        $this->tarea($this->colaborador, 'Borrada', ['estado' => 'Completada', 'estado_reg' => 'Eliminado',
            'fecha_pactada' => '2026-11-10', 'fecha_entregada' => '2026-11-09']);

        $filas = collect($this->como($this->lider)->getJson('/api/informes/eficiencia')->assertOk()->json())->keyBy('id');

        $this->assertSame([$aTiempo, $tarde], $filas->keys()->sort()->values()->all());
        $this->assertSame('2026-11-09', $filas[$aTiempo]['fecha_entregada']);
        $this->assertSame('2026-11-12', $filas[$tarde]['fecha_entregada']);
        $this->assertSame('Carlos Colaborador', $filas[$tarde]['nombre_empleado']);
    }

    // ─── informes/proyectos ───────────────────────────────────────────────

    public function test_informe_de_proyectos_muestra_el_proyecto_pero_solo_las_tareas_visibles(): void
    {
        $p = $this->db()->table('proyectos')->insertGetId(['nombre' => 'Portal', 'estado' => 'Activo']);
        $this->tarea($this->colaborador, 'Portal-Carlos', ['proyecto_id' => $p]);
        $this->tarea($this->ajeno, 'Portal-Ana', ['proyecto_id' => $p]);
        $this->tarea($this->colaborador, 'Portal-borrada', ['proyecto_id' => $p, 'estado_reg' => 'Eliminado']);

        $proyecto = collect($this->como($this->lider)->getJson('/api/informes/proyectos')->assertOk()->json())->firstWhere('id', $p);
        $this->assertSame(['Portal-Carlos'], collect($proyecto['tareas'])->pluck('titulo')->all());

        // A Víctor no le toca ninguna tarea, pero el proyecto sigue en la lista.
        $proyecto = collect($this->como($this->verificador)->getJson('/api/informes/proyectos')->json())->firstWhere('id', $p);
        $this->assertNotNull($proyecto);
        $this->assertSame([], $proyecto['tareas']);

        $proyecto = collect($this->sinEmpleado()->getJson('/api/informes/proyectos')->json())->firstWhere('id', $p);
        $this->assertSame(['Portal-Ana', 'Portal-Carlos'], collect($proyecto['tareas'])->pluck('titulo')->sort()->values()->all());
    }

    // ─── informes/reprogramaciones ────────────────────────────────────────

    private function reprogramacion(int $tarea, int $solicitante, string $cuando = '2026-11-05 10:00:00'): int
    {
        return $this->db()->table('reprogramaciones_tareas')->insertGetId([
            'tarea_id' => $tarea, 'solicitado_por' => $solicitante,
            'solicitado_por_user' => (int) $this->db()->table('users')->where('empleado', $solicitante)->value('id'),
            'fecha_actual' => '2026-11-10', 'fecha_nueva' => '2026-11-20', 'motivo' => 'Falta información',
            'estado' => 'Pendiente', 'tipo_aprobador' => 'lider', 'fecha_solicitud' => $cuando,
        ]);
    }

    private function idsReprogramaciones(string $query = ''): array
    {
        return collect($this->getJson('/api/informes/reprogramaciones' . $query)->assertOk()->json())
            ->pluck('id')->sort()->values()->all();
    }

    public function test_informe_de_reprogramaciones_respeta_el_alcance(): void
    {
        $deCarlos = $this->reprogramacion($this->tarea($this->colaborador, 'R-Carlos'), $this->colaborador);
        $deAna    = $this->reprogramacion($this->tarea($this->ajeno, 'R-Ana'), $this->ajeno);
        // Ana pide reprogramar una tarea de Carlos: Laura la ve por ser de su equipo.
        $cruzada  = $this->reprogramacion($this->tarea($this->colaborador, 'R-cruzada'), $this->ajeno);

        $this->assertSame([$deCarlos, $cruzada], $this->como($this->lider)->idsReprogramaciones());
        $this->assertSame([$deCarlos, $cruzada], $this->como($this->colaborador)->idsReprogramaciones());
        $this->assertSame([], $this->como($this->verificador)->idsReprogramaciones());
        $this->assertSame([$deCarlos, $deAna, $cruzada], $this->sinEmpleado()->idsReprogramaciones());
    }

    public function test_informe_de_reprogramaciones_filtra_por_rango_de_fechas(): void
    {
        $t = $this->tarea($this->colaborador, 'R');
        $antes   = $this->reprogramacion($t, $this->colaborador, '2026-10-31 23:59:59');
        $primero = $this->reprogramacion($t, $this->colaborador, '2026-11-01 00:00:00');
        $ultimo  = $this->reprogramacion($t, $this->colaborador, '2026-11-30 23:59:59');
        $despues = $this->reprogramacion($t, $this->colaborador, '2026-12-01 00:00:00');

        $this->assertSame([$primero, $ultimo], $this->como($this->lider)->idsReprogramaciones('?inicio=2026-11-01&fin=2026-11-30'));
        $this->assertSame([$primero, $ultimo, $despues], $this->como($this->lider)->idsReprogramaciones('?inicio=2026-11-01'));
        $this->assertSame([$antes, $primero, $ultimo], $this->como($this->lider)->idsReprogramaciones('?fin=2026-11-30'));
    }

    #[Group('hallazgo')]
    public function test_informe_de_reprogramaciones_rechaza_fechas_invalidas_con_422(): void
    {
        $this->reprogramacion($this->tarea($this->colaborador, 'R'), $this->colaborador);

        $this->como($this->lider)->getJson('/api/informes/reprogramaciones?inicio=ayer&fin=2026-13-45')->assertStatus(422);
    }

    public function test_informe_de_reprogramaciones_usa_el_dia_de_bogota_y_no_el_de_utc(): void
    {
        // 21:00 en Bogotá del 12 de noviembre = 02:00 UTC del 13.
        Carbon::setTestNow(Carbon::parse('2026-11-12 21:00:00', 'America/Bogota'));
        $t = $this->tarea($this->colaborador, 'R noche', ['fecha_pactada' => '2026-11-20']);

        // Se envía fecha_actual: sin ella el endpoint da 500 (lo cubre PausasYReprogramacionesTest).
        $this->como($this->colaborador)->postJson('/api/reprogramaciones/solicitar', [
            'tarea_id' => $t, 'fecha_actual' => '2026-11-20', 'fecha_nueva' => '2026-11-25',
            'motivo' => 'Falta información del cliente',
        ])->assertCreated();

        $this->assertCount(1, $this->como($this->lider)->idsReprogramaciones('?inicio=2026-11-12&fin=2026-11-12'),
            'Se pidió el 12 en hora de la oficina; filtrar por el 12 debe encontrarla.');
    }

    #[Group('hallazgo')]
    public function test_informe_de_reprogramaciones_no_pierde_las_de_quien_ya_salio(): void
    {
        // Carlos pidió una reprogramación y después se dio de baja. Su tarea
        // sigue viva y la solicitud forma parte del histórico del equipo.
        $id = $this->reprogramacion($this->tarea($this->colaborador, 'R'), $this->colaborador);
        $this->db()->table('empleados')->where('id', $this->colaborador)->update(['estado' => 'Inactivo']);

        $this->assertContains($id, $this->sinEmpleado()->idsReprogramaciones());
    }

    // ─── dashboard/cargarEmpleadosTareas ──────────────────────────────────

    private function dashboard(): \Illuminate\Support\Collection
    {
        return collect($this->getJson('/api/dashboard/cargarEmpleadosTareas')->assertOk()->json())->keyBy('id');
    }

    public function test_dashboard_cuenta_atrasadas_sin_revision_pausadas_ni_completadas(): void
    {
        $ayer = now()->subDay()->toDateString();
        $this->tarea($this->colaborador, 'Vencida', ['fecha_pactada' => $ayer]);
        $this->tarea($this->colaborador, 'Vencida en proceso', ['fecha_pactada' => $ayer, 'estado' => 'En Proceso']);
        $this->tarea($this->colaborador, 'Entregada', ['fecha_pactada' => $ayer, 'estado' => 'En Revisión', 'fecha_entregada' => $ayer]);
        $this->tarea($this->colaborador, 'Pausada', ['fecha_pactada' => $ayer, 'pausada' => 1]);
        $this->tarea($this->colaborador, 'Cerrada', ['fecha_pactada' => $ayer, 'estado' => 'Completada', 'fecha_entregada' => $ayer]);
        $this->tarea($this->colaborador, 'Futura');
        $this->tarea($this->colaborador, 'Borrada', ['fecha_pactada' => $ayer, 'estado_reg' => 'Eliminado']);

        $carlos = $this->sinEmpleado()->dashboard()[$this->colaborador];

        $this->assertSame(6, $carlos['rendimiento']['tareasAsignadas']);
        $this->assertSame(2, $carlos['rendimiento']['tareas']['atrasadas']);
        $this->assertSame(1, $carlos['rendimiento']['tareas']['completadas']);
        $this->assertSame(1, $carlos['rendimiento']['tareas']['enProceso']);
    }

    public function test_dashboard_eficiencia_operativa_del_mes(): void
    {
        $hoy = now()->toDateString();
        $this->tarea($this->colaborador, 'A tiempo', ['estado' => 'Completada', 'fecha_entregada' => $hoy, 'fecha_pactada' => now()->addDay()->toDateString()]);
        $this->tarea($this->colaborador, 'Con retraso', ['estado' => 'Completada', 'fecha_entregada' => $hoy, 'fecha_pactada' => now()->subDay()->toDateString()]);
        $this->tarea($this->colaborador, 'Abierta');

        $carlos = $this->sinEmpleado()->dashboard()[$this->colaborador];

        $this->assertEquals(50, $carlos['rendimiento']['eficienciaOperativa']);
        // Completadas sobre asignadas: 2 de 3.
        $this->assertEquals(66.67, $carlos['rendimiento']['eficiencia']);
    }

    public function test_dashboard_no_lista_empleados_inactivos(): void
    {
        $this->db()->table('empleados')->where('id', $this->ajeno)->update(['estado' => 'Inactivo']);

        $this->assertArrayNotHasKey($this->ajeno, $this->sinEmpleado()->dashboard()->all());
    }

    public function test_dashboard_un_colaborador_no_ve_las_tareas_ni_los_datos_de_otros_equipos(): void
    {
        // El endpoint no aplica alcance: cualquiera con sesión recibe a toda la
        // organización con tareas, observaciones, evidencias y contacto.
        $this->tarea($this->ajeno, 'Confidencial de Ana');

        $ids = $this->como($this->colaborador)->dashboard()->keys()->sort()->values()->all();

        $this->assertNotContains($this->ajeno, $ids, 'Carlos recibe las tareas de Ana.');
        $this->assertSame([$this->colaborador], $ids);
    }

    public function test_dashboard_un_lider_solo_ve_a_su_equipo(): void
    {
        $ids = $this->como($this->lider)->dashboard()->keys()->sort()->values()->all();

        $this->assertSame(collect([$this->lider, $this->colaborador, $this->independiente])->sort()->values()->all(), $ids);
    }

    public function test_dashboard_las_archivadas_no_cuentan_como_atrasadas(): void
    {
        // El tablero, el plano y el resumen diario descartan las archivadas;
        // el dashboard las sigue sumando como atrasadas.
        $this->tarea($this->colaborador, 'Archivada vencida', ['fecha_pactada' => now()->subDays(10)->toDateString(), 'archivar' => 1]);

        $carlos = $this->sinEmpleado()->dashboard()[$this->colaborador];

        $this->assertSame(0, $carlos['rendimiento']['tareas']['atrasadas']);
    }

    #[Group('hallazgo')]
    public function test_dashboard_la_eficiencia_operativa_ignora_las_tareas_eliminadas(): void
    {
        $hoy = now()->toDateString();
        $this->tarea($this->colaborador, 'Con retraso', ['estado' => 'Completada', 'fecha_entregada' => $hoy, 'fecha_pactada' => now()->subDay()->toDateString()]);
        $this->tarea($this->colaborador, 'Borrada a tiempo', ['estado' => 'Completada', 'estado_reg' => 'Eliminado',
            'fecha_entregada' => $hoy, 'fecha_pactada' => now()->addDay()->toDateString()]);

        $carlos = $this->sinEmpleado()->dashboard()[$this->colaborador];

        // Sólo cuenta la viva, entregada con retraso: 0 %.
        $this->assertEquals(0, $carlos['rendimiento']['eficienciaOperativa']);
    }

    // ─── Resumen diario: workboard:resumen ────────────────────────────────

    private function configurarResumen(array $destinatarios = ['jefe@prueba.test'], string $lider = ''): void
    {
        config([
            'resumen_tablero.destinatarios' => $destinatarios,
            'resumen_tablero.lider' => $lider,
        ]);
    }

    /** Ejecuta el comando y devuelve los datos del único correo enviado. */
    private function resumen(): array
    {
        $this->artisan('workboard:resumen')->assertExitCode(0);
        Mail::assertSentCount(1);

        $datos = null;
        Mail::assertSent(ResumenTableroCorreo::class, function ($m) use (&$datos) {
            $datos = $m->datos;
            return true;
        });

        return $datos;
    }

    public function test_resumen_sin_destinatarios_falla_y_no_envia_nada(): void
    {
        $this->configurarResumen([]);

        $this->artisan('workboard:resumen')->assertExitCode(1);
        Mail::assertNothingSent();
    }

    public function test_resumen_con_lider_inexistente_falla_y_no_envia_nada(): void
    {
        $this->configurarResumen(['jefe@prueba.test'], 'nadie@prueba.test');

        $this->artisan('workboard:resumen')->assertExitCode(1);
        Mail::assertNothingSent();
    }

    public function test_resumen_en_seco_no_envia_correo(): void
    {
        $this->configurarResumen();
        $this->tarea($this->colaborador, 'Algo');

        $this->artisan('workboard:resumen', ['--seco' => true])->assertExitCode(0);
        Mail::assertNothingSent();
    }

    public function test_resumen_llega_a_todos_los_destinatarios_configurados(): void
    {
        $this->configurarResumen(['jefe@prueba.test', 'otra@prueba.test']);

        $this->artisan('workboard:resumen')->assertExitCode(0);

        Mail::assertSent(ResumenTableroCorreo::class, fn ($m) => $m->hasTo('jefe@prueba.test') && $m->hasTo('otra@prueba.test'));
        Mail::assertNotSent(ResumenTableroCorreo::class, fn ($m) => $m->hasTo('lider@prueba.test'));
    }

    public function test_resumen_cuenta_vencidas_sin_revision_cerradas_archivadas_ni_eliminadas(): void
    {
        $this->configurarResumen();
        $ayer = now('America/Bogota')->subDay()->toDateString();
        $this->tarea($this->colaborador, 'Vencida', ['fecha_pactada' => $ayer]);
        $this->tarea($this->colaborador, 'En revisión', ['fecha_pactada' => $ayer, 'estado' => 'En Revisión', 'fecha_entregada' => $ayer]);
        $this->tarea($this->colaborador, 'Cerrada', ['fecha_pactada' => $ayer, 'estado' => 'Completada', 'fecha_entregada' => $ayer]);
        $this->tarea($this->colaborador, 'Archivada', ['fecha_pactada' => $ayer, 'archivar' => 1]);
        $this->tarea($this->colaborador, 'Eliminada', ['fecha_pactada' => $ayer, 'estado_reg' => 'Eliminado']);
        $this->tarea($this->colaborador, 'Sin fecha', ['fecha_pactada' => null]);

        $datos = $this->resumen();

        $this->assertSame(3, $datos['metricas']['abiertas']);
        $this->assertSame(1, $datos['metricas']['vencidas']);
        $this->assertSame(1, $datos['metricas']['por_verificar']);
        $this->assertSame(1, $datos['metricas']['sin_fecha']);
        $this->assertSame('Toda la organización', $datos['alcance']);
    }

    public function test_resumen_no_cuenta_las_pausadas_como_vencidas(): void
    {
        // La pausa la aprueba el líder y al reanudar se fija fecha nueva: el
        // plazo está detenido. Mismo criterio que el tablero y el dashboard.
        $this->configurarResumen();
        $ayer = now('America/Bogota')->subDay()->toDateString();
        $this->tarea($this->colaborador, 'Vencida', ['fecha_pactada' => $ayer]);
        $this->tarea($this->colaborador, 'Pausada', ['fecha_pactada' => $ayer, 'estado' => 'Pendiente', 'pausada' => 1]);

        $datos = $this->resumen();

        $this->assertSame(1, $datos['metricas']['vencidas']);
        $this->assertSame(1, $datos['metricas']['pausadas']);
    }

    public function test_resumen_de_un_lider_solo_cubre_su_equipo(): void
    {
        $this->configurarResumen(['lider@prueba.test'], 'lider@prueba.test');
        $ayer = now('America/Bogota')->subDay()->toDateString();
        $this->tarea($this->colaborador, 'Vencida de Carlos', ['fecha_pactada' => $ayer]);
        $this->tarea($this->ajeno, 'Vencida de Ana', ['fecha_pactada' => $ayer]);
        $this->tarea($this->verificador, 'Vencida de Víctor', ['fecha_pactada' => $ayer]);

        $datos = $this->resumen();

        $this->assertSame(1, $datos['metricas']['vencidas']);
        $this->assertSame(['Vencida de Carlos'], collect($datos['secciones']['vencidas']['filas'])->pluck('titulo')->all());
        $this->assertStringContainsString('3 personas', $datos['alcance']);
    }

    public function test_resumen_cerca_de_medianoche_no_adelanta_el_dia(): void
    {
        // 23:30 en Bogotá ya es el día siguiente en UTC: el correo sigue
        // fechado con el día de la oficina y lo de mañana aún no vence.
        Carbon::setTestNow(Carbon::parse('2026-11-12 23:30:00', 'America/Bogota'));
        \Carbon\CarbonImmutable::setTestNow(\Carbon\CarbonImmutable::parse('2026-11-12 23:30:00', 'America/Bogota'));
        $this->configurarResumen();
        $this->tarea($this->colaborador, 'Para mañana', ['fecha_pactada' => '2026-11-14']);

        $datos = $this->resumen();

        $this->assertSame('2026-11-12', $datos['fecha']);
        $this->assertSame(0, $datos['metricas']['vencidas']);
    }

    public function test_resumen_una_tarea_que_vence_hoy_no_figura_como_vencida(): void
    {
        // A media mañana en Bogotá. fecha() interpreta '2026-11-12' como
        // medianoche UTC y al pasarla a Bogotá cae en el día 11: todo lo que
        // vence hoy sale como «vencida» con un día de retraso, a cualquier hora.
        Carbon::setTestNow(Carbon::parse('2026-11-12 10:00:00', 'America/Bogota'));
        \Carbon\CarbonImmutable::setTestNow(\Carbon\CarbonImmutable::parse('2026-11-12 10:00:00', 'America/Bogota'));
        $this->configurarResumen();
        $this->tarea($this->colaborador, 'Para hoy', ['fecha_pactada' => '2026-11-12']);
        $this->tarea($this->colaborador, 'Para ayer', ['fecha_pactada' => '2026-11-11']);

        $datos = $this->resumen();

        $this->assertSame(1, $datos['metricas']['vencidas'], 'Sólo la de ayer está vencida.');
        $this->assertSame(['Para ayer'], collect($datos['secciones']['vencidas']['filas'])->pluck('titulo')->all());
        $this->assertSame(1, $datos['secciones']['vencidas']['filas'][0]['dias_vencida']);
        $this->assertSame(1, $datos['metricas']['vencen_pronto']);
    }

    public function test_resumen_senala_la_tarea_de_quien_ya_no_tiene_ficha(): void
    {
        $this->configurarResumen();
        $this->tarea($this->colaborador, 'Huérfana');
        $this->db()->table('empleados')->where('id', $this->colaborador)->delete();

        $datos = $this->resumen();

        $this->assertSame(1, $datos['metricas']['ficha_faltante']);
        $this->assertSame(0, $datos['metricas']['sin_responsable']);
    }

    #[Group('hallazgo')]
    public function test_resumen_no_marca_sin_criterio_a_una_tarea_con_criterios_de_aceptacion(): void
    {
        // Las tareas nuevas guardan sus criterios en tarea_criterios; el
        // resumen sigue leyendo el texto único heredado (tareas_empleados.criterio).
        $this->configurarResumen();
        $this->crearTarea();

        $datos = $this->resumen();

        $this->assertSame(1, $datos['metricas']['abiertas']);
        $this->assertSame(0, $datos['metricas']['sin_criterio'],
            'Una tarea con tres criterios pactados figura como «sin criterio» en el correo.');
    }

    #[Group('hallazgo')]
    public function test_resumen_no_cuenta_como_pausada_una_tarea_reanudada(): void
    {
        // La bandera «pausada» no se limpia al reanudar; el tablero ya lo
        // compensa con el estado, el resumen no.
        $this->configurarResumen();
        $this->tarea($this->colaborador, 'Reanudada', ['estado' => 'En Proceso', 'pausada' => 1]);

        $this->assertSame(0, $this->resumen()['metricas']['pausadas']);
    }
}
