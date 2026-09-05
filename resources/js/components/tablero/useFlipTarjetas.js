import { useLayoutEffect, useRef } from 'react';

/**
 * Transición FLIP para las tarjetas del kanban.
 *
 * En lugar de que una tarjeta desaparezca de una columna y reaparezca en otra,
 * se mide su posición antes y después del render y se anima el trayecto real
 * entre ambas: la tarjeta "viaja" a su nueva columna.
 *
 * FLIP = First, Last, Invert, Play. Se guarda la posición previa (First), se
 * deja que React pinte la nueva (Last), se aplica una transformación que la
 * devuelve visualmente a donde estaba (Invert) y se anima hasta cero (Play).
 * Todo ocurre con transform/opacity, que el navegador compone en GPU y no
 * provocan reflow, algo necesario en una pantalla encendida todo el día.
 *
 * Devuelve `registrar(id)`, una ref callback para cada tarjeta.
 */
export default function useFlipTarjetas(dependencia, { activo = true } = {}) {
    const nodosRef = useRef(new Map());
    const posicionesRef = useRef(new Map());

    const registrar = (id) => (nodo) => {
        if (nodo) nodosRef.current.set(id, nodo);
        else nodosRef.current.delete(id);
    };

    useLayoutEffect(() => {
        const nodos = nodosRef.current;
        const previas = posicionesRef.current;

        // Respeta la preferencia del sistema de reducir movimiento.
        const reduceMovimiento = typeof window !== 'undefined'
            && window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (activo && !reduceMovimiento) {
            nodos.forEach((nodo, id) => {
                const previa = previas.get(id);
                if (!previa) return;

                const actual = nodo.getBoundingClientRect();
                const dx = previa.left - actual.left;
                const dy = previa.top - actual.top;

                // Sólo interesa el desplazamiento real entre columnas; los
                // reacomodos de un par de píxeles dentro de la misma lista no
                // merecen animarse.
                if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;

                const viajaLejos = Math.abs(dx) > 40;

                nodo.style.transition = 'none';
                nodo.style.transform = `translate(${dx}px, ${dy}px)`;
                nodo.style.zIndex = viajaLejos ? '5' : '';
                if (viajaLejos) nodo.classList.add('tb-card-viajando');

                // Doble rAF: el primero cierra el frame en que se aplicó la
                // inversión, el segundo lanza la transición ya con el estilo
                // asentado. Con uno solo el navegador puede fusionar ambos
                // estados y no animar nada.
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        nodo.style.transition =
                            'transform 620ms cubic-bezier(.22,.68,.32,1.02)';
                        nodo.style.transform = '';

                        const alTerminar = () => {
                            nodo.style.transition = '';
                            nodo.style.zIndex = '';
                            nodo.classList.remove('tb-card-viajando');
                            nodo.removeEventListener('transitionend', alTerminar);
                        };
                        nodo.addEventListener('transitionend', alTerminar);
                    });
                });
            });
        }

        // Guardar las posiciones de este render para comparar en el siguiente.
        const nuevas = new Map();
        nodos.forEach((nodo, id) => {
            const r = nodo.getBoundingClientRect();
            nuevas.set(id, { top: r.top, left: r.left });
        });
        posicionesRef.current = nuevas;
    }, [dependencia, activo]);

    return registrar;
}
