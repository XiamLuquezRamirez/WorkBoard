import axios from 'axios';
import { getAssetUrl, irAlLogin } from './utils/assetHelper';

/** Guarda el token CSRF nuevo que entrega el servidor tras el login. */
export const actualizarCsrf = (token) => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (token && meta) {
        meta.setAttribute('content', token);
    }
};

// La base de la API se deduce de la base pública real de la aplicación, no de
// un host escrito a mano. Antes apuntaba fijo a «localhost:8000»: servido el
// proyecto en otro puerto, las peticiones salían hacia otra aplicación —con
// withCredentials, además, en otro origen— y fallaban por CORS o por CSRF.
const baseURL = getAssetUrl('api');

// Crear una instancia de axios con la configuración base
const axiosInstance = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
    withCredentials: true // Importante para las cookies de sesión
});

// Interceptor para agregar el token a las peticiones
axiosInstance.interceptors.request.use(
    config => {
        // El token CSRF se lee en cada petición: cambia al iniciar sesión
        // (ver actualizarCsrf) y fijarlo al cargar obligaba a recargar.
        const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (csrf) {
            config.headers['X-CSRF-TOKEN'] = csrf;
        }
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// Interceptor para manejar errores
axiosInstance.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            // Limpiar el token y redirigir al login
            localStorage.removeItem('token');
            localStorage.removeItem('userWorkBoard');

            // Evitar redirecciones múltiples. La ruta de login también se
            // resuelve contra la base real: «/WorkBoard/public» sólo existe en
            // producción y en desarrollo llevaba a un 404.
            if (!/\/login\/?$/.test(window.location.pathname)) {
                irAlLogin();
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance; 