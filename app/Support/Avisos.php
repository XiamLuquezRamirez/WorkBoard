<?php

namespace App\Support;

use App\Mail\AvisoTareaCorreo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

use function Illuminate\Support\defer;

/**
 * Avisos a las personas: la campana de WorkBoard y la copia por correo.
 *
 * La campana (notif_generales) se lee por id de usuario y, como la pide el
 * Header, con tipo_receptor «usuario» para administración y supervisión y
 * «empleado» para el resto. Aquí se resuelve eso una sola vez para que cada
 * pantalla no tenga que repetirlo (y equivocarse).
 *
 * El correo sale después de responder (defer) y un fallo de envío sólo se
 * anota: el aviso en la plataforma ya quedó guardado.
 */
final class Avisos
{
    private const EN_REVISION = 'En Revisión';

    // ─── Genéricos ──────────────────────────────────────────────────────────

    /** Aviso en la campana para cada empleado (por id de empleado). */
    public static function campana(array $empleados, ?int $emisorEmpleado, string $mensaje, ?int $tareaId, string $tipo): void
    {
        $empleados = array_values(array_unique(array_filter(array_map('intval', $empleados))));
        if ($empleados === []) {
            return;
        }

        $usuarios = DB::connection('mysql2')->table('users')
            ->whereIn('empleado', $empleados)
            ->where(fn ($q) => $q->whereNull('estado')->orWhere('estado', '<>', 'Inactivo'))
            ->get(['id', 'tipo_usuario']);

        self::campanaUsuarios($usuarios, $emisorEmpleado, $mensaje, $tareaId, $tipo);
    }

    /**
     * Todos los líderes activos de un empleado (ids de empleado), sin los
     * excluidos. Antes cada aviso tomaba sólo el primero que apareciera en
     * lideres_empleados, aunque estuviera inactivo: con dos líderes, uno no
     * se enteraba, y a veces el aviso iba a quien ya no estaba.
     *
     * @return int[]
     */
    public static function lideresActivos(int $empleado, array $excluir = []): array
    {
        $excluir = array_map('intval', array_filter($excluir));

        return DB::connection('mysql2')->table('lideres_empleados as le')
            ->join('empleados as e', 'le.lider', '=', 'e.id')
            ->where('le.empleado', $empleado)
            ->where('e.estado_registro', 'Activo')
            ->where('e.estado', 'Activo')
            ->pluck('e.id')
            ->map(fn ($i) => (int) $i)
            ->reject(fn ($i) => in_array($i, $excluir, true))
            ->unique()->values()->all();
    }

    /**
     * Administración que recibe lo que no tiene líder: quien marcó «líder de
     * seguimiento» y, si nadie lo hizo, todos los administradores activos.
     */
    public static function administracionDeSeguimiento()
    {
        $base = fn () => DB::connection('mysql2')->table('users')
            ->whereRaw('LOWER(TRIM(tipo_usuario)) = ?', ['administrador'])
            ->where(fn ($q) => $q->whereNull('estado')->orWhere('estado', '<>', 'Inactivo'));

        $seguimiento = $base()->where('lider_seguimiento', 'Si')->get(['id', 'tipo_usuario', 'email', 'name']);

        return $seguimiento->isNotEmpty() ? $seguimiento : $base()->get(['id', 'tipo_usuario', 'email', 'name']);
    }

    /** Aviso en la campana para filas de users ya resueltas (id, tipo_usuario). */
    public static function campanaUsuarios($usuarios, ?int $emisorEmpleado, string $mensaje, ?int $tareaId, string $tipo): void
    {
        $conn = DB::connection('mysql2');
        $idEmisor = $emisorEmpleado ? $conn->table('users')->where('empleado', $emisorEmpleado)->value('id') : null;

        $filas = collect($usuarios)->unique('id')->map(function ($u) use ($idEmisor, $mensaje, $tareaId, $tipo) {
            $t = strtolower(trim((string) $u->tipo_usuario));
            return [
                'id_emisor'     => $idEmisor ?? 0,
                'tipo_emisor'   => 'empleado',
                'id_receptor'   => $u->id,
                'tipo_receptor' => in_array($t, ['administrador', 'supervisor'], true) ? 'usuario' : 'empleado',
                'mensaje'       => $mensaje,
                'tarea_id'      => $tareaId,
                'leido'         => 0,
                'fecha'         => now()->toDateString(),
                'tipo'          => $tipo,
            ];
        })->values()->all();

        if ($filas !== []) {
            $conn->table('notif_generales')->insert($filas);
        }
    }

    /**
     * A dónde y a nombre de quién va el correo de cada empleado: el correo de
     * su ficha y, si no tiene, el de su usuario. Los que no tienen ninguno
     * válido se quedan sólo con el aviso de la plataforma.
     *
     * @return array<int, array{correo: string, nombre: string}>
     */
    public static function destinosDeEmpleados(array $empleados): array
    {
        $empleados = array_values(array_unique(array_filter(array_map('intval', $empleados))));
        if ($empleados === []) {
            return [];
        }

        $conn = DB::connection('mysql2');
        $usuarios = $conn->table('users')->whereIn('empleado', $empleados)->pluck('email', 'empleado');

        return $conn->table('empleados')
            ->whereIn('id', $empleados)
            ->get(['id', 'email', 'nombres'])
            ->map(function ($e) use ($usuarios) {
                $correo = trim((string) ($e->email ?: ($usuarios[$e->id] ?? '')));
                return filter_var($correo, FILTER_VALIDATE_EMAIL)
                    ? ['correo' => $correo, 'nombre' => self::primerNombre($e->nombres)]
                    : null;
            })
            ->filter()->values()->all();
    }

    /**
     * Envía un correo a cada destino después de responder.
     *
     * @param callable(array $destino): \Illuminate\Mail\Mailable $crear
     */
    public static function correo(array $destinos, callable $crear, string $contexto): void
    {
        if ($destinos === []) {
            return;
        }

        defer(function () use ($destinos, $crear, $contexto) {
            foreach ($destinos as $d) {
                try {
                    Mail::to($d['correo'])->send($crear($d));
                } catch (\Throwable $e) {
                    Log::warning("No se envió el correo ({$contexto}) a {$d['correo']}: " . $e->getMessage());
                }
            }
        });
    }

    // ─── Revisión de tareas ─────────────────────────────────────────────────

    /**
     * La tarea llegó a revisión: avisa a quien debe aceptarla o devolverla.
     *
     * Son todos los líderes del responsable, no sólo el primero que aparezca,
     * y también cuando el responsable es líder: su propio líder lo revisa. Si
     * no tiene ninguno, la revisa administración.
     */
    public static function enviadaARevision(object $tarea, ?int $actorEmpleado): void
    {
        $conn = DB::connection('mysql2');
        $responsable = self::nombreEmpleado((int) $tarea->empleado) ?: 'El responsable';

        $lideres = self::lideresActivos((int) $tarea->empleado, [(int) $tarea->empleado, $actorEmpleado]);

        $mensaje = "{$responsable} envió a revisión la tarea «{$tarea->titulo}». Revísala para aceptarla o devolverla con observaciones.";

        if ($lideres !== []) {
            self::campana($lideres, $actorEmpleado, $mensaje, (int) $tarea->id, 'Revision');
            $destinos = self::destinosDeEmpleados($lideres);
        } else {
            $admins = $conn->table('users')
                ->whereRaw('LOWER(TRIM(tipo_usuario)) = ?', ['administrador'])
                ->where(fn ($q) => $q->whereNull('estado')->orWhere('estado', '<>', 'Inactivo'))
                ->get(['id', 'tipo_usuario', 'email', 'name']);
            self::campanaUsuarios($admins, $actorEmpleado, $mensaje, (int) $tarea->id, 'Revision');
            $destinos = $admins->map(fn ($a) => filter_var(trim((string) $a->email), FILTER_VALIDATE_EMAIL)
                ? ['correo' => trim($a->email), 'nombre' => self::primerNombre($a->name)]
                : null)->filter()->values()->all();
        }

        $datos = self::datosTarea($tarea, $responsable);
        self::correo($destinos, fn ($d) => new AvisoTareaCorreo('revision', $d['nombre'], $datos), "revisión de la tarea {$tarea->id}");
    }

    /** El líder aceptó o devolvió la entrega: avisa al responsable. */
    public static function entregaResuelta(object $tarea, string $resultado, ?string $observacion, ?object $actorUsuario): void
    {
        $actorEmpleado = $actorUsuario->empleado ?? null;
        if ($actorEmpleado && (int) $actorEmpleado === (int) $tarea->empleado) {
            return; // Quien se acepta su propia tarea no necesita aviso.
        }

        $actor = $actorUsuario->name ?? 'Tu líder';
        if ($actorEmpleado) {
            $actor = self::nombreEmpleado((int) $actorEmpleado) ?: $actor;
        }

        [$tipo, $mensaje, $plantilla] = $resultado === 'Aceptada'
            ? ['Aceptada', "{$actor} aceptó la entrega de «{$tarea->titulo}». La tarea quedó cerrada.", 'aceptada']
            : ['Devuelta', "{$actor} devolvió la tarea «{$tarea->titulo}» para corregir: {$observacion}", 'devuelta'];

        self::campana([(int) $tarea->empleado], $actorEmpleado ? (int) $actorEmpleado : null, $mensaje, (int) $tarea->id, $tipo);

        $datos = self::datosTarea($tarea, self::nombreEmpleado((int) $tarea->empleado)) + [
            'actor'       => $actor,
            'observacion' => $observacion,
        ];
        self::correo(
            self::destinosDeEmpleados([(int) $tarea->empleado]),
            fn ($d) => new AvisoTareaCorreo($plantilla, $d['nombre'], $datos),
            "{$plantilla} de la tarea {$tarea->id}"
        );
    }

    /** Una tarea aceptada se reabrió: el responsable debe saber que vuelve a estar viva. */
    public static function tareaReabierta(object $tarea, ?object $actorUsuario, ?string $motivo = null): void
    {
        $actorEmpleado = $actorUsuario->empleado ?? null;
        if ($actorEmpleado && (int) $actorEmpleado === (int) $tarea->empleado) {
            return;
        }

        $actor = $actorEmpleado ? (self::nombreEmpleado((int) $actorEmpleado) ?: ($actorUsuario->name ?? 'Tu líder')) : ($actorUsuario->name ?? 'Tu líder');
        $mensaje = "{$actor} reabrió la tarea «{$tarea->titulo}», que estaba cerrada." . ($motivo ? " {$motivo}" : '');

        self::campana([(int) $tarea->empleado], $actorEmpleado ? (int) $actorEmpleado : null, $mensaje, (int) $tarea->id, 'Reabierta');

        $datos = self::datosTarea($tarea, self::nombreEmpleado((int) $tarea->empleado)) + ['actor' => $actor, 'observacion' => $motivo];
        self::correo(
            self::destinosDeEmpleados([(int) $tarea->empleado]),
            fn ($d) => new AvisoTareaCorreo('reabierta', $d['nombre'], $datos),
            "reapertura de la tarea {$tarea->id}"
        );
    }

    // ─── Apoyo ──────────────────────────────────────────────────────────────

    public static function nombreEmpleado(int $id): string
    {
        return trim((string) DB::connection('mysql2')->table('empleados')
            ->where('id', $id)
            ->selectRaw('CONCAT(nombres, " ", apellidos) as n')
            ->value('n'));
    }

    private static function primerNombre(?string $nombre): string
    {
        $n = trim((string) $nombre);
        return $n === '' ? '' : (strtok($n, ' ') ?: $n);
    }

    private static function datosTarea(object $tarea, string $responsable): array
    {
        $proyecto = !empty($tarea->proyecto_id)
            ? DB::connection('mysql2')->table('proyectos')->where('id', $tarea->proyecto_id)->value('nombre')
            : null;

        return [
            'id'              => (int) $tarea->id,
            'titulo'          => $tarea->titulo,
            'responsable'     => $responsable,
            'proyecto'        => $proyecto,
            'fecha_pactada'   => $tarea->fecha_pactada ?? null,
            'fecha_entregada' => $tarea->fecha_entregada ?? null,
        ];
    }
}
