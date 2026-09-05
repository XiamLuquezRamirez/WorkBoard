import React, { useMemo } from 'react';
import TableroCard from './TableroCard';

const COLUMNAS = [
    { clave: 'pendiente', titulo: 'POR HACER', color: 'col-pendiente' },
    { clave: 'proceso', titulo: 'EN PROCESO', color: 'col-proceso' },
    { clave: 'pausa', titulo: 'EN PAUSA', color: 'col-pausa' },
    { clave: 'completadas', titulo: 'COMPLETADAS', color: 'col-completadas' },
];

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
        COLUMNAS.forEach(({ clave }) => {
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

    // En modo TV se recorta cada columna a lo que cabe sin scroll.
    const tope = modoTv ? 8 : 40;

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
                                <TableroCard key={t.id} tarea={t} estadoVisual={cambios[t.id]} />
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
