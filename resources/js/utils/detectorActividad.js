import { useEffect } from 'react';
import axiosInstance from '../axiosConfig';

/**
 * Uso del equipo para la presencia del plano.
 *
 * Dos fuentes, de más a menos completa:
 *
 *  1. Equipo completo (Chrome y Edge, con permiso de la persona): la API
 *     IdleDetector del navegador dice si se usa el teclado o el ratón en
 *     CUALQUIER programa y si la pantalla está bloqueada. No dice qué
 *     programa ni qué se escribe.
 *  2. Sólo WorkBoard (cualquier navegador, sin permisos): movimiento del
 *     ratón, teclado o scroll en la propia página. Con la pestaña oculta no se
 *     informa nada: la persona puede estar trabajando en otro programa y
 *     decir «inactivo» sería falso.
 *
 * Se informa «activo», «inactivo» (5 min sin uso) o «bloqueado» al servidor
 * cada minuto y cada vez que cambia.
 */

export const INACTIVO_MS = 5 * 60 * 1000;
const INFORMAR_MS = 60 * 1000;
const CLAVE = 'wb-deteccion-equipo';
const EVENTO = 'wb:deteccion-equipo';

export const soportaEquipoCompleto = () => typeof window !== 'undefined' && 'IdleDetector' in window;

export const deteccionActivada = () => {
    try { return localStorage.getItem(CLAVE) === 'si'; } catch (e) { return false; }
};

/**
 * Pide permiso para detectar el uso del equipo completo. Tiene que llamarse
 * desde un clic: el navegador sólo muestra el permiso ante un gesto.
 * Devuelve 'granted', 'denied' o 'no-soportado'.
 */
export async function activarDeteccionEquipo() {
    if (!soportaEquipoCompleto()) return 'no-soportado';
    let permiso = 'denied';
    try {
        permiso = await window.IdleDetector.requestPermission();
    } catch (e) {
        permiso = 'denied';
    }
    try { localStorage.setItem(CLAVE, permiso === 'granted' ? 'si' : 'no'); } catch (e) { /* sin almacenamiento */ }
    window.dispatchEvent(new Event(EVENTO));
    return permiso;
}

export function desactivarDeteccionEquipo() {
    try { localStorage.setItem(CLAVE, 'no'); } catch (e) { /* sin almacenamiento */ }
    window.dispatchEvent(new Event(EVENTO));
}

/** Monta el detector mientras haya sesión. */
export function useDetectorActividad(conSesion) {
    useEffect(() => {
        if (!conSesion) return undefined;

        let ultimoUso = Date.now();
        let usoSistema = null;          // lo que dice IdleDetector, si está activo
        let ultimoInformado = null;
        let detector = null;
        let abortar = null;
        let vivo = true;

        const usoActual = () => {
            if (usoSistema) return usoSistema;
            // Sin detector del sistema, con la pestaña oculta no se sabe nada.
            if (document.visibilityState !== 'visible') return null;
            return Date.now() - ultimoUso < INACTIVO_MS ? 'activo' : 'inactivo';
        };

        const informar = (forzar = false) => {
            const uso = usoActual();
            if (!uso || !vivo) return;
            if (!forzar && uso === ultimoInformado) return;
            ultimoInformado = uso;
            axiosInstance.post('/equipo/presencia/uso', { uso }).catch(() => { /* se reintenta al minuto */ });
        };

        // Actividad dentro de WorkBoard. Basta con anotar la hora; si se
        // venía de «inactivo», se informa enseguida que volvió.
        const alUsar = () => {
            ultimoUso = Date.now();
            if (ultimoInformado === 'inactivo' && !usoSistema) informar();
        };
        const eventos = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
        eventos.forEach((e) => window.addEventListener(e, alUsar, { passive: true }));
        document.addEventListener('visibilitychange', alUsar);

        const arrancarSistema = async () => {
            if (abortar) { abortar.abort(); abortar = null; }
            detector = null;
            usoSistema = null;
            if (!soportaEquipoCompleto() || !deteccionActivada()) return;
            try {
                const estado = await navigator.permissions.query({ name: 'idle-detection' });
                if (estado.state !== 'granted') return;
                abortar = new AbortController();
                detector = new window.IdleDetector();
                detector.addEventListener('change', () => {
                    usoSistema = detector.screenState === 'locked'
                        ? 'bloqueado'
                        : detector.userState === 'idle' ? 'inactivo' : 'activo';
                    informar();
                });
                await detector.start({ threshold: INACTIVO_MS, signal: abortar.signal });
            } catch (e) {
                usoSistema = null; // sin permiso o sin soporte: queda la detección en la página
            }
        };

        const alCambiarPreferencia = () => { arrancarSistema().then(() => informar(true)); };
        window.addEventListener(EVENTO, alCambiarPreferencia);

        arrancarSistema().then(() => informar(true));
        const tic = setInterval(() => informar(true), INFORMAR_MS);

        return () => {
            vivo = false;
            clearInterval(tic);
            eventos.forEach((e) => window.removeEventListener(e, alUsar));
            document.removeEventListener('visibilitychange', alUsar);
            window.removeEventListener(EVENTO, alCambiarPreferencia);
            if (abortar) abortar.abort();
        };
    }, [conSesion]);
}
