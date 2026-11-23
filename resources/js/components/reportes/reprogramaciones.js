/**
 * Cálculos de «Reprogramaciones y pausas».
 *
 *  - Aplazamiento: la fecha cambió de verdad (solicitud aprobada o cambio
 *    directo). Reanudar una pausa también pone fecha, pero no es aplazar.
 *  - Directo: se cambió sin pedir aprobación.
 *  - «Ya vencida» y los días ampliados necesitan la fecha anterior; los cambios
 *    directos antiguos no la guardaron y quedan fuera de esas dos cuentas.
 */
export const esAplazamiento = (r) => r.tipo === 'Reprogramación' && r.via !== 'Al reanudar'
    && (r.estado === 'Aprobada' || r.estado === 'Aplicada');

const pct = (parte, de) => (de > 0 ? Math.round((parte / de) * 100) : null);

export const FILTROS_VACIOS = { tipo: '', estado: '', via: '', area: '', persona: null };

export function filtrar(filas, f) {
    return filas.filter((r) => (!f.tipo || r.tipo === f.tipo)
        && (!f.estado || r.estado === f.estado)
        && (!f.via || r.via === f.via)
        && (!f.area || r.departamento === f.area)
        && (!f.persona || r.empleado_id === f.persona));
}

export function calcular(filas) {
    const aplazamientos = filas.filter(esAplazamiento);
    const conFecha = aplazamientos.filter((r) => r.ya_vencida !== null);
    const tarde = conFecha.filter((r) => r.ya_vencida).length;
    const conDias = aplazamientos.filter((r) => r.dias_ampliados !== null);
    const dias = conDias.reduce((s, r) => s + r.dias_ampliados, 0);

    const personas = {};
    const tareas = {};
    const meses = {};
    filas.forEach((r) => {
        const clave = String(r.empleado_id ?? `sin-${r.responsable}`);
        personas[clave] ??= {
            clave, id: r.empleado_id, nombre: r.responsable, area: r.departamento,
            aplazamientos: 0, directos: 0, tarde: 0, dias: 0, pausas: 0, pendientes: 0,
        };
        const p = personas[clave];
        if (r.estado === 'Pendiente') p.pendientes += 1;
        if (r.tipo === 'Pausa' && (r.estado === 'Aprobada' || r.estado === 'Aplicada')) p.pausas += 1;
        if (esAplazamiento(r)) {
            p.aplazamientos += 1;
            if (r.via === 'Directa') p.directos += 1;
            if (r.ya_vencida) p.tarde += 1;
            p.dias += r.dias_ampliados || 0;
            tareas[r.tarea_id] ??= { id: r.tarea_id, titulo: r.tarea_titulo, persona: r.responsable, veces: 0, dias: 0 };
            tareas[r.tarea_id].veces += 1;
            tareas[r.tarea_id].dias += r.dias_ampliados || 0;
            const mes = String(r.fecha_solicitud).slice(0, 7);
            meses[mes] ??= { mes, Aprobadas: 0, Directas: 0 };
            meses[mes][r.via === 'Directa' ? 'Directas' : 'Aprobadas'] += 1;
        }
    });

    return {
        aplazamientos: aplazamientos.length,
        directos: aplazamientos.filter((r) => r.via === 'Directa').length,
        conFecha: conFecha.length,
        tarde,
        pctTarde: pct(tarde, conFecha.length),
        diasPromedio: conDias.length ? Math.round((dias / conDias.length) * 10) / 10 : null,
        pausas: filas.filter((r) => r.tipo === 'Pausa' && (r.estado === 'Aprobada' || r.estado === 'Aplicada')).length,
        pendientes: filas.filter((r) => r.estado === 'Pendiente'),
        personas: Object.values(personas)
            .sort((a, b) => b.aplazamientos - a.aplazamientos || b.pausas - a.pausas || a.nombre.localeCompare(b.nombre)),
        repetidas: Object.values(tareas).filter((t) => t.veces > 1).sort((a, b) => b.veces - a.veces || b.dias - a.dias),
        meses: Object.values(meses).sort((a, b) => a.mes.localeCompare(b.mes)),
    };
}
