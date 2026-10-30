<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

/**
 * Espacio de equipo: Actividad y Reuniones.
 *
 * Va aparte de EmpleadosController, que ya pasa de tres mil líneas y mezcla
 * demasiados dominios. Aquí sólo vive lo que el equipo usa para seguirse entre
 * sí: el flujo de lo que ha pasado y las reuniones que vienen.
 *
 * Como en el resto del proyecto, se usa el constructor de consultas sobre la
 * conexión «mysql2» en lugar de Eloquent.
 */
class EspacioEquipoController extends Controller
{
    /** Eventos por página en el flujo de actividad. */
    private const POR_PAGINA = 40;

    // ─── Actividad ──────────────────────────────────────────────────────────

    /**
     * Flujo de actividad del equipo.
     *
     * Lee los eventos que registrarActividad() deja en notif_generales con
     * tipo_emisor «sistema»: cada cambio de estado, pausa, reprogramación,
     * impedimento o punto de checklist de una tarea.
     *
     * Se ordena por fecha_creacion y no por fecha: esta última es un DATE sin
     * hora, con la que todos los eventos de un mismo día quedarían empatados.
     */
    public function actividad(Request $request)
    {
        $alcance = $this->empleadosVisibles();
        if ($alcance === []) {
            return response()->json(['eventos' => [], 'hay_mas' => false]);
        }

        $pagina = max(1, (int) $request->query('pagina', 1));
        $tipo = trim((string) $request->query('tipo', ''));

        // Las tareas acotan el alcance: un evento es visible si su tarea está
        // asignada a alguien que el usuario puede ver. Sin esta junta, el
        // flujo mostraría movimientos de toda la organización.
        $q = DB::connection('mysql2')->table('notif_generales as n')
            ->join('tareas_empleados as te', 'n.tarea_id', '=', 'te.id')
            ->leftJoin('empleados as e', 'te.empleado', '=', 'e.id')
            ->where('n.tipo_emisor', 'sistema')
            ->whereNotNull('n.tarea_id')
            // Las archivadas siguen apareciendo: su historial es parte de lo
            // que pasó, y ocultarlo dejaría huecos sin explicación en el flujo.
            ->where(fn ($w) => $w->whereNull('te.estado_reg')->orWhere('te.estado_reg', '<>', 'Eliminado'));

        if ($alcance !== null) {
            $q->whereIn('te.empleado', $alcance);
        }

        if ($tipo !== '') {
            $q->where('n.tipo', $tipo);
        }

        $filas = $q->select(
                'n.id',
                'n.mensaje',
                'n.tipo',
                'n.fecha_creacion',
                'n.tarea_id',
                'te.titulo as tarea_titulo',
                'te.estado as tarea_estado',
                'e.id as empleado_id',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as empleado')
            )
            ->orderByDesc('n.fecha_creacion')
            ->offset(($pagina - 1) * self::POR_PAGINA)
            // Se pide uno de más para saber si quedan páginas sin contar el total.
            ->limit(self::POR_PAGINA + 1)
            ->get();

        $hayMas = $filas->count() > self::POR_PAGINA;
        $eventos = $filas->take(self::POR_PAGINA)->map(function ($f) {
            return [
                'id'           => (int) $f->id,
                'mensaje'      => $f->mensaje,
                'tipo'         => $f->tipo,
                'cuando'       => $f->fecha_creacion,
                'tarea_id'     => (int) $f->tarea_id,
                'tarea_titulo' => $f->tarea_titulo,
                'tarea_estado' => $f->tarea_estado,
                'empleado_id'  => $f->empleado_id ? (int) $f->empleado_id : null,
                'empleado'     => $f->empleado,
            ];
        })->values();

        return response()->json([
            'eventos'  => $eventos,
            'hay_mas'  => $hayMas,
            'tipos'    => $this->tiposDeActividad($alcance),
        ]);
    }

    /** Tipos de evento presentes en el alcance, para poblar el filtro. */
    private function tiposDeActividad(?array $alcance): array
    {
        $q = DB::connection('mysql2')->table('notif_generales as n')
            ->join('tareas_empleados as te', 'n.tarea_id', '=', 'te.id')
            ->where('n.tipo_emisor', 'sistema')
            ->whereNotNull('n.tipo');

        if ($alcance !== null) {
            $q->whereIn('te.empleado', $alcance);
        }

        return $q->distinct()->orderBy('n.tipo')->pluck('n.tipo')->all();
    }

    // ─── Reuniones ──────────────────────────────────────────────────────────

    /**
     * Reuniones visibles: las que organiza el usuario y aquellas a las que
     * está convocado. No se devuelven las de terceros aunque sean del equipo:
     * una reunión es de quien participa en ella.
     */
    public function reuniones(Request $request)
    {
        $yo = $this->empleadoActual();
        if (!$yo) {
            return response()->json(['reuniones' => []]);
        }

        $pasadas = $request->boolean('pasadas');
        $hoy = Carbon::today()->toDateString();

        $mias = DB::connection('mysql2')->table('reuniones_asistentes')
            ->where('empleado', $yo)
            ->pluck('reunion')
            ->all();

        $q = DB::connection('mysql2')->table('reuniones as r')
            ->leftJoin('empleados as e', 'r.organizador', '=', 'e.id')
            ->where(function ($w) use ($yo, $mias) {
                $w->where('r.organizador', $yo);
                if ($mias !== []) {
                    $w->orWhereIn('r.id', $mias);
                }
            });

        // Las canceladas sólo se ven mientras no hayan pasado: después son ruido.
        $q->where(fn ($w) => $w->where('r.estado', '<>', 'Cancelada')->orWhere('r.fecha', '>=', $hoy));

        if ($pasadas) {
            $q->where('r.fecha', '<', $hoy)->orderByDesc('r.fecha')->orderByDesc('r.hora_inicio');
        } else {
            $q->where('r.fecha', '>=', $hoy)->orderBy('r.fecha')->orderBy('r.hora_inicio');
        }

        $reuniones = $q->select(
                'r.*',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as organizador_nombre')
            )
            ->limit(100)
            ->get();

        if ($reuniones->isEmpty()) {
            return response()->json(['reuniones' => [], 'yo' => $yo]);
        }

        $asistentes = DB::connection('mysql2')->table('reuniones_asistentes as ra')
            ->leftJoin('empleados as e', 'ra.empleado', '=', 'e.id')
            ->whereIn('ra.reunion', $reuniones->pluck('id'))
            ->select(
                'ra.reunion',
                'ra.empleado',
                'ra.respuesta',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre')
            )
            ->get()
            ->groupBy('reunion');

        $salida = $reuniones->map(function ($r) use ($asistentes, $yo) {
            $gente = collect($asistentes[$r->id] ?? []);
            $mia = $gente->firstWhere('empleado', $yo);

            return [
                'id'           => (int) $r->id,
                'titulo'       => $r->titulo,
                'descripcion'  => $r->descripcion,
                'fecha'        => $r->fecha,
                'hora_inicio'  => substr((string) $r->hora_inicio, 0, 5),
                'hora_fin'     => $r->hora_fin ? substr((string) $r->hora_fin, 0, 5) : null,
                'enlace'       => $r->enlace,
                'lugar'        => $r->lugar,
                'estado'       => $r->estado,
                'soy_organizador' => (int) $r->organizador === $yo,
                'organizador'  => $r->organizador_nombre,
                'mi_respuesta' => $mia->respuesta ?? null,
                'asistentes'   => $gente->map(fn ($a) => [
                    'empleado'  => (int) $a->empleado,
                    'nombre'    => $a->nombre,
                    'respuesta' => $a->respuesta,
                ])->values(),
            ];
        });

        return response()->json(['reuniones' => $salida, 'yo' => $yo]);
    }

    /** Crea una reunión y convoca a sus asistentes. */
    public function crearReunion(Request $request)
    {
        $yo = $this->empleadoActual();
        if (!$yo) {
            return response()->json(['error' => 'Sin empleado asociado.'], 403);
        }

        $datos = $request->validate([
            'titulo'      => 'required|string|max:200',
            'descripcion' => 'nullable|string',
            'fecha'       => 'required|date',
            'hora_inicio' => 'required|date_format:H:i',
            'hora_fin'    => 'nullable|date_format:H:i|after:hora_inicio',
            'enlace'      => 'nullable|url|max:500',
            'lugar'       => 'nullable|string|max:200',
            'asistentes'  => 'array',
            'asistentes.*' => 'integer',
        ]);

        // Sólo se convoca a gente que el usuario puede ver: sin esto, un id
        // cualquiera en la petición metería a un desconocido en la reunión.
        $permitidos = $this->empleadosVisibles();
        $invitados = collect($datos['asistentes'] ?? [])
            ->map(fn ($i) => (int) $i)
            ->filter(fn ($i) => $permitidos === null || in_array($i, $permitidos, true))
            ->push($yo)                 // el organizador siempre asiste
            ->unique()
            ->values();

        $id = DB::connection('mysql2')->table('reuniones')->insertGetId([
            'titulo'      => $datos['titulo'],
            'descripcion' => $datos['descripcion'] ?? null,
            'fecha'       => $datos['fecha'],
            'hora_inicio' => $datos['hora_inicio'],
            'hora_fin'    => $datos['hora_fin'] ?? null,
            'enlace'      => $datos['enlace'] ?? null,
            'lugar'       => $datos['lugar'] ?? null,
            'organizador' => $yo,
            'estado'      => 'Programada',
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        DB::connection('mysql2')->table('reuniones_asistentes')->insert(
            $invitados->map(fn ($e) => [
                'reunion'    => $id,
                'empleado'   => $e,
                // El organizador no se invita a sí mismo: ya ha aceptado.
                'respuesta'  => $e === $yo ? 'Acepta' : 'Pendiente',
                'created_at' => now(),
                'updated_at' => now(),
            ])->all()
        );

        return response()->json(['success' => 'Reunión creada', 'id' => $id], 201);
    }

    /** Acepta o rechaza una convocatoria. */
    public function responderReunion(Request $request, $id)
    {
        $yo = $this->empleadoActual();
        if (!$yo) {
            return response()->json(['error' => 'Sin empleado asociado.'], 403);
        }

        $datos = $request->validate([
            'respuesta' => 'required|in:Acepta,Rechaza,Pendiente',
        ]);

        $filas = DB::connection('mysql2')->table('reuniones_asistentes')
            ->where('reunion', $id)
            ->where('empleado', $yo)
            ->update([
                'respuesta'  => $datos['respuesta'],
                'updated_at' => now(),
            ]);

        if ($filas === 0) {
            return response()->json(['error' => 'No está convocado a esta reunión.'], 403);
        }

        return response()->json(['success' => 'Respuesta registrada']);
    }

    /** Cancela una reunión. Sólo el organizador puede hacerlo. */
    public function cancelarReunion($id)
    {
        $yo = $this->empleadoActual();
        $reunion = DB::connection('mysql2')->table('reuniones')->where('id', $id)->first();

        if (!$reunion) {
            return response()->json(['error' => 'La reunión no existe.'], 404);
        }

        if (!$yo || (int) $reunion->organizador !== $yo) {
            return response()->json(['error' => 'Sólo el organizador puede cancelarla.'], 403);
        }

        // Se marca cancelada en vez de borrarla: los convocados deben poder
        // ver que se canceló, no que desapareció sin explicación.
        DB::connection('mysql2')->table('reuniones')->where('id', $id)->update([
            'estado'     => 'Cancelada',
            'updated_at' => now(),
        ]);

        return response()->json(['success' => 'Reunión cancelada']);
    }

    /** Empleados a los que se puede convocar: el alcance del usuario. */
    public function convocables()
    {
        $alcance = $this->empleadosVisibles();

        $q = DB::connection('mysql2')->table('empleados as e')
            ->leftJoin('cargos as c', 'e.cargo', '=', 'c.id')
            ->where('e.estado_registro', 'Activo')
            ->where('e.estado', 'Activo');

        if ($alcance !== null) {
            if ($alcance === []) {
                return response()->json([]);
            }
            $q->whereIn('e.id', $alcance);
        }

        return response()->json(
            $q->select(
                'e.id',
                'c.nombre as cargo',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre')
            )->orderBy('nombre')->get()
        );
    }

    // ─── Detalle de un puesto ───────────────────────────────────────────────

    /**
     * Estado de entregado a la espera de que el líder verifique.
     *
     * Se repite aquí porque la de EmpleadosController es privada; el valor es
     * el que está escrito en la base, así que duplicarlo no la desincroniza.
     */
    private const EN_REVISION = 'En Revisión';


    /**
     * Todo lo de una persona para el panel del plano: sus tareas vivas, su
     * actividad reciente y con qué clave hablarle.
     *
     * Va en una sola petición porque el panel se abre de golpe: tres llamadas
     * para pintar un lateral harían que apareciera a trozos.
     *
     * Devuelve el trabajo, no permisos: abrir o mover una tarea sigue pasando
     * por los controles de cada endpoint.
     */
    public function puesto(Request $request, $empleado)
    {
        $yo = $this->empleadoActual();
        $empleado = (int) $empleado;

        $conn = DB::connection('mysql2');

        $persona = $conn->table('empleados as e')
            ->leftJoin('cargos as c', 'e.cargo', '=', 'c.id')
            ->leftJoin('departamentos as d', 'e.departamento', '=', 'd.id')
            ->where('e.id', $empleado)
            ->where('e.estado_registro', 'Activo')
            ->where('e.estado', 'Activo')
            ->select(
                'e.id',
                'e.email',
                'c.nombre as cargo',
                'd.nombre as departamento',
                $conn->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre')
            )
            ->first();

        if (!$persona) {
            return response()->json(['error' => 'Empleado no disponible.'], 404);
        }

        $hoy = Carbon::today();

        // Las tareas vivas: lo que explica el estado del puesto. Las
        // completadas quedan fuera porque ya no dicen nada del ahora.
        $tareas = $conn->table('tareas_empleados as t')
            ->leftJoin('proyectos as p', 't.proyecto_id', '=', 'p.id')
            ->where('t.empleado', $empleado)
            ->whereIn('t.estado', ['Pendiente', 'En Proceso', self::EN_REVISION])
            ->where(fn ($w) => $w->whereNull('t.archivar')->orWhere('t.archivar', '<>', 1))
            ->select(
                't.id',
                't.titulo',
                't.estado',
                't.prioridad',
                't.fecha_pactada',
                't.pausada',
                't.bloqueada',
                DB::connection('mysql2')->raw(CriteriosAceptacionController::sqlConteo('t') . ' as n_criterios'),
                'p.nombre as proyecto'
            )
            ->orderByRaw('t.fecha_pactada IS NULL, t.fecha_pactada')
            ->limit(40)
            ->get()
            ->map(function ($t) use ($hoy) {
                $pactada = $t->fecha_pactada ? Carbon::parse($t->fecha_pactada) : null;

                return [
                    'id'            => (int) $t->id,
                    'titulo'        => $t->titulo,
                    'estado'        => $t->estado,
                    'prioridad'     => $t->prioridad,
                    'proyecto'      => $t->proyecto,
                    'fecha_pactada' => $t->fecha_pactada,
                    'pausada'       => (int) ($t->pausada ?? 0) === 1,
                    'bloqueada'     => (int) ($t->bloqueada ?? 0) === 1,
                    'sin_criterio'  => (int) $t->n_criterios === 0,
                    'atrasada'      => $pactada && $pactada->lt($hoy) && $t->estado !== self::EN_REVISION,
                    'dias'          => $pactada ? $hoy->diffInDays($pactada, false) : null,
                ];
            });

        // Su actividad reciente, la misma que alimenta el flujo general pero
        // acotada a esta persona: el evento se lee mejor junto a su trabajo.
        $actividad = $conn->table('notif_generales as n')
            ->join('tareas_empleados as te', 'n.tarea_id', '=', 'te.id')
            ->where('n.tipo_emisor', 'sistema')
            ->where('te.empleado', $empleado)
            ->select('n.id', 'n.mensaje', 'n.tipo', 'n.fecha_creacion', 'te.titulo as tarea_titulo')
            ->orderByDesc('n.fecha_creacion')
            ->limit(12)
            ->get()
            ->map(fn ($a) => [
                'id'           => (int) $a->id,
                'mensaje'      => $a->mensaje,
                'tipo'         => $a->tipo,
                'cuando'       => $a->fecha_creacion,
                'tarea_titulo' => $a->tarea_titulo,
            ]);

        return response()->json([
            'persona' => [
                'id'           => (int) $persona->id,
                'nombre'       => $persona->nombre,
                'cargo'        => $persona->cargo,
                'departamento' => $persona->departamento,
            ],
            // Con quién se habla y en qué sala se llama. La sala lleva los dos
            // ids para que ambos extremos construyan el mismo nombre sin
            // acordar nada, y un prefijo propio para no chocar con salas
            // ajenas en el servidor público de Jitsi.
            'chat'  => $yo && $yo !== $empleado ? $this->claveDirecto($yo, $empleado) : null,
            'sala'  => $yo && $yo !== $empleado ? $this->salaDeVideo($yo, $empleado) : null,
            'soy_yo' => $yo === $empleado,
            'tareas' => $tareas,
            'resumen' => [
                'vivas'      => $tareas->count(),
                'proceso'    => $tareas->where('estado', 'En Proceso')->count(),
                'revision'   => $tareas->where('estado', self::EN_REVISION)->count(),
                'atrasadas'  => $tareas->where('atrasada', true)->count(),
                'bloqueadas' => $tareas->where('bloqueada', true)->count(),
                'pausadas'   => $tareas->where('pausada', true)->count(),
            ],
            'actividad' => $actividad,
        ]);
    }

    /**
     * Nombre de la sala de vídeo de dos personas.
     *
     * El servidor público de Jitsi abre cualquier sala por su nombre, así que
     * el nombre debe ser difícil de adivinar: se deriva de los ids y de
     * APP_KEY, que no sale de aquí. Sin eso, «workboard-20-43» sería una sala
     * que cualquiera podría abrir desde fuera.
     */
    private function salaDeVideo(int $a, int $b): string
    {
        $par = [$a, $b];
        sort($par);

        $huella = substr(
            hash_hmac('sha256', 'sala:'.$par[0].'-'.$par[1], (string) config('app.key')),
            0,
            24
        );

        return 'wb-'.$huella;
    }

    // ─── Llamadas ───────────────────────────────────────────────────────────

    /**
     * Segundos que una llamada sigue sonando antes de darse por perdida.
     *
     * Sin caducidad, cerrar la pestaña dejaría el aviso sonando para siempre
     * en la pantalla del otro.
     */
    private const LLAMADA_VIVE = 45;

    /** Inicia una llamada: deja constancia para que suene en la otra pantalla. */
    public function llamar(Request $request)
    {
        $yo = $this->empleadoActual();
        if (!$yo) {
            return response()->json(['error' => 'Sin empleado asociado.'], 403);
        }

        $datos = $request->validate([
            'receptor' => 'required|integer',
        ]);

        $receptor = (int) $datos['receptor'];
        if ($receptor === $yo) {
            return response()->json(['error' => 'No puede llamarse a sí mismo.'], 422);
        }

        $existe = DB::connection('mysql2')->table('empleados')
            ->where('id', $receptor)
            ->where('estado_registro', 'Activo')
            ->where('estado', 'Activo')
            ->exists();

        if (!$existe) {
            return response()->json(['error' => 'Esa persona no está disponible.'], 404);
        }

        $conn = DB::connection('mysql2');

        // Si ya hay una llamada viva entre los dos se reutiliza, para que
        // pulsar dos veces no haga sonar dos avisos.
        $viva = $conn->table('llamadas')
            ->where('emisor', $yo)
            ->where('receptor', $receptor)
            ->where('estado', 'Sonando')
            ->where('created_at', '>=', now()->subSeconds(self::LLAMADA_VIVE))
            ->first();

        if ($viva) {
            return response()->json(['id' => $viva->id, 'sala' => $viva->sala]);
        }

        $sala = $this->salaDeVideo($yo, $receptor);

        $id = $conn->table('llamadas')->insertGetId([
            'emisor'     => $yo,
            'receptor'   => $receptor,
            'sala'       => $sala,
            'estado'     => 'Sonando',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['id' => $id, 'sala' => $sala], 201);
    }

    /**
     * Llamada entrante, si la hay.
     *
     * Lo consulta el sondeo del timbre desde cualquier pantalla, así que
     * devuelve lo mínimo y nada cuando no hay nada: es la petición que más
     * veces se repite de toda la aplicación.
     */
    public function llamadaEntrante()
    {
        $yo = $this->empleadoActual();
        if (!$yo) {
            return response()->json(['llamada' => null]);
        }

        $conn = DB::connection('mysql2');

        $l = $conn->table('llamadas as l')
            ->leftJoin('empleados as e', 'l.emisor', '=', 'e.id')
            ->where('l.receptor', $yo)
            ->where('l.estado', 'Sonando')
            ->where('l.created_at', '>=', now()->subSeconds(self::LLAMADA_VIVE))
            ->orderByDesc('l.id')
            ->select(
                'l.id',
                'l.sala',
                'l.emisor',
                'l.created_at',
                $conn->raw('CONCAT(e.nombres, " ", e.apellidos) as quien')
            )
            ->first();

        if (!$l) {
            return response()->json(['llamada' => null]);
        }

        return response()->json(['llamada' => [
            'id'     => (int) $l->id,
            'sala'   => $l->sala,
            'emisor' => (int) $l->emisor,
            'quien'  => $l->quien,
            'cuando' => $l->created_at,
        ]]);
    }

    /**
     * Estado de una llamada propia.
     *
     * Quien llama necesita saber si le contestaron o le colgaron, para dejar
     * de esperar en una sala vacía.
     */
    public function estadoLlamada($id)
    {
        $yo = $this->empleadoActual();

        $l = DB::connection('mysql2')->table('llamadas')->where('id', $id)->first();
        if (!$l || !$yo || ((int) $l->emisor !== $yo && (int) $l->receptor !== $yo)) {
            return response()->json(['error' => 'Llamada no disponible.'], 403);
        }

        $caducada = $l->estado === 'Sonando'
            && Carbon::parse($l->created_at)->lt(now()->subSeconds(self::LLAMADA_VIVE));

        return response()->json([
            'estado' => $caducada ? 'Cancelada' : $l->estado,
            'sala'   => $l->sala,
        ]);
    }

    /** Responde o cancela una llamada. */
    public function responderLlamada(Request $request, $id)
    {
        $yo = $this->empleadoActual();

        $datos = $request->validate([
            'estado' => 'required|in:Aceptada,Rechazada,Cancelada',
        ]);

        $l = DB::connection('mysql2')->table('llamadas')->where('id', $id)->first();
        if (!$l || !$yo) {
            return response()->json(['error' => 'Llamada no disponible.'], 404);
        }

        // Aceptar y rechazar son del receptor; cancelar, de quien llamó.
        $puede = $datos['estado'] === 'Cancelada'
            ? (int) $l->emisor === $yo
            : (int) $l->receptor === $yo;

        if (!$puede) {
            return response()->json(['error' => 'No puede responder esta llamada.'], 403);
        }

        DB::connection('mysql2')->table('llamadas')->where('id', $id)->update([
            'estado'     => $datos['estado'],
            'updated_at' => now(),
        ]);

        return response()->json(['success' => true, 'sala' => $l->sala]);
    }

    // ─── Chat ───────────────────────────────────────────────────────────────

    /** Mensajes que se devuelven de una conversación. */
    private const MENSAJES_POR_PAGINA = 60;

    /**
     * Canales del usuario: el de cada departamento y los directos que ya tiene
     * abiertos, más la gente con la que puede empezar uno.
     *
     * Los canales de departamento no se administran: existen porque existe el
     * departamento. La fila se crea la primera vez que alguien escribe.
     */
    public function chatCanales()
    {
        $yo = $this->empleadoActual();
        if (!$yo) {
            return response()->json(['canales' => [], 'directos' => [], 'contactos' => []]);
        }

        $conn = DB::connection('mysql2');

        $miDepto = (int) $conn->table('empleados')->where('id', $yo)->value('departamento');

        // Un canal por departamento con gente activa. Se ofrecen todos para
        // poder preguntar a otra área, igual que el plano muestra la
        // organización entera.
        $departamentos = $conn->table('departamentos as d')
            ->join('empleados as e', 'e.departamento', '=', 'd.id')
            ->where('e.estado_registro', 'Activo')
            ->where('e.estado', 'Activo')
            ->select('d.id', 'd.nombre', $conn->raw('COUNT(e.id) as personas'))
            ->groupBy('d.id', 'd.nombre')
            ->orderBy('d.nombre')
            ->get();

        $conversaciones = $conn->table('chat_conversaciones')
            ->whereIn('clave', $departamentos->map(fn ($d) => 'dep:'.$d->id)->all())
            ->get()->keyBy('clave');

        $sinLeer = $this->mensajesSinLeer($yo);

        $canales = $departamentos->map(function ($d) use ($conversaciones, $miDepto, $sinLeer) {
            $conv = $conversaciones['dep:'.$d->id] ?? null;

            return [
                'clave'    => 'dep:'.$d->id,
                'nombre'   => $d->nombre,
                'personas' => (int) $d->personas,
                'es_mio'   => (int) $d->id === $miDepto,
                'sin_leer' => $conv ? ($sinLeer[$conv->id] ?? 0) : 0,
            ];
        })->sortByDesc('es_mio')->values();

        // Directos ya abiertos: los que tienen al menos un mensaje.
        $directos = $conn->table('chat_conversaciones as c')
            ->join('chat_mensajes as m', 'm.conversacion', '=', 'c.id')
            ->where('c.tipo', 'directo')
            ->select('c.id', 'c.clave', $conn->raw('MAX(m.id) as ultimo'))
            ->groupBy('c.id', 'c.clave')
            ->get()
            ->filter(fn ($c) => in_array($yo, $this->paresDeDirecto($c->clave), true))
            ->values();

        $otros = $directos->map(function ($c) use ($yo) {
            $par = $this->paresDeDirecto($c->clave);
            return (int) ($par[0] === $yo ? $par[1] : $par[0]);
        })->all();

        $nombres = $otros === [] ? collect() : $conn->table('empleados')
            ->whereIn('id', $otros)
            ->select('id', $conn->raw('CONCAT(nombres, " ", apellidos) as nombre'))
            ->get()->keyBy('id');

        $listaDirectos = $directos->map(function ($c) use ($yo, $nombres, $sinLeer) {
            $par = $this->paresDeDirecto($c->clave);
            $otro = (int) ($par[0] === $yo ? $par[1] : $par[0]);

            return [
                'clave'    => $c->clave,
                'nombre'   => $nombres[$otro]->nombre ?? 'Empleado',
                'empleado' => $otro,
                'sin_leer' => $sinLeer[$c->id] ?? 0,
                'ultimo'   => (int) $c->ultimo,
            ];
        })->sortByDesc('ultimo')->values();

        return response()->json([
            'canales'   => $canales,
            'directos'  => $listaDirectos,
            'contactos' => $this->contactosParaChat($yo),
            'yo'        => $yo,
        ]);
    }

    /** Gente con la que se puede abrir un directo. */
    private function contactosParaChat(int $yo): array
    {
        $conn = DB::connection('mysql2');

        return $conn->table('empleados as e')
            ->leftJoin('cargos as c', 'e.cargo', '=', 'c.id')
            ->leftJoin('departamentos as d', 'e.departamento', '=', 'd.id')
            ->where('e.estado_registro', 'Activo')
            ->where('e.estado', 'Activo')
            ->where('e.id', '<>', $yo)
            ->select(
                'e.id',
                'c.nombre as cargo',
                'd.nombre as departamento',
                $conn->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre')
            )
            ->orderBy('nombre')
            ->get()
            ->map(fn ($p) => [
                'id'           => (int) $p->id,
                'nombre'       => $p->nombre,
                'cargo'        => $p->cargo,
                'departamento' => $p->departamento,
                'clave'        => $this->claveDirecto($yo, (int) $p->id),
            ])
            ->all();
    }

    /** Mensajes de una conversación. */
    public function chatMensajes(Request $request)
    {
        $yo = $this->empleadoActual();
        $clave = (string) $request->query('clave', '');

        if (!$yo || !$this->puedeVerConversacion($yo, $clave)) {
            return response()->json(['error' => 'Conversación no disponible.'], 403);
        }

        $conn = DB::connection('mysql2');
        $conv = $conn->table('chat_conversaciones')->where('clave', $clave)->first();

        if (!$conv) {
            // Todavía no existe: no es un error, sencillamente nadie ha escrito.
            return response()->json([
                'mensajes' => [],
                'titulo'   => $this->tituloConversacion($yo, $clave),
            ]);
        }

        // Se piden los últimos y se devuelven en orden de lectura; pedirlos
        // ascendentes obligaría a traer la conversación entera.
        $mensajes = $conn->table('chat_mensajes as m')
            ->leftJoin('empleados as e', 'm.empleado', '=', 'e.id')
            ->where('m.conversacion', $conv->id)
            ->when(
                $request->filled('desde'),
                fn ($q) => $q->where('m.id', '>', (int) $request->query('desde'))
            )
            ->select(
                'm.id',
                'm.mensaje',
                'm.empleado',
                'm.created_at',
                $conn->raw('CONCAT(e.nombres, " ", e.apellidos) as autor')
            )
            ->orderByDesc('m.id')
            ->limit(self::MENSAJES_POR_PAGINA)
            ->get()
            ->reverse()
            ->values()
            ->map(fn ($m) => [
                'id'       => (int) $m->id,
                'mensaje'  => $m->mensaje,
                'empleado' => (int) $m->empleado,
                'autor'    => $m->autor,
                'mio'      => (int) $m->empleado === $yo,
                'cuando'   => $m->created_at,
            ]);

        $ultimo = $mensajes->last();
        $this->marcarLeido($conv->id, $yo, (int) ($ultimo['id'] ?? 0));

        return response()->json([
            'mensajes' => $mensajes,
            'titulo'   => $this->tituloConversacion($yo, $clave),
        ]);
    }

    /** Envía un mensaje, creando la conversación si es la primera vez. */
    public function chatEnviar(Request $request)
    {
        $yo = $this->empleadoActual();
        if (!$yo) {
            return response()->json(['error' => 'Sin empleado asociado.'], 403);
        }

        $datos = $request->validate([
            'clave'   => 'required|string|max:60',
            'mensaje' => 'required|string|max:4000',
        ]);

        if (!$this->puedeVerConversacion($yo, $datos['clave'])) {
            return response()->json(['error' => 'Conversación no disponible.'], 403);
        }

        $texto = trim($datos['mensaje']);
        if ($texto === '') {
            return response()->json(['error' => 'El mensaje está vacío.'], 422);
        }

        $conn = DB::connection('mysql2');
        $conv = $conn->table('chat_conversaciones')->where('clave', $datos['clave'])->first();

        if ($conv) {
            $id = $conv->id;
        } else {
            $esDepto = str_starts_with($datos['clave'], 'dep:');
            $id = $conn->table('chat_conversaciones')->insertGetId([
                'clave'        => $datos['clave'],
                'tipo'         => $esDepto ? 'departamento' : 'directo',
                'departamento' => $esDepto ? (int) substr($datos['clave'], 4) : null,
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);
        }

        $idMensaje = $conn->table('chat_mensajes')->insertGetId([
            'conversacion' => $id,
            'empleado'     => $yo,
            'mensaje'      => $texto,
            'created_at'   => now(),
            'updated_at'   => now(),
        ]);

        // Quien escribe ya ha leído lo que escribe.
        $this->marcarLeido($id, $yo, $idMensaje);

        return response()->json(['success' => true, 'id' => $idMensaje], 201);
    }

    /** Guarda hasta dónde ha leído alguien. */
    private function marcarLeido(int $conversacion, int $empleado, int $hasta): void
    {
        if ($hasta <= 0) {
            return;
        }

        DB::connection('mysql2')->table('chat_lecturas')->updateOrInsert(
            ['conversacion' => $conversacion, 'empleado' => $empleado],
            ['ultimo_leido' => $hasta, 'updated_at' => now()]
        );
    }

    /**
     * Mensajes sin leer por conversación, indexados por id de conversación.
     *
     * Sólo cuentan las conversaciones en las que la persona ya ha entrado
     * alguna vez: de lo contrario, el canal de cada departamento aparecería
     * el primer día con todo su historial marcado como sin leer.
     */
    private function mensajesSinLeer(int $empleado): array
    {
        $conn = DB::connection('mysql2');

        return $conn->table('chat_lecturas as l')
            ->join('chat_mensajes as m', function ($j) {
                $j->on('m.conversacion', '=', 'l.conversacion')
                  ->whereColumn('m.id', '>', 'l.ultimo_leido');
            })
            ->where('l.empleado', $empleado)
            ->where('m.empleado', '<>', $empleado)
            ->select('l.conversacion', $conn->raw('COUNT(m.id) as n'))
            ->groupBy('l.conversacion')
            ->pluck('n', 'conversacion')
            ->map(fn ($n) => (int) $n)
            ->all();
    }

    /** Ids de un directo a partir de su clave «dir:a-b». */
    private function paresDeDirecto(string $clave): array
    {
        if (!str_starts_with($clave, 'dir:')) {
            return [];
        }

        return array_map('intval', explode('-', substr($clave, 4)));
    }

    /** Clave canónica de un directo: ids ordenados, para que sea la misma en ambos sentidos. */
    private function claveDirecto(int $a, int $b): string
    {
        $par = [$a, $b];
        sort($par);

        return 'dir:'.$par[0].'-'.$par[1];
    }

    /**
     * Si el usuario puede leer y escribir en esa conversación.
     *
     * Los canales de departamento son abiertos: el plano ya muestra la
     * organización entera y aislar las áreas haría el chat inútil para
     * preguntar fuera de la propia. Los directos, sólo si él es uno de los
     * dos extremos.
     */
    private function puedeVerConversacion(int $yo, string $clave): bool
    {
        if (str_starts_with($clave, 'dep:')) {
            $id = (int) substr($clave, 4);

            return $id > 0 && DB::connection('mysql2')->table('departamentos')
                ->where('id', $id)->exists();
        }

        $par = $this->paresDeDirecto($clave);

        return count($par) === 2 && in_array($yo, $par, true) && $par[0] !== $par[1];
    }

    /** Nombre que se muestra en la cabecera de la conversación. */
    private function tituloConversacion(int $yo, string $clave): string
    {
        if (str_starts_with($clave, 'dep:')) {
            return (string) DB::connection('mysql2')->table('departamentos')
                ->where('id', (int) substr($clave, 4))->value('nombre');
        }

        $par = $this->paresDeDirecto($clave);
        $otro = ($par[0] ?? 0) === $yo ? ($par[1] ?? 0) : ($par[0] ?? 0);

        return (string) DB::connection('mysql2')->table('empleados')
            ->where('id', $otro)
            ->selectRaw('CONCAT(nombres, " ", apellidos) as n')
            ->value('n');
    }

    // ─── Alcance ────────────────────────────────────────────────────────────

    /** Id de empleado del usuario autenticado, o null. */
    private function empleadoActual(): ?int
    {
        $email = Auth::user()->email ?? null;
        if (!$email) {
            return null;
        }

        $u = DB::connection('mysql2')->table('users')->where('email', $email)->first();
        return $u && $u->empleado ? (int) $u->empleado : null;
    }

    /**
     * Empleados que el usuario puede ver.
     *
     * Devuelve null cuando no hay restricción (administrador y supervisor),
     * [] cuando no puede ver nada, y la lista de ids en el resto de casos.
     * Replica el criterio de alcanceEmpleadosInformes() para que la actividad
     * no enseñe más de lo que ya enseñan los informes.
     */
    private function empleadosVisibles(): ?array
    {
        $email = Auth::user()->email ?? null;
        if (!$email) {
            return [];
        }

        $u = DB::connection('mysql2')->table('users')->where('email', $email)->first();
        if (!$u) {
            return [];
        }

        $tipo = strtolower(trim($u->tipo_usuario ?? ''));
        if ($tipo === 'administrador' || $tipo === 'supervisor') {
            return null;
        }

        $empleado = $u->empleado ?? null;
        if (!$empleado) {
            return [];
        }

        $ids = DB::connection('mysql2')->table('lideres_empleados as le')
            ->join('empleados as e', 'le.empleado', '=', 'e.id')
            ->where('le.lider', $empleado)
            ->where('e.estado_registro', 'Activo')
            ->where('e.estado', 'Activo')
            ->pluck('e.id')
            ->map(fn ($i) => (int) $i)
            ->all();

        $ids[] = (int) $empleado;

        return array_values(array_unique($ids));
    }
}
