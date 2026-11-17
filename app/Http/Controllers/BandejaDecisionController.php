<?php

namespace App\Http\Controllers;

use App\Support\AccesoTareas;
use App\Support\Avisos;
use App\Support\IndiceDesempeno;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Bandeja «Necesita tu decisión».
 *
 * Al entrar, cada persona ve sus tareas vencidas sobre las que nadie ha
 * decidido nada y elige qué pasa con cada una:
 *
 *  - entregarla (abre la tarea; se envía a revisión como siempre),
 *  - pedir una fecha nueva (solicitud de reprogramación que aprueba el líder),
 *  - declararla bloqueada (con lo que impide avanzar),
 *  - «ya no aplica» (se archiva con motivo y se avisa a su líder).
 *
 * Antes una tarea podía quedarse vencida un año sin que el sistema obligara a
 * decidir nada. Una tarea con una solicitud pendiente o ya bloqueada cuenta
 * como decidida: espera a otra persona, no a quien la tiene.
 */
class BandejaDecisionController extends Controller
{
    /** Vencidas propias que esperan una decisión de su responsable. */
    public function index()
    {
        $u = AccesoTareas::usuario();
        if (!$u || !$u->empleado) {
            return response()->json(['tareas' => [], 'hoy' => IndiceDesempeno::hoy()->toDateString()]);
        }

        $hoy = IndiceDesempeno::hoy();
        $filas = $this->pendientes((int) $u->empleado, $hoy)->get();

        return response()->json([
            'tareas' => $filas->map(fn ($t) => [
                'id'            => (int) $t->id,
                'titulo'        => $t->titulo,
                'estado'        => $t->estado,
                'proyecto'      => $t->proyecto,
                'fecha_pactada' => $t->fecha_pactada,
                'dias'          => (int) CarbonImmutable::parse($t->fecha_pactada, IndiceDesempeno::ZONA)->diffInDays($hoy),
                'sin_criterio'  => (int) $t->n_criterios === 0,
                // Una devolución pendiente de rehacer cambia el consejo de la tarjeta.
                'rechazo_previo'=> (int) ($t->rechazada ?? 0) === 1,
            ])->values(),
            'hoy' => $hoy->toDateString(),
        ]);
    }

    /**
     * «Ya no aplica»: la persona la archiva explicando por qué y su líder se
     * entera, por si no está de acuerdo (puede desarchivarla).
     */
    public function yaNoAplica(Request $request, $id)
    {
        $datos = $request->validate([
            'motivo' => 'required|string|min:10|max:500',
        ], [
            'motivo.required' => 'Explica por qué ya no aplica: lo verá tu líder.',
            'motivo.min'      => 'Explica por qué ya no aplica (al menos 10 caracteres).',
        ]);

        $u = AccesoTareas::usuario();
        $tarea = AccesoTareas::tarea($id);
        if (!$tarea) {
            return response()->json(['error' => 'Tarea no encontrada'], 404);
        }
        // Sólo sus propias tareas: a las de su equipo el líder las resuelve
        // desde el dashboard.
        if (!AccesoTareas::esPropio($u, (int) $tarea->empleado)) {
            return AccesoTareas::denegada('modificar');
        }
        $pendiente = $this->pendientes((int) $tarea->empleado, IndiceDesempeno::hoy())->where('t.id', (int) $id)->exists();
        if (!$pendiente) {
            return response()->json(['error' => 'Esta tarea ya no espera una decisión.'], 409);
        }

        $motivo = trim($datos['motivo']);
        DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
            'archivar'        => 1,
            'fecha_archivada' => now(),
        ]);

        $quien = $u->name ?? 'El responsable';
        DB::connection('mysql2')->table('notif_generales')->insert([
            'id_emisor' => 0, 'tipo_emisor' => 'sistema', 'id_receptor' => 0, 'tipo_receptor' => 'sistema',
            'mensaje' => "Archivada por {$quien}: ya no aplica. Motivo: {$motivo}.",
            'tarea_id' => (int) $id, 'leido' => 1, 'fecha' => now(), 'tipo' => 'Archivada',
        ]);

        $lideres = DB::connection('mysql2')->table('lideres_empleados')
            ->where('empleado', $tarea->empleado)->pluck('lider')->map(fn ($i) => (int) $i)->all();
        Avisos::campana($lideres, (int) $u->empleado,
            "{$quien} archivó «{$tarea->titulo}» porque ya no aplica: {$motivo}. Si no estás de acuerdo, puedes desarchivarla.",
            (int) $id, 'Archivada');

        return response()->json(['success' => true]);
    }

    /**
     * Vencidas de la persona sin decisión: abiertas, no En Revisión, no en
     * pausa, no bloqueadas, sin una solicitud de reprogramación o de pausa
     * pendiente, y con la fecha pactada antes de hoy.
     */
    private function pendientes(int $empleado, CarbonImmutable $hoy)
    {
        return DB::connection('mysql2')->table('tareas_empleados as t')
            ->leftJoin('proyectos as p', 't.proyecto_id', '=', 'p.id')
            ->where('t.empleado', $empleado)
            ->where('t.estado_reg', 'Activo')
            ->whereNotIn('t.estado', ['Completada', 'En Revisión'])
            ->where(fn ($w) => $w->whereNull('t.archivar')->orWhere('t.archivar', '<>', 1))
            ->where(fn ($w) => $w->whereNull('t.pausada')->orWhere('t.pausada', '<>', 1)->orWhere('t.estado', 'En Proceso'))
            ->where(fn ($w) => $w->whereNull('t.bloqueada')->orWhere('t.bloqueada', '<>', 1))
            ->whereNotNull('t.fecha_pactada')
            ->where('t.fecha_pactada', '<', $hoy->toDateString())
            ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('reprogramaciones_tareas as r')
                ->whereColumn('r.tarea_id', 't.id')->where('r.estado', 'Pendiente'))
            ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('pausas_solicitadas as ps')
                ->whereColumn('ps.tarea_id', 't.id')->where('ps.estado', 'Pendiente'))
            ->select('t.id', 't.titulo', 't.estado', 't.fecha_pactada', 't.rechazada', 'p.nombre as proyecto')
            ->selectRaw(CriteriosAceptacionController::sqlConteo('t') . ' as n_criterios')
            ->orderBy('t.fecha_pactada')->orderBy('t.id');
    }
}
