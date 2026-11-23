import React, { useState, useEffect } from "react";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
    FaArrowLeft,
    FaChartArea,
    FaChartBar,
    FaChartLine,
    FaTimes,
    FaPrint,
    FaFilePdf,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Header from "./Header";
import axiosInstance from "../axiosConfig";
import RangosFecha from "./rangosFecha";
import { useUser } from './UserContext';
import {
    BarChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    LineChart,
    Line,
    ResponsiveContainer,
} from "recharts";
import Sidebar from "./Sidebar";
import InformeEjecutivo from "./reportes/InformeEjecutivo";
import InformeDesempeno from "./reportes/InformeDesempeno";
import InformePuntualidad from "./reportes/InformePuntualidad";
import * as XLSX from 'xlsx';

/**
 * Escapa un texto para meterlo en el HTML de las ventanas de impresión. Esas
 * ventanas son del mismo origen que la app: un título de tarea con «<script>»
 * se ejecutaba dentro de WorkBoard al imprimir.
 */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/** Fecha local 'AAAA-MM-DD' (toISOString la daba en UTC). */
const fechaLocal = (d = new Date()) => {
    const dos = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

/** El navegador bloqueó la ventana de impresión: antes fallaba sin decir nada. */
const avisarVentanaBloqueada = () => window.alert(
    'El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio e inténtalo de nuevo.'
);

const Reportes = () => {
    const { user } = useUser();
    const [selectedReport, setSelectedReport] = useState(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [activeTab, setActiveTab] = useState("tareasCompletadas");
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
    
    // Estados para filtros de tareas por empleado
    const [filterEmpleado, setFilterEmpleado] = useState('');
    const [filterDepartamento, setFilterDepartamento] = useState('');
    const [filterEstado, setFilterEstado] = useState('');
    const [filterFechaInicio, setFilterFechaInicio] = useState('');
    const [filterFechaFin, setFilterFechaFin] = useState('');
    const [filterAtrasadas, setFilterAtrasadas] = useState(false);
    const [empleadosList, setEmpleadosList] = useState([]);
    const [departamentos, setDepartamentos] = useState([]);
    const [estados, setEstados] = useState([]);
    const [datosProyectos, setDatosProyectos] = useState([]);
    const [loadingProyectos, setLoadingProyectos] = useState(false);
    const [proyectoFiltro, setProyectoFiltro] = useState('');
    const [proyectoEstadoFiltro, setProyectoEstadoFiltro] = useState('');
    const [proyectoDepartamentoFiltro, setProyectoDepartamentoFiltro] = useState('');
    const [proyectoStartDate, setProyectoStartDate] = useState('');
    const [proyectoEndDate, setProyectoEndDate] = useState('');
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
                setFilterEmpleado('');
                setFilterDepartamento('');
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
                _resetFiltrosModal();
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
                abrirModalInformeTareasPorEmpleado();
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
                setProyectoFiltro('');
                setProyectoEstadoFiltro('');
                setSelectedReport("proyectos");
                setShowReportModal(true);
                consultarProyectos();
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
                // Generar listas para filtros
                const empleadosUnicos = [...new Set(response.data.map(t => t.empleado))];
                const departamentosUnicos = [...new Set(response.data.map(t => t.departamento).filter(Boolean))];
                const estadosUnicos = [...new Set(response.data.map(t => t.estado))];
                
                setEmpleadosList(empleadosUnicos);
                setDepartamentos(departamentosUnicos);
                setEstados(estadosUnicos);
            })
            .catch((error) => {
                console.error("Error al cargar las tareas:", error);
                setTareasError(true);
            })
            .finally(() => setTareasCargando(false));
    }

    const consultarProyectos = () => {
        setLoadingProyectos(true);
        axiosInstance.get('/informes/proyectos')
            .then(res => setDatosProyectos(res.data))
            .catch(err => console.error('Error cargando proyectos:', err))
            .finally(() => setLoadingProyectos(false));
    };

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

    const calcularProyecto = (proyecto, filtros = {}) => {
        const { startDate: fStart, endDate: fEnd, departamento: fDept } = filtros;
        let tareas = proyecto.tareas || [];
        if (fDept)          tareas = tareas.filter(t => t.departamento === fDept);
        if (fStart || fEnd) tareas = tareas.filter(t =>
            (!fStart || t.fecha_pactada >= fStart) &&
            (!fEnd   || t.fecha_pactada <= fEnd)
        );
        const total       = tareas.length;
        const completadas = tareas.filter(t => t.estado === 'Completada').length;
        const enProceso   = tareas.filter(t => t.estado === 'En Proceso').length;
        const pendientes  = tareas.filter(t => t.estado === 'Pendiente').length;
        // vencida y a_tiempo vienen del servidor: la regla del índice.
        const atrasadas   = tareas.filter(t => t.vencida).length;
        const aTiempo     = tareas.filter(t => t.a_tiempo === true).length;
        const avance      = total > 0 ? Math.round((completadas / total) * 100) : 0;
        const empleados   = [...new Set(tareas.map(t => t.empleado).filter(Boolean))];
        const areas       = [...new Set(tareas.map(t => t.departamento).filter(Boolean))];
        return { total, completadas, enProceso, pendientes, atrasadas, aTiempo, avance, empleados, areas };
    };

    // Función para generar datos de tareas por empleado
    const generarTareasPorEmpleado = () => {
        let tareasFiltradas = tareas;

        // Aplicar filtros
        if (filterEmpleado) {
            tareasFiltradas = tareasFiltradas.filter(t => t.empleado === filterEmpleado);
        }
        if (filterDepartamento) {
            tareasFiltradas = tareasFiltradas.filter(t => t.departamento === filterDepartamento);
        }
        if (filterEstado) {
            tareasFiltradas = tareasFiltradas.filter(t => t.estado === filterEstado);
        }
        
        // Filtro específico para tareas atrasadas
        if (filterAtrasadas) {
            tareasFiltradas = tareasFiltradas.filter(t => t.vencida);
        }
        
        // Filtro por rango de fecha pactada
        if (filterFechaInicio) {
            tareasFiltradas = tareasFiltradas.filter(t => {
                if (!t.fecha_pactada) return false;
                return t.fecha_pactada >= filterFechaInicio;
            });
        }
        if (filterFechaFin) {
            tareasFiltradas = tareasFiltradas.filter(t => {
                if (!t.fecha_pactada) return false;
                return t.fecha_pactada <= filterFechaFin;
            });
        }

        // Agrupar por empleado
        const tareasPorEmpleado = {};
        
        tareasFiltradas.forEach(tarea => {
            if (!tareasPorEmpleado[tarea.empleado]) {
                tareasPorEmpleado[tarea.empleado] = {
                    empleado: tarea.empleado,
                    tareas: []
                };
            }
            tareasPorEmpleado[tarea.empleado].tareas.push(tarea);
        });

        return Object.values(tareasPorEmpleado);
    };

    // Función para generar resumen de tareas por empleado
    const generarResumenTareasPorEmpleado = () => {
        const tareasPorEmpleado = generarTareasPorEmpleado();
        
        return tareasPorEmpleado.map(empleadoData => {
            const tareas = empleadoData.tareas;
            const total = tareas.length;
            const completadas = tareas.filter(t => t.estado === 'Completada').length;
            const pendientes = tareas.filter(t => t.estado === 'Pendiente').length;
            // No existe un estado «Atrasada»: contaba siempre 0.
            const atrasadas = tareas.filter(t => t.vencida).length;
            const enProceso = tareas.filter(t => t.estado === 'En Proceso').length;
            const retrasadas = tareas.filter(t => t.estado === 'Retrasada').length;
            const noIniciadas = tareas.filter(t => t.estado === 'No Iniciada').length;
            const recurrentes = tareas.filter(t => t.recurrente === 1).length;

            return {
                empleado: empleadoData.empleado,
                total,
                completadas,
                pendientes,
                atrasadas,
                enProceso,
                retrasadas,
                noIniciadas,
                recurrentes
            };
        });
    };

    // Función para imprimir PDF
    const imprimirPDF = () => {
        const tareasPorEmpleado = generarTareasPorEmpleado();
        const resumen = generarResumenTareasPorEmpleado();
        
        // Crear contenido HTML para el PDF
        let htmlContent = `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #2b60e5; text-align: center; }
                    h2 { color: #333; margin-top: 30px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                    .filtros { margin-bottom: 20px; padding: 10px; background-color: #f9f9f9; }
                    .resumen { margin-bottom: 30px; }
                </style>
            </head>
            <body>
                <h1>Informe de Tareas por Empleado</h1>
                <div class="filtros">
                    <h3>Filtros Aplicados:</h3>
                    <p><strong>Empleado:</strong> ${esc(filterEmpleado || 'Todos')}</p>
                    <p><strong>Departamento:</strong> ${esc(filterDepartamento || 'Todos')}</p>
                    <p><strong>Estado:</strong> ${esc(filterEstado || 'Todos')}</p>
                    <p><strong>Solo tareas atrasadas:</strong> ${filterAtrasadas ? 'Sí' : 'No'}</p>
                    <p><strong>Fecha Pactada:</strong> ${filterFechaInicio && filterFechaFin ? `${cambiarFormatoFecha(filterFechaInicio)} - ${cambiarFormatoFecha(filterFechaFin)}` : filterFechaInicio ? `Desde ${cambiarFormatoFecha(filterFechaInicio)}` : filterFechaFin ? `Hasta ${cambiarFormatoFecha(filterFechaFin)}` : 'Todas las fechas'}</p>
                    <p><strong>Fecha de generación:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
        `;

        // Agregar resumen
        htmlContent += `
            <div class="resumen">
                <h2>Resumen por Empleado</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Empleado</th>
                            <th>Total</th>
                            <th>Completadas</th>
                            <th>Pendientes</th>
                            <th>Atrasadas</th>
                            <th>En Proceso</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        resumen.forEach(item => {
            htmlContent += `
                <tr>
                    <td>${esc(item.empleado)}</td>
                    <td>${item.total}</td>
                    <td>${item.completadas}</td>
                    <td>${item.pendientes}</td>
                    <td>${item.atrasadas}</td>
                    <td>${item.enProceso}</td>
                </tr>
            `;
        });

        htmlContent += `
                    </tbody>
                </table>
            </div>
        `;

        // Agregar detalle de tareas
        tareasPorEmpleado.forEach(empleadoData => {
            htmlContent += `
                <h2>Tareas de ${esc(empleadoData.empleado)}</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Título</th>
                            <th>Estado</th>
                            <th>Fecha Pactada</th>
                            <th>Fecha Entregada</th>
                            <th>Prioridad</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            empleadoData.tareas.forEach(tarea => {
                htmlContent += `
                    <tr>
                        <td>${esc(tarea.titulo)}</td>
                        <td>${esc(tarea.estado)}</td>
                        <td>${cambiarFormatoFecha(tarea.fecha_pactada) || 'N/A'}</td>
                        <td>${cambiarFormatoFecha(tarea.fecha_entregada) || 'N/A'}</td>
                        <td>${esc(tarea.prioridad || 'N/A')}</td>
                    </tr>
                `;
            });

            htmlContent += `
                    </tbody>
                </table>
            `;
        });

        htmlContent += `
            </body>
            </html>
        `;

        // Crear ventana de impresión
        const printWindow = window.open('', '_blank');
        if (!printWindow) { avisarVentanaBloqueada(); return; }
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
    };

    const exportarExcel = () => {
        const tareasPorEmpleado = generarTareasPorEmpleado();
        const workbook = XLSX.utils.book_new();

        // Hoja de resumen
        const resumenData = generarResumenTareasPorEmpleado().map(item => ({
            'Empleado': item.empleado,
            'Total': item.total,
            'Completadas': item.completadas,
            'Pendientes': item.pendientes,
            'En Proceso': item.enProceso,
            'Atrasadas': item.atrasadas,
        }));
        const wsResumen = XLSX.utils.json_to_sheet(resumenData);
        XLSX.utils.book_append_sheet(workbook, wsResumen, 'Resumen');

        // Hoja de detalle
        const detalleData = [];
        tareasPorEmpleado.forEach(empData => {
            empData.tareas.forEach(tarea => {
                detalleData.push({
                    'Empleado': empData.empleado,
                    'Departamento': tarea.departamento || 'N/A',
                    'Título': tarea.titulo,
                    'Estado': tarea.estado,
                    'Prioridad': tarea.prioridad || 'N/A',
                    'Fecha Pactada': cambiarFormatoFecha(tarea.fecha_pactada),
                    'Fecha Entregada': cambiarFormatoFecha(tarea.fecha_entregada),
                });
            });
        });
        const wsDetalle = XLSX.utils.json_to_sheet(detalleData);
        XLSX.utils.book_append_sheet(workbook, wsDetalle, 'Detalle');

        const fecha = fechaLocal();
        XLSX.writeFile(workbook, `Tareas_Empleados_${fecha}.xlsx`);
    };

    const imprimirProyectos = (proyectos, filtros = {}) => {
        const hoy = new Date().toLocaleDateString('es-ES');
        let html = `<html><head><style>
            body{font-family:Arial,sans-serif;margin:20px;font-size:13px;color:#111}
            h1{color:#7c3aed;text-align:center;margin-bottom:4px}
            .sub{text-align:center;color:#6b7280;margin-bottom:20px;font-size:12px}
            .proyecto{border:1px solid #e5e7eb;border-radius:6px;padding:14px;margin-bottom:20px;page-break-inside:avoid}
            .proy-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
            .proy-nombre{font-size:15px;font-weight:700;color:#1e1b4b}
            .proy-meta{font-size:11px;color:#6b7280;margin-top:2px}
            .badge{padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600}
            .badge-activo{background:#ede9fe;color:#6d28d9}
            .badge-completado{background:#dcfce7;color:#15803d}
            .badge-pausado{background:#fef9c3;color:#b45309}
            .badge-cancelado{background:#fee2e2;color:#b91c1c}
            .avance-bar{height:10px;background:#e5e7eb;border-radius:99px;margin:8px 0;overflow:hidden}
            .avance-fill{height:100%;border-radius:99px;background:#7c3aed}
            .stats{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px;font-size:12px}
            .stat{background:#f5f3ff;border-radius:4px;padding:4px 10px}
            .empleados{font-size:11px;color:#374151;margin-bottom:8px}
            table{width:100%;border-collapse:collapse;margin-top:6px;font-size:11px}
            th,td{border:1px solid #e5e7eb;padding:5px 7px;text-align:left}
            th{background:#f5f3ff;font-weight:600}
            .c-ok{color:#15803d;font-weight:600}
            .c-proc{color:#2563eb}
            .c-pend{color:#f97316}
            .c-atras{color:#b91c1c;font-weight:600}
        </style></head><body>
        <h1>Informe de Proyectos</h1>
        <p class="sub">Generado: ${hoy}</p>`;

        proyectos.forEach(p => {
            const st = calcularProyecto(p, filtros);
            const badgeClass = {ACTIVO:'activo',COMPLETADO:'completado',PAUSADO:'pausado',CANCELADO:'cancelado'}[p.estado?.toUpperCase()] || 'activo';
            html += `<div class="proyecto">
                <div class="proy-header">
                    <div>
                        <div class="proy-nombre">${esc(p.nombre)}</div>
                        <div class="proy-meta">Inicio: ${esc(p.fecha_inicio || '—')} · Fin estimado: ${esc(p.fecha_fin_estimada || '—')}</div>
                    </div>
                    <span class="badge badge-${badgeClass}">${esc(p.estado || '—')}</span>
                </div>
                <div class="avance-bar"><div class="avance-fill" style="width:${st.avance}%"></div></div>
                <div style="font-size:12px;color:#6b7280;margin-bottom:8px">Avance: ${st.avance}%</div>
                <div class="stats">
                    <div class="stat">Total: <strong>${st.total}</strong></div>
                    <div class="stat" style="background:#dcfce7">✅ Completadas: <strong>${st.completadas}</strong></div>
                    <div class="stat" style="background:#dbeafe">⏳ En Proceso: <strong>${st.enProceso}</strong></div>
                    <div class="stat" style="background:#ffedd5">⌛ Pendientes: <strong>${st.pendientes}</strong></div>
                    <div class="stat" style="background:#fee2e2">⚠️ Atrasadas: <strong>${st.atrasadas}</strong></div>
                </div>
                <div class="empleados"><strong>Equipo:</strong> ${esc(st.empleados.join(' · ') || '—')}</div>
                <table><thead><tr><th>#</th><th>Tarea</th><th>Empleado</th><th>Estado</th><th>Fecha pactada</th><th>Entregada</th><th>¿A tiempo?</th></tr></thead><tbody>`;
            p.tareas.forEach((t, i) => {
                const aTiempo = t.estado === 'Completada' && t.fecha_entregada && t.fecha_entregada <= t.fecha_pactada;
                const estadoClass = t.estado === 'Completada' ? 'c-ok' : t.estado === 'En Proceso' ? 'c-proc' : 'c-pend';
                html += `<tr>
                    <td>${i+1}</td>
                    <td>${esc(t.titulo || '—')}</td>
                    <td>${esc(t.empleado || '—')}</td>
                    <td class="${estadoClass}">${esc(t.estado)}</td>
                    <td>${esc(t.fecha_pactada || '—')}</td>
                    <td>${esc(t.fecha_entregada || '—')}</td>
                    <td>${t.estado === 'Completada' ? (aTiempo ? '✅ Sí' : '❌ No') : '—'}</td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
        });

        html += `</body></html>`;
        const win = window.open('', '_blank');
        if (!win) { avisarVentanaBloqueada(); return; }
        if (!win) return;
        win.document.write(html);
        win.document.close();
        win.print();
    };

    const exportarProyectosExcel = (proyectos, filtros = {}) => {
        const wb = XLSX.utils.book_new();

        // Hoja resumen
        const resumen = proyectos.map(p => {
            const st = calcularProyecto(p, filtros);
            return {
                'Proyecto': p.nombre,
                'Estado': p.estado,
                'Inicio': p.fecha_inicio || '',
                'Fin estimado': p.fecha_fin_estimada || '',
                'Total tareas': st.total,
                'Completadas': st.completadas,
                'En Proceso': st.enProceso,
                'Pendientes': st.pendientes,
                'Atrasadas': st.atrasadas,
                'A tiempo': st.aTiempo,
                '% Avance': st.avance + '%',
                'Empleados': st.empleados.join(', '),
            };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen');

        // Hoja detalle de tareas
        const detalle = [];
        proyectos.forEach(p => {
            (p.tareas || []).forEach((t, i) => {
                const aTiempo = t.estado === 'Completada' && t.fecha_entregada && t.fecha_entregada <= t.fecha_pactada;
                detalle.push({
                    'Proyecto': p.nombre,
                    '#': i + 1,
                    'Tarea': t.titulo || '',
                    'Empleado': t.empleado || '',
                    'Área': t.departamento || '',
                    'Estado': t.estado,
                    'Fecha pactada': t.fecha_pactada || '',
                    'Fecha entregada': t.fecha_entregada || '',
                    'A tiempo': t.estado === 'Completada' ? (aTiempo ? 'Sí' : 'No') : '—',
                });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), 'Tareas');

        const fecha = fechaLocal();
        XLSX.writeFile(wb, `informe-proyectos-${fecha}.xlsx`);
    };

    const _resetFiltrosModal = () => {
        setFilterEmpleado('');
        setFilterDepartamento('');
    };

    const abrirModalInformeTareasPorEmpleado = () => {
        _resetFiltrosModal();
        setSelectedReport("tareasPorEmpleado");
        setShowReportModal(true);
        setActiveTab("tareasPorEmpleado");
        consultarTareas();
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
                <div className="modal-overlay">
                    <div className="modal-report">
                        <div className="modal-header">
                            <h2>Informe de Tareas por Empleado</h2>
                            <div className="header-actions">
                                <button className="pdf-button" onClick={() => generarPDF('Informe de Tareas por Empleado')} disabled={pdfLoading}>
                                    <FaFilePdf /> {pdfLoading ? '...' : 'PDF'}
                                </button>
                                <button className="excel-button" onClick={exportarExcel}>
                                    <FaChartBar /> Excel
                                </button>
                                <button className="print-button" onClick={imprimirPDF}>
                                    <FaPrint /> Imprimir
                                </button>
                                <button className="close-button" onClick={() => setShowReportModal(false)}>
                                    <FaTimes />
                                </button>
                            </div>
                        </div>
                        <div className="tab-content">
                            <div className="bg-white shadow-xl rounded-2xl p-8 space-y-8 border border-gray-200">
                                <div className="text-center mb-10">
                                    <h3 className="text-3xl font-bold text-gray-800 mb-3">Tareas por Empleado</h3>
                                    <p className="text-gray-600 text-lg">Informe detallado de tareas por empleado</p>
                                    <div className="w-24 h-1 bg-blue-500 mx-auto mt-4 rounded-full"></div>
                                </div>

                                {/* Filtros */}
                                <div className="filters-section">
                                    <h4 className="text-xl font-semibold mb-4">Filtros</h4>
                                    <div className="filters-grid">
                                        <div className="filter-group">
                                            <label>Empleado:</label>
                                            <select 
                                                value={filterEmpleado} 
                                                onChange={(e) => setFilterEmpleado(e.target.value)}
                                                className="filter-select"
                                            >
                                                <option value="">Todos los empleados</option>
                                                {empleadosList.map(emp => (
                                                    <option key={emp} value={emp}>{emp}</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        <div className="filter-group">
                                            <label>Departamento:</label>
                                            <select 
                                                value={filterDepartamento} 
                                                onChange={(e) => setFilterDepartamento(e.target.value)}
                                                className="filter-select"
                                            >
                                                <option value="">Todos los departamentos</option>
                                                {departamentos.map(dept => (
                                                    <option key={dept} value={dept}>{dept}</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        <div className="filter-group">
                                            <label>Estado:</label>
                                            <select 
                                                value={filterEstado} 
                                                onChange={(e) => setFilterEstado(e.target.value)}
                                                className="filter-select"
                                            >
                                                <option value="">Todos los estados</option>
                                                {estados.map(estado => (
                                                    <option key={estado} value={estado}>{estado}</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        <div className="filter-group">
                                            <label>Fecha Pactada - Desde:</label>
                                            <input 
                                                type="date" 
                                                value={filterFechaInicio} 
                                                onChange={(e) => setFilterFechaInicio(e.target.value)}
                                                className="filter-select"
                                            />
                                        </div>
                                        
                                        <div className="filter-group">
                                            <label>Fecha Pactada - Hasta:</label>
                                            <input 
                                                type="date" 
                                                value={filterFechaFin} 
                                                onChange={(e) => setFilterFechaFin(e.target.value)}
                                                className="filter-select"
                                            />
                                        </div>
                                        
                                        <div className="filter-group flex items-center gap-2" style={{justifyContent: 'flex-end'}}>
                                            <label>
                                                <input 
                                                    type="checkbox" 
                                                    checked={filterAtrasadas}
                                                    onChange={(e) => setFilterAtrasadas(e.target.checked)}
                                                />
                                                Solo tareas atrasadas
                                            </label>
                                        </div>
                                    </div>
                                    
                                    <div className="filters-actions">
                                        <button 
                                            className="clear-filters-button"
                                            onClick={() => {
                                                setFilterEmpleado('');
                                                setFilterDepartamento('');
                                                setFilterEstado('');
                                                setFilterFechaInicio('');
                                                setFilterFechaFin('');
                                                setFilterAtrasadas(false);
                                            }}
                                        >
                                            Limpiar Filtros
                                        </button>
                                    </div>
                                </div>

                                {/* Resumen */}
                                <div className="summary-section">
                                    <div className="summary-header">
                                        <h4 className="text-xl font-semibold">Resumen por Empleado</h4>
                                        <div className="summary-stats">
                                            <span className="stats-badge">
                                                {generarTareasPorEmpleado().reduce((total, emp) => total + emp.tareas.length, 0)} tareas encontradas
                                            </span>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="table-productivity">
                                            <thead className="table-productivity-thead">
                                                <tr>
                                                    <th>Empleado</th>
                                                    <th>Total</th>
                                                    <th>Completadas</th>
                                                    <th>Pendientes</th>
                                                    <th>Atrasadas</th>
                                                    <th>En Proceso</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {generarResumenTareasPorEmpleado().map((item, i) => (
                                                    <tr key={i}>
                                                        <td>{item.empleado}</td>
                                                        <td>{item.total}</td>
                                                        <td>{item.completadas}</td>
                                                        <td>{item.pendientes}</td>
                                                        <td>{item.atrasadas}</td>
                                                        <td>{item.enProceso}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Detalle de tareas */}
                                <div className="detail-section">
                                    <h4 className="text-xl font-semibold mb-4">Detalle de Tareas</h4>
                                    {generarTareasPorEmpleado().map((empleadoData, index) => (
                                        <div key={index} className="empleado-tasks mb-8">
                                            <h5 className="text-lg font-medium text-blue-600 mb-3">
                                                {empleadoData.empleado} ({empleadoData.tareas.length} tareas)
                                            </h5>
                                            <div className="overflow-x-auto">
                                                <table className="table-productivity">
                                                    <thead className="table-productivity-thead">
                                                        <tr>
                                                            <th>Título</th>
                                                            <th>Estado</th>
                                                            <th>Fecha Pactada</th>
                                                            <th>Fecha Entregada</th>
                                                            <th>Prioridad</th>
                                                            <th>Departamento</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {empleadoData.tareas.map((tarea, tareaIndex) => (
                                                            <tr key={tareaIndex}>
                                                                <td>{tarea.titulo}</td>
                                                                <td>
                                                                    <span className={`status-badge status-${tarea.estado.toLowerCase().replace(' ', '-')}`}>
                                                                        {tarea.estado}
                                                                    </span>
                                                                </td>
                                                                <td>{cambiarFormatoFecha(tarea.fecha_pactada) || 'N/A'}</td>
                                                                <td>{cambiarFormatoFecha(tarea.fecha_entregada) || 'N/A'}</td>
                                                                <td>{tarea.prioridad || 'N/A'}</td>
                                                                <td>{tarea.departamento || 'N/A'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
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

            {showReportModal && selectedReport === "proyectos" && (() => {
                const proyectosFiltrados = datosProyectos.filter(p => {
                    if (proyectoFiltro && p.id !== parseInt(proyectoFiltro)) return false;
                    if (proyectoEstadoFiltro && p.estado?.toUpperCase() !== proyectoEstadoFiltro.toUpperCase()) return false;
                    if (proyectoDepartamentoFiltro && !(p.tareas || []).some(t => t.departamento === proyectoDepartamentoFiltro)) return false;
                    if (proyectoStartDate || proyectoEndDate) {
                        const tareasDentro = (p.tareas || []).some(t =>
                            (!proyectoStartDate || t.fecha_pactada >= proyectoStartDate) &&
                            (!proyectoEndDate   || t.fecha_pactada <= proyectoEndDate)
                        );
                        if (!tareasDentro) return false;
                    }
                    return true;
                });
                const estadosUnicos = [...new Set(datosProyectos.map(p => p.estado).filter(Boolean))];
                const deptosProyectos = [...new Set(datosProyectos.flatMap(p => (p.tareas || []).map(t => t.departamento)).filter(Boolean))].sort();
                return (
                    <div className="modal-overlay">
                        <div className="modal-report">
                            <div className="modal-header">
                                <h2>Informe de Proyectos</h2>
                                <div className="header-actions">
                                    <button className="pdf-button" onClick={() => generarPDF('Informe de Proyectos')} disabled={pdfLoading}>
                                        <FaFilePdf /> {pdfLoading ? '...' : 'PDF'}
                                    </button>
                                    <button className="eficiencia-print-btn" onClick={() => imprimirProyectos(proyectosFiltrados, { startDate: proyectoStartDate, endDate: proyectoEndDate, departamento: proyectoDepartamentoFiltro })}>
                                        <FaPrint /> Imprimir
                                    </button>
                                    <button className="excel-button" onClick={() => exportarProyectosExcel(proyectosFiltrados, { startDate: proyectoStartDate, endDate: proyectoEndDate, departamento: proyectoDepartamentoFiltro })}>
                                        <FaChartBar /> Excel
                                    </button>
                                    <button className="close-button" onClick={() => setShowReportModal(false)}>
                                        <FaTimes />
                                    </button>
                                </div>
                            </div>

                            <div className="tab-content">
                                {/* Filtros */}
                                <div className="eficiencia-filtros">
                                    <RangosFecha startDate={proyectoStartDate} setStartDate={setProyectoStartDate} endDate={proyectoEndDate} setEndDate={setProyectoEndDate} />
                                    <label className="eficiencia-filtro-label">
                                        Proyecto
                                        <select className="eficiencia-filtro-input" value={proyectoFiltro} onChange={e => setProyectoFiltro(e.target.value)}>
                                            <option value="">Todos</option>
                                            {datosProyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                        </select>
                                    </label>
                                    <label className="eficiencia-filtro-label">
                                        Estado
                                        <select className="eficiencia-filtro-input" value={proyectoEstadoFiltro} onChange={e => setProyectoEstadoFiltro(e.target.value)}>
                                            <option value="">Todos</option>
                                            {estadosUnicos.map(e => <option key={e} value={e}>{e}</option>)}
                                        </select>
                                    </label>
                                    <label className="eficiencia-filtro-label">
                                        Departamento
                                        <select className="eficiencia-filtro-input" value={proyectoDepartamentoFiltro} onChange={e => { setProyectoDepartamentoFiltro(e.target.value); setProyectoFiltro(''); }}>
                                            <option value="">Todos</option>
                                            {deptosProyectos.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </label>
                                    <button className="eficiencia-filtro-clear" onClick={() => { setProyectoFiltro(''); setProyectoEstadoFiltro(''); setProyectoDepartamentoFiltro(''); setProyectoStartDate(''); setProyectoEndDate(''); }}>Limpiar</button>
                                    {loadingProyectos && <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Cargando...</span>}
                                </div>

                                {proyectosFiltrados.length === 0 && !loadingProyectos && (
                                    <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
                                        No hay proyectos para mostrar.
                                    </p>
                                )}

                                {proyectosFiltrados.map(proyecto => {
                                    const st = calcularProyecto(proyecto, { startDate: proyectoStartDate, endDate: proyectoEndDate, departamento: proyectoDepartamentoFiltro });
                                    const estadoColor = {
                                        ACTIVO: '#7c3aed', COMPLETADO: '#16a34a',
                                        PAUSADO: '#f59e0b', CANCELADO: '#dc2626'
                                    }[proyecto.estado?.toUpperCase()] || '#6b7280';
                                    const barColor = st.avance >= 80 ? '#16a34a' : st.avance >= 40 ? '#f59e0b' : '#dc2626';

                                    return (
                                        <div key={proyecto.id} className="proy-card">
                                            {/* Encabezado del proyecto */}
                                            <div className="proy-card-header">
                                                <div>
                                                    <h3 className="proy-card-nombre">{proyecto.nombre}</h3>
                                                    <span className="proy-card-fechas">
                                                        {proyecto.fecha_inicio || '—'} → {proyecto.fecha_fin_estimada || '—'}
                                                    </span>
                                                </div>
                                                <span className="proy-estado-badge" style={{ background: estadoColor + '22', color: estadoColor, border: `1px solid ${estadoColor}55` }}>
                                                    {proyecto.estado || '—'}
                                                </span>
                                            </div>

                                            {/* Barra de avance */}
                                            <div className="proy-avance-wrap">
                                                <div className="proy-avance-bar">
                                                    <div className="proy-avance-fill" style={{ width: `${st.avance}%`, background: barColor }} />
                                                </div>
                                                <span className="proy-avance-pct">{st.avance}%</span>
                                            </div>

                                            {/* KPIs */}
                                            <div className="proy-kpis">
                                                <div className="proy-kpi">
                                                    <span className="proy-kpi-num">{st.total}</span>
                                                    <span className="proy-kpi-lbl">Total</span>
                                                </div>
                                                <div className="proy-kpi proy-kpi--ok">
                                                    <span className="proy-kpi-num">{st.completadas}</span>
                                                    <span className="proy-kpi-lbl">✅ Completadas</span>
                                                </div>
                                                <div className="proy-kpi proy-kpi--blue">
                                                    <span className="proy-kpi-num">{st.enProceso}</span>
                                                    <span className="proy-kpi-lbl">⏳ En Proceso</span>
                                                </div>
                                                <div className="proy-kpi proy-kpi--orange">
                                                    <span className="proy-kpi-num">{st.pendientes}</span>
                                                    <span className="proy-kpi-lbl">⌛ Pendientes</span>
                                                </div>
                                                <div className="proy-kpi proy-kpi--red">
                                                    <span className="proy-kpi-num">{st.atrasadas}</span>
                                                    <span className="proy-kpi-lbl">⚠️ Atrasadas</span>
                                                </div>
                                                <div className="proy-kpi proy-kpi--purple">
                                                    <span className="proy-kpi-num">{st.aTiempo}</span>
                                                    <span className="proy-kpi-lbl">🕐 A tiempo</span>
                                                </div>
                                            </div>

                                            {/* Equipo */}
                                            {st.empleados.length > 0 && (
                                                <div className="proy-equipo">
                                                    <span className="proy-equipo-titulo">Equipo:</span>
                                                    {st.empleados.map(emp => (
                                                        <span key={emp} className="proy-emp-chip">{emp}</span>
                                                    ))}
                                                    {st.areas.length > 0 && (
                                                        <span className="proy-area-chip">{st.areas.join(' · ')}</span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Tabla de tareas */}
                                            {proyecto.tareas.length > 0 && (
                                                <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                                                    <table className="eficiencia-ranking-table">
                                                        <thead>
                                                            <tr>
                                                                <th>#</th>
                                                                <th>Tarea</th>
                                                                <th>Empleado</th>
                                                                <th>Área</th>
                                                                <th>Estado</th>
                                                                <th>Fecha pactada</th>
                                                                <th>Entregada</th>
                                                                <th>¿A tiempo?</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {proyecto.tareas.map((t, idx) => {
                                                                const aTiempoT = t.estado === 'Completada' && t.fecha_entregada && t.fecha_entregada <= t.fecha_pactada;
                                                                const estadoStyle = {
                                                                    'Completada': { color: '#16a34a', fontWeight: 600 },
                                                                    'En Proceso':  { color: '#2563eb' },
                                                                    'Pendiente':   { color: '#f97316' },
                                                                }[t.estado] || {};
                                                                return (
                                                                    <tr key={t.id}>
                                                                        <td style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{idx + 1}</td>
                                                                        <td style={{ fontWeight: 500 }}>{t.titulo || '—'}</td>
                                                                        <td style={{ color: '#6b7280', fontSize: '0.85rem' }}>{t.empleado || '—'}</td>
                                                                        <td style={{ color: '#6b7280', fontSize: '0.85rem' }}>{t.departamento || '—'}</td>
                                                                        <td><span style={estadoStyle}>{t.estado}</span></td>
                                                                        <td style={{ fontSize: '0.85rem' }}>{cambiarFormatoFecha(t.fecha_pactada)}</td>
                                                                        <td style={{ fontSize: '0.85rem' }}>{t.fecha_entregada ? cambiarFormatoFecha(t.fecha_entregada) : '—'}</td>
                                                                        <td style={{ textAlign: 'center' }}>
                                                                            {t.estado === 'Completada'
                                                                                ? (aTiempoT ? '✅' : '❌')
                                                                                : '—'}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })()}

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
