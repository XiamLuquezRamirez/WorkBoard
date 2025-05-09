import axios from 'axios';

const AuthMiddleware = {
    isAuthenticated: () => {
        return !!localStorage.getItem('token');
    },

    getToken: () => {
        return localStorage.getItem('token');
    },

    getUser: () => {
        try {
            const user = localStorage.getItem('user');
            return user ? JSON.parse(user) : null;
        } catch (error) {
            console.error('Error al obtener datos del usuario:', error);
            // Si hay un error, limpiamos el localStorage y retornamos null
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            return null;
        }
    },

    setupAxiosInterceptors: () => {
        axios.interceptors.request.use(
            (config) => {
                const token = AuthMiddleware.getToken();
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    AuthMiddleware.logout();
                }
                return Promise.reject(error);
            }
        );
    },

    logout: async () => {1
        try {
            // Primero, intentamos hacer el logout en el servidor
            const response = await axios.post('/logout');
            
            // Si la respuesta es exitosa o hay un error, procedemos a limpiar
            return new Promise((resolve) => {
                // Usamos setTimeout para evitar el bloqueo del navegador
                setTimeout(() => {
                    // Limpiamos el localStorage
                    localStorage.clear();
                    
                    // Limpiamos los headers de axios
                    delete axios.defaults.headers.common['Authorization'];
                    
                    // Resolvemos la promesa antes de la redirección
                    resolve();
                    
                    // Redirigimos después de un pequeño delay
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 100);
                }, 0);
            });
        } catch (error) {
            console.error('Error durante el logout:', error);
            // Aún si hay error, limpiamos todo
            localStorage.clear();
            delete axios.defaults.headers.common['Authorization'];
            window.location.href = '/';
        }
    }
};

export default AuthMiddleware; 