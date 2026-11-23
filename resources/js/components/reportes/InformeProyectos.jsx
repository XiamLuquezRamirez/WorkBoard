import React, { useContext, useEffect, useMemo, useState } from 'react';
import { FaTimes, FaFilePdf, FaFileExcel, FaPrint, FaChevronDown } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import axiosInstance from '../../axiosConfig';
import RangosFecha from '../rangosFecha';
import { situacion, SITUACIONES } from './tareasEmpleado';
import { calcularProyectos, calcularCobertura } from './proyectos';
import { AmbitoInforme } from './ambito';
import './ejecutivo.css';

const fecha = (iso) => {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};
const hoyLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const verPct = (v) => (v === null ? '—' : `${v} %`);

/** Todo texto que entra en la ventana de impresión (mismo origen) se escapa. */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

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

function htmlImpresion(proyectos, filtrosTexto) {
    const fila = (t) => `<tr><td>${esc(t.titulo)}</td><td>${esc(t.empleado || 'Sin responsable')}</td><td>${esc(situacion(t))}</td>
        <td>${fecha(t.fecha_pactada)}</td><td>${fecha(t.fecha_entregada)}</td>
        <td class="v">${t.vencida ? `${Number(t.dias_vencida)} d` : ''}</td></tr>`;
    const bloque = (p) => `<h2>${esc(p.nombre)}</h2>
        <p>${esc(p.estado)} · Avance ${verPct(p.avance)} (esperado ${verPct(p.esperado)}) · ${p.total} tareas · ${p.vencidas} vencidas
        · Inicio ${fecha(p.inicio)} · Fin estimado ${fecha(p.fin)}<br>Equipo: ${esc(p.equipo.join(', ') || '—')}</p>
        ${p.tareas.length ? `<table><thead><tr><th>Tarea</th><th>Responsable</th><th>Situación</th><th>Pactada</th><th>Entregada</th><th>Vencida</th></tr></thead>
        <tbody>${p.tareas.map(fila).join('')}</tbody></table>` : ''}`;
    return `<html><head><title>Proyectos</title><style>
        body{font-family:Arial,sans-serif;margin:20px;color:#1f2937}h1{font-size:20px}h2{font-size:15px;margin:22px 0 4px}p{font-size:12px}
        table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:6px;text-align:left}
        th{background:#f3f4f6}tr{break-inside:avoid}.v{color:#b91c1c;font-weight:bold}</style></head><body>
        <h1>Proyectos</h1><p>${filtrosTexto.map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`).join(' · ')}</p>
        ${proyectos.map(bloque).join('')}</body></html>`;
}

/**
 * Proyectos: avance frente a lo que ya debía estar hecho, y cuánto del trabajo
 * está realmente asignado a un proyecto.
 */
export default function InformeProyectos({ onCerrar, onPDF, pdfLoading }) {
    const ambito = useContext(AmbitoInforme);
    const [datos, setDatos] = useState(null);
    const [tareas, setTareas] = useState([]);
    const [error, setError] = useState(false);
    const [proyecto, setProyecto] = useState(null);
    const [estado, setEstado] = useState('');
    const [area, setArea] = useState('');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [ocultarVacios, setOcultarVacios] = useState(true);
    const [abiertos, setAbiertos] = useState({});

    useEffect(() => {
        let vivo = true;
        Promise.all([axiosInstance.get('/informes/proyectos', { params: ambito }), axiosInstance.get('/informes/tareas', { params: ambito })])
            .then(([p, t]) => { if (vivo) { setDatos(p.data); setTareas(t.data); } })
            .catch(() => { if (vivo) setError(true); });
        return () => { vivo = false; };
    }, []);

    const lista = datos || [];
    const hoy = hoyLocal();
    const estados = [...new Set(lista.map((p) => p.estado).filter(Boolean))].sort();
    const areas = [...new Set(lista.flatMap((p) => (p.tareas || []).map((t) => t.departamento || 'Sin departamento')))].sort();
    const proyectos = useMemo(
        () => calcularProyectos(datos || [], { proyecto, estado, area, desde, hasta, ocultarVacios, hoy }),
        [datos, proyecto, estado, area, desde, hasta, ocultarVacios, hoy]
    );
    const cobertura = useMemo(() => calcularCobertura(tareas), [tareas]);
    const conTareas = proyectos.filter((p) => p.total > 0);
    const suma = (f) => conTareas.reduce((s, p) => s + f(p), 0);
    const totalTareas = suma((p) => p.total);
    const vencidas = suma((p) => p.vencidas);
    const avanceGlobal = totalTareas ? Math.round((suma((p) => p.completadas) / totalTareas) * 100) : null;
    const sinFechas = lista.filter((p) => !p.fecha_inicio && !p.fecha_fin_estimada).length;
    const atrasado = (p) => p.avance !== null && p.avance < p.esperado;

    const filtrosTexto = [
        ['Proyecto', lista.find((p) => p.id === proyecto)?.nombre || 'Todos'],
        ['Estado', estado || 'Todos'],
        ['Área', area || 'Todas'],
        ['Fecha pactada', desde || hasta ? `${desde || '…'} a ${hasta || '…'}` : 'Todas'],
        ['Proyectos sin tareas', ocultarVacios ? 'Ocultos' : 'Incluidos'],
        ['Generado', hoy],
    ];

    const limpiar = () => { setProyecto(null); setEstado(''); setArea(''); setDesde(''); setHasta(''); setOcultarVacios(true); };

    const exportarExcel = () => {
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(proyectos.map((p) => ({
            Proyecto: p.nombre, Estado: p.estado, Inicio: p.inicio || '', 'Fin estimado': p.fin || '',
            'Avance (%)': p.avance ?? '', 'Esperado (%)': p.esperado ?? '', ...p.cuenta, Total: p.total,
            'Vencidas hoy': p.vencidas, Equipo: p.equipo.join(', '),
        }))), 'Proyectos');
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(proyectos.flatMap((p) => p.tareas.map((t) => ({
            Proyecto: p.nombre, Tarea: t.titulo, Responsable: t.empleado || 'Sin responsable', Área: t.departamento || 'Sin departamento',
            Situación: situacion(t), 'Fecha pactada': t.fecha_pactada || '', 'Fecha entregada': t.fecha_entregada || '',
            'Días vencida': t.vencida ? t.dias_vencida : '',
        })))), 'Tareas');
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(cobertura.areas.map((a) => ({
            Área: a.area, 'Abiertas sin proyecto': a.sin, 'Abiertas en total': a.abiertas,
        }))), 'Sin proyecto');
        XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filtrosTexto), 'Filtros');
        XLSX.writeFile(libro, `proyectos-${hoy}.xlsx`);
    };

    const imprimir = () => {
        const w = window.open('', '_blank');
        if (!w) {
            window.alert('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio e inténtalo de nuevo.');
            return;
        }
        w.document.write(htmlImpresion(proyectos, filtrosTexto));
        w.document.close();
        w.print();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-report ie">
                <div className="modal-header">
                    <h2>Proyectos</h2>
                    <div className="header-actions">
                        <button className="pdf-button" onClick={exportarExcel} disabled={!proyectos.length}><FaFileExcel /> Excel</button>
                        <button className="pdf-button" onClick={imprimir} disabled={!proyectos.length}><FaPrint /> Imprimir</button>
                        <button className="pdf-button" onClick={() => onPDF('Proyectos')} disabled={pdfLoading}>
                            <FaFilePdf /> {pdfLoading ? '...' : 'PDF'}
                        </button>
                        <button className="close-button" onClick={onCerrar} aria-label="Cerrar"><FaTimes /></button>
                    </div>
                </div>

                <div className="tab-content">
                    <div className="eficiencia-filtros">
                        <label className="eficiencia-filtro-label">
                            Proyecto
                            <select className="eficiencia-filtro-input ipr-proyecto" value={proyecto || ''} onChange={(e) => setProyecto(Number(e.target.value) || null)}>
                                <option value="">Todos</option>
                                {lista.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </label>
                        <label className="eficiencia-filtro-label">
                            Estado
                            <select className="eficiencia-filtro-input" value={estado} onChange={(e) => setEstado(e.target.value)}>
                                <option value="">Todos</option>
                                {estados.map((x) => <option key={x}>{x}</option>)}
                            </select>
                        </label>
                        <label className="eficiencia-filtro-label">
                            Área
                            <select className="eficiencia-filtro-input" value={area} onChange={(e) => setArea(e.target.value)}>
                                <option value="">Todas</option>
                                {areas.map((x) => <option key={x}>{x}</option>)}
                            </select>
                        </label>
                        <RangosFecha startDate={desde} setStartDate={setDesde} endDate={hasta} setEndDate={setHasta} />
                        <label className="it-check">
                            <input type="checkbox" checked={ocultarVacios} onChange={(e) => setOcultarVacios(e.target.checked)} /> Ocultar sin tareas
                        </label>
                        <button className="eficiencia-filtro-clear" onClick={limpiar}>Limpiar</button>
                    </div>

                    {error && <Vacio>No fue posible cargar los proyectos. Cierra el informe e inténtalo de nuevo.</Vacio>}
                    {!error && !datos && <Vacio>Cargando proyectos…</Vacio>}

                    {!error && datos && (
                        <>
                            <div className="ie-kpis">
                                <Kpi numero={conTareas.length} titulo="Proyectos con tareas" detalle={`de ${lista.length} registrados`} />
                                <Kpi numero={verPct(avanceGlobal)} titulo="Avance" detalle={`${suma((p) => p.completadas)} de ${totalTareas} tareas completadas`} />
                                <Kpi numero={vencidas} titulo="Vencidas hoy" tono={vencidas ? 'mal' : 'ok'} detalle="En estos proyectos" />
                                <Kpi
                                    numero={verPct(cobertura.pctAbiertas)}
                                    titulo="Trabajo abierto con proyecto"
                                    detalle={`${cobertura.abiertasCon} de ${cobertura.abiertas} tareas abiertas (sin filtros)`}
                                    tono={cobertura.pctAbiertas !== null && cobertura.pctAbiertas < 50 ? 'mal' : ''}
                                />
                            </div>

                            {cobertura.pctAbiertas !== null && cobertura.pctAbiertas < 50 && (
                                <section className="ipr-aviso">
                                    <b>Este informe cubre poco del trabajo real.</b>{' '}
                                    {cobertura.abiertas - cobertura.abiertasCon} tareas abiertas no están asignadas a ningún proyecto:{' '}
                                    {cobertura.areas.slice(0, 5).map((a) => `${a.area} (${a.sin})`).join(', ')}
                                    {cobertura.areas.length > 5 ? '…' : ''}.
                                    {sinFechas > 0 && ` ${sinFechas} de ${lista.length} proyectos no tienen fechas de inicio ni de fin.`}
                                </section>
                            )}

                            {proyectos.length === 0 ? <Vacio>Ningún proyecto tiene tareas con estos filtros.</Vacio> : (
                                <>
                                    {conTareas.length > 0 && (
                                        <section className="ie-grafica">
                                            <h3>Avance frente a lo esperado</h3>
                                            <p className="ie-sub">Esperado: tareas completadas o cuya fecha pactada ya pasó (las pausadas no cuentan).</p>
                                            <ResponsiveContainer width="100%" height={conTareas.length * 56 + 70}>
                                                <BarChart layout="vertical" data={conTareas} margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v} %`} tick={{ fontSize: 12 }} />
                                                    <YAxis
                                                        type="category" dataKey="id" width={170} tick={{ fontSize: 11 }} interval={0}
                                                        tickFormatter={(id) => {
                                                            const n = conTareas.find((p) => p.id === id)?.nombre || '';
                                                            return n.length > 26 ? `${n.slice(0, 25)}…` : n;
                                                        }}
                                                    />
                                                    <Tooltip
                                                        formatter={(v) => `${v} %`}
                                                        labelFormatter={(id) => conTareas.find((p) => p.id === id)?.nombre || ''}
                                                        contentStyle={{ maxWidth: 300, whiteSpace: 'normal' }}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                                    <Bar dataKey="avance" name="Avance" fill="#16a34a" radius={[0, 4, 4, 0]} />
                                                    <Bar dataKey="esperado" name="Esperado" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </section>
                                    )}

                                    <p className="ie-sub" style={{ marginTop: '1rem' }}>Pulsa un proyecto para ver sus tareas.</p>
                                    <div className="ipr-lista">
                                        {proyectos.map((p) => (
                                            <article key={p.id} className="ipr-item">
                                                <button
                                                    type="button" className="ipr-cab" aria-expanded={Boolean(abiertos[p.id])}
                                                    onClick={() => setAbiertos((v) => ({ ...v, [p.id]: !v[p.id] }))}
                                                >
                                                    <FaChevronDown className={abiertos[p.id] ? 'es-abierta' : ''} aria-hidden="true" />
                                                    <span className="ipr-nombre">
                                                        <b>{p.nombre}</b>
                                                        <small>
                                                            {p.estado} · {p.inicio || p.fin ? `${fecha(p.inicio)} a ${fecha(p.fin)}` : 'sin fechas'}
                                                            {' · '}{p.equipo.length} {p.equipo.length === 1 ? 'persona' : 'personas'}
                                                            {p.finVencido && <span className="ie-grave"> · pasó su fecha de fin</span>}
                                                        </small>
                                                    </span>
                                                    <span className="ipr-cifras">
                                                        <span className={atrasado(p) ? 'ie-rojo' : ''} title="Avance / esperado">
                                                            {verPct(p.avance)} <small className="ie-nulo">de {verPct(p.esperado)} esperado</small>
                                                        </span>
                                                        <span>{p.completadas}/{p.total} tareas</span>
                                                        {p.vencidas > 0 && <span className="ie-rojo">{p.vencidas} {p.vencidas === 1 ? 'vencida' : 'vencidas'}</span>}
                                                    </span>
                                                </button>

                                                {abiertos[p.id] && (
                                                    <div className="ipr-detalle">
                                                        <p className="ie-sub">
                                                            {SITUACIONES.filter((s) => p.cuenta[s]).map((s) => `${s}: ${p.cuenta[s]}`).join(' · ') || 'Sin tareas'}
                                                            {p.equipo.length > 0 && <><br />Equipo: <span className="ie-nombre">{p.equipo.join(', ').toLowerCase()}</span></>}
                                                        </p>
                                                        {p.tareas.length > 0 && (
                                                            <div className="ie-tabla-caja">
                                                                <table className="ie-tabla" data-sin-movil="">
                                                                    <thead>
                                                                        <tr><th>Tarea</th><th>Responsable</th><th>Situación</th><th>Pactada</th><th>Entregada</th></tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {p.tareas.map((t) => (
                                                                            <tr key={t.id}>
                                                                                <td>{t.titulo}</td>
                                                                                <td className="ie-nombre">{(t.empleado || 'Sin responsable').toLowerCase()}</td>
                                                                                <td>{situacion(t)}</td>
                                                                                <td>
                                                                                    {fecha(t.fecha_pactada)}
                                                                                    {t.vencida && <small className="ie-grave"> · {t.dias_vencida} d vencida</small>}
                                                                                </td>
                                                                                <td>
                                                                                    {fecha(t.fecha_entregada)}
                                                                                    {t.a_tiempo === false && <small className="ie-grave"> · tarde</small>}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </article>
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
