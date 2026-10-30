/**
 * Tablas legibles en el móvil.
 *
 * En una pantalla estrecha una tabla de seis columnas se comprime hasta que
 * los textos se montan unos sobre otros. En móvil, app.css convierte cada
 * fila en una ficha con pares «columna: valor»; para eso cada celda necesita
 * saber el título de su columna.
 *
 * En vez de escribir data-label a mano en las ~45 tablas de la aplicación,
 * se copian los títulos del <thead> a las celdas. Un MutationObserver lo
 * repite cuando React pinta filas nuevas (paginación, búsquedas, modales).
 */

const MARCA = 'wb-tabla-movil';

/** Pone data-label a las celdas de una tabla a partir de su cabecera. */
function etiquetarTabla(tabla) {
    const cabecera = tabla.tHead?.rows[tabla.tHead.rows.length - 1];
    if (!cabecera) return;

    // Títulos por columna real, contando los colspan de la cabecera.
    const titulos = [];
    [...cabecera.cells].forEach((th) => {
        const texto = th.textContent.trim();
        for (let i = 0; i < (th.colSpan || 1); i++) titulos.push(texto);
    });
    if (!titulos.some(Boolean)) return;

    tabla.classList.add(MARCA);

    [...tabla.tBodies].forEach((cuerpo) => {
        [...cuerpo.rows].forEach((fila) => {
            let columna = 0;
            [...fila.cells].forEach((celda) => {
                const ancho = celda.colSpan || 1;
                // Una celda que ocupa varias columnas (un «no hay datos», una
                // fila desplegada) no corresponde a ninguna en concreto.
                const etiqueta = ancho > 1 ? '' : (titulos[columna] || '');
                if (celda.getAttribute('data-label') !== etiqueta) celda.setAttribute('data-label', etiqueta);
                columna += ancho;
            });
        });
    });
}

export function etiquetarTablas(raiz = document) {
    raiz.querySelectorAll('table').forEach(etiquetarTabla);
}

/** Vigila el documento y etiqueta las tablas que aparezcan. Devuelve cómo pararlo. */
export function observarTablas() {
    let pendiente = false;
    const programar = () => {
        if (pendiente) return;
        pendiente = true;
        // Un temporizador y no requestAnimationFrame: éste se detiene con la
        // pestaña en segundo plano y las tablas quedaban sin etiquetar.
        setTimeout(() => {
            pendiente = false;
            etiquetarTablas();
        }, 30);
    };

    etiquetarTablas();
    const observador = new MutationObserver((cambios) => {
        // Sólo interesan cambios que añaden nodos: las propias etiquetas son
        // atributos y no deben volver a disparar el trabajo.
        if (cambios.some((c) => c.addedNodes.length)) programar();
    });
    observador.observe(document.body, { childList: true, subtree: true });
    return () => observador.disconnect();
}
