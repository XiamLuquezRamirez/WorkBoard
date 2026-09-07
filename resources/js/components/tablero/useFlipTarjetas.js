import { useCallback, useLayoutEffect, useRef } from 'react';

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
 * `firma` debe describir el CONTENIDO del tablero (qué tarjeta está en qué
 * columna), no la respuesta del servidor: el sondeo devuelve una marca de
 * tiempo distinta cada pocos segundos y usarla remediría todas las tarjetas
 * continuamente sin que nada hubiera cambiado.
 *
 * Devuelve `registrar(id)`, una ref callback para cada tarjeta.
 */
export default function useFlipTarjetas(firma, { activo = true } = {}) {
    const nodosRef = useRef(new Map());
    const posicionesRef = useRef(new Map());
    const callbacksRef = useRef(new Map());

    // Cada id conserva SIEMPRE la misma ref callback. Si se devolviera una
    // función nueva en cada render, React trataría la ref como cambiada:
    // invocaría la anterior con null —borrando el nodo del mapa— antes de
    // registrar la nueva, y al medir ya no quedaría posición previa que
    // comparar, de modo que ninguna tarjeta llegaría a animarse.
    const registrar = useCallback((id) => {
        const cache = callbacksRef.current;
        if (!cache.has(id)) {
            cache.set(id, (nodo) => {
                if (nodo) nodosRef.current.set(id, nodo);
                else nodosRef.current.delete(id);
            });
        }
        return cache.get(id);
    }, []);

    useLayoutEffect(() => {
        const nodos = nodosRef.current;
        const previas = posicionesRef.current;

        const reduceMovimiento = typeof window !== 'undefined'
            && window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (activo && !reduceMovimiento) {
            nodos.forEach((nodo, id) => {
                const previa = previas.get(id);
                if (!previa) return;

                const actual = nodo.getBoundingClientRect();
                // Una tarjeta oculta (columna fuera de pantalla) mide 0: no se anima.
                if (actual.width === 0 && actual.height === 0) return;

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

                        const limpiar = () => {
                            nodo.style.transition = '';
                            nodo.style.transform = '';
                            nodo.style.zIndex = '';
                            nodo.classList.remove('tb-card-viajando');
                            nodo.removeEventListener('transitionend', limpiar);
                            clearTimeout(seguro);
                        };
                        // Si la transición no llega a emitirse (tarjeta oculta,
                        // pestaña en segundo plano), el respaldo evita que la
                        // tarjeta quede con estilos en línea pegados.
                        const seguro = setTimeout(limpiar, 900);
                        nodo.addEventListener('transitionend', limpiar);
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

        // Descartar del caché de callbacks los ids que ya no están en pantalla,
        // para que el mapa no crezca indefinidamente durante toda la jornada.
        if (callbacksRef.current.size > nodos.size * 3 + 60) {
            const vivos = new Map();
            nodos.forEach((_, id) => {
                if (callbacksRef.current.has(id)) vivos.set(id, callbacksRef.current.get(id));
            });
            callbacksRef.current = vivos;
        }
    }, [firma, activo]);

    // El carrusel necesita saber dónde está la tarjeta destacada para que la
    // ficha ampliada parezca surgir de ella.
    const rectDe = useCallback((id) => {
        const nodo = nodosRef.current.get(String(id));
        return nodo ? nodo.getBoundingClientRect() : null;
    }, []);

    return Object.assign(registrar, { rectDe });
}
