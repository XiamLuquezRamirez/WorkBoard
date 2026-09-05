import { useCallback, useEffect, useRef, useState } from 'react';
import axiosInstance from '../../axiosConfig';

const INTERVALO_OK = 5000;   // ritmo normal de sondeo
const INTERVALO_ERR = 15000; // backoff tras un fallo de red

/**
 * Mantiene el estado del tablero sincronizado con el servidor.
 *
 * El endpoint devuelve siempre el estado completo (no deltas), de modo que al
 * reconectar se reemplaza todo y no hay riesgo de tareas o contadores duplicados.
 * Las animaciones se derivan comparando cada respuesta con la anterior: eso vive
 * en los componentes, aquí sólo se expone `previo` junto al estado actual.
 */
export default function useTableroEstado({ dias = 7, activo = true } = {}) {
    const [datos, setDatos] = useState(null);
    const [previo, setPrevio] = useState(null);
    const [conectado, setConectado] = useState(true);
    const [cargando, setCargando] = useState(true);

    const timerRef = useRef(null);
    const abortRef = useRef(null);
    const datosRef = useRef(null);
    const firmaRef = useRef(null);
    const montadoRef = useRef(true);

    const consultar = useCallback(async () => {
        // Evita solapar peticiones si la red va lenta.
        if (abortRef.current) abortRef.current.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        try {
            const r = await axiosInstance.get(`/tablero/estado?dias=${dias}`, { signal: ctrl.signal });
            if (!montadoRef.current) return;

            // servidor_ts cambia en cada respuesta, así que se excluye de la
            // comparación: sin esto el estado se reemplazaría en cada sondeo y
            // el tablero entero se volvería a renderizar cada pocos segundos
            // aunque no hubiera cambiado nada.
            const { servidor_ts: _ts, ...contenido } = r.data;
            const firma = JSON.stringify(contenido);

            if (firma !== firmaRef.current) {
                setPrevio(datosRef.current);
                datosRef.current = r.data;
                firmaRef.current = firma;
                setDatos(r.data);
            }

            setConectado(true);
            return true;
        } catch (err) {
            if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return null;
            if (montadoRef.current) setConectado(false);
            return false;
        } finally {
            if (montadoRef.current) setCargando(false);
        }
    }, [dias]);

    useEffect(() => {
        montadoRef.current = true;

        const programar = (ms) => {
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(ciclo, ms);
        };

        const ciclo = async () => {
            if (!montadoRef.current) return;
            // Con la pestaña oculta no tiene sentido consultar: se reanuda al volver.
            if (document.hidden || !activo) {
                programar(INTERVALO_OK);
                return;
            }
            const ok = await consultar();
            programar(ok === false ? INTERVALO_ERR : INTERVALO_OK);
        };

        ciclo();

        const alVolver = () => {
            if (!document.hidden && montadoRef.current) {
                clearTimeout(timerRef.current);
                ciclo();
            }
        };
        document.addEventListener('visibilitychange', alVolver);

        return () => {
            montadoRef.current = false;
            clearTimeout(timerRef.current);
            if (abortRef.current) abortRef.current.abort();
            document.removeEventListener('visibilitychange', alVolver);
        };
    }, [consultar, activo]);

    return { datos, previo, conectado, cargando, refrescar: consultar };
}
