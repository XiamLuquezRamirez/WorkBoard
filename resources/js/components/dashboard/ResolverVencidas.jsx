import React, { useEffect, useMemo, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import axiosInstance from '../../axiosConfig';
import './resolverVencidas.css';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fecha = (iso) => {
    const [y, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
    return y ? `${d} ${MESES[m - 1]} ${y}` : '';
};

const ACCIONES = {
    pedir: {
        titulo: 'Pedir actualización',
        ayuda: 'Le llega a cada responsable a su campana: que la entregue, pida reprogramación o avise si ya no aplica. Una vez al día por tarea.',
        boton: 'Enviar pedido',
    },
    reprogramar: {
        titulo: 'Reprogramar',
        ayuda: 'Nueva fecha real, acordada con la persona. El motivo queda en el historial de cada tarea y se le avisa.',
        boton: 'Reprogramar',
    },
    archivar: {
        titulo: 'Archivar',
        ayuda: 'Para lo que ya no aplica. Sale del tablero y de los indicadores; se puede desarchivar desde la tarea.',
        boton: 'Archivar',
    },
};

/**
 * Revisar lo vencido de una persona, de un área o de todos, y decidir en
 * bloque: pedir actualización, reprogramar o archivar.
 *
 * Es la herramienta de la sesión de limpieza: el tablero no vuelve a ser
 * creíble mientras arrastre tareas vencidas hace meses.
 */
export default function ResolverVencidas({ departamento, empleado, onCerrar, onResuelto }) {
    const [tareas, setTareas] = useState(null);
    const [error, setError] = useState('');
    const [elegidas, setElegidas] = useState(() => new Set());
    const [accion, setAccion] = useState('pedir');
    const [nuevaFecha, setNuevaFecha] = useState('');
    const [motivo, setMotivo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [hoy, setHoy] = useState('');

    const cargar = () => {
        setError('');
        axiosInstance.get('/dashboard/vencidas', {
            params: { departamento: departamento || undefined, empleado: empleado?.id || undefined },
        })
            .then((r) => {
                setTareas(r.data.tareas || []);
                setHoy(r.data.hoy || '');
                setElegidas(new Set());
            })
            .catch(() => setError('No fue posible cargar las tareas vencidas.'));
    };

    useEffect(cargar, [departamento, empleado?.id]);

    useEffect(() => {
        const alTeclear = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } };
        window.addEventListener('keydown', alTeclear, true);
        return () => window.removeEventListener('keydown', alTeclear, true);
    }, [onCerrar]);

    // Agrupadas por persona: así se revisan como en la sesión con el equipo.
    const grupos = useMemo(() => {
        const m = new Map();
        for (const t of tareas || []) {
            if (!m.has(t.empleado_id)) m.set(t.empleado_id, { nombre: t.empleado, departamento: t.departamento, tareas: [] });
            m.get(t.empleado_id).tareas.push(t);
        }
        return [...m.values()];
    }, [tareas]);

    const alternar = (ids, marcar) => setElegidas((prev) => {
        const s = new Set(prev);
        ids.forEach((id) => (marcar ? s.add(id) : s.delete(id)));
        return s;
    });

    const todas = (tareas || []).map((t) => t.id);
    const todasMarcadas = todas.length > 0 && todas.every((id) => elegidas.has(id));

    const faltante = elegidas.size === 0
        ? 'Elige al menos una tarea.'
        : accion === 'reprogramar' && !nuevaFecha
            ? 'Indica la nueva fecha.'
            : accion !== 'pedir' && motivo.trim().length < 5
                ? 'Escribe el motivo (al menos 5 caracteres).'
                : '';

    const aplicar = () => {
        if (faltante) return;
        setEnviando(true);
        setResultado(null);
        axiosInstance.post('/dashboard/vencidas/resolver', {
            accion,
            tareas: [...elegidas],
            fecha_pactada: accion === 'reprogramar' ? nuevaFecha : undefined,
            motivo: accion !== 'pedir' ? motivo.trim() : undefined,
        })
            .then((r) => {
                setResultado(r.data);
                if (r.data.hechas?.length) {
                    onResuelto?.();
                    if (accion !== 'pedir') setMotivo('');
                    cargar();
                }
            })
            .catch((e) => {
                const d = e.response?.data;
                if (d?.omitidas) setResultado(d);
                else setResultado({ error: d?.message || Object.values(d?.errors || {})[0]?.[0] || 'No fue posible aplicar la acción.' });
            })
            .finally(() => setEnviando(false));
    };

    const titulo = empleado ? `Vencidas de ${empleado.nombre}` : departamento ? `Vencidas · ${departamento}` : 'Vencidas de toda la organización';

    return (
        <div className="rv-fondo" onClick={onCerrar}>
            <section className="rv-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="rv-titulo">
                <header className="rv-cab">
                    <div>
                        <h2 id="rv-titulo">{titulo}</h2>
                        <p>Revisa cada una y decide. Lo vencido sin decisión hace que el tablero deje de reflejar el trabajo real.</p>
                    </div>
                    <button type="button" className="rv-cerrar" onClick={onCerrar} aria-label="Cerrar"><FaTimes /></button>
                </header>

                <div className="rv-cuerpo">
                    {error && <p className="rv-vacio">{error}</p>}
                    {!error && tareas === null && <p className="rv-vacio">Cargando…</p>}
                    {tareas && tareas.length === 0 && (
                        <p className="rv-vacio">✓ No hay tareas vencidas que resolver aquí.</p>
                    )}

                    {tareas && tareas.length > 0 && (
                        <>
                            <label className="rv-todas">
                                <input type="checkbox" checked={todasMarcadas} onChange={(e) => alternar(todas, e.target.checked)} />
                                Elegir todas ({tareas.length})
                            </label>

                            {grupos.map((g) => {
                                const ids = g.tareas.map((t) => t.id);
                                const marcadas = ids.every((id) => elegidas.has(id));
                                return (
                                    <div key={g.nombre} className="rv-grupo">
                                        <label className="rv-persona">
                                            <input type="checkbox" checked={marcadas} onChange={(e) => alternar(ids, e.target.checked)} />
                                            <strong>{g.nombre}</strong>
                                            <span>{g.departamento} · {g.tareas.length} vencida{g.tareas.length === 1 ? '' : 's'}</span>
                                        </label>
                                        <ul>
                                            {g.tareas.map((t) => (
                                                <li key={t.id}>
                                                    <label className={elegidas.has(t.id) ? 'es-elegida' : ''}>
                                                        <input type="checkbox" checked={elegidas.has(t.id)} onChange={(e) => alternar([t.id], e.target.checked)} />
                                                        <span className="rv-titulo-tarea">{t.titulo}</span>
                                                        <span className={`rv-dias ${t.dias > 30 ? 'es-grave' : ''}`}>
                                                            {t.dias === 1 ? 'hace 1 día' : `hace ${t.dias} días`}
                                                        </span>
                                                        <span className="rv-meta">
                                                            {t.estado} · pactada {fecha(t.fecha_pactada)}
                                                            {t.proyecto ? ` · ${t.proyecto}` : ''}
                                                            {t.pedido_en ? ` · actualización pedida el ${fecha(t.pedido_en)}` : ''}
                                                        </span>
                                                    </label>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>

                {tareas && tareas.length > 0 && (
                    <footer className="rv-pie">
                        <div className="rv-acciones" role="radiogroup" aria-label="Qué hacer con las elegidas">
                            {Object.entries(ACCIONES).map(([k, a]) => (
                                <button
                                    key={k}
                                    type="button"
                                    role="radio"
                                    aria-checked={accion === k}
                                    className={accion === k ? 'es-activa' : ''}
                                    onClick={() => { setAccion(k); setResultado(null); }}
                                >
                                    {a.titulo}
                                </button>
                            ))}
                        </div>
                        <p className="rv-ayuda">{ACCIONES[accion].ayuda}</p>

                        <div className="rv-campos">
                            {accion === 'reprogramar' && (
                                <label>
                                    Nueva fecha
                                    <input type="date" min={hoy} value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} />
                                </label>
                            )}
                            {accion !== 'pedir' && (
                                <label className="rv-motivo">
                                    Motivo
                                    <input
                                        type="text"
                                        maxLength={500}
                                        value={motivo}
                                        placeholder={accion === 'archivar' ? 'Ej.: el cliente canceló el proyecto' : 'Ej.: se acordó con la persona en la revisión semanal'}
                                        onChange={(e) => setMotivo(e.target.value)}
                                    />
                                </label>
                            )}
                            <button type="button" className="rv-aplicar" onClick={aplicar} disabled={enviando || Boolean(faltante)} title={faltante}>
                                {enviando ? 'Aplicando…' : `${ACCIONES[accion].boton}${elegidas.size ? ` (${elegidas.size})` : ''}`}
                            </button>
                        </div>

                        {resultado && (
                            <div className={`rv-resultado ${resultado.error ? 'es-error' : ''}`} role="status">
                                {resultado.error && <p>{resultado.error}</p>}
                                {resultado.hechas?.length > 0 && (
                                    <p>✓ {resultado.hechas.length} tarea{resultado.hechas.length === 1 ? '' : 's'} resuelta{resultado.hechas.length === 1 ? '' : 's'}.</p>
                                )}
                                {resultado.omitidas?.length > 0 && (
                                    <p>
                                        {resultado.omitidas.length} sin aplicar: {[...new Set(resultado.omitidas.map((o) => o.motivo))].join(' ')}
                                    </p>
                                )}
                            </div>
                        )}
                    </footer>
                )}
            </section>
        </div>
    );
}
