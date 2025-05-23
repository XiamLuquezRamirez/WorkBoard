import axios from 'axios';

// Determinar la URL base según el entorno
const baseURL = process.env.NODE_ENV === 'production' 
    ? 'https://ingeer.co/WorkBoard/public/api'  // Reemplaza con tu dominio real
    : 'http://localhost:8000/api';

// Crear una instancia de axios con la configuración base
const axiosInstance = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
    },
    withCredentials: true // Importante para las cookies de sesión
});

// Interceptor para agregar el token a las peticiones
axiosInstance.interceptors.request.use(
    config => {
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
            localStorage.removeItem('user');
            
            // Evitar redirecciones múltiples
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance; 