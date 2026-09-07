import { useEffect, useRef, useState } from 'react';

const DURACION = 5000;   // tiempo que cada tarjeta permanece al frente
const RESPIRO = 700;     // pausa entre una tarjeta y la siguiente

/**
 * Rota el destaque entre las tareas en proceso: una tarjeta pasa al frente,
 * permanece cinco segundos y regresa a su lugar antes de que entre la siguiente.
 *
 * Devuelve el id destacado (o null durante el respiro). El recorrido se reinicia
 * si la lista cambia, y se detiene con la pestaña oculta para no acumular
 * temporizadores en una pantalla encendida toda la jornada.
 */
export default function useCarruselDestaque(ids, { activo = true } = {}) {
    const [destacado, setDestacado] = useState(null);
    const timerRef = useRef(null);
    const posRef = useRef(0);

    // Firma estable: sin esto el efecto se reiniciaría en cada sondeo, porque
    // el array llega nuevo aunque su contenido sea idéntico.
    const firma = ids.join(',');

    useEffect(() => {
        clearTimeout(timerRef.current);
        setDestacado(null);

        const lista = firma ? firma.split(',') : [];
        if (!activo || lista.length === 0) return undefined;

        // Con una sola tarea no hay rotación que mostrar.
        if (lista.length === 1) {
            setDestacado(lista[0]);
            return () => clearTimeout(timerRef.current);
        }

        if (posRef.current >= lista.length) posRef.current = 0;

        const mostrar = () => {
            if (document.hidden) {
                timerRef.current = setTimeout(mostrar, DURACION);
                return;
            }
            setDestacado(lista[posRef.current]);
            timerRef.current = setTimeout(() => {
                setDestacado(null);          // vuelve a su sitio
                posRef.current = (posRef.current + 1) % lista.length;
                timerRef.current = setTimeout(mostrar, RESPIRO);
            }, DURACION);
        };

        timerRef.current = setTimeout(mostrar, RESPIRO);

        return () => clearTimeout(timerRef.current);
    }, [firma, activo]);

    return destacado;
}
