<?php

namespace Tests\Unit;

use App\Support\IndiceDesempeno;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\TestCase;

/**
 * El índice del dashboard: ventana reciente, criterio de vencida del tablero
 * y hora de Bogotá.
 */
class IndiceDesempenoTest extends TestCase
{
    private CarbonImmutable $hoy;

    protected function setUp(): void
    {
        parent::setUp();
        $this->hoy = CarbonImmutable::parse('2026-11-14', 'America/Bogota');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    private function t(array $campos): object
    {
        return (object) array_merge([
            'id' => 0, 'titulo' => 'Tarea', 'estado' => 'Pendiente', 'fecha_pactada' => null, 'fecha_entregada' => null,
            'fecha_creacion' => null, 'fecha_aprobacion' => null, 'fecha_reprogramacion' => null,
            'fecha_verificacion' => null, 'archivar' => 0, 'rechazada' => 0, 'pausada' => 0,
        ], $campos);
    }

    private function calcular(array $tareas): array
    {
        return IndiceDesempeno::calcular(collect($tareas), $this->hoy);
    }

    public function test_el_desglose_explica_la_nota_con_sus_propios_numeros(): void
    {
        // El ejemplo de la explicación del dashboard: 8 completadas (6 a
        // tiempo, 1 con reproceso), 2 vencidas y 3 abiertas que aún no vencen.
        $tareas = [];
        for ($i = 0; $i < 8; $i++) {
            $tareas[] = $this->t([
                'estado' => 'Completada', 'fecha_pactada' => '2026-11-01',
                'fecha_entregada' => $i < 6 ? '2026-10-30' : '2026-11-05',
                'rechazada' => $i === 0 ? 1 : 0,
            ]);
        }
        $tareas[] = $this->t(['estado' => 'Pendiente', 'fecha_pactada' => '2026-11-10']);
        $tareas[] = $this->t(['estado' => 'En Proceso', 'fecha_pactada' => '2026-11-12']);
        for ($i = 0; $i < 3; $i++) {
            $tareas[] = $this->t(['estado' => 'En Proceso', 'fecha_pactada' => '2026-11-30']);
        }

        $r = $this->calcular($tareas);

        $this->assertSame(81, $r['indice']);
        $d = collect($r['desglose'])->keyBy('factor');
        $this->assertSame([8, 10, 32.0], [$d['completitud']['parte'], $d['completitud']['de'], $d['completitud']['puntos']]);
        $this->assertSame([6, 8, 18.8], [$d['puntualidad']['parte'], $d['puntualidad']['de'], $d['puntualidad']['puntos']]);
        $this->assertSame([11, 13, 16.9], [$d['vigencia']['parte'], $d['vigencia']['de'], $d['vigencia']['puntos']]);
        $this->assertSame([7, 8, 13.1], [$d['calidad']['parte'], $d['calidad']['de'], $d['calidad']['puntos']]);
        $this->assertSame(100, array_sum(IndiceDesempeno::PESOS));
    }

    public function test_marcar_para_informe_usa_la_regla_de_vencida_y_limpia_fechas(): void
    {
        $vencida = IndiceDesempeno::marcarParaInforme($this->t(['estado' => 'En Proceso', 'fecha_pactada' => '2026-11-10']), $this->hoy);
        $this->assertTrue($vencida->vencida);
        $this->assertSame(4, $vencida->dias_vencida);
        $this->assertNull($vencida->a_tiempo);

        $vieja = IndiceDesempeno::marcarParaInforme($this->t(['fecha_pactada' => '0000-00-00', 'fecha_entregada' => '0000-00-00 00:00:00']), $this->hoy);
        $this->assertNull($vieja->fecha_pactada);
        $this->assertNull($vieja->fecha_entregada);
        $this->assertFalse($vieja->vencida);

        $archivada = IndiceDesempeno::marcarParaInforme($this->t(['fecha_pactada' => '2026-11-01', 'archivar' => 1]), $this->hoy);
        $this->assertFalse($archivada->vencida);

        // En Proceso con la marca de pausa puesta: está reanudada, sí vence.
        $reanudada = IndiceDesempeno::marcarParaInforme($this->t(['estado' => 'En Proceso', 'pausada' => 1, 'fecha_pactada' => '2026-11-01']), $this->hoy);
        $this->assertFalse($reanudada->en_pausa);
        $this->assertTrue($reanudada->vencida);

        $aTiempo = IndiceDesempeno::marcarParaInforme($this->t([
            'estado' => 'Completada', 'fecha_pactada' => '2026-11-10', 'fecha_entregada' => '2026-11-10 16:30:00',
        ]), $this->hoy);
        $this->assertTrue($aTiempo->a_tiempo, 'Entregar el mismo día con hora no es entregar tarde.');
    }

    public function test_sin_nada_exigible_no_hay_desglose(): void
    {
        $r = $this->calcular([$this->t(['estado' => 'En Proceso', 'fecha_pactada' => '2026-11-30'])]);
        $this->assertNull($r['indice']);
        $this->assertNull($r['desglose']);
    }

    public function test_un_historial_brillante_no_tapa_meses_sin_actividad(): void
    {
        // 60 entregas a tiempo hace un año y 2 tareas abandonadas hace 289 días.
        // Con el cálculo anterior salía «Alto» (~85 %).
        $tareas = [];
        for ($i = 0; $i < 60; $i++) {
            $tareas[] = $this->t(['estado' => 'Completada', 'fecha_creacion' => '2025-10-01',
                'fecha_pactada' => '2025-11-01', 'fecha_entregada' => '2025-10-20']);
        }
        $tareas[] = $this->t(['estado' => 'En Proceso', 'fecha_creacion' => '2026-01-10', 'fecha_pactada' => '2026-01-29']);
        $tareas[] = $this->t(['estado' => 'Pendiente', 'fecha_creacion' => '2026-01-10', 'fecha_pactada' => '2026-01-29']);

        $r = $this->calcular($tareas);

        $this->assertSame(0, $r['indice']);
        $this->assertSame('bajo', $r['nivel']);
        $this->assertSame(2, $r['vencidas']);
        $this->assertSame(0, $r['completadas']);
        $this->assertStringContainsString('nada entregado', $r['mensaje']);
        $this->assertSame('2026-01-10', $r['ultima_actividad']);
    }

    public function test_quien_solo_tiene_historial_viejo_sale_sin_actividad(): void
    {
        $r = $this->calcular([
            $this->t(['estado' => 'Completada', 'fecha_creacion' => '2026-03-01', 'fecha_pactada' => '2026-03-10', 'fecha_entregada' => '2026-03-05']),
        ]);

        $this->assertNull($r['indice']);
        $this->assertSame('sin-actividad', $r['nivel']);
        $this->assertSame(254, $r['dias_sin_actividad']);
        $this->assertStringContainsString('hace 254 días', $r['mensaje']);
    }

    public function test_sin_tareas_y_con_tareas_que_aun_no_vencen(): void
    {
        $this->assertSame('sin-datos', $this->calcular([])['nivel']);

        $r = $this->calcular([$this->t(['estado' => 'En Proceso', 'fecha_creacion' => '2026-11-12', 'fecha_pactada' => '2026-11-20'])]);
        $this->assertNull($r['indice']);
        $this->assertSame('en-curso', $r['nivel']);
        $this->assertSame(2, $r['dias_sin_actividad']);
    }

    public function test_al_dia_y_a_tiempo_es_alto(): void
    {
        $r = $this->calcular([
            $this->t(['estado' => 'Completada', 'fecha_pactada' => '2026-11-01', 'fecha_entregada' => '2026-11-01']),
            $this->t(['estado' => 'Completada', 'fecha_pactada' => null, 'fecha_entregada' => '2026-10-15']),
            $this->t(['estado' => 'En Proceso', 'fecha_pactada' => '2026-11-16']),
        ]);

        $this->assertSame(100, $r['indice']);
        $this->assertSame('alto', $r['nivel']);
        $this->assertSame(2, $r['a_tiempo'], 'Entregar el mismo día o sin fecha pactada cuenta como a tiempo.');
        $this->assertSame(1, $r['proximas']);
        $this->assertStringContainsString('por vencer pronto', $r['mensaje']);
    }

    public function test_que_cuenta_como_vencida(): void
    {
        $r = $this->calcular([
            // Ya entregada, espera al líder: no está vencida.
            $this->t(['estado' => 'En Revisión', 'fecha_pactada' => '2026-10-01']),
            // Archivada: fuera del tablero.
            $this->t(['estado' => 'Pendiente', 'fecha_pactada' => '2026-10-01', 'archivar' => 1]),
            // Pausada con aprobación del líder: no es un incumplimiento.
            $this->t(['estado' => 'Pendiente', 'fecha_pactada' => '2026-10-01', 'pausada' => 1]),
            // Ésta sí.
            $this->t(['estado' => 'En Proceso', 'fecha_pactada' => '2026-10-01']),
            // Reanudada (llevada a En Proceso) con la marca puesta: corre el plazo.
            $this->t(['estado' => 'En Proceso', 'fecha_pactada' => '2026-10-01', 'pausada' => 1]),
            // Vence hoy: todavía no.
            $this->t(['estado' => 'Pendiente', 'fecha_pactada' => '2026-11-14']),
        ]);

        $this->assertSame(2, $r['vencidas']);
        $this->assertSame(5, $r['abiertas']);
        $this->assertSame(1, $r['en_revision']);
    }

    public function test_hoy_es_el_de_bogota_y_no_el_de_utc(): void
    {
        // 20:00 en Bogotá = 01:00 del día siguiente en UTC.
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-11-14 20:00', 'America/Bogota'));

        $r = IndiceDesempeno::calcular(collect([$this->t(['estado' => 'Pendiente', 'fecha_pactada' => '2026-11-14'])]));

        $this->assertSame(0, $r['vencidas']);
        $this->assertSame('2026-11-14', IndiceDesempeno::hoy()->toDateString());
    }

    public function test_las_fechas_vacias_de_la_base_no_cuentan(): void
    {
        $r = $this->calcular([
            $this->t(['estado' => 'Completada', 'fecha_pactada' => '2026-11-10', 'fecha_entregada' => '2026-11-12',
                'fecha_aprobacion' => '0000-00-00', 'rechazada' => 1]),
        ]);

        $this->assertSame('2026-11-12', $r['ultima_actividad']);
        $this->assertSame(0, $r['a_tiempo']);
        $this->assertSame(1, $r['reprocesos']);
        // Completó todo (40) + vigencia (20); tarde (0) y con reproceso (0).
        $this->assertSame(60, $r['indice']);
        $this->assertSame('medio', $r['nivel']);
    }

    public function test_motivos_de_atencion_y_su_orden(): void
    {
        $abandonado = $this->calcular([
            $this->t(['id' => 7, 'titulo' => 'Informe viejo', 'estado' => 'Pendiente', 'fecha_creacion' => '2026-01-10', 'fecha_pactada' => '2026-01-29']),
            $this->t(['id' => 8, 'titulo' => 'Otra', 'estado' => 'Pendiente', 'fecha_creacion' => '2026-01-10', 'fecha_pactada' => '2026-11-10']),
        ]);
        $this->assertSame(['vencidas', 'sin-movimiento'], $abandonado['atencion']);
        $this->assertSame(1, $abandonado['vencidas_graves'], 'La de hace 4 días todavía no es grave.');
        $this->assertSame(2, $abandonado['vencidas']);
        $this->assertSame(['id' => 7, 'titulo' => 'Informe viejo', 'fecha_pactada' => '2026-01-29', 'dias' => 289], $abandonado['mas_vencida']);
        $this->assertFalse($abandonado['activo_semana']);

        $alDia = $this->calcular([
            $this->t(['estado' => 'En Proceso', 'fecha_creacion' => '2026-11-12', 'fecha_pactada' => '2026-11-20']),
        ]);
        $this->assertSame([], $alDia['atencion']);
        $this->assertTrue($alDia['activo_semana']);
        $this->assertSame(0, $alDia['prioridad_atencion']);

        $sinNada = $this->calcular([]);
        $this->assertSame(['sin-tareas'], $sinNada['atencion']);

        $this->assertGreaterThan($sinNada['prioridad_atencion'], $abandonado['prioridad_atencion']);
    }

    public function test_un_movimiento_en_el_historial_cuenta_como_actividad(): void
    {
        $tareas = [$this->t(['estado' => 'En Proceso', 'fecha_creacion' => '2026-03-01', 'fecha_pactada' => '2026-12-01'])];

        $this->assertFalse($this->calcular($tareas)['activo_semana']);

        $r = IndiceDesempeno::calcular(collect($tareas), $this->hoy, '2026-11-13 16:40:00');
        $this->assertTrue($r['activo_semana']);
        $this->assertSame(1, $r['dias_sin_actividad']);
        $this->assertSame([], $r['atencion']);
    }

    public function test_puntualidad_de_30_dias_y_tareas_sin_criterio(): void
    {
        $r = $this->calcular([
            $this->t(['estado' => 'Completada', 'fecha_pactada' => '2026-11-10', 'fecha_entregada' => '2026-11-09']),
            $this->t(['estado' => 'Completada', 'fecha_pactada' => '2026-11-01', 'fecha_entregada' => '2026-11-05']),
            // Fuera de los 30 días, dentro de los 90.
            $this->t(['estado' => 'Completada', 'fecha_pactada' => '2026-09-01', 'fecha_entregada' => '2026-09-01']),
            $this->t(['estado' => 'Pendiente', 'fecha_pactada' => '2026-12-01', 'n_criterios' => 0]),
            $this->t(['estado' => 'Pendiente', 'fecha_pactada' => '2026-12-01', 'n_criterios' => 2]),
        ]);

        $this->assertSame(2, $r['completadas_30']);
        $this->assertSame(1, $r['a_tiempo_30']);
        $this->assertSame(3, $r['completadas']);
        $this->assertSame(1, $r['sin_criterio']);
    }
}
