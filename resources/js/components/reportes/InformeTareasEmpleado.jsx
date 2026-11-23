import React, { useMemo, useState } from 'react';
import { FaTimes, FaFilePdf, FaFileExcel, FaPrint, FaChevronDown } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { opcionesEjecutivo } from './ejecutivo';
import { agruparPorPersona, totales, situacion, SITUACIONES, FILTROS_VACIOS } from './tareasEmpleado';
import './ejecutivo.css';

const COLOR = {
    Pendiente: '#f97316',
    'En Proceso': '#2563eb',
    'En Revisión': '#0d9488',
    'En pausa': '#94a3b8',
    Completada: '#16a34a',
};
const EN_GRAFICA = 12;

const fecha = (iso) => {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

const hoy = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Todo texto que entra en la ventana de impresión (mismo origen) se escapa. */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const Vacio = ({ children }) => <p className="ie-vacio">{children}</p>;

/** HTML de la ventana de impresión. */
function htmlImpresion(grupos, total, filtrosTexto) {
    const celdas = (g) => `${SITUACIONES.map((s) => `<td>${g.cuenta[s] || 0}</td>`).join('')}<td><b>${g.total}</b></td><td>${g.vencidas}</td>`;
    const fila = (t) => `<tr><td>${esc(t.titulo)}</td><td>${esc(situacion(t))}</td><td>${esc(t.prioridad || '—')}</td>
        <td>${fecha(t.fecha_pactada)}</td><td>${fecha(t.fecha_entregada)}</td>
        <td class="v">${t.vencida ? `${Number(t.dias_vencida)} d` : ''}</td></tr>`;
    const detalle = (g) => `<h2>${esc(g.nombre)} (${g.total})</h2><table><thead><tr><th>Tarea</th><th>Situación</th>
        <th>Prioridad</th><th>Pactada</th><th>Entregada</th><th>Vencida</th></tr></thead>
        <tbody>${g.tareas.map(fila).join('')}</tbody></table>`;

    return `<html><head><title>Tareas por empleado</title><style>
        body{font-family:Arial,sans-serif;margin:20px;color:#1f2937}h1{font-size:20px}h2{font-size:15px;margin-top:24px}
        table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:6px;text-align:left}
        th{background:#f3f4f6}tr{break-inside:avoid}.v{color:#b91c1c;font-weight:bold}</style></head><body>
        <h1>Tareas por empleado</h1>
        <p>${filtrosTexto.map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`).join(' · ')}</p>
        <table><thead><tr><th>Persona</th>${SITUACIONES.map((s) => `<th>${s}</th>`).join('')}<th>Total</th><th>Vencidas</th></tr></thead>
        <tbody>${grupos.map((g) => `<tr><td>${esc(g.nombre)}</td>${celdas(g)}</tr>`).join('')}
        <tr><td><b>Total</b></td>${celdas(total)}</tr></tbody></table>
        ${grupos.map(detalle).join('')}</body></html>`;
}

/** El detalle de las tareas de cada persona. Se monta al abrirlo: los filtros empiezan limpios. */
export default function InformeTareasEmpleado({ tareas, cargando, error, onCerrar, onPDF, pdfLoading }) {
    const [f, setF] = useState(FILTROS_VACIOS);
    const [abiertos, setAbiertos] = useState({});
    const poner = (cambios) => setF((v) => ({ ...v, ...cambios }));

    const opciones = useMemo(() => opcionesEjecutivo(tareas, f.area), [tareas, f.area]);
    const grupos = useMemo(() => agruparPorPersona(tareas, f), [tareas, f]);
    const total = useMemo(() => totales(grupos), [grupos]);
    const todosAbiertos = grupos.length > 0 && grupos.every((g) => abiertos[g.clave]);
    const hayDatos = !error && !cargando && tareas.length > 0;

    const abrirTodos = (si) => setAbiertos(si ? Object.fromEntries(grupos.map((g) => [g.clave, true])) : {});

    const filtrosTexto = [
        ['Área', f.area || 'Todas'],
        ['Persona', opciones.personas.find((p) => p.id === f.persona)?.nombre || 'Todas'],
        ['Situación', f.situacion || 'Todas'],
        ['Fecha pactada', f.desde || f.hasta ? `${f.desde || '…'} a ${f.hasta || '…'}` : 'Todas'],
        ['Solo vencidas', f.vencidas ? 'Sí' : 'No'],
        ['Título contiene', f.buscar || '—'],
        ['Generado', hoy()],
    ];

    const exportarExcel = () => {
        const libro = XLSX.utils.book_new();
        const fila = (g) => ({ ...g.cuenta, Total: g.total, 'Vencidas hoy': g.vencidas });
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet([
            ...grupos.map((g) => ({ Persona: g.nombre, Área: g.area, ...fila(g) })),
            { Persona: 'TOTAL', Área: '', ...fila(total) },
        ]), 'Resumen');
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(grupos.flatMap((g) => g.tareas.map((t) => ({
            Persona: g.nombre, Área: g.area, Tarea: t.titulo, Situación: situacion(t), Prioridad: t.prioridad || '',
            'Fecha pactada': t.fecha_pactada || '', 'Fecha entregada': t.fecha_entregada || '',
            'Días vencida': t.vencida ? t.dias_vencida : '',
            'A tiempo': t.a_tiempo === null ? '' : t.a_tiempo ? 'Sí' : 'No',
        })))), 'Detalle');
        XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filtrosTexto), 'Filtros');
        XLSX.writeFile(libro, `tareas-por-empleado-${hoy()}.xlsx`);
    };

    const imprimir = () => {
        const w = window.open('', '_blank');
        if (!w) {
            window.alert('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio e inténtalo de nuevo.');
            return;
        }
        w.document.write(htmlImpresion(grupos, total, filtrosTexto));
        w.document.close();
        w.print();
    };

    const campo = (texto, control) => <label className="eficiencia-filtro-label">{texto}{control}</label>;

    return (
        <div className="modal-overlay">
            <div className="modal-report ie">
                <div className="modal-header">
                    <h2>Tareas por empleado</h2>
                    <div className="header-actions">
                        <button className="pdf-button" onClick={exportarExcel} disabled={!grupos.length}><FaFileExcel /> Excel</button>
                        <button className="pdf-button" onClick={imprimir} disabled={!grupos.length}><FaPrint /> Imprimir</button>
                        <button className="pdf-button" onClick={() => onPDF('Tareas por empleado')} disabled={pdfLoading}>
                            <FaFilePdf /> {pdfLoading ? '...' : 'PDF'}
                        </button>
                        <button className="close-button" onClick={onCerrar} aria-label="Cerrar"><FaTimes /></button>
                    </div>
                </div>

                <div className="tab-content">
                    <div className="eficiencia-filtros">
                        {campo('Área', (
                            <select className="eficiencia-filtro-input" value={f.area} onChange={(e) => poner({ area: e.target.value, persona: null })}>
                                <option value="">Todas</option>
                                {opciones.areas.map((a) => <option key={a}>{a}</option>)}
                            </select>
                        ))}
                        {campo('Persona', (
                            <select className="eficiencia-filtro-input" value={f.persona || ''} onChange={(e) => poner({ persona: Number(e.target.value) || null })}>
                                <option value="">Todas</option>
                                {opciones.personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        ))}
                        {campo('Situación', (
                            <select className="eficiencia-filtro-input" value={f.situacion} onChange={(e) => poner({ situacion: e.target.value })}>
                                <option value="">Todas</option>
                                {SITUACIONES.map((s) => <option key={s}>{s}</option>)}
                            </select>
                        ))}
                        {campo('Pactada desde', <input type="date" className="eficiencia-filtro-input" value={f.desde} onChange={(e) => poner({ desde: e.target.value })} />)}
                        {campo('Pactada hasta', <input type="date" className="eficiencia-filtro-input" value={f.hasta} onChange={(e) => poner({ hasta: e.target.value })} />)}
                        {campo('Buscar', <input type="search" className="eficiencia-filtro-input" placeholder="Título de la tarea" value={f.buscar} onChange={(e) => poner({ buscar: e.target.value })} />)}
                        <label className="it-check">
                            <input type="checkbox" checked={f.vencidas} onChange={(e) => poner({ vencidas: e.target.checked })} /> Solo vencidas
                        </label>
                        <button className="eficiencia-filtro-clear" onClick={() => setF(FILTROS_VACIOS)}>Limpiar</button>
                    </div>

                    {error && <Vacio>No fue posible cargar las tareas. Cierra el informe e inténtalo de nuevo.</Vacio>}
                    {!error && cargando && <Vacio>Cargando tareas…</Vacio>}
                    {!error && !cargando && tareas.length === 0 && <Vacio>No hay tareas registradas en tu alcance.</Vacio>}
                    {hayDatos && grupos.length === 0 && <Vacio>Ninguna tarea coincide con estos filtros.</Vacio>}

                    {hayDatos && grupos.length > 0 && (
                        <>
                            <p className="ie-nota">
                                <b>{total.total}</b> tareas de <b>{grupos.length}</b> personas · <b>{total.vencidas}</b> vencidas.
                                Las situaciones suman el total; «vencida» es una marca aparte.
                            </p>

                            <section className="ie-grafica">
                                <h3>Tareas por persona</h3>
                                <p className="ie-sub">
                                    {grupos.length > EN_GRAFICA
                                        ? `Las ${EN_GRAFICA} personas con más vencidas; todas están en la tabla.`
                                        : 'Quienes tienen más vencidas, arriba.'}
                                </p>
                                <ResponsiveContainer width="100%" height={Math.min(grupos.length, EN_GRAFICA) * 34 + 70}>
                                    <BarChart
                                        layout="vertical"
                                        data={grupos.slice(0, EN_GRAFICA).map((g) => ({ clave: g.clave, ...g.cuenta }))}
                                        margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                                        {/* Por clave y no por nombre: dos homónimos son dos barras. */}
                                        <YAxis
                                            type="category" dataKey="clave" width={150} tick={{ fontSize: 11 }} interval={0}
                                            tickFormatter={(c) => grupos.find((g) => g.clave === c)?.nombre || ''}
                                        />
                                        <Tooltip labelFormatter={(c) => grupos.find((g) => g.clave === c)?.nombre || ''} />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        {SITUACIONES.map((s) => <Bar key={s} dataKey={s} stackId="t" fill={COLOR[s]} />)}
                                    </BarChart>
                                </ResponsiveContainer>
                            </section>

                            <div className="ie-tabla-cab" style={{ marginTop: '1rem' }}>
                                <p className="ie-sub">Pulsa una persona para ver sus tareas.</p>
                                <button type="button" className="eficiencia-filtro-clear" onClick={() => abrirTodos(!todosAbiertos)}>
                                    {todosAbiertos ? 'Cerrar todas' : 'Abrir todas'}
                                </button>
                            </div>

                            <div className="ie-tabla-caja">
                                <table className="ie-tabla" data-sin-movil="">
                                    <thead>
                                        <tr>
                                            <th>Persona</th><th>Área</th>
                                            {SITUACIONES.map((s) => <th key={s} className="num">{s}</th>)}
                                            <th className="num">Total</th><th className="num">Vencidas</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {grupos.map((g) => (
                                            <React.Fragment key={g.clave}>
                                                <tr className="ie-fila-accion" onClick={() => setAbiertos((v) => ({ ...v, [g.clave]: !v[g.clave] }))}>
                                                    <td>
                                                        <button type="button" className="it-abrir" aria-expanded={Boolean(abiertos[g.clave])}>
                                                            <FaChevronDown className={abiertos[g.clave] ? 'es-abierta' : ''} aria-hidden="true" />
                                                            <b className="ie-nombre">{g.nombre.toLowerCase()}</b>
                                                        </button>
                                                        {!g.activo && <span className="ie-inactiva">Inactiva</span>}
                                                    </td>
                                                    <td>{g.area}</td>
                                                    {SITUACIONES.map((s) => <td key={s} className="num">{g.cuenta[s] || 0}</td>)}
                                                    <td className="num"><b>{g.total}</b></td>
                                                    <td className="num"><span className={g.vencidas ? 'ie-rojo' : ''}>{g.vencidas}</span></td>
                                                </tr>
                                                {abiertos[g.clave] && (
                                                    <tr className="it-detalle">
                                                        <td colSpan={SITUACIONES.length + 4}>
                                                            <table className="ie-tabla" data-sin-movil="">
                                                                <thead>
                                                                    <tr><th>Tarea</th><th>Situación</th><th>Prioridad</th><th>Pactada</th><th>Entregada</th></tr>
                                                                </thead>
                                                                <tbody>
                                                                    {g.tareas.map((t) => {
                                                                        const color = COLOR[situacion(t)] || '#64748b';
                                                                        return (
                                                                            <tr key={t.id}>
                                                                                <td>{t.titulo}</td>
                                                                                <td><span className="id-nivel" style={{ background: `${color}22`, color }}>{situacion(t)}</span></td>
                                                                                <td>{t.prioridad || '—'}</td>
                                                                                <td>
                                                                                    {fecha(t.fecha_pactada)}
                                                                                    {t.vencida && <small className="ie-grave"> · {t.dias_vencida} d vencida</small>}
                                                                                </td>
                                                                                <td>
                                                                                    {fecha(t.fecha_entregada)}
                                                                                    {t.a_tiempo === false && <small className="ie-grave"> · tarde</small>}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan={2}><b>Total</b></td>
                                            {SITUACIONES.map((s) => <td key={s} className="num"><b>{total.cuenta[s]}</b></td>)}
                                            <td className="num"><b>{total.total}</b></td>
                                            <td className="num"><b>{total.vencidas}</b></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
