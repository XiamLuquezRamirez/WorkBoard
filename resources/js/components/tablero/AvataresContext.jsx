import React, { createContext, useContext, useEffect, useState } from 'react';
import axiosInstance from '../../axiosConfig';

const AvataresContext = createContext({});

/**
 * Diccionario { empleadoId: foto } cargado una sola vez.
 *
 * Las fotos se almacenan como base64 en la base de datos, así que no pueden
 * viajar en cada sondeo del tablero: se piden al montar y se reutilizan.
 */
export function AvataresProvider({ children }) {
    const [avatares, setAvatares] = useState({});

    useEffect(() => {
        let vivo = true;
        axiosInstance.get('/tablero/avatares')
            .then((r) => { if (vivo) setAvatares(r.data || {}); })
            .catch(() => { /* sin avatares se muestran las iniciales */ });
        return () => { vivo = false; };
    }, []);

    return (
        <AvataresContext.Provider value={avatares}>
            {children}
        </AvataresContext.Provider>
    );
}

export function useAvatar(empleadoId) {
    const avatares = useContext(AvataresContext);
    return avatares[empleadoId] || avatares[String(empleadoId)] || null;
}
