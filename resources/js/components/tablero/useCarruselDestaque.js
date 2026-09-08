import { useEffect, useRef, useState } from 'react';

const BLOQUE = 12000;    // tiempo que permanece visible cada bloque
const GIRO = 1100;       // transición entre una sección y la siguiente
const RESPIRO = 700;     // pausa entre bloques de la misma sección
export const POR_BLOQUE = 5;

/**
 * Recorre el tablero por secciones —las tres columnas y las alertas— mostrando
 * cada una completa. Si sus elementos no caben en una sola vista, la sección
 * pasa por varios bloques antes de girar a la siguiente.
 *
 * Devuelve { seccion, bloque, girando }: qué sección se ve, qué bloque de ella
 * y si está en plena transición. El recorrido se detiene con la pestaña oculta
 * para no acumular temporizadores en una pantalla encendida toda la jornada.
 */
export default function useCarruselDestaque(secciones, { activo = true } = {}) {
    const [estado, setEstado] = useState({ seccion: 0, bloque: 0, girando: false });
    const timerRef = useRef(null);

    // Firma estable: sin esto el efecto se reiniciaría en cada sondeo, porque
    // el array llega nuevo aunque su contenido sea idéntico.
    const firma = secciones
        .map((s) => `${s.clave}:${s.elementos.length}`)
        .join('|');

    useEffect(() => {
        clearTimeout(timerRef.current);

        const vivas = secciones.filter((s) => s.elementos.length > 0);
        if (!activo || vivas.length === 0) {
            setEstado({ seccion: 0, bloque: 0, girando: false });
            return undefined;
        }

        let seccion = 0;
        let bloque = 0;

        const paso = () => {
            if (document.hidden) {
                timerRef.current = setTimeout(paso, BLOQUE);
                return;
            }

            const actual = vivas[seccion];
            const bloques = Math.max(1, Math.ceil(actual.elementos.length / POR_BLOQUE));

            setEstado({ seccion: actual.orden, bloque, girando: false });

            timerRef.current = setTimeout(() => {
                bloque += 1;

                if (bloque < bloques) {
                    // Quedan elementos de esta sección: se pasa al siguiente
                    // bloque sin girar, porque seguimos en la misma columna.
                    timerRef.current = setTimeout(paso, RESPIRO);
                    return;
                }

                // Sección agotada: gira a la siguiente. La salida se anima sobre
                // la sección actual y el contenido cambia después; hacerlo a la
                // vez remontaría el slide —lleva key por sección— y encadenaría
                // la animación de giro con la de entrada.
                bloque = 0;
                setEstado({ seccion: actual.orden, bloque: -1, girando: true });

                timerRef.current = setTimeout(() => {
                    seccion = (seccion + 1) % vivas.length;
                    setEstado({ seccion: vivas[seccion].orden, bloque: 0, girando: false });
                    timerRef.current = setTimeout(paso, RESPIRO);
                }, GIRO);
            }, BLOQUE);
        };

        timerRef.current = setTimeout(paso, RESPIRO);

        return () => clearTimeout(timerRef.current);
        // `secciones` se reconstruye en cada render; la firma describe su
        // contenido y es lo que debe disparar el reinicio.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firma, activo]);

    return estado;
}
