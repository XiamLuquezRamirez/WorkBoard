<?php

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Presencia de la gente en el plano: el estado que cada quien elige y lo que
 * está haciendo, deducido de lo que ya registra la aplicación.
 *
 *  - estado: lo elige la persona y vale sólo el día en que lo puso. Sin
 *    elegir nada se deduce: en reunión si la agenda lo dice, disponible si
 *    tiene la aplicación abierta y desconectado si no.
 *  - actividad: escribiendo (mandó un mensaje de chat hace nada) o tarea (tiene
 *    una En Proceso). Sólo se anima a quien está en su puesto.
 *
 * Todas las horas se escriben y comparan con now() de la aplicación: la base
 * de datos va en hora local y la aplicación en UTC, y mezclar los dos relojes
 * desplazaba cinco horas cada comparación.
 */
final class Presencia
{
    public const ESTADOS = ['disponible', 'ocupado', 'reunion', 'almuerzo', 'ausente'];

    /** Los horarios de la agenda se guardan en hora de Bogotá. */
    public const ZONA = 'America/Bogota';

    /** Sin latido en este tiempo, la aplicación se da por cerrada. */
    private const EN_LINEA_SEG = 150;

    /** Cada cuánto, como mucho, se anota un latido. */
    private const LATIDO_SEG = 60;

    /** Un mensaje enviado hace menos que esto cuenta como «escribiendo». */
    private const ESCRIBIENDO_SEG = 90;

    /** Lo que dura la animación de un saludo para los demás. */
    private const SALUDO_SEG = 25;

    private static ?bool $hayTabla = null;

    /**
     * La tabla llega con una migración; hasta que se ejecute, el plano sigue
     * funcionando sin presencia en vez de fallar.
     */
    public static function disponible(): bool
    {
        return self::$hayTabla ??= Schema::connection('mysql2')->hasTable('presencia_empleados');
    }

    public static function hoy(): string
    {
        return Carbon::now(self::ZONA)->toDateString();
    }

    /**
     * Anota que la aplicación de este empleado sigue abierta. Lo llama el
     * aviso de mensajes, que ya consulta cada pocos segundos desde cualquier
     * pantalla; se escribe como mucho una vez por minuto.
     */
    public static function latido(int $empleado): void
    {
        if (!self::disponible()) {
            return;
        }

        $conn = DB::connection('mysql2');
        $ahora = now();

        $tocadas = $conn->table('presencia_empleados')
            ->where('empleado', $empleado)
            ->where(fn ($q) => $q->whereNull('visto_en')->orWhere('visto_en', '<', $ahora->copy()->subSeconds(self::LATIDO_SEG)))
            ->update(['visto_en' => $ahora]);

        if ($tocadas === 0) {
            $conn->table('presencia_empleados')->insertOrIgnore(['empleado' => $empleado, 'visto_en' => $ahora]);
        }
    }

    /** Guarda el estado elegido (null = automático) y cuenta como latido. */
    public static function elegir(int $empleado, ?string $estado, ?string $nota): void
    {
        $nota = $nota !== null ? trim($nota) : null;

        DB::connection('mysql2')->table('presencia_empleados')->upsert([[
            'empleado'   => $empleado,
            'estado'     => $estado,
            'nota'       => $estado && $nota !== '' ? $nota : null,
            'fecha'      => $estado ? self::hoy() : null,
            'visto_en'   => now(),
            'updated_at' => now(),
        ]], ['empleado'], ['estado', 'nota', 'fecha', 'visto_en', 'updated_at']);
    }

    /** Deja constancia del saludo para que el personaje salude en el plano. */
    public static function saludar(int $de, int $a): void
    {
        DB::connection('mysql2')->table('presencia_empleados')->upsert([[
            'empleado'  => $de,
            'saludo_a'  => $a,
            'saludo_en' => now(),
            'visto_en'  => now(),
        ]], ['empleado'], ['saludo_a', 'saludo_en', 'visto_en']);
    }

    /**
     * Presencia de cada empleado del plano.
     *
     * @param  int[]  $empleados
     * @param  int[]  $conTareaEnCurso  quienes tienen una tarea En Proceso
     * @return array<int, array>  por id de empleado
     */
    public static function delPlano(array $empleados, array $conTareaEnCurso): array
    {
        // Sin la tabla no hay latidos: todos saldrían «desconectados». Mejor
        // no enseñar presencia hasta que se ejecute la migración.
        if ($empleados === [] || !self::disponible()) {
            return [];
        }

        $conn = DB::connection('mysql2');
        $ahora = now();
        $hoy = self::hoy();

        $filas = $conn->table('presencia_empleados')->whereIn('empleado', $empleados)->get()->keyBy('empleado');

        $enReunion = self::enReunionAhora($empleados);
        $enCurso = array_flip($conTareaEnCurso);

        $escribiendo = array_flip($conn->table('chat_mensajes')
            ->whereIn('empleado', $empleados)
            ->where('created_at', '>=', $ahora->copy()->subSeconds(self::ESCRIBIENDO_SEG))
            ->distinct()->pluck('empleado')->map(fn ($i) => (int) $i)->all());

        $salida = [];
        foreach ($empleados as $id) {
            $f = $filas->get($id);
            $enLinea = $f && $f->visto_en
                && Carbon::parse($f->visto_en)->gte($ahora->copy()->subSeconds(self::EN_LINEA_SEG));
            $manual = $f && $f->estado && $f->fecha === $hoy ? $f->estado : null;

            // «Disponible» u «ocupado» sólo valen con la aplicación abierta:
            // quien cerró y se fue no está disponible aunque lo dijera a las 8.
            // Una reunión de la agenda gana a lo elegido, salvo a «ausente».
            if (isset($enReunion[$id]) && $manual !== 'ausente') {
                $estado = 'reunion';
            } elseif ($manual && (!in_array($manual, ['disponible', 'ocupado'], true) || $enLinea)) {
                $estado = $manual;
            } else {
                $estado = $enLinea ? 'disponible' : 'desconectado';
            }

            $enSuPuesto = in_array($estado, ['disponible', 'ocupado'], true);
            $actividad = null;
            if ($enSuPuesto && isset($escribiendo[$id])) {
                $actividad = 'escribiendo';
            } elseif ($enSuPuesto && isset($enCurso[$id])) {
                $actividad = 'tarea';
            }

            // Con una reunión de la agenda en curso, todos sus asistentes van
            // a la misma sala aunque trabajen en pisos distintos.
            $deAgenda = $estado === 'reunion' && isset($enReunion[$id]);

            $salida[$id] = [
                'estado'    => $estado,
                'reunion'   => $deAgenda ? $enReunion[$id]['reunion'] : null,
                'sala'      => $deAgenda ? $enReunion[$id]['sala'] : null,
                'elegido'   => $manual !== null,
                'nota'      => $manual ? $f->nota : null,
                'actividad' => $actividad,
                'saluda'    => $f && $f->saludo_en
                    && Carbon::parse($f->saludo_en)->gte($ahora->copy()->subSeconds(self::SALUDO_SEG)),
            ];
        }

        return $salida;
    }

    /**
     * Sala del plano donde se dibuja una reunión, según su «Lugar»: el salón
     * de capacitación si lo nombra, la sala de juntas en cualquier otro caso
     * (también las virtuales, que no dicen sala).
     */
    public static function salaDeReunion(?string $lugar): string
    {
        return preg_match('/sal[oó]n|capacitaci/iu', (string) $lugar) ? 'salon' : 'juntas';
    }

    /**
     * Quiénes están ahora mismo en una reunión de la agenda: la organizan o
     * están convocados sin haberla rechazado. Sin hora de fin, se le supone
     * una hora de duración. Si alguien coincide en dos, cuenta la que empezó
     * antes.
     *
     * @param  int[]  $empleados
     * @return array<int, array{reunion: int, sala: string}>  por empleado
     */
    public static function enReunionAhora(array $empleados): array
    {
        $local = Carbon::now(self::ZONA);
        $hora = $local->format('H:i:s');
        $haceUnaHora = $local->copy()->subHour()->format('H:i:s');
        $conn = DB::connection('mysql2');

        $reuniones = $conn->table('reuniones')
            ->where('estado', 'Programada')
            ->where('fecha', $local->toDateString())
            ->where('hora_inicio', '<=', $hora)
            ->where(fn ($q) => $q->where('hora_fin', '>', $hora)
                ->orWhere(fn ($s) => $s->whereNull('hora_fin')->where('hora_inicio', '>', $haceUnaHora)))
            ->orderBy('hora_inicio')->orderBy('id')
            ->get(['id', 'organizador', 'lugar']);

        if ($reuniones->isEmpty()) {
            return [];
        }

        $asistentes = $conn->table('reuniones_asistentes')
            ->whereIn('reunion', $reuniones->pluck('id'))
            ->where('respuesta', '<>', 'Rechaza')
            ->get(['reunion', 'empleado'])
            ->groupBy('reunion');

        $validos = array_flip($empleados);
        $salida = [];
        foreach ($reuniones as $r) {
            $gente = collect($asistentes[$r->id] ?? [])->pluck('empleado')->push($r->organizador);
            foreach ($gente as $e) {
                $e = (int) $e;
                if (isset($validos[$e]) && !isset($salida[$e])) {
                    $salida[$e] = ['reunion' => (int) $r->id, 'sala' => self::salaDeReunion($r->lugar)];
                }
            }
        }

        return $salida;
    }
}
