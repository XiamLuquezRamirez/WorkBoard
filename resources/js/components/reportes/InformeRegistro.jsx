import React, { useEffect, useMemo, useState } from 'react';
import { FaTimes, FaFilePdf, FaFileExcel } from 'react-icons/fa';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import * as XLSX from 'xlsx';
import axiosInstance from '../../axiosConfig';
import './ejecutivo.css';

/** Desde cuándo no se mueve nada en sus tareas. */
const SITUACION = [
    { id: 'activa', texto: 'Últimos 7 días', color: '#16a34a', es: (d) => d !== null && d <= 7 },
    { id: 'quieta', texto: '8 a 30 días', color: '#f59e0b', es: (d) => d !== null && d > 7 && d <= 30 },
    { id: 'ausente', texto: '31 a 90 días', color: '#ea580c', es: (d) => d !== null && d > 30 && d <= 90 },
    { id: 'abandono', texto: 'Más de 90 días', color: '#b91c1c', es: (d) => d !== null && d > 90 },
    { id: 'nunca', texto: 'Nunca', color: '#64748b', es: (d) => d === null },
];
const situacionDe = (p) => SITUACION.find((s) => s.es(p.dias_sin_actividad));
const SIN_LIDER = 'Sin líder asignado';
const PESTANAS = [{ id: 'personas', titulo: 'Por persona' }, { id: 'lideres', titulo: 'Por líder' }, { id: 'areas', titulo: 'Por área' }];

const fechaCorta = (iso) => {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};
const haceDias = (d) => (d === null ? 'Nunca' : d === 0 ? 'Hoy' : d === 1 ? 'Ayer' : `Hace ${d} días`);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
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

/** Quién no registra: personas sin movimiento en sus tareas, semana a semana. */
export default function InformeRegistro({ onCerrar, onPDF, pdfLoading }) {
    const [semanas, setSemanas] = useState(8);
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(false);
    const [pestana, setPestana] = useState('personas');
    const [area, setArea] = useState('');
    const [lider, setLider] = useState('');
    const [situacion, setSituacion] = useState('');

    useEffect(() => {
        let vivo = true;
        setError(false);
        axiosInstance.get('/informes/registro', { params: { semanas } })
            .then((r) => { if (vivo) setDatos(r.data); })
            .catch(() => { if (vivo) setError(true); });
        return () => { vivo = false; };
    }, [semanas]);

    const todas = datos?.personas || [];
    const lideresDe = (p) => (p.lideres.length ? p.lideres : [SIN_LIDER]);
    const areas = [...new Set(todas.map((p) => p.departamento))].sort((a, b) => a.localeCompare(b));
    const lideres = [...new Set(todas.flatMap(lideresDe))].sort((a, b) => a.localeCompare(b));
    const base = useMemo(
        () => todas.filter((p) => (!area || p.departamento === area) && (!lider || lideresDe(p).includes(lider))),
        [datos, area, lider] // eslint-disable-line
    );
    const visibles = base
        .filter((p) => !situacion || situacionDe(p).id === situacion)
        .sort((a, b) => (b.dias_sin_actividad ?? 1e6) - (a.dias_sin_actividad ?? 1e6) || a.nombre.localeCompare(b.nombre));

    const activas = base.filter((p) => p.dias_sin_actividad !== null && p.dias_sin_actividad <= 7).length;
    const mas30 = base.filter((p) => p.dias_sin_actividad === null || p.dias_sin_actividad > 30).length;
    const conTrabajo = base.filter((p) => p.abiertas > 0 && (p.dias_sin_actividad === null || p.dias_sin_actividad > 7));
    const sinTareas = base.filter((p) => p.abiertas === 0).length;
    const sinLider = base.filter((p) => p.lideres.length === 0).length;
    const distribucion = SITUACION.map((s) => ({ ...s, personas: base.filter((p) => situacionDe(p).id === s.id).length }));

    const agrupar = (claves) => {
        const g = {};
        base.forEach((p) => claves(p).forEach((c) => {
            g[c] ??= { nombre: c, personas: 0, activas: 0, quietas: 0, sinTareas: 0, vencidas: 0 };
            g[c].personas += 1;
            g[c].vencidas += p.vencidas;
            if (p.abiertas === 0) g[c].sinTareas += 1;
            if (p.dias_sin_actividad !== null && p.dias_sin_actividad <= 7) g[c].activas += 1;
            if (p.dias_sin_actividad === null || p.dias_sin_actividad > 30) g[c].quietas += 1;
        }));
        return Object.values(g).map((x) => ({ ...x, pct: pct(x.activas, x.personas) }))
            .sort((a, b) => a.pct - b.pct || b.personas - a.personas || a.nombre.localeCompare(b.nombre));
    };
    const grupos = pestana === 'lideres' ? agrupar(lideresDe) : agrupar((p) => [p.departamento]);

    const exportarExcel = () => {
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(visibles.map((p) => ({
            Persona: p.nombre, Cargo: p.cargo || '', Área: p.departamento, Líderes: p.lideres.join(', ') || SIN_LIDER,
            'Último movimiento': p.ultima_actividad || 'Nunca', 'Días sin movimiento': p.dias_sin_actividad ?? '',
            'Semanas cerradas sin registrar': p.semanas_sin_registrar, 'de': p.semanas_cerradas, Abiertas: p.abiertas, Vencidas: p.vencidas,
            ...Object.fromEntries(datos.semanas.map((s, i) => [`Semana ${s}`, p.semanas[i].movio ? 'Sí' : 'No'])),
        }))), 'Por persona');
        const hoja = (l) => XLSX.utils.json_to_sheet(l.map((g) => ({
            Grupo: g.nombre, Personas: g.personas, 'Activas (7 días)': g.activas, '%': g.pct,
            'Más de 30 días o nunca': g.quietas, 'Sin tareas abiertas': g.sinTareas, Vencidas: g.vencidas,
        })));
        XLSX.utils.book_append_sheet(libro, hoja(agrupar(lideresDe)), 'Por líder');
        XLSX.utils.book_append_sheet(libro, hoja(agrupar((p) => [p.departamento])), 'Por área');
        XLSX.writeFile(libro, `quien-no-registra-${datos.hoy}.xlsx`);
    };

    const selector = (texto, valor, opciones, alCambiar, vacio) => (
        <label className="eficiencia-filtro-label">
            {texto}
            <select className="eficiencia-filtro-input" value={valor} onChange={(e) => alCambiar(e.target.value)}>
                <option value="">{vacio}</option>
                {opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
        </label>
    );

    return (
        <div className="modal-overlay">
            <div className="modal-report ie">
                <div className="modal-header">
                    <h2>Quién no registra</h2>
                    <div className="header-actions">
                        <button className="pdf-button" onClick={exportarExcel} disabled={!visibles.length}><FaFileExcel /> Excel</button>
                        <button className="pdf-button" onClick={() => onPDF('Quién no registra')} disabled={pdfLoading}>
                            <FaFilePdf /> {pdfLoading ? '...' : 'PDF'}
                        </button>
                        <button className="close-button" onClick={onCerrar} aria-label="Cerrar"><FaTimes /></button>
                    </div>
                </div>

                <div className="tab-content">
                    <div className="eficiencia-filtros">
                        <label className="eficiencia-filtro-label">
                            Semanas
                            <select className="eficiencia-filtro-input" value={semanas} onChange={(e) => setSemanas(Number(e.target.value))}>
                                {[4, 8, 12, 26].map((n) => <option key={n} value={n}>Últimas {n}</option>)}
                            </select>
                        </label>
                        {selector('Área', area, areas.map((a) => [a, a]), setArea, 'Todas')}
                        {selector('Líder', lider, lideres.map((l) => [l, l]), setLider, 'Todos')}
                        {selector('Sin movimiento', situacion, SITUACION.map((s) => [s.id, s.texto]), setSituacion, 'Todos')}
                        <button className="eficiencia-filtro-clear" onClick={() => { setArea(''); setLider(''); setSituacion(''); }}>Limpiar</button>
                    </div>

                    <p className="ie-nota">
                        <b>Movimiento:</b> crear, entregar, comentar, cambiar de estado o reprogramar una tarea suya; los recordatorios
                        automáticos no cuentan. Parte puede haberla hecho su líder. No distingue vacaciones ni incapacidades.
                    </p>

                    {error && <Vacio>No fue posible cargar el informe. Ciérralo e inténtalo de nuevo.</Vacio>}
                    {!error && !datos && <Vacio>Cargando…</Vacio>}
                    {!error && datos && todas.length === 0 && <Vacio>No hay personas en tu alcance.</Vacio>}

                    {!error && datos && todas.length > 0 && (
                        <>
                            <div className="ie-kpis">
                                <Kpi numero={`${activas} / ${base.length}`} titulo="Movieron algo en 7 días"
                                    tono={activas / Math.max(1, base.length) < 0.5 ? 'mal' : 'ok'} detalle={`${pct(activas, base.length) ?? 0} % de las personas`} />
                                <Kpi numero={mas30} titulo="Más de 30 días o nunca" tono={mas30 ? 'mal' : 'ok'} detalle="Dejaron de usar la plataforma" />
                                <Kpi numero={conTrabajo.length} titulo="Con tareas y sin moverlas" tono={conTrabajo.length ? 'aviso' : 'ok'}
                                    detalle={`${conTrabajo.reduce((s, p) => s + p.abiertas, 0)} tareas abiertas detenidas`} />
                                <Kpi numero={sinTareas} titulo="Sin tareas abiertas" tono={sinTareas ? 'aviso' : 'ok'} detalle="Nadie les asigna o no las suben" />
                                <Kpi numero={sinLider} titulo="Sin líder asignado" tono={sinLider ? 'aviso' : 'ok'} detalle="Nadie les hace seguimiento" />
                            </div>

                            <section className="ie-grafica">
                                <h3>¿Desde cuándo no hay movimiento?</h3>
                                <p className="ie-sub">Personas, según su último movimiento.</p>
                                <ResponsiveContainer width="100%" height={210}>
                                    <BarChart data={distribucion} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 0 }}>
                                        <XAxis type="number" allowDecimals={false} hide />
                                        <YAxis type="category" dataKey="texto" width={110} tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(v) => [v, 'Personas']} />
                                        <Bar dataKey="personas" radius={[0, 4, 4, 0]}>
                                            {distribucion.map((d) => <Cell key={d.id} fill={d.color} />)}
                                            <LabelList dataKey="personas" position="right" style={{ fontSize: 12, fill: '#334155' }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </section>

                            <nav className="ie-pestanas" role="tablist" style={{ marginTop: '1rem' }}>
                                {PESTANAS.map((p) => (
                                    <button key={p.id} role="tab" aria-selected={pestana === p.id}
                                        className={pestana === p.id ? 'es-activa' : ''} onClick={() => setPestana(p.id)}>{p.titulo}</button>
                                ))}
                            </nav>

                            {pestana === 'personas' && (visibles.length === 0 ? <Vacio>Nadie coincide con estos filtros.</Vacio> : (
                                <div className="ie-tabla-caja">
                                    <p className="ie-sub">
                                        Cada cuadro es una semana: verde, hubo movimiento; rojo, no; con borde, la semana en curso.
                                    </p>
                                    <table className="ie-tabla" data-sin-movil="">
                                        <thead>
                                            <tr>
                                                <th>Persona</th><th>Líder</th><th>Último movimiento</th><th>Semanas</th>
                                                <th className="num">Sin registrar</th><th className="num">Abiertas</th><th className="num">Vencidas</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibles.map((p) => {
                                                const s = situacionDe(p);
                                                return (
                                                    <tr key={p.id}>
                                                        <td><b className="ie-nombre">{p.nombre.toLowerCase()}</b><small className="id-cargo">{p.departamento}</small></td>
                                                        <td className={p.lideres.length ? 'ie-nombre' : 'ie-nulo'}>{p.lideres.join(', ').toLowerCase() || SIN_LIDER}</td>
                                                        <td><span className="id-nivel" style={{ background: `${s.color}1f`, color: s.color }}>{haceDias(p.dias_sin_actividad)}</span></td>
                                                        <td>
                                                            <span className="ir-semanas">
                                                                {p.semanas.map((x, i) => (
                                                                    <span
                                                                        key={datos.semanas[i]}
                                                                        className={`ir-semana ${x.movio ? 'si' : 'no'} ${datos.semanas[i] === datos.semana_actual ? 'actual' : ''}`}
                                                                        title={`Semana del ${fechaCorta(datos.semanas[i])}: ${x.movio ? `${x.creadas} creadas, ${x.entregadas} entregadas` : 'sin movimiento'}`}
                                                                    />
                                                                ))}
                                                            </span>
                                                        </td>
                                                        <td className="num">{p.semanas_sin_registrar} de {p.semanas_cerradas}</td>
                                                        <td className="num">{p.abiertas}</td>
                                                        <td className="num"><span className={p.vencidas ? 'ie-rojo' : ''}>{p.vencidas}</span></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ))}

                            {pestana !== 'personas' && (
                                <div className="ie-tabla-caja">
                                    {pestana === 'lideres' && <p className="ie-sub">Quien tiene varios líderes cuenta con cada uno.</p>}
                                    <table className="ie-tabla" data-sin-movil="">
                                        <thead>
                                            <tr>
                                                <th>{pestana === 'lideres' ? 'Líder' : 'Área'}</th><th className="num">Personas</th><th className="num">Activas (7 días)</th>
                                                <th className="num">+30 días o nunca</th><th className="num">Sin tareas</th><th className="num">Vencidas</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {grupos.map((g) => (
                                                <tr key={g.nombre} className="ie-fila-accion" onClick={() => {
                                                    if (pestana === 'lideres') setLider(g.nombre); else setArea(g.nombre);
                                                    setPestana('personas');
                                                }}>
                                                    <td><b className={pestana === 'lideres' && g.nombre !== SIN_LIDER ? 'ie-nombre' : ''}>
                                                        {pestana === 'lideres' && g.nombre !== SIN_LIDER ? g.nombre.toLowerCase() : g.nombre}
                                                    </b></td>
                                                    <td className="num">{g.personas}</td>
                                                    <td className="num"><span className={g.pct < 50 ? 'ie-rojo' : ''}>{g.activas} ({g.pct} %)</span></td>
                                                    <td className="num">{g.quietas}</td>
                                                    <td className="num">{g.sinTareas}</td>
                                                    <td className="num">{g.vencidas}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
