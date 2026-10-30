/**
 * Conversaciones que se están mirando ahora mismo.
 *
 * El aviso de mensajes no debe saltar por un mensaje que ya se ve en
 * pantalla. Cada vista de chat registra su conversación mientras está
 * montada; un contador por clave admite dos vistas de la misma a la vez
 * (el panel del puesto y el chat del espacio de equipo).
 */
const abiertas = new Map();

/** Marca la conversación como abierta. Devuelve la función que la cierra. */
export function registrarChatAbierto(clave) {
    if (!clave) return () => {};
    abiertas.set(clave, (abiertas.get(clave) || 0) + 1);
    return () => {
        const n = (abiertas.get(clave) || 1) - 1;
        if (n > 0) abiertas.set(clave, n);
        else abiertas.delete(clave);
    };
}

/** Si se está viendo: abierta y con la pestaña a la vista. */
export const chatALaVista = (clave) => !document.hidden && abiertas.has(clave);
