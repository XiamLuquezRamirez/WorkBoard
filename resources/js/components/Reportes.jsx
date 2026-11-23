import React, { useState, useEffect } from "react";
import {
    FaArrowLeft,
    FaChartArea,
    FaChartBar,
    FaChartLine,
    FaTimes,
    FaFilePdf,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Header from "./Header";
import axiosInstance from "../axiosConfig";
import { useUser } from './UserContext';
import Sidebar from "./Sidebar";
import usePdfInforme from "./reportes/usePdfInforme";
import InformeEjecutivo from "./reportes/InformeEjecutivo";
import InformeDesempeno from "./reportes/InformeDesempeno";
import InformePuntualidad from "./reportes/InformePuntualidad";
import InformeTareasEmpleado from "./reportes/InformeTareasEmpleado";
import InformeProyectos from "./reportes/InformeProyectos";
import InformeReprogramaciones from "./reportes/InformeReprogramaciones";
import InformeRegistro from "./reportes/InformeRegistro";
import InformeCalidad from "./reportes/InformeCalidad";

/** Fecha local 'AAAA-MM-DD' (toISOString la daba en UTC). */
const fechaLocal = (d = new Date()) => {
    const dos = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

const Reportes = () => {
    const { user } = useUser();
    const [selectedReport, setSelectedReport] = useState(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    //iniciar fechas primer dia del mes actual y ultimo dia del mes actual
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const getFormattedDate = (date) => fechaLocal(date);
    const [startDate, setStartDate] = useState(getFormattedDate(firstDay));
    const [endDate, setEndDate] = useState(getFormattedDate(lastDay));

    const [tareas, setTareas] = useState([]);
    // Antes no había: al abrir un informe se veían los datos del anterior
    // mientras llegaba la respuesta, y un fallo sólo iba a la consola.
    const [tareasCargando, setTareasCargando] = useState(false);
    const [tareasError, setTareasError] = useState(false);
    const navigate = useNavigate();
    
    const { generarPDF, pdfLoading } = usePdfInforme();

    const reportCards = [
        {
            id: 0,
            title: "Informe Ejecutivo",
            icon: <FaChartLine size={25} />,
            description: "Entregas, cumplimiento y vencidas: general, por área y por persona",
            color: "#0f766e",
            onClick: () => {
                setSelectedReport("ejecutivo");
                setShowReportModal(true);
                consultarTareas();
            },
        },
        {
            id: 10,
            title: "Quién no registra",
            icon: <FaChartBar size={25} />,
            description: "Personas sin movimiento en sus tareas, semana a semana, por líder y por área",
            color: "#b45309",
            onClick: () => {
                setSelectedReport("registro");
                setShowReportModal(true);
            },
        },
        {
            id: 2,
            title: "Puntualidad y vencidas",
            icon: <FaChartArea size={25} />,
            description: "Qué está vencido hoy y desde cuándo, y qué tan puntual fue lo entregado",
            color: "#b91c1c",
            onClick: () => {
                setSelectedReport("puntualidad");
                setShowReportModal(true);
                consultarTareas();
            },
        },
        {
            id: 5,
            title: "Informe de tareas por empleado",
            icon: <FaChartBar size={25} />,
            description: "Resumen de tareas por empleado",
            color: "#0891b2",
            onClick: () => {
                setSelectedReport("tareasPorEmpleado");
                setShowReportModal(true);
                consultarTareas();
            },
        },
        {
            id: 7,
            title: "Desempeño",
            icon: <FaChartArea size={25} />,
            description: "Índice de Desempeño por persona y área, con periodo a elegir",
            color: "#1d4ed8",
            onClick: () => {
                setSelectedReport("desempeno");
                setShowReportModal(true);
            },
        },
        {
            id: 11,
            title: "Calidad de definición y aceptación",
            icon: <FaChartArea size={25} />,
            description: "Tareas mal definidas, espera del visto bueno y entregas devueltas",
            color: "#0f766e",
            onClick: () => {
                setSelectedReport("calidad");
                setShowReportModal(true);
            },
        },
        {
            id: 9,
            title: "Reprogramaciones y pausas",
            icon: <FaChartArea size={25} />,
            description: "Cuánto, quién y cómo se aplazan las tareas, con y sin aprobación",
            color: "#b45309",
            onClick: () => {
                setSelectedReport("reprogramaciones");
                setShowReportModal(true);
            },
        },
        {
            id: 8,
            title: "Informe de Proyectos",
            icon: <FaChartBar size={25} />,
            description: "Avance, tareas y equipo por proyecto",
            color: "#7c3aed",
            onClick: () => {
                setSelectedReport("proyectos");
                setShowReportModal(true);
            },
        },

    ];




    const consultarTareas = () => {
        setTareasCargando(true);
        setTareasError(false);
        axiosInstance
            .get("/informes/tareas")
            .then((response) => {
                setTareas(response.data);
            })
            .catch((error) => {
                console.error("Error al cargar las tareas:", error);
                setTareasError(true);
            })
            .finally(() => setTareasCargando(false));
    }



    return (
        <>
            <Sidebar />
            <Header
                showUserMenu={showUserMenu}
                setShowUserMenu={setShowUserMenu}
                currentUser={user}
            />
            <div className="parameters-container">
                <div className="parameters-header">
                    <h1>Reportes</h1>
                    <button
                        className="back-button"
                        onClick={() => navigate("/dashboard")}
                    >
                        <FaArrowLeft /> Regresar al Dashboard
                    </button>
                </div>
                <div className="parameters-grid">
                    {reportCards.map((card) => (
                        <div
                            key={card.id}
                            className="parameter-card"
                            onClick={card.onClick}
                        >
                            <div className="card-icon">{card.icon}</div>
                            <div className="card-content">
                                <h3>{card.title}</h3>
                                <p>{card.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {showReportModal && selectedReport === "puntualidad" && (
                <InformePuntualidad
                    tareas={tareas}
                    cargando={tareasCargando}
                    error={tareasError}
                    startDate={startDate}
                    setStartDate={setStartDate}
                    endDate={endDate}
                    setEndDate={setEndDate}
                    onCerrar={() => setShowReportModal(false)}
                    onPDF={generarPDF}
                    pdfLoading={pdfLoading}
                />
            )}

            {showReportModal && selectedReport === "tareasPorEmpleado" && (
                <InformeTareasEmpleado
                    tareas={tareas}
                    cargando={tareasCargando}
                    error={tareasError}
                    onCerrar={() => setShowReportModal(false)}
                    onPDF={generarPDF}
                    pdfLoading={pdfLoading}
                />
            )}

            {showReportModal && selectedReport === "ejecutivo" && (
                <InformeEjecutivo
                    tareas={tareas}
                    cargando={tareasCargando}
                    error={tareasError}
                    startDate={startDate}
                    setStartDate={setStartDate}
                    endDate={endDate}
                    setEndDate={setEndDate}
                    onCerrar={() => setShowReportModal(false)}
                    onPDF={generarPDF}
                    pdfLoading={pdfLoading}
                />
            )}

            {showReportModal && selectedReport === "desempeno" && (
                <InformeDesempeno
                    onCerrar={() => setShowReportModal(false)}
                    onPDF={generarPDF}
                    pdfLoading={pdfLoading}
                />
            )}

            {showReportModal && selectedReport === "proyectos" && (
                <InformeProyectos
                    onCerrar={() => setShowReportModal(false)}
                    onPDF={generarPDF}
                    pdfLoading={pdfLoading}
                />
            )}

            {showReportModal && selectedReport === "registro" && (
                <InformeRegistro
                    onCerrar={() => setShowReportModal(false)}
                    onPDF={generarPDF}
                    pdfLoading={pdfLoading}
                />
            )}

            {showReportModal && selectedReport === "calidad" && (
                <InformeCalidad
                    onCerrar={() => setShowReportModal(false)}
                    onPDF={generarPDF}
                    pdfLoading={pdfLoading}
                />
            )}

            {showReportModal && selectedReport === "reprogramaciones" && (
                <InformeReprogramaciones
                    onCerrar={() => setShowReportModal(false)}
                    onPDF={generarPDF}
                    pdfLoading={pdfLoading}
                />
            )}

        </>
    );
};

export default Reportes;
