import React, { useEffect, useRef, useState } from 'react';
import axiosInstance from '../../axiosConfig';

const CLAVE_SELECCION = 'tableroAmbienteSeleccion';

/**
 * Panel ambiental del tablero. Vive al pie del lateral, bajo "Próximas
 * entregas", como un panel plegable más: desplegado absorbe el espacio libre y
 * plegado queda reducido a su cabecera. Se comporta igual en modo TV, donde
 * plegar alertas o equipo es lo que le deja sitio.
 *
 * Los vídeos se administran desde el menú del líder (Vídeos del Tablero), no
 * aquí: delante de una pantalla proyectada nadie escribe una URL.
 *
 * Sólo YouTube: es de los pocos servicios que permiten ser embebidos; la
 * mayoría de sitios envían cabeceras que lo impiden y el panel quedaría vacío.
 */
export default function TableroAmbiente({ plegado, onAlternar }) {
    const [videos, setVideos] = useState([]);
    const [indice, setIndice] = useState(0);
    const [cargando, setCargando] = useState(true);
    const montado = useRef(true);
    const iframeRef = useRef(null);
    const [conSonido, setConSonido] = useState(false);

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

    // Los navegadores sólo permiten arrancar un vídeo automáticamente si está
    // silenciado; el audio requiere un gesto del usuario. Al pulsar el botón se
    // ordena al reproductor que se active, sin recargar el iframe para no
    // reiniciar la reproducción.
    const activarSonido = () => {
        const marco = iframeRef.current;
        if (!marco || !marco.contentWindow) return;
        const orden = (func) => marco.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func, args: [] }),
            'https://www.youtube-nocookie.com'
        );
        orden('unMute');
        orden('playVideo');
        setConSonido(true);
    };

    const elegir = (pos) => {
        setIndice(pos);
        setConSonido(false);   // el iframe se recrea y vuelve silenciado
        try {
            if (videos[pos]) localStorage.setItem(CLAVE_SELECCION, String(videos[pos].id));
        } catch {
            /* ignorado */
        }
    };

    if (cargando || videos.length === 0) return null;

    const actual = videos[Math.min(indice, videos.length - 1)];
    const src = `https://www.youtube-nocookie.com/embed/${actual.video_id}`
        + `?autoplay=1&mute=1&rel=0&modestbranding=1&loop=1&playlist=${actual.video_id}`
        + '&enablejsapi=1';

    return (
        <section
            className={`tb-panel tb-amb-panel ${plegado ? 'es-plegado' : ''}`}
            aria-label="Vídeos ambientales"
        >
            <button
                className="tb-panel-cab"
                onClick={onAlternar}
                aria-expanded={!plegado}
                title={plegado ? 'Desplegar' : 'Plegar'}
            >
                <span className="tb-panel-titulo">▶ {actual.titulo}</span>
                {plegado && videos.length > 1 && (
                    <span className="tb-panel-resumen">{videos.length}</span>
                )}
                <span className="tb-panel-chevron">{plegado ? '▸' : '▾'}</span>
            </button>

            {plegado ? null : (
              <>

            <div className="tb-ambiente-video">
                {!conSonido && (
                    <button
                        className="tb-amb-sonido"
                        onClick={activarSonido}
                        title="Activar el sonido"
                    >
                        🔊 Activar sonido
                    </button>
                )}
                <iframe
                    ref={iframeRef}
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
              </>
            )}
        </section>
    );
}
