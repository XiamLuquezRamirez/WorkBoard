import React, { useEffect, useMemo, useState } from 'react';
import axiosInstance from '../../axiosConfig';
import Chat from './Chat';
import TableroPlano from '../tablero/TableroPlano';
import { AvataresProvider } from '../tablero/AvataresContext';
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

const FORMULARIO_VACIO = {
    titulo: '', descripcion: '', fecha: '', hora_inicio: '', hora_fin: '',
    enlace: '', lugar: '', asistentes: [],
};

function Reuniones() {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(false);
    const [pasadas, setPasadas] = useState(false);
    const [creando, setCreando] = useState(false);
    const [convocables, setConvocables] = useState([]);
    const [form, setForm] = useState(FORMULARIO_VACIO);
    const [guardando, setGuardando] = useState(false);
    const [aviso, setAviso] = useState('');
    const [recarga, setRecarga] = useState(0);

    useEffect(() => {
        let vivo = true;
        setError(false);

        axiosInstance.get('/equipo/reuniones', { params: { pasadas: pasadas ? 1 : 0 } })
            .then((r) => vivo && setDatos(r.data))
            .catch(() => vivo && setError(true));

        return () => { vivo = false; };
    }, [pasadas, recarga]);

    const abrirFormulario = () => {
        setCreando(true);
        setAviso('');
        setForm(FORMULARIO_VACIO);
        if (convocables.length === 0) {
            axiosInstance.get('/equipo/convocables')
                .then((r) => setConvocables(r.data || []))
                .catch(() => { /* el formulario funciona sin invitados */ });
        }
    };

    const alternarAsistente = (id) => setForm((f) => ({
        ...f,
        asistentes: f.asistentes.includes(id)
            ? f.asistentes.filter((x) => x !== id)
            : [...f.asistentes, id],
    }));

    const guardar = (ev) => {
        ev.preventDefault();
        setGuardando(true);
        setAviso('');

        axiosInstance.post('/equipo/reuniones', {
            ...form,
            hora_fin: form.hora_fin || null,
            enlace: form.enlace || null,
            lugar: form.lugar || null,
            descripcion: form.descripcion || null,
        })
            .then(() => {
                setCreando(false);
                setPasadas(false);
                setRecarga((n) => n + 1);
            })
            .catch((err) => {
                const errores = err.response?.data?.errors;
                setAviso(errores
                    ? Object.values(errores).flat().join(' ')
                    : (err.response?.data?.error || 'No fue posible crear la reunión.'));
            })
            .finally(() => setGuardando(false));
    };

    const responder = (id, respuesta) => {
        axiosInstance.put(`/equipo/reuniones/${id}/respuesta`, { respuesta })
            .then(() => setRecarga((n) => n + 1))
            .catch(() => setAviso('No fue posible registrar la respuesta.'));
    };

    const cancelar = (id) => {
        if (!window.confirm('¿Cancelar esta reunión? Los convocados verán que se canceló.')) return;
        axiosInstance.delete(`/equipo/reuniones/${id}`)
            .then(() => setRecarga((n) => n + 1))
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
                    <button className="eq-btn" onClick={abrirFormulario}>+ Nueva reunión</button>
                )}
            </div>

            {aviso && <p className="eq-aviso">{aviso}</p>}

            {creando && (
                <form className="eq-form" onSubmit={guardar}>
                    <label className="eq-campo eq-ancho">
                        <span>Título *</span>
                        <input
                            required maxLength={200} value={form.titulo}
                            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                            placeholder="Revisión semanal del tablero"
                        />
                    </label>

                    <label className="eq-campo">
                        <span>Fecha *</span>
                        <input
                            type="date" required value={form.fecha}
                            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                        />
                    </label>

                    <label className="eq-campo">
                        <span>Inicio *</span>
                        <input
                            type="time" required value={form.hora_inicio}
                            onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
                        />
                    </label>

                    <label className="eq-campo">
                        <span>Fin</span>
                        <input
                            type="time" value={form.hora_fin}
                            onChange={(e) => setForm({ ...form, hora_fin: e.target.value })}
                        />
                    </label>

                    <label className="eq-campo eq-ancho">
                        <span>Enlace de videollamada</span>
                        <input
                            type="url" value={form.enlace} maxLength={500}
                            onChange={(e) => setForm({ ...form, enlace: e.target.value })}
                            placeholder="https://meet.google.com/…"
                        />
                    </label>

                    <label className="eq-campo eq-ancho">
                        <span>Lugar</span>
                        <input
                            value={form.lugar} maxLength={200}
                            onChange={(e) => setForm({ ...form, lugar: e.target.value })}
                            placeholder="Sala de juntas, oficina de Riohacha…"
                        />
                    </label>

                    <label className="eq-campo eq-ancho">
                        <span>Asunto</span>
                        <textarea
                            rows={2} value={form.descripcion}
                            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                            placeholder="Qué se va a tratar."
                        />
                    </label>

                    {convocables.length > 0 && (
                        <div className="eq-campo eq-ancho">
                            <span>Convocar a</span>
                            <div className="eq-invitados">
                                {convocables.map((p) => (
                                    <button
                                        type="button"
                                        key={p.id}
                                        className={`eq-invitado ${form.asistentes.includes(p.id) ? 'es-activo' : ''}`}
                                        onClick={() => alternarAsistente(p.id)}
                                        title={p.cargo || ''}
                                    >
                                        <span className="eq-av">{iniciales(p.nombre)}</span>
                                        {p.nombre}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="eq-form-pie">
                        <button type="button" className="eq-btn-sec" onClick={() => setCreando(false)}>
                            Cancelar
                        </button>
                        <button type="submit" className="eq-btn" disabled={guardando}>
                            {guardando ? 'Creando…' : 'Crear reunión'}
                        </button>
                    </div>
                </form>
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
export default function EspacioEquipoModal({ pestanaInicial = 'actividad', onCerrar }) {
    const [pestana, setPestana] = useState(pestanaInicial);

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
                    {pestana === 'reuniones' && <Reuniones />}
                    {pestana === 'chat' && <Chat />}
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
