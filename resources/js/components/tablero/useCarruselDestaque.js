import { useEffect, useRef, useState } from 'react';

const ZOOM = 10000;      // tiempo de zoom sobre cada elemento
const GIRO = 1100;       // transición entre una sección y la siguiente
const RESPIRO = 900;     // pausa entre un elemento y el siguiente
const MAX_POR_SECCION = 6;

/**
 * Recorre el tablero por secciones —las tres columnas y las alertas— y, dentro
 * de cada una, hace zoom sobre sus elementos uno a uno antes de girar a la
 * siguiente.
 *
 * Devuelve { seccion, indice, girando }: la sección visible, qué elemento tiene
 * el foco dentro de ella y si está en plena transición entre secciones. El
 * recorrido se detiene con la pestaña oculta para no acumular temporizadores en
 * una pantalla encendida toda la jornada.
 */
export default function useCarruselDestaque(secciones, { activo = true } = {}) {
    const [estado, setEstado] = useState({ seccion: 0, indice: -1, girando: false });
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
            setEstado({ seccion: 0, indice: -1, girando: false });
            return undefined;
        }

        let seccion = 0;
        let indice = 0;

        const paso = () => {
            if (document.hidden) {
                timerRef.current = setTimeout(paso, ZOOM);
                return;
            }

            const actual = vivas[seccion];
            const total = Math.min(actual.elementos.length, MAX_POR_SECCION);

            setEstado({ seccion: actual.orden, indice, girando: false });

            timerRef.current = setTimeout(() => {
                indice += 1;

                if (indice < total) {
                    // Siguiente elemento de la misma sección: sólo un respiro.
                    setEstado({ seccion: actual.orden, indice: -1, girando: false });
                    timerRef.current = setTimeout(paso, RESPIRO);
                    return;
                }

                // Sección agotada: gira a la siguiente.
                indice = 0;
                seccion = (seccion + 1) % vivas.length;
                setEstado({ seccion: vivas[seccion].orden, indice: -1, girando: true });
                timerRef.current = setTimeout(() => {
                    setEstado({ seccion: vivas[seccion].orden, indice: -1, girando: false });
                    timerRef.current = setTimeout(paso, RESPIRO);
                }, GIRO);
            }, ZOOM);
        };

        timerRef.current = setTimeout(paso, RESPIRO);

        return () => clearTimeout(timerRef.current);
        // `secciones` se reconstruye en cada render; la firma describe su
        // contenido y es lo que debe disparar el reinicio.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firma, activo]);

    return estado;
}
