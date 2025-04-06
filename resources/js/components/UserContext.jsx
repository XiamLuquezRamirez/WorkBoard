import { createContext, useContext, useState, useEffect } from "react";
import AuthMiddleware from "../middleware/AuthMiddleware";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);

    useEffect(() => {
        try {
            const user = AuthMiddleware.getUser();
            if (user && typeof user === "object") {
                setCurrentUser(user);
            } else {
                window.location.href = "/";
            }
        } catch (error) {
            console.error("Error al obtener el usuario:", error);
            window.location.href = "/";
        }
    }, []);

    return (
        <UserContext.Provider value={{ user, setUser }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    return useContext(UserContext);
};
