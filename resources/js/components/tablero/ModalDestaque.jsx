import React, { useLayoutEffect, useRef, useState } from 'react';
import { useAvatar } from './AvataresContext';

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

function fechaLarga(iso) {
    if (!iso) return '—';
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '—';
    return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

const iniciales = (nombre) => String(nombre || '?')
    .trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/** Mismo criterio de temperatura que la tarjeta, para que el color coincida. */
function nivelTemperatura(dias, entregada, cortes) {
    if (entregada) return 'ok';
    if (dias === null || dias === undefined) return 'neutro';
    if (dias > 7) return 'frio';
    if (dias > 0) return 'proximo';
    if (dias === 0) return 'hoy';

    const r = Math.abs(dias);
    if (!cortes) {
        if (r <= 7) return 'r2';
        if (r <= 30) return 'r3';
        if (r <= 90) return 'r4';
        return 'r5';
    }
    const [q1, q2, q3] = cortes;
    if (r <= q1) return 'r2';
    if (r <= q2) return 'r3';
    if (r <= q3) return 'r4';
    return 'r5';
}

function textoRetraso(dias) {
    if (dias === null || dias === undefined) return null;
    if (dias > 0) return `Vence en ${dias} día${dias === 1 ? '' : 's'}`;
    if (dias === 0) return 'Vence hoy';
    const r = Math.abs(dias);
    if (r < 60) return `Vencida hace ${r} días`;
    if (r < 365) return `Vencida hace ${Math.round(r / 30)} meses`;
    const a = Math.floor(r / 365);
    return `Vencida hace ${a} año${a === 1 ? '' : 's'}`;
}

/**
 * Vista destacada del carrusel.
 *
 * Se muestra centrada sobre el tablero en lugar de agrandar la tarjeta dentro
 * de su columna: ampliarla ahí desplazaba al resto y el detalle no cabía en el
 * ancho de una columna. Es sólo informativa —la rota el carrusel, no el
 * usuario— así que no captura el foco ni bloquea nada detrás.
 */
export default function ModalDestaque({ tarea, cortes, origen }) {
    const fichaRef = useRef(null);
    const [entrando, setEntrando] = useState(Boolean(origen));

    // La ficha nace encogida sobre la tarjeta de origen y se expande hasta su
    // sitio: así se ve de qué tarjeta procede en lugar de aparecer sin más.
    useLayoutEffect(() => {
        const nodo = fichaRef.current;
        if (!nodo || !origen) { setEntrando(false); return undefined; }

        const destino = nodo.getBoundingClientRect();
        const dx = origen.x - (destino.left + destino.width / 2);
        const dy = origen.y - (destino.top + destino.height / 2);
        const escala = Math.max(0.12, Math.min(origen.w / destino.width, 0.6));

        nodo.style.transition = 'none';
        nodo.style.transform = `translate(${dx}px, ${dy}px) scale(${escala})`;
        nodo.style.opacity = '0.25';
        setEntrando(true);

        const id = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                nodo.style.transition =
                    'transform .72s cubic-bezier(.2,.72,.28,1.02), opacity .45s ease-out';
                nodo.style.transform = '';
                nodo.style.opacity = '';
                setEntrando(false);
            });
        });
        return () => cancelAnimationFrame(id);
    }, [origen, tarea.id]);

    const foto = useAvatar(tarea.empleado_id);
    const nivel = nivelTemperatura(tarea.dias_restantes, tarea.fecha_entregada, cortes);
    const retraso = textoRetraso(tarea.dias_restantes);
    const chk = tarea.checklist;

    return (
        <div className="tb-dest-fondo" aria-hidden="true">
            <article
                ref={fichaRef}
                className={`tb-dest tb-temp-${nivel} ${entrando ? 'es-entrando' : ''}`}
                key={tarea.id}
            >
                <span className="tb-dest-barra" />

                <header className="tb-dest-head">
                    <span className="tb-dest-etiqueta">EN PROCESO</span>
                    {tarea.prioridad === 'Alta' && (
                        <span className="tb-dest-prio">PRIORIDAD ALTA</span>
                    )}
                </header>

                <h2 className="tb-dest-titulo">{tarea.titulo}</h2>

                {tarea.descripcion && (
                    <p className="tb-dest-desc">{tarea.descripcion}</p>
                )}

                <div className="tb-dest-persona">
                    {foto
                        ? <img src={foto} alt="" className="tb-dest-avatar" />
                        : <span className="tb-dest-avatar tb-avatar-vacio">{iniciales(tarea.empleado)}</span>}
                    <div>
                        <span className="tb-dest-nombre">{tarea.empleado}</span>
                        {tarea.cargo && <span className="tb-dest-cargo">{tarea.cargo}</span>}
                    </div>
                </div>

                {chk && (
                    <div className="tb-dest-avance">
                        <div className="tb-dest-avance-top">
                            <span>CHECKLIST</span>
                            <span>{chk.hechas}/{chk.total} · {chk.pct}%</span>
                        </div>
                        <div className="tb-avance-barra">
                            <div
                                className={`tb-avance-fill ${chk.pct === 100 ? 'es-completo' : ''}`}
                                style={{ width: `${chk.pct}%` }}
                            />
                        </div>
                    </div>
                )}

                <dl className="tb-dest-datos">
                    <div>
                        <dt>Fecha pactada</dt>
                        <dd>{fechaLarga(tarea.fecha_pactada)}</dd>
                    </div>
                    {retraso && (
                        <div>
                            <dt>Estado del plazo</dt>
                            <dd className="tb-dest-retraso">{retraso}</dd>
                        </div>
                    )}
                    {tarea.proyecto && (
                        <div className="tb-dest-ancho">
                            <dt>Proyecto</dt>
                            <dd>{tarea.proyecto}</dd>
                        </div>
                    )}
                </dl>

                {/* Barra que agota el tiempo del destaque */}
                <span className="tb-dest-tiempo" />
            </article>
        </div>
    );
}
