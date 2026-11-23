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
    const [datosReprogramaciones, setDatosReprogramaciones] = useState([]);
    const [loadingReprg, setLoadingReprg] = useState(false);
    const [reprgFiltroEstado, setReprgFiltroEstado] = useState('');
    const [reprgFiltroEmpleado, setReprgFiltroEmpleado] = useState('');
    const [reprgFiltroDept, setReprgFiltroDept] = useState('');
    const [reprgInicio, setReprgInicio] = useState('');
    const [reprgFin, setReprgFin] = useState('');

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
            id: 9,
            title: "Reprogramaciones",
            icon: <FaChartArea size={25} />,
            description: "Historial de solicitudes de reprogramación de tareas",
            color: "#b45309",
            onClick: () => {
                setReprgFiltroEstado('');
                setReprgFiltroEmpleado('');
                setReprgFiltroDept('');
                setReprgInicio('');
                setReprgFin('');
                setSelectedReport("reprogramaciones");
                setShowReportModal(true);
                consultarReprogramaciones();
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


    const cambiarFormatoFecha = (fecha) => {
        if (!fecha) return 'N/A';
        const fechaObj = new Date(fecha + 'T12:00:00');
        const dia = fechaObj.getDate().toString().padStart(2, '0');
        const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
        const anio = fechaObj.getFullYear();
        return `${dia}/${mes}/${anio}`;
    }


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

    const consultarReprogramaciones = (inicio = '', fin = '') => {
        setLoadingReprg(true);
        const params = new URLSearchParams();
        if (inicio) params.append('inicio', inicio);
        if (fin)    params.append('fin', fin);
        axiosInstance.get(`/informes/reprogramaciones?${params.toString()}`)
            .then(res => setDatosReprogramaciones(Array.isArray(res.data) ? res.data : []))
            .catch(err => console.error('Error cargando reprogramaciones:', err))
            .finally(() => setLoadingReprg(false));
    };


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

            {/* ── Informe de Reprogramaciones ── */}
            {showReportModal && selectedReport === 'reprogramaciones' && (() => {
                const reprgFiltrados = datosReprogramaciones.filter(r =>
                    (!reprgFiltroEstado   || r.estado === reprgFiltroEstado) &&
                    (!reprgFiltroEmpleado || r.nombre_solicitante === reprgFiltroEmpleado) &&
                    (!reprgFiltroDept     || r.departamento === reprgFiltroDept)
                );
                const empleadosReprg = [...new Set(datosReprogramaciones.map(r => r.nombre_solicitante).filter(Boolean))].sort();
                const deptosReprg    = [...new Set(datosReprogramaciones.map(r => r.departamento).filter(Boolean))].sort();
                const totalPendientes = reprgFiltrados.filter(r => r.estado === 'Pendiente').length;
                const totalAprobadas  = reprgFiltrados.filter(r => r.estado === 'Aprobada').length;
                const totalRechazadas = reprgFiltrados.filter(r => r.estado === 'Rechazada').length;

                const estadoColor = (e) => {
                    if (e === 'Aprobada')  return { background: '#d1fae5', color: '#065f46', borderRadius: '4px', padding: '2px 8px', fontWeight: 600, fontSize: '0.8rem' };
                    if (e === 'Rechazada') return { background: '#fee2e2', color: '#991b1b', borderRadius: '4px', padding: '2px 8px', fontWeight: 600, fontSize: '0.8rem' };
                    return { background: '#fef3c7', color: '#92400e', borderRadius: '4px', padding: '2px 8px', fontWeight: 600, fontSize: '0.8rem' };
                };

                return (
                    <div className="modal-overlay">
                        <div className="modal-report">
                            <div className="modal-header">
                                <h2>Informe de Reprogramaciones</h2>
                                <div className="header-actions">
                                    <button className="pdf-button" onClick={() => generarPDF('Informe-Reprogramaciones')} disabled={pdfLoading}>
                                        <FaFilePdf /> {pdfLoading ? '...' : 'PDF'}
                                    </button>
                                    <button className="close-button" onClick={() => setShowReportModal(false)}>
                                        <FaTimes />
                                    </button>
                                </div>
                            </div>

                            <div className="tab-content">
                                {/* Filtros */}
                                <div className="eficiencia-filtros">
                                    <label className="eficiencia-filtro-label">
                                        Desde
                                        <input type="date" className="eficiencia-filtro-input" value={reprgInicio}
                                            onChange={e => { setReprgInicio(e.target.value); consultarReprogramaciones(e.target.value, reprgFin); }} />
                                    </label>
                                    <label className="eficiencia-filtro-label">
                                        Hasta
                                        <input type="date" className="eficiencia-filtro-input" value={reprgFin}
                                            onChange={e => { setReprgFin(e.target.value); consultarReprogramaciones(reprgInicio, e.target.value); }} />
                                    </label>
                                    <label className="eficiencia-filtro-label">
                                        Estado
                                        <select className="eficiencia-filtro-input" value={reprgFiltroEstado} onChange={e => setReprgFiltroEstado(e.target.value)}>
                                            <option value="">Todos</option>
                                            <option value="Pendiente">Pendiente</option>
                                            <option value="Aprobada">Aprobada</option>
                                            <option value="Rechazada">Rechazada</option>
                                        </select>
                                    </label>
                                    <label className="eficiencia-filtro-label">
                                        Empleado
                                        <select className="eficiencia-filtro-input" value={reprgFiltroEmpleado} onChange={e => setReprgFiltroEmpleado(e.target.value)}>
                                            <option value="">Todos</option>
                                            {empleadosReprg.map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                    </label>
                                    <label className="eficiencia-filtro-label">
                                        Área
                                        <select className="eficiencia-filtro-input" value={reprgFiltroDept} onChange={e => setReprgFiltroDept(e.target.value)}>
                                            <option value="">Todas</option>
                                            {deptosReprg.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </label>
                                    <button className="eficiencia-filtro-clear" onClick={() => { setReprgFiltroEstado(''); setReprgFiltroEmpleado(''); setReprgFiltroDept(''); setReprgInicio(''); setReprgFin(''); consultarReprogramaciones(); }}>Limpiar</button>
                                    {loadingReprg && <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Cargando...</span>}
                                </div>

                                {/* KPIs */}
                                <div className="reprg-kpis" style={{ display: 'flex', gap: '1rem', margin: '1rem 0', flexWrap: 'wrap' }}>
                                    <div className="reprg-kpi" style={{ background: '#fef9c3', borderRadius: '8px', padding: '0.75rem 1.5rem', textAlign: 'center', minWidth: '110px' }}>
                                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#92400e' }}>{totalPendientes}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#78350f' }}>Pendientes</div>
                                    </div>
                                    <div className="reprg-kpi" style={{ background: '#d1fae5', borderRadius: '8px', padding: '0.75rem 1.5rem', textAlign: 'center', minWidth: '110px' }}>
                                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#065f46' }}>{totalAprobadas}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#064e3b' }}>Aprobadas</div>
                                    </div>
                                    <div className="reprg-kpi" style={{ background: '#fee2e2', borderRadius: '8px', padding: '0.75rem 1.5rem', textAlign: 'center', minWidth: '110px' }}>
                                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#991b1b' }}>{totalRechazadas}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#7f1d1d' }}>Rechazadas</div>
                                    </div>
                                    <div className="reprg-kpi" style={{ background: '#e0e7ff', borderRadius: '8px', padding: '0.75rem 1.5rem', textAlign: 'center', minWidth: '110px' }}>
                                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#3730a3' }}>{reprgFiltrados.length}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#312e81' }}>Total</div>
                                    </div>
                                </div>

                                {reprgFiltrados.length === 0 && !loadingReprg ? (
                                    <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>No hay reprogramaciones para mostrar.</p>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                                            <thead>
                                                <tr style={{ background: '#f3f4f6' }}>
                                                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Tarea</th>
                                                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Empleado</th>
                                                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Área</th>
                                                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Fecha anterior</th>
                                                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Nueva fecha</th>
                                                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Motivo</th>
                                                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Estado</th>
                                                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Aprobado/Rechazado por</th>
                                                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Fecha solicitud</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reprgFiltrados.map((r, i) => (
                                                    <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                                        <td style={{ padding: '7px 10px', fontWeight: 500 }}>{r.tarea_titulo}</td>
                                                        <td style={{ padding: '7px 10px' }}>{r.nombre_solicitante}</td>
                                                        <td style={{ padding: '7px 10px', color: '#6b7280' }}>{r.departamento || '—'}</td>
                                                        <td style={{ padding: '7px 10px', textAlign: 'center', color: '#6b7280' }}>{cambiarFormatoFecha(r.fecha_actual)}</td>
                                                        <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600, color: '#1d4ed8' }}>{cambiarFormatoFecha(r.fecha_nueva)}</td>
                                                        <td style={{ padding: '7px 10px', maxWidth: '200px', wordBreak: 'break-word' }}>{r.motivo}</td>
                                                        <td style={{ padding: '7px 10px', textAlign: 'center' }}><span style={estadoColor(r.estado)}>{r.estado}</span></td>
                                                        <td style={{ padding: '7px 10px', color: '#6b7280' }}>{r.nombre_aprobador || '—'}</td>
                                                        <td style={{ padding: '7px 10px', textAlign: 'center', color: '#6b7280', fontSize: '0.82rem' }}>{cambiarFormatoFecha(r.fecha_solicitud?.split(' ')[0] || r.fecha_solicitud)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

        </>
    );
};

export default Reportes;
