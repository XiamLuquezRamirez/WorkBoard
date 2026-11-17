import React, { useEffect, useMemo, useRef, useState } from 'react';
import axiosInstance from '../../axiosConfig';
import { registrarChatAbierto } from '../equipo/chatAbierto';
import { useAvatar } from './AvataresContext';
import FormularioReunion from '../equipo/FormularioReunion';
import { PRESENCIA } from './PlanoOficina';
import {
    soportaEquipoCompleto, deteccionActivada, activarDeteccionEquipo, desactivarDeteccionEquipo,
} from '../../utils/detectorActividad';

/**
 * Interruptor de la detección del equipo completo. El navegador pide permiso
 * la primera vez; sin él (o en Firefox/Safari) se usa sólo la actividad
 * dentro de WorkBoard.
 */
function DeteccionEquipo() {
    const [activa, setActiva] = useState(deteccionActivada());
    const [aviso, setAviso] = useState('');
    const soporta = soportaEquipoCompleto();

    const activar = async () => {
        setAviso('');
        const r = await activarDeteccionEquipo();
        setActiva(r === 'granted');
        if (r === 'denied') setAviso('El navegador no dio permiso. Puedes concederlo desde el candado de la barra de direcciones.');
    };

    const desactivar = () => {
        desactivarDeteccionEquipo();
        setActiva(false);
    };

    return (
        <div className="pp-deteccion">
            <p className="pp-deteccion-txt">
                <strong>Uso del equipo:</strong>{' '}
                {!soporta
                    ? 'tu navegador sólo permite detectar la actividad dentro de WorkBoard (usa Chrome o Edge para el equipo completo).'
                    : activa
                        ? 'activado. Con 5 minutos sin usar el equipo o la pantalla bloqueada pasas a «Ausente».'
                        : 'sólo se mira la actividad dentro de WorkBoard. Actívalo para contar también otros programas.'}
                {' '}Sólo se informa si lo usas, no qué haces en él.
            </p>
            {soporta && (activa
                ? <button type="button" className="pp-btn" onClick={desactivar}>Desactivar</button>
                : <button type="button" className="pp-btn" onClick={activar}>Activar</button>)}
            {aviso && <p className="pp-mi-estado-pie es-error">{aviso}</p>}
        </div>
    );
}

/** Cada cuánto se piden mensajes nuevos con el panel de chat abierto. */
const SONDEO_MS = 5000;

const iniciales = (nombre) => String(nombre || '?')
    .trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

const hora = (iso) => {
    if (!iso) return '';
    const t = new Date(String(iso).replace(' ', 'T'));
    return Number.isNaN(t.getTime())
        ? ''
        : t.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
};

function haceCuanto(iso) {
    if (!iso) return '';
    const t = new Date(String(iso).replace(' ', 'T'));
    if (Number.isNaN(t.getTime())) return '';

    const seg = Math.floor((Date.now() - t.getTime()) / 1000);
    if (seg < 60) return 'ahora';
    if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
    if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`;
    if (seg < 604800) return `hace ${Math.floor(seg / 86400)} d`;

    return t.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

/** Días hasta la fecha pactada, en palabras. */
const plazo = (dias) => {
    if (dias === null || dias === undefined) return 'sin fecha';
    if (dias === 0) return 'vence hoy';
    if (dias === 1) return 'mañana';
    if (dias > 1) return `en ${dias} días`;
    return `${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'} de atraso`;
};

/** Clase por estado. Un mapa explícito evita derivarla del texto con acentos. */
const CLASE_ESTADO = {
    'Pendiente':   'es-pendiente',
    'En Proceso':  'es-proceso',
    'En Revisión': 'es-revision',
};

// ─── Pestaña: tareas ────────────────────────────────────────────────────────

function Tareas({ datos, interactivo, onAbrirTarea }) {
    if (datos.tareas.length === 0) {
        return <p className="pp-vacio">Sin tareas abiertas ahora mismo.</p>;
    }

    const r = datos.resumen;

    return (
        <>
            <div className="pp-cifras">
                <span><b>{r.vivas}</b> vivas</span>
                {r.proceso > 0 && <span><b>{r.proceso}</b> en proceso</span>}
                {r.atrasadas > 0 && <span className="es-mal"><b>{r.atrasadas}</b> tarde</span>}
                {r.bloqueadas > 0 && <span className="es-mal"><b>{r.bloqueadas}</b> bloqueadas</span>}
                {r.revision > 0 && <span className="es-ok"><b>{r.revision}</b> por verificar</span>}
            </div>

            <ul className="pp-tareas">
                {datos.tareas.map((t) => (
                    <li key={t.id}>
                        <button
                            className={`pp-tarea ${t.atrasada ? 'es-tarde' : ''} ${t.bloqueada ? 'es-bloq' : ''}`}
                            onClick={() => interactivo && onAbrirTarea(t.id)}
                            // Sin las columnas del tablero no hay tarea completa que
                            // abrir; el botón entonces sólo informa.
                            disabled={!interactivo}
                            title={interactivo ? 'Abrir la tarea' : t.titulo}
                        >
                            <span className="pp-tarea-cab">
                                <span className={`pp-pin ${CLASE_ESTADO[t.estado] || ''}`}>
                                    {t.estado}
                                </span>
                                {t.bloqueada && <span className="pp-marca es-mal">⛔</span>}
                                {t.pausada && <span className="pp-marca">⏸</span>}
                                {t.sin_criterio && <span className="pp-marca" title="Sin criterio pactado">◌</span>}
                            </span>

                            <span className="pp-tarea-tit">{t.titulo}</span>

                            <span className="pp-tarea-pie">
                                {t.proyecto && <em>{t.proyecto}</em>}
                                <span className={t.atrasada ? 'es-mal' : ''}>{plazo(t.dias)}</span>
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </>
    );
}

// ─── Pestaña: actividad ─────────────────────────────────────────────────────

const ICONOS = {
    'Bloqueada': '⛔', 'Desbloqueada': '✓', 'Pausada': '⏸', 'Pausa solicitada': '⏸',
    'Pausa aprobada': '⏸', 'Reanudada': '▶', 'Reprogramada': '📅',
    'Reprogramación solicitada': '📅', 'Reprogramación aprobada': '📅',
    'Checklist': '☑', 'Criterio': '◎',
};

function ActividadPuesto({ datos }) {
    if (datos.actividad.length === 0) {
        return <p className="pp-vacio">Sin movimientos registrados.</p>;
    }

    return (
        <ol className="pp-actividad">
            {datos.actividad.map((a) => (
                <li key={a.id}>
                    <span className="pp-act-icono">{ICONOS[a.tipo] || '•'}</span>
                    <div>
                        <p className="pp-act-msj">{a.mensaje}</p>
                        <p className="pp-act-pie">
                            {a.tarea_titulo && <em>{a.tarea_titulo}</em>}
                            <span>{haceCuanto(a.cuando)}</span>
                        </p>
                    </div>
                </li>
            ))}
        </ol>
    );
}

// ─── Pestaña: chat ──────────────────────────────────────────────────────────

function ChatPuesto({ clave, nombre }) {
    const [mensajes, setMensajes] = useState(null);
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);
    const finRef = useRef(null);
    const ultimoRef = useRef(0);

    // La conversación a la vista no dispara el aviso de mensajes.
    useEffect(() => registrarChatAbierto(clave), [clave]);

    useEffect(() => {
        let vivo = true;
        ultimoRef.current = 0;
        setMensajes(null);

        axiosInstance.get('/equipo/chat/mensajes', { params: { clave } })
            .then((r) => {
                if (!vivo) return;
                setMensajes(r.data.mensajes || []);
                const u = (r.data.mensajes || []).slice(-1)[0];
                ultimoRef.current = u ? u.id : 0;
            })
            .catch(() => vivo && setMensajes([]));

        return () => { vivo = false; };
    }, [clave]);

    useEffect(() => {
        const tic = setInterval(() => {
            if (document.hidden) return;
            axiosInstance.get('/equipo/chat/mensajes', {
                params: { clave, desde: ultimoRef.current || undefined },
            })
                .then((r) => {
                    const nuevos = r.data.mensajes || [];
                    if (nuevos.length === 0) return;
                    ultimoRef.current = nuevos[nuevos.length - 1].id;
                    setMensajes((m) => [...(m || []), ...nuevos]);
                })
                .catch(() => { /* un fallo puntual no rompe el panel */ });
        }, SONDEO_MS);

        return () => clearInterval(tic);
    }, [clave]);

    useEffect(() => {
        finRef.current?.scrollIntoView({ block: 'end' });
    }, [mensajes?.length]);

    const enviar = (ev) => {
        ev.preventDefault();
        const limpio = texto.trim();
        if (!limpio || enviando) return;

        setEnviando(true);
        axiosInstance.post('/equipo/chat/mensajes', { clave, mensaje: limpio })
            .then(() => {
                setTexto('');
                return axiosInstance.get('/equipo/chat/mensajes', {
                    params: { clave, desde: ultimoRef.current || undefined },
                });
            })
            .then((r) => {
                const nuevos = r?.data?.mensajes || [];
                if (nuevos.length === 0) return;
                ultimoRef.current = nuevos[nuevos.length - 1].id;
                setMensajes((m) => [...(m || []), ...nuevos]);
            })
            .catch(() => { /* el texto se conserva para reintentar */ })
            .finally(() => setEnviando(false));
    };

    return (
        <div className="pp-chat">
            <div className="pp-chat-hilo">
                {mensajes === null && <p className="pp-vacio">Cargando…</p>}
                {mensajes?.length === 0 && (
                    <p className="pp-vacio">Aún no han hablado. Escribe el primer mensaje.</p>
                )}

                {(mensajes || []).map((m) => (
                    <div key={m.id} className={`pp-burbuja ${m.mio ? 'es-mia' : ''}`}>
                        <p>{m.mensaje}</p>
                        <span>{hora(m.cuando)}</span>
                    </div>
                ))}

                <div ref={finRef} />
            </div>

            <form className="pp-chat-barra" onSubmit={enviar}>
                <textarea
                    rows={1}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(e); }
                    }}
                    placeholder={`Escribir a ${nombre}…`}
                    maxLength={4000}
                />
                <button type="submit" className="pp-btn" disabled={enviando || !texto.trim()}>
                    ➤
                </button>
            </form>
        </div>
    );
}

// ─── Mi estado ──────────────────────────────────────────────────────────────

const OPCIONES_ESTADO = ['disponible', 'ocupado', 'reunion', 'almuerzo', 'ausente'];

/**
 * Lo que uno elige para que los demás lo vean en el plano. Vale por hoy:
 * mañana se vuelve a lo automático (disponible con la aplicación abierta, en
 * reunión si la agenda lo dice).
 */
function MiEstado({ presencia, onPresencia }) {
    const [nota, setNota] = useState(presencia?.nota || '');
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');

    // Sólo la nota que uno escribió: sin estado elegido, la «nota» es el
    // motivo automático («Pantalla bloqueada») y no debe prellenarse.
    useEffect(() => { setNota(presencia?.elegido ? (presencia?.nota || '') : ''); }, [presencia?.nota, presencia?.elegido]);

    const elegido = presencia?.elegido ? presencia.estado : null;

    const guardar = (estado, conNota = nota) => {
        setEnviando(true);
        setError('');
        axiosInstance.post('/equipo/presencia', { estado, nota: estado ? (conNota.trim() || null) : null })
            .then((r) => onPresencia(r.data.presencia))
            .catch((e) => setError(e.response?.data?.error || e.response?.data?.message || 'No fue posible guardar tu estado.'))
            .finally(() => setEnviando(false));
    };

    return (
        <section className="pp-mi-estado">
            <h5>Mi estado para el equipo</h5>
            <div className="pp-estados">
                {OPCIONES_ESTADO.map((k) => (
                    <button
                        key={k}
                        className={`pp-estado ${elegido === k ? 'es-activo' : ''}`}
                        onClick={() => guardar(k)}
                        disabled={enviando}
                    >
                        <span>{PRESENCIA[k].icono}</span>
                        {PRESENCIA[k].etiqueta}
                    </button>
                ))}
                <button
                    className={`pp-estado ${elegido ? '' : 'es-activo'}`}
                    onClick={() => guardar(null)}
                    disabled={enviando}
                    title="Disponible mientras tengas la aplicación abierta; en reunión si la agenda lo dice"
                >
                    <span>✨</span>
                    Automático
                </button>
            </div>

            {elegido && (
                <form
                    className="pp-nota"
                    onSubmit={(e) => { e.preventDefault(); guardar(elegido); }}
                >
                    <input
                        value={nota}
                        maxLength={80}
                        placeholder="Nota opcional: «vuelvo a las 3»"
                        onChange={(e) => setNota(e.target.value)}
                    />
                    <button className="pp-btn" disabled={enviando}>Guardar</button>
                </form>
            )}

            <p className={`pp-mi-estado-pie ${error ? 'es-error' : ''}`}>
                {error || (presencia?.estado === 'reunion' && !elegido
                    ? 'Tu agenda dice que estás en una reunión.'
                    : 'Lo ven todos en el plano. Vale por hoy.')}
            </p>
            <DeteccionEquipo />
        </section>
    );
}

/** Estado de la persona bajo su nombre, con la nota si dejó una. */
function EstadoPersona({ presencia }) {
    if (!presencia?.estado) return null;
    const info = PRESENCIA[presencia.estado];
    if (!info) return null;

    return (
        <>
            <span className={`pp-presencia pr-${presencia.estado}`}>
                <i />{info.etiqueta}
                {presencia.actividad === 'tarea' && ' · trabajando'}
                {presencia.actividad === 'escribiendo' && ' · escribiendo'}
                {presencia.actividad === 'equipo' && ' · usando el equipo'}
            </span>
            {presencia.nota && <p className="pp-presencia-nota">«{presencia.nota}»</p>}
        </>
    );
}

// ─── Panel ──────────────────────────────────────────────────────────────────

/**
 * Panel de un puesto del plano.
 *
 * Al llegar a una estación se ve en qué anda esa persona, qué ha hecho
 * últimamente, se le escribe y se le llama, sin salir del mapa.
 *
 * El vídeo es una sala de Jitsi incrustada. El servidor público abre cualquier
 * sala por su nombre, así que el nombre lo deriva el servidor de los dos ids y
 * de APP_KEY: no es adivinable desde fuera. Aun así, el vídeo pasa por un
 * tercero —no hay servidor propio— y eso conviene saberlo.
 */
export default function PanelPuesto({ puesto, interactivo, onAbrirTarea, onCerrar, onPresencia, esYo = false }) {
    const foto = useAvatar(puesto.id);
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(false);
    const [vista, setVista] = useState('tareas');
    const [enLlamada, setEnLlamada] = useState(false);
    // Estado de la llamada en curso: 'llamando' mientras suena al otro lado,
    // 'Aceptada' cuando contesta, o el motivo por el que se cortó.
    const [llamada, setLlamada] = useState(null);
    const [reunionEnviada, setReunionEnviada] = useState(false);
    // Saludo: null, 'enviando', 'ok' o el texto del error.
    const [saludo, setSaludo] = useState(null);

    const saludar = () => {
        setSaludo('enviando');
        axiosInstance.post(`/equipo/saludar/${puesto.id}`)
            .then(() => {
                setSaludo('ok');
                // El propio personaje saluda enseguida, sin esperar al sondeo.
                onPresencia?.(null, { saluda: true });
            })
            .catch((e) => setSaludo(e.response?.data?.error || 'No fue posible saludar.'));
    };

    useEffect(() => {
        let vivo = true;
        setDatos(null);
        setError(false);
        setVista('tareas');
        setEnLlamada(false);
        setLlamada(null);
        setSaludo(null);

        axiosInstance.get(`/equipo/puesto/${puesto.id}`)
            .then((r) => {
                if (!vivo) return;
                setDatos(r.data);
                // Quien no sigue el trabajo de esa persona llega para hablarle.
                if (r.data.ver_trabajo === false) setVista('chat');
            })
            .catch(() => vivo && setError(true));

        return () => { vivo = false; };
    }, [puesto.id]);

    /**
     * Llama a esta persona: avisa al servidor para que le suene en su
     * pantalla, y sólo entonces entra a la sala. Antes el botón abría el
     * vídeo sin que el otro se enterara de nada.
     */
    const llamar = () => {
        setEnLlamada(true);
        setLlamada({ estado: 'llamando' });

        axiosInstance.post('/equipo/llamar', { receptor: puesto.id })
            .then((r) => setLlamada({ estado: 'llamando', id: r.data.id }))
            .catch(() => setLlamada({ estado: 'error' }));
    };

    const colgar = () => {
        // Si aún sonaba, se cancela para que deje de sonar al otro lado.
        if (llamada?.id && llamada.estado === 'llamando') {
            axiosInstance.put(`/equipo/llamada/${llamada.id}`, { estado: 'Cancelada' })
                .catch(() => { /* caduca sola a los 45 s */ });
        }
        setEnLlamada(false);
        setLlamada(null);
    };

    // Mientras suena se pregunta si contestaron, para dejar de esperar en
    // una sala vacía cuando rechazan o no hay nadie.
    useEffect(() => {
        if (!llamada?.id || llamada.estado !== 'llamando') return undefined;

        const tic = setInterval(() => {
            axiosInstance.get(`/equipo/llamada/${llamada.id}`)
                .then((r) => {
                    if (r.data.estado !== 'Sonando') {
                        setLlamada((l) => ({ ...l, estado: r.data.estado }));
                    }
                })
                .catch(() => { /* se reintenta en la siguiente vuelta */ });
        }, 3000);

        return () => clearInterval(tic);
    }, [llamada]);

    const urlJitsi = useMemo(() => {
        if (!datos?.sala) return null;
        // Se entra con el micrófono y la cámara apagados: el panel no debe
        // abrir el micrófono de nadie por el hecho de pulsar un puesto.
        return `https://meet.jit.si/${datos.sala}#config.startWithAudioMuted=true`
            + '&config.startWithVideoMuted=true&config.prejoinPageEnabled=false&config.disableDeepLinking=true';
    }, [datos]);

    return (
        <aside className="tb-pm-ficha pp-panel">
            <button className="tb-pm-ficha-cerrar" onClick={onCerrar} title="Cerrar (Esc)">✕</button>

            <header className="pp-cab">
                <span className={`pp-avatar se-${puesto.senal}`}>
                    {foto ? <img src={foto} alt="" /> : <span>{iniciales(puesto.nombre)}</span>}
                </span>
                <div className="pp-cab-txt">
                    <h4>{puesto.nombre}</h4>
                    {puesto.cargo && <p>{puesto.cargo}</p>}
                    {datos?.persona?.departamento && (
                        <p className="pp-depto">{datos.persona.departamento}</p>
                    )}
                    <EstadoPersona presencia={puesto.presencia} />
                </div>
            </header>

            {(esYo || datos?.soy_yo) && (
                <MiEstado presencia={puesto.presencia} onPresencia={(p) => onPresencia?.(p)} />
            )}

            {datos?.chat && (
                <div className="pp-acciones">
                    <button
                        className={`pp-btn ${vista === 'chat' ? 'es-activo' : ''}`}
                        onClick={() => setVista(vista === 'chat' ? 'tareas' : 'chat')}
                    >
                        💬 Chat
                    </button>
                    <button
                        className={`pp-btn ${enLlamada ? 'es-activo' : ''}`}
                        onClick={enLlamada ? colgar : llamar}
                    >
                        {enLlamada ? '✕ Colgar' : '📹 Llamar'}
                    </button>
                    <button
                        className={`pp-btn ${vista === 'reunion' ? 'es-activo' : ''}`}
                        onClick={() => { setReunionEnviada(false); setVista(vista === 'reunion' ? 'chat' : 'reunion'); }}
                        title="Solicitar una reunión"
                    >
                        📅 Reunión
                    </button>
                    <button
                        className={`pp-btn ${saludo === 'ok' ? 'es-activo' : ''}`}
                        onClick={saludar}
                        disabled={saludo === 'enviando' || saludo === 'ok'}
                        title={saludo && saludo !== 'enviando' && saludo !== 'ok' ? saludo : 'Le llega a su campana y tu personaje lo saluda en el plano'}
                    >
                        {saludo === 'ok' ? '✓ Saludado' : '👋 Saludar'}
                    </button>
                </div>
            )}
            {saludo && saludo !== 'enviando' && saludo !== 'ok' && (
                <p className="pp-mi-estado-pie es-error" style={{ padding: '0 14px' }}>{saludo}</p>
            )}

            {enLlamada && urlJitsi && (
                <div className="pp-video">
                    <iframe
                        title={`Videollamada con ${puesto.nombre}`}
                        src={urlJitsi}
                        allow="camera; microphone; speaker-selection; display-capture; autoplay; fullscreen; clipboard-write"
                    />
                    <p className="pp-video-pie">
                        {/* Nombre completo: con el primer nombre solo, «Llamando a Fabián» no
                            decía a cuál de los dos se estaba llamando. */}
                        {llamada?.estado === 'llamando' && `Llamando a ${puesto.nombre}… le está sonando en pantalla.`}
                        {llamada?.estado === 'Aceptada' && 'Contestó la llamada.'}
                        {llamada?.estado === 'Rechazada' && 'No puede atender ahora.'}
                        {llamada?.estado === 'Cancelada' && 'No contestó.'}
                        {llamada?.estado === 'error' && 'No fue posible avisarle; comparte el enlace por el chat.'}
                        {!llamada && 'Sala privada en meet.jit.si.'}
                        {' '}
                        {/* Salida de emergencia: en una pestaña propia la cámara
                            siempre tiene permiso, aunque el iframe falle. */}
                        <a href={urlJitsi} target="_blank" rel="noopener noreferrer">
                            Abrir en pestaña
                        </a>
                    </p>
                </div>
            )}

            <nav className="pp-pestanas">
                {datos?.ver_trabajo !== false && (
                    <>
                        <button
                            className={vista === 'tareas' ? 'es-activa' : ''}
                            onClick={() => setVista('tareas')}
                        >
                            Tareas
                        </button>
                        <button
                            className={vista === 'actividad' ? 'es-activa' : ''}
                            onClick={() => setVista('actividad')}
                        >
                            Actividad
                        </button>
                    </>
                )}
                {datos?.chat && (
                    <button
                        className={vista === 'chat' ? 'es-activa' : ''}
                        onClick={() => setVista('chat')}
                    >
                        Chat
                    </button>
                )}
            </nav>

            <div className="pp-cuerpo">
                {error && <p className="pp-vacio">No fue posible cargar este puesto.</p>}
                {!error && datos === null && <p className="pp-vacio">Cargando…</p>}

                {datos && vista === 'tareas' && (
                    <Tareas datos={datos} interactivo={interactivo} onAbrirTarea={onAbrirTarea} />
                )}
                {datos && vista === 'actividad' && <ActividadPuesto datos={datos} />}
                {datos && vista === 'chat' && datos.chat && (
                    <ChatPuesto clave={datos.chat} nombre={puesto.nombre} />
                )}
                {datos && vista === 'reunion' && datos.chat && (reunionEnviada ? (
                    <div className="pp-reunion-ok">
                        <p>✓ Convocatoria enviada a {puesto.nombre}.</p>
                        <p>Le llega a la plataforma y al correo; la verá como pendiente en sus tareas.</p>
                        <button className="pp-btn" onClick={() => setVista('chat')}>Volver al chat</button>
                    </div>
                ) : (
                    <FormularioReunion
                        key={puesto.id}
                        compacto
                        invitadosIniciales={[puesto.id]}
                        onCreada={() => setReunionEnviada(true)}
                        onCancelar={() => setVista('chat')}
                    />
                ))}
            </div>
        </aside>
    );
}
