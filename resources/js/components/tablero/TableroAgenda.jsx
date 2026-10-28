import React, { useEffect, useState } from 'react';
import axiosInstance from '../../axiosConfig';
import { useAvatar } from './AvataresContext';

const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const partes = (iso) => {
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
    return Number.isNaN(d.getTime())
        ? null
        : { dia: d.getDate(), mes: MESES[d.getMonth()], anio: d.getFullYear(), semana: d.getDay() };
};

const iniciales = (nombre) => String(nombre || '?')
    .trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/** Resume el hueco entre dos días con entregas, para que no parezca continuo. */
function textoHueco(dias) {
    if (dias < 2) return null;
    if (dias < 14) return `${dias} días sin entregas`;
    if (dias < 60) return `${Math.round(dias / 7)} semanas sin entregas`;
    return `${Math.round(dias / 30)} meses sin entregas`;
}

function Entrega({ tarea, onAbrir }) {
    const foto = useAvatar(tarea.empleado_id);

    const senales = [
        tarea.bloqueada && { k: 'bloq', txt: '⛔ Bloqueada', clase: 'es-bloqueada' },
        tarea.pausada && { k: 'pausa', txt: '⏸ En pausa', clase: 'es-pausada' },
        tarea.sin_criterio && { k: 'sc', txt: 'Sin criterio', clase: 'es-sincriterio' },
    ].filter(Boolean);

    const Marco = onAbrir ? 'button' : 'div';

    return (
        <Marco
            className={`tb-ag-tarea ${onAbrir ? 'es-pulsable' : ''}`}
            onClick={onAbrir ? () => onAbrir(tarea) : undefined}
            title={onAbrir ? `Ver ${tarea.titulo}` : undefined}
        >
            {foto
                ? <img src={foto} alt="" className="tb-ag-avatar" />
                : <span className="tb-ag-avatar tb-avatar-vacio">{iniciales(tarea.empleado)}</span>}

            <span className="tb-ag-info">
                <span className="tb-ag-titulo">{tarea.titulo}</span>
                <span className="tb-ag-quien">
                    {tarea.empleado}
                    {tarea.proyecto && <span className="tb-ag-proyecto"> · {tarea.proyecto}</span>}
                </span>
                {senales.length > 0 && (
                    <span className="tb-ag-senales">
                        {senales.map((s) => (
                            <span key={s.k} className={`tb-ag-senal ${s.clase}`}>{s.txt}</span>
                        ))}
                    </span>
                )}
            </span>

            {tarea.prioridad === 'Alta' && (
                <span className="tb-ag-alta" title="Prioridad alta" aria-hidden="true" />
            )}
        </Marco>
    );
}

/**
 * Agenda de entregas del equipo.
 *
 * No es un calendario de mes: recorre sólo los días que tienen entregas, más
 * hoy. Un recorrido día a día de varios meses serían cientos de filas vacías —
 * hoy el equipo abarca de marzo a octubre—, y los huecos se resumen en una
 * línea en lugar de dibujarse.
 *
 * Se pide al abrirla y no en el sondeo del tablero: el rango es largo y no
 * cambia cada cinco segundos.
 */
export default function TableroAgenda({ datosTablero, interactivo, onVerTarea, onCerrar }) {
    // La agenda envía lo justo para el listado; el detalle necesita bastante
    // más (descripción, cargo, días restantes). Como la tarea completa ya viaja
    // en las columnas del tablero, se resuelve por id en lugar de repetir esos
    // campos en un rango que abarca meses.
    const tareaCompleta = (id) => {
        const col = datosTablero?.columnas || {};
        return [
            ...(col.pendiente || []),
            ...(col.proceso || []),
            ...(col.revision || []),
            ...(col.pausa || []),
            ...(col.completadas?.items || []),
        ].find((t) => t.id === id) || null;
    };

    const abrir = (t) => {
        const completa = tareaCompleta(t.id);
        if (completa) onVerTarea(completa);
    };

    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let vivo = true;
        axiosInstance.get('/tablero/agenda')
            .then((r) => vivo && setDatos(r.data))
            .catch(() => vivo && setError(true));
        return () => { vivo = false; };
    }, []);

    useEffect(() => {
        const onKey = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); onCerrar(); } };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [onCerrar]);

    const dias = datos?.dias || [];

    return (
        <div className="tb-modal-fondo" onClick={onCerrar}>
            <section
                className="tb-modal tb-modal-agenda"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Agenda de entregas"
            >
                <header className="tb-modal-head">
                    <h2>Agenda de entregas</h2>
                    <button className="tb-modal-cerrar" onClick={onCerrar} title="Cerrar (Esc)">✕</button>
                </header>

                <div className="tb-modal-body">
                    {error && <p className="tb-col-vacia">No fue posible cargar la agenda.</p>}
                    {!error && datos === null && <p className="tb-col-vacia">Cargando…</p>}

                    {datos && dias.length === 0 && (
                        <p className="tb-col-vacia">No hay entregas con fecha pactada.</p>
                    )}

                    {datos && dias.length > 0 && (
                        <ol className="tb-agenda">
                            {dias.map((d, i) => {
                                const p = partes(d.fecha);
                                if (!p) return null;

                                // Hueco respecto al día anterior listado.
                                const previo = i > 0 ? dias[i - 1] : null;
                                const salto = previo ? d.dias - previo.dias : 0;
                                const hueco = previo ? textoHueco(salto) : null;

                                const finde = p.semana === 0 || p.semana === 6;

                                return (
                                    <React.Fragment key={d.fecha}>
                                        {hueco && <li className="tb-ag-hueco">{hueco}</li>}

                                        <li className={`tb-ag-dia ${d.es_hoy ? 'es-hoy' : ''} ${finde ? 'es-finde' : ''}`}>
                                            <div className="tb-ag-fecha">
                                                <span className="tb-ag-dsem">{DIAS[p.semana]}</span>
                                                <strong className="tb-ag-num">{p.dia}</strong>
                                                <span className="tb-ag-mes">
                                                    {p.mes} {p.anio}
                                                </span>
                                                {d.es_hoy && <span className="tb-ag-hoy">HOY</span>}
                                                {!d.es_hoy && d.dias < 0 && (
                                                    <span className="tb-ag-atraso">
                                                        hace {Math.abs(d.dias)} d
                                                    </span>
                                                )}
                                            </div>

                                            <div className="tb-ag-lista">
                                                {d.tareas.length === 0
                                                    ? <p className="tb-ag-nada">Sin entregas pactadas para hoy</p>
                                                    : d.tareas.map((t) => (
                                                        <Entrega
                                                            key={t.id}
                                                            tarea={t}
                                                            onAbrir={interactivo ? abrir : null}
                                                        />
                                                    ))}
                                            </div>
                                        </li>
                                    </React.Fragment>
                                );
                            })}
                        </ol>
                    )}
                </div>
            </section>
        </div>
    );
}
