import React, { useEffect, useMemo, useState } from 'react';
import axiosInstance from '../../axiosConfig';
import PlanoOficina from './PlanoOficina';
import PanelPuesto from './PanelPuesto';
// El plano también se abre desde el menú de opciones, sin pasar por el tablero,
// así que carga su propia hoja de estilos. Webpack la incluye una sola vez.
import './tablero.css';

/**
 * Plano de la oficina: planta 2D.
 *
 * El tablero ordena el trabajo por estado; aquí se ordena por lugar. Cada
 * departamento es una sala con sus escritorios, dibujada en vista cenital: una
 * sala entera en rojo se reconoce de lejos, que es lo que las columnas no
 * muestran.
 *
 * La planta reproduce el plano real de la oficina, con sus dos pisos (ver
 * distribucionOficina.js); aquí sólo se reparte a la gente en sus salas.
 *
 * Muestra la organización completa con el equipo propio resaltado. Abrir un
 * puesto sólo consulta: actuar sobre una tarea sigue pasando por los permisos
 * de cada endpoint.
 */
export default function TableroPlano({
    datosTablero,
    interactivo,
    onVerTarea,
    onCerrar,
    // Fuera del tablero el modal necesita su propia capa y sus propios
    // colores: dentro de .tb-root los hereda, en «Mis Tareas» no existen.
    sueltoEnPagina = false,
    // Dentro del espacio de equipo el plano es una pestaña más: no lleva su
    // propio modal ni su cabecera, que ya pone el contenedor.
    incrustado = false,
}) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(false);
    const [soloMios, setSoloMios] = useState(false);
    const [elegido, setElegido] = useState(null);

    useEffect(() => {
        let vivo = true;
        axiosInstance.get('/tablero/plano')
            .then((r) => vivo && setDatos(r.data))
            .catch(() => vivo && setError(true));
        return () => { vivo = false; };
    }, []);

    useEffect(() => {
        const onKey = (ev) => {
            if (ev.key !== 'Escape') return;
            ev.stopPropagation();
            // La ficha se cierra antes que el plano, como el plano antes que el tablero.
            if (elegido) { setElegido(null); return; }
            onCerrar();
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [onCerrar, elegido]);

    // La tarea completa ya viaja en las columnas del tablero; el plano sólo
    // manda el id para no repetir esos campos en 25 puestos.
    const tareaCompleta = (id) => {
        const col = datosTablero?.columnas || {};
        return [
            ...(col.pendiente || []),
            ...(col.proceso || []),
            ...(col.revision || []),
            ...(col.pausa || []),
            ...(col.completadas?.items || []),
        ].find((t) => t.id === id) || null;
    };

    const abrirTarea = (id) => {
        const completa = tareaCompleta(id);
        if (completa) onVerTarea(completa);
    };

    // El plano ya no reparte las salas: viene del plano real de la oficina,
    // en planoOficina.js. Aquí sólo se eligen los puestos a mostrar.
    const zonas = datos?.zonas || [];

    const puestoElegido = useMemo(() => {
        if (!elegido) return null;
        for (const z of zonas) {
            const p = z.puestos.find((x) => x.id === elegido);
            if (p) return p;
        }
        return null;
    }, [elegido, zonas]);

    const contenido = (
        <div className="tb-modal-body tb-pm-body">
            {error && <p className="tb-col-vacia">No fue posible cargar el plano.</p>}
            {!error && datos === null && <p className="tb-col-vacia">Cargando…</p>}

            {datos && zonas.length === 0 && (
                <p className="tb-col-vacia">No hay puestos que mostrar.</p>
            )}

            {datos && zonas.length > 0 && (
                <div className="tb-pm-escena">
                    <PlanoOficina
                        zonas={zonas}
                        miEquipoTotal={datos.mi_equipo_total}
                        elegido={elegido}
                        onElegir={(p) => setElegido(p.id)}
                        soloMios={soloMios}
                        onSoloMios={() => { setSoloMios((v) => !v); setElegido(null); }}
                    />

                    {puestoElegido && (
                        <PanelPuesto
                            puesto={puestoElegido}
                            interactivo={interactivo && Boolean(datosTablero)}
                            onAbrirTarea={abrirTarea}
                            onCerrar={() => setElegido(null)}
                        />
                    )}
                </div>
            )}
        </div>
    );

    // Incrustado: sólo el plano; la caja y el cierre los pone el contenedor,
    // que aquí es el espacio de equipo.
    if (incrustado) {
        return <div className="tb-pm-incrustado">{contenido}</div>;
    }

    const modal = (
        <div className="tb-modal-fondo" onClick={onCerrar}>
            <section
                className="tb-modal tb-modal-plano"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Plano de la oficina"
            >
                <header className="tb-modal-head">
                    <h2>Plano de la oficina</h2>
                    <button className="tb-modal-cerrar" onClick={onCerrar} title="Cerrar (Esc)">✕</button>
                </header>
                {contenido}
            </section>
        </div>
    );

    if (!sueltoEnPagina) return modal;

    return <div className="tb-modal-plano-raiz">{modal}</div>;
}
