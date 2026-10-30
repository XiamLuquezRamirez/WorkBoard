import React, { useEffect, useMemo, useRef, useState } from 'react';
import axiosInstance from '../../axiosConfig';
import { registrarChatAbierto } from './chatAbierto';

/** Cada cuánto se piden mensajes nuevos mientras el chat está abierto. */
const SONDEO_MS = 5000;

const iniciales = (nombre) => String(nombre || '?')
    .trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/** «Departamento de Sistemas» → «sistemas», como el # de un canal. */
const nombreCanal = (nombre) => String(nombre || '')
    .replace(/^departamento\s+de\s+/i, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

const hora = (iso) => {
    if (!iso) return '';
    const t = new Date(String(iso).replace(' ', 'T'));
    if (Number.isNaN(t.getTime())) return '';
    return t.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
};

const diaDe = (iso) => String(iso || '').slice(0, 10);

const rotuloDia = (fecha) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const d = new Date(`${fecha}T00:00:00`);
    const dias = Math.round((d - hoy) / 86400000);

    if (dias === 0) return 'Hoy';
    if (dias === -1) return 'Ayer';

    return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
};

/**
 * Chat del equipo.
 *
 * Dos columnas: canales y directos a la izquierda, conversación a la derecha.
 * Los canales no se administran — hay uno por departamento— y un directo
 * nace solo al escribir el primer mensaje.
 *
 * Los mensajes llegan por sondeo, no por WebSocket: el proyecto no tiene
 * servidor de tiempo real. Sólo se consulta mientras el chat está abierto y
 * se piden únicamente los posteriores al último recibido.
 */
export default function Chat() {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(false);
    const [activa, setActiva] = useState(null);
    const [conversacion, setConversacion] = useState({ titulo: '', mensajes: [] });
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [buscar, setBuscar] = useState('');
    const [verContactos, setVerContactos] = useState(false);

    const finRef = useRef(null);
    // El último id recibido vive en una referencia y no en el estado: el
    // sondeo lo lee en cada vuelta y no debe reprogramarse cuando cambia.
    const ultimoRef = useRef(0);

    // La conversación a la vista no dispara el aviso de mensajes.
    useEffect(() => registrarChatAbierto(activa), [activa]);

    const cargarCanales = () => axiosInstance.get('/equipo/chat/canales')
        .then((r) => {
            setDatos(r.data);
            return r.data;
        })
        .catch(() => { setError(true); return null; });

    useEffect(() => {
        let vivo = true;
        cargarCanales().then((d) => {
            if (!vivo || !d) return;
            // Se entra por el canal propio, que es donde está la gente con la
            // que se trabaja todos los días.
            const mio = (d.canales || []).find((c) => c.es_mio) || (d.canales || [])[0];
            if (mio) setActiva(mio.clave);
        });
        return () => { vivo = false; };
    }, []);

    // Al cambiar de conversación se descarta lo anterior y se pide entera.
    useEffect(() => {
        if (!activa) return undefined;

        let vivo = true;
        ultimoRef.current = 0;
        setConversacion({ titulo: '', mensajes: [] });

        axiosInstance.get('/equipo/chat/mensajes', { params: { clave: activa } })
            .then((r) => {
                if (!vivo) return;
                setConversacion(r.data);
                const ult = r.data.mensajes[r.data.mensajes.length - 1];
                ultimoRef.current = ult ? ult.id : 0;
            })
            .catch(() => vivo && setConversacion({ titulo: '', mensajes: [], fallo: true }));

        return () => { vivo = false; };
    }, [activa]);

    // Sondeo: sólo lo nuevo, y sólo mientras hay una conversación abierta.
    useEffect(() => {
        if (!activa) return undefined;

        const tic = setInterval(() => {
            if (document.hidden) return;

            axiosInstance.get('/equipo/chat/mensajes', {
                params: { clave: activa, desde: ultimoRef.current || undefined },
            })
                .then((r) => {
                    const nuevos = r.data.mensajes || [];
                    if (nuevos.length === 0) return;

                    ultimoRef.current = nuevos[nuevos.length - 1].id;
                    setConversacion((c) => ({ ...c, mensajes: [...c.mensajes, ...nuevos] }));
                    cargarCanales();
                })
                .catch(() => { /* un fallo puntual de red no rompe la vista */ });
        }, SONDEO_MS);

        return () => clearInterval(tic);
    }, [activa]);

    // Al llegar mensajes se baja al final, que es donde está la conversación.
    useEffect(() => {
        finRef.current?.scrollIntoView({ block: 'end' });
    }, [conversacion.mensajes.length]);

    const enviar = (ev) => {
        ev.preventDefault();
        const limpio = texto.trim();
        if (!limpio || enviando || !activa) return;

        setEnviando(true);
        axiosInstance.post('/equipo/chat/mensajes', { clave: activa, mensaje: limpio })
            .then(() => {
                setTexto('');
                return axiosInstance.get('/equipo/chat/mensajes', {
                    params: { clave: activa, desde: ultimoRef.current || undefined },
                });
            })
            .then((r) => {
                const nuevos = r?.data?.mensajes || [];
                if (nuevos.length === 0) return;
                ultimoRef.current = nuevos[nuevos.length - 1].id;
                setConversacion((c) => ({ ...c, mensajes: [...c.mensajes, ...nuevos] }));
                cargarCanales();
            })
            .catch(() => { /* el mensaje no salió; el texto se conserva */ })
            .finally(() => setEnviando(false));
    };

    // Enter envía, Mayús+Enter hace salto de línea: es lo que espera
    // cualquiera que haya usado un chat.
    const alTeclear = (ev) => {
        if (ev.key === 'Enter' && !ev.shiftKey) {
            ev.preventDefault();
            enviar(ev);
        }
    };

    const contactosFiltrados = useMemo(() => {
        const q = buscar.trim().toLowerCase();
        const lista = datos?.contactos || [];
        if (!q) return lista;
        return lista.filter((c) => c.nombre.toLowerCase().includes(q)
            || String(c.departamento || '').toLowerCase().includes(q));
    }, [datos, buscar]);

    // Los mensajes se agrupan por día para no repetir la fecha en cada línea.
    const porDia = useMemo(() => {
        const grupos = [];
        for (const m of conversacion.mensajes) {
            const d = diaDe(m.cuando);
            const ultimo = grupos[grupos.length - 1];
            if (ultimo && ultimo.dia === d) ultimo.items.push(m);
            else grupos.push({ dia: d, items: [m] });
        }
        return grupos;
    }, [conversacion.mensajes]);

    if (error) return <p className="eq-vacio">No fue posible cargar el chat.</p>;
    if (datos === null) return <p className="eq-vacio">Cargando…</p>;

    return (
        <div className="ch-marco">
            <aside className="ch-lado">
                <div className="ch-buscar">
                    <input
                        value={buscar}
                        onChange={(e) => setBuscar(e.target.value)}
                        placeholder="Buscar persona…"
                        onFocus={() => setVerContactos(true)}
                    />
                </div>

                {verContactos && buscar.trim() !== '' ? (
                    <>
                        <h4 className="ch-rotulo">Personas</h4>
                        <ul className="ch-lista">
                            {contactosFiltrados.slice(0, 40).map((p) => (
                                <li key={p.id}>
                                    <button
                                        className={`ch-item ${activa === p.clave ? 'es-activo' : ''}`}
                                        onClick={() => { setActiva(p.clave); setBuscar(''); setVerContactos(false); }}
                                        title={p.cargo || ''}
                                    >
                                        <span className="ch-av">{iniciales(p.nombre)}</span>
                                        <span className="ch-item-txt">
                                            <b>{p.nombre}</b>
                                            {p.departamento && <em>{p.departamento}</em>}
                                        </span>
                                    </button>
                                </li>
                            ))}
                            {contactosFiltrados.length === 0 && (
                                <li className="ch-nada">Nadie coincide.</li>
                            )}
                        </ul>
                    </>
                ) : (
                    <>
                        <h4 className="ch-rotulo">Canales</h4>
                        <ul className="ch-lista">
                            {(datos.canales || []).map((c) => (
                                <li key={c.clave}>
                                    <button
                                        className={`ch-item ${activa === c.clave ? 'es-activo' : ''}`}
                                        onClick={() => setActiva(c.clave)}
                                        title={`${c.nombre} · ${c.personas} personas`}
                                    >
                                        <span className="ch-almohadilla">#</span>
                                        <span className="ch-item-txt">
                                            <b>{nombreCanal(c.nombre)}</b>
                                        </span>
                                        {c.sin_leer > 0 && <span className="ch-globo">{c.sin_leer}</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>

                        {(datos.directos || []).length > 0 && (
                            <>
                                <h4 className="ch-rotulo">Mensajes directos</h4>
                                <ul className="ch-lista">
                                    {datos.directos.map((d) => (
                                        <li key={d.clave}>
                                            <button
                                                className={`ch-item ${activa === d.clave ? 'es-activo' : ''}`}
                                                onClick={() => setActiva(d.clave)}
                                            >
                                                <span className="ch-av">{iniciales(d.nombre)}</span>
                                                <span className="ch-item-txt"><b>{d.nombre}</b></span>
                                                {d.sin_leer > 0 && <span className="ch-globo">{d.sin_leer}</span>}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </>
                )}
            </aside>

            <section className="ch-conversacion">
                {!activa ? (
                    <p className="eq-vacio">Elige un canal o una persona.</p>
                ) : (
                    <>
                        <header className="ch-cabecera">
                            <h3>
                                {activa.startsWith('dep:') && <span className="ch-almohadilla">#</span>}
                                {conversacion.titulo || '…'}
                            </h3>
                        </header>

                        <div className="ch-mensajes">
                            {conversacion.fallo && (
                                <p className="eq-vacio">No fue posible cargar la conversación.</p>
                            )}

                            {!conversacion.fallo && conversacion.mensajes.length === 0 && (
                                <p className="eq-vacio">
                                    Todavía no hay mensajes. Escribe el primero.
                                </p>
                            )}

                            {porDia.map((g) => (
                                <div key={g.dia}>
                                    <p className="ch-dia"><span>{rotuloDia(g.dia)}</span></p>

                                    {g.items.map((m, i) => {
                                        // Mensajes seguidos de la misma persona no repiten
                                        // avatar ni nombre: se leen como un bloque.
                                        const anterior = g.items[i - 1];
                                        const seguido = anterior && anterior.empleado === m.empleado;

                                        return (
                                            <article
                                                key={m.id}
                                                className={`ch-msj ${m.mio ? 'es-mio' : ''} ${seguido ? 'es-seguido' : ''}`}
                                            >
                                                {!seguido && (
                                                    <span className="ch-av">{iniciales(m.autor)}</span>
                                                )}
                                                <div className="ch-msj-cuerpo">
                                                    {!seguido && (
                                                        <p className="ch-msj-cab">
                                                            <b>{m.mio ? 'Tú' : m.autor}</b>
                                                            <span>{hora(m.cuando)}</span>
                                                        </p>
                                                    )}
                                                    <p className="ch-msj-txt">{m.mensaje}</p>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            ))}

                            <div ref={finRef} />
                        </div>

                        <form className="ch-escribir" onSubmit={enviar}>
                            <textarea
                                rows={1}
                                value={texto}
                                onChange={(e) => setTexto(e.target.value)}
                                onKeyDown={alTeclear}
                                placeholder={`Enviar mensaje a ${conversacion.titulo || '…'}`}
                                maxLength={4000}
                            />
                            <button type="submit" className="eq-btn" disabled={enviando || !texto.trim()}>
                                {enviando ? '…' : 'Enviar'}
                            </button>
                        </form>
                    </>
                )}
            </section>
        </div>
    );
}
