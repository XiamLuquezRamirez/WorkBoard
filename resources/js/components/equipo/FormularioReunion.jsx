import React, { useEffect, useMemo, useState } from 'react';
import axiosInstance from '../../axiosConfig';
import './formularioReunion.css';

const iniciales = (n) => String(n || '?')
    .trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/** Fecha local de hoy en AAAA-MM-DD (toISOString daría la de UTC). */
const hoyLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Quita tildes y pasa a minúsculas para buscar «jose» y encontrar «José». */
const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Avisa al resto de la pantalla (pendientes, lista) de que algo cambió. */
export const avisarCambioReuniones = () => window.dispatchEvent(new Event('wb:reuniones-cambiaron'));

/**
 * Formulario para solicitar una reunión.
 *
 * Se usa en la pestaña Reuniones del Espacio de Equipo y en el puesto de una
 * persona del plano («Solicitar reunión»), allí con esa persona ya elegida.
 *
 * Se puede convocar a cualquier colaborador activo, de cualquier
 * departamento. La lista va agrupada por departamento y con buscador porque
 * la organización entera no cabe en una nube de botones.
 *
 * `compacto` lo apila en una columna para el lateral del plano.
 */
export default function FormularioReunion({ invitadosIniciales = [], compacto = false, onCreada, onCancelar }) {
    const [gente, setGente] = useState(null);
    const [form, setForm] = useState({
        titulo: '', descripcion: '', fecha: hoyLocal(), hora_inicio: '', hora_fin: '',
        enlace: '', lugar: '',
    });
    const [elegidos, setElegidos] = useState(() => [...new Set(invitadosIniciales)]);
    const [busca, setBusca] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [errores, setErrores] = useState({});
    const [aviso, setAviso] = useState('');

    useEffect(() => {
        let vivo = true;
        axiosInstance.get('/equipo/convocables')
            .then((r) => vivo && setGente(r.data || []))
            .catch(() => vivo && setGente([]));
        return () => { vivo = false; };
    }, []);

    const porId = useMemo(() => new Map((gente || []).map((p) => [p.id, p])), [gente]);

    // Departamentos con la gente que casa con la búsqueda.
    const grupos = useMemo(() => {
        const q = normal(busca.trim());
        const mapa = new Map();
        for (const p of gente || []) {
            if (q && !normal(`${p.nombre} ${p.cargo || ''} ${p.departamento}`).includes(q)) continue;
            if (!mapa.has(p.departamento)) mapa.set(p.departamento, []);
            mapa.get(p.departamento).push(p);
        }
        return [...mapa.entries()].map(([nombre, personas]) => ({ nombre, personas }));
    }, [gente, busca]);

    const cambiar = (campo) => (e) => {
        setForm((f) => ({ ...f, [campo]: e.target.value }));
        setErrores((x) => ({ ...x, [campo]: undefined }));
    };

    const alternar = (id) => {
        setErrores((x) => ({ ...x, asistentes: undefined }));
        setElegidos((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
    };

    const alternarGrupo = (personas) => {
        const ids = personas.map((p) => p.id);
        const todos = ids.every((id) => elegidos.includes(id));
        setErrores((x) => ({ ...x, asistentes: undefined }));
        setElegidos((l) => (todos ? l.filter((id) => !ids.includes(id)) : [...new Set([...l, ...ids])]));
    };

    const guardar = (ev) => {
        ev.preventDefault();
        if (elegidos.length === 0) {
            setErrores({ asistentes: 'Elige al menos un participante.' });
            return;
        }

        setGuardando(true);
        setAviso('');
        axiosInstance.post('/equipo/reuniones', {
            ...form,
            titulo: form.titulo.trim(),
            hora_fin: form.hora_fin || null,
            enlace: form.enlace.trim() || null,
            lugar: form.lugar.trim() || null,
            descripcion: form.descripcion.trim() || null,
            asistentes: elegidos,
        })
            .then((r) => {
                avisarCambioReuniones();
                onCreada?.(r.data);
            })
            .catch((err) => {
                const e = err.response?.data?.errors;
                if (e) {
                    setErrores(Object.fromEntries(Object.entries(e).map(([k, v]) => [k.split('.')[0], [].concat(v)[0]])));
                } else {
                    setAviso(err.response?.data?.error || 'No fue posible crear la reunión. Inténtalo de nuevo.');
                }
            })
            .finally(() => setGuardando(false));
    };

    const err = (campo) => errores[campo] && <small className="fr-error">{errores[campo]}</small>;

    return (
        <form className={`fr-form ${compacto ? 'es-compacto' : ''}`} onSubmit={guardar} noValidate>
            <label className="fr-campo fr-ancho">
                <span>¿De qué es la reunión? *</span>
                <input
                    required maxLength={200} value={form.titulo} onChange={cambiar('titulo')}
                    placeholder="Ej.: Revisar avance del informe mensual"
                    autoFocus={!compacto}
                />
                {err('titulo')}
            </label>

            <label className="fr-campo fr-fecha">
                <span>Fecha *</span>
                <input type="date" required min={hoyLocal()} value={form.fecha} onChange={cambiar('fecha')} />
                {err('fecha')}
            </label>

            <label className="fr-campo">
                <span>Inicio *</span>
                <input type="time" required value={form.hora_inicio} onChange={cambiar('hora_inicio')} />
                {err('hora_inicio')}
            </label>

            <label className="fr-campo">
                <span>Fin</span>
                <input type="time" value={form.hora_fin} onChange={cambiar('hora_fin')} />
                {err('hora_fin')}
            </label>

            <label className="fr-campo fr-mitad">
                <span>Lugar</span>
                <input value={form.lugar} maxLength={200} onChange={cambiar('lugar')} placeholder="Sala de juntas, oficina…" />
                {err('lugar')}
            </label>

            <label className="fr-campo fr-mitad">
                <span>Enlace de videollamada</span>
                <input type="url" value={form.enlace} maxLength={500} onChange={cambiar('enlace')} placeholder="https://meet.google.com/…" />
                {err('enlace')}
            </label>

            <label className="fr-campo fr-ancho">
                <span>Asunto</span>
                <textarea rows={2} value={form.descripcion} maxLength={4000} onChange={cambiar('descripcion')} placeholder="Qué se va a tratar y qué hay que traer preparado." />
            </label>

            <div className="fr-campo fr-ancho">
                <span>Participantes * <em className="fr-cuenta">{elegidos.length} elegido{elegidos.length === 1 ? '' : 's'}</em></span>

                {elegidos.length > 0 && (
                    <div className="fr-elegidos">
                        {elegidos.map((id) => {
                            const p = porId.get(id);
                            return (
                                <button type="button" key={id} className="fr-chip" onClick={() => alternar(id)} title="Quitar">
                                    <span className="fr-av">{iniciales(p?.nombre)}</span>
                                    {p?.nombre || 'Cargando…'}
                                    <b aria-hidden="true">×</b>
                                </button>
                            );
                        })}
                    </div>
                )}

                <input
                    type="search"
                    className="fr-buscar"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por nombre, cargo o departamento"
                    aria-label="Buscar colaboradores"
                />

                <div className="fr-lista" role="group" aria-label="Colaboradores">
                    {gente === null && <p className="fr-vacio">Cargando colaboradores…</p>}
                    {gente && grupos.length === 0 && <p className="fr-vacio">Nadie coincide con «{busca}».</p>}
                    {grupos.map((g) => {
                        const todos = g.personas.every((p) => elegidos.includes(p.id));
                        return (
                            <section key={g.nombre} className="fr-grupo">
                                <header>
                                    <h5>{g.nombre} <em>{g.personas.length}</em></h5>
                                    <button type="button" onClick={() => alternarGrupo(g.personas)}>
                                        {todos ? 'Quitar todos' : 'Agregar todos'}
                                    </button>
                                </header>
                                {g.personas.map((p) => {
                                    const si = elegidos.includes(p.id);
                                    return (
                                        <button
                                            type="button"
                                            key={p.id}
                                            className={`fr-persona ${si ? 'es-elegida' : ''}`}
                                            onClick={() => alternar(p.id)}
                                            aria-pressed={si}
                                        >
                                            <span className="fr-marca" aria-hidden="true">{si ? '✓' : ''}</span>
                                            <span className="fr-av">{iniciales(p.nombre)}</span>
                                            <span className="fr-persona-txt">
                                                <b>{p.nombre}</b>
                                                {p.cargo && <small>{p.cargo}</small>}
                                            </span>
                                        </button>
                                    );
                                })}
                            </section>
                        );
                    })}
                </div>
                {err('asistentes')}
            </div>

            {aviso && <p className="fr-aviso fr-ancho">{aviso}</p>}

            <div className="fr-pie fr-ancho">
                <p>
                    {elegidos.length > 0
                        ? `Les llegará la convocatoria a la plataforma y una copia al correo a ${elegidos.length === 1 ? '1 persona' : `${elegidos.length} personas`}.`
                        : 'Cada participante recibe el aviso en la plataforma y una copia al correo.'}
                </p>
                <div>
                    {onCancelar && (
                        <button type="button" className="fr-btn-sec" onClick={onCancelar}>Cancelar</button>
                    )}
                    <button type="submit" className="fr-btn" disabled={guardando}>
                        {guardando ? 'Enviando…' : 'Enviar convocatoria'}
                    </button>
                </div>
            </div>
        </form>
    );
}
