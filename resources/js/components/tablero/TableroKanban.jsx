import React, { useMemo, useState } from 'react';
import TableroCard from './TableroCard';
import useFlipTarjetas from './useFlipTarjetas';
import useCarruselDestaque from './useCarruselDestaque';
import ModalDestaque, { DetalleTarea } from './ModalDestaque';

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

export default function TableroKanban({ datos, previo, modoTv, interactivo }) {
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

    // Escala de temperatura relativa al conjunto visible. Con cortes fijos en
    // meses el reparto depende de lo desfasado que esté el tablero: aquí todas
    // las tareas llevan entre 63 y 427 días vencidas y el 80% caía en el mismo
    // nivel, con lo que volvían a verse iguales. Repartiendo por cuartiles del
    // retraso real siempre hay contraste, sea cual sea la antigüedad absoluta.
    const cortes = useMemo(() => {
        const retrasos = UBICACIONES
            .flatMap((c) => items(datos.columnas, c))
            .filter((t) => !t.fecha_entregada && t.dias_restantes !== null && t.dias_restantes < 0)
            .map((t) => Math.abs(t.dias_restantes))
            .sort((a, b) => a - b);

        if (retrasos.length < 4) return null;
        const p = (q) => retrasos[Math.floor(q * (retrasos.length - 1))];
        return [p(0.25), p(0.5), p(0.75)];
    }, [datos]);

    // En modo TV se recorta cada columna a lo que cabe sin scroll. Con las
    // tarjetas dimensionadas en vh caben unas doce en una pantalla 16:9; el
    // resto se resume en el contador "+N más" al pie de la columna.
    const tope = modoTv ? 12 : 40;

    // Secciones que recorre el carrusel: las tres columnas y las alertas. Cada
    // una se muestra entera y se hace zoom sobre sus elementos uno a uno.
    const secciones = useMemo(() => {
        const desdeColumna = (clave, titulo, color, orden) => {
            const lista = items(datos.columnas, clave);
            return {
                clave, titulo, color, orden,
                total: lista.length,
                elementos: lista.slice(0, 6),
                restantes: Math.max(0, lista.length - 6),
            };
        };

        const a = datos.alertas || {};
        const filasAlerta = [
            { id: 'vencidas', n: a.vencidas, texto: 'tareas vencidas', tono: 'al-roja',
              detalle: 'Pasaron su fecha pactada y siguen sin entregarse.' },
            { id: 'hoy', n: a.vencen_hoy, texto: 'vencen hoy', tono: 'al-naranja',
              detalle: 'Su plazo termina hoy: conviene cerrarlas en la jornada.' },
            { id: 'semana', n: a.proximas, texto: 'vencen esta semana', tono: 'al-amarilla',
              detalle: 'Entran en plazo durante los próximos siete días.' },
            { id: 'pausa', n: a.pausadas, texto: 'tareas en pausa', tono: 'al-azul',
              detalle: 'Detenidas a la espera de reanudarse; no avanzan mientras tanto.' },
        ].filter((f) => f.n > 0);

        return [
            desdeColumna('pendiente', 'POR HACER', 'col-pendiente', 0),
            desdeColumna('proceso', 'EN PROCESO', 'col-proceso', 1),
            desdeColumna('completadas', 'COMPLETADAS', 'col-completadas', 2),
            {
                clave: 'alertas', titulo: 'ALERTAS', color: 'col-alertas', orden: 3,
                total: filasAlerta.length,
                elementos: filasAlerta,
                restantes: 0,
            },
        ];
    }, [datos]);

    const { seccion: seccionActiva, indice, girando } =
        useCarruselDestaque(secciones, { activo: !interactivo });
    const seccionEnPantalla = secciones.find((s) => s.orden === seccionActiva) || null;

    const [tareaAbierta, setTareaAbierta] = useState(null);

    return (
        <div className={`tb-kanban ${interactivo ? 'es-interactivo' : ''}`}>
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
                                    cortes={cortes}
                                    onAbrir={interactivo ? () => setTareaAbierta(t) : undefined}
                                />
                            ))}
                            {lista.length === 0 && <p className="tb-col-vacia">Sin tareas</p>}
                            {ocultas > 0 && <p className="tb-col-mas">+{ocultas} más</p>}
                        </div>
                    </section>
                );
            })}

            {tareaAbierta && (
                <DetalleTarea
                    tarea={tareaAbierta}
                    cortes={cortes}
                    onCerrar={() => setTareaAbierta(null)}
                />
            )}

            <ModalDestaque
                seccion={seccionEnPantalla}
                indice={indice}
                girando={girando}
                cortes={cortes}
            />
        </div>
    );
}
