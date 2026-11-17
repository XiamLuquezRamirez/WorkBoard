import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaCalendarCheck, FaVideo, FaMapMarkerAlt } from 'react-icons/fa';
import axiosInstance from '../../axiosConfig';
import { avisarCambioReuniones } from './FormularioReunion';
import './reunionesPendientes.css';

/** Cada cuánto se revisan las convocatorias con la pantalla abierta. */
const SONDEO_MS = 60000;

/** Cuántos días por delante se muestran las reuniones ya confirmadas. */
const HORIZONTE_DIAS = 7;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function dia(fecha) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const d = new Date(`${fecha}T00:00:00`);
    const n = Math.round((d - hoy) / 86400000);
    if (n === 0) return 'Hoy';
    if (n === 1) return 'Mañana';
    return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** Momento en que la reunión deja de tener sentido como pendiente. */
const finDe = (r) => new Date(`${r.fecha}T${r.hora_fin || r.hora_inicio}:00`).getTime()
    + (r.hora_fin ? 0 : 3600000);

/**
 * Reuniones que el colaborador tiene pendientes, en «Mis Tareas».
 *
 * Arriba las convocatorias sin responder, con «Asistiré» y «No puedo» a mano:
 * son algo que hacer, como una tarea. Debajo, las que ya confirmó para los
 * próximos días, para que no se le pasen. Las rechazadas y las canceladas no
 * aparecen. Si no hay nada, el recuadro no se dibuja.
 */
export default function ReunionesPendientes({ onVerTodas }) {
    const [lista, setLista] = useState([]);
    const [enviando, setEnviando] = useState(null);

    const cargar = useCallback(() => {
        axiosInstance.get('/equipo/reuniones')
            .then((r) => setLista(r.data?.reuniones || []))
            .catch(() => { /* sin reuniones no se muestra nada */ });
    }, []);

    useEffect(() => {
        cargar();
        const tic = setInterval(() => { if (!document.hidden) cargar(); }, SONDEO_MS);
        const alVolver = () => { if (!document.hidden) cargar(); };
        window.addEventListener('wb:reuniones-cambiaron', cargar);
        document.addEventListener('visibilitychange', alVolver);
        return () => {
            clearInterval(tic);
            window.removeEventListener('wb:reuniones-cambiaron', cargar);
            document.removeEventListener('visibilitychange', alVolver);
        };
    }, [cargar]);

    const { porResponder, proximas } = useMemo(() => {
        const ahora = Date.now();
        const limite = ahora + HORIZONTE_DIAS * 86400000;
        const vivas = lista.filter((r) => r.estado === 'Programada' && finDe(r) > ahora);
        return {
            porResponder: vivas.filter((r) => !r.soy_organizador && r.mi_respuesta === 'Pendiente'),
            proximas: vivas.filter((r) => (r.soy_organizador || r.mi_respuesta === 'Acepta')
                && new Date(`${r.fecha}T00:00:00`).getTime() <= limite),
        };
    }, [lista]);

    const responder = (id, respuesta) => {
        setEnviando(id);
        axiosInstance.put(`/equipo/reuniones/${id}/respuesta`, { respuesta })
            .then(() => {
                setLista((l) => l.map((r) => (r.id === id ? { ...r, mi_respuesta: respuesta } : r)));
                avisarCambioReuniones();
            })
            .catch(() => cargar())
            .finally(() => setEnviando(null));
    };

    if (porResponder.length === 0 && proximas.length === 0) return null;

    const fila = (r, pendiente) => {
        const hoy = dia(r.fecha) === 'Hoy';
        return (
            <li key={r.id} className={`rp-item ${pendiente ? 'es-pendiente' : ''}`}>
                <span className={`rp-dia ${hoy ? 'es-hoy' : ''}`}>
                    <b>{dia(r.fecha)}</b>
                    <span>{r.hora_inicio}{r.hora_fin ? `–${r.hora_fin}` : ''}</span>
                </span>

                <div className="rp-txt">
                    <p className="rp-titulo">
                        {r.titulo}
                        {pendiente && <em className="rp-estado">Por confirmar</em>}
                    </p>
                    <p className="rp-meta">
                        {r.soy_organizador ? 'La organizas tú' : `Convoca ${r.organizador}`}
                        {' · '}{r.asistentes.length} participante{r.asistentes.length === 1 ? '' : 's'}
                        {r.lugar && <span><FaMapMarkerAlt /> {r.lugar}</span>}
                    </p>
                </div>

                <div className="rp-acciones">
                    {pendiente ? (
                        <>
                            <button type="button" className="rp-si" disabled={enviando === r.id} onClick={() => responder(r.id, 'Acepta')}>
                                Asistiré
                            </button>
                            <button type="button" className="rp-no" disabled={enviando === r.id} onClick={() => responder(r.id, 'Rechaza')}>
                                No puedo
                            </button>
                        </>
                    ) : r.enlace && (
                        <a className="rp-entrar" href={r.enlace} target="_blank" rel="noopener noreferrer">
                            <FaVideo /> Entrar
                        </a>
                    )}
                </div>
            </li>
        );
    };

    return (
        <section className="rp-caja" aria-label="Reuniones pendientes">
            <header className="rp-cab">
                <h3><FaCalendarCheck /> Reuniones</h3>
                {porResponder.length > 0 && (
                    <span className="rp-insignia">
                        {porResponder.length === 1 ? '1 por confirmar' : `${porResponder.length} por confirmar`}
                    </span>
                )}
                {onVerTodas && (
                    <button type="button" className="rp-ver" onClick={onVerTodas}>Ver todas</button>
                )}
            </header>
            <ul className="rp-lista">
                {porResponder.map((r) => fila(r, true))}
                {proximas.map((r) => fila(r, false))}
            </ul>
        </section>
    );
}
