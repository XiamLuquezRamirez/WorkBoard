<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Informe «Calidad de definición y aceptación»: si las tareas nacen bien
 * definidas, cuánto tarda el visto bueno y qué pasa al entregarlas.
 *
 * Mide las dos puntas del trabajo que no dependen de quien lo ejecuta: cómo se
 * pidió y cuánto esperó por su líder.
 */
final class InformeCalidad
{
    /** Desde aquí crear una tarea exige propósito y criterios de aceptación. */
    public const OBLIGATORIO_DESDE = '2026-10-30';

    /** Aceptación automática del responsable con independencia. */
    public const MARCA_AUTOMATICA = 'Aceptada al completarla';

    /**
     * @param  int[]|null  $alcance  null = toda la organización
     */
    public static function calcular(?array $alcance, string $inicio, string $fin, ?CarbonImmutable $hoy = null): array
    {
        $hoy ??= IndiceDesempeno::hoy();
        $conn = DB::connection('mysql2');

        $base = fn () => $conn->table('tareas_empleados as t')
            ->leftJoin('empleados as e', 't.empleado', '=', 'e.id')
            ->leftJoin('departamentos as d', 'e.departamento', '=', 'd.id')
            ->where('t.estado_reg', 'Activo')
            ->whereRaw('COALESCE(t.archivar, 0) <> 1')
            ->when($alcance !== null, fn ($q) => $q->whereIn('t.empleado', $alcance ?: [0]))
            ->select('t.id', 't.titulo', 't.estado', 't.empleado as empleado_id', 't.fecha_creacion', 't.fecha_aprobacion',
                't.aprobada', 't.proposito', 't.pausada', 'd.nombre as departamento')
            ->selectRaw('NULLIF(TRIM(CONCAT(COALESCE(e.nombres, ""), " ", COALESCE(e.apellidos, ""))), "") as persona');

        $abiertas = $base()->where('t.estado', '<>', 'Completada')
            ->selectRaw('(SELECT COUNT(*) FROM tarea_criterios k WHERE k.tarea_id = t.id AND k.eliminado_at IS NULL) as n_criterios')
            ->get();

        // Última vez que cada tarea en revisión se envió a revisar.
        $enRevisionIds = $abiertas->where('estado', 'En Revisión')->pluck('id');
        $enviadas = $conn->table('tarea_criterio_historial')
            ->whereIn('tarea_id', $enRevisionIds->all() ?: [0])->where('evento', 'enviada_revision')
            ->groupBy('tarea_id')->selectRaw('tarea_id, MAX(created_at) as cuando')->pluck('cuando', 'tarea_id');

        $vistos = $base()->whereBetween('t.fecha_aprobacion', [$inicio, $fin])->get();

        $aceptaciones = $base()->join('tarea_aceptaciones as a', 'a.tarea_id', '=', 't.id')
            ->leftJoin('users as u', 'a.usuario_id', '=', 'u.id')
            ->whereBetween('a.created_at', [$inicio . ' 00:00:00', $fin . ' 23:59:59'])
            ->addSelect('a.id as aceptacion_id', 'a.resultado', 'a.observacion', 'a.created_at as cuando', 'u.name as resuelta_por')
            ->orderByDesc('a.created_at')
            ->get();
        $envios = $conn->table('tarea_criterio_historial')
            ->whereIn('tarea_id', $aceptaciones->pluck('id')->unique()->all() ?: [0])->where('evento', 'enviada_revision')
            ->orderBy('created_at')->get(['tarea_id', 'created_at'])->groupBy('tarea_id');

        $ids = $abiertas->concat($vistos)->concat($aceptaciones)->pluck('empleado_id')->filter()->unique()->values()->all();
        $lideres = InformeRegistro::lideresDe($ids);
        $comun = fn ($t) => [
            'id'           => (int) $t->id,
            'titulo'       => $t->titulo,
            'empleado_id'  => $t->empleado_id ? (int) $t->empleado_id : null,
            'persona'      => $t->persona ?: 'Sin responsable',
            'departamento' => $t->departamento ?: 'Sin departamento',
            'lideres'      => $lideres[$t->empleado_id] ?? [],
        ];
        $dias = function (?string $desde, CarbonImmutable $hasta): ?int {
            $f = IndiceDesempeno::fechaValida($desde);

            return $f === null ? null
                : max(0, (int) round(CarbonImmutable::parse($f, IndiceDesempeno::ZONA)->diffInDays($hasta->startOfDay(), false)));
        };

        return [
            'hoy'               => $hoy->toDateString(),
            'obligatorio_desde' => self::OBLIGATORIO_DESDE,
            'abiertas' => $abiertas->map(fn ($t) => $comun($t) + [
                'estado'         => $t->estado,
                'sin_criterio'   => (int) $t->n_criterios === 0,
                'sin_proposito'  => trim((string) $t->proposito) === '',
                // Nacida cuando ya era obligatorio: si le falta, es un hueco de hoy.
                'nueva'          => (IndiceDesempeno::fechaValida($t->fecha_creacion) ?? '') >= self::OBLIGATORIO_DESDE,
                'sin_visto_bueno' => (int) $t->aprobada !== 1 && $t->estado !== 'En Revisión',
                'dias_esperando_vb' => (int) $t->aprobada !== 1 ? $dias($t->fecha_creacion, $hoy) : null,
                'dias_en_revision'  => $t->estado === 'En Revisión' ? $dias($enviadas[$t->id] ?? null, $hoy) : null,
            ])->values(),
            'vistos_buenos' => $vistos->map(fn ($t) => $comun($t) + [
                'fecha' => IndiceDesempeno::fechaValida($t->fecha_aprobacion),
                'dias'  => $dias($t->fecha_creacion, CarbonImmutable::parse($t->fecha_aprobacion, IndiceDesempeno::ZONA)),
            ])->filter(fn ($v) => $v['dias'] !== null)->values(),
            'aceptaciones' => $aceptaciones->map(function ($a) use ($comun, $envios, $dias) {
                // El envío que resolvió esta decisión: el último anterior a ella.
                $envio = ($envios[$a->id] ?? collect())->where('created_at', '<=', $a->cuando)->last();

                return $comun($a) + [
                    'aceptacion_id' => (int) $a->aceptacion_id,
                    'resultado'     => $a->resultado,
                    'observacion'   => $a->observacion,
                    'cuando'        => $a->cuando,
                    'resuelta_por'  => $a->resuelta_por,
                    'automatica'    => str_starts_with((string) $a->observacion, self::MARCA_AUTOMATICA),
                    'dias'          => $envio
                        ? $dias($envio->created_at, CarbonImmutable::parse($a->cuando, IndiceDesempeno::ZONA)) : null,
                ];
            })->values(),
        ];
    }
}
