/**
 * Avisos que llegan aunque la pestaña de WorkBoard no esté a la vista:
 * notificación del sistema, un sonido corto y el contador en el título.
 *
 * Las notificaciones del sistema exigen permiso y un contexto seguro
 * (https o localhost): desde http://IP-de-la-red no existen, y entonces
 * quedan el sonido y el título.
 */

export const notificacionesDisponibles = () => typeof window !== 'undefined'
    && 'Notification' in window && window.isSecureContext;

export const permisoNotificaciones = () => (notificacionesDisponibles() ? Notification.permission : 'denied');

/** Pide permiso. Debe llamarse desde un clic: Firefox ignora la petición si no. */
export const pedirPermisoNotificaciones = () => (notificacionesDisponibles()
    ? Notification.requestPermission().catch(() => 'denied')
    : Promise.resolve('denied'));

/**
 * Notificación del sistema. «etiqueta» agrupa: una conversación con varios
 * mensajes seguidos reemplaza su aviso en vez de apilar uno por mensaje.
 */
export function notificarEscritorio(titulo, cuerpo, etiqueta, alPulsar) {
    if (permisoNotificaciones() !== 'granted') return;
    try {
        const n = new Notification(titulo, { body: cuerpo, tag: etiqueta, renotify: true });
        n.onclick = () => {
            window.focus();
            n.close();
            if (alPulsar) alPulsar();
        };
    } catch {
        // Algunos navegadores móviles sólo admiten notificaciones desde un
        // service worker; ahí basta con el aviso dentro de la página.
    }
}

let audio = null;

/** Dos notas cortas. Sin archivo de audio: se sintetiza con Web Audio. */
export function sonarAviso() {
    try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        // Hasta el primer clic en la página el navegador lo deja suspendido.
        if (audio.state === 'suspended') audio.resume().catch(() => {});
        const ahora = audio.currentTime;
        [[880, 0], [1320, 0.12]].forEach(([frecuencia, retraso]) => {
            const osc = audio.createOscillator();
            const vol = audio.createGain();
            osc.type = 'sine';
            osc.frequency.value = frecuencia;
            vol.gain.setValueAtTime(0.0001, ahora + retraso);
            vol.gain.exponentialRampToValueAtTime(0.18, ahora + retraso + 0.02);
            vol.gain.exponentialRampToValueAtTime(0.0001, ahora + retraso + 0.22);
            osc.connect(vol).connect(audio.destination);
            osc.start(ahora + retraso);
            osc.stop(ahora + retraso + 0.25);
        });
    } catch {
        // Sin audio no pasa nada: el aviso visual sigue ahí.
    }
}

const PREFIJO = /^\(\d+\)\s+/;

/** «(3) WorkBoard»: se ve en la pestaña aunque esté detrás de otras. */
export function contadorEnTitulo(n) {
    const base = document.title.replace(PREFIJO, '');
    document.title = n > 0 ? `(${n}) ${base}` : base;
}
