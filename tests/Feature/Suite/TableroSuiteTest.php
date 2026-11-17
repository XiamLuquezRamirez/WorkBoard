<?php

namespace Tests\Feature\Suite;

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
 * Tablero de seguimiento: estado (kanban), avatares, agenda, plano de la
 * oficina y vídeos ambientales. Alcance por rol y cifras de cada vista.
 */
class TableroSuiteTest extends TestCase
{
    use DatabaseTransactions;
    use DatosDeEquipo;

    protected $connectionsToTransact = ['mysql2'];

    private const VIDEO = 'dQw4w9WgXcQ';

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

    private function tarea(int $empleado, string $titulo, array $campos = []): int
    {
        return $this->db()->table('tareas_empleados')->insertGetId(array_merge([
            'titulo' => $titulo, 'descripcion' => 'Descripción de prueba', 'empleado' => $empleado,
            'estado' => 'Pendiente', 'prioridad' => 'Media', 'estado_reg' => 'Activo',
            'fecha_creacion' => now()->toDateString(), 'fecha_pactada' => now()->addDays(3)->toDateString(),
            'pausada' => 0, 'editable' => 1, 'aprobada' => 1, 'visto_bueno' => 0, 'rechazada' => 0,
        ], $campos));
    }

    private function conRol(string $tipo): int
    {
        $emp = $this->empleado('Rol', $tipo);
        $this->usuario($emp, strtolower($tipo) . '@prueba.test', 'No', 'No', $tipo);

        return $emp;
    }

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

    private function fantasma(): static
    {
        $u = new User();
        $u->id = 987654;
        $u->email = 'fantasma@prueba.test';

        return $this->actingAs($u, 'sanctum');
    }

    private function estado(string $query = ''): \Illuminate\Testing\TestResponse
    {
        return $this->getJson('/api/tablero/estado' . $query)->assertOk();
    }

    /** Todos los ids de tarea que aparecen en las columnas del tablero. */
    private function idsEnColumnas($r): array
    {
        $c = $r->json('columnas');

        return collect($c['pendiente'])->concat($c['proceso'])->concat($c['revision'])
            ->concat($c['pausa'])->concat($c['completadas']['items'])
            ->pluck('id')->sort()->values()->all();
    }

    private function puesto(int $empleado, $plano): ?array
    {
        return collect($plano->json('zonas'))->flatMap(fn ($z) => $z['puestos'])->firstWhere('id', $empleado);
    }

    private function enOficina(string $momento): void
    {
        Carbon::setTestNow(Carbon::parse($momento, 'America/Bogota'));
    }

    // ─── tablero/estado: alcance ──────────────────────────────────────────

    public function test_tablero_el_colaborador_solo_ve_sus_tarjetas(): void
    {
        $suya = $this->tarea($this->colaborador, 'Suya');
        $this->tarea($this->ajeno, 'De Ana');
        $this->tarea($this->lider, 'De Laura');

        $r = $this->como($this->colaborador)->estado();

        $this->assertSame([$suya], $this->idsEnColumnas($r));
        $this->assertSame('equipo', $r->json('alcance.tipo'));
        $this->assertSame(1, $r->json('alcance.empleados'));
        $this->assertSame([$this->colaborador], collect($r->json('equipo'))->pluck('id')->all());
    }

    public function test_tablero_el_lider_ve_a_su_equipo_y_no_a_otros(): void
    {
        $ids = [
            $this->tarea($this->lider, 'L'),
            $this->tarea($this->colaborador, 'C'),
            $this->tarea($this->independiente, 'I'),
        ];
        $this->tarea($this->ajeno, 'A');
        $this->tarea($this->verificador, 'V');

        $r = $this->como($this->lider)->estado();

        $this->assertSame(collect($ids)->sort()->values()->all(), $this->idsEnColumnas($r));
        $this->assertSame(3, $r->json('alcance.empleados'));
    }

    public function test_tablero_administracion_supervision_y_admin_sin_ficha_ven_todo(): void
    {
        $this->tarea($this->colaborador, 'C');
        $this->tarea($this->ajeno, 'A');

        foreach ([$this->como($this->conRol('Administrador')), $this->como($this->conRol('Supervisor')), $this->sinEmpleado()] as $sesion) {
            $r = $sesion->estado();
            $this->assertSame('global', $r->json('alcance.tipo'));
            $this->assertCount(2, $this->idsEnColumnas($r));
        }

        $this->assertNull($this->sinEmpleado()->estado()->json('alcance.departamento'));
    }

    public function test_tablero_un_correo_sin_usuario_no_ve_nada(): void
    {
        $this->tarea($this->colaborador, 'C');

        $r = $this->fantasma()->estado();

        $this->assertSame([], $this->idsEnColumnas($r));
        $this->assertSame(0, $r->json('kpis.total'));
    }

    // ─── tablero/estado: cifras ───────────────────────────────────────────

    public function test_tablero_reparte_las_tarjetas_por_columna_y_cuenta_kpis(): void
    {
        $p = $this->tarea($this->colaborador, 'Pendiente');
        $e = $this->tarea($this->colaborador, 'En proceso', ['estado' => 'En Proceso']);
        // Reanudada: arrastra la bandera de una pausa anterior pero manda el estado.
        $r2 = $this->tarea($this->colaborador, 'Reanudada', ['estado' => 'En Proceso', 'pausada' => 1]);
        $v = $this->tarea($this->colaborador, 'Entregada', ['estado' => 'En Revisión', 'fecha_entregada' => now()->toDateString()]);
        $z = $this->tarea($this->colaborador, 'Pausada', ['pausada' => 1]);
        $c = $this->tarea($this->colaborador, 'Cerrada', ['estado' => 'Completada', 'fecha_entregada' => now()->subDay()->toDateString()]);
        $this->tarea($this->colaborador, 'Archivada', ['archivar' => 1]);
        $this->tarea($this->colaborador, 'Eliminada', ['estado_reg' => 'Eliminado']);

        $r = $this->como($this->lider)->estado();
        $col = fn ($k) => collect($r->json("columnas.{$k}"))->pluck('id')->sort()->values()->all();

        $this->assertSame([$p], $col('pendiente'));
        $this->assertSame([$e, $r2], $col('proceso'));
        $this->assertSame([$v], $col('revision'));
        $this->assertSame([$z], $col('pausa'));
        $this->assertSame([$c], collect($r->json('columnas.completadas.items'))->pluck('id')->all());
        $this->assertSame('ventana', $r->json('columnas.completadas.modo'));

        $this->assertSame(['total' => 5, 'pendiente' => 1, 'proceso' => 2, 'revision' => 1, 'pausa' => 1,
            'completadas' => 1, 'avance_pct' => 20], $r->json('kpis'));
        $this->assertFalse(collect($r->json('columnas.proceso'))->firstWhere('id', $r2)['pausada']);
    }

    public function test_tablero_alertas_no_cuentan_lo_entregado_como_vencido(): void
    {
        $this->tarea($this->colaborador, 'Vencida', ['fecha_pactada' => now()->subDays(2)->toDateString()]);
        $this->tarea($this->colaborador, 'Entregada tarde', ['estado' => 'En Revisión',
            'fecha_pactada' => now()->subDays(2)->toDateString(), 'fecha_entregada' => now()->toDateString()]);
        $this->tarea($this->colaborador, 'Hoy', ['estado' => 'En Proceso', 'fecha_pactada' => now()->toDateString()]);
        $this->tarea($this->colaborador, 'En una semana', ['fecha_pactada' => now()->addDays(7)->toDateString()]);
        $this->tarea($this->colaborador, 'Lejana', ['fecha_pactada' => now()->addDays(30)->toDateString()]);
        $this->tarea($this->colaborador, 'Bloqueada', ['bloqueada' => 1, 'motivo_bloqueo' => 'Sin acceso']);

        $a = $this->como($this->lider)->estado()->json('alertas');

        $this->assertSame(1, $a['vencidas']);
        // La semana próxima y la bloqueada (en 3 días); la de hoy no es «próxima».
        $this->assertSame(2, $a['proximas']);
        $this->assertSame(1, $a['bloqueadas']);
        // Ninguna nació con criterios de aceptación.
        $this->assertSame(5, $a['sin_criterio']);
    }

    #[Group('hallazgo')]
    public function test_tablero_cuenta_lo_que_vence_hoy(): void
    {
        // Con Carbon 3 diffInDays() devuelve float: «dias_restantes === 0»
        // nunca se cumple y la alerta «vencen hoy» queda siempre en cero.
        $id = $this->tarea($this->colaborador, 'Hoy', ['estado' => 'En Proceso', 'fecha_pactada' => now()->toDateString()]);

        $r = $this->como($this->lider)->estado();

        $this->assertSame(0, collect($r->json('columnas.proceso'))->firstWhere('id', $id)['dias_restantes']);
        $this->assertSame(1, $r->json('alertas.vencen_hoy'));
    }

    public function test_tablero_una_tarea_con_criterios_no_figura_sin_criterio(): void
    {
        $id = $this->crearTarea();

        $tarjeta = collect($this->como($this->lider)->estado()->json('columnas.pendiente'))->firstWhere('id', $id);

        $this->assertFalse($tarjeta['sin_criterio']);
    }

    public function test_tablero_ventana_de_dias_invalida_no_rompe(): void
    {
        $this->tarea($this->colaborador, 'C');

        $this->assertSame(1, $this->como($this->lider)->estado('?dias=abc')->json('alcance.dias_ventana'));
        $this->assertSame(1, $this->como($this->lider)->estado('?dias=-20')->json('alcance.dias_ventana'));
        $this->assertSame(365, $this->como($this->lider)->estado('?dias=99999')->json('alcance.dias_ventana'));
    }

    public function test_tablero_sin_completadas_recientes_muestra_las_ultimas(): void
    {
        $vieja = $this->tarea($this->colaborador, 'Vieja', ['estado' => 'Completada', 'fecha_entregada' => now()->subDays(60)->toDateString()]);

        $r = $this->como($this->lider)->estado('?dias=7');

        $this->assertSame('fallback', $r->json('columnas.completadas.modo'));
        $this->assertSame([$vieja], collect($r->json('columnas.completadas.items'))->pluck('id')->all());
        // Comportamiento actual: en modo «fallback» el KPI de completadas (y el
        // avance) incluye entregas de hace dos meses. Se anota como duda.
        $this->assertSame(1, $r->json('kpis.completadas'));
    }

    public function test_tablero_la_tarea_de_quien_salio_sigue_viva_con_su_nombre_de_usuario(): void
    {
        $id = $this->tarea($this->colaborador, 'Huérfana');
        $this->db()->table('empleados')->where('id', $this->colaborador)->update(['estado' => 'Inactivo']);

        $r = $this->sinEmpleado()->estado();

        $this->assertSame('colaborador@prueba.test', collect($r->json('columnas.pendiente'))->firstWhere('id', $id)['empleado']);
        // Y no figura en la carga del equipo, que es de gente activa.
        $this->assertNotContains($this->colaborador, collect($r->json('equipo'))->pluck('id')->all());
    }

    #[Group('hallazgo')]
    public function test_tablero_a_las_nueve_de_la_noche_lo_de_hoy_aun_no_esta_vencido(): void
    {
        // 21:00 en Bogotá es ya el día siguiente en UTC (zona de la app).
        $this->enOficina('2026-11-12 21:00:00');
        $this->tarea($this->colaborador, 'Para hoy', ['estado' => 'En Proceso', 'fecha_pactada' => '2026-11-12']);

        $a = $this->como($this->lider)->estado()->json('alertas');

        $this->assertSame(0, $a['vencidas'], 'La tarea vence hoy en la oficina y aparece como vencida.');
        $this->assertSame(1, $a['vencen_hoy']);
    }

    // ─── tablero/avatares ─────────────────────────────────────────────────

    private function conFotos(): void
    {
        foreach ([$this->lider, $this->colaborador, $this->independiente, $this->ajeno, $this->verificador] as $e) {
            $this->db()->table('empleados')->where('id', $e)->update(['foto' => "foto-{$e}.jpg"]);
        }
    }

    private function avatares(string $query = ''): array
    {
        return collect($this->getJson('/api/tablero/avatares' . $query)->assertOk()->json())
            ->keys()->map(fn ($k) => (int) $k)->sort()->values()->all();
    }

    public function test_avatares_respetan_el_alcance_salvo_para_el_plano(): void
    {
        $this->conFotos();
        $todos = collect([$this->lider, $this->colaborador, $this->independiente, $this->ajeno, $this->verificador])->sort()->values()->all();

        $this->assertSame([$this->colaborador], $this->como($this->colaborador)->avatares());
        $this->assertSame($todos, $this->como($this->colaborador)->avatares('?plano=1'));
        $this->assertSame(collect([$this->lider, $this->colaborador, $this->independiente])->sort()->values()->all(),
            $this->como($this->lider)->avatares());
        $this->assertSame($todos, $this->sinEmpleado()->avatares());
        $this->assertSame([], $this->fantasma()->avatares());
    }

    public function test_avatares_no_incluyen_inactivos_ni_aun_en_el_plano(): void
    {
        $this->conFotos();
        $this->db()->table('empleados')->where('id', $this->ajeno)->update(['estado' => 'Inactivo']);

        $this->assertNotContains($this->ajeno, $this->como($this->colaborador)->avatares('?plano=1'));
    }

    // ─── tablero/agenda ───────────────────────────────────────────────────

    private function agendaIds($r): array
    {
        return collect($r->json('dias'))->flatMap(fn ($d) => $d['tareas'])->pluck('id')->sort()->values()->all();
    }

    public function test_agenda_respeta_el_alcance(): void
    {
        $c = $this->tarea($this->colaborador, 'C');
        $l = $this->tarea($this->lider, 'L');
        $this->tarea($this->ajeno, 'A');

        $this->assertSame([$c], $this->agendaIds($this->como($this->colaborador)->getJson('/api/tablero/agenda')->assertOk()));
        $this->assertSame(collect([$c, $l])->sort()->values()->all(), $this->agendaIds($this->como($this->lider)->getJson('/api/tablero/agenda')));
        $this->assertCount(3, $this->agendaIds($this->sinEmpleado()->getJson('/api/tablero/agenda')));
        $this->fantasma()->getJson('/api/tablero/agenda')->assertOk()->assertJsonPath('dias', []);
    }

    public function test_agenda_solo_lo_pendiente_de_entregar_y_siempre_el_dia_de_hoy(): void
    {
        $futura = $this->tarea($this->colaborador, 'Futura', ['fecha_pactada' => now()->addDays(4)->toDateString()]);
        $vencida = $this->tarea($this->colaborador, 'Vencida', ['fecha_pactada' => now()->subDays(4)->toDateString()]);
        $revision = $this->tarea($this->colaborador, 'Entregada', ['estado' => 'En Revisión', 'fecha_entregada' => now()->toDateString()]);
        $this->tarea($this->colaborador, 'Cerrada', ['estado' => 'Completada']);
        $this->tarea($this->colaborador, 'Archivada', ['archivar' => 1]);
        $this->tarea($this->colaborador, 'Eliminada', ['estado_reg' => 'Eliminado']);
        $this->tarea($this->colaborador, 'Sin fecha', ['fecha_pactada' => null]);

        $r = $this->como($this->lider)->getJson('/api/tablero/agenda')->assertOk();

        $this->assertSame(collect([$futura, $vencida, $revision])->sort()->values()->all(), $this->agendaIds($r));
        $hoy = collect($r->json('dias'))->firstWhere('es_hoy', true);
        $this->assertNotNull($hoy, 'El día de hoy aparece aunque no tenga entregas.');
        $this->assertSame([], $hoy['tareas']);
        $this->assertSame(collect($r->json('dias'))->pluck('fecha')->sort()->values()->all(), collect($r->json('dias'))->pluck('fecha')->all());
        $this->assertSame(-4, collect($r->json('dias'))->firstWhere('fecha', now()->subDays(4)->toDateString())['dias']);
    }

    #[Group('hallazgo')]
    public function test_agenda_a_las_nueve_de_la_noche_hoy_sigue_siendo_hoy_en_la_oficina(): void
    {
        $this->enOficina('2026-11-12 21:00:00');
        $this->tarea($this->colaborador, 'Para hoy', ['fecha_pactada' => '2026-11-12']);

        $r = $this->como($this->lider)->getJson('/api/tablero/agenda')->assertOk();

        $this->assertSame('2026-11-12', $r->json('hoy'));
        $this->assertTrue(collect($r->json('dias'))->firstWhere('fecha', '2026-11-12')['es_hoy']);
    }

    // ─── tablero/plano ────────────────────────────────────────────────────

    public function test_plano_un_colaborador_ve_a_todos_pero_no_en_que_trabaja_otro_equipo(): void
    {
        $this->tarea($this->colaborador, 'Lo mío', ['estado' => 'En Proceso']);
        $this->tarea($this->ajeno, 'Lo de Ana', ['estado' => 'En Proceso']);

        $plano = $this->como($this->colaborador)->getJson('/api/tablero/plano')->assertOk();

        $this->assertCount(5, collect($plano->json('zonas'))->flatMap(fn ($z) => $z['puestos']));
        $this->assertNull($this->puesto($this->ajeno, $plano)['en_curso'], 'Carlos no debe ver el título de lo que hace Ana.');
        $this->assertSame('Lo mío', $this->puesto($this->colaborador, $plano)['en_curso']['titulo']);
        $this->assertSame(1, $this->puesto($this->ajeno, $plano)['conteos']['vivas']);
        $this->assertSame(1, $plano->json('mi_equipo_total'));
        $this->assertStringNotContainsString('Descripción de prueba', $plano->getContent());
    }

    public function test_plano_lider_y_administracion_ven_el_trabajo_de_cualquiera(): void
    {
        $this->tarea($this->ajeno, 'Lo de Ana', ['estado' => 'En Proceso']);

        $plano = $this->como($this->lider)->getJson('/api/tablero/plano')->assertOk();
        $this->assertSame('Lo de Ana', $this->puesto($this->ajeno, $plano)['en_curso']['titulo']);
        $this->assertSame(3, $plano->json('mi_equipo_total'));
        $this->assertTrue($this->puesto($this->colaborador, $plano)['mi_equipo']);
        $this->assertFalse($this->puesto($this->ajeno, $plano)['mi_equipo']);

        $plano = $this->sinEmpleado()->getJson('/api/tablero/plano')->assertOk();
        $this->assertSame('Lo de Ana', $this->puesto($this->ajeno, $plano)['en_curso']['titulo']);
        $this->assertSame(0, $plano->json('mi_equipo_total'));

        $plano = $this->como($this->conRol('Supervisor'))->getJson('/api/tablero/plano')->assertOk();
        $this->assertSame('Lo de Ana', $this->puesto($this->ajeno, $plano)['en_curso']['titulo']);
    }

    public function test_plano_sin_usuario_no_ve_trabajo_ajeno(): void
    {
        $this->tarea($this->ajeno, 'Lo de Ana', ['estado' => 'En Proceso']);

        $plano = $this->fantasma()->getJson('/api/tablero/plano')->assertOk();

        $this->assertNull($this->puesto($this->ajeno, $plano)['en_curso']);
    }

    public function test_plano_omite_a_los_inactivos(): void
    {
        $this->db()->table('empleados')->where('id', $this->ajeno)->update(['estado' => 'Inactivo']);
        $this->db()->table('empleados')->where('id', $this->verificador)->update(['estado_registro' => 'Inactivo']);

        $plano = $this->como($this->lider)->getJson('/api/tablero/plano')->assertOk();

        $this->assertNull($this->puesto($this->ajeno, $plano));
        $this->assertNull($this->puesto($this->verificador, $plano));
    }

    public function test_plano_conteos_y_senal_del_puesto(): void
    {
        $ayer = now()->subDay()->toDateString();
        $this->tarea($this->colaborador, 'Vencida', ['fecha_pactada' => $ayer]);
        $this->tarea($this->colaborador, 'Reanudada', ['estado' => 'En Proceso', 'pausada' => 1]);
        $this->tarea($this->colaborador, 'Bloqueada', ['bloqueada' => 1]);
        $this->tarea($this->colaborador, 'Cerrada', ['estado' => 'Completada', 'fecha_pactada' => $ayer]);
        $this->tarea($this->colaborador, 'Archivada', ['archivar' => 1, 'fecha_pactada' => $ayer]);
        $this->tarea($this->colaborador, 'Eliminada', ['estado_reg' => 'Eliminado', 'fecha_pactada' => $ayer]);

        $p = $this->puesto($this->colaborador, $this->como($this->lider)->getJson('/api/tablero/plano'));

        $this->assertSame(['vivas' => 3, 'atrasadas' => 1, 'bloqueadas' => 1, 'pausadas' => 0, 'revision' => 0, 'sin_criterio' => 3], $p['conteos']);
        $this->assertSame('bloqueado', $p['senal']);
    }

    public function test_plano_distingue_nombres_repetidos(): void
    {
        $otraLaura = $this->empleado('Laura', 'Zapata');

        $plano = $this->como($this->colaborador)->getJson('/api/tablero/plano');

        $this->assertSame('Laura Líder', $this->puesto($this->lider, $plano)['etiqueta']);
        $this->assertSame('Laura Zapata', $this->puesto($otraLaura, $plano)['etiqueta']);
        $this->assertSame('Carlos', $this->puesto($this->colaborador, $plano)['etiqueta']);
    }

    #[Group('hallazgo')]
    public function test_plano_a_las_nueve_de_la_noche_lo_de_hoy_no_esta_atrasado(): void
    {
        $this->enOficina('2026-11-12 21:00:00');
        $this->tarea($this->colaborador, 'Para hoy', ['fecha_pactada' => '2026-11-12']);

        $p = $this->puesto($this->colaborador, $this->como($this->lider)->getJson('/api/tablero/plano'));

        $this->assertSame(0, $p['conteos']['atrasadas']);
        $this->assertNotSame('atrasado', $p['senal']);
    }

    // ─── tablero/videos ───────────────────────────────────────────────────

    private function video(array $datos = [])
    {
        return $this->postJson('/api/tablero/videos', array_merge(['titulo' => 'Lluvia', 'url' => self::VIDEO], $datos));
    }

    private function videoDe(int $empleado, array $campos = []): int
    {
        $usuario = $this->db()->table('users')->where('empleado', $empleado)->value('id');

        return $this->db()->table('tablero_videos')->insertGetId(array_merge([
            'titulo' => 'Vídeo', 'usuario' => $usuario, 'video_id' => self::VIDEO, 'orden' => 0, 'estado' => 'Activo',
        ], $campos));
    }

    public static function enlacesValidos(): array
    {
        return [
            'id suelto'      => ['dQw4w9WgXcQ'],
            'watch'          => ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
            'watch con t'    => ['youtube.com/watch?v=dQw4w9WgXcQ&t=42'],
            'corto'          => ['https://youtu.be/dQw4w9WgXcQ'],
            'shorts'         => ['https://youtube.com/shorts/dQw4w9WgXcQ'],
            'embed móvil'    => ['https://m.youtube.com/embed/dQw4w9WgXcQ'],
            'nocookie'       => ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
        ];
    }

    #[DataProvider('enlacesValidos')]
    public function test_videos_acepta_los_formatos_de_youtube(string $url): void
    {
        $id = $this->como($this->lider)->video(['url' => $url])->assertOk()->json('id');

        $this->assertSame(self::VIDEO, $this->db()->table('tablero_videos')->where('id', $id)->value('video_id'));
    }

    public static function enlacesInvalidos(): array
    {
        return [
            'otro dominio'          => ['https://evil.com/watch?v=dQw4w9WgXcQ'],
            'dominio disfrazado'    => ['https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ'],
            'sufijo sin punto'      => ['https://notyoutube.com/watch?v=dQw4w9WgXcQ'],
            'javascript'            => ['javascript:alert(1)'],
            'id corto'              => ['https://youtube.com/watch?v=corto'],
            'id con caracteres'     => ['https://youtu.be/dQw4w9WgX<s'],
            'html'                  => ['<script>alert(1)</script>'],
            'sin id'                => ['https://youtu.be/'],
            'canal'                 => ['https://www.youtube.com/@canal'],
        ];
    }

    #[DataProvider('enlacesInvalidos')]
    public function test_videos_rechaza_lo_que_no_es_un_video_de_youtube(string $url): void
    {
        $this->como($this->lider)->video(['url' => $url])->assertStatus(422);

        $this->assertSame(0, $this->db()->table('tablero_videos')->count());
    }

    public function test_videos_validan_campos_con_422(): void
    {
        $this->como($this->lider)->video(['titulo' => ''])->assertStatus(422);
        $this->como($this->lider)->video(['url' => ''])->assertStatus(422);
        $this->como($this->lider)->video(['titulo' => str_repeat('a', 201)])->assertStatus(422);
        $this->como($this->lider)->video(['url' => 'https://youtu.be/' . str_repeat('a', 500)])->assertStatus(422);
        $this->como($this->lider)->video(['estado' => 'Borrado'])->assertStatus(422);
        $this->como($this->lider)->video(['orden' => 'primero'])->assertStatus(422);

        $this->assertSame(0, $this->db()->table('tablero_videos')->count());
    }

    public function test_videos_cada_quien_ve_los_suyos_y_los_heredados(): void
    {
        $deLaura = $this->videoDe($this->lider);
        $inactivo = $this->videoDe($this->lider, ['estado' => 'Inactivo']);
        $deAna = $this->videoDe($this->ajeno);
        $heredado = $this->videoDe($this->lider, ['usuario' => null]);

        $ids = fn ($r) => collect($r->assertOk()->json())->pluck('id')->sort()->values()->all();

        $this->assertSame([$deLaura, $heredado], $ids($this->como($this->lider)->getJson('/api/tablero/videos')));
        $this->assertSame([$deLaura, $inactivo, $heredado], $ids($this->como($this->lider)->getJson('/api/tablero/videos?todos=1')));
        $this->assertSame([$deAna, $heredado], $ids($this->como($this->ajeno)->getJson('/api/tablero/videos')));
        $this->fantasma()->getJson('/api/tablero/videos')->assertOk()->assertExactJson([]);
    }

    public function test_videos_nadie_edita_ni_borra_el_de_otro(): void
    {
        $deAna = $this->videoDe($this->ajeno, ['titulo' => 'De Ana']);

        $this->como($this->lider)->video(['id' => $deAna, 'titulo' => 'Robado'])->assertStatus(403);
        $this->como($this->lider)->deleteJson("/api/tablero/videos/{$deAna}")->assertStatus(403);
        // Ni siquiera un administrador: cada uno gestiona los suyos.
        $this->como($this->conRol('Administrador'))->deleteJson("/api/tablero/videos/{$deAna}")->assertStatus(403);

        $this->assertSame('De Ana', $this->db()->table('tablero_videos')->where('id', $deAna)->value('titulo'));
    }

    public function test_videos_el_dueno_edita_y_borra_el_suyo(): void
    {
        $mio = $this->videoDe($this->lider);

        $this->como($this->lider)->video(['id' => $mio, 'titulo' => 'Bosque', 'url' => 'https://youtu.be/aaaaaaaaaaa'])->assertOk();
        $this->assertSame('aaaaaaaaaaa', $this->db()->table('tablero_videos')->where('id', $mio)->value('video_id'));

        $this->como($this->lider)->deleteJson("/api/tablero/videos/{$mio}")->assertOk();
        $this->assertFalse($this->db()->table('tablero_videos')->where('id', $mio)->exists());
    }

    public function test_videos_heredados_solo_los_toca_un_administrador(): void
    {
        $heredado = $this->videoDe($this->lider, ['usuario' => null]);

        $this->como($this->lider)->deleteJson("/api/tablero/videos/{$heredado}")->assertStatus(403);
        $this->como($this->conRol('Supervisor'))->deleteJson("/api/tablero/videos/{$heredado}")->assertStatus(403);
        $this->sinEmpleado()->video(['id' => $heredado, 'titulo' => 'Renombrado'])->assertOk();
        $this->sinEmpleado()->deleteJson("/api/tablero/videos/{$heredado}")->assertOk();
    }

    public function test_videos_sin_usuario_no_crea_ni_borra(): void
    {
        $this->fantasma()->video()->assertStatus(403);
        $this->fantasma()->deleteJson('/api/tablero/videos/1')->assertStatus(403);
        $this->assertSame(0, $this->db()->table('tablero_videos')->count());
    }

    public function test_videos_el_administrador_sin_ficha_crea_los_suyos(): void
    {
        $id = $this->sinEmpleado()->video()->assertOk()->json('id');

        $this->assertNotNull($this->db()->table('tablero_videos')->where('id', $id)->value('usuario'));
    }

    public function test_videos_un_id_inexistente_no_da_500(): void
    {
        $r = $this->como($this->lider)->deleteJson('/api/tablero/videos/999999');
        $this->assertContains($r->status(), [403, 404]);

        $r = $this->como($this->lider)->video(['id' => 999999]);
        $this->assertContains($r->status(), [403, 404]);
        $this->assertSame(0, $this->db()->table('tablero_videos')->count());
    }
}
