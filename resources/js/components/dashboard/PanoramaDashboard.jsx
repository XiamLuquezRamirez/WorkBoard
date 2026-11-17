import React, { useEffect, useMemo, useState } from 'react';
import {
    ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import axiosInstance from '../../axiosConfig';
import './panorama.css';

/**
 * Panorama del dashboard: cómo evoluciona el uso de la plataforma semana a
 * semana y cómo está cada área.
 *
 * Colores: los dos primeros de la paleta categórica validada (azul y
 * naranja), comprobados para daltonismo; cada serie además lleva su nombre en
 * la leyenda, así que el color nunca es la única pista.
 */
const AZUL = '#2a78d6';
const NARANJA = '#eb6834';
const TINTA = '#52514e';
const REJILLA = '#e7e6e2';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const semanaCorta = (iso) => {
    const [y, m, d] = String(iso).split('-').map(Number);
    return `${d} ${MESES[m - 1]}${y !== new Date().getFullYear() ? ` ${String(y).slice(2)}` : ''}`;
};

const semanaLarga = (iso) => {
    const [y, m, d] = String(iso).split('-').map(Number);
    return `Semana del ${d} de ${MESES[m - 1]} de ${y}`;
};

/** Tooltip común: el valor manda, la etiqueta acompaña. */
function Globo({ active, payload, label, series }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="pd-globo">
            <p className="pd-globo-titulo">{semanaLarga(label)}</p>
            {series.map((s) => {
                const v = payload.find((p) => p.dataKey === s.clave)?.value ?? 0;
                return (
                    <p key={s.clave} className="pd-globo-fila">
                        <i style={{ background: s.color }} aria-hidden="true" />
                        <strong>{v}</strong> {s.nombre}
                    </p>
                );
            })}
        </div>
    );
}

function Leyenda({ series }) {
    return (
        <ul className="pd-leyenda">
            {series.map((s) => (
                <li key={s.clave}>
                    <i style={{ background: s.color }} aria-hidden="true" />
                    {s.nombre}
                </li>
            ))}
        </ul>
    );
}

const SERIE_TAREAS = [
    { clave: 'creadas', nombre: 'tareas creadas', color: AZUL },
    { clave: 'entregadas', nombre: 'tareas entregadas', color: NARANJA },
];
const SERIE_PERSONAS = [{ clave: 'personas', nombre: 'personas movieron trabajo', color: AZUL }];

const eje = { fontSize: 11, fill: TINTA };

function Tendencia({ departamento }) {
    const [semanas, setSemanas] = useState(26);
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(false);
    const [verTabla, setVerTabla] = useState(false);

    useEffect(() => {
        let vivo = true;
        setError(false);
        axiosInstance.get('/dashboard/tendencia', { params: { semanas, departamento: departamento || undefined } })
            .then((r) => vivo && setDatos(r.data))
            .catch(() => vivo && setError(true));
        return () => { vivo = false; };
    }, [semanas, departamento]);

    const filas = datos?.semanas || [];

    // Lectura en una frase: compara las últimas 4 semanas con las 4 anteriores.
    const resumen = useMemo(() => {
        if (filas.length < 8) return null;
        const suma = (xs, k) => xs.reduce((a, s) => a + s[k], 0);
        const ult = filas.slice(-4);
        const ant = filas.slice(-8, -4);
        return {
            creadas: suma(ult, 'creadas'),
            creadasAntes: suma(ant, 'creadas'),
            entregadas: suma(ult, 'entregadas'),
            personas: Math.round(suma(ult, 'personas') / 4),
            semanasSinNada: [...filas].reverse().findIndex((s) => s.creadas + s.entregadas + s.personas > 0),
        };
    }, [filas]);

    const total = datos?.total_personas || 0;

    return (
        <section className="pd-tarjeta pd-tendencia" aria-labelledby="pd-tendencia-titulo">
            <header className="pd-cab">
                <div>
                    <h2 id="pd-tendencia-titulo">Uso de la plataforma por semana</h2>
                    <p className="pd-sub">
                        {departamento || 'Toda la organización'}
                        {resumen && (
                            resumen.semanasSinNada > 0
                                ? ` · ${resumen.semanasSinNada} semana${resumen.semanasSinNada === 1 ? '' : 's'} seguidas sin ningún movimiento`
                                : resumen.semanasSinNada === -1
                                    ? ' · sin movimientos en todo el período'
                                    : ` · últimas 4 semanas: ${resumen.creadas} creadas (antes ${resumen.creadasAntes}), ${resumen.entregadas} entregadas, ${resumen.personas} personas activas de media`
                        )}
                    </p>
                </div>
                <div className="pd-controles">
                    <div className="pd-segmentos" role="group" aria-label="Período">
                        {[12, 26, 52].map((n) => (
                            <button
                                key={n}
                                type="button"
                                className={semanas === n ? 'es-activo' : ''}
                                aria-pressed={semanas === n}
                                onClick={() => setSemanas(n)}
                            >
                                {n === 52 ? '1 año' : `${n} sem`}
                            </button>
                        ))}
                    </div>
                    <button type="button" className="pd-enlace" onClick={() => setVerTabla((v) => !v)}>
                        {verTabla ? 'Ver gráficas' : 'Ver como tabla'}
                    </button>
                </div>
            </header>

            {error && <p className="pd-vacio">No fue posible cargar la tendencia.</p>}
            {!error && !datos && <p className="pd-vacio">Cargando…</p>}

            {datos && !verTabla && (
                <div className="pd-graficas">
                    <figure className="pd-figura">
                        <figcaption>Tareas creadas y entregadas</figcaption>
                        <Leyenda series={SERIE_TAREAS} />
                        <ResponsiveContainer width="100%" height={210}>
                            <LineChart data={filas} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                                <CartesianGrid stroke={REJILLA} vertical={false} />
                                <XAxis dataKey="inicio" tickFormatter={semanaCorta} tick={eje} tickLine={false}
                                    axisLine={{ stroke: REJILLA }} minTickGap={24} />
                                <YAxis allowDecimals={false} tick={eje} tickLine={false} axisLine={false} />
                                <Tooltip content={<Globo series={SERIE_TAREAS} />}
                                    cursor={{ stroke: TINTA, strokeWidth: 1, strokeDasharray: '3 3' }} />
                                {SERIE_TAREAS.map((s) => (
                                    // Rectas entre semanas: la curva suavizada inventaba
                                    // valores entre puntos y bajaba de cero.
                                    <Line key={s.clave} type="linear" dataKey={s.clave} name={s.nombre}
                                        stroke={s.color} strokeWidth={2} dot={false}
                                        activeDot={{ r: 4.5, stroke: '#fff', strokeWidth: 2 }}
                                        isAnimationActive={false} />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </figure>

                    <figure className="pd-figura">
                        <figcaption>Personas que movieron trabajo <span>de {total}</span></figcaption>
                        <p className="pd-nota">La línea discontinua es el total de personas activas.</p>
                        <ResponsiveContainer width="100%" height={210}>
                            <BarChart data={filas} margin={{ top: 8, right: 12, bottom: 0, left: -18 }} barCategoryGap={2}>
                                <CartesianGrid stroke={REJILLA} vertical={false} />
                                <XAxis dataKey="inicio" tickFormatter={semanaCorta} tick={eje} tickLine={false}
                                    axisLine={{ stroke: REJILLA }} minTickGap={24} />
                                <YAxis allowDecimals={false} tick={eje} tickLine={false} axisLine={false}
                                    domain={[0, Math.max(total, 1)]}
                                    ticks={[...new Set([0, Math.round(total / 2), Math.max(total, 1)])]} />
                                <Tooltip content={<Globo series={SERIE_PERSONAS} />} cursor={{ fill: 'rgba(42,120,214,.08)' }} />
                                <ReferenceLine y={total} stroke={TINTA} strokeDasharray="4 4"
                                    label={{ value: `${total} en total`, position: 'insideTopRight', fontSize: 11, fill: TINTA }} />
                                <Bar dataKey="personas" fill={AZUL} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    </figure>
                </div>
            )}

            {datos && verTabla && (
                <div className="pd-tabla-caja">
                    <table className="pd-tabla">
                        <thead>
                            <tr><th>Semana</th><th>Creadas</th><th>Entregadas</th><th>Personas activas</th></tr>
                        </thead>
                        <tbody>
                            {[...filas].reverse().map((s) => (
                                <tr key={s.inicio}>
                                    <td>{semanaLarga(s.inicio).replace('Semana del ', '')}</td>
                                    <td>{s.creadas}</td>
                                    <td>{s.entregadas}</td>
                                    <td>{s.personas} / {total}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

/**
 * Una fila por área: permite pedir cuentas al líder, no sólo a cada persona.
 * Pulsar un área filtra el dashboard por ella.
 */
function ResumenAreas({ empleados, departamento, onElegir }) {
    const areas = useMemo(() => {
        const grupos = new Map();
        for (const e of empleados) {
            const k = e.departamento || 'Sin departamento';
            if (!grupos.has(k)) grupos.set(k, []);
            grupos.get(k).push(e.indicadores || {});
        }
        return [...grupos.entries()].map(([nombre, ind]) => {
            const conIndice = ind.filter((i) => i.indice != null);
            const c30 = ind.reduce((a, i) => a + (i.completadas_30 || 0), 0);
            return {
                nombre,
                personas: ind.length,
                activos: ind.filter((i) => i.activo_semana).length,
                graves: ind.reduce((a, i) => a + (i.vencidas_graves || 0), 0),
                aTiempo: c30 > 0 ? Math.round((ind.reduce((a, i) => a + (i.a_tiempo_30 || 0), 0) / c30) * 100) : null,
                entregas30: c30,
                indice: conIndice.length ? Math.round(conIndice.reduce((a, i) => a + i.indice, 0) / conIndice.length) : null,
            };
        }).sort((a, b) => b.graves - a.graves || (a.activos / a.personas) - (b.activos / b.personas) || a.nombre.localeCompare(b.nombre));
    }, [empleados]);

    return (
        <section className="pd-tarjeta pd-areas" aria-labelledby="pd-areas-titulo">
            <header className="pd-cab">
                <div>
                    <h2 id="pd-areas-titulo">Por área</h2>
                    <p className="pd-sub">Pulsa un área para ver sólo a su gente. Las que más vencidas acumulan, primero.</p>
                </div>
                {departamento && (
                    <button type="button" className="pd-enlace" onClick={() => onElegir('')}>Ver todas</button>
                )}
            </header>
            <div className="pd-tabla-caja">
                <table className="pd-tabla pd-tabla-areas">
                    <thead>
                        <tr>
                            <th>Área</th>
                            <th title="Personas con algún movimiento en los últimos 7 días">Movieron trabajo esta semana</th>
                            <th title="Tareas abiertas vencidas hace más de 7 días">Vencidas +7 días</th>
                            <th title="Entregas de los últimos 30 días en su fecha o antes">A tiempo · 30 días</th>
                            <th title="Promedio del índice de desempeño de quienes tienen algo que evaluar (90 días)">Índice medio</th>
                        </tr>
                    </thead>
                    <tbody>
                        {areas.map((a) => (
                            <tr
                                key={a.nombre}
                                className={departamento === a.nombre ? 'es-elegida' : ''}
                                onClick={() => onElegir(departamento === a.nombre ? '' : a.nombre)}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onElegir(departamento === a.nombre ? '' : a.nombre);
                                    }
                                }}
                                aria-pressed={departamento === a.nombre}
                            >
                                <th scope="row">{a.nombre}</th>
                                <td>
                                    <span className={a.activos / a.personas < 0.5 ? 'pd-mal' : ''}>{a.activos}</span>
                                    <span className="pd-de"> / {a.personas}</span>
                                </td>
                                <td><span className={a.graves > 0 ? 'pd-mal' : ''}>{a.graves}</span></td>
                                <td>
                                    {a.aTiempo === null
                                        ? <span className="pd-de">sin entregas</span>
                                        : <>{a.aTiempo}%<span className="pd-de"> de {a.entregas30}</span></>}
                                </td>
                                <td>{a.indice === null ? <span className="pd-de">—</span> : `${a.indice}%`}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export default function PanoramaDashboard({ empleados, departamento, onElegirDepartamento }) {
    const [abierto, setAbierto] = useState(true);

    return (
        <div className="pd-panorama">
            <button
                type="button"
                className="pd-plegar"
                onClick={() => setAbierto((v) => !v)}
                aria-expanded={abierto}
            >
                {abierto ? '▾' : '▸'} Panorama: tendencia y áreas
            </button>
            {abierto && (
                <div className="pd-cuerpo">
                    <Tendencia departamento={departamento} />
                    <ResumenAreas empleados={empleados} departamento={departamento} onElegir={onElegirDepartamento} />
                </div>
            )}
        </div>
    );
}
