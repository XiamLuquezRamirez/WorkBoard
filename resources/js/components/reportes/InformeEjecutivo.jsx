import React, { useMemo, useState } from 'react';
import { FaTimes, FaFilePdf, FaFileExcel } from 'react-icons/fa';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import * as XLSX from 'xlsx';
import RangosFecha from '../rangosFecha';
import { calcularEjecutivo, opcionesEjecutivo, DIAS_GRAVE } from './ejecutivo';
import './ejecutivo.css';

const COLOR = {
    aTiempo: '#16a34a',
    tarde: '#f59e0b',
    vencida: '#dc2626',
    revision: '#0d9488',
    pausa: '#94a3b8',
    alDia: '#2563eb',
};

const PESTANAS = [
    { id: 'general', titulo: 'General' },
    { id: 'areas', titulo: 'Por área' },
    { id: 'personas', titulo: 'Por persona' },
];

const fechaCorta = (iso) => {
    if (!iso) return '';
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

const fechaLarga = (iso) => {
    if (!iso) return '…';
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
};

const verPct = (v) => (v === null || v === undefined ? '—' : `${v} %`);

/** Barra pequeña de porcentaje para las tablas. */
function Porcentaje({ valor, bueno = 80, regular = 60 }) {
    if (valor === null || valor === undefined) return <span className="ie-nulo">—</span>;
    const tono = valor >= bueno ? 'ok' : valor >= regular ? 'medio' : 'mal';
    return (
        <span className={`ie-pct ie-pct--${tono}`}>
            <span className="ie-pct-barra"><span style={{ width: `${valor}%` }} /></span>
            {valor} %
        </span>
    );
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

function Vacio({ children }) {
    return <p className="ie-vacio">{children}</p>;
}

/**
 * Informe Ejecutivo: lo entregado en el periodo, el cumplimiento de lo que
 * vencía y el estado de hoy, en general, por área y por persona.
 */
export default function InformeEjecutivo({
    tareas, cargando, error, startDate, setStartDate, endDate, setEndDate,
    onCerrar, onPDF, pdfLoading,
}) {
    const [pestana, setPestana] = useState('general');
    const [area, setArea] = useState('');
    const [persona, setPersona] = useState(null);

    const opciones = useMemo(() => opcionesEjecutivo(tareas, area), [tareas, area]);
    const datos = useMemo(
        () => calcularEjecutivo(tareas, { desde: startDate, hasta: endDate, area, persona }),
        [tareas, startDate, endDate, area, persona]
    );
    const { total, areas, personas, semanas } = datos;

    const estadoPorArea = areas.map((a) => ({
        area: a.area,
        Vencidas: a.vencidas,
        'En revisión': a.enRevision,
        'En pausa': a.enPausa,
        'Al día': Math.max(0, a.abiertas - a.vencidas - a.enRevision - a.enPausa),
    }));
    const semanasGrafica = semanas.map((s) => ({ ...s, etiqueta: fechaCorta(s.semana) }));
    const personaElegida = opciones.personas.find((p) => p.id === persona);

    const exportarExcel = () => {
        const libro = XLSX.utils.book_new();
        const resumen = [
            ['Informe Ejecutivo'],
            ['Periodo', `${startDate || '…'} a ${endDate || '…'}`],
            ['Área', area || 'Todas'],
            ['Persona', personaElegida?.nombre || 'Todas'],
            [],
            ['Entregadas en el periodo', total.entregadas],
            ['Entregadas a tiempo (%)', total.pctATiempo ?? '—'],
            ['Compromisos que vencían en el periodo', total.compromisos],
            ['Cumplidos (%)', total.pctCumplimiento ?? '—'],
            ['Abiertas hoy', total.abiertas],
            ['Vencidas hoy', total.vencidas],
            [`Vencidas hace más de ${DIAS_GRAVE} días`, total.graves],
            ['Creadas en el periodo', total.creadas],
        ];
        XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(resumen), 'Resumen');
        const fila = (x) => ({
            Abiertas: x.abiertas,
            'Vencidas hoy': x.vencidas,
            [`Vencidas +${DIAS_GRAVE} días`]: x.graves,
            'Entregadas en el periodo': x.entregadas,
            'A tiempo (%)': x.pctATiempo ?? '',
            'Compromisos del periodo': x.compromisos,
            'Cumplimiento (%)': x.pctCumplimiento ?? '',
        });
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(
            areas.map((a) => ({ Área: a.area, Personas: a.personas, ...fila(a) }))
        ), 'Por área');
        XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(
            personas.map((p) => ({ Persona: p.nombre, Área: p.area, Activa: p.activo ? 'Sí' : 'No', ...fila(p) }))
        ), 'Por persona');
        XLSX.writeFile(libro, `informe-ejecutivo-${startDate || 'inicio'}-${endDate || 'hoy'}.xlsx`);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-report ie">
                <div className="modal-header">
                    <h2>Informe Ejecutivo</h2>
                    <div className="header-actions">
                        <button className="pdf-button" onClick={exportarExcel} disabled={cargando || !tareas.length}>
                            <FaFileExcel /> Excel
                        </button>
                        <button className="pdf-button" onClick={() => onPDF('Informe Ejecutivo')} disabled={pdfLoading}>
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
                        <b>Entregado y cumplimiento:</b> del {fechaLarga(startDate)} al {fechaLarga(endDate)}.{' '}
                        <b>Abiertas y vencidas:</b> a hoy, sin importar el periodo — lo vencido de meses atrás también cuenta.
                    </p>

                    <nav className="ie-pestanas" role="tablist">
                        {PESTANAS.map((p) => (
                            <button
                                key={p.id}
                                role="tab"
                                aria-selected={pestana === p.id}
                                className={pestana === p.id ? 'es-activa' : ''}
                                onClick={() => setPestana(p.id)}
                            >
                                {p.titulo}
                                {p.id === 'areas' && <span className="ie-cuenta">{areas.length}</span>}
                                {p.id === 'personas' && <span className="ie-cuenta">{personas.length}</span>}
                            </button>
                        ))}
                    </nav>

                    {error && <Vacio>No fue posible cargar las tareas. Cierra el informe e inténtalo de nuevo.</Vacio>}
                    {!error && cargando && <Vacio>Cargando tareas…</Vacio>}
                    {!error && !cargando && tareas.length === 0 && <Vacio>No hay tareas registradas en tu alcance.</Vacio>}

                    {!error && !cargando && tareas.length > 0 && pestana === 'general' && (
                        <>
                            <div className="ie-kpis">
                                <Kpi
                                    numero={total.entregadas}
                                    titulo="Entregadas en el periodo"
                                    detalle={total.entregadas ? `${verPct(total.pctATiempo)} a tiempo` : 'Ninguna entrega'}
                                    tono={total.pctATiempo !== null && total.pctATiempo < 60 ? 'aviso' : 'ok'}
                                />
                                <Kpi
                                    numero={verPct(total.pctCumplimiento)}
                                    titulo="Cumplimiento de lo que vencía"
                                    detalle={total.compromisos
                                        ? `${total.cumplidos} de ${total.compromisos} completadas`
                                        : 'Nada vencía en el periodo'}
                                />
                                <Kpi
                                    numero={total.abiertas}
                                    titulo="Abiertas hoy"
                                    detalle={`${total.pendientes} pend. · ${total.enProceso} en proceso · ${total.enRevision} en revisión · ${total.enPausa} en pausa`}
                                />
                                <Kpi
                                    numero={total.vencidas}
                                    titulo="Vencidas hoy"
                                    detalle={total.graves ? `${total.graves} hace más de ${DIAS_GRAVE} días` : 'Ninguna grave'}
                                    tono={total.vencidas > 0 ? 'mal' : 'ok'}
                                />
                                <Kpi numero={total.creadas} titulo="Creadas en el periodo" />
                            </div>

                            <div className="ie-graficas">
                                <section className="ie-grafica">
                                    <h3>Entregas por semana</h3>
                                    <p className="ie-sub">A tiempo y tarde, según la fecha pactada.</p>
                                    {semanasGrafica.length === 0 ? (
                                        <Vacio>No hubo entregas en el periodo.</Vacio>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={240}>
                                            <BarChart data={semanasGrafica} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="etiqueta" tick={{ fontSize: 12 }} />
                                                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                                <Tooltip labelFormatter={(l) => `Semana del ${l}`} />
                                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                                <Bar dataKey="aTiempo" name="A tiempo" stackId="e" fill={COLOR.aTiempo} />
                                                <Bar dataKey="tarde" name="Tarde" stackId="e" fill={COLOR.tarde} radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </section>

                                <section className="ie-grafica">
                                    <h3>Estado de hoy por área</h3>
                                    <p className="ie-sub">Tareas abiertas; las áreas con más vencidas, arriba.</p>
                                    {estadoPorArea.every((a) => a.Vencidas + a['En revisión'] + a['En pausa'] + a['Al día'] === 0) ? (
                                        <Vacio>No hay tareas abiertas.</Vacio>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={Math.max(160, estadoPorArea.length * 34 + 60)}>
                                            <BarChart data={estadoPorArea} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                                                <YAxis type="category" dataKey="area" width={130} tick={{ fontSize: 12 }} />
                                                <Tooltip />
                                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                                <Bar dataKey="Vencidas" stackId="h" fill={COLOR.vencida} />
                                                <Bar dataKey="En revisión" stackId="h" fill={COLOR.revision} />
                                                <Bar dataKey="En pausa" stackId="h" fill={COLOR.pausa} />
                                                <Bar dataKey="Al día" stackId="h" fill={COLOR.alDia} radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </section>
                            </div>
                        </>
                    )}

                    {!error && !cargando && tareas.length > 0 && pestana === 'areas' && (
                        areas.length === 0 ? <Vacio>No hay tareas con estos filtros.</Vacio> : (
                            <div className="ie-tabla-caja">
                                <table className="ie-tabla">
                                    <thead>
                                        <tr>
                                            <th>Área</th>
                                            <th className="num">Personas</th>
                                            <th className="num">Abiertas</th>
                                            <th className="num">Vencidas hoy</th>
                                            <th className="num">Entregadas</th>
                                            <th>A tiempo</th>
                                            <th>Cumplimiento</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {areas.map((a) => (
                                            <tr key={a.area}>
                                                <td><b>{a.area}</b></td>
                                                <td className="num">{a.personas}</td>
                                                <td className="num">{a.abiertas}</td>
                                                <td className="num">
                                                    <span className={a.vencidas ? 'ie-rojo' : ''}>{a.vencidas}</span>
                                                    {a.graves > 0 && <small className="ie-grave"> ({a.graves} +{DIAS_GRAVE}d)</small>}
                                                </td>
                                                <td className="num">{a.entregadas}</td>
                                                <td><Porcentaje valor={a.pctATiempo} /></td>
                                                <td><Porcentaje valor={a.pctCumplimiento} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}

                    {!error && !cargando && tareas.length > 0 && pestana === 'personas' && (
                        personas.length === 0 ? <Vacio>No hay tareas con estos filtros.</Vacio> : (
                            <div className="ie-tabla-caja">
                                <p className="ie-sub">Pulsa una persona para ver solo su información.</p>
                                <table className="ie-tabla">
                                    <thead>
                                        <tr>
                                            <th>Persona</th>
                                            <th>Área</th>
                                            <th className="num">Abiertas</th>
                                            <th className="num">Vencidas hoy</th>
                                            <th className="num">Entregadas</th>
                                            <th>A tiempo</th>
                                            <th>Cumplimiento</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {personas.map((p) => (
                                            <tr
                                                key={p.id ?? p.nombre}
                                                className={p.id ? 'ie-fila-accion' : ''}
                                                onClick={() => { if (p.id) { setPersona(p.id); setPestana('general'); } }}
                                            >
                                                <td>
                                                    <b className="ie-nombre">{p.nombre.toLowerCase()}</b>
                                                    {!p.activo && <span className="ie-inactiva">Inactiva</span>}
                                                </td>
                                                <td>{p.area}</td>
                                                <td className="num">{p.abiertas}</td>
                                                <td className="num">
                                                    <span className={p.vencidas ? 'ie-rojo' : ''}>{p.vencidas}</span>
                                                    {p.graves > 0 && <small className="ie-grave"> ({p.graves} +{DIAS_GRAVE}d)</small>}
                                                </td>
                                                <td className="num">{p.entregadas}</td>
                                                <td><Porcentaje valor={p.pctATiempo} /></td>
                                                <td><Porcentaje valor={p.pctCumplimiento} /></td>
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
