import React, { useState, useEffect } from "react";
import {
    FaArrowLeft,
    FaChartArea,
    FaChartBar,
    FaChartLine,
    FaTimes,
    FaPrint,
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
import * as XLSX from 'xlsx';

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
    const getFormattedDate = (date) => {
        return date.toISOString().split("T")[0];
    };
    const [startDate, setStartDate] = useState(getFormattedDate(firstDay));
    const [endDate, setEndDate] = useState(getFormattedDate(lastDay));

    const [tareas, setTareas] = useState([]);
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
    const [datosEficiencia, setDatosEficiencia] = useState([]);
    const [loadingEficiencia, setLoadingEficiencia] = useState(false);
    const [estados, setEstados] = useState([]);

    const reportCards = [
        {
            id: 0,
            title: "Informe Ejecutivo",
            icon: <FaChartLine size={25} />,
            description: "Resumen global y por departamento",
            color: "#0f766e",
            onClick: () => {
                setSelectedReport("ejecutivo");
                setShowReportModal(true);
                consultarTareas();
            },
        },
        {
            id: 6,
            title: "Informe por Departamento",
            icon: <FaChartBar size={25} />,
            description: "Comparativa entre áreas de la empresa",
            color: "#7c3aed",
            onClick: () => {
                setSelectedReport("departamentos");
                setShowReportModal(true);
                consultarTareas();
            },
        },
        {
            id: 1,
            title: "Informe de productividad",
            icon: <FaChartBar size={25} />,
            description: "Resumen de tareas por empleado",
            color: "#0891b2",
            onClick: () => {
                abrirModalInformeProductividad();
            },
        },
        {
            id: 2,
            title: "Informe de tiempo",
            icon: <FaChartArea size={25} />,
            description: "Tiempos y retrasos",
            color: "#0891b2",
            onClick: () => {
                abrirModalInformeTiempo();

            },
        },
        {
            id: 3,
            title: "Informe de avance de tareas",
            icon: <FaChartBar size={25} />,
            description: "Resumen de tareas por empleado",
            color: "#0891b2",
            onClick: () => {
                abrirModalInformeAvance();
            },
        },
        {
            id: 4,
            title: "Informe de cumplimiento de tareas",
            icon: <FaChartBar size={25} />,
            description: "Resumen de tareas pendientes",
            color: "#0891b2",
            onClick: () => {
                abrirModalInformeCumplimiento();
            },
        },
        {
            id: 4,
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
            title: "Eficiencia Operativa",
            icon: <FaChartArea size={25} />,
            description: "Ranking de eficiencia por empleado y área",
            color: "#1d4ed8",
            onClick: () => {
                setSelectedReport("eficiencia");
                setShowReportModal(true);
                consultarEficiencia();
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


    // Tareas completadas por empleado
    const tareasCompletadasData = tareas.reduce((acc, tarea) => {
        if (tarea.estado === "Completada" && tarea.fecha_entregada >= startDate && tarea.fecha_entregada <= endDate) {
            acc[tarea.empleado] = (acc[tarea.empleado] || 0) + 1;
        }
        return acc;
    }, {});

    const tareasCompletadasArray = Object.entries(tareasCompletadasData).map(
        ([empleado, tareasCompletadas]) => ({
            empleado,
            tareasCompletadas,
        })
    );

    //informe de tareas por empleado

    // Promedio de días por tarea (solo completadas)
    const promedioTiempoData = tareas.reduce((acc, tarea) => {

        if (
            tarea.estado === "Completada" &&
            tarea.fecha_aprobacion &&
            tarea.fecha_entregada &&
            tarea.fecha_aprobacion >= startDate &&
            tarea.fecha_aprobacion <= endDate &&
            tarea.fecha_entregada >= startDate &&
            tarea.fecha_entregada <= endDate
        ) {
            const dias =
                (new Date(tarea.fecha_entregada) -
                    new Date(tarea.fecha_aprobacion)) /
                (1000 * 60 * 60 * 24);
            if (!acc[tarea.empleado])
                acc[tarea.empleado] = { totalDias: 0, tareas: 0 };
            acc[tarea.empleado].totalDias += dias;
            acc[tarea.empleado].tareas += 1;
        }
        return acc;
    }, {});


    const promedioTiempoArray = Object.entries(promedioTiempoData).map(
        ([empleado, datos]) => ({
            empleado,
            promedioTiempo: (datos.totalDias / datos.tareas).toFixed(1),
        })
    );

    // Datos para comparativo
    const comparativoArray = tareasCompletadasArray.map((item) => {
        const promedio = promedioTiempoArray.find(
            (p) => p.empleado === item.empleado
        );
        
        const productividad = promedio
            ? (item.tareasCompletadas / promedio.promedioTiempo).toFixed(1)
            : 0;
        return {
            empleado: item.empleado,
            tareasCompletadas: item.tareasCompletadas,
            promedioTiempo: promedio ? promedio.promedioTiempo : 0,
            productividad: parseFloat(productividad),
        };
    });

    //informe de tiempo 
    const calcularDias = (inicio, fin) => {
        const i = new Date(inicio);
        const f = new Date(fin);
        const diff = (f - i) / (1000 * 60 * 60 * 24);
        return Math.ceil(diff);
    };

    const informe = tareas
        .filter(tarea => {
            // Filtrar tareas que se crearon dentro del rango de fechas
            return tarea.fecha_aprobacion >= startDate && tarea.fecha_aprobacion <= endDate;
        })
        .map((tarea) => {
            const diasEstimados = calcularDias(tarea.fecha_aprobacion, tarea.fecha_pactada);
            const diasReales = tarea.fecha_entregada ? calcularDias(tarea.fecha_aprobacion, tarea.fecha_entregada) : null;
            const retrasada = tarea.fecha_entregada && tarea.fecha_entregada > tarea.fecha_pactada;

            return {
                ...tarea,
                diasEstimados,
                diasReales,
                horasEstimadas: diasEstimados * 8,
                horasReales: diasReales ? diasReales * 8 : null,
                retrasada
            };
        });

    //informe de avance de tareas
    const empleados = [...new Set(tareas.map(t => t.empleado))];

    const resumen = empleados.map(empleado => {
        const tareasEmpleado = tareas
            .filter(t => t.empleado === empleado && t.fecha_aprobacion >= startDate && t.fecha_aprobacion <= endDate);
        const total = tareasEmpleado.length;
        const completadas = tareasEmpleado.filter(t => t.estado === "Completada").length;
        const porcentaje = total > 0 ? ((completadas / total) * 100).toFixed(1) : 0;
        return { empleado, total, completadas, porcentaje };
    });

    const consultarTareas = () => {
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
            .catch((error) => console.error("Error fetching tasks:", error));
    }

    const consultarEficiencia = () => {
        setLoadingEficiencia(true);
        axiosInstance.get('/informes/eficiencia')
            .then(res => setDatosEficiencia(res.data))
            .catch(err => console.error('Error cargando eficiencia:', err))
            .finally(() => setLoadingEficiencia(false));
    };

    const calcularInformeEjecutivo = () => {
        const hoy = new Date().toISOString().split('T')[0];

        const totalCompletadas = tareas.filter(t => t.estado === 'Completada').length;
        const totalEnProceso = tareas.filter(t => t.estado === 'En Proceso').length;
        const totalPendientes = tareas.filter(t => t.estado === 'Pendiente').length;
        const totalAtrasadas = tareas.filter(t =>
            t.fecha_pactada && t.fecha_pactada < hoy && t.estado !== 'Completada' && t.pausada !== 1
        ).length;

        // Completadas por departamento
        const porDept = tareas.reduce((acc, t) => {
            if (!t.departamento) return acc;
            if (!acc[t.departamento]) acc[t.departamento] = { departamento: t.departamento, completadas: 0, total: 0 };
            acc[t.departamento].total += 1;
            if (t.estado === 'Completada') acc[t.departamento].completadas += 1;
            return acc;
        }, {});

        const deptData = Object.values(porDept).map(d => ({
            ...d,
            porcentaje: d.total > 0 ? Math.round((d.completadas / d.total) * 100) : 0,
        }));

        // Eficiencia por empleado (completadas a tiempo / total completadas)
        const porEmpleado = tareas.reduce((acc, t) => {
            if (!t.empleado) return acc;
            if (!acc[t.empleado]) acc[t.empleado] = { empleado: t.empleado, completadasATiempo: 0, totalCompletadas: 0 };
            if (t.estado === 'Completada') {
                acc[t.empleado].totalCompletadas += 1;
                if (t.fecha_entregada && t.fecha_pactada && t.fecha_entregada <= t.fecha_pactada) {
                    acc[t.empleado].completadasATiempo += 1;
                }
            }
            return acc;
        }, {});

        const eficienciaData = Object.values(porEmpleado).map(e => ({
            empleado: e.empleado,
            eficiencia: e.totalCompletadas > 0
                ? Math.round((e.completadasATiempo / e.totalCompletadas) * 100)
                : 0,
        })).sort((a, b) => b.eficiencia - a.eficiencia);

        return { totalCompletadas, totalEnProceso, totalPendientes, totalAtrasadas, deptData, eficienciaData };
    };

    const calcularInformeDepartamentos = () => {
        const hoy = new Date().toISOString().split('T')[0];

        const porDept = tareas.reduce((acc, t) => {
            const dept = t.departamento || 'Sin departamento';
            if (!acc[dept]) {
                acc[dept] = {
                    departamento: dept,
                    total: 0, completadas: 0, enProceso: 0,
                    pendientes: 0, atrasadas: 0,
                    sumaEficiencia: 0, countEficiencia: 0,
                };
            }
            acc[dept].total += 1;
            if (t.estado === 'Completada') acc[dept].completadas += 1;
            if (t.estado === 'En Proceso') acc[dept].enProceso += 1;
            if (t.estado === 'Pendiente') acc[dept].pendientes += 1;
            if (t.fecha_pactada && t.fecha_pactada < hoy && t.estado !== 'Completada' && t.pausada !== 1) {
                acc[dept].atrasadas += 1;
            }
            if (t.estado === 'Completada' && t.fecha_entregada && t.fecha_pactada) {
                acc[dept].countEficiencia += 1;
                if (t.fecha_entregada <= t.fecha_pactada) acc[dept].sumaEficiencia += 1;
            }
            return acc;
        }, {});

        return Object.values(porDept).map(d => ({
            ...d,
            porcentajeCompletado: d.total > 0 ? Math.round((d.completadas / d.total) * 100) : 0,
            eficiencia: d.countEficiencia > 0 ? Math.round((d.sumaEficiencia / d.countEficiencia) * 100) : 0,
        })).sort((a, b) => b.porcentajeCompletado - a.porcentajeCompletado);
    };

    const calcularEficienciaOperativa = () => {
        const filtradas = datosEficiencia.filter(t =>
            (!startDate || t.fecha_pactada >= startDate) &&
            (!endDate   || t.fecha_pactada <= endDate)
        );

        const porEmpleado = filtradas.reduce((acc, t) => {
            const key = t.nombre_empleado;
            if (!acc[key]) acc[key] = {
                nombre: t.nombre_empleado,
                cargo: t.cargo,
                departamento: t.departamento,
                total: 0, completadas: 0, aTiempo: 0, reprocesos: 0
            };
            acc[key].total++;
            if (t.estado === 'Completada') acc[key].completadas++;
            if (t.estado === 'Completada' && t.fecha_entregada && t.fecha_entregada <= t.fecha_pactada)
                acc[key].aTiempo++;
            if (t.rechazada == 1) acc[key].reprocesos++;
            return acc;
        }, {});

        return Object.values(porEmpleado).map(emp => {
            const score = emp.total > 0
                ? (emp.completadas / emp.total) * 0.4
                  + (emp.aTiempo / emp.total) * 0.3
                  + ((emp.total - emp.reprocesos) / emp.total) * 0.3
                : 0;
            const scoreRound = Math.round(score * 100) / 100;
            const nivel = scoreRound >= 0.75 ? '🟢 Alto' : scoreRound >= 0.50 ? '🟡 Medio' : '🔴 Crítico';
            return { ...emp, score: scoreRound, nivel };
        }).sort((a, b) => b.score - a.score);
    };

    const calcularDeptEficiencia = (empleados) => {
        const porDept = empleados.reduce((acc, emp) => {
            const d = emp.departamento || 'Sin área';
            if (!acc[d]) acc[d] = { departamento: d, count: 0, sumaScore: 0, empleadosList: [] };
            acc[d].count++;
            acc[d].sumaScore += emp.score;
            acc[d].empleadosList.push(emp);
            return acc;
        }, {});
        return Object.values(porDept).map(d => {
            const avg = Math.round((d.sumaScore / d.count) * 100) / 100;
            return {
                ...d,
                scorePromedio: avg,
                nivel: avg >= 0.75 ? '🟢 Alto' : avg >= 0.50 ? '🟡 Medio' : '🔴 Crítico'
            };
        }).sort((a, b) => b.scorePromedio - a.scorePromedio);
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
            const hoyStr = new Date().toISOString().split('T')[0];
            tareasFiltradas = tareasFiltradas.filter(t =>
                t.fecha_pactada && t.fecha_pactada < hoyStr && t.estado !== 'Completada'
            );
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
            const atrasadas = tareas.filter(t => t.estado === 'Atrasada').length;
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
                    <p><strong>Empleado:</strong> ${filterEmpleado || 'Todos'}</p>
                    <p><strong>Departamento:</strong> ${filterDepartamento || 'Todos'}</p>
                    <p><strong>Estado:</strong> ${filterEstado || 'Todos'}</p>
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
                    <td>${item.empleado}</td>
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
                <h2>Tareas de ${empleadoData.empleado}</h2>
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
                        <td>${tarea.titulo}</td>
                        <td>${tarea.estado}</td>
                        <td>${cambiarFormatoFecha(tarea.fecha_pactada) || 'N/A'}</td>
                        <td>${cambiarFormatoFecha(tarea.fecha_entregada) || 'N/A'}</td>
                        <td>${tarea.prioridad || 'N/A'}</td>
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
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
    };

    const imprimirEficienciaGeneral = (empleados, deptos) => {
        const hoy = new Date().toLocaleDateString();
        let html = `<html><head><style>
            body{font-family:Arial,sans-serif;margin:20px;font-size:13px}
            h1{color:#1d4ed8;text-align:center}
            h2{color:#374151;margin-top:24px;font-size:15px}
            table{width:100%;border-collapse:collapse;margin-top:8px}
            th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left}
            th{background:#f3f4f6;font-weight:600}
            .kpis{display:flex;gap:12px;margin:12px 0;flex-wrap:wrap}
            .kpi{border:1px solid #e5e7eb;border-radius:6px;padding:8px 14px;min-width:100px}
            .kpi strong{display:block;font-size:20px}
            .alert{background:#fef2f2;border:1px solid #fecaca;padding:6px 10px;border-radius:4px;margin:4px 0}
            .ok{background:#f0fdf4;border:1px solid #bbf7d0;padding:6px 10px;border-radius:4px;margin:4px 0}
            .info{background:#eff6ff;border:1px solid #bfdbfe;padding:6px 10px;border-radius:4px;margin:4px 0}
        </style></head><body>
        <h1>Informe de Eficiencia Operativa</h1>
        <p style="text-align:center;color:#6b7280">Período: ${startDate} — ${endDate} | Generado: ${hoy}</p>`;

        const alto = empleados.filter(e => e.score >= 0.75).length;
        const medio = empleados.filter(e => e.score >= 0.50 && e.score < 0.75).length;
        const critico = empleados.filter(e => e.score < 0.50).length;
        const promedio = empleados.length > 0
            ? Math.round(empleados.reduce((s, e) => s + e.score, 0) / empleados.length * 100) : 0;

        html += `<h2>KPIs Globales</h2>
        <div class="kpis">
            <div class="kpi"><strong>${alto}</strong>🟢 Alto</div>
            <div class="kpi"><strong>${medio}</strong>🟡 Medio</div>
            <div class="kpi"><strong>${critico}</strong>🔴 Crítico</div>
            <div class="kpi"><strong>${promedio}%</strong>Promedio global</div>
        </div>
        <h2>Ranking por Empleado</h2>
        <table><thead><tr><th>#</th><th>Nombre</th><th>Cargo</th><th>Área</th><th>Nivel</th><th>Score</th><th>Completadas</th><th>A tiempo</th><th>Reprocesos</th></tr></thead><tbody>`;
        empleados.forEach((emp, i) => {
            html += `<tr><td>${i+1}</td><td>${emp.nombre}</td><td>${emp.cargo}</td><td>${emp.departamento}</td>
                <td>${emp.nivel}</td><td>${emp.score.toFixed(2)}</td>
                <td>${emp.completadas}/${emp.total}</td><td>${emp.aTiempo}</td><td>${emp.reprocesos}</td></tr>`;
        });
        html += `</tbody></table>
        <h2>Resumen por Área</h2>
        <table><thead><tr><th>Área</th><th>Empleados</th><th>Score Promedio</th><th>Nivel</th></tr></thead><tbody>`;
        deptos.forEach(d => {
            html += `<tr><td>${d.departamento}</td><td>${d.count}</td><td>${d.scorePromedio.toFixed(2)}</td><td>${d.nivel}</td></tr>`;
        });
        html += `</tbody></table><h2>Alertas</h2>`;
        if (critico > 0) html += `<p class="alert">⚠ ${critico} empleado(s) en zona crítica: ${empleados.filter(e=>e.score<0.50).map(e=>e.nombre).join(', ')}</p>`;
        deptos.filter(d=>d.scorePromedio<0.60).forEach(d => {
            html += `<p class="alert">⚠ Área ${d.departamento} con score ${d.scorePromedio.toFixed(2)}</p>`;
        });
        if (deptos.length > 0) html += `<p class="ok">✅ Mejor área: ${deptos[0].departamento} (${deptos[0].scorePromedio.toFixed(2)})</p>`;
        html += `</body></html>`;

        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(html);
        win.document.close();
        win.print();
    };

    const imprimirEficienciaPorEmpleado = (empleados) => {
        const hoy = new Date().toLocaleDateString();
        let html = `<html><head><style>
            body{font-family:Arial,sans-serif;margin:20px;font-size:13px}
            h1{color:#1d4ed8;text-align:center}
            .emp-block{border:1px solid #e5e7eb;border-radius:6px;padding:14px;margin-bottom:16px;page-break-inside:avoid}
            .emp-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
            .emp-name{font-size:15px;font-weight:700;color:#111827}
            .emp-meta{color:#6b7280;font-size:12px}
            .badge{padding:3px 8px;border-radius:99px;font-size:12px;font-weight:600}
            .badge-alto{background:#dcfce7;color:#15803d}
            .badge-medio{background:#ffedd5;color:#c2410c}
            .badge-critico{background:#fee2e2;color:#b91c1c}
            table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
            th,td{border:1px solid #e5e7eb;padding:4px 8px}
            th{background:#f9fafb}
        </style></head><body>
        <h1>Eficiencia Operativa — Por Empleado</h1>
        <p style="text-align:center;color:#6b7280">Período: ${startDate} — ${endDate} | Generado: ${hoy}</p>`;

        empleados.forEach((emp, i) => {
            const pctCompleto = emp.total > 0 ? Math.round(emp.completadas/emp.total*100) : 0;
            const badgeClass = emp.score >= 0.75 ? 'badge-alto' : emp.score >= 0.50 ? 'badge-medio' : 'badge-critico';
            html += `<div class="emp-block">
                <div class="emp-header">
                    <div>
                        <div class="emp-name">${i+1}. ${emp.nombre}</div>
                        <div class="emp-meta">${emp.cargo} · ${emp.departamento}</div>
                    </div>
                    <span class="badge ${badgeClass}">${emp.nivel} · Score ${emp.score.toFixed(2)}</span>
                </div>
                <table><thead><tr><th>Total tareas</th><th>Completadas</th><th>A tiempo</th><th>Reprocesos</th><th>% Completado</th></tr></thead>
                <tbody><tr><td>${emp.total}</td><td>${emp.completadas}</td><td>${emp.aTiempo}</td><td>${emp.reprocesos}</td><td>${pctCompleto}%</td></tr></tbody>
                </table>
            </div>`;
        });

        html += `</body></html>`;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(html);
        win.document.close();
        win.print();
    };

    const imprimirEficienciaPorArea = (deptos) => {
        const hoy = new Date().toLocaleDateString();
        let html = `<html><head><style>
            body{font-family:Arial,sans-serif;margin:20px;font-size:13px}
            h1{color:#1d4ed8;text-align:center}
            .area-block{border:1px solid #e5e7eb;border-radius:6px;padding:14px;margin-bottom:20px;page-break-inside:avoid}
            .area-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
            .area-name{font-size:16px;font-weight:700;color:#111827}
            .badge{padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600}
            .badge-alto{background:#dcfce7;color:#15803d}
            .badge-medio{background:#ffedd5;color:#c2410c}
            .badge-critico{background:#fee2e2;color:#b91c1c}
            table{width:100%;border-collapse:collapse;font-size:12px}
            th,td{border:1px solid #e5e7eb;padding:4px 8px}
            th{background:#f9fafb}
        </style></head><body>
        <h1>Eficiencia Operativa — Por Área</h1>
        <p style="text-align:center;color:#6b7280">Período: ${startDate} — ${endDate} | Generado: ${hoy}</p>`;

        deptos.forEach(dept => {
            const badgeClass = dept.scorePromedio >= 0.75 ? 'badge-alto' : dept.scorePromedio >= 0.50 ? 'badge-medio' : 'badge-critico';
            html += `<div class="area-block">
                <div class="area-header">
                    <div class="area-name">${dept.departamento} (${dept.count} empleados)</div>
                    <span class="badge ${badgeClass}">${dept.nivel} · Score ${dept.scorePromedio.toFixed(2)}</span>
                </div>
                <table><thead><tr><th>#</th><th>Empleado</th><th>Cargo</th><th>Nivel</th><th>Score</th><th>Completadas</th><th>A tiempo</th><th>Reprocesos</th></tr></thead>
                <tbody>`;
            dept.empleadosList.forEach((emp, i) => {
                const bc = emp.score >= 0.75 ? 'badge-alto' : emp.score >= 0.50 ? 'badge-medio' : 'badge-critico';
                html += `<tr><td>${i+1}</td><td>${emp.nombre}</td><td>${emp.cargo}</td>
                    <td><span class="badge ${bc}">${emp.nivel}</span></td>
                    <td>${emp.score.toFixed(2)}</td>
                    <td>${emp.completadas}/${emp.total}</td>
                    <td>${emp.aTiempo}</td><td>${emp.reprocesos}</td></tr>`;
            });
            html += `</tbody></table></div>`;
        });

        html += `</body></html>`;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(html);
        win.document.close();
        win.print();
    };

    const exportarEficienciaExcel = (empleados, deptos) => {
        const wb = XLSX.utils.book_new();

        const wsEmpleados = XLSX.utils.json_to_sheet(empleados.map((emp, i) => ({
            '#': i + 1,
            'Nombre': emp.nombre,
            'Cargo': emp.cargo,
            'Área': emp.departamento,
            'Nivel': emp.nivel,
            'Score': emp.score,
            'Total tareas': emp.total,
            'Completadas': emp.completadas,
            'A tiempo': emp.aTiempo,
            'Reprocesos': emp.reprocesos,
            '% Completado': emp.total > 0 ? Math.round(emp.completadas/emp.total*100) + '%' : '0%'
        })));
        XLSX.utils.book_append_sheet(wb, wsEmpleados, 'Por Empleado');

        const wsAreas = XLSX.utils.json_to_sheet(deptos.map(d => ({
            'Área': d.departamento,
            'Empleados': d.count,
            'Score Promedio': d.scorePromedio,
            'Nivel': d.nivel
        })));
        XLSX.utils.book_append_sheet(wb, wsAreas, 'Por Área');

        XLSX.writeFile(wb, `eficiencia-operativa-${startDate}-${endDate}.xlsx`);
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

        const fecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `Tareas_Empleados_${fecha}.xlsx`);
    };

    //informe de cumplimiento de tareas
    // 1. No iniciadas vs completadas
    const noIniciadas = tareas
        .filter(t => t.estado === "Pendiente" && t.fecha_aprobacion >= startDate && t.fecha_aprobacion <= endDate)
        .length;
    const completadas = tareas
        .filter(t => t.estado === "Completada" && t.fecha_aprobacion >= startDate && t.fecha_aprobacion <= endDate)
        .length;

    // 2. Recurrentes no cumplidas (mismo título + no completada)
    const titulos = tareas
        .filter(t => t.fecha_aprobacion >= startDate && t.fecha_aprobacion <= endDate)
        .map(t => t.titulo);
    const titulosRecurrentes = titulos.filter((titulo, i, arr) => arr.indexOf(titulo) !== i);
    const recurrentesNoCumplidas = tareas.filter(
        t => titulosRecurrentes.includes(t.titulo) &&
            t.estado !== "Completada" &&
            t.fecha_aprobacion >= startDate &&
            t.fecha_aprobacion <= endDate
    );

    // 3. Incumplimiento de fechas (fecha_entregada > fecha_pactada)
    const incumplidas = tareas.filter(t => {
        if (!t.fecha_entregada) return false;
        return new Date(t.fecha_entregada) > new Date(t.fecha_pactada) &&
            t.fecha_aprobacion >= startDate &&
            t.fecha_aprobacion <= endDate;
    });


    const abrirModalInformeProductividad = () => {
        setSelectedReport("productividad");
        setShowReportModal(true);
        setActiveTab("tareasCompletadas");
        consultarTareas();
    };

    const abrirModalInformeTiempo = () => {
        setSelectedReport("tiempo");
        setShowReportModal(true);
        setActiveTab("promedioTiempo");
        consultarTareas();
    };

    const abrirModalInformeAvance = () => {
        setSelectedReport("avance");
        setShowReportModal(true);
        setActiveTab("promedioTiempo");
        consultarTareas();
    };

    const abrirModalInformeCumplimiento = () => {
        setSelectedReport("cumplimiento");
        setShowReportModal(true);
        setActiveTab("promedioTiempo");
        consultarTareas();
    };

    const abrirModalInformeTareasPorEmpleado = () => {
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

            {showReportModal && selectedReport === "productividad" && (
                <div className="modal-overlay">
                    <div className="modal-report">
                        <div className="modal-header">
                            <h2>Informe de Productividad</h2>
                            <button className="close-button" onClick={() => setShowReportModal(false)} >
                                <FaTimes />
                            </button>
                        </div>
                        <div className="tab-buttons">
                            <button
                                onClick={() =>
                                    setActiveTab("tareasCompletadas")
                                }
                                className={`tab-button ${activeTab === "tareasCompletadas"
                                    ? "active"
                                    : ""
                                    }`}
                            >
                                Tareas Completadas
                            </button>
                            <button
                                onClick={() => setActiveTab("promedioTiempo")}
                                className={`tab-button ${activeTab === "promedioTiempo"
                                    ? "active"
                                    : ""
                                    }`}
                            >
                                Promedio por Tarea
                            </button>
                            <button
                                onClick={() => setActiveTab("comparativo")}
                                className={`tab-button ${activeTab === "comparativo" ? "active" : ""
                                    }`}
                            >
                                Comparativo
                            </button>
                        </div>
                        <div className="tab-content">
                            {/* Rango de fechas */}
                            <RangosFecha
                                startDate={startDate}
                                setStartDate={setStartDate}
                                endDate={endDate}
                                setEndDate={setEndDate}
                            />

                            {activeTab === "tareasCompletadas" && (
                                <>
                                    <table className="table-productivity">
                                        <thead className="table-productivity-thead">
                                            <tr>
                                                <th>Empleado</th>
                                                <th>Tareas completadas</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tareasCompletadasArray.map(
                                                (item, i) => (
                                                    <tr key={i}>
                                                        <td>{item.empleado}</td>
                                                        <td>
                                                            {
                                                                item.tareasCompletadas
                                                            }
                                                        </td>
                                                    </tr>
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                    <ResponsiveContainer
                                        width="100%"
                                        height={300}
                                        style={{ textTransform: "capitalize" }}
                                    >
                                        <BarChart
                                            data={tareasCompletadasArray}
                                            margin={{
                                                top: 20,
                                                right: 30,
                                                left: 0,
                                                bottom: 5,
                                            }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="empleado" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Bar
                                                dataKey="tareasCompletadas"
                                                fill="#2b60e5"
                                                className="bar-productivity"
                                                name="Tareas Completadas"
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </>
                            )}

                            {activeTab === "promedioTiempo" && (
                                <>
                                    <table className="table-productivity">
                                        <thead className="table-productivity-thead">
                                            <tr>
                                                <th>Empleado</th>
                                                <th>
                                                    Promedio por tarea (hrs)
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {promedioTiempoArray.map(
                                                (item, i) => (
                                                    <tr key={i}>
                                                        <td>{item.empleado}</td>
                                                        <td>
                                                            {
                                                                item.promedioTiempo
                                                            }
                                                        </td>
                                                    </tr>
                                                )
                                            )}
                                        </tbody>
                                    </table>

                                    <ResponsiveContainer
                                        width="100%"
                                        height={500}
                                        style={{ textTransform: "capitalize" }}
                                    >
                                        <LineChart
                                            data={promedioTiempoArray}
                                            margin={{
                                                top: 20,
                                                right: 30,
                                                left: 0,
                                                bottom: 5,
                                            }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="empleado" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Line
                                                type="monotone"
                                                dataKey="promedioTiempo"
                                                stroke="#2b60e5"
                                                name="Promedio por tarea"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </>
                            )}

                            {activeTab === "comparativo" && (
                                <>
                                    <table className="table-productivity">
                                        <thead className="table-productivity-thead">
                                            <tr>
                                                <th>Empleado</th>
                                                <th>Tareas completadas</th>
                                                <th>Promedio (hrs)</th>
                                                <th>Productividad</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {comparativoArray.map((item, i) => {
                                                const productividad = (
                                                    item.tareasCompletadas /
                                                    item.promedioTiempo
                                                ).toFixed(1);
                                                return (
                                                    <tr key={i}>
                                                        <td
                                                            style={{
                                                                textTransform:
                                                                    "capitalize",
                                                            }}
                                                        >
                                                            {item.empleado}
                                                        </td>
                                                        <td>
                                                            {
                                                                item.tareasCompletadas
                                                            }
                                                        </td>
                                                        <td>
                                                            {
                                                                item.promedioTiempo
                                                            }
                                                        </td>
                                                        <td>{productividad}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>

                                    <ResponsiveContainer
                                        width="100%"
                                        height={300}
                                        style={{ textTransform: "capitalize" }}
                                    >
                                        <BarChart
                                            data={comparativoArray}
                                            margin={{
                                                top: 20,
                                                right: 30,
                                                left: 0,
                                                bottom: 5,
                                            }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="empleado" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Bar
                                                dataKey="productividad"
                                                fill="#2b60e5"
                                                name="Productividad"
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showReportModal && selectedReport === "tiempo" && (
                <div className="modal-overlay">
                    <div className="modal-report">
                        <div className="modal-header">
                            <h2>Informe de Tiempo</h2>
                            <button className="close-button" onClick={() => setShowReportModal(false)}>
                                <FaTimes />
                            </button>
                        </div>
                        <div className="tab-content">
                            <div>
                                {/* Rango de fechas */}
                                <RangosFecha
                                    startDate={startDate}
                                    setStartDate={setStartDate}
                                    endDate={endDate}
                                    setEndDate={setEndDate}
                                />
                                <table border="1" cellPadding="8" className="table-productivity">
                                    <thead className="table-productivity-thead">
                                        <tr>
                                            <th>Tarea</th>
                                            <th>Empleado</th>
                                            <th>Estado</th>
                                            <th>Horas Estimadas</th>
                                            <th>Horas Reales</th>
                                            <th>¿Retrasada?</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {informe.map((t, idx) => (
                                            <tr key={idx}>
                                                <td style={{ textAlign: "left" }}>{t.titulo}</td>
                                                <td style={{ textAlign: "left" }}>{t.empleado}</td>
                                                <td>{t.estado}</td>
                                                <td>{t.horasEstimadas}</td>
                                                <td>{t.horasReales ?? '—'}</td>
                                                <td>{t.retrasada ? '✅ Sí' : 'No'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showReportModal && selectedReport === "avance" && (
                <div className="modal-overlay">
                    <div className="modal-report">
                        <div className="modal-header">
                            <h2>Informe de Avance</h2>
                            <button className="close-button" onClick={() => setShowReportModal(false)}>
                            <FaTimes />
                            </button>
                        </div>
                        <div className="tab-content">
                            {/* Rango de fechas */}
                            <RangosFecha
                                startDate={startDate}
                                setStartDate={setStartDate}
                                endDate={endDate}
                                setEndDate={setEndDate}
                            />
                            <table className="table-productivity">
                                <thead className="table-productivity-thead">
                                    <tr>
                                        <th>Empleado</th>
                                        <th>Tareas totales</th>
                                        <th>Tareas completadas</th>
                                        <th>Porcentaje de avance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {resumen.map((item, i) => (
                                        <tr key={i}>
                                            <td>{item.empleado}</td>
                                            <td>{item.total}</td>
                                            <td>{item.completadas}</td>
                                            <td>{Math.round(item.porcentaje)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {showReportModal && selectedReport === "cumplimiento" && (
                <div className="modal-overlay">
                    <div className="modal-report">
                        <div className="modal-header">
                            <h2>Informe de Cumplimiento</h2>
                            <button className="close-button" onClick={() => setShowReportModal(false)}>
                                <FaTimes />
                            </button>
                        </div>
                        <div className="tab-content">
                            <div className="bg-white shadow-xl rounded-2xl p-8 space-y-8 border border-gray-200">
                                {/* Header del informe */}
                                <div className="text-center mb-10">
                                    <h3 className="text-3xl font-bold text-gray-800 mb-3">Resumen de Cumplimiento</h3>
                                    <p className="text-gray-600 text-lg">Estado actual de las tareas y su cumplimiento</p>
                                    <div className="w-24 h-1 bg-blue-500 mx-auto mt-4 rounded-full"></div>
                                </div>

                                {/* Tabla de Resumen General */}
                                <div className="overflow-x-auto">
                                    {/* Rango de fechas */}
                                    <RangosFecha
                                        startDate={startDate}
                                        setStartDate={setStartDate}
                                        endDate={endDate}
                                        setEndDate={setEndDate}
                                    />
                                    <table className="table-productivity">
                                        <thead className="table-productivity-thead">
                                            <tr>
                                                <th>Métrica</th>
                                                <th>Cantidad</th>
                                                <th>Estado</th>
                                                <th>Detalle</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>
                                                    <div className="icon-cell">
                                                        <span>📋</span>
                                                        <span>Tareas no iniciadas</span>
                                                    </div>
                                                </td>
                                                <td className="number-cell">{noIniciadas}</td>
                                                <td>
                                                    <span className="status-badge status-pending">Pendientes</span>
                                                </td>
                                                <td>Total de tareas sin iniciar</td>
                                            </tr>
                                            <tr>
                                                <td>
                                                    <div className="icon-cell">
                                                        <span>✅</span>
                                                        <span>Tareas completadas</span>
                                                    </div>
                                                </td>
                                                <td className="number-cell">{completadas}</td>
                                                <td>
                                                    <span className="status-badge status-completed">Finalizadas</span>
                                                </td>
                                                <td>Total de tareas completadas</td>
                                            </tr>
                                            <tr>
                                                <td>
                                                    <div className="icon-cell">
                                                        <span>🔄</span>
                                                        <span>Recurrentes no cumplidas</span>
                                                    </div>
                                                </td>
                                                <td className="number-cell">{recurrentesNoCumplidas.length}</td>
                                                <td>
                                                    <span className="status-badge status-pending">Pendientes</span>
                                                </td>
                                                <td>Tareas recurrentes sin completar</td>
                                            </tr>
                                            <tr>
                                                <td>
                                                    <div className="icon-cell">
                                                        <span>⏰</span>
                                                        <span>Incumplieron fecha límite</span>
                                                    </div>
                                                </td>
                                                <td className="number-cell">{incumplidas.length}</td>
                                                <td>
                                                    <span className="status-badge status-delayed">Atrasadas</span>
                                                </td>
                                                <td>Tareas fuera de plazo</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Tabla de Tareas Incumplidas */}
                                {incumplidas.length > 0 && (
                                    <div className="mt-12">
                                        <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-2xl p-8 shadow-lg">
                                            <div className="warning-header">
                                                <h4>
                                                    <span>⚠️</span>
                                                    Tareas que incumplieron fechas límite
                                                </h4>
                                                <p className="text-red-600 mt-1">Se requiere atención inmediata</p>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="table-productivity">
                                                    <thead className="table-productivity-thead">
                                                        <tr>
                                                            <th>Tarea</th>
                                                            <th>Empleado</th>
                                                            <th>Fecha Pactada</th>
                                                            <th>Fecha Entregada</th>
                                                            <th>Estado</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {incumplidas.map((t, i) => (
                                                            <tr key={i}>
                                                                <td>{t.titulo}</td>
                                                                <td>
                                                                    <span className="status-badge status-pending">{t.empleado}</span>
                                                                </td>
                                                                <td className="date-cell">{cambiarFormatoFecha(t.fecha_pactada)}</td>
                                                                <td className="date-cell text-red-600">{cambiarFormatoFecha(t.fecha_entregada)}</td>
                                                                <td>
                                                                    <span className="status-badge status-delayed">Atrasada</span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showReportModal && selectedReport === "tareasPorEmpleado" && (
                <div className="modal-overlay">
                    <div className="modal-report">
                        <div className="modal-header">
                            <h2>Informe de Tareas por Empleado</h2>
                            <div className="header-actions">
                                <button className="excel-button" onClick={exportarExcel}>
                                    <FaChartBar /> Exportar Excel
                                </button>
                                <button className="print-button" onClick={imprimirPDF}>
                                    <FaPrint /> Imprimir PDF
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




            {showReportModal && selectedReport === "ejecutivo" && (() => {
                const { totalCompletadas, totalEnProceso, totalPendientes, totalAtrasadas, deptData, eficienciaData } = calcularInformeEjecutivo();
                return (
                    <div className="modal-overlay">
                        <div className="modal-report">
                            <div className="modal-header">
                                <h2>Informe Ejecutivo</h2>
                                <button className="close-button" onClick={() => setShowReportModal(false)}>
                                    <FaTimes />
                                </button>
                            </div>
                            <div className="tab-content">
                                <div className="executive-kpis">
                                    <div className="exec-kpi exec-kpi--green">
                                        <span className="exec-kpi-number">{totalCompletadas}</span>
                                        <span className="exec-kpi-label">Completadas</span>
                                    </div>
                                    <div className="exec-kpi exec-kpi--blue">
                                        <span className="exec-kpi-number">{totalEnProceso}</span>
                                        <span className="exec-kpi-label">En Proceso</span>
                                    </div>
                                    <div className="exec-kpi exec-kpi--orange">
                                        <span className="exec-kpi-number">{totalPendientes}</span>
                                        <span className="exec-kpi-label">Pendientes</span>
                                    </div>
                                    <div className="exec-kpi exec-kpi--red">
                                        <span className="exec-kpi-number">{totalAtrasadas}</span>
                                        <span className="exec-kpi-label">Atrasadas</span>
                                    </div>
                                </div>

                                <h3 style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', color: '#374151' }}>
                                    Avance por Departamento
                                </h3>
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={deptData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="departamento" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 12 }} />
                                        <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                                        <Tooltip formatter={(value) => `${value}%`} />
                                        <Bar dataKey="porcentaje" fill="#0891b2" name="% Completado" radius={[4,4,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>

                                <h3 style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', color: '#374151' }}>
                                    Eficiencia por Empleado (% entregado a tiempo)
                                </h3>
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={eficienciaData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="empleado" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                                        <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                                        <Tooltip formatter={(value) => `${value}%`} />
                                        <Bar dataKey="eficiencia" fill="#0f766e" name="Eficiencia" radius={[4,4,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {showReportModal && selectedReport === "departamentos" && (() => {
                const deptData = calcularInformeDepartamentos();
                return (
                    <div className="modal-overlay">
                        <div className="modal-report">
                            <div className="modal-header">
                                <h2>Informe por Departamento</h2>
                                <button className="close-button" onClick={() => setShowReportModal(false)}>
                                    <FaTimes />
                                </button>
                            </div>
                            <div className="tab-content">
                                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#374151' }}>
                                    Comparativa entre departamentos
                                </h3>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={deptData} margin={{ top: 5, right: 20, left: 0, bottom: 50 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="departamento" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="completadas" fill="#16a34a" name="Completadas" radius={[3,3,0,0]} />
                                        <Bar dataKey="enProceso" fill="#2563eb" name="En Proceso" radius={[3,3,0,0]} />
                                        <Bar dataKey="pendientes" fill="#f97316" name="Pendientes" radius={[3,3,0,0]} />
                                        <Bar dataKey="atrasadas" fill="#dc2626" name="Atrasadas" radius={[3,3,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>

                                <table className="table-productivity" style={{ marginTop: '1.5rem' }}>
                                    <thead className="table-productivity-thead">
                                        <tr>
                                            <th>Departamento</th>
                                            <th>Total</th>
                                            <th>Completadas</th>
                                            <th>En Proceso</th>
                                            <th>Pendientes</th>
                                            <th>Atrasadas</th>
                                            <th>% Avance</th>
                                            <th>Eficiencia</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {deptData.map((d, i) => (
                                            <tr key={i}>
                                                <td>{d.departamento}</td>
                                                <td>{d.total}</td>
                                                <td style={{ color: '#16a34a', fontWeight: 600 }}>{d.completadas}</td>
                                                <td style={{ color: '#2563eb' }}>{d.enProceso}</td>
                                                <td style={{ color: '#f97316' }}>{d.pendientes}</td>
                                                <td style={{ color: d.atrasadas > 0 ? '#dc2626' : 'inherit', fontWeight: d.atrasadas > 0 ? 600 : 400 }}>
                                                    {d.atrasadas}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <div style={{ flex: 1, background: '#e5e7eb', borderRadius: 4, height: 8 }}>
                                                            <div style={{ width: `${d.porcentajeCompletado}%`, background: '#0891b2', borderRadius: 4, height: 8 }} />
                                                        </div>
                                                        <span style={{ fontSize: '0.8rem', minWidth: 32 }}>{d.porcentajeCompletado}%</span>
                                                    </div>
                                                </td>
                                                <td style={{ color: d.eficiencia >= 70 ? '#16a34a' : d.eficiencia >= 50 ? '#f97316' : '#dc2626', fontWeight: 600 }}>
                                                    {d.eficiencia}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {showReportModal && selectedReport === "eficiencia" && (() => {
                const empleados = calcularEficienciaOperativa();
                const deptos = calcularDeptEficiencia(empleados);
                const alto = empleados.filter(e => e.score >= 0.75).length;
                const medio = empleados.filter(e => e.score >= 0.50 && e.score < 0.75).length;
                const critico = empleados.filter(e => e.score < 0.50).length;
                const promedioGlobal = empleados.length > 0
                    ? Math.round((empleados.reduce((s, e) => s + e.score, 0) / empleados.length) * 100)
                    : 0;
                const totalSum = empleados.reduce((s, e) => s + e.total, 0);
                const pctATiempo = totalSum > 0
                    ? Math.round(empleados.reduce((s, e) => s + e.aTiempo, 0) / totalSum * 100)
                    : 0;
                const pctReprocesos = totalSum > 0
                    ? Math.round(empleados.reduce((s, e) => s + e.reprocesos, 0) / totalSum * 100)
                    : 0;

                return (
                    <div className="modal-overlay">
                        <div className="modal-report">
                            <div className="modal-header">
                                <h2>Informe de Eficiencia Operativa</h2>
                                <div className="header-actions">
                                    <button className="eficiencia-print-btn" onClick={() => imprimirEficienciaGeneral(empleados, deptos)}>
                                        <FaPrint /> General
                                    </button>
                                    <button className="eficiencia-print-btn" onClick={() => imprimirEficienciaPorEmpleado(empleados)}>
                                        <FaPrint /> Por Empleado
                                    </button>
                                    <button className="eficiencia-print-btn" onClick={() => imprimirEficienciaPorArea(deptos)}>
                                        <FaPrint /> Por Área
                                    </button>
                                    <button className="excel-button" onClick={() => exportarEficienciaExcel(empleados, deptos)}>
                                        <FaChartBar /> Excel
                                    </button>
                                    <button className="close-button" onClick={() => setShowReportModal(false)}>
                                        <FaTimes />
                                    </button>
                                </div>
                            </div>

                            <div className="tab-content">
                                {/* Período */}
                                <p className="eficiencia-periodo">
                                    Período: <strong>{cambiarFormatoFecha(startDate)}</strong> — <strong>{cambiarFormatoFecha(endDate)}</strong>
                                    {loadingEficiencia && <span style={{ marginLeft: '1rem', color: '#6b7280' }}>Cargando...</span>}
                                </p>

                                {/* Sección 1: KPIs Globales */}
                                <div className="executive-kpis" style={{ marginBottom: '1.5rem' }}>
                                    <div className="exec-kpi exec-kpi--green">
                                        <span className="exec-kpi-number">{alto}</span>
                                        <span className="exec-kpi-label">🟢 Alto</span>
                                    </div>
                                    <div className="exec-kpi exec-kpi--orange">
                                        <span className="exec-kpi-number">{medio}</span>
                                        <span className="exec-kpi-label">🟡 Medio</span>
                                    </div>
                                    <div className="exec-kpi exec-kpi--red">
                                        <span className="exec-kpi-number">{critico}</span>
                                        <span className="exec-kpi-label">🔴 Crítico</span>
                                    </div>
                                    <div className="exec-kpi exec-kpi--blue">
                                        <span className="exec-kpi-number">{promedioGlobal}%</span>
                                        <span className="exec-kpi-label">Eficiencia promedio</span>
                                    </div>
                                    <div className="exec-kpi" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                        <span className="exec-kpi-number" style={{ color: '#16a34a' }}>{pctATiempo}%</span>
                                        <span className="exec-kpi-label">A tiempo</span>
                                    </div>
                                    <div className="exec-kpi" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                                        <span className="exec-kpi-number" style={{ color: '#dc2626' }}>{pctReprocesos}%</span>
                                        <span className="exec-kpi-label">Reprocesos</span>
                                    </div>
                                </div>

                                {/* Sección 2: Ranking por empleado */}
                                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#374151' }}>
                                    Ranking por Empleado
                                </h3>
                                <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                                    <table className="eficiencia-ranking-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Nombre</th>
                                                <th>Cargo</th>
                                                <th>Área</th>
                                                <th>Nivel</th>
                                                <th>Score</th>
                                                <th>Completadas</th>
                                                <th>A tiempo</th>
                                                <th>Reprocesos</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {empleados.map((emp, idx) => (
                                                <tr key={emp.nombre} className={emp.score < 0.50 ? 'eficiencia-row-critico' : ''}>
                                                    <td style={{ fontWeight: 700, color: '#6b7280' }}>{idx + 1}</td>
                                                    <td style={{ fontWeight: 600 }}>{emp.nombre}</td>
                                                    <td style={{ color: '#6b7280', fontSize: '0.85rem' }}>{emp.cargo}</td>
                                                    <td style={{ color: '#6b7280', fontSize: '0.85rem' }}>{emp.departamento}</td>
                                                    <td>
                                                        <span className={`eficiencia-nivel-badge ${emp.score >= 0.75 ? 'badge-alto' : emp.score >= 0.50 ? 'badge-medio' : 'badge-critico'}`}>
                                                            {emp.nivel}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="eficiencia-score-bar-wrap">
                                                            <div
                                                                className="eficiencia-score-bar"
                                                                style={{
                                                                    width: `${emp.score * 100}%`,
                                                                    background: emp.score >= 0.75 ? '#16a34a' : emp.score >= 0.50 ? '#f97316' : '#dc2626'
                                                                }}
                                                            />
                                                            <span className="eficiencia-score-num">{emp.score.toFixed(2)}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>{emp.completadas}/{emp.total}</td>
                                                    <td style={{ textAlign: 'center' }}>{emp.aTiempo}</td>
                                                    <td style={{ textAlign: 'center', color: emp.reprocesos > 0 ? '#dc2626' : '#16a34a' }}>
                                                        {emp.reprocesos}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Sección 3: Análisis por área */}
                                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#374151' }}>
                                    Análisis por Área
                                </h3>
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={deptos} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="departamento" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 12 }} />
                                        <YAxis domain={[0, 1]} tickFormatter={v => v.toFixed(1)} />
                                        <Tooltip formatter={(v) => v.toFixed(2)} />
                                        <Bar dataKey="scorePromedio" name="Score" radius={[4, 4, 0, 0]}>
                                            {deptos.map((d) => (
                                                <Cell
                                                    key={d.departamento}
                                                    fill={d.scorePromedio >= 0.75 ? '#16a34a' : d.scorePromedio >= 0.50 ? '#f97316' : '#dc2626'}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                                    <table className="eficiencia-ranking-table">
                                        <thead>
                                            <tr>
                                                <th>Área</th>
                                                <th>Empleados</th>
                                                <th>Score Promedio</th>
                                                <th>Nivel</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {deptos.map(d => (
                                                <tr key={d.departamento}>
                                                    <td style={{ fontWeight: 600 }}>{d.departamento}</td>
                                                    <td style={{ textAlign: 'center' }}>{d.count}</td>
                                                    <td>
                                                        <div className="eficiencia-score-bar-wrap">
                                                            <div
                                                                className="eficiencia-score-bar"
                                                                style={{
                                                                    width: `${d.scorePromedio * 100}%`,
                                                                    background: d.scorePromedio >= 0.75 ? '#16a34a' : d.scorePromedio >= 0.50 ? '#f97316' : '#dc2626'
                                                                }}
                                                            />
                                                            <span className="eficiencia-score-num">{d.scorePromedio.toFixed(2)}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`eficiencia-nivel-badge ${d.scorePromedio >= 0.75 ? 'badge-alto' : d.scorePromedio >= 0.50 ? 'badge-medio' : 'badge-critico'}`}>
                                                            {d.nivel}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Sección 4: Alertas e insights */}
                                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#374151' }}>
                                    Alertas e Insights
                                </h3>
                                <div className="eficiencia-insights">
                                    {critico > 0 && (
                                        <div className="insight-card insight-card--alert">
                                            <strong>⚠ {critico} empleado{critico > 1 ? 's' : ''} en zona crítica:</strong>{' '}
                                            {empleados.filter(e => e.score < 0.50).map(e => e.nombre).join(', ')}
                                        </div>
                                    )}
                                    {deptos.filter(d => d.scorePromedio < 0.60).map(d => (
                                        <div key={d.departamento} className="insight-card insight-card--alert">
                                            ⚠ Área <strong>{d.departamento}</strong> con score promedio {d.scorePromedio.toFixed(2)} — requiere atención
                                        </div>
                                    ))}
                                    {deptos.length > 0 && (
                                        <div className="insight-card insight-card--ok">
                                            ✅ Área con mejor desempeño: <strong>{deptos[0].departamento}</strong> (score {deptos[0].scorePromedio.toFixed(2)})
                                        </div>
                                    )}
                                    <div className="insight-card insight-card--info">
                                        📊 {pctATiempo}% de tareas entregadas a tiempo en el período
                                    </div>
                                    <div className="insight-card insight-card--info">
                                        📊 Índice de reprocesos global: {pctReprocesos}%
                                    </div>
                                    {critico === 0 && deptos.filter(d => d.scorePromedio < 0.60).length === 0 && (
                                        <div className="insight-card insight-card--ok">
                                            ✅ Todos los empleados y áreas están en niveles aceptables o superiores
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

        </>
    );
};

export default Reportes;
