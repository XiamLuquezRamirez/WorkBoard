import React, { useEffect, useMemo, useState } from 'react';
import { FaTimes, FaFilePdf, FaFileExcel, FaInfoCircle } from 'react-icons/fa';
import {
    BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import * as XLSX from 'xlsx';
import axiosInstance from '../../axiosConfig';
import ExplicacionIndice from '../dashboard/ExplicacionIndice';
import './ejecutivo.css';

/**
 * Informe de Desempeño: el Índice de Desempeño de cada persona, con el mismo
 * cálculo que el dashboard (/api/informes/desempeno) y un periodo a elegir.
 * Reemplaza a «Eficiencia Operativa», que usaba otra fórmula (40/30/30 sobre
 * todo el historial) y regalaba puntos a quien no entregaba nada.
 */

const VENTANAS = [
    { dias: 30, texto: 'Últimos 30 días' },
    { dias: 90, texto: 'Últimos 90 días (como el dashboard)' },
    { dias: 180, texto: 'Últimos 6 meses' },
    { dias: 365, texto: 'Último año' },
];

const NIVELES = {
    alto:            { texto: 'Alto',          color: '#16a34a', orden: 0 },
    medio:           { texto: 'Medio',         color: '#f59e0b', orden: 1 },
    bajo:            { texto: 'Bajo',          color: '#dc2626', orden: 2 },
    'en-curso':      { texto: 'En curso',      color: '#2563eb', orden: 3 },
    'sin-actividad': { texto: 'Sin actividad', color: '#94a3b8', orden: 4 },
    'sin-datos':     { texto: 'Sin datos',     color: '#cbd5e1', orden: 5 },
};

const FACTORES = [
    { id: 'completitud', corto: 'Compl.' },
    { id: 'puntualidad', corto: 'Puntual.' },
    { id: 'vigencia', corto: 'Al día' },
    { id: 'calidad', corto: 'Calidad' },
];

const ORDENES = {
    indice: { texto: 'Índice más bajo primero', fn: (a, b) => (a.i.indice ?? 101) - (b.i.indice ?? 101) },
    vencidas: { texto: 'Más vencidas primero', fn: (a, b) => b.i.vencidas - a.i.vencidas || b.i.vencidas_graves - a.i.vencidas_graves },
    quieto: { texto: 'Más tiempo sin moverse', fn: (a, b) => (b.i.dias_sin_actividad ?? 9999) - (a.i.dias_sin_actividad ?? 9999) },
    nombre: { texto: 'Nombre', fn: (a, b) => a.nombre.localeCompare(b.nombre) },
};

const nivelDeIndice = (v) => (v >= 75 ? 'alto' : v >= 50 ? 'medio' : 'bajo');

const haceDias = (d) => {
    if (d === null || d === undefined) return 'Nunca';
    if (d === 0) return 'Hoy';
    if (d === 1) return 'Ayer';
    return `Hace ${d} días`;
};

function Vacio({ children }) {
    return <p className="ie-vacio">{children}</p>;
}

function Kpi({ numero, titulo, detalle, tono = '' }) {
    return (
        <div className={`ie-kpi ${tono ? `ie-kpi--${tono}` : ''}`}>
            <span className="ie-kpi-num">{numero}</span>
            <span className="ie-kpi-tit">{titulo}</span>
            {detalle && <span className="ie-kpi-det">{detalle}</span>}
        </div>
    );
}

export default function InformeDesempeno({ onCerrar, onPDF, pdfLoading }) {
    const [ventana, setVentana] = useState(90);
    const [datos, setDatos] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(false);
    const [area, setArea] = useState('');
    const [nivel, setNivel] = useState('');
    const [buscar, setBuscar] = useState('');
    const [orden, setOrden] = useState('indice');
    const [explicar, setExplicar] = useState(null);

    useEffect(() => {
        let vivo = true;
        setCargando(true);
        setError(false);
        axiosInstance.get('/informes/desempeno', { params: { ventana } })
            .then((r) => { if (vivo) setDatos(r.data); })
            .catch(() => { if (vivo) setError(true); })
            .finally(() => { if (vivo) setCargando(false); });
        return () => { vivo = false; };
    }, [ventana]);

    const todas = useMemo(
        () => (datos?.personas || []).map((p) => ({ ...p, i: p.indicadores || {} })),
        [datos]
    );
    const areas = useMemo(() => [...new Set(todas.map((p) => p.departamento))].sort((a, b) => a.localeCompare(b)), [todas]);

    const personas = useMemo(() => {
        const q = buscar.trim().toLowerCase();
        return todas
            .filter((p) => (!area || p.departamento === area)
                && (!nivel || p.i.nivel === nivel)
                && (!q || p.nombre.toLowerCase().includes(q) || (p.cargo || '').toLowerCase().includes(q)))
            .sort(ORDENES[orden].fn);
    }, [todas, area, nivel, buscar, orden]);

    // Indicadores sobre la vista filtrada por área (no por nivel ni búsqueda,
    // que son para encontrar personas).
    const base = useMemo(() => todas.filter((p) => !area || p.departamento === area), [todas, area]);
    const conNota = base.filter((p) => p.i.indice !== null && p.i.indice !== undefined);
    const promedio = conNota.length ? Math.round(conNota.reduce((s, p) => s + p.i.indice, 0) / conNota.length) : null;
    const atencion = base.filter((p) => (p.i.atencion || []).length > 0).length;
    const quietas = base.filter((p) => (p.i.atencion || []).includes('sin-movimiento')).length;
    const graves = base.reduce((s, p) => s + (p.i.vencidas_graves || 0), 0);

    const distribucion = Object.entries(NIVELES).map(([id, n]) => ({
        id, nivel: n.texto, color: n.color, personas: base.filter((p) => p.i.nivel === id).length,
    })).filter((d) => d.personas > 0);

    const porArea = areas
        .map((a) => {
            const deArea = todas.filter((p) => p.departamento === a);
            const evaluadas = deArea.filter((p) => p.i.indice !== null && p.i.indice !== undefined);
            return {
                area: a,
                indice: evaluadas.length ? Math.round(evaluadas.reduce((s, p) => s + p.i.indice, 0) / evaluadas.length) : null,
                evaluadas: evaluadas.length,
                total: deArea.length,
            };
        })
        .filter((a) => a.indice !== null)
        .sort((a, b) => a.indice - b.indice);

    const exportarExcel = () => {
        const filas = personas.map((p) => {
            const d = Object.fromEntries((p.i.desglose || []).map((f) => [f.factor, f]));
            return {
                Persona: p.nombre,
                Cargo: p.cargo || '',
                Área: p.departamento,
                'Índice': p.i.indice ?? '',
                Nivel: NIVELES[p.i.nivel]?.texto || '',
                'Completitud (de 40)': d.completitud?.puntos ?? '',
                'Puntualidad (de 25)': d.puntualidad?.puntos ?? '',
                'Al día (de 20)': d.vigencia?.puntos ?? '',
                'Calidad (de 15)': d.calidad?.puntos ?? '',
                Completadas: p.i.completadas,
                'A tiempo': p.i.a_tiempo,
                Reprocesos: p.i.reprocesos,
                'Vencidas hoy': p.i.vencidas,
                'Vencidas +7 días': p.i.vencidas_graves,
                'Último movimiento': haceDias(p.i.dias_sin_actividad),
                Mensaje: p.i.mensaje,
            };
        });
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), 'Desempeño');
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(
            porArea.map((a) => ({ Área: a.area, 'Índice promedio': a.indice, 'Personas evaluadas': a.evaluadas, Personas: a.total }))
        ), 'Por área');
        XLSX.writeFile(libro, `desempeno-${ventana}-dias-${datos?.hoy || ''}.xlsx`);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-report ie">
                <div className="modal-header">
                    <h2>Desempeño</h2>
                    <div className="header-actions">
                        <button className="pdf-button" onClick={exportarExcel} disabled={cargando || !personas.length}>
                            <FaFileExcel /> Excel
                        </button>
                        <button className="pdf-button" onClick={() => onPDF('Desempeño')} disabled={pdfLoading}>
                            <FaFilePdf /> {pdfLoading ? '...' : 'PDF'}
                        </button>
                        <button className="close-button" onClick={onCerrar} aria-label="Cerrar"><FaTimes /></button>
                    </div>
                </div>

                <div className="tab-content">
                    <div className="eficiencia-filtros">
                        <label className="eficiencia-filtro-label">
                            Periodo
                            <select className="eficiencia-filtro-input" value={ventana} onChange={(e) => setVentana(Number(e.target.value))}>
                                {VENTANAS.map((v) => <option key={v.dias} value={v.dias}>{v.texto}</option>)}
                            </select>
                        </label>
                        <label className="eficiencia-filtro-label">
                            Área
                            <select className="eficiencia-filtro-input" value={area} onChange={(e) => setArea(e.target.value)}>
                                <option value="">Todas</option>
                                {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </label>
                        <label className="eficiencia-filtro-label">
                            Nivel
                            <select className="eficiencia-filtro-input" value={nivel} onChange={(e) => setNivel(e.target.value)}>
                                <option value="">Todos</option>
                                {Object.entries(NIVELES).map(([id, n]) => <option key={id} value={id}>{n.texto}</option>)}
                            </select>
                        </label>
                        <label className="eficiencia-filtro-label">
                            Buscar
                            <input className="eficiencia-filtro-input" type="search" placeholder="Nombre o cargo" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
                        </label>
                        <button className="eficiencia-filtro-clear" onClick={() => { setArea(''); setNivel(''); setBuscar(''); }}>Limpiar</button>
                    </div>

                    <p className="ie-nota">
                        Es el mismo <b>Índice de Desempeño</b> del dashboard: completitud 40, puntualidad 25, al día 20 y
                        calidad 15, sobre lo entregado en el periodo y lo vencido hoy.{' '}
                        <button type="button" className="ei-ayuda-texto" onClick={() => setExplicar({})}>
                            ¿Cómo se calcula?
                        </button>
                    </p>

                    {error && <Vacio>No fue posible cargar el desempeño. Cierra el informe e inténtalo de nuevo.</Vacio>}
                    {!error && cargando && <Vacio>Calculando el desempeño…</Vacio>}
                    {!error && !cargando && todas.length === 0 && <Vacio>No hay personas en tu alcance.</Vacio>}

                    {!error && !cargando && todas.length > 0 && (
                        <>
                            <div className="ie-kpis">
                                <Kpi
                                    numero={promedio === null ? '—' : `${promedio} %`}
                                    titulo="Índice promedio"
                                    detalle={`${conNota.length} de ${base.length} personas con nota`}
                                    tono={promedio === null ? '' : promedio >= 75 ? 'ok' : promedio >= 50 ? 'aviso' : 'mal'}
                                />
                                <Kpi
                                    numero={atencion}
                                    titulo="Necesitan atención"
                                    detalle="Vencidas de +7 días, sin movimiento o sin tareas"
                                    tono={atencion > 0 ? 'mal' : 'ok'}
                                />
                                <Kpi
                                    numero={quietas}
                                    titulo="Sin movimiento en 7 días"
                                    detalle="Tienen tareas pero no registran nada"
                                    tono={quietas > 0 ? 'aviso' : 'ok'}
                                />
                                <Kpi
                                    numero={graves}
                                    titulo="Vencidas hace +7 días"
                                    detalle="Suma de todas las personas"
                                    tono={graves > 0 ? 'mal' : 'ok'}
                                />
                            </div>

                            <div className="ie-graficas">
                                <section className="ie-grafica">
                                    <h3>Personas por nivel</h3>
                                    <p className="ie-sub">Alto 75 o más · Medio 50 a 74 · Bajo menos de 50.</p>
                                    <ResponsiveContainer width="100%" height={Math.max(150, distribucion.length * 36 + 30)}>
                                        <BarChart data={distribucion} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 0 }}>
                                            <XAxis type="number" allowDecimals={false} hide />
                                            <YAxis type="category" dataKey="nivel" width={100} tick={{ fontSize: 12 }} />
                                            <Tooltip formatter={(v) => [`${v} personas`, 'Personas']} />
                                            <Bar dataKey="personas" radius={[0, 4, 4, 0]}>
                                                {distribucion.map((d) => <Cell key={d.id} fill={d.color} />)}
                                                <LabelList dataKey="personas" position="right" style={{ fontSize: 12, fill: '#334155' }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </section>

                                <section className="ie-grafica">
                                    <h3>Índice promedio por área</h3>
                                    <p className="ie-sub">Solo personas con nota; las áreas más bajas, arriba.</p>
                                    {porArea.length === 0 ? <Vacio>Ninguna área tiene personas con nota.</Vacio> : (
                                        <ResponsiveContainer width="100%" height={Math.max(150, porArea.length * 34 + 30)}>
                                            <BarChart data={porArea} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                                                <YAxis type="category" dataKey="area" width={130} tick={{ fontSize: 12 }} />
                                                <Tooltip formatter={(v, _n, item) => [`${v} % (${item.payload.evaluadas} con nota)`, 'Índice promedio']} />
                                                <Bar dataKey="indice" radius={[0, 4, 4, 0]}>
                                                    {porArea.map((a) => <Cell key={a.area} fill={NIVELES[nivelDeIndice(a.indice)].color} />)}
                                                    <LabelList dataKey="indice" position="right" formatter={(v) => `${v} %`} style={{ fontSize: 12, fill: '#334155' }} />
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </section>
                            </div>

                            <div className="ie-tabla-caja" style={{ marginTop: '1rem' }}>
                                <div className="ie-tabla-cab">
                                    <p className="ie-sub">{personas.length} personas · pulsa una para ver cómo se calculó su nota.</p>
                                    <label className="ie-orden">
                                        Ordenar
                                        <select value={orden} onChange={(e) => setOrden(e.target.value)}>
                                            {Object.entries(ORDENES).map(([id, o]) => <option key={id} value={id}>{o.texto}</option>)}
                                        </select>
                                    </label>
                                </div>
                                {personas.length === 0 ? <Vacio>Nadie coincide con estos filtros.</Vacio> : (
                                    <table className="ie-tabla">
                                        <thead>
                                            <tr>
                                                <th>Persona</th>
                                                <th>Área</th>
                                                <th>Índice</th>
                                                {FACTORES.map((f) => <th key={f.id} className="num">{f.corto}</th>)}
                                                <th className="num">Vencidas</th>
                                                <th>Último movimiento</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {personas.map((p) => {
                                                const n = NIVELES[p.i.nivel] || NIVELES['sin-datos'];
                                                const d = Object.fromEntries((p.i.desglose || []).map((f) => [f.factor, f]));
                                                return (
                                                    <tr key={p.id} className="ie-fila-accion" onClick={() => setExplicar(p)}>
                                                        <td>
                                                            <b className="ie-nombre">{p.nombre.toLowerCase()}</b>
                                                            {p.cargo && <small className="id-cargo">{p.cargo}</small>}
                                                        </td>
                                                        <td>{p.departamento}</td>
                                                        <td>
                                                            <span className="id-indice">
                                                                {p.i.indice !== null && p.i.indice !== undefined && (
                                                                    <span className="ie-pct-barra"><span style={{ width: `${p.i.indice}%`, background: n.color }} /></span>
                                                                )}
                                                                <b style={{ color: n.color }}>{p.i.indice ?? '—'}</b>
                                                                <span className="id-nivel" style={{ background: `${n.color}22`, color: n.color }}>{n.texto}</span>
                                                                <FaInfoCircle className="id-info" aria-hidden="true" />
                                                            </span>
                                                        </td>
                                                        {FACTORES.map((f) => (
                                                            <td key={f.id} className="num" title={d[f.id] ? `${d[f.id].parte} de ${d[f.id].de}` : ''}>
                                                                {d[f.id] ? <>{String(d[f.id].puntos).replace('.', ',')}<small className="ie-nulo">/{d[f.id].peso}</small></> : <span className="ie-nulo">—</span>}
                                                            </td>
                                                        ))}
                                                        <td className="num">
                                                            <span className={p.i.vencidas ? 'ie-rojo' : ''}>{p.i.vencidas}</span>
                                                            {p.i.vencidas_graves > 0 && <small className="ie-grave"> ({p.i.vencidas_graves} +7d)</small>}
                                                        </td>
                                                        <td className={(p.i.atencion || []).includes('sin-movimiento') ? 'ie-rojo' : ''}>
                                                            {haceDias(p.i.dias_sin_actividad)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {explicar && (
                <ExplicacionIndice
                    nombre={explicar.nombre}
                    indicadores={explicar.i}
                    onCerrar={() => setExplicar(null)}
                />
            )}
        </div>
    );
}
