/**
 * Cálculos del informe «Puntualidad y vencidas».
 *
 * Reemplaza a «Cumplimiento» y a «Tiempo», que medían otra cosa:
 *  - Cumplimiento llamaba «recurrentes no cumplidas» a títulos repetidos, no
 *    contaba las tareas abiertas vencidas (el incumplimiento principal) y
 *    marcaba «Atrasada» hasta las completadas.
 *  - Tiempo contaba desde el visto bueno (o desde 1970 si no lo había) e
 *    inventaba horas multiplicando los días por 8.
 *
 * Aquí, dos preguntas:
 *  - PUNTUALIDAD (en el periodo): de lo entregado, qué llegó a tiempo y, de
 *    lo que llegó tarde, con cuántos días de retraso.
 *  - VENCIDAS (hoy): qué sigue abierto con la fecha pasada, cuánto lleva así
 *    y de quién es. vencida/dias_vencida/a_tiempo vienen del servidor.
 */

const enRango = (fecha, desde, hasta) => Boolean(fecha) && (!desde || fecha >= desde) && (!hasta || fecha <= hasta);

export const pct = (parte, de) => (de > 0 ? Math.round((parte / de) * 100) : null);

/** Días entre dos fechas AAAA-MM-DD, en fechas locales (sin pasar por UTC). */
export function diasEntre(desde, hasta) {
    if (!desde || !hasta) return null;
    const [a1, m1, d1] = desde.slice(0, 10).split('-').map(Number);
    const [a2, m2, d2] = hasta.slice(0, 10).split('-').map(Number);
    return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

export const TRAMOS_RETRASO = [
    { id: '1-2', texto: '1–2 días', min: 1, max: 2 },
    { id: '3-7', texto: '3–7 días', min: 3, max: 7 },
    { id: '8-30', texto: '8–30 días', min: 8, max: 30 },
    { id: '30+', texto: 'Más de 30', min: 31, max: Infinity },
];

export const TRAMOS_VENCIDA = [
    { id: '1-7', texto: '1–7 días', min: 1, max: 7, color: '#f59e0b' },
    { id: '8-30', texto: '8–30 días', min: 8, max: 30, color: '#ea580c' },
    { id: '31-90', texto: '31–90 días', min: 31, max: 90, color: '#dc2626' },
    { id: '90+', texto: 'Más de 90', min: 91, max: Infinity, color: '#7f1d1d' },
];

const tramoDe = (tramos, dias) => tramos.find((t) => dias >= t.min && dias <= t.max) || tramos[0];

const SIN_AREA = 'Sin departamento';

/**
 * @param {Array} tareas filas de /informes/tareas (marcadas por el servidor)
 * @param {{desde:string, hasta:string, area:string, persona:number|null}} f
 */
export function calcularPuntualidad(tareas, { desde, hasta, area = '', persona = null }) {
    const visibles = tareas.filter((t) =>
        (!area || (t.departamento || SIN_AREA) === area)
        && (!persona || t.empleado_id === persona)
    );

    // ── Puntualidad del periodo ────────────────────────────────────────────
    const entregadas = visibles.filter((t) => t.estado === 'Completada' && enRango(t.fecha_entregada, desde, hasta));
    const tarde = entregadas
        .filter((t) => t.a_tiempo === false)
        .map((t) => ({ ...t, diasTarde: Math.max(1, diasEntre(t.fecha_pactada, t.fecha_entregada) || 1) }))
        .sort((a, b) => b.diasTarde - a.diasTarde);
    const aTiempo = entregadas.length - tarde.length;
    const retrasoPromedio = tarde.length
        ? Math.round((tarde.reduce((s, t) => s + t.diasTarde, 0) / tarde.length) * 10) / 10
        : null;
    const porTramoRetraso = TRAMOS_RETRASO.map((tr) => ({
        ...tr, tareas: tarde.filter((t) => tramoDe(TRAMOS_RETRASO, t.diasTarde).id === tr.id).length,
    }));

    // ── Vencidas hoy ──────────────────────────────────────────────────────
    const vencidas = visibles
        .filter((t) => t.vencida)
        .map((t) => ({ ...t, tramo: tramoDe(TRAMOS_VENCIDA, t.dias_vencida || 1) }))
        .sort((a, b) => (b.dias_vencida || 0) - (a.dias_vencida || 0));
    const porTramoVencida = TRAMOS_VENCIDA.map((tr) => ({
        ...tr, tareas: vencidas.filter((t) => t.tramo.id === tr.id).length,
    }));

    // ── Por persona: las dos cosas juntas ─────────────────────────────────
    const personas = {};
    const clave = (t) => t.empleado_id ?? `sin-${t.empleado}`;
    const fichaDe = (t) => {
        const k = clave(t);
        personas[k] ??= {
            id: t.empleado_id ?? null,
            nombre: t.empleado || 'Sin responsable',
            area: t.departamento || SIN_AREA,
            activo: t.empleado_activo !== false,
            entregadas: 0, aTiempo: 0, tarde: 0, diasTarde: 0,
            vencidas: 0, graves: 0, masAntigua: 0,
        };
        return personas[k];
    };
    entregadas.forEach((t) => {
        const p = fichaDe(t);
        p.entregadas += 1;
        if (t.a_tiempo === false) p.tarde += 1; else p.aTiempo += 1;
    });
    tarde.forEach((t) => { fichaDe(t).diasTarde += t.diasTarde; });
    vencidas.forEach((t) => {
        const p = fichaDe(t);
        p.vencidas += 1;
        if ((t.dias_vencida || 0) > 7) p.graves += 1;
        p.masAntigua = Math.max(p.masAntigua, t.dias_vencida || 0);
    });
    const listaPersonas = Object.values(personas)
        .map((p) => ({
            ...p,
            pctATiempo: pct(p.aTiempo, p.entregadas),
            retrasoPromedio: p.tarde ? Math.round((p.diasTarde / p.tarde) * 10) / 10 : null,
        }))
        .sort((a, b) => b.graves - a.graves || b.vencidas - a.vencidas || b.tarde - a.tarde || a.nombre.localeCompare(b.nombre));

    return {
        entregadas: entregadas.length,
        aTiempo,
        tarde,
        pctATiempo: pct(aTiempo, entregadas.length),
        retrasoPromedio,
        porTramoRetraso,
        vencidas,
        graves: vencidas.filter((t) => (t.dias_vencida || 0) > 7).length,
        porTramoVencida,
        personas: listaPersonas,
    };
}
