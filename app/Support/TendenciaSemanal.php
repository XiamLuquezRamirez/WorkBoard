<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Tendencia semanal del dashboard: cuántas tareas se crean y se entregan cada
 * semana, y cuántas personas mueven algo de su trabajo.
 *
 * Es la gráfica que habría avisado a tiempo de que la plataforma se estaba
 * dejando de usar: de 187 tareas creadas en julio de 2025 a ninguna desde
 * mayo de 2026, sin que ningún número del dashboard lo dijera.
 *
 * «Movió trabajo» usa las mismas señales que IndiceDesempeno: crear,
 * entregar, aprobar, reprogramar o verificar una tarea, y cualquier evento de
 * su historial salvo los recordatorios automáticos de atraso.
 */
final class TendenciaSemanal
{
    public const SEMANAS = 26;

    /**
     * @param  int[]|null  $empleados  null = toda la organización
     */
    public static function calcular(?array $empleados, ?CarbonImmutable $hoy = null, int $semanas = self::SEMANAS): array
    {
        $hoy ??= IndiceDesempeno::hoy();
        $inicio = $hoy->startOfWeek(CarbonImmutable::MONDAY)->subWeeks($semanas - 1);
        $desde = $inicio->toDateString();
        $conn = DB::connection('mysql2');

        // Sólo personas activas: quien ya no está no debe mover la curva.
        $activos = $conn->table('empleados')
            ->where('estado_registro', 'Activo')->where('estado', 'Activo')
            ->when($empleados !== null, fn ($q) => $q->whereIn('id', $empleados ?: [0]))
            ->pluck('id')->map(fn ($i) => (int) $i)->all();

        $serie = [];
        for ($i = 0; $i < $semanas; $i++) {
            $lunes = $inicio->addWeeks($i)->toDateString();
            $serie[$lunes] = ['inicio' => $lunes, 'creadas' => 0, 'entregadas' => 0, 'personas' => []];
        }

        $semanaDe = function (?string $fecha) use ($desde, $hoy) {
            $f = substr((string) $fecha, 0, 10);
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $f) || $f === '0000-00-00' || $f < $desde || $f > $hoy->toDateString()) {
                return null;
            }
            return CarbonImmutable::parse($f, IndiceDesempeno::ZONA)->startOfWeek(CarbonImmutable::MONDAY)->toDateString();
        };

        $tareas = $conn->table('tareas_empleados')
            ->whereIn('empleado', $activos ?: [0])
            ->where('estado_reg', 'Activo')
            ->where(fn ($q) => $q->where('fecha_creacion', '>=', $desde)
                ->orWhere('fecha_entregada', '>=', $desde)
                ->orWhere('fecha_aprobacion', '>=', $desde)
                ->orWhere('fecha_reprogramacion', '>=', $desde)
                ->orWhere('fecha_verificacion', '>=', $desde))
            ->get(['empleado', 'fecha_creacion', 'fecha_entregada', 'fecha_aprobacion', 'fecha_reprogramacion', 'fecha_verificacion']);

        foreach ($tareas as $t) {
            $e = (int) $t->empleado;
            if ($s = $semanaDe($t->fecha_creacion)) {
                $serie[$s]['creadas']++;
                $serie[$s]['personas'][$e] = true;
            }
            if ($s = $semanaDe($t->fecha_entregada)) {
                $serie[$s]['entregadas']++;
                $serie[$s]['personas'][$e] = true;
            }
            foreach ([$t->fecha_aprobacion, $t->fecha_reprogramacion, $t->fecha_verificacion] as $f) {
                if ($s = $semanaDe($f)) {
                    $serie[$s]['personas'][$e] = true;
                }
            }
        }

        $eventos = $conn->table('notif_generales as n')
            ->join('tareas_empleados as te', 'n.tarea_id', '=', 'te.id')
            ->whereIn('te.empleado', $activos ?: [0])
            ->where('n.fecha_creacion', '>=', $desde)
            ->where(fn ($q) => $q->whereNull('n.tipo')->orWhereNotIn('n.tipo', IndiceDesempeno::EVENTOS_SIN_ACTIVIDAD))
            ->select('te.empleado', DB::raw('DATE(n.fecha_creacion) as dia'))
            ->distinct()
            ->get();

        foreach ($eventos as $ev) {
            if ($s = $semanaDe($ev->dia)) {
                $serie[$s]['personas'][(int) $ev->empleado] = true;
            }
        }

        return [
            'semanas'        => array_values(array_map(fn ($s) => [
                'inicio'     => $s['inicio'],
                'creadas'    => $s['creadas'],
                'entregadas' => $s['entregadas'],
                'personas'   => count($s['personas']),
            ], $serie)),
            'total_personas' => count($activos),
        ];
    }
}
