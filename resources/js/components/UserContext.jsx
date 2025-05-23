import { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext();

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser debe ser usado dentro de un UserProvider');
    }
    return context;
};

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        const fetchUser = async () => {
            //primero verificamos si hay un token
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }

            const usuario = JSON.parse(localStorage.getItem('user'));
        
            setUser(usuario);
           
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

