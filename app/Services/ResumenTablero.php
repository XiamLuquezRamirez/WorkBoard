<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Construye el resumen diario del tablero de WorkBoard.
 *
 * La clasificación vive aquí, del lado de Laravel, a propósito: el agente que
 * lee el correo recibe hechos ya calculados y se limita a interpretarlos. Así
 * el reporte es auditable y reproducible.
 *
 * El dominio de WorkBoard no usa Eloquent —todo se consulta con el query
 * builder sobre la conexión mysql2—, de modo que aquí se trabaja con tablas y
 * columnas en lugar de modelos y relaciones.
 */
class ResumenTablero
{
    private array $columnas;
    private array $tablas;
    private array $movimiento;
    private string $conexion;
    private CarbonImmutable $hoy;

    public function __construct(private array $config)
    {
        $this->columnas   = $config['mapeo']['columnas'];
        $this->tablas     = $config['mapeo']['tablas'];
        $this->movimiento = $config['mapeo']['movimiento'];
        $this->conexion   = $config['mapeo']['conexion'];
        $this->hoy        = CarbonImmutable::now($config['zona_horaria'])->startOfDay();
    }

    public function generar(): array
    {
        $abiertas = $this->tareasAbiertas();

        $vencidas       = $this->vencidas($abiertas);
        $estancadas     = $this->estancadas($abiertas);
        $sinResponsable = $this->sinResponsable($abiertas);
        $vencenPronto   = $this->vencenPronto($abiertas);
        $sinFecha       = $this->sinFecha($abiertas);
        $huerfanas      = $this->responsableHuerfano($abiertas);

        return [
            'fecha'    => $this->hoy->toDateString(),
            'generado' => CarbonImmutable::now($this->config['zona_horaria'])->format('Y-m-d H:i'),
            'zona'     => $this->config['zona_horaria'],
            'metricas' => [
                'abiertas'        => $abiertas->count(),
                'vencidas'        => $vencidas->count(),
                'estancadas'      => $estancadas->count(),
                'sin_responsable' => $sinResponsable->count(),
                'vencen_pronto'   => $vencenPronto->count(),
                'sin_fecha'       => $sinFecha->count(),
                'pausadas'        => $abiertas->where('pausada', 1)->count(),
                'ficha_faltante'  => $huerfanas->count(),
            ],
            'secciones' => [
                'vencidas'        => $this->filas($vencidas),
                'estancadas'      => $this->filas($estancadas),
                'sin_responsable' => $this->filas($sinResponsable),
                'vencen_pronto'   => $this->filas($vencenPronto),
                'sin_fecha'       => $this->filas($sinFecha),
                'ficha_faltante'  => $this->filas($huerfanas),
            ],
            'por_responsable' => $this->porResponsable($vencidas, $estancadas, $vencenPronto),
        ];
    }

    // ------------------------------------------------------------------
    // Consulta base
    // ------------------------------------------------------------------

    /**
     * Tareas abiertas con su responsable, proyecto y última señal de movimiento.
     *
     * El join con empleados es LEFT a propósito: una tarea cuyo empleado fue
     * dado de baja seguiría existiendo, y con INNER desaparecería del resumen
     * justo cuando más importa señalarla como huérfana.
     */
    private function tareasAbiertas(): Collection
    {
        $t = $this->tablas['tareas'];
        $c = $this->columnas;

        $consulta = DB::connection($this->conexion)->table($t)
            ->leftJoin($this->tablas['empleados'].' as emp', 'emp.id', '=', $t.'.'.$c['responsable'])
            // Respaldo desde users: al borrar físicamente un empleado su fila
            // desaparece pero las tareas conservan el id. Sin este join saldrían
            // como "sin responsable" y el informe pediría reasignar tareas que
            // sí tienen dueño.
            ->leftJoin($this->tablas['usuarios'].' as usu', 'usu.empleado', '=', $t.'.'.$c['responsable'])
            ->leftJoin($this->tablas['proyectos'].' as pro', 'pro.id', '=', $t.'.'.$c['proyecto'])
            ->whereNotIn($t.'.'.$c['estado'], $this->config['mapeo']['estados_cerrados'])
            ->where($t.'.estado_reg', 'Activo')
            // archivar admite NULL en filas antiguas: comparar sólo con != 1 las
            // descartaría, porque en SQL toda comparación con NULL es falsa.
            ->where(fn ($q) => $q->where($t.'.archivar', '!=', 1)->orWhereNull($t.'.archivar'))
            ->select([
                $t.'.'.$c['id'].' as id',
                $t.'.'.$c['titulo'].' as titulo',
                $t.'.'.$c['estado'].' as estado',
                $t.'.'.$c['vencimiento'].' as vencimiento',
                $t.'.'.$c['responsable'].' as responsable_id',
                $t.'.prioridad',
                $t.'.pausada',
                DB::raw("NULLIF(TRIM(CONCAT(COALESCE(emp.nombres,''),' ',COALESCE(emp.apellidos,''))),'') as responsable_emp"),
                DB::raw('usu.name as responsable_usu'),
                DB::raw('CASE WHEN emp.id IS NULL AND usu.id IS NOT NULL THEN 1 ELSE 0 END as responsable_huerfano'),
                'pro.nombre as proyecto',
            ]);

        $proyectos = $this->config['mapeo']['proyectos_incluidos'];

        if (is_array($proyectos) && $proyectos !== []) {
            $consulta->whereIn($t.'.'.$c['proyecto'], $proyectos);
        }

        $tareas = $consulta->get()->map(function ($tarea) {
            $tarea->responsable = $tarea->responsable_emp ?: ($tarea->responsable_usu ?: null);

            return $tarea;
        });

        return $this->conMovimiento($tareas);
    }

    /**
     * Agrega a cada tarea la fecha de su último movimiento real.
     *
     * Se resuelve en una sola consulta agrupada en lugar de una por tarea: son
     * más de cien tareas abiertas y el comando corre a diario sin supervisión.
     */
    private function conMovimiento(Collection $tareas): Collection
    {
        if ($tareas->isEmpty()) {
            return $tareas;
        }

        $m = $this->movimiento;

        $ultimos = DB::connection($this->conexion)->table($this->tablas['movimientos'])
            ->whereIn($m['columna_tarea'], $tareas->pluck('id')->all())
            ->whereNotIn($m['columna_tipo'], $m['tipos_ignorados'])
            ->groupBy($m['columna_tarea'])
            ->pluck(
                DB::raw('MAX('.$m['columna_fecha'].')'),
                $m['columna_tarea']
            );

        return $tareas->map(function ($tarea) use ($ultimos) {
            $tarea->movido = $ultimos[$tarea->id] ?? null;

            return $tarea;
        });
    }

    // ------------------------------------------------------------------
    // Clasificación
    // ------------------------------------------------------------------

    private function vencidas(Collection $tareas): Collection
    {
        return $tareas
            ->filter(function ($tarea): bool {
                $vence = $this->fecha($tarea->vencimiento);

                return $vence !== null && $vence->lt($this->hoy);
            })
            ->sortBy(fn ($t) => $this->fecha($t->vencimiento)?->timestamp)
            ->values();
    }

    /**
     * Tareas sin movimiento durante N días hábiles.
     *
     * Una tarea sin ninguna señal de movimiento se considera estancada: nunca
     * se ha tocado, que es precisamente el caso que interesa destacar.
     */
    private function estancadas(Collection $tareas): Collection
    {
        $umbral = $this->config['reglas']['dias_estancamiento'];

        return $tareas
            ->filter(function ($tarea) use ($umbral): bool {
                $movida = $this->fecha($tarea->movido);

                if ($movida === null) {
                    return true;
                }

                return $movida->diffInWeekdays($this->hoy) >= $umbral;
            })
            ->sortBy(fn ($t) => $this->fecha($t->movido)?->timestamp ?? 0)
            ->values();
    }

    private function sinResponsable(Collection $tareas): Collection
    {
        return $tareas
            ->filter(fn ($t) => blank($t->responsable_id) || blank($t->responsable))
            ->values();
    }

    /**
     * Tareas cuyo responsable ya no tiene ficha de empleado.
     *
     * El nombre se recupera de users, así que la tarea sigue teniendo dueño
     * identificable; lo que falta es el registro en empleados. Se reporta aparte
     * porque no se arregla reasignando la tarea, sino restaurando la ficha.
     */
    private function responsableHuerfano(Collection $tareas): Collection
    {
        return $tareas
            ->filter(fn ($t) => (int) ($t->responsable_huerfano ?? 0) === 1)
            ->values();
    }

    private function vencenPronto(Collection $tareas): Collection
    {
        $limite = $this->hoy->addDays($this->config['reglas']['dias_horizonte']);

        return $tareas
            ->filter(function ($tarea) use ($limite): bool {
                $vence = $this->fecha($tarea->vencimiento);

                return $vence !== null
                    && $vence->gte($this->hoy)
                    && $vence->lte($limite);
            })
            ->sortBy(fn ($t) => $this->fecha($t->vencimiento)?->timestamp)
            ->values();
    }

    /**
     * Tareas abiertas sin fecha pactada.
     *
     * No aparecen en ninguna de las secciones de plazo —no hay contra qué
     * compararlas— y sin esta sección quedarían invisibles en el resumen.
     */
    private function sinFecha(Collection $tareas): Collection
    {
        return $tareas
            ->filter(fn ($t) => $this->fecha($t->vencimiento) === null)
            ->values();
    }

    // ------------------------------------------------------------------
    // Presentación
    // ------------------------------------------------------------------

    private function filas(Collection $tareas): array
    {
        $limite = $this->config['reglas']['limite_por_seccion'];

        $filas = $tareas->take($limite)->map(function ($tarea): array {
            $vence  = $this->fecha($tarea->vencimiento);
            $movida = $this->fecha($tarea->movido);

            return [
                'id'          => (int) $tarea->id,
                'titulo'      => (string) $tarea->titulo,
                'estado'      => (string) $tarea->estado,
                'prioridad'   => $tarea->prioridad ?: null,
                'pausada'     => (int) ($tarea->pausada ?? 0) === 1,
                'proyecto'    => $tarea->proyecto ?: null,
                'responsable' => $tarea->responsable ?: null,
                'vencimiento' => $vence?->toDateString(),
                'dias_vencida' => $vence !== null && $vence->lt($this->hoy)
                    ? (int) $vence->diffInDays($this->hoy)
                    : null,
                'dias_sin_movimiento' => $movida !== null
                    ? (int) $movida->diffInWeekdays($this->hoy)
                    : null,
            ];
        })->all();

        return [
            'total'    => $tareas->count(),
            'mostrado' => count($filas),
            'filas'    => $filas,
        ];
    }

    private function porResponsable(Collection ...$grupos): array
    {
        [$vencidas, $estancadas, $vencenPronto] = $grupos;

        $conteo = [];

        $acumular = function (Collection $tareas, string $llave) use (&$conteo): void {
            foreach ($tareas as $tarea) {
                $nombre = $tarea->responsable ?: 'Sin responsable';

                $conteo[$nombre] ??= ['vencidas' => 0, 'estancadas' => 0, 'vencen_pronto' => 0];
                $conteo[$nombre][$llave]++;
            }
        };

        $acumular($vencidas, 'vencidas');
        $acumular($estancadas, 'estancadas');
        $acumular($vencenPronto, 'vencen_pronto');

        uasort($conteo, fn (array $a, array $b) => ($b['vencidas'] + $b['estancadas'])
            <=> ($a['vencidas'] + $a['estancadas']));

        return $conteo;
    }

    // ------------------------------------------------------------------
    // Utilidades
    // ------------------------------------------------------------------

    private function fecha($valor): ?CarbonImmutable
    {
        if (blank($valor)) {
            return null;
        }

        // Fechas centinela: el esquema admite '0000-00-00' en filas antiguas y
        // parsearla daría un año cero que rompería el cálculo de días.
        if (str_starts_with((string) $valor, '0000-00-00')) {
            return null;
        }

        try {
            return CarbonImmutable::parse($valor)
                ->setTimezone($this->config['zona_horaria'])
                ->startOfDay();
        } catch (\Throwable) {
            return null;
        }
    }
}
