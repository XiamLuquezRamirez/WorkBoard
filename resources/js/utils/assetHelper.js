/**
 * Base pública de la aplicación.
 *
 * Antes venía escrita a mano («http://localhost:8000» en desarrollo), lo que
 * ataba el bundle a un puerto concreto: al servir el proyecto en otro puerto
 * —o al convivir con otro proyecto en el que sí estaba el 8000— las imágenes
 * y la API se pedían a una aplicación ajena y respondían 404.
 *
 * La vista publica la base con asset(), que es la misma función que ya resuelve
 * el CSS y el JS, así que vale igual en «localhost:8001», bajo XAMPP en
 * «/work-board/public» y en producción bajo «/WorkBoard/public». Si faltara la
 * etiqueta, se deduce de la ruta del propio script cargado.
 */
const calcularBase = () => {
    const meta = document.querySelector('meta[name="asset-base"]');
    const declarada = meta && meta.getAttribute('content');
    if (declarada) {
        return declarada.replace(/\/+$/, '');
    }

    // Respaldo: el <script> que cargó este bundle vive en «<base>/js/app.js».
    const script = document.querySelector('script[src*="js/app.js"]');
    if (script) {
        return new URL(script.getAttribute('src'), window.location.href)
            .href.replace(/\/js\/app\.js.*$/, '');
    }

    return window.location.origin;
};

let baseCache = null;

export const getBaseUrl = () => {
    if (baseCache === null) {
        baseCache = calcularBase();
    }
    return baseCache;
};

/**
 * URL absoluta de un recurso de la aplicación.
 *
 * Acepta rutas con o sin barra inicial. Si ya recibe una URL absoluta o un
 * dato embebido («data:…», como las fotos en base64 de empleados), la devuelve
 * tal cual.
 *
 * @param {string} path - Ruta relativa del asset (ej: 'images/logo.png')
 * @returns {string} - URL completa del asset
 */
export const getAssetUrl = (path) => {
    const ruta = String(path ?? '');

    if (/^(https?:|data:|blob:)/i.test(ruta)) {
        return ruta;
    }

    return `${getBaseUrl()}/${ruta.replace(/^\/+/, '')}`;
};

/**
 * URL completa de una imagen. Misma resolución que getAssetUrl; se mantiene
 * como nombre propio porque es el que usan los componentes.
 *
 * @param {string} imagePath - Ruta relativa de la imagen (ej: 'images/logo.png')
 * @returns {string} - URL completa de la imagen
 */
export const getImageUrl = (imagePath) => getAssetUrl(imagePath);

/**
 * Ruta de la base dentro del servidor: «» en la raíz, «/work-board/public»
 * bajo XAMPP. Es el basename del router.
 */
export const getRutaBase = () => {
    try {
        return new URL(`${getBaseUrl()}/`, window.location.href).pathname.replace(/\/+$/, '');
    } catch (e) {
        return '';
    }
};

/**
 * URL de una pantalla de la aplicación: «<base>/dashboard».
 *
 * @param {string} pantalla - p. ej. 'dashboard', 'login'
 */
export const getAppUrl = (pantalla = '') => `${getBaseUrl()}/${String(pantalla).replace(/^[#/]+/, '')}`;

/**
 * Convierte al arrancar las direcciones viejas con «#» («<base>/#/dashboard»,
 * «<base>/dashboard#/dashboard») en la dirección limpia «<base>/dashboard»,
 * para que sigan valiendo los marcadores y enlaces guardados. Sin recargar:
 * sólo reescribe la barra de direcciones antes de que arranque el router.
 */
export const normalizarUrlDeLaApp = () => {
    try {
        const hash = window.location.hash;
        if (!hash.startsWith('#/')) return;

        const pantalla = hash.slice(2).replace(/^\/+/, '');
        window.history.replaceState(null, '', `${getRutaBase()}/${pantalla}${window.location.search}`);
    } catch (e) {
        // Si algo falla se queda la URL como estaba.
    }
};

/** Lleva al login cargando la página de nuevo, sin estado de la sesión. */
export const irAlLogin = () => {
    window.location.replace(getAppUrl('login'));
};
