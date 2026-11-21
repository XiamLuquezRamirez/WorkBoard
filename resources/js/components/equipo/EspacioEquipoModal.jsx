import React, { useEffect, useMemo, useState } from 'react';
import axiosInstance from '../../axiosConfig';
import Chat from './Chat';
import FormularioReunion, { avisarCambioReuniones } from './FormularioReunion';
import TableroPlano from '../tablero/TableroPlano';
import { AvataresProvider } from '../tablero/AvataresContext';
import { useUser } from '../UserContext';
import './espacio.css';

/**
 * Icono y color por tipo de evento. Lo que frena el trabajo pesa más que lo
 * que sólo lo mueve, así que bloqueos y pausas se distinguen de un vistazo.
 */
const EVENTOS = {
    'Bloqueada':                 { icono: '⛔', clase: 'ev-malo' },
    'Desbloqueada':              { icono: '✓',  clase: 'ev-bueno' },
    'Pausada':                   { icono: '⏸',  clase: 'ev-aviso' },
    'Pausa solicitada':          { icono: '⏸',  clase: 'ev-aviso' },
    'Pausa aprobada':            { icono: '⏸',  clase: 'ev-aviso' },
    'Reanudada':                 { icono: '▶',  clase: 'ev-bueno' },
    'Reprogramada':              { icono: '📅', clase: 'ev-aviso' },
    'Reprogramación solicitada': { icono: '📅', clase: 'ev-aviso' },
    'Reprogramación aprobada':   { icono: '📅', clase: 'ev-aviso' },
    'Checklist':                 { icono: '☑',  clase: 'ev-neutro' },
    'Criterio':                  { icono: '◎',  clase: 'ev-neutro' },
};

const iconoDe = (tipo) => EVENTOS[tipo] || { icono: '•', clase: 'ev-neutro' };

const iniciales = (nombre) => String(nombre || '?')
    .trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/**
 * Fecha en palabras. Un flujo de actividad se lee por cercanía —«hace 10 min»
 * dice más que una marca de tiempo— y sólo se recurre a la fecha cuando el
 * evento ya no es reciente.
 */
function haceCuanto(iso) {
    if (!iso) return '';
    const t = new Date(String(iso).replace(' ', 'T'));
    if (Number.isNaN(t.getTime())) return '';

    const seg = Math.floor((Date.now() - t.getTime()) / 1000);
    if (seg < 60) return 'ahora mismo';
    if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
    if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`;
    if (seg < 172800) return 'ayer';
    if (seg < 604800) return `hace ${Math.floor(seg / 86400)} días`;

    return t.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

const FECHA_LARGA = { weekday: 'long', day: 'numeric', month: 'long' };

/** Fecha de una reunión, en palabras cuando está cerca. */
function diaDeReunion(fecha) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const d = new Date(`${fecha}T00:00:00`);
    const dias = Math.round((d - hoy) / 86400000);

    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Mañana';
    if (dias === -1) return 'Ayer';

    return d.toLocaleDateString('es-CO', FECHA_LARGA);
}

// ─── Actividad ──────────────────────────────────────────────────────────────

function Actividad() {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(false);
    const [tipo, setTipo] = useState('');
    const [pagina, setPagina] = useState(1);
    const [acumulado, setAcumulado] = useState([]);

    useEffect(() => {
        let vivo = true;
        setError(false);

        axiosInstance.get('/equipo/actividad', { params: { pagina, tipo: tipo || undefined } })
            .then((r) => {
                if (!vivo) return;
                setDatos(r.data);
                // La primera página reemplaza; las siguientes se acumulan al
                // pulsar «Ver más», que es como se lee un flujo.
                setAcumulado((prev) => (pagina === 1 ? r.data.eventos : [...prev, ...r.data.eventos]));
            })
            .catch(() => vivo && setError(true));

        return () => { vivo = false; };
    }, [pagina, tipo]);

    const cambiarTipo = (t) => {
        setTipo(t);
        setPagina(1);
    };

    if (error) return <p className="eq-vacio">No fue posible cargar la actividad.</p>;
    if (datos === null) return <p className="eq-vacio">Cargando…</p>;

    return (
        <>
            {(datos.tipos || []).length > 0 && (
                <div className="eq-filtros">
                    <button
                        className={`eq-chip ${tipo === '' ? 'es-activo' : ''}`}
                        onClick={() => cambiarTipo('')}
                    >
                        Todo
                    </button>

                    {/* Once tipos en fila ocupaban cuatro líneas de chips. El
                        desplegable los deja en una sola y sigue permitiendo
                        filtrar por cualquiera de ellos. */}
                    <select
                        className={`eq-chip eq-select ${tipo ? 'es-activo' : ''}`}
                        value={tipo}
                        onChange={(e) => cambiarTipo(e.target.value)}
                        aria-label="Filtrar por tipo de evento"
                    >
                        <option value="">Filtrar por tipo…</option>
                        {datos.tipos.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>
            )}

            {acumulado.length === 0 ? (
                <p className="eq-vacio">
                    {tipo ? 'No hay eventos de ese tipo.' : 'Todavía no hay actividad registrada.'}
                </p>
            ) : (
                <ol className="eq-flujo">
                    {acumulado.map((e) => {
                        const ic = iconoDe(e.tipo);
                        return (
                            <li key={e.id} className="eq-evento">
                                <span className={`eq-ev-icono ${ic.clase}`}>{ic.icono}</span>

                                <div className="eq-ev-cuerpo">
                                    <p className="eq-ev-mensaje">{e.mensaje}</p>
                                    <p className="eq-ev-pie">
                                        {e.tarea_titulo && (
                                            <span className="eq-ev-tarea" title={e.tarea_titulo}>
                                                {e.tarea_titulo}
                                            </span>
                                        )}
                                        <span className="eq-ev-cuando" title={e.cuando}>
                                            {haceCuanto(e.cuando)}
                                        </span>
                                    </p>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}

            {datos.hay_mas && (
                <button className="eq-mas" onClick={() => setPagina((p) => p + 1)}>
                    Ver más
                </button>
            )}
        </>
    );
}

// ─── Reuniones ──────────────────────────────────────────────────────────────

function Reuniones() {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(false);
    const [pasadas, setPasadas] = useState(false);
    const [creando, setCreando] = useState(false);
    const [aviso, setAviso] = useState('');
    const [exito, setExito] = useState('');
    const [recarga, setRecarga] = useState(0);

    useEffect(() => {
        let vivo = true;
        setError(false);

        axiosInstance.get('/equipo/reuniones', { params: { pasadas: pasadas ? 1 : 0 } })
            .then((r) => vivo && setDatos(r.data))
            .catch(() => vivo && setError(true));

        return () => { vivo = false; };
    }, [pasadas, recarga]);

    // Lo que se responde desde «Mis Tareas» también se ve aquí.
    useEffect(() => {
        const otra = () => setRecarga((n) => n + 1);
        window.addEventListener('wb:reuniones-cambiaron', otra);
        return () => window.removeEventListener('wb:reuniones-cambiaron', otra);
    }, []);

    const abrirFormulario = () => {
        setCreando(true);
        setAviso('');
        setExito('');
    };

    const creada = (r) => {
        setCreando(false);
        setPasadas(false);
        const n = r?.convocados || 0;
        setExito(n === 1
            ? 'Convocatoria enviada. El participante la verá en la plataforma y en su correo.'
            : `Convocatoria enviada a ${n} participantes, en la plataforma y por correo.`);
    };

    const responder = (id, respuesta) => {
        axiosInstance.put(`/equipo/reuniones/${id}/respuesta`, { respuesta })
            .then(() => avisarCambioReuniones())
            .catch(() => setAviso('No fue posible registrar la respuesta.'));
    };

    const cancelar = (id) => {
        if (!window.confirm('¿Cancelar esta reunión? Los convocados recibirán el aviso en la plataforma y por correo.')) return;
        axiosInstance.delete(`/equipo/reuniones/${id}`)
            .then(() => avisarCambioReuniones())
            .catch(() => setAviso('No fue posible cancelar la reunión.'));
    };

    // Las reuniones llegan ordenadas; agruparlas por día evita repetir la
    // fecha en cada tarjeta y deja ver de un golpe cuántas hay cada jornada.
    const porDia = useMemo(() => {
        const grupos = [];
        for (const r of datos?.reuniones || []) {
            const ultimo = grupos[grupos.length - 1];
            if (ultimo && ultimo.fecha === r.fecha) ultimo.items.push(r);
            else grupos.push({ fecha: r.fecha, items: [r] });
        }
        return grupos;
    }, [datos]);

    if (error) return <p className="eq-vacio">No fue posible cargar las reuniones.</p>;
    if (datos === null) return <p className="eq-vacio">Cargando…</p>;

    return (
        <>
            <div className="eq-barra">
                <div className="eq-filtros">
                    <button
                        className={`eq-chip ${!pasadas ? 'es-activo' : ''}`}
                        onClick={() => setPasadas(false)}
                    >
                        Próximas
                    </button>
                    <button
                        className={`eq-chip ${pasadas ? 'es-activo' : ''}`}
                        onClick={() => setPasadas(true)}
                    >
                        Pasadas
                    </button>
                </div>
                {!creando && (
                    <button className="eq-btn" onClick={abrirFormulario}>+ Solicitar reunión</button>
                )}
            </div>

            {aviso && <p className="eq-aviso">{aviso}</p>}
            {exito && <p className="eq-exito">{exito}</p>}

            {creando && (
                <FormularioReunion onCreada={creada} onCancelar={() => setCreando(false)} />
            )}


            {porDia.length === 0 ? (
                <p className="eq-vacio">
                    {pasadas ? 'No hay reuniones anteriores.' : 'No hay reuniones próximas.'}
                </p>
            ) : porDia.map((g) => (
                <section key={g.fecha} className="eq-dia">
                    <h4 className="eq-dia-titulo">{diaDeReunion(g.fecha)}</h4>

                    {g.items.map((r) => (
                        <article
                            key={r.id}
                            className={`eq-reunion ${r.estado === 'Cancelada' ? 'es-cancelada' : ''}`}
                        >
                            <div className="eq-re-hora">
                                <b>{r.hora_inicio}</b>
                                {r.hora_fin && <span>{r.hora_fin}</span>}
                            </div>

                            <div className="eq-re-cuerpo">
                                <h5>
                                    {r.titulo}
                                    {r.estado === 'Cancelada' && <em className="eq-re-cancel"> · Cancelada</em>}
                                </h5>

                                {r.descripcion && <p className="eq-re-desc">{r.descripcion}</p>}

                                <p className="eq-re-meta">
                                    <span>Organiza: {r.soy_organizador ? 'tú' : r.organizador}</span>
                                    {r.lugar && <span>· {r.lugar}</span>}
                                </p>

                                <div className="eq-re-gente">
                                    {r.asistentes.map((a) => (
                                        <span
                                            key={a.empleado}
                                            className={`eq-av eq-av-${a.respuesta.toLowerCase()}`}
                                            title={`${a.nombre} — ${a.respuesta}`}
                                        >
                                            {iniciales(a.nombre)}
                                        </span>
                                    ))}
                                </div>

                                <div className="eq-re-acciones">
                                    {r.enlace && r.estado !== 'Cancelada' && (
                                        <a
                                            className="eq-btn eq-btn-chico"
                                            href={r.enlace}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Entrar
                                        </a>
                                    )}

                                    {!r.soy_organizador && r.estado !== 'Cancelada' && !pasadas && (
                                        <>
                                            <button
                                                className={`eq-btn-sec eq-btn-chico ${r.mi_respuesta === 'Acepta' ? 'es-si' : ''}`}
                                                onClick={() => responder(r.id, 'Acepta')}
                                            >
                                                Asistiré
                                            </button>
                                            <button
                                                className={`eq-btn-sec eq-btn-chico ${r.mi_respuesta === 'Rechaza' ? 'es-no' : ''}`}
                                                onClick={() => responder(r.id, 'Rechaza')}
                                            >
                                                No puedo
                                            </button>
                                        </>
                                    )}

                                    {r.soy_organizador && r.estado !== 'Cancelada' && !pasadas && (
                                        <button
                                            className="eq-btn-sec eq-btn-chico"
                                            onClick={() => cancelar(r.id)}
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </div>
                        </article>
                    ))}
                </section>
            ))}
        </>
    );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

/** Las tres secciones del espacio, en el orden de la barra inferior. */
const SECCIONES = [
    { id: 'actividad', titulo: 'Actividad', icono: '🗺' },
    { id: 'reuniones', titulo: 'Reuniones', icono: '◷' },
    { id: 'chat',      titulo: 'Chat',      icono: '◍' },
];

/**
 * Espacio de equipo: lo que ha pasado, lo que viene y lo que se habla.
 *
 * El tablero muestra el trabajo; aquí se muestra el equipo alrededor de él.
 * «Actividad» lee el historial que ya registra cada cambio de tarea, de modo
 * que tiene contenido desde el primer día sin pedir que nadie escriba nada.
 */
/**
 * Administración sin ficha de empleado: mira el plano, pero el chat y las
 * reuniones van a nombre de una persona (su ficha), así que se le explica
 * cómo habilitarlos en vez de mostrar pantallas que fallarían.
 */
function SinFicha({ que }) {
    return (
        <div className="eq-sin-ficha">
            <h4>Vincula tu ficha de empleado para usar {que}</h4>
            <p>
                El chat y las reuniones van con el nombre de una persona. En
                Parámetros › Usuarios, edita tu usuario y elige tu ficha en
                «Ficha de empleado». Mientras tanto puedes ver el plano y el
                tablero de toda la oficina.
            </p>
        </div>
    );
}

export default function EspacioEquipoModal({ pestanaInicial = 'actividad', onCerrar }) {
    const [pestana, setPestana] = useState(pestanaInicial);
    const { user } = useUser();
    const conFicha = Boolean(user?.empleado);

    useEffect(() => {
        const onKey = (ev) => {
            if (ev.key === 'Escape') { ev.stopPropagation(); onCerrar(); }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [onCerrar]);

    // El fondo ya no cierra al pulsarlo: sobre el plano se arrastra
    // constantemente y un clic suelto cerraba el espacio entero. Se cierra
    // con la ✕ o con Escape.
    return (
        <div className="eq-fondo">
            <section
                className={`eq-modal ${pestana === 'chat' || pestana === 'actividad' ? 'es-chat' : ''}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Espacio de equipo"
            >
                <header className="eq-cabecera">
                    <h3 className="eq-titulo">{SECCIONES.find((s) => s.id === pestana)?.titulo}</h3>
                    <button className="eq-cerrar" onClick={onCerrar} title="Cerrar (Esc)">✕</button>
                </header>

                {/* El cuerpo del chat gestiona su propio desplazamiento: con el
                    del modal, la lista de canales se iría con la conversación. */}
                <div className={`eq-cuerpo ${pestana === 'chat' || pestana === 'actividad' ? 'es-plano' : ''}`}>
                    {pestana === 'actividad' && (
                        <AvataresProvider todaLaOrganizacion>
                            <TableroPlano
                                datosTablero={null}
                                interactivo={false}
                                sueltoEnPagina={false}
                                incrustado
                                onVerTarea={() => {}}
                                onCerrar={onCerrar}
                            />
                        </AvataresProvider>
                    )}
                    {pestana === 'reuniones' && (conFicha ? <Reuniones /> : <SinFicha que="las reuniones" />)}
                    {pestana === 'chat' && (conFicha ? <Chat /> : <SinFicha que="el chat" />)}
                </div>

                {/* Barra inferior: las tres secciones siempre a la vista, como
                    en una aplicación de equipo. */}
                <nav className="eq-barra-inferior">
                    {SECCIONES.map((s) => (
                        <button
                            key={s.id}
                            className={pestana === s.id ? 'es-activa' : ''}
                            onClick={() => setPestana(s.id)}
                        >
                            <span className="eq-bi-icono">{s.icono}</span>
                            {s.titulo}
                        </button>
                    ))}
                </nav>
            </section>
        </div>
    );
}
