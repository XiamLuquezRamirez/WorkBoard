import React from 'react';
import {
    FaCalendarAlt, FaListUl, FaClipboardCheck, FaPaperclip, FaUser, FaFolder,
    FaPause, FaBan, FaUndo, FaArchive, FaArrowRight, FaBullseye, FaCheck,
} from 'react-icons/fa';
import { plazoEnPalabras, hoyLocal } from './FormularioTarea';
import './vistaTarea.css';

const ETAPAS = [
    { estado: 'Pendiente',   texto: 'Por hacer' },
    { estado: 'En Proceso',  texto: 'En proceso' },
    { estado: 'En Revisión', texto: 'En revisión' },
    { estado: 'Completada',  texto: 'Cerrada' },
];

const ymd = (v) => String(v || '').split('T')[0].split(' ')[0];

const fechaCorta = (f) => (f
    ? new Date(`${ymd(f)}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    : '');

/**
 * Lo que hay que mirar primero, según quién mira y en qué punto está la
 * tarea. Una sola frase: si hace falta un párrafo, el flujo está mal.
 */
function siguientePaso({ task, estado, criterios, checklist, pausada, archivada, esResponsable, responsable }) {
    const resumen = criterios?.resumen;
    const permisos = criterios?.permisos;
    const conCriterios = resumen?.total > 0;

    if (archivada) return { tono: 'neutro', texto: 'Tarea archivada. Sólo consulta.' };
    if (pausada) return { tono: 'aviso', texto: 'En pausa: hay que reanudarla antes de seguir.' };
    if (Number(task.bloqueada) === 1) {
        return { tono: 'mal', texto: `Bloqueada: ${task.motivo_bloqueo || 'hay un impedimento declarado'}. Se avanza cuando se levante.` };
    }
    if (estado === 'Completada') {
        return { tono: 'bien', texto: conCriterios ? 'Entrega aceptada: todos los criterios obligatorios se cumplieron.' : 'Tarea cerrada.' };
    }
    if (estado === 'En Revisión') {
        if (permisos?.aceptar) {
            if (!conCriterios) {
                return { tono: 'accion', texto: 'Te toca decidir: la tarea no tiene criterios de aceptación; revisa lo entregado y acéptala o devuélvela.' };
            }
            return resumen?.bloqueos?.length
                ? { tono: 'accion', texto: `Te toca revisar: verifica los criterios (${resumen.bloqueos.length} pendientes de cumplir) y acepta o devuelve la entrega.` }
                : { tono: 'accion', texto: 'Te toca decidir: los criterios obligatorios están cumplidos, ya puedes aceptar la entrega.' };
        }
        if (permisos?.verificar?.length) return { tono: 'accion', texto: 'Te toca verificar los criterios que tienes asignados.' };
        return { tono: 'neutro', texto: 'Entregada. Esperando la revisión del líder.' };
    }

    // Pendiente o En Proceso.
    if (!esResponsable) {
        if (!conCriterios && permisos?.gestionar) {
            return { tono: 'aviso', texto: 'Esta tarea no tiene criterios de aceptación: pacta cómo se dará por buena.' };
        }
        return { tono: 'neutro', texto: `En manos de ${responsable || 'su responsable'}${estado === 'Pendiente' ? ', aún sin empezar' : ''}.` };
    }
    if (estado === 'Pendiente') return { tono: 'accion', texto: 'Cuando empieces, pásala a En proceso.' };
    if (checklist.total > 0 && checklist.hechas < checklist.total) {
        return { tono: 'accion', texto: `Avanza el checklist (${checklist.hechas}/${checklist.total}).${conCriterios ? ' Después declara los criterios y envíala a revisión.' : ''}` };
    }
    if (conCriterios) {
        const sinDeclarar = resumen.total - resumen.declarados;
        return sinDeclarar > 0
            ? { tono: 'accion', texto: `Declara los criterios que ya cumples (${resumen.declarados}/${resumen.total}) y envía la tarea a revisión.` }
            : { tono: 'accion', texto: 'Todo declarado: envía la tarea a revisión para que la acepten.' };
    }
    return { tono: 'accion', texto: 'Cuando termines, márcala como Completada.' };
}

/**
 * Cabecera del detalle de tarea: la tarea entera de un vistazo.
 *
 * Reúne lo que antes estaba repartido por todo el modal (estado, plazo,
 * avance del checklist, criterios, evidencias, pausas) y dice qué toca
 * hacer ahora. Cada cifra lleva a su sección.
 */
export default function VisionGeneralTarea({
    task, estado, criterios, checklist, evidencias, pausada, rechazada, archivada,
    esResponsable, reprogramacionPendiente, onIrA,
}) {
    const resumen = criterios?.resumen;
    const responsable = esResponsable ? 'Tú' : (task.nombre_empleado || task.empleado_nombre || '');
    const indice = ETAPAS.findIndex((e) => e.estado === estado);
    const pactada = ymd(task.fecha_pactada);
    const cerrada = estado === 'Completada';
    const vencida = !cerrada && pactada && pactada < hoyLocal();
    const devuelta = criterios?.aceptaciones?.[0]?.resultado === 'Devuelta' && !cerrada;
    const paso = siguientePaso({ task, estado, criterios, checklist, pausada, archivada, esResponsable, responsable });
    const pctChecklist = checklist.total ? Math.round((checklist.hechas * 100) / checklist.total) : 0;

    return (
        <section className="vg" aria-label="Visión general de la tarea">
            <div className="vg-cabeza">
                <ol className="vg-etapas">
                    {ETAPAS.map((e, i) => (
                        <li key={e.estado} className={i < indice ? 'es-hecha' : i === indice ? 'es-actual' : ''}>
                            <span className="vg-punto">{i < indice || (cerrada && i === indice) ? <FaCheck /> : i + 1}</span>
                            {e.texto}
                        </li>
                    ))}
                </ol>
                <div className="vg-banderas">
                    {archivada && <span className="vg-bandera"><FaArchive /> Archivada</span>}
                    {pausada && <span className="vg-bandera b-aviso"><FaPause /> Pausada</span>}
                    {Number(task.bloqueada) === 1 && <span className="vg-bandera b-mal"><FaBan /> Bloqueada</span>}
                    {(devuelta || rechazada) && <span className="vg-bandera b-mal"><FaUndo /> {devuelta ? 'Devuelta' : 'Rechazada'}</span>}
                    {reprogramacionPendiente && <span className="vg-bandera b-aviso"><FaCalendarAlt /> Reprogramación pendiente</span>}
                </div>
            </div>

            {task.proposito ? (
                <p className="vg-proposito"><FaBullseye /> <span><b>Para qué:</b> {task.proposito}</span></p>
            ) : (
                <p className="vg-proposito es-vacio"><FaBullseye /> <span>Sin propósito definido.</span></p>
            )}

            <div className="vg-cifras">
                <button type="button" className={`vg-cifra ${vencida ? 'c-mal' : ''}`} onClick={() => onIrA?.('fechas')}>
                    <span className="vg-cifra-tit"><FaCalendarAlt /> Plazo</span>
                    <b>{cerrada && task.fecha_entregada ? `Entregada ${fechaCorta(task.fecha_entregada)}` : fechaCorta(pactada) || 'Sin fecha'}</b>
                    <small>{cerrada ? (task.fecha_entregada && pactada ? (ymd(task.fecha_entregada) <= pactada ? 'a tiempo' : 'con retraso') : '') : plazoEnPalabras(pactada)}</small>
                </button>

                <button type="button" className="vg-cifra c-checklist" onClick={() => onIrA?.('checklist')}>
                    <span className="vg-cifra-tit"><FaListUl /> Checklist</span>
                    <b>{checklist.total ? `${checklist.hechas}/${checklist.total}` : '—'}</b>
                    {checklist.total > 0
                        ? <span className="vg-barra"><span style={{ width: `${pctChecklist}%` }} /></span>
                        : <small>sin pasos</small>}
                </button>

                <button type="button" className={`vg-cifra c-criterios ${resumen?.no_cumplidos ? 'c-mal' : ''}`} onClick={() => onIrA?.('criterios')}>
                    <span className="vg-cifra-tit"><FaClipboardCheck /> Criterios</span>
                    <b>{!resumen ? '…' : resumen.total ? `${resumen.cumplidos}/${resumen.total}` : '—'}</b>
                    {resumen?.total > 0
                        ? <span className="vg-barra"><span style={{ width: `${resumen.porcentaje}%` }} /></span>
                        : <small>{resumen ? 'sin criterios' : ''}</small>}
                    {resumen?.total > 0 && <small>{resumen.estado_general}</small>}
                </button>

                <button type="button" className="vg-cifra" onClick={() => onIrA?.('evidencias')}>
                    <span className="vg-cifra-tit"><FaPaperclip /> Evidencias</span>
                    <b>{evidencias}</b>
                    <small>{evidencias === 1 ? 'archivo o enlace' : 'archivos o enlaces'}</small>
                </button>

                <div className="vg-cifra vg-quien">
                    {responsable && <span><FaUser /> {responsable}</span>}
                    <span className={`vg-prioridad p-${String(task.prioridad || 'media').toLowerCase()}`}>Prioridad {task.prioridad || 'Media'}</span>
                    {task.proyecto_nombre && <span><FaFolder /> {task.proyecto_nombre}</span>}
                </div>
            </div>

            <p className={`vg-paso t-${paso.tono}`}>
                <FaArrowRight /> <span>{paso.texto}</span>
            </p>
        </section>
    );
}
