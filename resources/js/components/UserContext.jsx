import { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '../axiosConfig';

const UserContext = createContext();

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser debe ser usado dentro de un UserProvider');
    }
    return context;
};

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem('userWorkBoard');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }

            const storedUser = localStorage.getItem('userWorkBoard');
            if (!storedUser) {
                setLoading(false);
                return;
            }

            try {
                const usuario = JSON.parse(storedUser);
                setUser(usuario);

                // Refrescar campos que pueden cambiar server-side sin re-login
                const response = await axiosInstance.get('/user');
                const fresh = response.data.user;
                if (fresh) {
                    const merged = {
                        ...usuario,
                        independencia: fresh.independencia ?? usuario.independencia,
                        lider: fresh.lider ?? usuario.lider,
                        tipo_usuario: fresh.tipo_usuario ?? usuario.tipo_usuario,
                        estado: fresh.estado ?? usuario.estado,
                    };
                    setUser(merged);
                    localStorage.setItem('userWorkBoard', JSON.stringify(merged));
                }
            } catch (error) {
                // Si falla el refresh, el usuario del localStorage sigue siendo válido
                console.error('Error al refrescar usuario:', error);
            }

            setLoading(false);
        };

        fetchUser();
    }, []);

    const value = {
        user,
        setUser,
        loading
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
}

export default UserContext;
