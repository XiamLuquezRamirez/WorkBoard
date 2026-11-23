import React, { useMemo, useState } from 'react';
import { FaTimes, FaFilePdf, FaFileExcel } from 'react-icons/fa';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import * as XLSX from 'xlsx';
import RangosFecha from '../rangosFecha';
import { opcionesEjecutivo } from './ejecutivo';
import { calcularPuntualidad } from './puntualidad';
import './ejecutivo.css';

const PESTANAS = [
    { id: 'vencidas', titulo: 'Vencidas hoy' },
    { id: 'puntualidad', titulo: 'Puntualidad' },
    { id: 'personas', titulo: 'Por persona' },
];

const POR_PAGINA = 50;

const fecha = (iso) => {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
};

const estadoDe = (t) => (t.en_pausa ? 'En pausa' : t.estado);

function Kpi({ numero, titulo, detalle, tono = '' }) {
    return (
        <div className={`ie-kpi ${tono ? `ie-kpi--${tono}` : ''}`}>
            <span className="ie-kpi-num">{numero}</span>
            <span className="ie-kpi-tit">{titulo}</span>
            {detalle && <span className="ie-kpi-det">{detalle}</span>}
        </div>
    );
}

function Vacio({ children }) {
    return <p className="ie-vacio">{children}</p>;
}

function Porcentaje({ valor }) {
    if (valor === null || valor === undefined) return <span className="ie-nulo">—</span>;
    const tono = valor >= 80 ? 'ok' : valor >= 60 ? 'medio' : 'mal';
    return (
        <span className={`ie-pct ie-pct--${tono}`}>
            <span className="ie-pct-barra"><span style={{ width: `${valor}%` }} /></span>
            {valor} %
        </span>
    );
}

/** Gráfica de barras por tramo (días). */
function Tramos({ datos, colorPorDefecto, unidad }) {
    if (datos.every((d) => d.tareas === 0)) return null;
    return (
        <ResponsiveContainer width="100%" height={220}>
            <BarChart data={datos} margin={{ top: 18, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="texto" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v} tareas`, unidad]} />
                <Bar dataKey="tareas" radius={[4, 4, 0, 0]}>
                    {datos.map((d) => <Cell key={d.id} fill={d.color || colorPorDefecto} />)}
                    <LabelList dataKey="tareas" position="top" style={{ fontSize: 12, fill: '#334155' }} />
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

/**
 * Puntualidad y vencidas: qué está vencido hoy (y desde cuándo) y qué tan
 * puntual fue lo entregado en el periodo.
 */
export default function InformePuntualidad({
    tareas, cargando, error, startDate, setStartDate, endDate, setEndDate, onCerrar, onPDF, pdfLoading,
}) {
    const [pestana, setPestana] = useState('vencidas');
    const [area, setArea] = useState('');
    const [persona, setPersona] = useState(null);
    const [mostrar, setMostrar] = useState(POR_PAGINA);

    const opciones = useMemo(() => opcionesEjecutivo(tareas, area), [tareas, area]);
    const d = useMemo(
        () => calcularPuntualidad(tareas, { desde: startDate, hasta: endDate, area, persona }),
        [tareas, startDate, endDate, area, persona]
    );
    const personasConVencidas = d.personas.filter((p) => p.vencidas > 0).length;
    const masAntigua = d.vencidas[0]?.dias_vencida || 0;
    const hayDatos = !error && !cargando && tareas.length > 0;

    const exportarExcel = () => {
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(d.vencidas.map((t) => ({
            Tarea: t.titulo, Persona: t.empleado, Área: t.departamento || 'Sin departamento',
            Estado: estadoDe(t), 'Fecha pactada': t.fecha_pactada, 'Días vencida': t.dias_vencida,
        }))), 'Vencidas hoy');
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(d.tarde.map((t) => ({
            Tarea: t.titulo, Persona: t.empleado, Área: t.departamento || 'Sin departamento',
            'Fecha pactada': t.fecha_pactada, 'Fecha entregada': t.fecha_entregada, 'Días tarde': t.diasTarde,
        }))), 'Entregadas tarde');
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(d.personas.map((p) => ({
            Persona: p.nombre, Área: p.area, Activa: p.activo ? 'Sí' : 'No',
            'Vencidas hoy': p.vencidas, 'Vencidas +7 días': p.graves, 'La más antigua (días)': p.masAntigua || '',
            Entregadas: p.entregadas, 'A tiempo': p.aTiempo, Tarde: p.tarde,
            'A tiempo (%)': p.pctATiempo ?? '', 'Retraso promedio (días)': p.retrasoPromedio ?? '',
        }))), 'Por persona');
        XLSX.writeFile(libro, `puntualidad-y-vencidas-${startDate || 'inicio'}-${endDate || 'hoy'}.xlsx`);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-report ie">
                <div className="modal-header">
                    <h2>Puntualidad y vencidas</h2>
                    <div className="header-actions">
                        <button className="pdf-button" onClick={exportarExcel} disabled={!hayDatos}>
                            <FaFileExcel /> Excel
                        </button>
                        <button className="pdf-button" onClick={() => onPDF('Puntualidad y vencidas')} disabled={pdfLoading}>
                            <FaFilePdf /> {pdfLoading ? '...' : 'PDF'}
                        </button>
                        <button className="close-button" onClick={onCerrar} aria-label="Cerrar"><FaTimes /></button>
                    </div>
                </div>

                <div className="tab-content">
                    <div className="eficiencia-filtros">
                        <RangosFecha startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />
                        <label className="eficiencia-filtro-label">
                            Área
                            <select className="eficiencia-filtro-input" value={area} onChange={(e) => { setArea(e.target.value); setPersona(null); }}>
                                <option value="">Todas</option>
                                {opciones.areas.map((a) => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </label>
                        <label className="eficiencia-filtro-label">
                            Persona
                            <select className="eficiencia-filtro-input" value={persona || ''} onChange={(e) => setPersona(Number(e.target.value) || null)}>
                                <option value="">Todas</option>
                                {opciones.personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </label>
                        <button className="eficiencia-filtro-clear" onClick={() => { setArea(''); setPersona(null); }}>Limpiar</button>
                    </div>

                    <p className="ie-nota">
                        <b>Vencidas:</b> abiertas hoy con la fecha pactada pasada (no cuentan las que están en revisión
                        ni en pausa), sin importar el periodo. <b>Puntualidad:</b> lo entregado entre las fechas elegidas.
                    </p>

                    <nav className="ie-pestanas" role="tablist">
                        {PESTANAS.map((p) => (
                            <button key={p.id} role="tab" aria-selected={pestana === p.id}
                                className={pestana === p.id ? 'es-activa' : ''} onClick={() => setPestana(p.id)}>
                                {p.titulo}
                                {p.id === 'vencidas' && <span className="ie-cuenta">{d.vencidas.length}</span>}
                                {p.id === 'puntualidad' && <span className="ie-cuenta">{d.entregadas}</span>}
                                {p.id === 'personas' && <span className="ie-cuenta">{d.personas.length}</span>}
                            </button>
                        ))}
                    </nav>

                    {error && <Vacio>No fue posible cargar las tareas. Cierra el informe e inténtalo de nuevo.</Vacio>}
                    {!error && cargando && <Vacio>Cargando tareas…</Vacio>}
                    {!error && !cargando && tareas.length === 0 && <Vacio>No hay tareas registradas en tu alcance.</Vacio>}

                    {hayDatos && pestana === 'vencidas' && (
                        <>
                            <div className="ie-kpis">
                                <Kpi numero={d.vencidas.length} titulo="Vencidas hoy" tono={d.vencidas.length ? 'mal' : 'ok'}
                                    detalle={d.vencidas.length ? `${personasConVencidas} personas con vencidas` : 'Nada vencido'} />
                                <Kpi numero={d.graves} titulo="Hace más de 7 días" tono={d.graves ? 'mal' : 'ok'}
                                    detalle="Ya no es un descuido puntual" />
                                <Kpi numero={masAntigua ? `${masAntigua} d` : '—'} titulo="La más antigua"
                                    detalle={d.vencidas[0] ? d.vencidas[0].titulo : ''} tono={masAntigua > 30 ? 'mal' : ''} />
                            </div>

                            {d.vencidas.length === 0 ? <Vacio>No hay tareas vencidas con estos filtros. 🎉</Vacio> : (
                                <>
                                    <section className="ie-grafica">
                                        <h3>¿Desde cuándo están vencidas?</h3>
                                        <p className="ie-sub">Distingue el retraso de unos días del trabajo abandonado.</p>
                                        <Tramos datos={d.porTramoVencida} unidad="Vencidas" />
                                    </section>

                                    <div className="ie-tabla-caja" style={{ marginTop: '1rem' }}>
                                        <table className="ie-tabla">
                                            <thead>
                                                <tr>
                                                    <th>Tarea</th><th>Persona</th><th>Área</th><th>Estado</th>
                                                    <th>Pactada</th><th className="num">Días vencida</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {d.vencidas.slice(0, mostrar).map((t) => (
                                                    <tr key={t.id}>
                                                        <td>{t.titulo}</td>
                                                        <td className="ie-nombre">{(t.empleado || '').toLowerCase()}</td>
                                                        <td>{t.departamento || 'Sin departamento'}</td>
                                                        <td>{estadoDe(t)}</td>
                                                        <td>{fecha(t.fecha_pactada)}</td>
                                                        <td className="num">
                                                            <span className="ip-dias" style={{ background: `${t.tramo.color}1f`, color: t.tramo.color }}>
                                                                {t.dias_vencida} d
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {d.vencidas.length > mostrar && (
                                            <button type="button" className="eficiencia-filtro-clear ip-mas" onClick={() => setMostrar((m) => m + POR_PAGINA)}>
                                                Ver {Math.min(POR_PAGINA, d.vencidas.length - mostrar)} más de {d.vencidas.length - mostrar}
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {hayDatos && pestana === 'puntualidad' && (
                        <>
                            <div className="ie-kpis">
                                <Kpi numero={d.entregadas} titulo="Entregadas en el periodo" />
                                <Kpi numero={d.pctATiempo === null ? '—' : `${d.pctATiempo} %`} titulo="A tiempo"
                                    detalle={d.entregadas ? `${d.aTiempo} de ${d.entregadas}` : 'Ninguna entrega'}
                                    tono={d.pctATiempo === null ? '' : d.pctATiempo >= 80 ? 'ok' : d.pctATiempo >= 60 ? 'aviso' : 'mal'} />
                                <Kpi numero={d.tarde.length} titulo="Entregadas tarde" tono={d.tarde.length ? 'aviso' : 'ok'} />
                                <Kpi numero={d.retrasoPromedio === null ? '—' : `${String(d.retrasoPromedio).replace('.', ',')} d`}
                                    titulo="Retraso promedio" detalle="De las entregadas tarde" />
                            </div>

                            {d.tarde.length === 0 ? (
                                <Vacio>{d.entregadas ? 'Todo lo entregado en el periodo llegó a tiempo.' : 'No hubo entregas en el periodo.'}</Vacio>
                            ) : (
                                <>
                                    <section className="ie-grafica">
                                        <h3>¿Con cuánto retraso se entregó?</h3>
                                        <p className="ie-sub">Días entre la fecha pactada y la entrega.</p>
                                        <Tramos datos={d.porTramoRetraso} colorPorDefecto="#f59e0b" unidad="Entregadas tarde" />
                                    </section>
                                    <div className="ie-tabla-caja" style={{ marginTop: '1rem' }}>
                                        <table className="ie-tabla">
                                            <thead>
                                                <tr>
                                                    <th>Tarea</th><th>Persona</th><th>Área</th>
                                                    <th>Pactada</th><th>Entregada</th><th className="num">Días tarde</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {d.tarde.slice(0, mostrar).map((t) => (
                                                    <tr key={t.id}>
                                                        <td>{t.titulo}</td>
                                                        <td className="ie-nombre">{(t.empleado || '').toLowerCase()}</td>
                                                        <td>{t.departamento || 'Sin departamento'}</td>
                                                        <td>{fecha(t.fecha_pactada)}</td>
                                                        <td>{fecha(t.fecha_entregada)}</td>
                                                        <td className="num"><b className="ie-grave">{t.diasTarde}</b></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {hayDatos && pestana === 'personas' && (
                        d.personas.length === 0 ? <Vacio>Nadie tiene vencidas ni entregas con estos filtros.</Vacio> : (
                            <div className="ie-tabla-caja">
                                <p className="ie-sub">Pulsa una persona para ver solo lo suyo.</p>
                                <table className="ie-tabla">
                                    <thead>
                                        <tr>
                                            <th>Persona</th><th>Área</th>
                                            <th className="num">Vencidas hoy</th><th className="num">La más antigua</th>
                                            <th className="num">Entregadas</th><th>A tiempo</th><th className="num">Retraso prom.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {d.personas.map((p) => (
                                            <tr key={p.id ?? p.nombre} className={p.id ? 'ie-fila-accion' : ''}
                                                onClick={() => { if (p.id) { setPersona(p.id); setPestana('vencidas'); } }}>
                                                <td>
                                                    <b className="ie-nombre">{p.nombre.toLowerCase()}</b>
                                                    {!p.activo && <span className="ie-inactiva">Inactiva</span>}
                                                </td>
                                                <td>{p.area}</td>
                                                <td className="num">
                                                    <span className={p.vencidas ? 'ie-rojo' : ''}>{p.vencidas}</span>
                                                    {p.graves > 0 && <small className="ie-grave"> ({p.graves} +7d)</small>}
                                                </td>
                                                <td className="num">{p.masAntigua ? `${p.masAntigua} d` : '—'}</td>
                                                <td className="num">{p.entregadas}</td>
                                                <td><Porcentaje valor={p.pctATiempo} /></td>
                                                <td className="num">{p.retrasoPromedio === null ? '—' : `${String(p.retrasoPromedio).replace('.', ',')} d`}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
