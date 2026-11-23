import React, { useEffect, useState } from 'react';
import {
    FaChartArea, FaChartBar, FaChartLine, FaClock, FaFilePdf, FaFolder, FaTasks, FaTimes, FaUserClock, FaCheckDouble,
} from 'react-icons/fa';
import axiosInstance from '../axiosConfig';
import { AmbitoInforme } from './reportes/ambito';
import usePdfInforme from './reportes/usePdfInforme';
import InformeEjecutivo from './reportes/InformeEjecutivo';
import InformeDesempeno from './reportes/InformeDesempeno';
import InformePuntualidad from './reportes/InformePuntualidad';
import InformeTareasEmpleado from './reportes/InformeTareasEmpleado';
import InformeProyectos from './reportes/InformeProyectos';
import InformeReprogramaciones from './reportes/InformeReprogramaciones';
import InformeRegistro from './reportes/InformeRegistro';
import InformeCalidad from './reportes/InformeCalidad';
import ReporteGeneral from './reportes/ReporteGeneral';

/**
 * Reportes del equipo, para líderes: los MISMOS informes de administración,
 * acotados a su equipo (sin sus propias tareas). Antes era una copia aparte
 * con sus propias fórmulas, que daba cifras distintas.
 */
const EQUIPO = { equipo: 1 };

// conTareas: recibe las tareas del equipo. conPeriodo: además, las fechas.
const INFORMES = [
    { id: 'general', titulo: 'Reporte General', texto: 'El documento completo del periodo, para PDF', icono: FaFilePdf, color: '#1a3a5c', Vista: ReporteGeneral, conTareas: true, conPeriodo: true },
    { id: 'ejecutivo', titulo: 'Informe Ejecutivo', texto: 'Entregas, cumplimiento y vencidas del equipo', icono: FaChartLine, color: '#0f766e', Vista: InformeEjecutivo, conTareas: true, conPeriodo: true },
    { id: 'registro', titulo: 'Quién no registra', texto: 'Personas sin movimiento en sus tareas, semana a semana', icono: FaUserClock, color: '#b45309', Vista: InformeRegistro },
    { id: 'puntualidad', titulo: 'Puntualidad y vencidas', texto: 'Qué está vencido y qué tan puntual fue lo entregado', icono: FaClock, color: '#b91c1c', Vista: InformePuntualidad, conTareas: true, conPeriodo: true },
    { id: 'tareas', titulo: 'Tareas por empleado', texto: 'El detalle de cada persona', icono: FaTasks, color: '#0891b2', Vista: InformeTareasEmpleado, conTareas: true },
    { id: 'desempeno', titulo: 'Desempeño', texto: 'Índice de Desempeño de cada persona', icono: FaChartArea, color: '#1d4ed8', Vista: InformeDesempeno },
    { id: 'calidad', titulo: 'Calidad de definición y aceptación', texto: 'Tareas mal definidas, visto bueno y entregas devueltas', icono: FaCheckDouble, color: '#0f766e', Vista: InformeCalidad },
    { id: 'reprogramaciones', titulo: 'Reprogramaciones y pausas', texto: 'Cuánto y cómo se aplazan las tareas', icono: FaChartBar, color: '#b45309', Vista: InformeReprogramaciones },
    { id: 'proyectos', titulo: 'Proyectos', texto: 'Avance frente a lo esperado', icono: FaFolder, color: '#7c3aed', Vista: InformeProyectos },
];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const ReportesDepartamentoModal = ({ onClose }) => {
    const hoy = new Date();
    const [abierto, setAbierto] = useState(null);
    const [startDate, setStartDate] = useState(iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
    const [endDate, setEndDate] = useState(iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)));
    const [tareas, setTareas] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(false);
    const { generarPDF, pdfLoading } = usePdfInforme();

    const informe = INFORMES.find((i) => i.id === abierto);
    const conTareas = Boolean(informe?.conTareas);

    useEffect(() => {
        if (!conTareas) return undefined;
        let vivo = true;
        setCargando(true);
        setError(false);
        axiosInstance.get('/informes/tareas', { params: EQUIPO })
            .then((r) => { if (vivo) setTareas(r.data); })
            .catch(() => { if (vivo) setError(true); })
            .finally(() => { if (vivo) setCargando(false); });
        return () => { vivo = false; };
    }, [abierto, conTareas]);

    if (informe) {
        const { Vista } = informe;
        return (
            <AmbitoInforme.Provider value={EQUIPO}>
                <Vista
                    onCerrar={() => setAbierto(null)}
                    onPDF={generarPDF}
                    pdfLoading={pdfLoading}
                    {...(informe.conTareas ? { tareas, cargando, error } : {})}
                    {...(informe.conPeriodo ? { startDate, setStartDate, endDate, setEndDate } : {})}
                />
            </AmbitoInforme.Provider>
        );
    }

    return (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal-report rdm-modal-wrap">
                <div className="modal-header">
                    <h2 style={{ margin: 0 }}>Reportes de mi equipo</h2>
                    <div className="header-actions">
                        <button className="close-button" onClick={onClose} aria-label="Cerrar"><FaTimes /></button>
                    </div>
                </div>
                <div className="rdm-body">
                    <div className="parameters-grid rdm-cards-grid">
                        {INFORMES.map(({ id, titulo, texto, icono: Icono, color }) => (
                            <div
                                key={id} className="parameter-card" style={{ cursor: 'pointer' }} role="button" tabIndex={0}
                                onClick={() => setAbierto(id)}
                                onKeyDown={(e) => { if (e.key === 'Enter') setAbierto(id); }}
                            >
                                <div className="card-icon" style={{ color }}><Icono size={25} /></div>
                                <div className="card-content">
                                    <h3>{titulo}</h3>
                                    <p>{texto}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportesDepartamentoModal;
