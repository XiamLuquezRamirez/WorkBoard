import React, { useState, useEffect } from "react";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
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
    
    const [pdfLoading, setPdfLoading] = useState(false);

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




    const generarPDF = async (titulo) => {
        const element = document.querySelector('.modal-report');
        if (!element) return;
        setPdfLoading(true);

        // Expand every scroll container so html2canvas captures full content
        const saved = [];
        [element, ...element.querySelectorAll('*')].forEach(el => {
            const cs = window.getComputedStyle(el);
            const hasScroll = ['auto', 'scroll'].includes(cs.overflowY)
                || ['auto', 'scroll'].includes(cs.overflowX)
                || ['auto', 'scroll'].includes(cs.overflow);
            const hasMaxH = cs.maxHeight && cs.maxHeight !== 'none';
            if (hasScroll || hasMaxH) {
                saved.push({
                    el,
                    overflow:  el.style.overflow,
                    overflowX: el.style.overflowX,
                    overflowY: el.style.overflowY,
                    maxHeight: el.style.maxHeight,
                    height:    el.style.height,
                });
                el.style.overflow  = 'visible';
                el.style.overflowX = 'visible';
                el.style.overflowY = 'visible';
                el.style.maxHeight = 'none';
                el.style.height    = 'auto';
            }
        });

        // Allow browser to reflow before capture
        await new Promise(r => setTimeout(r, 200));

        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                backgroundColor: '#ffffff',
                scrollX: 0,
                scrollY: -window.scrollY,
                width:  element.scrollWidth,
                height: element.scrollHeight,
                windowWidth:  document.documentElement.scrollWidth,
                windowHeight: document.documentElement.scrollHeight,
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.92);
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWidth  = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const scale      = pageWidth / canvas.width;
            const scaledH    = canvas.height * scale;
            let posY = 0;
            while (posY < scaledH) {
                if (posY > 0) pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, -posY, pageWidth, scaledH);
                posY += pageHeight;
            }
            const fecha = fechaLocal();
            pdf.save(`${titulo.replace(/\s+/g, '-').toLowerCase()}-${fecha}.pdf`);
        } catch (e) {
            console.error('Error generando PDF:', e);
        } finally {
            // Restore original styles
            saved.forEach(({ el, overflow, overflowX, overflowY, maxHeight, height }) => {
                el.style.overflow  = overflow;
                el.style.overflowX = overflowX;
                el.style.overflowY = overflowY;
                el.style.maxHeight = maxHeight;
                el.style.height    = height;
            });
            setPdfLoading(false);
        }
    };

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
