import React, { useState } from 'react';
import { useAvatar } from './AvataresContext';

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

function fechaCorta(iso) {
    if (!iso) return null;
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]}`;
}

/**
 * Termómetro de antigüedad.
 *
 * Casi todas las tareas del tablero están vencidas y en prioridad Alta, de modo
 * que esos distintivos se repiten en cada tarjeta y dejan de diferenciar nada.
 * Lo que sí varía es cuánto lleva vencida cada una —de un día a más de un año—,
 * así que es ese dato el que tiñe la tarjeta: a mayor retraso, más intensidad.
 */
function etiquetaRetraso(dias) {
    if (dias <= 7) return `${dias} D`;
    if (dias < 60) return `${dias} D`;
    if (dias < 365) return `${Math.round(dias / 30)} M`;
    const anios = dias / 365;
    return anios < 2 ? `${Math.round(dias / 30)} M` : `${Math.floor(anios)} A`;
}

/**
 * `cortes` son los cuartiles del retraso de las tareas visibles. Con umbrales
 * fijos en meses el reparto depende de lo desfasado que esté el tablero: si
 * todas llevan medio año vencidas caen en el mismo nivel y vuelven a verse
 * iguales. Repartiendo sobre el propio conjunto siempre hay contraste, y sin
 * cortes (pocas tareas) se recurre a una escala absoluta razonable.
 */
function calcularTemperatura(dias, fechaEntregada, cortes) {
    if (fechaEntregada) return { nivel: 'ok', etiqueta: null };
    if (dias === null || dias === undefined) return { nivel: 'neutro', etiqueta: null };

    if (dias > 7) return { nivel: 'frio', etiqueta: null };
    if (dias > 0) return { nivel: 'proximo', etiqueta: `${dias} D` };
    if (dias === 0) return { nivel: 'hoy', etiqueta: 'HOY' };

    const retraso = Math.abs(dias);
    const etiqueta = etiquetaRetraso(retraso);

    if (!cortes) {
        if (retraso <= 7) return { nivel: 'r2', etiqueta };
        if (retraso <= 30) return { nivel: 'r3', etiqueta };
        if (retraso <= 90) return { nivel: 'r4', etiqueta };
        return { nivel: 'r5', etiqueta };
    }

    const [q1, q2, q3] = cortes;
    if (retraso <= q1) return { nivel: 'r2', etiqueta };
    if (retraso <= q2) return { nivel: 'r3', etiqueta };
    if (retraso <= q3) return { nivel: 'r4', etiqueta };
    return { nivel: 'r5', etiqueta };
}

const SELLO = {
    completada: { icono: '✓', texto: 'COMPLETADA' },
    pausada: { icono: '⏸', texto: 'EN PAUSA' },
    movida: { icono: '→', texto: 'EN PROCESO' },
    nueva: { icono: '+', texto: 'NUEVA' },
};

const iniciales = (nombre) => String(nombre || '?')
    .trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export default function TableroCard({ tarea, estadoVisual, innerRef, cortes }) {
    const fotoOriginal = useAvatar(tarea.empleado_id);
    const [fotoFallida, setFotoFallida] = useState(false);
    const foto = fotoFallida ? null : fotoOriginal;

    const dias = tarea.dias_restantes;
    const temp = calcularTemperatura(dias, tarea.fecha_entregada, cortes);

    // El avance sólo aporta información mientras la tarea se está trabajando.
    const mostrarAvance = Boolean(tarea.checklist)
        && (tarea.estado === 'En Proceso' || tarea.pausada);

    const sello = estadoVisual ? SELLO[estadoVisual] : null;
    const esAlta = tarea.prioridad === 'Alta';

    return (
        <article
            ref={innerRef}
            className={[
                'tb-card',
                `tb-temp-${temp.nivel}`,
                estadoVisual ? `tb-anim-${estadoVisual}` : '',
                tarea.pausada ? 'tb-card-pausada' : '',
            ].filter(Boolean).join(' ')}
            aria-label={`Tarea ${tarea.titulo}`}
        >
            {sello && (
                <span className={`tb-sello tb-sello-${estadoVisual}`} aria-hidden="true">
                    <span className="tb-sello-icono">{sello.icono}</span>
                    {sello.texto}
                </span>
            )}

            {/* Franja de temperatura: el indicador principal de la tarjeta */}
            <span className="tb-temp-barra" aria-hidden="true" />

            <h4 className="tb-card-titulo" title={tarea.titulo}>{tarea.titulo}</h4>

            <div className="tb-card-meta">
                <span className="tb-card-persona">
                    {foto
                        ? <img src={foto} alt="" className="tb-avatar-mini" onError={() => setFotoFallida(true)} />
                        : <span className="tb-avatar-mini tb-avatar-vacio" aria-hidden="true">{iniciales(tarea.empleado)}</span>}
                    <span className="tb-card-nombre">{tarea.empleado}</span>
                </span>

                <span className="tb-card-señales">
                    {/* La prioridad sólo se marca cuando es Alta: indicarla en todas
                        las tarjetas no distingue ninguna. */}
                    {esAlta && !tarea.pausada && (
                        <span className="tb-punto-alta" title="Prioridad alta" aria-label="Prioridad alta" />
                    )}
                    {tarea.pausada && <span className="tb-mini-pausa">⏸</span>}
                    {temp.etiqueta && (
                        <span className="tb-temp-chip" title={
                            dias < 0 ? `Vencida hace ${Math.abs(dias)} días` : `Vence en ${dias} días`
                        }>
                            {temp.etiqueta}
                        </span>
                    )}
                    {tarea.fecha_entregada && (
                        <span className="tb-temp-chip es-entregada">
                            {fechaCorta(tarea.fecha_entregada)}
                        </span>
                    )}
                </span>
            </div>


            {mostrarAvance && (
                <div className="tb-avance">
                    <div
                        className="tb-avance-barra"
                        role="progressbar"
                        aria-valuenow={tarea.checklist.pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Avance: ${tarea.checklist.hechas} de ${tarea.checklist.total}`}
                    >
                        <div
                            className={`tb-avance-fill ${tarea.checklist.pct === 100 ? 'es-completo' : ''}`}
                            style={{ width: `${tarea.checklist.pct}%` }}
                        />
                    </div>
                    <span className="tb-avance-pct">
                        {tarea.checklist.hechas}/{tarea.checklist.total}
                    </span>
                </div>
            )}
        </article>
    );
}
