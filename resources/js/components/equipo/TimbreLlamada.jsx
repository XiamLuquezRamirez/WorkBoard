import React, { useEffect, useRef, useState } from 'react';
import axiosInstance from '../../axiosConfig';
import { notificarEscritorio, sonarAviso } from './avisoEscritorio';
import './timbre.css';

/** Cada cuánto se pregunta si hay una llamada entrante. */
const SONDEO_MS = 6000;

/** La misma caducidad que aplica el servidor. */
const VIVE_MS = 45000;

const JITSI = 'https://meet.jit.si/';
const OPCIONES = '#config.startWithAudioMuted=true'
    + '&config.startWithVideoMuted=true&config.prejoinPageEnabled=false&config.disableDeepLinking=true';

const hora = (iso) => {
    if (!iso) return '';
    const t = new Date(String(iso).replace(' ', 'T'));
    return Number.isNaN(t.getTime())
        ? ''
        : t.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
};

const iniciales = (n) => String(n || '?')
    .trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/**
 * Timbre de llamada entrante.
 *
 * Vive en la raíz de la aplicación, no dentro del plano: una llamada debe
 * sonar se esté donde se esté, igual que suena un teléfono aunque no se esté
 * mirando la agenda.
 *
 * El sondeo es de seis segundos. Es la petición más repetida de toda la
 * aplicación, así que el servidor devuelve nada cuando no hay nada.
 */
export default function TimbreLlamada() {
    const [llamada, setLlamada] = useState(null);
    const [enSala, setEnSala] = useState(null);
    const vistas = useRef(new Set());
    // Última llamada que ya sonó, para no repetir sonido ni notificación en
    // cada sondeo mientras sigue entrando.
    const avisada = useRef(null);

    useEffect(() => {
        let vivo = true;
        let tic = null;

        const mirar = () => {
            // En una llamada ya aceptada el timbre sobra. Con la pestaña
            // oculta sí se consulta: la llamada se avisa con una
            // notificación del sistema.
            if (enSala) return;

            axiosInstance.get('/equipo/llamada-entrante')
                .then((r) => {
                    if (!vivo) return;
                    // Sin ficha de empleado nadie puede llamarle: se deja de preguntar.
                    if (r.data?.activo === false) { clearInterval(tic); return; }
                    const l = r.data.llamada;

                    // Una llamada ya rechazada no debe volver a sonar mientras
                    // el servidor la sigue dando por viva.
                    if (!l || vistas.current.has(l.id)) {
                        setLlamada((a) => (a && (!l || a.id !== l.id) ? null : a));
                        return;
                    }
                    if (avisada.current !== l.id) {
                        avisada.current = l.id;
                        sonarAviso();
                        if (document.hidden || !document.hasFocus()) {
                            notificarEscritorio(`Videollamada de ${l.quien}`, 'Vuelve a WorkBoard para contestar.', `wb-llamada-${l.id}`);
                        }
                    }
                    setLlamada(l);
                })
                .catch(() => { /* un fallo de red no debe romper la pantalla */ });
        };

        mirar();
        tic = setInterval(mirar, SONDEO_MS);
        return () => { vivo = false; clearInterval(tic); };
    }, [enSala]);

    // La llamada deja de sonar sola al caducar, sin esperar al servidor.
    useEffect(() => {
        if (!llamada) return undefined;

        const nacida = new Date(String(llamada.cuando).replace(' ', 'T')).getTime();
        const resta = VIVE_MS - (Date.now() - nacida);
        if (resta <= 0) { setLlamada(null); return undefined; }

        const t = setTimeout(() => setLlamada(null), resta);
        return () => clearTimeout(t);
    }, [llamada]);

    const responder = (estado) => {
        if (!llamada) return;
        vistas.current.add(llamada.id);

        axiosInstance.put(`/equipo/llamada/${llamada.id}`, { estado })
            .then(() => {
                if (estado === 'Aceptada') setEnSala(llamada);
            })
            .catch(() => { /* la llamada caduca sola si no se pudo responder */ })
            .finally(() => setLlamada(null));
    };

    const colgar = () => setEnSala(null);

    if (enSala) {
        return (
            <div className="tl-sala">
                <header className="tl-sala-cab">
                    <span>En llamada con <b>{enSala.quien}</b></span>
                    <button className="tl-colgar" onClick={colgar}>Colgar</button>
                </header>
                <iframe
                    title={`Videollamada con ${enSala.quien}`}
                    src={`${JITSI}${enSala.sala}${OPCIONES}`}
                    allow="camera; microphone; speaker-selection; display-capture; autoplay; fullscreen; clipboard-write"
                />
            </div>
        );
    }

    if (!llamada) return null;

    return (
        <div className="tl-aviso" role="alertdialog" aria-label="Llamada entrante">
            <div className="tl-aro">
                <span className="tl-avatar">{iniciales(llamada.quien)}</span>
            </div>

            <div className="tl-txt">
                <p className="tl-rotulo">Videollamada entrante · {hora(llamada.cuando)}</p>
                <p className="tl-quien">{llamada.quien}</p>
            </div>

            <div className="tl-botones">
                <button className="tl-si" onClick={() => responder('Aceptada')}>
                    Contestar
                </button>
                <button className="tl-no" onClick={() => responder('Rechazada')}>
                    Rechazar
                </button>
            </div>
        </div>
    );
}
