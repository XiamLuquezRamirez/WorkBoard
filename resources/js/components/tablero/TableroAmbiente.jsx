import React, { useEffect, useRef, useState } from 'react';

const CLAVE = 'tableroAmbienteVideo';

/**
 * Extrae el id de vídeo de las formas habituales de enlace de YouTube.
 * Acepta también un id suelto de 11 caracteres.
 */
export function extraerIdYoutube(entrada) {
    const v = String(entrada || '').trim();
    if (!v) return null;

    if (/^[\w-]{11}$/.test(v)) return v;

    let url;
    try {
        url = new URL(v.startsWith('http') ? v : `https://${v}`);
    } catch {
        return null;
    }

    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
        const id = url.pathname.slice(1).split('/')[0];
        return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
        const param = url.searchParams.get('v');
        if (param && /^[\w-]{11}$/.test(param)) return param;

        // /embed/ID, /live/ID, /shorts/ID
        const partes = url.pathname.split('/').filter(Boolean);
        const idx = partes.findIndex((p) => ['embed', 'live', 'shorts', 'v'].includes(p));
        if (idx !== -1 && partes[idx + 1] && /^[\w-]{11}$/.test(partes[idx + 1])) {
            return partes[idx + 1];
        }
    }
    return null;
}

/**
 * Panel ambiental del tablero: reproduce un vídeo de YouTube junto al kanban.
 *
 * Sólo se admite YouTube porque es de los pocos servicios que permiten ser
 * embebidos; la mayoría de sitios envían cabeceras que lo impiden y el panel
 * quedaría en blanco. Se usa el dominio -nocookie y el vídeo arranca en silencio:
 * la pantalla suele estar en una oficina.
 */
export default function TableroAmbiente({ modoTv }) {
    const [abierto, setAbierto] = useState(false);
    const [videoId, setVideoId] = useState(() => {
        try {
            return localStorage.getItem(CLAVE) || '';
        } catch {
            return '';
        }
    });
    const [entrada, setEntrada] = useState('');
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (abierto && !videoId && inputRef.current) inputRef.current.focus();
    }, [abierto, videoId]);

    const guardar = (id) => {
        setVideoId(id);
        try {
            if (id) localStorage.setItem(CLAVE, id);
            else localStorage.removeItem(CLAVE);
        } catch {
            /* sin persistencia si el navegador la bloquea */
        }
    };

    const cargar = (ev) => {
        ev.preventDefault();
        const id = extraerIdYoutube(entrada);
        if (!id) {
            setError('Pega un enlace de YouTube válido.');
            return;
        }
        setError('');
        setEntrada('');
        guardar(id);
    };

    // En modo TV el panel sólo reproduce lo ya configurado: no se ofrece el
    // formulario ni el botón de abrir, porque delante de una pantalla proyectada
    // nadie escribe una URL. Sin vídeo guardado, simplemente no ocupa espacio.
    if (modoTv) {
        if (!videoId) return null;
        return (
            <section className="tb-panel tb-ambiente" aria-label="Panel de vídeo">
                <h3 className="tb-panel-titulo">AMBIENTE</h3>
                <div className="tb-ambiente-video">
                    <iframe
                        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&rel=0&modestbranding=1&loop=1&playlist=${videoId}`}
                        title="Vídeo ambiental"
                        frameBorder="0"
                        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                    />
                </div>
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
                ▶ Ambiente
            </button>
        );
    }

    return (
        <section className="tb-panel tb-ambiente" aria-label="Panel de vídeo">
            <header className="tb-ambiente-head">
                <h3 className="tb-panel-titulo">AMBIENTE</h3>
                <div className="tb-ambiente-acciones">
                    {videoId && (
                        <button
                            className="tb-ambiente-btn"
                            onClick={() => guardar('')}
                            title="Quitar el vídeo"
                        >
                            ✕ Vídeo
                        </button>
                    )}
                    <button
                        className="tb-ambiente-btn"
                        onClick={() => setAbierto(false)}
                        title="Plegar el panel"
                    >
                        ▾
                    </button>
                </div>
            </header>

            {videoId ? (
                <div className="tb-ambiente-video">
                    <iframe
                        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&rel=0&modestbranding=1`}
                        title="Vídeo ambiental"
                        frameBorder="0"
                        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                    />
                </div>
            ) : (
                <form className="tb-ambiente-form" onSubmit={cargar}>
                    <input
                        ref={inputRef}
                        type="text"
                        className="tb-ambiente-input"
                        placeholder="Pega un enlace de YouTube"
                        value={entrada}
                        onChange={(e) => { setEntrada(e.target.value); setError(''); }}
                    />
                    <button type="submit" className="tb-ambiente-btn tb-ambiente-btn-ok">
                        Reproducir
                    </button>
                    {error && <p className="tb-ambiente-error">{error}</p>}
                    <p className="tb-ambiente-nota">
                        El vídeo empieza sin sonido. Actívalo desde el propio reproductor.
                    </p>
                </form>
            )}
        </section>
    );
}
