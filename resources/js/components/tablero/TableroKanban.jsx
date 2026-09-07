import React, { useMemo } from 'react';
import TableroCard from './TableroCard';
import useFlipTarjetas from './useFlipTarjetas';

/* Las pausadas no tienen columna propia: son pocas de forma habitual y una
   columna casi vacía desperdiciaba una cuarta parte del ancho. Se consultan
   desde el indicador "EN PAUSA", que abre su propio panel. */
const COLUMNAS = [
    { clave: 'pendiente', titulo: 'POR HACER', color: 'col-pendiente' },
    { clave: 'proceso', titulo: 'EN PROCESO', color: 'col-proceso' },
    { clave: 'completadas', titulo: 'COMPLETADAS', color: 'col-completadas' },
];

/* Para el cálculo de movimientos sí hay que mirar las cuatro ubicaciones:
   una tarjeta que pasa a pausa desaparece del kanban y debe detectarse. */
const UBICACIONES = ['pendiente', 'proceso', 'pausa', 'completadas'];

const items = (columnas, clave) =>
    clave === 'completadas' ? (columnas.completadas?.items || []) : (columnas[clave] || []);

/**
 * Compara el estado anterior con el actual para saber qué animación
 * corresponde a cada tarea: aparecida, movida de columna o recién pausada.
 */
function calcularCambios(datos, previo) {
    if (!previo || !datos) return {};
    const columnaDe = (estado) => {
        const mapa = {};
        UBICACIONES.forEach((clave) => {
            items(estado.columnas, clave).forEach((t) => { mapa[t.id] = clave; });
        });
        return mapa;
    };
    const antes = columnaDe(previo);
    const ahora = columnaDe(datos);
    const cambios = {};

    Object.entries(ahora).forEach(([id, col]) => {
        const colAntes = antes[id];
        if (colAntes === undefined) {
            cambios[id] = 'nueva';
        } else if (colAntes !== col) {
            cambios[id] = col === 'completadas' ? 'completada' : col === 'pausa' ? 'pausada' : 'movida';
        }
    });
    return cambios;
}

export default function TableroKanban({ datos, previo, modoTv }) {
    const cambios = useMemo(() => calcularCambios(datos, previo), [datos, previo]);
    const modoCompletadas = datos.columnas.completadas?.modo;

    // Firma del contenido: qué tarjetas hay y en qué columna está cada una. El
    // FLIP sólo debe recalcularse cuando esto cambia. Usar servidor_ts haría que
    // el efecto se disparase en cada sondeo, remidiendo todas las tarjetas cada
    // pocos segundos aunque el tablero estuviera idéntico.
    const firma = useMemo(() => UBICACIONES
        .map((clave) => `${clave}:${items(datos.columnas, clave).map((t) => t.id).join(',')}`)
        .join('|'), [datos]);

    // El desplazamiento entre columnas se anima midiendo posiciones reales, de
    // modo que la tarjeta viaje en lugar de desaparecer y reaparecer.
    const registrarTarjeta = useFlipTarjetas(firma);

    // En modo TV se recorta cada columna a lo que cabe sin scroll. Con las
    // tarjetas dimensionadas en vh caben unas doce en una pantalla 16:9; el
    // resto se resume en el contador "+N más" al pie de la columna.
    const tope = modoTv ? 12 : 40;

    return (
        <div className="tb-kanban">
            {COLUMNAS.map(({ clave, titulo, color }) => {
                const lista = items(datos.columnas, clave);
                const visibles = lista.slice(0, tope);
                const ocultas = lista.length - visibles.length;

                return (
                    <section key={clave} className={`tb-col ${color}`} aria-label={titulo}>
                        <header className="tb-col-head">
                            <h3>{titulo}</h3>
                            <span className="tb-col-count">{lista.length}</span>
                        </header>

                        {clave === 'completadas' && modoCompletadas === 'fallback' && (
                            <p className="tb-col-nota">sin cierres esta semana · últimas registradas</p>
                        )}

                        <div className="tb-col-body">
                            {visibles.map((t) => (
                                <TableroCard
                                    key={t.id}
                                    tarea={t}
                                    estadoVisual={cambios[t.id]}
                                    innerRef={registrarTarjeta(t.id)}
                                />
                            ))}
                            {lista.length === 0 && <p className="tb-col-vacia">Sin tareas</p>}
                            {ocultas > 0 && <p className="tb-col-mas">+{ocultas} más</p>}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
