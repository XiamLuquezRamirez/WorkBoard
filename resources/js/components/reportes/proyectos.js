import { situacion, SITUACIONES } from './tareasEmpleado';

/**
 * Cálculos del informe de Proyectos.
 *
 *  - Avance: completadas ÷ tareas del proyecto.
 *  - Esperado: tareas que YA debían estar hechas (completadas, o con la fecha
 *    pactada pasada) ÷ tareas. No usa las fechas del proyecto, que casi nunca
 *    se registran. Una pausada no se espera: la pausa la aprueba el líder.
 *  - Los filtros de área y fechas valen para las cifras Y para la lista de
 *    tareas (antes la lista, la impresión y el Excel los ignoraban).
 *  - Cobertura: cuánto del trabajo está asignado a algún proyecto.
 */
const SIN_AREA = 'Sin departamento';

export const pct = (parte, de) => (de > 0 ? Math.round((parte / de) * 100) : null);

const fechaValida = (f) => (/^\d{4}-\d{2}-\d{2}/.test(f || '') && !f.startsWith('0000') ? f.slice(0, 10) : null);

export function calcularProyectos(proyectos, { proyecto = null, estado = '', area = '', desde = '', hasta = '', ocultarVacios = true, hoy }) {
    return proyectos
        .filter((p) => (!proyecto || p.id === proyecto) && (!estado || p.estado === estado))
        .map((p) => {
            const tareas = (p.tareas || [])
                .filter((t) => (!area || (t.departamento || SIN_AREA) === area)
                    && (!desde || (t.fecha_pactada && t.fecha_pactada >= desde))
                    && (!hasta || (t.fecha_pactada && t.fecha_pactada <= hasta)))
                .sort((a, b) => (b.dias_vencida || 0) - (a.dias_vencida || 0)
                    || String(a.fecha_pactada || '9999').localeCompare(String(b.fecha_pactada || '9999')));
            const cuenta = Object.fromEntries(SITUACIONES.map((s) => [s, 0]));
            tareas.forEach((t) => { cuenta[situacion(t)] = (cuenta[situacion(t)] || 0) + 1; });

            const completadas = cuenta.Completada;
            const debian = tareas.filter((t) => t.estado === 'Completada'
                || (!t.en_pausa && t.fecha_pactada && t.fecha_pactada < hoy)).length;
            const equipo = [...new Map(tareas.map((t) => [t.empleado_id ?? t.empleado, t.empleado || 'Sin responsable'])).values()]
                .sort((a, b) => a.localeCompare(b));

            return {
                id: p.id,
                nombre: p.nombre,
                estado: p.estado || '—',
                inicio: fechaValida(p.fecha_inicio),
                fin: fechaValida(p.fecha_fin_estimada),
                tareas,
                cuenta,
                total: tareas.length,
                completadas,
                vencidas: tareas.filter((t) => t.vencida).length,
                avance: pct(completadas, tareas.length),
                esperado: pct(debian, tareas.length),
                equipo,
                finVencido: Boolean(fechaValida(p.fecha_fin_estimada)) && fechaValida(p.fecha_fin_estimada) < hoy
                    && completadas < tareas.length,
            };
        })
        .filter((p) => !ocultarVacios || p.total > 0)
        .sort((a, b) => b.vencidas - a.vencidas || b.total - a.total || a.nombre.localeCompare(b.nombre));
}

/** Cuánto del trabajo está en algún proyecto, y qué áreas más lo dejan fuera. */
export function calcularCobertura(tareas) {
    const abiertas = tareas.filter((t) => t.estado !== 'Completada');
    const con = (l) => l.filter((t) => t.proyecto_id).length;
    const areas = {};
    abiertas.forEach((t) => {
        const nombre = t.departamento || SIN_AREA;
        areas[nombre] ??= { area: nombre, abiertas: 0, sin: 0 };
        areas[nombre].abiertas += 1;
        if (!t.proyecto_id) areas[nombre].sin += 1;
    });
    return {
        total: tareas.length,
        conProyecto: con(tareas),
        abiertas: abiertas.length,
        abiertasCon: con(abiertas),
        pctAbiertas: pct(con(abiertas), abiertas.length),
        areas: Object.values(areas).filter((a) => a.sin > 0).sort((a, b) => b.sin - a.sin),
    };
}
