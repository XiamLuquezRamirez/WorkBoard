import React, { useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import './explicacionIndice.css';

/**
 * Cómo se calcula el Índice de Desempeño (App\Support\IndiceDesempeno).
 *
 * Con «indicadores» de una persona muestra primero SU cuenta, factor por
 * factor, con los números que devolvió el servidor (desglose). Sin ellos,
 * sólo la explicación general.
 */

/** Respaldo cuando no hay desglose; los pesos reales llegan del servidor. */
const PESOS_POR_DEFECTO = { completitud: 40, puntualidad: 25, vigencia: 20, calidad: 15 };

const FACTORES = {
    completitud: {
        nombre: 'Completitud',
        que: 'Lo exigible que terminó: completadas ÷ (completadas + vencidas).',
        cuenta: (p, d) => `${p} de ${d} completadas`,
    },
    puntualidad: {
        nombre: 'Puntualidad',
        que: 'Completadas entregadas en su fecha pactada o antes. Sin fecha pactada cuenta a tiempo.',
        cuenta: (p, d) => `${p} de ${d} a tiempo`,
    },
    vigencia: {
        nombre: 'Al día',
        que: 'Asignadas (abiertas + completadas) que no están vencidas.',
        cuenta: (p, d) => `${p} de ${d} sin vencer`,
    },
    calidad: {
        nombre: 'Calidad',
        que: 'Completadas que no se devolvieron para corregir (reproceso).',
        cuenta: (p, d) => `${p} de ${d} sin reproceso`,
    },
};

const pct = (tasa) => `${Math.round(tasa * 100)}%`;
const num = (n) => String(n).replace('.', ',');

export default function ExplicacionIndice({ nombre, indicadores, onCerrar }) {
    useEffect(() => {
        const alTeclear = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [onCerrar]);

    const ind = indicadores || null;
    const desglose = Array.isArray(ind?.desglose) ? ind.desglose : null;
    const pesos = desglose
        ? Object.fromEntries(desglose.map((f) => [f.factor, f.peso]))
        : PESOS_POR_DEFECTO;
    const ventana = ind?.ventana_dias || 90;

    return (
        <div className="ei-fondo" onClick={onCerrar}>
            <section className="ei-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="ei-titulo">
                <header className="ei-cab">
                    <div>
                        <h2 id="ei-titulo">¿Cómo se calcula el Índice de Desempeño?</h2>
                        {nombre && <p>{nombre}</p>}
                    </div>
                    <button type="button" className="ei-cerrar" onClick={onCerrar} aria-label="Cerrar"><FaTimes /></button>
                </header>

                <div className="ei-cuerpo">
                    {ind && (
                        <section className="ei-bloque ei-propio">
                            {desglose ? (
                                <>
                                    <h3>Su nota: <span className="ei-nota">{ind.indice}%</span></h3>
                                    <table className="ei-tabla" data-sin-movil>
                                        <thead>
                                            <tr><th>Factor</th><th>Cuenta</th><th className="ei-col-tasa">Tasa</th><th>Puntos</th></tr>
                                        </thead>
                                        <tbody>
                                            {desglose.map((f) => {
                                                const info = FACTORES[f.factor] || { nombre: f.factor, cuenta: (p, d) => `${p} de ${d}` };
                                                return (
                                                    <tr key={f.factor}>
                                                        <td>{info.nombre}</td>
                                                        <td>{f.de > 0 ? info.cuenta(f.parte, f.de) : 'Nada completado'}</td>
                                                        <td className="ei-col-tasa">{pct(f.tasa)}</td>
                                                        <td><b>{num(f.puntos)}</b> / {f.peso}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colSpan={2}>Total (redondeado)</td>
                                                <td className="ei-col-tasa" />
                                                <td><b>{ind.indice}</b> / 100</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </>
                            ) : (
                                <>
                                    <h3>Sin nota por ahora</h3>
                                    <p>{ind.mensaje || 'No tiene nada exigible en la ventana.'}</p>
                                    <p className="ei-suave">
                                        La nota aparece cuando tiene algo que juzgar: una tarea completada en
                                        los últimos {ventana} días o una tarea vencida.
                                    </p>
                                </>
                            )}
                        </section>
                    )}

                    <section className="ei-bloque">
                        <h3>Qué tareas entran</h3>
                        <ul>
                            <li><b>Abiertas</b> (ni completadas ni archivadas): todas, sin importar cuándo se crearon.</li>
                            <li><b>Completadas</b>: sólo las entregadas en los últimos {ventana} días.</li>
                            <li>
                                Sólo se juzga lo <b>exigible</b>: lo completado y lo vencido. Una tarea abierta que
                                aún no vence no sube ni baja la nota.
                            </li>
                            <li>
                                <b>Vencida</b>: abierta, con la fecha pactada ya pasada, que no está «En Revisión»
                                (ya entregada) ni pausada.
                            </li>
                        </ul>
                    </section>

                    <section className="ei-bloque">
                        <h3>La fórmula</h3>
                        <ul className="ei-factores">
                            {Object.entries(FACTORES).map(([clave, f]) => (
                                <li key={clave}>
                                    <span className="ei-peso">{pesos[clave] ?? PESOS_POR_DEFECTO[clave]}</span>
                                    <span><b>{f.nombre}</b> · {f.que}</span>
                                </li>
                            ))}
                        </ul>
                        <p className="ei-suave">
                            Cada tasa (de 0 a 1) se multiplica por su peso y se suman: el máximo es 100. Si no
                            completó nada, puntualidad y calidad valen 0.
                        </p>
                    </section>

                    <section className="ei-bloque">
                        <h3>Niveles</h3>
                        <ul className="ei-niveles">
                            <li><span className="ei-chip ei-alto">Alto</span> 75 o más</li>
                            <li><span className="ei-chip ei-medio">Medio</span> de 50 a 74</li>
                            <li><span className="ei-chip ei-bajo">Bajo</span> menos de 50</li>
                            <li><span className="ei-chip">En curso</span> tiene tareas abiertas que aún no vencen</li>
                            <li><span className="ei-chip">Sin actividad</span> nada en los últimos {ventana} días</li>
                            <li><span className="ei-chip">Sin datos</span> nunca ha tenido tareas</li>
                        </ul>
                    </section>

                    <section className="ei-bloque">
                        <h3>Lo que no cambia la nota</h3>
                        <p className="ei-suave">
                            Estas señales sólo ordenan las tarjetas para poner arriba a quien necesita atención:
                            vencidas de más de 7 días, nada movido en 7 días (los recordatorios automáticos y
                            «pide actualización» no cuentan como actividad) y no tener tareas abiertas.
                        </p>
                    </section>
                </div>
            </section>
        </div>
    );
}
