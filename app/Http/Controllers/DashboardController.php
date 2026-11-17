<?php

namespace App\Http\Controllers;

use App\Support\AccesoTareas;
use App\Support\Avisos;
use App\Support\IndiceDesempeno;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Resolver lo vencido desde el dashboard.
 *
 * El 98 % de las tareas abiertas llevaba meses vencido sin que nadie
 * decidiera nada. Aquí quien sigue el trabajo (administración o el líder de
 * esa persona) las revisa juntas y, para cada una, decide:
 *
 *  - pedir actualización: le llega a la persona a su campana;
 *  - reprogramar: nueva fecha real, con motivo;
 *  - archivar: ya no aplica, con motivo.
 *
 * Nadie resuelve sus propias tareas por aquí: reprogramarse uno mismo sin
 * aprobación saltaría el flujo de solicitudes. Por eso se exige ser
 * administración o líder de la persona, no sólo «alcanzarla».
 */
class DashboardController extends Controller
{
    private const EN_REVISION = 'En Revisión';

    /** Un «pide actualización» por tarea cada tanto: es un aviso, no un timbre. */
    private const HORAS_ENTRE_PEDIDOS = 24;

    /** Tareas vencidas que el usuario puede resolver, de la más antigua a la más reciente. */
    public function vencidas(Request $request)
    {
        $datos = $request->validate([
            'departamento' => 'nullable|string|max:200',
            'empleado'     => 'nullable|integer',
        ]);

        $u = AccesoTareas::usuario();
        $hoy = IndiceDesempeno::hoy();

        $q = $this->consultaVencidas($hoy)
            ->when(!empty($datos['departamento']), fn ($w) => $w->where('d.nombre', $datos['departamento']))
            ->when(!empty($datos['empleado']), fn ($w) => $w->where('t.empleado', (int) $datos['empleado']));

        $resolvibles = $this->resolvibles($u);
        if ($resolvibles !== null) {
            $q->whereIn('t.empleado', $resolvibles ?: [0]);
        }

        $filas = $q->orderBy('t.fecha_pactada')->orderBy('t.id')->limit(300)->get();

        $pedidos = DB::connection('mysql2')->table('notif_generales')
            ->whereIn('tarea_id', $filas->pluck('id'))
            ->where('tipo', 'PedidoActualizacion')
            ->groupBy('tarea_id')
            ->selectRaw('tarea_id, MAX(fecha_creacion) as ultimo')
            ->pluck('ultimo', 'tarea_id');

        return response()->json([
            'tareas' => $filas->map(fn ($t) => [
                'id'            => (int) $t->id,
                'titulo'        => $t->titulo,
                'estado'        => $t->estado,
                'empleado_id'   => (int) $t->empleado,
                'empleado'      => trim($t->nombres . ' ' . $t->apellidos),
                'departamento'  => $t->departamento,
                'proyecto'      => $t->proyecto,
                'fecha_pactada' => $t->fecha_pactada,
                'dias'          => (int) CarbonImmutable::parse($t->fecha_pactada, IndiceDesempeno::ZONA)->diffInDays($hoy),
                'pedido_en'     => $pedidos[$t->id] ?? null,
            ])->values(),
            'hoy' => $hoy->toDateString(),
        ]);
    }

    /** Aplica una decisión a varias tareas vencidas a la vez. */
    public function resolver(Request $request)
    {
        $hoy = IndiceDesempeno::hoy();
        $datos = $request->validate([
            'accion'        => 'required|in:pedir,reprogramar,archivar',
            'tareas'        => 'required|array|min:1|max:100',
            'tareas.*'      => 'integer|distinct',
            'fecha_pactada' => 'required_if:accion,reprogramar|nullable|date_format:Y-m-d|after_or_equal:' . $hoy->toDateString(),
            'motivo'        => 'required_if:accion,reprogramar,archivar|nullable|string|min:5|max:500',
        ], [
            'accion.in'                    => 'Acción no válida.',
            'tareas.required'              => 'Elige al menos una tarea.',
            'fecha_pactada.required_if'    => 'Indica la nueva fecha.',
            'fecha_pactada.after_or_equal' => 'La nueva fecha no puede ser anterior a hoy.',
            'motivo.required_if'           => 'Explica el motivo: queda en el historial de la tarea.',
            'motivo.min'                   => 'El motivo es demasiado corto.',
        ]);

        $u = AccesoTareas::usuario();
        $resolvibles = $this->resolvibles($u);

        $tareas = $this->consultaVencidas($hoy)->whereIn('t.id', $datos['tareas'])->get()->keyBy('id');
        $actor = $u->name ?? 'Administración';
        $actorEmpleado = $u && $u->empleado ? (int) $u->empleado : null;
        $motivo = trim((string) ($datos['motivo'] ?? ''));

        $hechas = [];
        $omitidas = [];
        foreach ($datos['tareas'] as $id) {
            $t = $tareas->get($id);
            if (!$t) {
                $omitidas[] = ['id' => $id, 'motivo' => 'Ya no está vencida o no existe.'];
                continue;
            }
            if ($resolvibles !== null && !in_array((int) $t->empleado, $resolvibles, true)) {
                $omitidas[] = ['id' => $id, 'motivo' => 'No es de tu equipo.'];
                continue;
            }

            $quien = (int) $t->empleado;
            switch ($datos['accion']) {
                case 'pedir':
                    $reciente = DB::connection('mysql2')->table('notif_generales')
                        ->where('tarea_id', $id)->where('tipo', 'PedidoActualizacion')
                        // fecha_creacion la pone la base con su propio reloj
                        // (hora local); se compara con ese mismo reloj.
                        ->whereRaw('fecha_creacion >= NOW() - INTERVAL ? HOUR', [self::HORAS_ENTRE_PEDIDOS])
                        ->exists();
                    if ($reciente) {
                        $omitidas[] = ['id' => $id, 'motivo' => 'Ya se pidió en las últimas 24 horas.'];
                        continue 2;
                    }
                    $dias = (int) CarbonImmutable::parse($t->fecha_pactada, IndiceDesempeno::ZONA)->diffInDays($hoy);
                    Avisos::campana([$quien], $actorEmpleado,
                        "{$actor} te pide actualizar «{$t->titulo}»: venció hace {$dias} días. Entrégala, pide una reprogramación o avisa si ya no aplica.",
                        (int) $id, 'PedidoActualizacion');
                    break;

                case 'reprogramar':
                    DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
                        'fecha_pactada'         => $datos['fecha_pactada'],
                        'motivo_reprogramacion' => $motivo,
                        'reprogramada'          => 1,
                        'fecha_reprogramacion'  => $hoy->toDateString(),
                    ]);
                    $nueva = CarbonImmutable::parse($datos['fecha_pactada'])->format('d/m/Y');
                    $this->historial($id, 'Reprogramada', "Tarea reprogramada por {$actor} desde el dashboard. Nueva fecha: {$nueva}. Motivo: {$motivo}.");
                    Avisos::campana([$quien], $actorEmpleado,
                        "{$actor} reprogramó «{$t->titulo}» para el {$nueva}. Motivo: {$motivo}", (int) $id, 'Reprogramada');
                    break;

                case 'archivar':
                    DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
                        'archivar'        => 1,
                        'fecha_archivada' => now(),
                    ]);
                    $this->historial($id, 'Archivada', "Tarea archivada por {$actor} desde el dashboard. Motivo: {$motivo}.");
                    Avisos::campana([$quien], $actorEmpleado,
                        "{$actor} archivó «{$t->titulo}». Motivo: {$motivo}", (int) $id, 'Archivada');
                    break;
            }
            $hechas[] = (int) $id;
        }

        return response()->json([
            'success'  => count($hechas) > 0,
            'hechas'   => $hechas,
            'omitidas' => $omitidas,
        ], count($hechas) > 0 || count($omitidas) === 0 ? 200 : 422);
    }

    /**
     * Vencida con el criterio del índice: abierta, no archivada, no En
     * Revisión, no pausada y con la fecha pactada antes de hoy.
     */
    private function consultaVencidas(CarbonImmutable $hoy)
    {
        return DB::connection('mysql2')->table('tareas_empleados as t')
            ->join('empleados as e', 't.empleado', '=', 'e.id')
            ->leftJoin('departamentos as d', 'e.departamento', '=', 'd.id')
            ->leftJoin('proyectos as p', 't.proyecto_id', '=', 'p.id')
            ->where('e.estado_registro', 'Activo')->where('e.estado', 'Activo')
            ->where('t.estado_reg', 'Activo')
            ->whereNotIn('t.estado', ['Completada', self::EN_REVISION])
            ->where(fn ($w) => $w->whereNull('t.archivar')->orWhere('t.archivar', '<>', 1))
            // En pausa de verdad no vence (ver IndiceDesempeno::estaPausada):
            // la marca sólo cuenta fuera de En Proceso.
            ->where(fn ($w) => $w->whereNull('t.pausada')->orWhere('t.pausada', '<>', 1)->orWhere('t.estado', 'En Proceso'))
            ->whereNotNull('t.fecha_pactada')
            ->where('t.fecha_pactada', '<', $hoy->toDateString())
            ->select('t.id', 't.titulo', 't.estado', 't.empleado', 't.fecha_pactada',
                'e.nombres', 'e.apellidos', 'd.nombre as departamento', 'p.nombre as proyecto');
    }

    /**
     * Empleados cuyas vencidas puede resolver: null = todos (administración);
     * un líder, las de su equipo sin incluirse a sí mismo; nadie más.
     */
    private function resolvibles(?object $u): ?array
    {
        if (AccesoTareas::esAdministracion($u)) {
            return null;
        }
        if (!$u || !$u->empleado) {
            return [];
        }

        return DB::connection('mysql2')->table('lideres_empleados')
            ->where('lider', $u->empleado)
            ->where('empleado', '<>', $u->empleado)
            ->pluck('empleado')->map(fn ($i) => (int) $i)->unique()->values()->all();
    }

    private function historial(int $tareaId, string $tipo, string $mensaje): void
    {
        DB::connection('mysql2')->table('notif_generales')->insert([
            'id_emisor'     => 0,
            'tipo_emisor'   => 'sistema',
            'id_receptor'   => 0,
            'tipo_receptor' => 'sistema',
            'mensaje'       => $mensaje,
            'tarea_id'      => $tareaId,
            'leido'         => 1,
            'fecha'         => now(),
            'tipo'          => $tipo,
        ]);
    }
}
