/**
 * Mensaje tras entregar una tarea (enviarla a revisión).
 *
 * Con independencia la tarea se acepta sola (auto_aceptada); si algo lo
 * impide queda en revisión y el servidor dice qué falta (bloqueos). Sin
 * independencia, espera la revisión de su líder.
 */
export function avisoDeEntrega(datos = {}) {
    if (datos.auto_aceptada) {
        return {
            titulo: 'Tarea completada',
            texto: 'Se aceptó sola porque tienes independencia.',
            icono: 'success',
        };
    }
    if (Array.isArray(datos.bloqueos) && datos.bloqueos.length > 0) {
        return {
            titulo: 'Quedó en revisión',
            texto: `Para cerrarla falta: ${datos.bloqueos.join(' ')} Complétalo y acéptala desde la tarea.`,
            icono: 'info',
        };
    }
    return {
        titulo: 'Enviada a revisión',
        texto: 'Tu líder recibió el aviso en la plataforma y por correo.',
        icono: 'success',
    };
}
