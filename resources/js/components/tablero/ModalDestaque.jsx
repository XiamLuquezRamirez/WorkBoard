import React, { useEffect, useRef, useState } from 'react';
import axiosInstance from '../../axiosConfig';
import { POR_BLOQUE } from './useCarruselDestaque';
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
 * Detalle de una tarea, abierto desde el tablero en modo interactivo.
 *
 * Las subtareas no viajan en el sondeo —sólo interesan al abrir una tarea—
 * así que se piden en ese momento a /subtareas/{id}.
 */
export function DetalleTarea({ tarea, cortes, onCerrar }) {
    const foto = useAvatar(tarea.empleado_id);
    const [items, setItems] = useState(null);
    const nivel = nivelTemperatura(tarea.dias_restantes, tarea.fecha_entregada, cortes);
    const retraso = textoRetraso(tarea.dias_restantes);

    useEffect(() => {
        let vivo = true;
        axiosInstance.get(`/subtareas/${tarea.id}`)
            .then((r) => vivo && setItems(Array.isArray(r.data) ? r.data : []))
            .catch(() => vivo && setItems([]));
        return () => { vivo = false; };
    }, [tarea.id]);

    useEffect(() => {
        const onKey = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); onCerrar(); } };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [onCerrar]);

    return (
        <div className="tb-modal-fondo" onClick={onCerrar}>
            <section
                className={`tb-modal tb-temp-${nivel}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={`Detalle de ${tarea.titulo}`}
            >
                <header className="tb-modal-head">
                    <h2>{tarea.titulo}</h2>
                    <button className="tb-modal-cerrar" onClick={onCerrar} title="Cerrar (Esc)">✕</button>
                </header>

                <div className="tb-modal-body tb-detalle-body">
                    {tarea.descripcion && <p className="tb-slide-desc">{tarea.descripcion}</p>}

                    <div className="tb-slide-persona">
                        {foto
                            ? <img src={foto} alt="" className="tb-slide-avatar" />
                            : <span className="tb-slide-avatar tb-avatar-vacio">{iniciales(tarea.empleado)}</span>}
                        <div className="tb-slide-quien">
                            <span className="tb-slide-nombre">{tarea.empleado}</span>
                            {tarea.cargo && <span className="tb-slide-cargo">{tarea.cargo}</span>}
                        </div>
                        {retraso && <span className="tb-slide-plazo">{retraso}</span>}
                    </div>

                    <dl className="tb-slide-datos">
                        <div><dt>Estado</dt><dd>{tarea.estado}</dd></div>
                        <div><dt>Prioridad</dt><dd>{tarea.prioridad || '—'}</dd></div>
                        <div><dt>Fecha pactada</dt><dd>{fechaLarga(tarea.fecha_pactada)}</dd></div>
                        {tarea.fecha_entregada && (
                            <div><dt>Entregada</dt><dd>{fechaLarga(tarea.fecha_entregada)}</dd></div>
                        )}
                        {tarea.proyecto && (
                            <div className="tb-dest-ancho"><dt>Proyecto</dt><dd>{tarea.proyecto}</dd></div>
                        )}
                    </dl>

                    <div className="tb-items">
                        <h3 className="tb-items-titulo">
                            CHECKLIST
                            {items && items.length > 0 && (
                                <span className="tb-items-n">
                                    {items.filter((i) => Number(i.completada) === 1).length}/{items.length}
                                </span>
                            )}
                        </h3>

                        {items === null && <p className="tb-col-vacia">Cargando…</p>}
                        {items && items.length === 0 && (
                            <p className="tb-col-vacia">Esta tarea no tiene checklist.</p>
                        )}
                        {items && items.length > 0 && (
                            <ul className="tb-items-lista">
                                {items.map((it) => (
                                    <li
                                        key={it.id}
                                        className={`tb-item ${Number(it.completada) === 1 ? 'es-hecho' : ''}`}
                                    >
                                        <span className="tb-item-marca">
                                            {Number(it.completada) === 1 ? '✓' : ''}
                                        </span>
                                        <span className="tb-item-txt">{it.titulo}</span>
                                        {it.fecha_vencimiento && (
                                            <span className="tb-item-fecha">
                                                {fechaLarga(it.fecha_vencimiento)}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}

/** Ficha de una tarea dentro de la columna destacada. */
function FichaTarea({ tarea, cortes }) {
    const foto = useAvatar(tarea.empleado_id);

    const nivel = nivelTemperatura(tarea.dias_restantes, tarea.fecha_entregada, cortes);
    const retraso = textoRetraso(tarea.dias_restantes);
    const chk = tarea.checklist;

    return (
        <article className={`tb-slide-ficha tb-temp-${nivel}`}>
            <span className="tb-dest-barra" />

            <h3 className="tb-slide-titulo">{tarea.titulo}</h3>

            {tarea.descripcion && (
                <p className="tb-slide-desc">{tarea.descripcion}</p>
            )}

            <div className="tb-slide-persona">
                {foto
                    ? <img src={foto} alt="" className="tb-slide-avatar" />
                    : <span className="tb-slide-avatar tb-avatar-vacio">{iniciales(tarea.empleado)}</span>}
                <div className="tb-slide-quien">
                    <span className="tb-slide-nombre">{tarea.empleado}</span>
                    {tarea.cargo && <span className="tb-slide-cargo">{tarea.cargo}</span>}
                </div>
                {retraso && <span className="tb-slide-plazo">{retraso}</span>}
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

            <dl className="tb-slide-datos">
                    <div>
                        <dt>Fecha pactada</dt>
                        <dd>{fechaLarga(tarea.fecha_pactada)}</dd>
                    </div>
                    <div>
                        <dt>Prioridad</dt>
                        <dd>{tarea.prioridad || '—'}</dd>
                    </div>
                    {tarea.proyecto && (
                        <div className="tb-dest-ancho">
                            <dt>Proyecto</dt>
                            <dd>{tarea.proyecto}</dd>
                        </div>
                )}
            </dl>
        </article>
    );
}

/** Ficha de una alerta dentro de la sección de alertas. */
function FichaAlerta({ alerta }) {
    return (
        <article className={`tb-slide-ficha tb-slide-al ${alerta.tono}`}>
            <span className="tb-dest-barra" />
            <div className="tb-slide-alerta">
                <span className="tb-slide-alerta-n">{alerta.n}</span>
                <div>
                    <h3 className="tb-slide-titulo">{alerta.texto}</h3>
                    <p className="tb-slide-desc">{alerta.detalle}</p>
                </div>
            </div>
        </article>
    );
}

/**
 * Slider del carrusel: muestra una sección completa —una columna del kanban o
 * las alertas— con todas sus fichas a la vez.
 *
 * Cuando los elementos no caben en una sola vista, la sección se recorre por
 * bloques antes de girar a la siguiente, de modo que no se pierde ninguno.
 * Las secciones giran en 3D sobre el eje vertical.
 */
export default function ModalDestaque({ seccion, bloque, girando, cortes }) {
    if (!seccion) return null;

    const bloques = Math.max(1, Math.ceil(seccion.elementos.length / POR_BLOQUE));
    const indiceBloque = Math.max(0, Math.min(bloque, bloques - 1));
    const visibles = seccion.elementos.slice(
        indiceBloque * POR_BLOQUE,
        indiceBloque * POR_BLOQUE + POR_BLOQUE
    );

    return (
        <div className="tb-dest-fondo" aria-hidden="true">
            <div className="tb-slider">
                <section
                    className={`tb-slide ${girando ? 'es-girando' : ''}`}
                    key={seccion.clave}
                >
                    <header className={`tb-slide-head ${seccion.color}`}>
                        <span className="tb-slide-etiqueta">{seccion.titulo}</span>
                        <span className="tb-slide-n">{seccion.total}</span>
                    </header>

                    {/* Un bloque por vista: se indica cuál se está viendo para
                        que se entienda que la columna continúa. */}
                    {bloques > 1 && (
                        <div className="tb-slide-bloques">
                            {Array.from({ length: bloques }, (_, i) => (
                                <span
                                    key={i}
                                    className={`tb-slide-punto ${i === indiceBloque ? 'es-actual' : ''}`}
                                />
                            ))}
                            <span className="tb-slide-bloque-txt">
                                {indiceBloque + 1} de {bloques}
                            </span>
                        </div>
                    )}

                    <div className="tb-slide-cuerpo" key={`b-${indiceBloque}`}>
                        {visibles.map((el) => (
                            seccion.clave === 'alertas'
                                ? <FichaAlerta key={el.id} alerta={el} />
                                : <FichaTarea key={el.id} tarea={el} cortes={cortes} />
                        ))}
                    </div>

                    {seccion.restantes > 0 && indiceBloque === bloques - 1 && (
                        <p className="tb-slide-mas">+{seccion.restantes} más en esta columna</p>
                    )}

                    {!girando && (
                        <span
                            className="tb-dest-tiempo"
                            key={`t-${seccion.clave}-${indiceBloque}`}
                        />
                    )}
                </section>
            </div>
        </div>
    );
}
