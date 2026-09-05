import React, { createContext, useContext, useEffect, useState } from 'react';
import axiosInstance from '../../axiosConfig';
import { getImageUrl } from '../../utils/assetHelper';

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

/**
 * Resuelve el valor de 'foto' tal y como está guardado.
 *
 * En esta instalación las fotos se almacenan como base64 (data:image/...), que
 * ya es una URL completa: anteponerle la base la invalidaría. Se contemplan
 * también los formatos que podrían aparecer si el almacenamiento cambiara a
 * archivos en disco.
 */
export function resolverFoto(foto) {
    if (!foto) return null;
    const v = String(foto).trim();
    if (!v) return null;
    if (v.startsWith('data:') || v.startsWith('http://') || v.startsWith('https://') || v.startsWith('//')) {
        return v;
    }
    return getImageUrl(v.replace(/^\/+/, ''));
}

export function useAvatar(empleadoId) {
    const avatares = useContext(AvataresContext);
    return resolverFoto(avatares[empleadoId] ?? avatares[String(empleadoId)]);
}
