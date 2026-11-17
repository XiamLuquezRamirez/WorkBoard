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

    /**
     * Crea una reunión y convoca a sus asistentes.
     *
     * Se puede convocar a cualquier colaborador activo, sea del departamento
     * que sea: una reunión junta a quien haga falta, no sólo al equipo de un
     * líder. Cada convocado recibe el aviso en la campana, la copia por correo
     * y la ve como pendiente en «Mis Tareas» hasta que responda.
     */
    public function crearReunion(Request $request)
    {
        $yo = $this->empleadoActual();
        if (!$yo) {
            return response()->json(['error' => 'Sin empleado asociado.'], 403);
        }

        $datos = $request->validate([
            'titulo'      => 'required|string|max:200',
            'descripcion' => 'nullable|string|max:4000',
            'fecha'       => 'required|date_format:Y-m-d|after_or_equal:' . Carbon::today(\App\Mail\ConvocatoriaReunionCorreo::ZONA)->toDateString(),
            'hora_inicio' => 'required|date_format:H:i',
            'hora_fin'    => 'nullable|date_format:H:i|after:hora_inicio',
            'enlace'      => 'nullable|url|max:500',
            'lugar'       => 'nullable|string|max:200',
            'asistentes'  => 'required|array|min:1',
            'asistentes.*' => 'integer',
        ], [
            'asistentes.required' => 'Elige al menos un participante.',
            'asistentes.min'      => 'Elige al menos un participante.',
            'fecha.after_or_equal' => 'La fecha ya pasó.',
            'hora_fin.after'      => 'La hora de fin debe ser posterior a la de inicio.',
            'enlace.url'          => 'El enlace debe empezar por https://',
        ]);

        // Sólo colaboradores activos: un id cualquiera en la petición no debe
        // meter en la reunión a alguien dado de baja o inexistente.
        $pedidos = collect($datos['asistentes'])->map(fn ($i) => (int) $i)->unique();
        $validos = DB::connection('mysql2')->table('empleados')
            ->whereIn('id', $pedidos->all())
            ->where('estado_registro', 'Activo')
            ->where('estado', 'Activo')
            ->pluck('id')
            ->map(fn ($i) => (int) $i)
            ->reject(fn ($i) => $i === $yo)
            ->values();

        if ($validos->isEmpty()) {
            return response()->json(['errors' => ['asistentes' => ['Elige al menos un participante activo.']]], 422);
        }

        $conn = DB::connection('mysql2');
        $id = $conn->transaction(function () use ($conn, $datos, $yo, $validos) {
            $id = $conn->table('reuniones')->insertGetId([
                'titulo'      => trim($datos['titulo']),
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

            $conn->table('reuniones_asistentes')->insert(
                $validos->push($yo)->map(fn ($e) => [
                    'reunion'    => $id,
                    'empleado'   => $e,
                    // El organizador no se invita a sí mismo: ya ha aceptado.
                    'respuesta'  => $e === $yo ? 'Acepta' : 'Pendiente',
                    'created_at' => now(),
                    'updated_at' => now(),
                ])->all()
            );

            return $id;
        });

        $enviados = $this->avisarConvocados($id, 'convocatoria');

        return response()->json([
            'success'   => 'Reunión creada',
            'id'        => $id,
            'convocados' => $validos->count() - 1,
            'correos'   => $enviados,
        ], 201);
    }

    /** Acepta o rechaza una convocatoria; el organizador se entera en la campana. */
    public function responderReunion(Request $request, $id)
    {
        $yo = $this->empleadoActual();
        if (!$yo) {
            return response()->json(['error' => 'Sin empleado asociado.'], 403);
        }

        $datos = $request->validate([
            'respuesta' => 'required|in:Acepta,Rechaza,Pendiente',
        ]);

        $conn = DB::connection('mysql2');
        $reunion = $conn->table('reuniones')->where('id', $id)->first();
        if (!$reunion) {
            return response()->json(['error' => 'La reunión no existe.'], 404);
        }
        if ($reunion->estado === 'Cancelada') {
            return response()->json(['error' => 'La reunión fue cancelada.'], 409);
        }

        $antes = $conn->table('reuniones_asistentes')
            ->where('reunion', $id)
            ->where('empleado', $yo)
            ->value('respuesta');

        if ($antes === null) {
            return response()->json(['error' => 'No está convocado a esta reunión.'], 403);
        }

        $conn->table('reuniones_asistentes')
            ->where('reunion', $id)
            ->where('empleado', $yo)
            ->update([
                'respuesta'  => $datos['respuesta'],
                'updated_at' => now(),
            ]);

        if ($antes !== $datos['respuesta'] && $datos['respuesta'] !== 'Pendiente' && (int) $reunion->organizador !== $yo) {
            $quien = $this->nombreEmpleado($yo);
            $texto = $datos['respuesta'] === 'Acepta'
                ? "{$quien} confirmó que asistirá a la reunión «{$reunion->titulo}»."
                : "{$quien} no podrá asistir a la reunión «{$reunion->titulo}».";
            $this->notificarEnCampana([(int) $reunion->organizador], $yo, $texto);
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

        if ($reunion->estado === 'Cancelada') {
            return response()->json(['success' => 'Reunión cancelada']);
        }

        // Se marca cancelada en vez de borrarla: los convocados deben poder
        // ver que se canceló, no que desapareció sin explicación.
        DB::connection('mysql2')->table('reuniones')->where('id', $id)->update([
            'estado'     => 'Cancelada',
            'updated_at' => now(),
        ]);

        // Sólo se avisa a quien aún podía ir: a quien ya dijo que no, la
        // cancelación no le cambia nada.
        $this->avisarConvocados((int) $id, 'cancelacion');

        return response()->json(['success' => 'Reunión cancelada']);
    }

    /**
     * Colaboradores que se pueden convocar: toda la organización activa,
     * con su departamento para poder agruparlos y buscarlos.
     */
    public function convocables()
    {
        $yo = $this->empleadoActual();
        $conn = DB::connection('mysql2');

        $q = $conn->table('empleados as e')
            ->leftJoin('cargos as c', 'e.cargo', '=', 'c.id')
            ->leftJoin('departamentos as d', 'e.departamento', '=', 'd.id')
            ->where('e.estado_registro', 'Activo')
            ->where('e.estado', 'Activo');

        if ($yo) {
            $q->where('e.id', '<>', $yo);
        }

        return response()->json(
            $q->select(
                'e.id',
                'c.nombre as cargo',
                'd.id as departamento_id',
                'd.nombre as departamento',
                $conn->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre')
            )
                ->orderByRaw('d.nombre IS NULL, d.nombre')
                ->orderBy('nombre')
                ->get()
                ->map(fn ($p) => [
                    'id'              => (int) $p->id,
                    'nombre'          => $p->nombre,
                    'cargo'           => $p->cargo,
                    'departamento_id' => $p->departamento_id ? (int) $p->departamento_id : null,
                    'departamento'    => $p->departamento ?: 'Sin departamento',
                ])
        );
    }

    /**
     * Avisa a los convocados de una reunión: en la campana de WorkBoard y con
     * copia por correo. Devuelve a cuántos se les intentó enviar el correo.
     *
     * El correo sale después de responder (defer): con varios convocados y un
     * SMTP lento, la persona que crea la reunión no debe quedarse esperando.
     * Un fallo de correo no deshace la reunión: el aviso en la plataforma ya
     * quedó guardado.
     */
    private function avisarConvocados(int $id, string $tipo): int
    {
        $conn = DB::connection('mysql2');
        $r = $conn->table('reuniones')->where('id', $id)->first();
        if (!$r) {
            return 0;
        }

        $gente = $conn->table('reuniones_asistentes as ra')
            ->join('empleados as e', 'ra.empleado', '=', 'e.id')
            ->where('ra.reunion', $id)
            ->select(
                'ra.empleado',
                'ra.respuesta',
                'e.email',
                'e.nombres',
                $conn->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre')
            )
            ->orderBy('nombre')
            ->get();

        $organizador = $this->nombreEmpleado((int) $r->organizador);
        $destino = $gente->filter(fn ($g) => (int) $g->empleado !== (int) $r->organizador);
        if ($tipo === 'cancelacion') {
            $destino = $destino->where('respuesta', '<>', 'Rechaza');
        }
        if ($destino->isEmpty()) {
            return 0;
        }

        $fecha = \App\Mail\ConvocatoriaReunionCorreo::fechaEnPalabras($r->fecha);
        $hora = substr((string) $r->hora_inicio, 0, 5);
        $texto = $tipo === 'cancelacion'
            ? "{$organizador} canceló la reunión «{$r->titulo}» del {$fecha} a las {$hora}."
            : "{$organizador} te convocó a la reunión «{$r->titulo}» el {$fecha} a las {$hora}. Confirma tu asistencia en Mis Tareas.";

        $this->notificarEnCampana($destino->pluck('empleado')->map(fn ($i) => (int) $i)->all(), (int) $r->organizador, $texto);

        // El correo del empleado manda; si no tiene, el de su usuario.
        $usuarios = $conn->table('users')
            ->whereIn('empleado', $destino->pluck('empleado')->all())
            ->pluck('email', 'empleado');

        $datos = [
            'id'          => (int) $r->id,
            'titulo'      => $r->titulo,
            'descripcion' => $r->descripcion,
            'fecha'       => $r->fecha,
            'hora_inicio' => $hora,
            'hora_fin'    => $r->hora_fin ? substr((string) $r->hora_fin, 0, 5) : null,
            'lugar'       => $r->lugar,
            'enlace'      => $r->enlace,
            'organizador' => $organizador,
            'asistentes'  => $gente->pluck('nombre')->all(),
        ];

        $envios = $destino->map(function ($g) use ($usuarios) {
            $correo = trim((string) ($g->email ?: ($usuarios[$g->empleado] ?? '')));
            return filter_var($correo, FILTER_VALIDATE_EMAIL)
                ? ['correo' => $correo, 'nombre' => trim(strtok((string) $g->nombres, ' ')) ?: $g->nombre]
                : null;
        })->filter()->values()->all();

        if ($envios === []) {
            return 0;
        }

        \Illuminate\Support\defer(function () use ($envios, $datos, $tipo) {
            foreach ($envios as $e) {
                try {
                    \Illuminate\Support\Facades\Mail::to($e['correo'])
                        ->send(new \App\Mail\ConvocatoriaReunionCorreo($datos, $e['nombre'], $tipo));
                } catch (\Throwable $ex) {
                    \Illuminate\Support\Facades\Log::warning('No se envió la convocatoria de la reunión ' . $datos['id'] . ': ' . $ex->getMessage());
                }
            }
        });

        return count($envios);
    }

    /** Aviso de reunión en la campana de cada empleado. */
    private function notificarEnCampana(array $empleados, int $emisor, string $mensaje): void
    {
        \App\Support\Avisos::campana($empleados, $emisor, $mensaje, null, 'Reunion');
    }

    private function nombreEmpleado(int $id): string
    {
        return (string) DB::connection('mysql2')->table('empleados')
            ->where('id', $id)
            ->selectRaw('CONCAT(nombres, " ", apellidos) as n')
            ->value('n');
    }

    // ─── Presencia en el plano ──────────────────────────────────────────────

    /**
     * El estado que la persona elige para que los demás lo vean en el plano.
     * Sin estado (null) vuelve a lo automático: disponible con la aplicación
     * abierta, en reunión si la agenda lo dice.
     */
    public function guardarPresencia(Request $request)
    {
        $yo = $this->empleadoActual();
        if (!$yo) {
            return response()->json(['error' => 'Tu usuario no tiene ficha de empleado.'], 422);
        }
        if (!\App\Support\Presencia::disponible()) {
            return response()->json(['error' => 'La presencia aún no está instalada (falta ejecutar las migraciones).'], 503);
        }

        $datos = $request->validate([
            'estado' => ['present', 'nullable', \Illuminate\Validation\Rule::in(\App\Support\Presencia::ESTADOS)],
            'nota'   => 'nullable|string|max:80',
        ], [
            'estado.in' => 'Ese estado no existe.',
            'nota.max'  => 'La nota admite hasta 80 caracteres.',
        ]);

        \App\Support\Presencia::elegir($yo, $datos['estado'] ?? null, $datos['nota'] ?? null);

        $presencia = \App\Support\Presencia::delPlano([$yo], []);

        return response()->json(['success' => true, 'presencia' => $presencia[$yo]]);
    }

    /**
     * El navegador informa del uso del equipo: activo, inactivo (5 min sin
     * tocarlo) o bloqueado. Sólo ese estado; nunca qué se hace en él.
     */
    public function usoEquipo(Request $request)
    {
        $yo = $this->empleadoActual();
        if (!$yo) {
            return response()->json(['error' => 'Tu usuario no tiene ficha de empleado.'], 422);
        }
        $datos = $request->validate([
            'uso' => ['required', \Illuminate\Validation\Rule::in(\App\Support\Presencia::USOS_EQUIPO)],
        ]);
        // Sin la migración se acepta y se descarta: el navegador no debe fallar.
        if (!\App\Support\Presencia::conUsoEquipo()) {
            \App\Support\Presencia::latido($yo);
            return response()->json(['success' => true, 'guardado' => false]);
        }

        \App\Support\Presencia::usoEquipo($yo, $datos['uso']);

        return response()->json(['success' => true, 'guardado' => true]);
    }

    /**
     * Saluda a un compañero desde el plano: le llega a la campana y, durante
     * unos segundos, el personaje de quien saluda agita la mano para todos.
     */
    public function saludar($empleado)
    {
        $yo = $this->empleadoActual();
        $empleado = (int) $empleado;
        if (!$yo) {
            return response()->json(['error' => 'Tu usuario no tiene ficha de empleado.'], 422);
        }
        if ($empleado === $yo) {
            return response()->json(['error' => 'No puedes saludarte a ti mismo.'], 422);
        }

        $existe = DB::connection('mysql2')->table('empleados')
            ->where('id', $empleado)->where('estado_registro', 'Activo')->where('estado', 'Activo')->exists();
        if (!$existe) {
            return response()->json(['error' => 'Empleado no disponible.'], 404);
        }

        // Un saludo por persona cada cinco minutos: es un gesto, no un timbre.
        if (!\Illuminate\Support\Facades\Cache::add("saludo:{$yo}:{$empleado}", 1, now()->addMinutes(5))) {
            return response()->json(['error' => 'Ya lo saludaste hace un momento.'], 429);
        }

        $quien = $this->nombreEmpleado($yo);
        \App\Support\Avisos::campana([$empleado], $yo, "👋 {$quien} te saludó desde el plano de la oficina.", null, 'Saludo');

        if (\App\Support\Presencia::disponible()) {
            \App\Support\Presencia::saludar($yo, $empleado);
        }

        return response()->json(['success' => true]);
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

        // El trabajo de otro sólo se enseña a quien lo sigue: administración,
        // supervisión y líderes. Un colaborador entra al plano para escribir,
        // llamar o convocar a un compañero, no para revisar sus tareas.
        $verTrabajo = $yo === $empleado || $this->veTrabajoAjeno();
        if (!$verTrabajo) {
            return response()->json([
                'persona' => [
                    'id'           => (int) $persona->id,
                    'nombre'       => $persona->nombre,
                    'cargo'        => $persona->cargo,
                    'departamento' => $persona->departamento,
                ],
                'chat'        => $yo ? $this->claveDirecto($yo, $empleado) : null,
                'sala'        => $yo ? $this->salaDeVideo($yo, $empleado) : null,
                'soy_yo'      => false,
                'ver_trabajo' => false,
                'tareas'      => [],
                'resumen'     => ['vivas' => 0, 'proceso' => 0, 'revision' => 0, 'atrasadas' => 0, 'bloqueadas' => 0, 'pausadas' => 0],
                'actividad'   => [],
            ]);
        }

        // Las tareas vivas: lo que explica el estado del puesto. Las
        // completadas quedan fuera porque ya no dicen nada del ahora.
        $tareas = $conn->table('tareas_empleados as t')
            ->leftJoin('proyectos as p', 't.proyecto_id', '=', 'p.id')
            ->where('t.empleado', $empleado)
            // Como el plano y el tablero: las eliminadas no se enseñan.
            ->where('t.estado_reg', 'Activo')
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
                    // La marca se queda al reanudar (llevarla a En Proceso): cuenta
                    // la pausa de verdad, igual que el plano.
                    'pausada'       => \App\Support\IndiceDesempeno::estaPausada($t),
                    'bloqueada'     => (int) ($t->bloqueada ?? 0) === 1,
                    'sin_criterio'  => (int) $t->n_criterios === 0,
                    // En pausa el plazo está detenido: no va tarde.
                    'atrasada'      => $pactada && $pactada->lt($hoy) && $t->estado !== self::EN_REVISION
                        && !\App\Support\IndiceDesempeno::estaPausada($t),
                    // Entero: Carbon 3 devuelve float y «vence hoy» (dias === 0) no salía.
                    'dias'          => $pactada ? (int) round($hoy->diffInDays($pactada, false)) : null,
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
            'ver_trabajo' => true,
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
            // El tope superior descarta horas «futuras» guardadas en UTC antes
            // de pasar la aplicación a hora de Bogotá.
            ->whereBetween('created_at', [now()->subSeconds(self::LLAMADA_VIVE), now()->addMinute()])
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
            // Sin ficha de empleado (un administrador) nadie puede llamarle:
            // «activo» le dice al timbre que deje de preguntar.
            return response()->json(['llamada' => null, 'activo' => false]);
        }

        $conn = DB::connection('mysql2');

        $l = $conn->table('llamadas as l')
            ->leftJoin('empleados as e', 'l.emisor', '=', 'e.id')
            ->where('l.receptor', $yo)
            ->where('l.estado', 'Sonando')
            ->whereBetween('l.created_at', [now()->subSeconds(self::LLAMADA_VIVE), now()->addMinute()])
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

        // Sólo se responde lo que todavía suena: antes el receptor podía
        // convertir en «Aceptada» una llamada que ya habían colgado.
        $caducada = Carbon::parse($l->created_at)->lt(now()->subSeconds(self::LLAMADA_VIVE));
        if ($l->estado !== 'Sonando' || $caducada) {
            return response()->json(['error' => 'La llamada ya terminó.', 'estado' => $caducada && $l->estado === 'Sonando' ? 'Cancelada' : $l->estado], 409);
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
        $clave = $this->claveValida((string) $request->query('clave', '')) ?? '';

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

        $clave = $this->claveValida($datos['clave']);
        if ($clave === null) {
            return response()->json(['error' => 'Conversación no disponible.'], 422);
        }
        $datos['clave'] = $clave;

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

    /**
     * Mensajes nuevos que hay que avisarle al usuario: los directos que le
     * escriben y los de su canal de departamento.
     *
     * Lo consulta el aviso de mensajes desde cualquier pantalla, también con
     * la pestaña oculta. Sin «desde» sólo devuelve el último id, que es el
     * punto de partida: así al abrir la aplicación no se avisa del historial.
     * Lo ya leído (chat_lecturas) no se avisa aunque sea posterior a «desde».
     */
    public function chatAvisos(Request $request)
    {
        $yo = $this->empleadoActual();
        if (!$yo) {
            // Sin ficha de empleado no hay directos ni canal propio.
            return response()->json(['ultimo' => 0, 'mensajes' => [], 'activo' => false]);
        }

        // Esta consulta llega cada pocos segundos mientras la aplicación está
        // abierta, en cualquier pantalla: sirve de latido para el plano.
        \App\Support\Presencia::latido($yo);

        $conn = DB::connection('mysql2');
        $ultimo = (int) $conn->table('chat_mensajes')->max('id');

        if (!$request->filled('desde')) {
            return response()->json(['ultimo' => $ultimo, 'mensajes' => []]);
        }

        $miDepto = (int) $conn->table('empleados')->where('id', $yo)->value('departamento');

        // Las conversaciones que le tocan. El LIKE acota en la base y el
        // filtro por pares lo confirma: «dir:5-%» también casaría con un id 55.
        $conversaciones = $conn->table('chat_conversaciones')
            ->where(function ($q) use ($yo, $miDepto) {
                $q->where(function ($d) use ($yo) {
                    $d->where('tipo', 'directo')
                      ->where(fn ($c) => $c->where('clave', 'like', "dir:{$yo}-%")->orWhere('clave', 'like', "dir:%-{$yo}"));
                });
                if ($miDepto) {
                    $q->orWhere('clave', 'dep:' . $miDepto);
                }
            })
            ->get(['id', 'clave', 'tipo'])
            ->filter(fn ($c) => $c->tipo !== 'directo' || in_array($yo, $this->paresDeDirecto($c->clave), true))
            ->keyBy('id');

        if ($conversaciones->isEmpty()) {
            return response()->json(['ultimo' => $ultimo, 'mensajes' => []]);
        }

        $leido = $conn->table('chat_lecturas')
            ->where('empleado', $yo)
            ->whereIn('conversacion', $conversaciones->keys())
            ->pluck('ultimo_leido', 'conversacion');

        $canal = $miDepto ? $conn->table('departamentos')->where('id', $miDepto)->value('nombre') : null;

        $mensajes = $conn->table('chat_mensajes as m')
            ->leftJoin('empleados as e', 'm.empleado', '=', 'e.id')
            ->whereIn('m.conversacion', $conversaciones->keys())
            ->where('m.id', '>', (int) $request->query('desde'))
            ->where('m.empleado', '<>', $yo)
            ->orderBy('m.id')
            ->limit(30)
            ->get([
                'm.id', 'm.conversacion', 'm.empleado', 'm.mensaje', 'm.created_at',
                $conn->raw('CONCAT(e.nombres, " ", e.apellidos) as autor'),
            ])
            ->filter(fn ($m) => (int) $m->id > (int) ($leido[$m->conversacion] ?? 0))
            ->map(function ($m) use ($conversaciones, $canal) {
                $c = $conversaciones[$m->conversacion];
                return [
                    'id'       => (int) $m->id,
                    'clave'    => $c->clave,
                    'directo'  => $c->tipo === 'directo',
                    'canal'    => $c->tipo === 'directo' ? null : $canal,
                    'empleado' => (int) $m->empleado,
                    'autor'    => $m->autor,
                    'mensaje'  => mb_strimwidth($m->mensaje, 0, 180, '…'),
                    'cuando'   => $m->created_at,
                ];
            })
            ->values();

        return response()->json(['ultimo' => $ultimo, 'mensajes' => $mensajes]);
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
    /**
     * Clave canónica de una conversación, o null si no es válida.
     *
     *  - «dep:N» con un departamento que exista;
     *  - «dir:A-B» con dos empleados que existan (aunque uno ya no esté
     *    activo: su historial se sigue pudiendo leer), ordenada siempre de
     *    menor a mayor: «dir:B-A» es la misma pareja y antes abría otra
     *    conversación, partiendo el historial en dos.
     *
     * Antes «dir:5-99999999» o «dir:5-abc» (leído como 5-0) creaban
     * conversaciones con nadie.
     */
    private function claveValida(string $clave): ?string
    {
        if (preg_match('/^dep:(\d+)$/', $clave, $m)) {
            return (int) $m[1] > 0 ? 'dep:' . (int) $m[1] : null;
        }
        if (!preg_match('/^dir:(\d+)-(\d+)$/', $clave, $m)) {
            return null;
        }
        [$a, $b] = [(int) $m[1], (int) $m[2]];
        if ($a <= 0 || $b <= 0 || $a === $b) {
            return null;
        }
        $existen = DB::connection('mysql2')->table('empleados')->whereIn('id', [$a, $b])->count();

        return $existen === 2 ? $this->claveDirecto($a, $b) : null;
    }

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

    /**
     * Si el usuario puede ver el trabajo de otros: administración, supervisión
     * y líderes. El resto ve el plano y la gente, no sus tareas.
     */
    private function veTrabajoAjeno(): bool
    {
        $email = Auth::user()->email ?? null;
        if (!$email) {
            return false;
        }

        $u = DB::connection('mysql2')->table('users')->where('email', $email)->first();
        if (!$u) {
            return false;
        }

        $tipo = strtolower(trim((string) ($u->tipo_usuario ?? '')));

        return in_array($tipo, ['administrador', 'supervisor'], true)
            || strtolower(trim((string) ($u->lider ?? ''))) === 'si';
    }

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
