import React, { useCallback, useEffect, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import axiosInstance from '../../axiosConfig';
import './bandejaDecisiones.css';

/** «Ahora no» la aparta este tiempo; después vuelve a abrirse sola. */
const POSPONER_MS = 4 * 60 * 60 * 1000;
const CLAVE = 'wb-bandeja-pospuesta';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fecha = (iso) => {
    const [y, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
    return y ? `${d} ${MESES[m - 1]} ${y}` : '';
};
const hace = (n) => (n === 1 ? 'hace 1 día' : `hace ${n} días`);

const pospuesta = () => {
    try {
        const t = Number(sessionStorage.getItem(CLAVE) || 0);
        return t && Date.now() - t < POSPONER_MS;
    } catch (e) {
        return false;
    }
};

const OPCIONES = [
    { id: 'entregar', icono: '📤', titulo: 'Entregarla', ayuda: 'Abre la tarea para adjuntar la evidencia y enviarla a revisión.' },
    { id: 'reprogramar', icono: '📅', titulo: 'Pedir nueva fecha', ayuda: 'Tu líder aprueba la nueva fecha.' },
    { id: 'bloquear', icono: '⛔', titulo: 'Está bloqueada', ayuda: 'Algo ajeno a ti impide avanzar: dilo para que alguien lo destrabe.' },
    { id: 'archivar', icono: '🗂️', titulo: 'Ya no aplica', ayuda: 'Se archiva y tu líder recibe el motivo; puede desarchivarla.' },
];

/** Formulario de la decisión elegida para una tarea. */
function Decision({ tarea, opcion, hoy, onHecha, onCancelar }) {
    const [nuevaFecha, setNuevaFecha] = useState('');
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');

    const minimo = opcion === 'reprogramar' ? 5 : 10;
    const falta = opcion === 'reprogramar' && !nuevaFecha
        ? 'Elige la nueva fecha.'
        : texto.trim().length < minimo
            ? `Escribe al menos ${minimo} caracteres.`
            : '';

    const enviar = (e) => {
        e.preventDefault();
        if (falta) return;
        setEnviando(true);
        setError('');

        const peticion = {
            reprogramar: () => axiosInstance.post('/reprogramaciones/solicitar', {
                tarea_id: tarea.id, fecha_actual: tarea.fecha_pactada, fecha_nueva: nuevaFecha, motivo: texto.trim(),
            }),
            bloquear: () => axiosInstance.put(`/bloquearTarea/${tarea.id}`, { bloqueada: true, motivo: texto.trim() }),
            archivar: () => axiosInstance.post(`/mis-decisiones/${tarea.id}/ya-no-aplica`, { motivo: texto.trim() }),
        }[opcion];

        peticion()
            .then(() => onHecha({
                reprogramar: 'Nueva fecha pedida a tu líder.',
                bloquear: 'Marcada como bloqueada.',
                archivar: 'Archivada; tu líder recibió el motivo.',
            }[opcion]))
            .catch((err) => {
                const d = err.response?.data;
                setError(d?.error || d?.message || Object.values(d?.errors || {})[0]?.[0] || 'No fue posible guardar la decisión.');
            })
            .finally(() => setEnviando(false));
    };

    const etiqueta = {
        reprogramar: '¿Por qué necesitas más tiempo?',
        bloquear: '¿Qué te impide avanzar?',
        archivar: '¿Por qué ya no aplica?',
    }[opcion];

    return (
        <form className="bd-form" onSubmit={enviar}>
            {opcion === 'reprogramar' && (
                <label>
                    Nueva fecha
                    <input type="date" min={hoy} value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} autoFocus />
                </label>
            )}
            <label className="bd-form-texto">
                {etiqueta}
                <textarea
                    rows={2}
                    maxLength={500}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    autoFocus={opcion !== 'reprogramar'}
                />
            </label>
            {error && <p className="bd-error" role="alert">{error}</p>}
            <div className="bd-form-botones">
                <button type="button" className="bd-btn-sec" onClick={onCancelar}>Cancelar</button>
                <button type="submit" className="bd-btn" disabled={enviando || Boolean(falta)} title={falta}>
                    {enviando ? 'Guardando…' : 'Confirmar'}
                </button>
            </div>
        </form>
    );
}

/**
 * Bandeja «Necesita tu decisión».
 *
 * Lista las tareas propias vencidas sobre las que nadie ha decidido nada y
 * pide resolver cada una. Se abre sola al entrar; «Ahora no» la aparta unas
 * horas, pero el aviso de arriba sigue a la vista mientras quede alguna.
 *
 * onAbrirTarea(id) abre el detalle para entregarla; recarga se incrementa
 * desde fuera cuando el tablero cambia (p. ej. al cerrar una tarea).
 */
export default function BandejaDecisiones({ onAbrirTarea, onCambio, recarga = 0 }) {
    const [tareas, setTareas] = useState([]);
    const [hoy, setHoy] = useState('');
    const [abierta, setAbierta] = useState(false);
    const [eleccion, setEleccion] = useState({});
    const [hechas, setHechas] = useState([]);
    const [primeraCarga, setPrimeraCarga] = useState(true);

    const cargar = useCallback(() => {
        axiosInstance.get('/mis-decisiones')
            .then((r) => {
                const lista = r.data.tareas || [];
                setTareas(lista);
                setHoy(r.data.hoy || '');
                setPrimeraCarga((primera) => {
                    // Al entrar se abre sola si hay algo y no se pospuso hace poco.
                    if (primera && lista.length > 0 && !pospuesta()) setAbierta(true);
                    return false;
                });
            })
            .catch(() => { /* sin bandeja no se bloquea nada */ });
    }, []);

    useEffect(() => { cargar(); }, [cargar, recarga]);

    useEffect(() => {
        if (!abierta) return undefined;
        const alTeclear = (e) => { if (e.key === 'Escape') { e.stopPropagation(); posponer(); } };
        window.addEventListener('keydown', alTeclear, true);
        return () => window.removeEventListener('keydown', alTeclear, true);
    });

    const posponer = () => {
        try { sessionStorage.setItem(CLAVE, String(Date.now())); } catch (e) { /* sin almacenamiento: sólo se cierra */ }
        setAbierta(false);
    };

    const hecha = (tarea, mensaje) => {
        setHechas((h) => [...h, { id: tarea.id, titulo: tarea.titulo, mensaje }]);
        setTareas((ts) => ts.filter((t) => t.id !== tarea.id));
        setEleccion((e) => ({ ...e, [tarea.id]: undefined }));
        onCambio?.();
    };

    const elegir = (tarea, opcion) => {
        if (opcion === 'entregar') {
            setAbierta(false);
            onAbrirTarea(tarea.id);
            return;
        }
        setEleccion((e) => ({ ...e, [tarea.id]: opcion }));
    };

    if (primeraCarga) return null;

    const n = tareas.length;

    return (
        <>
            {n > 0 && !abierta && (
                <div className="bd-aviso" role="status">
                    <span>
                        ⏰ <strong>{n} {n === 1 ? 'tarea vencida necesita' : 'tareas vencidas necesitan'} tu decisión.</strong>
                        {' '}Entrégala, pide una fecha nueva, márcala bloqueada o indica que ya no aplica.
                    </span>
                    <button type="button" className="bd-btn" onClick={() => setAbierta(true)}>Resolver</button>
                </div>
            )}

            {abierta && (
                <div className="bd-fondo" onClick={posponer}>
                    <section
                        className="bd-modal"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="bd-titulo"
                    >
                        <header className="bd-cab">
                            <div>
                                <h2 id="bd-titulo">Necesita tu decisión</h2>
                                <p>
                                    {n > 0
                                        ? `${n} ${n === 1 ? 'tarea tuya pasó' : 'tareas tuyas pasaron'} su fecha sin que se decidiera qué pasa con ${n === 1 ? 'ella' : 'ellas'}. Elige una salida para cada una.`
                                        : 'Todo resuelto. Gracias: así el tablero refleja el trabajo real.'}
                                </p>
                            </div>
                            <button type="button" className="bd-cerrar" onClick={posponer} aria-label="Cerrar">
                                <FaTimes />
                            </button>
                        </header>

                        <div className="bd-cuerpo">
                            {hechas.length > 0 && (
                                <ul className="bd-hechas">
                                    {hechas.map((h) => (
                                        <li key={h.id}>✓ «{h.titulo}»: {h.mensaje}</li>
                                    ))}
                                </ul>
                            )}

                            {tareas.map((t) => {
                                const op = eleccion[t.id];
                                return (
                                    <article key={t.id} className="bd-tarea">
                                        <div className="bd-tarea-cab">
                                            <h3>{t.titulo}</h3>
                                            <span className={`bd-dias ${t.dias > 30 ? 'es-grave' : ''}`}>Venció {hace(t.dias)}</span>
                                        </div>
                                        <p className="bd-meta">
                                            {t.estado} · pactada para el {fecha(t.fecha_pactada)}
                                            {t.proyecto ? ` · ${t.proyecto}` : ''}
                                        </p>

                                        {!op && (
                                            <div className="bd-opciones">
                                                {OPCIONES.map((o) => (
                                                    <button key={o.id} type="button" className="bd-opcion" onClick={() => elegir(t, o.id)} title={o.ayuda}>
                                                        <span aria-hidden="true">{o.icono}</span>
                                                        {o.titulo}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {op && (
                                            <>
                                                <p className="bd-ayuda">{OPCIONES.find((o) => o.id === op)?.ayuda}</p>
                                                <Decision
                                                    tarea={t}
                                                    opcion={op}
                                                    hoy={hoy}
                                                    onHecha={(mensaje) => hecha(t, mensaje)}
                                                    onCancelar={() => setEleccion((e) => ({ ...e, [t.id]: undefined }))}
                                                />
                                            </>
                                        )}
                                    </article>
                                );
                            })}
                        </div>

                        <footer className="bd-pie">
                            {n > 0 ? (
                                <button type="button" className="bd-btn-sec" onClick={posponer}>
                                    Ahora no (vuelve en 4 horas)
                                </button>
                            ) : (
                                <button type="button" className="bd-btn" onClick={() => setAbierta(false)}>Listo</button>
                            )}
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
}
