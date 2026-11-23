import React, { useMemo } from 'react';
import { FaTimes, FaFilePdf } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer } from 'recharts';
import RangosFecha from '../rangosFecha';
import { calcularEjecutivo } from './ejecutivo';
import { situacion } from './tareasEmpleado';
import './ejecutivo.css';

const MESES = 12;

const fecha = (iso) => {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};
const local = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dias = (a, b) => {
    const n = (f) => { const [y, m, d] = f.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
    return a && b ? Math.round((n(b) - n(a)) / 86400000) : null;
};
const verPct = (v) => (v === null ? '—' : `${v} %`);
const Vacio = ({ children }) => <p className="ie-vacio">{children}</p>;

function Seccion({ titulo, detalle, filas, columnas }) {
    if (filas.length === 0) return null;
    return (
        <section className="irg-seccion">
            <h3>{titulo} <span className="ie-cuenta">{filas.length}</span></h3>
            {detalle && <p className="ie-sub">{detalle}</p>}
            <div className="ie-tabla-caja">
                <table className="ie-tabla" data-sin-movil="">
                    <thead><tr><th>Persona</th><th>Tarea</th><th>Prioridad</th>{columnas.map(([t]) => <th key={t}>{t}</th>)}</tr></thead>
                    <tbody>
                        {filas.map((t) => (
                            <tr key={t.id}>
                                <td><span className="ie-nombre">{(t.empleado || 'Sin responsable').toLowerCase()}</span>{t.cargo && <small className="id-cargo">{t.cargo}</small>}</td>
                                <td>{t.titulo}</td>
                                <td>{t.prioridad || '—'}</td>
                                {columnas.map(([titulo2, ver]) => <td key={titulo2}>{ver(t)}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

/** Reporte General del equipo por periodo: el documento completo, para PDF. */
export default function ReporteGeneral({ tareas, cargando, error, startDate, setStartDate, endDate, setEndDate, onCerrar, onPDF, pdfLoading }) {
    const hoy = local(new Date());
    const { total, personas } = useMemo(
        () => calcularEjecutivo(tareas, { desde: startDate, hasta: endDate }), [tareas, startDate, endDate]
    );
    const porFecha = (a, b) => String(a.fecha_pactada || '9999').localeCompare(String(b.fecha_pactada || '9999'));
    const vencidas = tareas.filter((t) => t.vencida).sort((a, b) => b.dias_vencida - a.dias_vencida);
    const de = (s) => tareas.filter((t) => situacion(t) === s && !t.vencida).sort(porFecha);
    const completadas = tareas
        .filter((t) => t.estado === 'Completada' && t.fecha_entregada && t.fecha_entregada >= startDate && t.fecha_entregada <= endDate)
        .sort((a, b) => a.fecha_entregada.localeCompare(b.fecha_entregada));

    // Los últimos 12 meses seguidos: un mes sin entregas también dice algo.
    const meses = useMemo(() => {
        const h = new Date();
        return Array.from({ length: MESES }, (_, i) => {
            const d = new Date(h.getFullYear(), h.getMonth() - (MESES - 1 - i), 1);
            const clave = local(d).slice(0, 7);
            return {
                clave,
                mes: d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }),
                entregas: tareas.filter((t) => t.estado === 'Completada' && t.fecha_entregada?.startsWith(clave)).length,
            };
        });
    }, [tareas]);

    const plazo = (t) => {
        const d = dias(hoy, t.fecha_pactada);
        if (d === null) return 'Sin fecha';
        return d === 0 ? <b className="ie-grave">Vence hoy</b> : `${d} ${d === 1 ? 'día' : 'días'}`;
    };
    const pactada = ['Pactada', (t) => fecha(t.fecha_pactada)];
    const listo = !error && !cargando && tareas.length > 0;

    return (
        <div className="modal-overlay">
            <div className="modal-report ie">
                <div className="modal-header">
                    <h2>Reporte General</h2>
                    <div className="header-actions">
                        <button className="pdf-button" onClick={() => onPDF('Reporte General')} disabled={pdfLoading || !listo}>
                            <FaFilePdf /> {pdfLoading ? '...' : 'PDF'}
                        </button>
                        <button className="close-button" onClick={onCerrar} aria-label="Cerrar"><FaTimes /></button>
                    </div>
                </div>

                <div className="tab-content">
                    <div className="eficiencia-filtros">
                        <RangosFecha startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />
                    </div>
                    <p className="ie-nota">
                        Informe de actividades del <b>{fecha(startDate)}</b> al <b>{fecha(endDate)}</b>, generado el <b>{fecha(hoy)}</b>.
                        Entregas y cumplimiento son del periodo; lo abierto y lo vencido, a hoy.
                    </p>

                    {error && <Vacio>No fue posible cargar las tareas. Cierra el reporte e inténtalo de nuevo.</Vacio>}
                    {!error && cargando && <Vacio>Cargando tareas…</Vacio>}
                    {!error && !cargando && tareas.length === 0 && <Vacio>Tu equipo no tiene tareas registradas.</Vacio>}

                    {listo && (
                        <>
                            <div className="ie-kpis">
                                {[
                                    [total.entregadas, 'Entregadas en el periodo', `${verPct(total.pctATiempo)} a tiempo`, 'ok'],
                                    [verPct(total.pctCumplimiento), 'Cumplimiento de lo que vencía', `${total.cumplidos} de ${total.compromisos}`, ''],
                                    [total.abiertas, 'Abiertas hoy', `${total.pendientes} pend. · ${total.enProceso} en proceso · ${total.enRevision} en revisión · ${total.enPausa} en pausa`, ''],
                                    [total.vencidas, 'Vencidas hoy', `${total.graves} hace más de 7 días`, total.vencidas ? 'mal' : 'ok'],
                                    [personas.length, 'Personas con tareas', '', ''],
                                ].map(([n, t, d, tono]) => (
                                    <div key={t} className={`ie-kpi ${tono ? `ie-kpi--${tono}` : ''}`}>
                                        <span className="ie-kpi-num">{n}</span><span className="ie-kpi-tit">{t}</span>
                                        {d && <span className="ie-kpi-det">{d}</span>}
                                    </div>
                                ))}
                            </div>

                            <section className="irg-seccion">
                                <h3>Por persona <span className="ie-cuenta">{personas.length}</span></h3>
                                <div className="ie-tabla-caja">
                                    <table className="ie-tabla" data-sin-movil="">
                                        <thead><tr><th>Persona</th><th className="num">Entregadas</th><th className="num">A tiempo</th><th className="num">Cumplimiento</th><th className="num">Abiertas</th><th className="num">Vencidas</th></tr></thead>
                                        <tbody>
                                            {personas.map((p) => (
                                                <tr key={p.id ?? p.nombre}>
                                                    <td><b className="ie-nombre">{p.nombre.toLowerCase()}</b>{!p.activo && <span className="ie-inactiva">Inactiva</span>}</td>
                                                    <td className="num">{p.entregadas}</td>
                                                    <td className="num">{verPct(p.pctATiempo)}</td>
                                                    <td className="num">{verPct(p.pctCumplimiento)}</td>
                                                    <td className="num">{p.abiertas}</td>
                                                    <td className="num"><span className={p.vencidas ? 'ie-rojo' : ''}>{p.vencidas}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <Seccion titulo="Vencidas" filas={vencidas} columnas={[pactada, ['Vencida', (t) => <b className="ie-grave">{t.dias_vencida} d</b>]]} />
                            <Seccion titulo="En proceso" filas={de('En Proceso')} columnas={[pactada, ['Plazo', plazo]]} />
                            <Seccion titulo="Pendientes" filas={de('Pendiente')} columnas={[pactada, ['Plazo', plazo]]} />
                            <Seccion titulo="En revisión" detalle="Entregadas: esperan tu decisión." filas={de('En Revisión')} columnas={[pactada]} />
                            <Seccion titulo="En pausa" filas={de('En pausa')} columnas={[pactada, ['Motivo', (t) => t.motivo_reprogramacion || '—']]} />
                            <Seccion
                                titulo="Entregadas en el periodo" filas={completadas}
                                columnas={[pactada, ['Entregada', (t) => fecha(t.fecha_entregada)], ['Resultado', (t) => {
                                    const d = dias(t.fecha_pactada, t.fecha_entregada);
                                    if (t.a_tiempo === false) return <b className="ie-grave">{d} d tarde</b>;
                                    return d !== null && d < 0 ? `${-d} d antes` : 'A tiempo';
                                }]]}
                            />

                            <section className="ie-grafica irg-seccion">
                                <h3>Entregas por mes</h3>
                                <p className="ie-sub">Últimos {MESES} meses.</p>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={meses} margin={{ top: 18, right: 12, left: -16, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(v) => [v, 'Entregas']} />
                                        <Bar dataKey="entregas" fill="#16a34a" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                                            <LabelList dataKey="entregas" position="top" style={{ fontSize: 11, fill: '#334155' }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </section>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
