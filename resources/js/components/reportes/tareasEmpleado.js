/**
 * Cálculos de «Tareas por empleado»: el detalle de cada tarea, agrupado por
 * persona (empleado_id, no nombre).
 *
 * Cada tarea cae en UNA situación, así las columnas suman el total. Vencida no
 * es una situación sino una marca (la del servidor): una tarea puede estar
 * Pendiente o En Proceso y además vencida.
 */
export const SITUACIONES = ['Pendiente', 'En Proceso', 'En Revisión', 'En pausa', 'Completada'];

const SIN_AREA = 'Sin departamento';

export const situacion = (t) => (t.en_pausa ? 'En pausa' : String(t.estado || '').trim());

export const FILTROS_VACIOS = {
    area: '', persona: null, situacion: '', desde: '', hasta: '', vencidas: false, buscar: '',
};

const cuentaVacia = () => Object.fromEntries(SITUACIONES.map((s) => [s, 0]));

export function agruparPorPersona(tareas, f) {
    const q = f.buscar.trim().toLowerCase();
    const grupos = {};

    tareas
        .filter((t) => (!f.area || (t.departamento || SIN_AREA) === f.area)
            && (!f.persona || t.empleado_id === f.persona)
            && (!f.situacion || situacion(t) === f.situacion)
            && (!f.vencidas || t.vencida)
            && (!f.desde || (t.fecha_pactada && t.fecha_pactada >= f.desde))
            && (!f.hasta || (t.fecha_pactada && t.fecha_pactada <= f.hasta))
            && (!q || String(t.titulo || '').toLowerCase().includes(q)))
        .forEach((t) => {
            const clave = String(t.empleado_id ?? `sin-${t.empleado}`);
            grupos[clave] ??= {
                clave,
                nombre: t.empleado || 'Sin responsable',
                area: t.departamento || SIN_AREA,
                activo: t.empleado_activo !== false,
                tareas: [],
                total: 0,
                vencidas: 0,
                cuenta: cuentaVacia(),
            };
            const g = grupos[clave];
            g.tareas.push(t);
            g.total += 1;
            if (t.vencida) g.vencidas += 1;
            const s = situacion(t);
            g.cuenta[s] = (g.cuenta[s] || 0) + 1;
        });

    return Object.values(grupos)
        .map((g) => ({
            ...g,
            // Lo vencido primero; lo demás, por fecha pactada (sin fecha, al final).
            tareas: g.tareas.sort((a, b) => (b.dias_vencida || 0) - (a.dias_vencida || 0)
                || String(a.fecha_pactada || '9999').localeCompare(String(b.fecha_pactada || '9999'))),
        }))
        .sort((a, b) => b.vencidas - a.vencidas || a.nombre.localeCompare(b.nombre));
}

export function totales(grupos) {
    return grupos.reduce((acc, g) => {
        acc.total += g.total;
        acc.vencidas += g.vencidas;
        SITUACIONES.forEach((s) => { acc.cuenta[s] += g.cuenta[s] || 0; });
        return acc;
    }, { total: 0, vencidas: 0, cuenta: cuentaVacia() });
}
