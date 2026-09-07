import React, { useEffect, useRef, useState } from 'react';
import axiosInstance from '../../axiosConfig';

const CLAVE_SELECCION = 'tableroAmbienteSeleccion';

/**
 * Panel ambiental del tablero.
 *
 * Los vídeos se administran desde Parámetros > Vídeos del Tablero, no aquí:
 * delante de una pantalla proyectada nadie escribe una URL. Este panel se
 * limita a reproducir lo configurado y a permitir cambiar de pista.
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

    const elegir = (pos) => {
        setIndice(pos);
        try {
            if (videos[pos]) localStorage.setItem(CLAVE_SELECCION, String(videos[pos].id));
        } catch {
            /* ignorado */
        }
    };

    if (cargando) return null;

    // Sin vídeos configurados el panel no ocupa espacio. En escritorio se deja
    // una pista de dónde se configuran; en TV no se muestra nada.
    if (videos.length === 0) {
        if (modoTv) return null;
        return (
            <p className="tb-ambiente-vacio">
                Sin vídeos. Se configuran en Parámetros → Vídeos del Tablero.
            </p>
        );
    }

    const actual = videos[Math.min(indice, videos.length - 1)];
    const src = `https://www.youtube-nocookie.com/embed/${actual.video_id}`
        + `?autoplay=1&mute=1&rel=0&modestbranding=1&loop=1&playlist=${actual.video_id}`;

    const reproductor = (
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
    );

    // En modo TV el panel es sólo de visualización: sin controles.
    if (modoTv) {
        return (
            <section className="tb-panel tb-ambiente" aria-label="Panel de vídeo">
                <h3 className="tb-panel-titulo">{actual.titulo.toUpperCase()}</h3>
                {reproductor}
            </section>
        );
    }

    if (!abierto) {
        return (
            <button
                className="tb-ambiente-abrir"
                onClick={() => setAbierto(true)}
                title="Abrir panel de vídeo"
            >
                ▶ Ambiente ({videos.length})
            </button>
        );
    }

    return (
        <section className="tb-panel tb-ambiente" aria-label="Panel de vídeo">
            <header className="tb-ambiente-head">
                <h3 className="tb-panel-titulo">AMBIENTE</h3>
                <button
                    className="tb-ambiente-btn"
                    onClick={() => setAbierto(false)}
                    title="Plegar el panel"
                >
                    ▾
                </button>
            </header>

            {reproductor}

            {videos.length > 1 && (
                <select
                    className="tb-ambiente-select"
                    value={indice}
                    onChange={(e) => elegir(Number(e.target.value))}
                    aria-label="Elegir vídeo"
                >
                    {videos.map((v, i) => (
                        <option key={v.id} value={i}>{v.titulo}</option>
                    ))}
                </select>
            )}

            <p className="tb-ambiente-nota">
                Empieza sin sonido. Actívalo desde el reproductor.
            </p>
        </section>
    );
}
