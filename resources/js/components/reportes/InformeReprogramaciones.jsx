import React, { useContext, useEffect, useMemo, useState } from 'react';
import { FaTimes, FaFilePdf, FaFileExcel } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import axiosInstance from '../../axiosConfig';
import RangosFecha from '../rangosFecha';
import { calcular, filtrar, FILTROS_VACIOS } from './reprogramaciones';
import { AmbitoInforme } from './ambito';
import './ejecutivo.css';

const PESTANAS = [
    { id: 'resumen', titulo: 'Resumen' },
    { id: 'personas', titulo: 'Por persona' },
    { id: 'detalle', titulo: 'Detalle' },
];
const COLOR_ESTADO = { Aprobada: '#15803d', Aplicada: '#1d4ed8', Rechazada: '#b91c1c', Pendiente: '#b45309' };
const POR_PAGINA = 50;

const fecha = (iso) => {
    if (!iso) return '—';
    const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};
const mesTexto = (aaaamm) => {
    const [a, m] = aaaamm.split('-').map(Number);
    return new Date(a, m - 1, 1).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
};
const hoy = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const coma = (n) => String(n).replace('.', ',');
const diasTexto = (n) => (n === null ? '—' : `${n > 0 ? '+' : ''}${n} d`);

const Vacio = ({ children }) => <p className="ie-vacio">{children}</p>;

function Kpi({ numero, titulo, detalle, tono = '' }) {
    return (
        <div className={`ie-kpi ${tono ? `ie-kpi--${tono}` : ''}`}>
            <span className="ie-kpi-num">{numero}</span>
            <span className="ie-kpi-tit">{titulo}</span>
            {detalle && <span className="ie-kpi-det">{detalle}</span>}
        </div>
    );
}

/** Cuánto, quién y cómo se aplazan o pausan las tareas, con y sin aprobación. */
export default function InformeReprogramaciones({ onCerrar, onPDF, pdfLoading }) {
    const ambito = useContext(AmbitoInforme);
    const [pestana, setPestana] = useState('resumen');
    const [inicio, setInicio] = useState('');
    const [fin, setFin] = useState('');
    const [filas, setFilas] = useState(null);
    const [error, setError] = useState('');
    const [f, setF] = useState(FILTROS_VACIOS);
    const [mostrar, setMostrar] = useState(POR_PAGINA);
    const poner = (cambios) => { setF((v) => ({ ...v, ...cambios })); setMostrar(POR_PAGINA); };

    // Al cambiar las fechas se cancela la petición anterior: una respuesta
    // vieja podía pisar a la nueva.
    useEffect(() => {
        const ctrl = new AbortController();
        setFilas(null);
        setError('');
        axiosInstance.get('/informes/reprogramaciones', {
            params: { ...ambito, inicio: inicio || undefined, fin: fin || undefined }, signal: ctrl.signal,
        })
            .then((r) => setFilas(Array.isArray(r.data) ? r.data : []))
            .catch((e) => {
                if (ctrl.signal.aborted) return;
                const errores = e?.response?.data?.errors;
                setError(errores ? Object.values(errores).flat().join(' ') : 'No fue posible cargar las reprogramaciones.');
            });
        return () => ctrl.abort();
    }, [inicio, fin]);

    const todas = filas || [];
    const areas = [...new Set(todas.map((r) => r.departamento))].sort((a, b) => a.localeCompare(b));
    const personasOpc = [...new Map(todas
        .filter((r) => r.empleado_id && (!f.area || r.departamento === f.area))
        .map((r) => [r.empleado_id, r.responsable])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
    const visibles = useMemo(() => filtrar(filas || [], f), [filas, f]);
    const d = useMemo(() => calcular(visibles), [visibles]);
    const listo = !error && filas !== null;

    const exportarExcel = () => {
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(visibles.map((r) => ({
            Tipo: r.tipo, Vía: r.via, Estado: r.estado, Tarea: r.tarea_titulo, Responsable: r.responsable, Área: r.departamento,
            'Pedida por': r.nombre_solicitante || '', 'Fecha': String(r.fecha_solicitud).slice(0, 10),
            'Fecha anterior': r.fecha_actual || '', 'Fecha nueva': r.fecha_nueva || '', 'Días ampliados': r.dias_ampliados ?? '',
            'Ya vencida al pedirla': r.ya_vencida === null ? '' : r.ya_vencida ? 'Sí' : 'No',
            Motivo: r.motivo || '', 'Resuelta por': r.nombre_aprobador || '', 'Observación de rechazo': r.observacion_rechazo || '',
        }))), 'Detalle');
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(d.personas.map((p) => ({
            Persona: p.nombre, Área: p.area, Aplazamientos: p.aplazamientos, 'Sin aprobación': p.directos,
            'Ya vencidas': p.tarde, 'Días ampliados': p.dias, Pausas: p.pausas, Pendientes: p.pendientes,
        }))), 'Por persona');
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(d.repetidas.map((t) => ({
            Tarea: t.titulo, Responsable: t.persona, Veces: t.veces, 'Días ampliados': t.dias,
        }))), 'Varias veces');
        XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([
            ['Desde', inicio || 'Todo'], ['Hasta', fin || 'Todo'], ['Tipo', f.tipo || 'Todos'], ['Estado', f.estado || 'Todos'],
            ['Vía', f.via || 'Todas'], ['Área', f.area || 'Todas'],
            ['Persona', personasOpc.find(([id]) => id === f.persona)?.[1] || 'Todas'], ['Generado', hoy()],
        ]), 'Filtros');
        XLSX.writeFile(libro, `reprogramaciones-y-pausas-${hoy()}.xlsx`);
    };

    const selector = (texto, valor, opciones, alCambiar, todos = 'Todos') => (
        <label className="eficiencia-filtro-label">
            {texto}
            <select className="eficiencia-filtro-input" value={valor} onChange={(e) => alCambiar(e.target.value)}>
                <option value="">{todos}</option>
                {opciones.map((o) => <option key={o}>{o}</option>)}
            </select>
        </label>
    );

    return (
        <div className="modal-overlay">
            <div className="modal-report ie">
                <div className="modal-header">
                    <h2>Reprogramaciones y pausas</h2>
                    <div className="header-actions">
                        <button className="pdf-button" onClick={exportarExcel} disabled={!visibles.length}><FaFileExcel /> Excel</button>
                        <button className="pdf-button" onClick={() => onPDF('Reprogramaciones y pausas')} disabled={pdfLoading}>
                            <FaFilePdf /> {pdfLoading ? '...' : 'PDF'}
                        </button>
                        <button className="close-button" onClick={onCerrar} aria-label="Cerrar"><FaTimes /></button>
                    </div>
                </div>

                <div className="tab-content">
                    <div className="eficiencia-filtros">
                        <RangosFecha startDate={inicio} setStartDate={setInicio} endDate={fin} setEndDate={setFin} />
                        {selector('Tipo', f.tipo, ['Reprogramación', 'Pausa'], (v) => poner({ tipo: v }))}
                        {selector('Estado', f.estado, Object.keys(COLOR_ESTADO), (v) => poner({ estado: v }))}
                        {selector('Vía', f.via, ['Solicitud', 'Directa', 'Al reanudar'], (v) => poner({ via: v }), 'Todas')}
                        {selector('Área', f.area, areas, (v) => poner({ area: v, persona: null }), 'Todas')}
                        <label className="eficiencia-filtro-label">
                            Responsable
                            <select className="eficiencia-filtro-input" value={f.persona || ''} onChange={(e) => poner({ persona: Number(e.target.value) || null })}>
                                <option value="">Todos</option>
                                {personasOpc.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
                            </select>
                        </label>
                        <button className="eficiencia-filtro-clear" onClick={() => { poner(FILTROS_VACIOS); setInicio(''); setFin(''); }}>Limpiar</button>
                    </div>

                    <p className="ie-nota">
                        <b>Solicitud:</b> la aprueba el líder. <b>Directa:</b> se cambió sin pedir aprobación.{' '}
                        <b>Al reanudar:</b> la fecha que se pone al quitar una pausa; no cuenta como aplazamiento.
                    </p>

                    <nav className="ie-pestanas" role="tablist">
                        {PESTANAS.map((p) => (
                            <button key={p.id} role="tab" aria-selected={pestana === p.id}
                                className={pestana === p.id ? 'es-activa' : ''} onClick={() => setPestana(p.id)}>
                                {p.titulo}
                                {p.id === 'personas' && <span className="ie-cuenta">{d.personas.length}</span>}
                                {p.id === 'detalle' && <span className="ie-cuenta">{visibles.length}</span>}
                            </button>
                        ))}
                    </nav>

                    {error && <Vacio>{error}</Vacio>}
                    {!error && filas === null && <Vacio>Cargando…</Vacio>}
                    {listo && visibles.length === 0 && <Vacio>No hay reprogramaciones ni pausas con estos filtros.</Vacio>}

                    {listo && visibles.length > 0 && pestana === 'resumen' && (
                        <>
                            <div className="ie-kpis">
                                <Kpi numero={d.aplazamientos} titulo="Aplazamientos" detalle="Cambios de fecha que se aplicaron" />
                                <Kpi numero={d.directos} titulo="Sin aprobación" tono={d.directos ? 'aviso' : 'ok'}
                                    detalle={d.aplazamientos ? `de ${d.aplazamientos} aplazamientos` : ''} />
                                <Kpi numero={d.pctTarde === null ? '—' : `${d.pctTarde} %`} titulo="Aplazadas ya vencidas" tono={d.tarde ? 'mal' : ''}
                                    detalle={d.conFecha
                                        ? `${d.tarde} de ${d.conFecha} con fecha anterior conocida`
                                        : 'No se conoce la fecha anterior'} />
                                <Kpi numero={d.diasPromedio === null ? '—' : `${coma(d.diasPromedio)} d`} titulo="Días ampliados" detalle="Promedio por aplazamiento" />
                                <Kpi numero={d.pausas} titulo="Pausas" detalle="Aprobadas o directas" />
                                <Kpi numero={d.pendientes.length} titulo="Por resolver" tono={d.pendientes.length ? 'aviso' : 'ok'}
                                    detalle={d.pendientes.length
                                        ? `La más antigua, del ${fecha(d.pendientes[d.pendientes.length - 1].fecha_solicitud)}`
                                        : 'Nada pendiente'} />
                            </div>

                            <div className="ie-graficas">
                                <section className="ie-grafica">
                                    <h3>Aplazamientos por mes</h3>
                                    <p className="ie-sub">Con aprobación y directos.</p>
                                    {d.meses.length === 0 ? <Vacio>Sin aplazamientos.</Vacio> : (
                                        <ResponsiveContainer width="100%" height={220}>
                                            <BarChart data={d.meses} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="mes" tickFormatter={mesTexto} tick={{ fontSize: 12 }} />
                                                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                                <Tooltip labelFormatter={mesTexto} />
                                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                                <Bar dataKey="Aprobadas" stackId="m" fill="#16a34a" maxBarSize={60} />
                                                <Bar dataKey="Directas" stackId="m" fill="#f59e0b" maxBarSize={60} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </section>

                                <section className="ie-grafica">
                                    <h3>Tareas aplazadas más de una vez</h3>
                                    <p className="ie-sub">Suelen esconder una tarea mal definida o bloqueada.</p>
                                    {d.repetidas.length === 0 ? <Vacio>Ninguna.</Vacio> : (
                                        <table className="ie-tabla" data-sin-movil="">
                                            <thead><tr><th>Tarea</th><th>Responsable</th><th className="num">Veces</th></tr></thead>
                                            <tbody>
                                                {d.repetidas.slice(0, 8).map((t) => (
                                                    <tr key={t.id}>
                                                        <td>{t.titulo}</td>
                                                        <td className="ie-nombre">{t.persona.toLowerCase()}</td>
                                                        <td className="num"><b>{t.veces}</b></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </section>
                            </div>
                        </>
                    )}

                    {listo && visibles.length > 0 && pestana === 'personas' && (
                        <div className="ie-tabla-caja">
                            <p className="ie-sub">Pulsa una persona para ver su detalle.</p>
                            <table className="ie-tabla" data-sin-movil="">
                                <thead>
                                    <tr>
                                        <th>Responsable</th><th>Área</th><th className="num">Aplazamientos</th><th className="num">Sin aprobación</th>
                                        <th className="num">Ya vencidas</th><th className="num">Días ampliados</th><th className="num">Pausas</th><th className="num">Por resolver</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {d.personas.map((p) => (
                                        <tr key={p.clave} className={p.id ? 'ie-fila-accion' : ''}
                                            onClick={() => { if (p.id) { poner({ persona: p.id }); setPestana('detalle'); } }}>
                                            <td><b className="ie-nombre">{p.nombre.toLowerCase()}</b></td>
                                            <td>{p.area}</td>
                                            <td className="num">{p.aplazamientos}</td>
                                            <td className="num">{p.directos}</td>
                                            <td className="num"><span className={p.tarde ? 'ie-rojo' : ''}>{p.tarde}</span></td>
                                            <td className="num">{p.dias}</td>
                                            <td className="num">{p.pausas}</td>
                                            <td className="num">{p.pendientes}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {listo && visibles.length > 0 && pestana === 'detalle' && (
                        <div className="ie-tabla-caja">
                            <table className="ie-tabla" data-sin-movil="">
                                <thead>
                                    <tr>
                                        <th>Fecha</th><th>Tarea</th><th>Responsable</th><th>Tipo</th><th>Estado</th>
                                        <th>Cambio</th><th className="num">Días</th><th>Motivo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibles.slice(0, mostrar).map((r) => (
                                        <tr key={r.clave}>
                                            <td>{fecha(r.fecha_solicitud)}</td>
                                            <td>{r.tarea_titulo}</td>
                                            <td>
                                                <span className="ie-nombre">{r.responsable.toLowerCase()}</span>
                                                {r.nombre_solicitante && r.nombre_solicitante.toLowerCase() !== r.responsable.toLowerCase() && (
                                                    <small className="id-cargo">por {r.nombre_solicitante}</small>
                                                )}
                                            </td>
                                            <td>{r.tipo}<small className="id-cargo">{r.via}</small></td>
                                            <td>
                                                <span className="id-nivel" style={{ background: `${COLOR_ESTADO[r.estado] || '#64748b'}1f`, color: COLOR_ESTADO[r.estado] || '#64748b' }}>{r.estado}</span>
                                                {r.nombre_aprobador && <small className="id-cargo">{r.nombre_aprobador}</small>}
                                            </td>
                                            <td>
                                                {r.fecha_actual ? `${fecha(r.fecha_actual)} → ` : ''}{fecha(r.fecha_nueva)}
                                                {r.ya_vencida && <small className="ie-grave"> · ya vencida</small>}
                                            </td>
                                            <td className="num">{diasTexto(r.dias_ampliados)}</td>
                                            <td className="irp-motivo">
                                                {r.motivo || '—'}
                                                {r.observacion_rechazo && <small className="ie-grave"> · Rechazo: {r.observacion_rechazo}</small>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {visibles.length > mostrar && (
                                <button type="button" className="eficiencia-filtro-clear ip-mas" onClick={() => setMostrar((m) => m + POR_PAGINA)}>
                                    Ver más ({visibles.length - mostrar})
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
