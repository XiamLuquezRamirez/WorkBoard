import React from 'react';
import { getImageUrl } from '../../utils/assetHelper';
import { useAvatar } from './AvataresContext';

const PRIORIDAD = {
    Alta: { clase: 'prio-alta', etiqueta: 'ALTA' },
    Media: { clase: 'prio-media', etiqueta: 'MEDIA' },
    Baja: { clase: 'prio-baja', etiqueta: 'BAJA' },
};

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

function fechaCorta(iso) {
    if (!iso) return null;
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]}`;
}

/**
 * Tarjeta de tarea. `estadoVisual` marca el cambio detectado en el último sondeo
 * ('nueva' | 'movida' | 'pausada' | 'completada') y dispara la animación de entrada.
 */
const iniciales = (nombre) => String(nombre || '?')
    .trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export default function TableroCard({ tarea, estadoVisual }) {
    const foto = useAvatar(tarea.empleado_id);
    const prio = PRIORIDAD[tarea.prioridad] || { clase: 'prio-media', etiqueta: (tarea.prioridad || '—').toUpperCase() };
    const dias = tarea.dias_restantes;
    const vencida = dias !== null && dias < 0 && !tarea.fecha_entregada;
    const venceHoy = dias === 0;

    // El avance sólo aporta información mientras la tarea se está trabajando: en
    // "Completada" el 100% es redundante y en "Pendiente" aún no ha empezado.
    // Una tarea en pausa sí lo conserva, porque indica dónde se detuvo.
    const mostrarAvance = Boolean(tarea.checklist)
        && (tarea.estado === 'En Proceso' || tarea.pausada);

    return (
        <article
            className={`tb-card ${estadoVisual ? `tb-anim-${estadoVisual}` : ''} ${tarea.pausada ? 'tb-card-pausada' : ''}`}
            aria-label={`Tarea ${tarea.titulo}`}
        >
            <header className="tb-card-top">
                <span className={`tb-prio ${prio.clase}`}>{prio.etiqueta}</span>
                {tarea.pausada && <span className="tb-badge-pausa">⏸ EN PAUSA</span>}
                {vencida && !tarea.pausada && <span className="tb-badge-vencida">⚠ VENCIDA</span>}
                {venceHoy && !tarea.pausada && <span className="tb-badge-hoy">HOY</span>}
            </header>

            <h4 className="tb-card-titulo" title={tarea.titulo}>{tarea.titulo}</h4>

            {tarea.proyecto && <p className="tb-card-proyecto">{tarea.proyecto}</p>}

            {mostrarAvance && (
                <div className="tb-avance">
                    <div className="tb-avance-top">
                        <span className="tb-avance-pct">{tarea.checklist.pct}%</span>
                        <span className="tb-avance-frac">
                            {tarea.checklist.hechas}/{tarea.checklist.total}
                        </span>
                    </div>
                    <div
                        className="tb-avance-barra"
                        role="progressbar"
                        aria-valuenow={tarea.checklist.pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Avance del checklist: ${tarea.checklist.hechas} de ${tarea.checklist.total}`}
                    >
                        <div
                            className={`tb-avance-fill ${tarea.checklist.pct === 100 ? 'es-completo' : ''}`}
                            style={{ width: `${tarea.checklist.pct}%` }}
                        />
                    </div>
                </div>
            )}

            <footer className="tb-card-pie">
                <span className="tb-card-persona">
                    {foto
                        ? <img src={getImageUrl(foto)} alt="" className="tb-avatar-mini" />
                        : <span className="tb-avatar-mini tb-avatar-vacio" aria-hidden="true">{iniciales(tarea.empleado)}</span>}
                    <span className="tb-card-nombre">{tarea.empleado}</span>
                </span>
                {fechaCorta(tarea.fecha_entregada || tarea.fecha_pactada) && (
                    <span className={`tb-card-fecha ${vencida ? 'es-vencida' : ''}`}>
                        {fechaCorta(tarea.fecha_entregada || tarea.fecha_pactada)}
                    </span>
                )}
            </footer>
        </article>
    );
}
