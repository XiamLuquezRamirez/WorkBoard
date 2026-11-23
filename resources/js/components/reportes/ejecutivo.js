/**
 * Cálculos del Informe Ejecutivo.
 *
 * Reúne lo que antes repartían cuatro informes (Ejecutivo, por Departamento,
 * Avance y Productividad), cada uno con su propia regla. Aquí hay tres
 * preguntas distintas y cada cifra dice a cuál responde:
 *
 *  - ¿Qué se ENTREGÓ en el periodo?   Completadas con fecha_entregada dentro.
 *                                     A tiempo = marca a_tiempo del servidor.
 *  - ¿Se cumplió lo que VENCÍA?       Tareas con fecha_pactada dentro del
 *                                     periodo y ya pasada (o completadas):
 *                                     cuántas están completadas.
 *  - ¿Cómo está HOY?                  Abiertas y vencidas, sin importar el
 *                                     periodo: lo vencido de meses atrás
 *                                     también es deuda de hoy.
 *
 * «vencida», «dias_vencida», «en_pausa» y «a_tiempo» vienen del servidor
 * (IndiceDesempeno): la misma regla que el dashboard, en hora de Bogotá.
 * Las personas se agrupan por empleado_id, no por nombre.
 */

export const DIAS_GRAVE = 7;

const enRango = (fecha, desde, hasta) => Boolean(fecha) && (!desde || fecha >= desde) && (!hasta || fecha <= hasta);

/** Porcentaje entero, o null si no hay base (se muestra «—», no 0 %). */
export const pct = (parte, de) => (de > 0 ? Math.round((parte / de) * 100) : null);

const SIN_AREA = 'Sin departamento';

function nuevoAcumulado() {
    return {
        abiertas: 0, pendientes: 0, enProceso: 0, enRevision: 0, enPausa: 0,
        vencidas: 0, graves: 0,
        entregadas: 0, aTiempo: 0, tarde: 0,
        compromisos: 0, cumplidos: 0,
        creadas: 0,
    };
}

function sumar(acc, t, { desde, hasta, hoy }) {
    const completada = t.estado === 'Completada';
    if (!completada) {
        acc.abiertas += 1;
        if (t.en_pausa) acc.enPausa += 1;
        else if (t.estado === 'En Revisión') acc.enRevision += 1;
        else if (t.estado === 'En Proceso') acc.enProceso += 1;
        else acc.pendientes += 1;
    }
    if (t.vencida) {
        acc.vencidas += 1;
        if ((t.dias_vencida || 0) > DIAS_GRAVE) acc.graves += 1;
    }
    if (completada && enRango(t.fecha_entregada, desde, hasta)) {
        acc.entregadas += 1;
        if (t.a_tiempo === true) acc.aTiempo += 1;
        else acc.tarde += 1;
    }
    // Sólo lo que ya se pudo incumplir: una tarea abierta cuya fecha aún no
    // llega (o es hoy) no es un incumplimiento, aunque caiga en el periodo.
    if (enRango(t.fecha_pactada, desde, hasta) && (completada || t.fecha_pactada < hoy)) {
        acc.compromisos += 1;
        if (completada) acc.cumplidos += 1;
    }
    if (enRango(t.fecha_creacion, desde, hasta)) acc.creadas += 1;
    return acc;
}

function cerrar(acc) {
    return {
        ...acc,
        pctATiempo: pct(acc.aTiempo, acc.entregadas),
        pctCumplimiento: pct(acc.cumplidos, acc.compromisos),
    };
}

const hoyLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Lunes (AAAA-MM-DD) de la semana de una fecha AAAA-MM-DD, sin pasar por UTC. */
function lunesDe(fecha) {
    const [a, m, d] = fecha.split('-').map(Number);
    const dia = new Date(a, m - 1, d);
    const desplazamiento = (dia.getDay() + 6) % 7; // lunes = 0
    dia.setDate(dia.getDate() - desplazamiento);
    const dos = (n) => String(n).padStart(2, '0');
    return `${dia.getFullYear()}-${dos(dia.getMonth() + 1)}-${dos(dia.getDate())}`;
}

/**
 * @param {Array} tareas  filas de /informes/tareas (ya marcadas por el servidor)
 * @param {{desde:string, hasta:string, area:string, persona:number|null}} f
 */
export function calcularEjecutivo(tareas, { desde, hasta, area = '', persona = null }) {
    const visibles = tareas.filter((t) =>
        (!area || (t.departamento || SIN_AREA) === area)
        && (!persona || t.empleado_id === persona)
    );
    const periodo = { desde, hasta, hoy: hoyLocal() };

    const total = cerrar(visibles.reduce((acc, t) => sumar(acc, t, periodo), nuevoAcumulado()));

    const porArea = {};
    const porPersona = {};
    const semanas = {};
    visibles.forEach((t) => {
        const nombreArea = t.departamento || SIN_AREA;
        porArea[nombreArea] ??= { area: nombreArea, personas: new Set(), ...nuevoAcumulado() };
        porArea[nombreArea].personas.add(t.empleado_id ?? `sin-${t.empleado}`);
        sumar(porArea[nombreArea], t, periodo);

        const clave = t.empleado_id ?? `sin-${t.empleado}`;
        porPersona[clave] ??= {
            id: t.empleado_id ?? null,
            nombre: t.empleado || 'Sin responsable',
            area: nombreArea,
            activo: t.empleado_activo !== false,
            ...nuevoAcumulado(),
        };
        sumar(porPersona[clave], t, periodo);

        if (t.estado === 'Completada' && enRango(t.fecha_entregada, desde, hasta)) {
            const lunes = lunesDe(t.fecha_entregada);
            semanas[lunes] ??= { semana: lunes, aTiempo: 0, tarde: 0 };
            if (t.a_tiempo === true) semanas[lunes].aTiempo += 1;
            else semanas[lunes].tarde += 1;
        }
    });

    const areas = Object.values(porArea)
        .map((a) => cerrar({ ...a, personas: a.personas.size }))
        // Primero lo que más pesa hoy: vencidas graves, luego vencidas.
        .sort((a, b) => b.graves - a.graves || b.vencidas - a.vencidas || a.area.localeCompare(b.area));

    const personas = Object.values(porPersona)
        .map(cerrar)
        .sort((a, b) => b.graves - a.graves || b.vencidas - a.vencidas || a.nombre.localeCompare(b.nombre));

    return {
        total,
        areas,
        personas,
        semanas: Object.values(semanas).sort((a, b) => a.semana.localeCompare(b.semana)),
    };
}

/** Opciones de los filtros a partir de las tareas: áreas y personas (por id). */
export function opcionesEjecutivo(tareas, area = '') {
    const areas = [...new Set(tareas.map((t) => t.departamento || SIN_AREA))].sort((a, b) => a.localeCompare(b));
    const personas = {};
    tareas
        .filter((t) => t.empleado_id && (!area || (t.departamento || SIN_AREA) === area))
        .forEach((t) => { personas[t.empleado_id] ??= { id: t.empleado_id, nombre: t.empleado }; });
    return {
        areas,
        personas: Object.values(personas).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    };
}
