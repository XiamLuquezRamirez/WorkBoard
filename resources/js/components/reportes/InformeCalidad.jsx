import React, { useContext, useEffect, useMemo, useState } from 'react';
import { FaTimes, FaFilePdf, FaFileExcel } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import * as XLSX from 'xlsx';
import axiosInstance from '../../axiosConfig';
import RangosFecha from '../rangosFecha';
import { AmbitoInforme } from './ambito';
import './ejecutivo.css';

const PESTANAS = [
    { id: 'definicion', titulo: 'Definición' },
    { id: 'vistobueno', titulo: 'Visto bueno' },
    { id: 'aceptacion', titulo: 'Aceptación' },
];
const SIN_LIDER = 'Sin líder asignado';
/** Con menos decisiones que esto, un porcentaje engaña: se muestran las cantidades. */
const MINIMO_PCT = 10;
const POR_PAGINA = 50;
const TRAMOS = [
    { texto: 'El mismo día', es: (d) => d === 0 },
    { texto: '1–2 días', es: (d) => d >= 1 && d <= 2 },
    { texto: '3–7 días', es: (d) => d >= 3 && d <= 7 },
    { texto: '8–30 días', es: (d) => d >= 8 && d <= 30 },
    { texto: 'Más de 30', es: (d) => d > 30 },
];

const local = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const haceDias = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return local(d); };
const fecha = (iso) => {
    if (!iso) return '—';
    const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};
const coma = (n) => (n === null ? '—' : String(n).replace('.', ','));
const promedio = (l) => (l.length ? Math.round((l.reduce((s, x) => s + x, 0) / l.length) * 10) / 10 : null);
const mediana = (l) => {
    if (!l.length) return null;
    const o = [...l].sort((a, b) => a - b);
    const m = Math.floor(o.length / 2);
    return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};
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

/** Cómo nacen las tareas, cuánto esperan por su líder y qué pasa al entregarlas. */
export default function InformeCalidad({ onCerrar, onPDF, pdfLoading }) {
    const ambito = useContext(AmbitoInforme);
    const [inicio, setInicio] = useState(haceDias(90));
    const [fin, setFin] = useState(haceDias(0));
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState('');
    const [pestana, setPestana] = useState('definicion');
    const [area, setArea] = useState('');
    const [lider, setLider] = useState('');
    const [mostrar, setMostrar] = useState(POR_PAGINA);

    useEffect(() => {
        const ctrl = new AbortController();
        setError('');
        setDatos(null);
        axiosInstance.get('/informes/calidad', { params: { ...ambito, inicio: inicio || undefined, fin: fin || undefined }, signal: ctrl.signal })
            .then((r) => setDatos(r.data))
            .catch((e) => {
                if (ctrl.signal.aborted) return;
                const errores = e?.response?.data?.errors;
                setError(errores ? Object.values(errores).flat().join(' ') : 'No fue posible cargar el informe.');
            });
        return () => ctrl.abort();
    }, [inicio, fin]);

    const lideresDe = (t) => (t.lideres.length ? t.lideres : [SIN_LIDER]);
    const crudo = datos ? [...datos.abiertas, ...datos.vistos_buenos, ...datos.aceptaciones] : [];
    const areas = [...new Set(crudo.map((t) => t.departamento))].sort((a, b) => a.localeCompare(b));
    const lideres = [...new Set(crudo.flatMap(lideresDe))].sort((a, b) => a.localeCompare(b));

    const { abiertas, vistos, decisiones } = useMemo(() => {
        const pasa = (t) => (!area || t.departamento === area) && (!lider || lideresDe(t).includes(lider));
        return {
            abiertas: (datos?.abiertas || []).filter(pasa),
            vistos: (datos?.vistos_buenos || []).filter(pasa),
            decisiones: (datos?.aceptaciones || []).filter(pasa),
        };
    }, [datos, area, lider]);

    // Definición
    const sinCriterio = abiertas.filter((t) => t.sin_criterio);
    const incompletas = abiertas.filter((t) => t.sin_criterio || t.sin_proposito)
        .sort((a, b) => Number(b.nueva) - Number(a.nueva) || a.persona.localeCompare(b.persona));
    const nuevas = abiertas.filter((t) => t.nueva);
    const nuevasMal = nuevas.filter((t) => t.sin_criterio || t.sin_proposito);

    // Visto bueno
    const esperando = abiertas.filter((t) => t.sin_visto_bueno)
        .sort((a, b) => (b.dias_esperando_vb ?? -1) - (a.dias_esperando_vb ?? -1));
    const diasVb = vistos.map((v) => v.dias);
    const tramosVb = TRAMOS.map((t) => ({ texto: t.texto, tareas: diasVb.filter(t.es).length }));
    const lentosVb = diasVb.filter((d) => d > 7).length;

    // Aceptación: las automáticas (independencia) no las decide un líder.
    const manuales = decisiones.filter((d) => !d.automatica);
    const devueltas = manuales.filter((d) => d.resultado === 'Devuelta');
    const diasRevision = manuales.map((d) => d.dias).filter((d) => d !== null);
    const enRevision = abiertas.filter((t) => t.estado === 'En Revisión')
        .sort((a, b) => (b.dias_en_revision ?? -1) - (a.dias_en_revision ?? -1));

    const porLider = useMemo(() => {
        const g = {};
        const de = (c) => (g[c] ??= { nombre: c, abiertas: 0, sinCriterio: 0, esperando: 0, vb: [], revision: 0, manuales: 0, devueltas: 0 });
        abiertas.forEach((t) => lideresDe(t).forEach((c) => {
            const x = de(c);
            x.abiertas += 1;
            if (t.sin_criterio) x.sinCriterio += 1;
            if (t.sin_visto_bueno) x.esperando += 1;
            if (t.estado === 'En Revisión') x.revision += 1;
        }));
        vistos.forEach((v) => lideresDe(v).forEach((c) => de(c).vb.push(v.dias)));
        manuales.forEach((d) => lideresDe(d).forEach((c) => {
            const x = de(c);
            x.manuales += 1;
            if (d.resultado === 'Devuelta') x.devueltas += 1;
        }));
        return Object.values(g).sort((a, b) => b.esperando + b.revision - a.esperando - a.revision || b.sinCriterio - a.sinCriterio || a.nombre.localeCompare(b.nombre));
    }, [abiertas, vistos, decisiones]); // eslint-disable-line

    const cambiar = (p) => { setPestana(p); setMostrar(POR_PAGINA); };
    const nombre = (n) => (n === SIN_LIDER || n === 'Sin responsable' ? n : n.toLowerCase());

    const exportarExcel = () => {
        const libro = XLSX.utils.book_new();
        const comun = (t) => ({ Tarea: t.titulo, Persona: t.persona, Área: t.departamento, Líderes: t.lideres.join(', ') || SIN_LIDER });
        const si = (v) => (v ? 'Sí' : 'No');
        const hoja = (titulo, filas) => XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), titulo);
        hoja('Definición', incompletas.map((t) => ({ ...comun(t), Estado: t.estado, 'Sin criterio': si(t.sin_criterio), 'Sin propósito': si(t.sin_proposito), 'Creada cuando ya era obligatorio': si(t.nueva) })));
        hoja('Esperan visto bueno', esperando.map((t) => ({ ...comun(t), Estado: t.estado, 'Días esperando': t.dias_esperando_vb ?? '' })));
        hoja('Vistos buenos', vistos.map((t) => ({ ...comun(t), Fecha: t.fecha, 'Días hasta el visto bueno': t.dias })));
        hoja('Decisiones', decisiones.map((t) => ({ ...comun(t), Resultado: t.resultado, Fecha: t.cuando, 'Resuelta por': t.resuelta_por || '', Automática: si(t.automatica), 'Días en revisión': t.dias ?? '', Observación: t.observacion || '' })));
        hoja('Por líder', porLider.map((l) => ({ Líder: l.nombre, Abiertas: l.abiertas, 'Sin criterio': l.sinCriterio, 'Esperan visto bueno': l.esperando, 'Mediana visto bueno (días)': mediana(l.vb) ?? '', 'En revisión': l.revision, Decisiones: l.manuales, Devueltas: l.devueltas })));
        XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([['Desde', inicio], ['Hasta', fin], ['Área', area || 'Todas'], ['Líder', lider || 'Todos'], ['Generado', datos.hoy]]), 'Filtros');
        XLSX.writeFile(libro, `calidad-${datos.hoy}.xlsx`);
    };

    const selector = (texto, valor, opciones, alCambiar, vacio) => (
        <label className="eficiencia-filtro-label">
            {texto}
            <select className="eficiencia-filtro-input" value={valor} onChange={(e) => alCambiar(e.target.value)}>
                <option value="">{vacio}</option>
                {opciones.map((o) => <option key={o}>{o}</option>)}
            </select>
        </label>
    );

    /** Tabla de tareas con sus columnas propias al final. */
    const tabla = (filas, columnas, clave = (t) => t.id) => (
        <div className="ie-tabla-caja" style={{ marginTop: '0.75rem' }}>
            <table className="ie-tabla" data-sin-movil="">
                <thead><tr><th>Tarea</th><th>Persona</th><th>Líder</th>{columnas.map(([t]) => <th key={t}>{t}</th>)}</tr></thead>
                <tbody>
                    {filas.slice(0, mostrar).map((t) => (
                        <tr key={clave(t)}>
                            <td>{t.titulo}</td>
                            <td className="ie-nombre">{nombre(t.persona)}<small className="id-cargo">{t.departamento}</small></td>
                            <td className={t.lideres.length ? 'ie-nombre' : 'ie-nulo'}>{t.lideres.join(', ').toLowerCase() || SIN_LIDER}</td>
                            {columnas.map(([titulo, ver]) => <td key={titulo}>{ver(t)}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
            {filas.length > mostrar && (
                <button type="button" className="eficiencia-filtro-clear ip-mas" onClick={() => setMostrar((m) => m + POR_PAGINA)}>
                    Ver más ({filas.length - mostrar})
                </button>
            )}
        </div>
    );

    return (
        <div className="modal-overlay">
            <div className="modal-report ie">
                <div className="modal-header">
                    <h2>Calidad de definición y aceptación</h2>
                    <div className="header-actions">
                        <button className="pdf-button" onClick={exportarExcel} disabled={!datos}><FaFileExcel /> Excel</button>
                        <button className="pdf-button" onClick={() => onPDF('Calidad de definición y aceptación')} disabled={pdfLoading}>
                            <FaFilePdf /> {pdfLoading ? '...' : 'PDF'}
                        </button>
                        <button className="close-button" onClick={onCerrar} aria-label="Cerrar"><FaTimes /></button>
                    </div>
                </div>

                <div className="tab-content">
                    <div className="eficiencia-filtros">
                        <RangosFecha startDate={inicio} setStartDate={setInicio} endDate={fin} setEndDate={setFin} />
                        {selector('Área', area, areas, setArea, 'Todas')}
                        {selector('Líder', lider, lideres, setLider, 'Todos')}
                        <button className="eficiencia-filtro-clear" onClick={() => { setArea(''); setLider(''); setInicio(haceDias(90)); setFin(haceDias(0)); }}>Limpiar</button>
                    </div>

                    <p className="ie-nota">
                        <b>A hoy:</b> tareas abiertas, las que esperan visto bueno y las que están en revisión.{' '}
                        <b>En el periodo:</b> vistos buenos dados y decisiones de entrega. El líder es el del responsable.
                    </p>

                    <nav className="ie-pestanas" role="tablist">
                        {PESTANAS.map((p) => (
                            <button key={p.id} role="tab" aria-selected={pestana === p.id}
                                className={pestana === p.id ? 'es-activa' : ''} onClick={() => cambiar(p.id)}>{p.titulo}</button>
                        ))}
                    </nav>

                    {error && <Vacio>{error}</Vacio>}
                    {!error && !datos && <Vacio>Cargando…</Vacio>}

                    {!error && datos && pestana === 'definicion' && (
                        <>
                            <div className="ie-kpis">
                                <Kpi numero={`${sinCriterio.length} / ${abiertas.length}`} titulo="Abiertas sin criterio de aceptación"
                                    tono={sinCriterio.length ? 'mal' : 'ok'} detalle="No se sabe cuándo están terminadas" />
                                <Kpi numero={`${abiertas.filter((t) => t.sin_proposito).length} / ${abiertas.length}`} titulo="Abiertas sin propósito" detalle="No dicen para qué se hacen" />
                                <Kpi numero={`${nuevas.length - nuevasMal.length} / ${nuevas.length}`} titulo="Nuevas bien definidas"
                                    tono={nuevasMal.length ? 'aviso' : ''} detalle={`Abiertas creadas desde el ${fecha(datos.obligatorio_desde)}, cuando pasó a ser obligatorio`} />
                            </div>
                            {incompletas.length === 0 ? <Vacio>Todas las tareas abiertas tienen propósito y criterios.</Vacio> : tabla(incompletas, [
                                ['Le falta', (t) => [t.sin_criterio && 'criterio', t.sin_proposito && 'propósito'].filter(Boolean).join(' y ')],
                                ['Origen', (t) => (t.nueva ? <span className="ie-rojo">Nueva</span> : 'Anterior a la regla')],
                            ])}
                        </>
                    )}

                    {!error && datos && pestana === 'vistobueno' && (
                        <>
                            <div className="ie-kpis">
                                <Kpi numero={esperando.length} titulo="Esperan visto bueno hoy" tono={esperando.length ? 'aviso' : 'ok'}
                                    detalle={esperando[0]?.dias_esperando_vb ? `La más antigua, ${esperando[0].dias_esperando_vb} días` : ''} />
                                <Kpi numero={diasVb.length ? `${coma(mediana(diasVb))} d` : '—'} titulo="Espera típica (mediana)"
                                    detalle={`${diasVb.length} vistos buenos en el periodo · promedio ${coma(promedio(diasVb))} d`} />
                                <Kpi numero={lentosVb} titulo="Tardaron más de 7 días" tono={lentosVb ? 'aviso' : 'ok'}
                                    detalle={diasVb.length >= MINIMO_PCT ? `${pct(lentosVb, diasVb.length)} % del periodo` : ''} />
                            </div>
                            {diasVb.length > 0 && (
                                <section className="ie-grafica">
                                    <h3>¿Cuánto tarda el visto bueno?</h3>
                                    <p className="ie-sub">Días desde que se crea la tarea hasta que su líder la aprueba.</p>
                                    <ResponsiveContainer width="100%" height={210}>
                                        <BarChart data={tramosVb} margin={{ top: 18, right: 12, left: -16, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="texto" tick={{ fontSize: 12 }} />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                            <Tooltip formatter={(v) => [v, 'Tareas']} />
                                            <Bar dataKey="tareas" fill="#2563eb" radius={[4, 4, 0, 0]}>
                                                <LabelList dataKey="tareas" position="top" style={{ fontSize: 12, fill: '#334155' }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </section>
                            )}
                            {esperando.length === 0 ? <Vacio>Ninguna tarea abierta espera visto bueno.</Vacio> : tabla(esperando, [
                                ['Estado', (t) => t.estado],
                                ['Esperando', (t) => <span className={t.dias_esperando_vb > 7 ? 'ie-rojo' : ''}>{t.dias_esperando_vb === null ? '—' : `${t.dias_esperando_vb} días`}</span>],
                            ])}
                        </>
                    )}

                    {!error && datos && pestana === 'aceptacion' && (
                        <>
                            <div className="ie-kpis">
                                <Kpi numero={enRevision.length} titulo="En revisión hoy" tono={enRevision.length ? 'aviso' : 'ok'} detalle="Entregadas, esperan al líder" />
                                <Kpi numero={manuales.length} titulo="Entregas decididas" detalle={`${decisiones.length - manuales.length} más se aceptaron solas (independencia)`} />
                                <Kpi numero={manuales.length >= MINIMO_PCT ? `${pct(devueltas.length, manuales.length)} %` : `${devueltas.length} de ${manuales.length}`}
                                    titulo="Devueltas" detalle="Con correcciones" tono={devueltas.length ? 'aviso' : ''} />
                                <Kpi numero={diasRevision.length ? `${coma(mediana(diasRevision))} d` : '—'} titulo="Tiempo en revisión (mediana)"
                                    detalle={diasRevision.length ? `${diasRevision.length} con el envío registrado` : 'Sin envíos registrados'} />
                            </div>
                            {manuales.length > 0 && manuales.length < MINIMO_PCT && (
                                <p className="ipr-aviso">Hay pocas decisiones en el periodo: sirven como casos, todavía no como tendencia.</p>
                            )}
                            {enRevision.length > 0 && <>
                                <p className="ie-sub">En revisión ahora</p>
                                {tabla(enRevision, [['Esperando', (t) => (t.dias_en_revision === null ? '—' : `${t.dias_en_revision} días`)]])}
                            </>}
                            {decisiones.length === 0 ? <Vacio>No hubo decisiones de entrega en el periodo.</Vacio> : <>
                                <p className="ie-sub" style={{ marginTop: '1rem' }}>Decisiones del periodo</p>
                                {tabla(decisiones, [
                                    ['Resultado', (d) => <span className={d.resultado === 'Devuelta' ? 'ie-rojo' : ''}>{d.resultado}{d.automatica && <small className="id-cargo">automática</small>}</span>],
                                    ['Fecha', (d) => <>{fecha(d.cuando)}{d.resuelta_por && <small className="id-cargo">{d.resuelta_por}</small>}</>],
                                    ['En revisión', (d) => (d.dias === null ? '—' : `${d.dias} d`)],
                                    ['Observación', (d) => <span className="irp-motivo">{d.observacion || '—'}</span>],
                                ], (d) => d.aceptacion_id)}
                            </>}
                        </>
                    )}

                    {!error && datos && porLider.length > 0 && (
                        <div className="ie-tabla-caja" style={{ marginTop: '1.25rem' }}>
                            <p className="ie-sub"><b>Por líder</b> · quien tiene varios líderes cuenta con cada uno. Pulsa uno para filtrar.</p>
                            <table className="ie-tabla" data-sin-movil="">
                                <thead>
                                    <tr>
                                        <th>Líder</th><th className="num">Abiertas</th><th className="num">Sin criterio</th><th className="num">Esperan v. bueno</th>
                                        <th className="num">Mediana v. bueno</th><th className="num">En revisión</th><th className="num">Devueltas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {porLider.map((l) => (
                                        <tr key={l.nombre} className="ie-fila-accion" onClick={() => setLider(l.nombre)}>
                                            <td><b className={l.nombre === SIN_LIDER ? '' : 'ie-nombre'}>{nombre(l.nombre)}</b></td>
                                            <td className="num">{l.abiertas}</td>
                                            <td className="num">{l.sinCriterio}</td>
                                            <td className="num"><span className={l.esperando ? 'ie-rojo' : ''}>{l.esperando}</span></td>
                                            <td className="num">{l.vb.length ? `${coma(mediana(l.vb))} d` : '—'}</td>
                                            <td className="num">{l.revision}</td>
                                            <td className="num">{l.manuales ? `${l.devueltas} de ${l.manuales}` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
