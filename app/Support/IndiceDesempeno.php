<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Índice de desempeño de una persona para el dashboard de administración.
 *
 * Antes se calculaba en el navegador con TODO el historial: quien completó
 * muchas tareas hace un año y no registraba nada desde hacía meses seguía
 * saliendo «Alto». Ahora mira una ventana reciente y usa el mismo criterio de
 * «vencida» que el tablero de equipo (ResumenTablero), en hora de Bogotá.
 *
 * Qué entra en el cálculo:
 *  - las tareas abiertas (ni completadas ni archivadas): son el compromiso
 *    vigente, sin importar cuándo se crearon;
 *  - las completadas cuya entrega cae dentro de la ventana.
 *
 * Sólo se juzga lo «exigible»: lo completado y lo que ya pasó su fecha. Una
 * tarea abierta que aún no vence no baja ni sube la nota de nadie.
 *
 * Vencida = abierta, no En Revisión (ya entregada, espera al líder), no
 * pausada y con la fecha pactada antes de hoy. La pausa la aprueba el líder y
 * al reanudar se reprograma la fecha: no es un incumplimiento de la persona.
 * (El tablero de equipo sí muestra las pausadas entre las vencidas.)
 */
final class IndiceDesempeno
{
    public const VENTANA_DIAS = 90;

    /**
     * Eventos del historial que NO son trabajo de la persona: el recordatorio
     * automático de atraso y el «pide actualización» de su líder. Si contaran,
     * bastaría con escribirle para que pareciera activa.
     */
    public const EVENTOS_SIN_ACTIVIDAD = ['TareaAtrasada', 'PedidoActualizacion'];

    /** «Esta semana»: quien movió algo en estos días cuenta como activo. */
    public const DIAS_SEMANA = 7;

    /** Una vencida «de verdad»: más de una semana pasada su fecha. */
    public const DIAS_VENCIDA_GRAVE = 7;

    /** Ventana de la puntualidad reciente del panel de adopción. */
    public const DIAS_PUNTUALIDAD = 30;

    public const ZONA = 'America/Bogota';

    private const EN_REVISION = 'En Revisión';

    public static function hoy(): CarbonImmutable
    {
        return CarbonImmutable::now(self::ZONA)->startOfDay();
    }

    /**
     * @param  Collection  $tareas  filas de tareas_empleados (estado_reg Activo);
     *                              si traen n_criterios se cuentan las que no tienen
     * @param  string|null  $ultimoEvento  último movimiento registrado en el
     *                                    historial de sus tareas (cambios de estado,
     *                                    comentarios…), que las fechas de la tarea
     *                                    no recogen
     */
    public static function calcular(Collection $tareas, ?CarbonImmutable $hoy = null, ?string $ultimoEvento = null): array
    {
        $hoy ??= self::hoy();
        $hoyTxt = $hoy->toDateString();
        $desde = $hoy->subDays(self::VENTANA_DIAS)->toDateString();

        $fecha = fn ($v) => self::fechaValida($v);

        $abiertas = $tareas->filter(fn ($t) => $t->estado !== 'Completada' && (int) ($t->archivar ?? 0) !== 1);
        $completadas = $tareas->filter(fn ($t) => $t->estado === 'Completada'
            && $fecha($t->fecha_entregada) !== null && $fecha($t->fecha_entregada) >= $desde);

        $vencidas = $abiertas->filter(fn ($t) => $t->estado !== self::EN_REVISION
            && !self::estaPausada($t)
            && $fecha($t->fecha_pactada) !== null && $fecha($t->fecha_pactada) < $hoyTxt);

        // Sin fecha pactada no hay plazo que incumplir: cuenta como a tiempo.
        $aTiempo = $completadas->filter(fn ($t) => $fecha($t->fecha_pactada) === null
            || $fecha($t->fecha_entregada) <= $fecha($t->fecha_pactada));
        $reprocesos = $completadas->filter(fn ($t) => (int) ($t->rechazada ?? 0) === 1);

        $limiteProximas = $hoy->addDays(3)->toDateString();
        $proximas = $abiertas->filter(fn ($t) => $t->estado !== self::EN_REVISION
            && $fecha($t->fecha_pactada) !== null
            && $fecha($t->fecha_pactada) >= $hoyTxt && $fecha($t->fecha_pactada) <= $limiteProximas);

        $nCompletadas = $completadas->count();
        $nVencidas = $vencidas->count();
        $exigibles = $nCompletadas + $nVencidas;
        $asignadas = $abiertas->count() + $nCompletadas;

        // Última señal de vida en sus tareas: crear, entregar, ser aprobada,
        // reprogramar o verificar. Sin movimiento, el índice no dice la
        // verdad y el dashboard lo debe decir.
        $ultima = $tareas->flatMap(fn ($t) => [
            $fecha($t->fecha_creacion ?? null),
            $fecha($t->fecha_entregada ?? null),
            $fecha($t->fecha_aprobacion ?? null),
            $fecha($t->fecha_reprogramacion ?? null),
            $fecha($t->fecha_verificacion ?? null),
        ])->push($fecha($ultimoEvento))->filter()->filter(fn ($f) => $f <= $hoyTxt)->max();

        $diasSinActividad = $ultima ? (int) CarbonImmutable::parse($ultima, self::ZONA)->diffInDays($hoy) : null;

        if ($exigibles === 0) {
            $indice = null;
        } else {
            $tasaCompletitud = $nCompletadas / $exigibles;
            // Sin nada completado no hay puntualidad ni calidad que premiar:
            // antes, quien no entregaba nada se llevaba gratis los 15 puntos
            // de calidad.
            $tasaPuntualidad = $nCompletadas > 0 ? $aTiempo->count() / $nCompletadas : 0;
            $tasaCalidad = $nCompletadas > 0 ? 1 - min($reprocesos->count() / $nCompletadas, 1) : 0;
            $tasaVigencia = 1 - min($nVencidas / max($asignadas, 1), 1);

            $indice = (int) max(0, min(100, round(
                $tasaCompletitud * 40 + $tasaPuntualidad * 25 + $tasaVigencia * 20 + $tasaCalidad * 15
            )));
        }

        $nivel = match (true) {
            $indice === null && $tareas->isEmpty() => 'sin-datos',
            $indice === null && $abiertas->isNotEmpty() => 'en-curso',
            $indice === null => 'sin-actividad',
            $indice >= 75 => 'alto',
            $indice >= 50 => 'medio',
            default => 'bajo',
        };

        // Lo que pide atención: vencidas de más de una semana, nada movido en
        // la semana, o nadie le ha asignado nada. Ordena las tarjetas.
        $limiteGrave = $hoy->subDays(self::DIAS_VENCIDA_GRAVE)->toDateString();
        $graves = $vencidas->filter(fn ($t) => $fecha($t->fecha_pactada) < $limiteGrave);
        $masVencida = $vencidas->sortBy(fn ($t) => $fecha($t->fecha_pactada))->first();

        $desde30 = $hoy->subDays(self::DIAS_PUNTUALIDAD)->toDateString();
        $completadas30 = $completadas->filter(fn ($t) => $fecha($t->fecha_entregada) >= $desde30);
        $aTiempo30 = $aTiempo->filter(fn ($t) => $fecha($t->fecha_entregada) >= $desde30);

        $sinCriterio = $abiertas->filter(fn ($t) => property_exists($t, 'n_criterios') && (int) $t->n_criterios === 0);

        $activoSemana = $diasSinActividad !== null && $diasSinActividad <= self::DIAS_SEMANA;
        $atencion = array_values(array_filter([
            $graves->isNotEmpty() ? 'vencidas' : null,
            !$activoSemana && $tareas->isNotEmpty() ? 'sin-movimiento' : null,
            $abiertas->isEmpty() ? 'sin-tareas' : null,
        ]));

        // Puntaje para ordenar: más vencidas graves y más tiempo quieto,
        // más arriba. Al día = 0.
        $quieto = $diasSinActividad ?? 365;
        $prioridad = $graves->count() * 100
            + (in_array('sin-movimiento', $atencion, true) ? 50 + min($quieto, 365) / 10 : 0)
            + (in_array('sin-tareas', $atencion, true) ? 30 : 0);

        $datos = [
            'indice'             => $indice,
            'nivel'              => $nivel,
            'ventana_dias'       => self::VENTANA_DIAS,
            'asignadas'          => $asignadas,
            'abiertas'           => $abiertas->count(),
            'en_proceso'         => $abiertas->where('estado', 'En Proceso')->count(),
            'pendientes'         => $abiertas->where('estado', 'Pendiente')->count(),
            'en_revision'        => $abiertas->where('estado', self::EN_REVISION)->count(),
            'completadas'        => $nCompletadas,
            'a_tiempo'           => $aTiempo->count(),
            'reprocesos'         => $reprocesos->count(),
            'vencidas'           => $nVencidas,
            'proximas'           => $proximas->count(),
            'ultima_actividad'   => $ultima,
            'dias_sin_actividad' => $diasSinActividad,
            'activo_semana'      => $activoSemana,
            'vencidas_graves'    => $graves->count(),
            'mas_vencida'        => $masVencida ? [
                'id'            => (int) ($masVencida->id ?? 0),
                'titulo'        => $masVencida->titulo ?? '',
                'fecha_pactada' => $fecha($masVencida->fecha_pactada),
                'dias'          => (int) CarbonImmutable::parse($fecha($masVencida->fecha_pactada), self::ZONA)->diffInDays($hoy),
            ] : null,
            'completadas_30'     => $completadas30->count(),
            'a_tiempo_30'        => $aTiempo30->count(),
            'sin_criterio'       => $sinCriterio->count(),
            'atencion'           => $atencion,
            'prioridad_atencion' => (int) round($prioridad),
        ];
        $datos['mensaje'] = self::mensaje($datos);

        return $datos;
    }

    /**
     * ¿Está en pausa de verdad? Pausar marca pausada=1 sin cambiar el estado,
     * y llevarla a En Proceso es reanudarla aunque la marca siga puesta (el
     * tablero la trata así: ESTADOS_NO_PAUSABLES). Un único criterio para el
     * índice, el tablero, el plano, la ficha y el correo de resumen.
     */
    public static function estaPausada(object $t): bool
    {
        return (int) ($t->pausada ?? 0) === 1
            && !in_array(trim((string) $t->estado), ['Completada', 'En Proceso', self::EN_REVISION], true);
    }

    /** Las fechas antiguas traen '0000-00-00'; eso no es una fecha. */
    private static function fechaValida($valor): ?string
    {
        if (!$valor) {
            return null;
        }
        $txt = substr((string) $valor, 0, 10);

        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $txt) && $txt !== '0000-00-00' ? $txt : null;
    }

    private static function mensaje(array $d): string
    {
        $tareas = fn (int $n) => $n === 1 ? '1 tarea' : "{$n} tareas";
        $vencidas = fn (int $n) => $tareas($n) . ($n === 1 ? ' vencida' : ' vencidas');
        $ventana = "los últimos {$d['ventana_dias']} días";

        switch ($d['nivel']) {
            case 'sin-datos':
                return 'Nunca ha tenido tareas registradas.';
            case 'sin-actividad':
                return $d['dias_sin_actividad'] !== null
                    ? "Sin tareas en {$ventana}. Último movimiento hace {$d['dias_sin_actividad']} días."
                    : "Sin tareas en {$ventana}.";
            case 'en-curso':
                return 'Tiene tareas en curso que aún no vencen: todavía no hay nada que evaluar.';
        }

        $partes = [];
        if ($d['vencidas'] > 0) {
            $partes[] = $vencidas($d['vencidas']);
        }
        if ($d['reprocesos'] > 0) {
            $partes[] = $tareas($d['reprocesos']) . ' con reproceso';
        }
        if ($d['completadas'] === 0) {
            $partes[] = "nada entregado en {$ventana}";
        }
        $detalle = $partes ? ' ' . ucfirst(implode(', ', $partes)) . '.' : '';

        return match ($d['nivel']) {
            'alto'  => $partes
                ? "Buen rendimiento.{$detalle}"
                : ($d['proximas'] > 0 ? "Buen rendimiento. {$tareas($d['proximas'])} por vencer pronto." : 'Al día con todas sus tareas.'),
            'medio' => "Rendimiento medio.{$detalle}",
            default => "Rendimiento bajo.{$detalle}",
        };
    }
}
