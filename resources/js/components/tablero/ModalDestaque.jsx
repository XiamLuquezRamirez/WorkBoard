import React from 'react';
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

/** Ficha de una tarea dentro de la columna destacada. */
function FichaTarea({ tarea, cortes, enfocada }) {
    const foto = useAvatar(tarea.empleado_id);
    const nivel = nivelTemperatura(tarea.dias_restantes, tarea.fecha_entregada, cortes);
    const retraso = textoRetraso(tarea.dias_restantes);
    const chk = tarea.checklist;

    return (
        <article className={`tb-slide-ficha tb-temp-${nivel} ${enfocada ? 'es-enfocada' : ''}`}>
            <span className="tb-dest-barra" />

            <h3 className="tb-slide-titulo">{tarea.titulo}</h3>

            {enfocada && tarea.descripcion && (
                <p className="tb-slide-desc">{tarea.descripcion}</p>
            )}

            <div className="tb-slide-persona">
                {foto
                    ? <img src={foto} alt="" className="tb-slide-avatar" />
                    : <span className="tb-slide-avatar tb-avatar-vacio">{iniciales(tarea.empleado)}</span>}
                <div className="tb-slide-quien">
                    <span className="tb-slide-nombre">{tarea.empleado}</span>
                    {enfocada && tarea.cargo && <span className="tb-slide-cargo">{tarea.cargo}</span>}
                </div>
                {retraso && <span className="tb-slide-plazo">{retraso}</span>}
            </div>

            {enfocada && chk && (
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

            {enfocada && (
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
            )}
        </article>
    );
}

/** Ficha de una alerta dentro de la sección de alertas. */
function FichaAlerta({ alerta, enfocada }) {
    return (
        <article className={`tb-slide-ficha tb-slide-al ${alerta.tono} ${enfocada ? 'es-enfocada' : ''}`}>
            <span className="tb-dest-barra" />
            <div className="tb-slide-alerta">
                <span className="tb-slide-alerta-n">{alerta.n}</span>
                <div>
                    <h3 className="tb-slide-titulo">{alerta.texto}</h3>
                    {enfocada && <p className="tb-slide-desc">{alerta.detalle}</p>}
                </div>
            </div>
        </article>
    );
}

/**
 * Slider del carrusel: muestra una sección completa —una columna del kanban o
 * las alertas— y hace zoom sobre sus elementos uno a uno.
 *
 * Las secciones giran en 3D sobre el eje vertical, de modo que el paso de una a
 * otra se percibe como un carrusel y no como un reemplazo brusco.
 */
export default function ModalDestaque({ seccion, indice, girando, cortes }) {
    if (!seccion) return null;

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

                    <div className="tb-slide-cuerpo">
                        {seccion.elementos.map((el, i) => (
                            seccion.clave === 'alertas'
                                ? <FichaAlerta key={el.id} alerta={el} enfocada={i === indice} />
                                : <FichaTarea key={el.id} tarea={el} cortes={cortes} enfocada={i === indice} />
                        ))}
                    </div>

                    {seccion.restantes > 0 && (
                        <p className="tb-slide-mas">+{seccion.restantes} más en esta columna</p>
                    )}

                    {indice >= 0 && (
                        <span className="tb-dest-tiempo" key={`t-${seccion.clave}-${indice}`} />
                    )}
                </section>
            </div>
        </div>
    );
}
