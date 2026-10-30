import React, { useEffect } from 'react';
import TableroSeguimiento from '../tablero/TableroSeguimiento';

/**
 * Tablero del equipo dentro de WorkBoard.
 *
 * Es el mismo tablero que se proyecta en el televisor, con dos diferencias:
 * va en tema claro, para no chocar con «Mis Tareas», y entra ya en modo
 * interacción, porque aquí nadie lo mira de lejos — se abre para revisarlo.
 *
 * No se cierra al pulsar el fondo: sobre el tablero se arrastra y se pulsa
 * constantemente, y un clic suelto cerraría todo. Se sale con la ✕ o Escape.
 */
export default function TableroEquipoModal({ onCerrar }) {
    useEffect(() => {
        const onKey = (ev) => {
            if (ev.key !== 'Escape') return;
            // El tablero gestiona su propio Escape para cerrar sus modales
            // internos; sólo se cierra el contenedor si no hay ninguno abierto.
            if (document.querySelector('.te-cuerpo .tb-modal-fondo')) return;
            ev.stopPropagation();
            onCerrar();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCerrar]);

    return (
        <div className="te-fondo">
            <section className="te-modal" role="dialog" aria-label="Tablero del equipo">
                <header className="te-cabecera">
                    <h3 className="te-titulo">Tablero del equipo</h3>
                    <button className="te-cerrar" onClick={onCerrar} title="Cerrar (Esc)">✕</button>
                </header>

                <div className="te-cuerpo">
                    <TableroSeguimiento claro interactivoInicial onCerrar={onCerrar} />
                </div>
            </section>
        </div>
    );
}
