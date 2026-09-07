import React, { useEffect, useRef, useState } from 'react';

/**
 * Número que transiciona hasta su nuevo valor en lugar de saltar de golpe.
 * Es lo que hace que el tablero se perciba "vivo" cuando cambia un indicador.
 */
function Numero({ valor, sufijo = '' }) {
    const [mostrado, setMostrado] = useState(valor);
    const rafRef = useRef(null);
    const desdeRef = useRef(valor);

    useEffect(() => {
        const desde = desdeRef.current;
        const hasta = valor;
        if (desde === hasta) return undefined;

        const DUR = 500;
        const t0 = performance.now();
        const paso = (t) => {
            const p = Math.min(1, (t - t0) / DUR);
            const eased = 1 - Math.pow(1 - p, 3);
            setMostrado(Math.round(desde + (hasta - desde) * eased));
            if (p < 1) rafRef.current = requestAnimationFrame(paso);
            else desdeRef.current = hasta;
        };
        rafRef.current = requestAnimationFrame(paso);

        return () => cancelAnimationFrame(rafRef.current);
    }, [valor]);

    return <span className="tb-kpi-num">{mostrado}{sufijo}</span>;
}

export default function TableroKPIs({ kpis, previo, onVerPausadas }) {
    const cambio = (clave) => previo && previo.kpis && previo.kpis[clave] !== kpis[clave];

    const tarjetas = [
        { clave: 'total', etiqueta: 'TOTAL', clase: 'kpi-total' },
        { clave: 'proceso', etiqueta: 'EN PROCESO', clase: 'kpi-proceso' },
        { clave: 'pendiente', etiqueta: 'PENDIENTES', clase: 'kpi-pendiente' },
        { clave: 'pausa', etiqueta: 'EN PAUSA', clase: 'kpi-pausa' },
        { clave: 'completadas', etiqueta: 'COMPLETADAS', clase: 'kpi-completadas' },
        { clave: 'avance_pct', etiqueta: 'AVANCE', clase: 'kpi-avance', sufijo: '%' },
    ];

    return (
        <div className="tb-kpis">
            {tarjetas.map(({ clave, etiqueta, clase, sufijo }) => {
                // Las pausadas ya no tienen columna: su indicador es el acceso a
                // la lista, así que se muestra como botón cuando hay alguna.
                const esAcceso = clave === 'pausa' && onVerPausadas && (kpis.pausa ?? 0) > 0;
                const Elemento = esAcceso ? 'button' : 'div';

                return (
                    <Elemento
                        key={clave}
                        className={`tb-kpi ${clase} ${cambio(clave) ? 'tb-kpi-cambio' : ''} ${esAcceso ? 'tb-kpi-accion' : ''}`}
                        onClick={esAcceso ? onVerPausadas : undefined}
                        title={esAcceso ? 'Ver las tareas en pausa' : undefined}
                    >
                        <Numero valor={kpis[clave] ?? 0} sufijo={sufijo || ''} />
                        <span className="tb-kpi-label">
                            {etiqueta}{esAcceso && <span className="tb-kpi-lupa"> ›</span>}
                        </span>
                    </Elemento>
                );
            })}
        </div>
    );
}
