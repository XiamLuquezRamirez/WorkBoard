import React, { useEffect, useRef, useState } from 'react';
import { FaTimes, FaPaperPlane, FaBell, FaReply } from 'react-icons/fa';
import axiosInstance from '../../axiosConfig';
import { registrarChatAbierto, chatALaVista } from './chatAbierto';
import {
    notificacionesDisponibles, permisoNotificaciones, pedirPermisoNotificaciones,
    notificarEscritorio, sonarAviso, contadorEnTitulo,
} from './avisoEscritorio';
import './avisoMensajes.css';

/** Cada cuánto se pregunta si hay mensajes nuevos. */
const SONDEO_MS = 6000;

/** Lo que devuelve el servidor como máximo en una consulta. */
const LOTE = 30;

const iniciales = (n) => String(n || '?')
    .trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

const hora = (iso) => {
    if (!iso) return '';
    const t = new Date(String(iso).replace(' ', 'T'));
    return Number.isNaN(t.getTime()) ? '' : t.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
};

const nombreCanal = (nombre) => `#${String(nombre || 'equipo').replace(/^departamento\s+de\s+/i, '').trim().toLowerCase()}`;

const tituloDe = (m) => (m.directo ? m.autor : `${nombreCanal(m.canal)}`);

/**
 * Aviso de mensajes del chat.
 *
 * Vive en la raíz de la aplicación, como el timbre de llamadas: un mensaje
 * tiene que avisar se esté donde se esté. Antes sólo se veía al abrir el
 * chat, y quien no es líder ni siquiera tenía dónde abrirlo.
 *
 * Con la pestaña a la vista muestra el aviso en una esquina, con sonido.
 * Si no está a la vista, además lanza una notificación del sistema y pone
 * el contador en el título. «Responder» abre una conversación pequeña aquí
 * mismo, sin salir de la pantalla en la que se está.
 *
 * Sigue sondeando con la pestaña oculta: es justo cuando más falta hace.
 * El navegador espacia esas consultas en segundo plano, así que el aviso
 * puede tardar algo más en llegar, pero llega.
 */
export default function AvisoMensajes() {
    const [avisos, setAvisos] = useState([]);
    const [abierta, setAbierta] = useState(null);
    const [permiso, setPermiso] = useState(permisoNotificaciones());
    const ultimoRef = useRef(null);

    const abrir = (clave, titulo) => {
        setAvisos((prev) => prev.filter((a) => a.clave !== clave));
        setAbierta({ clave, titulo });
    };

    useEffect(() => {
        let vivo = true;
        let tic = null;

        const mirar = () => {
            const params = ultimoRef.current === null ? {} : { desde: ultimoRef.current };
            axiosInstance.get('/equipo/chat/avisos', { params })
                .then((r) => {
                    if (!vivo) return;
                    // Un usuario sin ficha de empleado no recibe mensajes:
                    // seguir preguntando sólo cargaría el servidor.
                    if (r.data?.activo === false) { clearInterval(tic); return; }
                    const { ultimo = 0, mensajes = [] } = r.data || {};

                    // La primera consulta sólo fija el punto de partida.
                    if (ultimoRef.current === null) {
                        ultimoRef.current = ultimo;
                        return;
                    }
                    // Si el lote vino lleno quedan más: se sigue desde el
                    // último recibido en vez de saltar al final.
                    ultimoRef.current = mensajes.length >= LOTE
                        ? mensajes[mensajes.length - 1].id
                        : Math.max(ultimoRef.current, ultimo);

                    const nuevos = mensajes.filter((m) => !chatALaVista(m.clave));
                    if (!nuevos.length) return;

                    // Un aviso por conversación, con el último mensaje y la cuenta.
                    const porClave = new Map();
                    nuevos.forEach((m) => {
                        const previo = porClave.get(m.clave);
                        porClave.set(m.clave, { ...m, n: (previo?.n || 0) + 1 });
                    });

                    setAvisos((prev) => {
                        const resto = prev.filter((a) => !porClave.has(a.clave));
                        const actualizados = [...porClave.values()].map((m) => ({
                            ...m,
                            n: m.n + (prev.find((a) => a.clave === m.clave)?.n || 0),
                        }));
                        return [...actualizados, ...resto].slice(0, 4);
                    });

                    sonarAviso();
                    if (document.hidden || !document.hasFocus()) {
                        porClave.forEach((m) => notificarEscritorio(
                            m.directo ? `Mensaje de ${m.autor}` : `${m.autor} en ${nombreCanal(m.canal)}`,
                            m.mensaje,
                            `wb-chat-${m.clave}`,
                            () => abrir(m.clave, tituloDe(m))
                        ));
                    }
                })
                .catch(() => { /* un fallo de red no debe romper la pantalla */ });
        };

        mirar();
        tic = setInterval(mirar, SONDEO_MS);
        return () => { vivo = false; clearInterval(tic); };
    }, []);

    // El contador del título acompaña a los avisos pendientes.
    useEffect(() => {
        contadorEnTitulo(avisos.reduce((t, a) => t + a.n, 0));
    }, [avisos]);

    useEffect(() => () => contadorEnTitulo(0), []);

    const activarEscritorio = () => pedirPermisoNotificaciones().then(setPermiso);

    return (
        <>
            {avisos.length > 0 && (
                <div className="am-pila" role="log" aria-live="polite" aria-label="Mensajes nuevos">
                    {avisos.map((a) => (
                        <div key={a.clave} className="am-aviso">
                            <span className={`am-avatar ${a.directo ? '' : 'es-canal'}`}>
                                {a.directo ? iniciales(a.autor) : '#'}
                            </span>
                            <div className="am-txt">
                                <p className="am-rotulo">
                                    {a.directo ? 'Mensaje directo' : nombreCanal(a.canal)} · {hora(a.cuando)}
                                    {a.n > 1 && <span className="am-cuenta">{a.n} nuevos</span>}
                                </p>
                                <p className="am-quien">{a.autor}</p>
                                <p className="am-mensaje">{a.mensaje}</p>
                                <div className="am-botones">
                                    <button type="button" className="am-responder" onClick={() => abrir(a.clave, tituloDe(a))}>
                                        <FaReply /> Responder
                                    </button>
                                    <button type="button" className="am-descartar" onClick={() => setAvisos((p) => p.filter((x) => x.clave !== a.clave))}>
                                        Más tarde
                                    </button>
                                </div>
                            </div>
                            <button type="button" className="am-cerrar" title="Cerrar" onClick={() => setAvisos((p) => p.filter((x) => x.clave !== a.clave))}>
                                <FaTimes />
                            </button>
                        </div>
                    ))}

                    {notificacionesDisponibles() && permiso === 'default' && (
                        <button type="button" className="am-permiso" onClick={activarEscritorio}>
                            <FaBell /> Avisarme también cuando no esté en esta pestaña
                        </button>
                    )}
                </div>
            )}

            {abierta && (
                <MiniChat
                    key={abierta.clave}
                    clave={abierta.clave}
                    titulo={abierta.titulo}
                    onCerrar={() => setAbierta(null)}
                />
            )}
        </>
    );
}

/** Conversación pequeña para contestar sin salir de la pantalla actual. */
function MiniChat({ clave, titulo, onCerrar }) {
    const [mensajes, setMensajes] = useState(null);
    const [nombre, setNombre] = useState(titulo);
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);
    const ultimoRef = useRef(0);
    const finRef = useRef(null);

    useEffect(() => registrarChatAbierto(clave), [clave]);

    const anadir = (nuevos) => {
        if (!nuevos?.length) return;
        ultimoRef.current = nuevos[nuevos.length - 1].id;
        setMensajes((prev) => {
            const vistos = new Set((prev || []).map((m) => m.id));
            return [...(prev || []), ...nuevos.filter((m) => !vistos.has(m.id))];
        });
    };

    useEffect(() => {
        let vivo = true;
        axiosInstance.get('/equipo/chat/mensajes', { params: { clave } })
            .then((r) => {
                if (!vivo) return;
                const lista = r.data.mensajes || [];
                ultimoRef.current = lista.length ? lista[lista.length - 1].id : 0;
                setMensajes(lista);
                if (r.data.titulo) setNombre(r.data.titulo);
            })
            .catch(() => vivo && setMensajes([]));

        const tic = setInterval(() => {
            if (document.hidden) return;
            axiosInstance.get('/equipo/chat/mensajes', { params: { clave, desde: ultimoRef.current || undefined } })
                .then((r) => vivo && anadir(r.data.mensajes))
                .catch(() => {});
        }, 5000);
        return () => { vivo = false; clearInterval(tic); };
    }, [clave]);

    useEffect(() => {
        finRef.current?.scrollIntoView({ block: 'end' });
    }, [mensajes]);

    const enviar = (e) => {
        e.preventDefault();
        const limpio = texto.trim();
        if (!limpio || enviando) return;
        setEnviando(true);
        axiosInstance.post('/equipo/chat/mensajes', { clave, mensaje: limpio })
            .then(() => {
                setTexto('');
                return axiosInstance.get('/equipo/chat/mensajes', { params: { clave, desde: ultimoRef.current || undefined } });
            })
            .then((r) => anadir(r.data.mensajes))
            .catch(() => {})
            .finally(() => setEnviando(false));
    };

    return (
        <section className="am-chat" aria-label={`Conversación con ${nombre}`}>
            <header>
                <span className="am-chat-titulo">{nombre}</span>
                <button type="button" className="am-cerrar" title="Cerrar" onClick={onCerrar}><FaTimes /></button>
            </header>
            <div className="am-chat-hilo">
                {mensajes === null && <p className="am-chat-vacio">Cargando…</p>}
                {mensajes && mensajes.length === 0 && <p className="am-chat-vacio">Aún no hay mensajes.</p>}
                {(mensajes || []).map((m) => (
                    <div key={m.id} className={`am-burbuja ${m.mio ? 'es-mia' : ''}`}>
                        {!m.mio && !clave.startsWith('dir:') && <b>{m.autor}</b>}
                        <p>{m.mensaje}</p>
                        <time>{hora(m.cuando)}</time>
                    </div>
                ))}
                <span ref={finRef} />
            </div>
            <form className="am-chat-barra" onSubmit={enviar}>
                <input
                    type="text"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Escribe una respuesta"
                    maxLength={4000}
                    autoFocus
                />
                <button type="submit" disabled={enviando || !texto.trim()} title="Enviar"><FaPaperPlane /></button>
            </form>
        </section>
    );
}
