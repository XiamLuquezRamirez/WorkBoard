import React, { useEffect, useRef, useState } from 'react';
import axiosInstance from '../../axiosConfig';

const CLAVE_SELECCION = 'tableroAmbienteSeleccion';

/**
 * Panel ambiental del tablero, como botón flotante en la esquina inferior
 * derecha: así no compite por espacio con el kanban ni con el lateral, y sólo
 * ocupa pantalla mientras se está usando.
 *
 * Los vídeos se administran desde el menú del líder (Vídeos del Tablero), no
 * aquí: delante de una pantalla proyectada nadie escribe una URL.
 *
 * Sólo YouTube: es de los pocos servicios que permiten ser embebidos; la
 * mayoría de sitios envían cabeceras que lo impiden y el panel quedaría vacío.
 */
export default function TableroAmbiente({ modoTv }) {
    const [videos, setVideos] = useState([]);
    const [indice, setIndice] = useState(0);
    const [abierto, setAbierto] = useState(false);
    const [cargando, setCargando] = useState(true);
    const montado = useRef(true);

    useEffect(() => {
        montado.current = true;
        axiosInstance.get('/tablero/videos')
            .then((r) => {
                if (!montado.current) return;
                const lista = Array.isArray(r.data) ? r.data : [];
                setVideos(lista);

                // Se recuerda la última pista elegida en esta pantalla, para que
                // un TV recupere lo que estaba reproduciendo tras un reinicio.
                try {
                    const guardado = localStorage.getItem(CLAVE_SELECCION);
                    const pos = lista.findIndex((v) => String(v.id) === guardado);
                    if (pos >= 0) setIndice(pos);
                } catch {
                    /* sin persistencia si el navegador la bloquea */
                }
            })
            .catch(() => montado.current && setVideos([]))
            .finally(() => montado.current && setCargando(false));

        return () => { montado.current = false; };
    }, []);

    // Cerrar con Escape sin interferir con el resto de atajos del tablero.
    useEffect(() => {
        if (!abierto) return undefined;
        const onKey = (ev) => {
            if (ev.key === 'Escape') {
                ev.stopPropagation();
                setAbierto(false);
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [abierto]);

    const elegir = (pos) => {
        setIndice(pos);
        try {
            if (videos[pos]) localStorage.setItem(CLAVE_SELECCION, String(videos[pos].id));
        } catch {
            /* ignorado */
        }
    };

    if (cargando || videos.length === 0) return null;

    const actual = videos[Math.min(indice, videos.length - 1)];
    const src = `https://www.youtube-nocookie.com/embed/${actual.video_id}`
        + `?autoplay=1&mute=1&rel=0&modestbranding=1&loop=1&playlist=${actual.video_id}`;

    if (!abierto) {
        return (
            <button
                className="tb-amb-fab"
                onClick={() => setAbierto(true)}
                title="Vídeos ambientales"
                aria-label="Abrir vídeos ambientales"
            >
                ▶
                {videos.length > 1 && <span className="tb-amb-fab-n">{videos.length}</span>}
            </button>
        );
    }

    return (
        <section className="tb-amb-panel" aria-label="Vídeos ambientales">
            <header className="tb-amb-head">
                <h3>{actual.titulo}</h3>
                <button
                    className="tb-amb-cerrar"
                    onClick={() => setAbierto(false)}
                    title="Cerrar (Esc)"
                >
                    ✕
                </button>
            </header>

            <div className="tb-ambiente-video">
                <iframe
                    key={actual.video_id}
                    src={src}
                    title={actual.titulo}
                    frameBorder="0"
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                />
            </div>

            {videos.length > 1 && (
                <div className="tb-amb-lista">
                    {videos.map((v, i) => (
                        <button
                            key={v.id}
                            className={`tb-amb-pista ${i === indice ? 'es-actual' : ''}`}
                            onClick={() => elegir(i)}
                            title={v.titulo}
                        >
                            {v.titulo}
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
}
