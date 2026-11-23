<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Informe «Quién no registra»: qué personas dejaron de mover sus tareas, desde
 * cuándo y semana a semana.
 *
 * «Movió» usa las mismas señales que IndiceDesempeno y TendenciaSemanal: crear,
 * entregar, aprobar, reprogramar o verificar una tarea suya, o cualquier evento
 * de su historial salvo los recordatorios automáticos. Es movimiento EN sus
 * tareas: parte puede haberla hecho su líder.
 */
final class InformeRegistro
{
    public const SEMANAS = [4, 8, 12, 26];

    /**
     * @param  array  $personas  [['id' => …, 'nombre' => …, 'indicadores' => […]], …]
     */
    public static function calcular(array $personas, int $semanas, ?CarbonImmutable $hoy = null): array
    {
        $hoy ??= IndiceDesempeno::hoy();
        $hoyTxt = $hoy->toDateString();
        $lunesActual = $hoy->startOfWeek(CarbonImmutable::MONDAY);
        $inicio = $lunesActual->subWeeks($semanas - 1);
        $desde = $inicio->toDateString();
        $conn = DB::connection('mysql2');
        $ids = array_column($personas, 'id') ?: [0];

        $lunes = [];
        for ($i = 0; $i < $semanas; $i++) {
            $lunes[] = $inicio->addWeeks($i)->toDateString();
        }

        $semanaDe = function ($fecha) use ($desde, $hoyTxt): ?string {
            $f = IndiceDesempeno::fechaValida($fecha);

            return $f === null || $f < $desde || $f > $hoyTxt
                ? null
                : CarbonImmutable::parse($f, IndiceDesempeno::ZONA)->startOfWeek(CarbonImmutable::MONDAY)->toDateString();
        };

        $celdas = [];
        $marcar = function (int $e, ?string $s, ?string $que = null) use (&$celdas) {
            if ($s === null) {
                return;
            }
            $celdas[$e][$s] ??= ['creadas' => 0, 'entregadas' => 0];
            if ($que) {
                $celdas[$e][$s][$que]++;
            }
        };

        $tareas = $conn->table('tareas_empleados')
            ->whereIn('empleado', $ids)->where('estado_reg', 'Activo')
            ->where(fn ($q) => $q->where('fecha_creacion', '>=', $desde)
                ->orWhere('fecha_entregada', '>=', $desde)
                ->orWhere('fecha_aprobacion', '>=', $desde)
                ->orWhere('fecha_reprogramacion', '>=', $desde)
                ->orWhere('fecha_verificacion', '>=', $desde))
            ->get(['empleado', 'fecha_creacion', 'fecha_entregada', 'fecha_aprobacion', 'fecha_reprogramacion', 'fecha_verificacion']);

        foreach ($tareas as $t) {
            $e = (int) $t->empleado;
            $marcar($e, $semanaDe($t->fecha_creacion), 'creadas');
            $marcar($e, $semanaDe($t->fecha_entregada), 'entregadas');
            foreach ([$t->fecha_aprobacion, $t->fecha_reprogramacion, $t->fecha_verificacion] as $f) {
                $marcar($e, $semanaDe($f));
            }
        }

        $eventos = $conn->table('notif_generales as n')
            ->join('tareas_empleados as te', 'n.tarea_id', '=', 'te.id')
            ->whereIn('te.empleado', $ids)
            ->where('te.estado_reg', 'Activo')
            ->where('n.fecha_creacion', '>=', $desde)
            ->where(fn ($q) => $q->whereNull('n.tipo')->orWhereNotIn('n.tipo', IndiceDesempeno::EVENTOS_SIN_ACTIVIDAD))
            ->select('te.empleado', DB::raw('DATE(n.fecha_creacion) as dia'))
            ->distinct()->get();
        foreach ($eventos as $ev) {
            $marcar((int) $ev->empleado, $semanaDe($ev->dia));
        }

        $lideres = self::lideresDe($ids);

        return [
            'hoy' => $hoyTxt,
            // La semana en curso va incompleta: no se cuenta como «sin registrar».
            'semana_actual' => $lunesActual->toDateString(),
            'semanas' => $lunes,
            'personas' => array_map(function ($p) use ($celdas, $lunes, $lideres, $lunesActual) {
                $suyas = $celdas[$p['id']] ?? [];
                $cerradas = array_filter($lunes, fn ($l) => $l !== $lunesActual->toDateString());
                $i = $p['indicadores'];

                return [
                    'id' => $p['id'],
                    'nombre' => $p['nombre'],
                    'cargo' => $p['cargo'],
                    'departamento' => $p['departamento'],
                    'lideres' => $lideres[$p['id']] ?? [],
                    'abiertas' => $i['abiertas'],
                    'vencidas' => $i['vencidas'],
                    'ultima_actividad' => $i['ultima_actividad'],
                    'dias_sin_actividad' => $i['dias_sin_actividad'],
                    'semanas' => array_map(fn ($l) => isset($suyas[$l]) ? $suyas[$l] + ['movio' => true]
                        : ['creadas' => 0, 'entregadas' => 0, 'movio' => false], $lunes),
                    'semanas_cerradas' => count($cerradas),
                    'semanas_sin_registrar' => count(array_filter($cerradas, fn ($l) => !isset($suyas[$l]))),
                ];
            }, $personas),
        ];
    }

    /** [empleado => ['Nombre del líder', …]] con los líderes activos. */
    public static function lideresDe(array $ids): array
    {
        return DB::connection('mysql2')->table('lideres_empleados as le')
            ->join('empleados as l', 'le.lider', '=', 'l.id')
            ->whereIn('le.empleado', $ids ?: [0])
            ->where('l.estado', 'Activo')->where('l.estado_registro', 'Activo')
            ->whereColumn('le.lider', '<>', 'le.empleado')
            ->orderBy('l.nombres')
            ->get(['le.empleado', 'l.nombres', 'l.apellidos'])
            ->groupBy('empleado')
            ->map(fn ($g) => $g->map(fn ($l) => trim($l->nombres . ' ' . $l->apellidos))->unique()->values()->all())
            ->all();
    }
}
