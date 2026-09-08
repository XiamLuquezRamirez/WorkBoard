import React, { useEffect, useMemo, useRef, useState } from 'react';
import useTableroEstado from './useTableroEstado';
import TableroKPIs from './TableroKPIs';
import TableroKanban from './TableroKanban';
import TableroLateral from './TableroLateral';
import TableroCard from './TableroCard';
import { AvataresProvider } from './AvataresContext';
import { getImageUrl } from '../../utils/assetHelper';
import './tablero.css';

const RELOJ_MS = 30000;

/** Detecta eventos destacables comparando dos respuestas consecutivas. */
function detectarEventos(datos, previo) {
    if (!previo || !datos) return [];
    const dondeEsta = (estado) => {
        const mapa = {};
        ['pendiente', 'proceso', 'pausa'].forEach((c) => {
            (estado.columnas[c] || []).forEach((t) => { mapa[t.id] = { col: c, t }; });
        });
        (estado.columnas.completadas?.items || []).forEach((t) => { mapa[t.id] = { col: 'completadas', t }; });
        return mapa;
    };
    const antes = dondeEsta(previo);
    const ahora = dondeEsta(datos);
    const eventos = [];

    Object.entries(ahora).forEach(([id, { col, t }]) => {
        const prev = antes[id];
        if (!prev) {
            eventos.push({ id: `n-${id}-${col}`, tipo: 'nueva', icono: '+', titulo: 'NUEVA TAREA', tarea: t });
        } else if (prev.col !== col) {
            if (col === 'completadas') {
                eventos.push({ id: `c-${id}`, tipo: 'completada', icono: '✓', titulo: 'TAREA COMPLETADA', tarea: t });
            } else if (col === 'pausa') {
                eventos.push({ id: `p-${id}`, tipo: 'pausada', icono: '⚠', titulo: 'TAREA EN PAUSA', tarea: t });
            } else if (col === 'proceso') {
                eventos.push({ id: `m-${id}`, tipo: 'movida', icono: '→', titulo: 'EN PROCESO', tarea: t });
            }
        }
    });
    return eventos;
}

/** Notificaciones temporales; cada una se retira sola a los 4,5 s. */
function Avisos({ eventos }) {
    const [visibles, setVisibles] = useState([]);
    const timersRef = useRef([]);

    useEffect(() => {
        if (!eventos.length) return undefined;
        setVisibles((prev) => [...prev, ...eventos].slice(-3));
        const t = setTimeout(() => {
            setVisibles((prev) => prev.filter((v) => !eventos.some((e) => e.id === v.id)));
        }, 4500);
        timersRef.current.push(t);
        return () => clearTimeout(t);
    }, [eventos]);

    useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

    if (!visibles.length) return null;
    return (
        <div className="tb-avisos" role="status" aria-live="polite">
            {visibles.map((e) => (
                <div key={e.id} className={`tb-aviso tb-aviso-${e.tipo}`}>
                    <span className="tb-aviso-icono">{e.icono}</span>
                    <div>
                        <strong>{e.titulo}</strong>
                        <p>{e.tarea.titulo}</p>
                        <small>{e.tarea.empleado}</small>
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Tareas en pausa. No ocupan columna propia porque suelen ser muy pocas y
 * dejaban una cuarta parte del kanban desaprovechada; se consultan desde su
 * indicador, que abre este panel.
 */
function PanelPausadas({ tareas, onCerrar }) {
    return (
        <div className="tb-modal-fondo" onClick={onCerrar}>
            <section
                className="tb-modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Tareas en pausa"
            >
                <header className="tb-modal-head">
                    <h2>⏸ TAREAS EN PAUSA <span className="tb-modal-n">{tareas.length}</span></h2>
                    <button className="tb-modal-cerrar" onClick={onCerrar} title="Cerrar (Esc)">✕</button>
                </header>

                <div className="tb-modal-body">
                    {tareas.length === 0
                        ? <p className="tb-col-vacia">No hay tareas en pausa.</p>
                        : tareas.map((t) => <TableroCard key={t.id} tarea={t} />)}
                </div>
            </section>
        </div>
    );
}

/**
 * Tareas que provocan una alerta concreta.
 *
 * Las alertas del servidor son sólo contadores, pero las tareas ya vienen en
 * las columnas: basta con filtrarlas aquí con el mismo criterio, sin pedir
 * nada más.
 */
function PanelAlerta({ alerta, datos, onCerrar }) {
    const activas = [
        ...(datos.columnas.pendiente || []),
        ...(datos.columnas.proceso || []),
        ...(datos.columnas.pausa || []),
    ];

    const criterios = {
        vencidas: (t) => t.dias_restantes !== null && t.dias_restantes < 0,
        hoy: (t) => t.dias_restantes === 0,
        semana: (t) => t.dias_restantes !== null && t.dias_restantes > 0 && t.dias_restantes <= 7,
        pausa: (t) => t.pausada,
    };

    const tareas = activas
        .filter(criterios[alerta.id] || (() => false))
        .sort((a, b) => (a.dias_restantes ?? 0) - (b.dias_restantes ?? 0));

    return (
        <div className="tb-modal-fondo" onClick={onCerrar}>
            <section
                className="tb-modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={alerta.texto}
            >
                <header className="tb-modal-head">
                    <h2>
                        {alerta.texto.toUpperCase()}
                        <span className="tb-modal-n">{tareas.length}</span>
                    </h2>
                    <button className="tb-modal-cerrar" onClick={onCerrar} title="Cerrar (Esc)">✕</button>
                </header>

                <div className="tb-modal-body">
                    {tareas.length === 0
                        ? <p className="tb-col-vacia">No hay tareas en esta situación.</p>
                        : tareas.map((t) => <TableroCard key={t.id} tarea={t} />)}
                </div>
            </section>
        </div>
    );
}

export default function TableroSeguimiento(props) {
    return (
        <AvataresProvider>
            <TableroContenido {...props} />
        </AvataresProvider>
    );
}

function TableroContenido({ onCerrar, tvInicial = false }) {
    const [modoTv, setModoTv] = useState(tvInicial);
    const [verPausadas, setVerPausadas] = useState(false);
    // Modo interactivo: detiene el carrusel para que el líder pueda revisar el
    // tablero a su ritmo y abrir el detalle de cualquier tarea.
    const [interactivo, setInteractivo] = useState(false);
    const [alertaAbierta, setAlertaAbierta] = useState(null);
    // Sin onCerrar el tablero vive en su propia pestaña: no hay a dónde "volver",
    // así que se ofrece cerrarla en lugar de regresar a la vista anterior.
    const enPestanaPropia = !onCerrar;
    const [dias] = useState(7);
    const { datos, previo, conectado, cargando } = useTableroEstado({ dias });
    const [hora, setHora] = useState(() => new Date());

    useEffect(() => {
        const t = setInterval(() => setHora(new Date()), RELOJ_MS);
        return () => clearInterval(t);
    }, []);

    // Salir del modo TV con Escape, ya que en TV no hay barra de navegación.
    useEffect(() => {
        const onKey = (ev) => {
            if (ev.key !== 'Escape') return;
            if (alertaAbierta) { setAlertaAbierta(null); return; }
            if (verPausadas) { setVerPausadas(false); return; }
            // En pestaña propia Escape sólo sale del modo TV: cerrar la pestaña
            // desde el script no es fiable y sería un salto brusco para el usuario.
            if (modoTv) setModoTv(false);
            else if (onCerrar) onCerrar();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [modoTv, onCerrar, verPausadas, alertaAbierta]);

    const eventos = useMemo(() => detectarEventos(datos, previo), [datos, previo]);

    if (cargando && !datos) {
        return (
            <div className="tb-root tb-cargando">
                <div className="tb-spinner" aria-label="Cargando tablero" />
                <p>Cargando tablero…</p>
            </div>
        );
    }

    if (!datos) {
        return (
            <div className="tb-root tb-cargando">
                <p className="tb-error">No fue posible cargar el tablero.</p>
                {onCerrar
                    ? <button className="tb-btn" onClick={onCerrar}>Volver</button>
                    : <a className="tb-btn" href="#/dashboard">Ir al tablero de trabajo</a>}
            </div>
        );
    }

    const ambito = datos.alcance.tipo === 'global'
        ? 'TODA LA ORGANIZACIÓN'
        : (datos.alcance.departamento || 'MI EQUIPO').toUpperCase();

    return (
        <div className={`tb-root ${modoTv ? 'tb-tv' : ''}`}>
            <header className="tb-header">
                <div className="tb-header-izq">
                    <img
                        src={getImageUrl('images/logo.png')}
                        alt="Ingeer"
                        className="tb-logo"
                    />
                    <div className="tb-header-txt">
                        <h1>TABLERO DE SEGUIMIENTO</h1>
                        <p className="tb-ambito">{ambito}</p>
                    </div>
                </div>

                <div className="tb-header-der">
                    <span className={`tb-conexion ${conectado ? 'ok' : 'ko'}`}>
                        {conectado ? '✓ CONECTADO' : '⚠ CONEXIÓN PERDIDA'}
                    </span>
                    <span className="tb-hora">
                        {hora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!modoTv && (
                        <>
                            <button
                                className={`tb-btn ${interactivo ? '' : 'tb-btn-sec'}`}
                                onClick={() => { setInteractivo((v) => !v); setAlertaAbierta(null); }}
                                title={interactivo
                                    ? 'Volver a la rotación automática'
                                    : 'Detener la rotación y explorar el tablero'}
                            >
                                {interactivo ? '⏸ Explorando' : '☝ Interactuar'}
                            </button>
                            <button className="tb-btn" onClick={() => setModoTv(true)}>Modo TV</button>
                            {onCerrar && <button className="tb-btn tb-btn-sec" onClick={onCerrar}>Salir</button>}
                            {enPestanaPropia && (
                                <a className="tb-btn tb-btn-sec" href="#/dashboard">Ir al tablero de trabajo</a>
                            )}
                        </>
                    )}
                </div>
            </header>

            <TableroKPIs
                kpis={datos.kpis}
                previo={previo}
                onVerPausadas={() => setVerPausadas(true)}
            />

            <div className="tb-cuerpo">
                <TableroKanban
                    datos={datos}
                    previo={previo}
                    modoTv={modoTv}
                    interactivo={interactivo}
                />
                <TableroLateral
                    datos={datos}
                    interactivo={interactivo}
                    onVerAlerta={setAlertaAbierta}
                />
            </div>

            {alertaAbierta && (
                <PanelAlerta
                    alerta={alertaAbierta}
                    datos={datos}
                    onCerrar={() => setAlertaAbierta(null)}
                />
            )}

            {verPausadas && (
                <PanelPausadas
                    tareas={datos.columnas.pausa || []}
                    onCerrar={() => setVerPausadas(false)}
                />
            )}

            <Avisos eventos={eventos} />

            {modoTv && (
                <button className="tb-salir-tv" onClick={() => setModoTv(false)} title="Salir del modo TV (Esc)">
                    ✕
                </button>
            )}
        </div>
    );
}
