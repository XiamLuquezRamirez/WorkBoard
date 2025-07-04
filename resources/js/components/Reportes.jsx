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
    const [empleadosList, setEmpleadosList] = useState([]);
    const [departamentos, setDepartamentos] = useState([]);
    const [estados, setEstados] = useState([]);

    const reportCards = [
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

    ];


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
                    <p><strong>Fecha Pactada:</strong> ${filterFechaInicio && filterFechaFin ? `${filterFechaInicio} - ${filterFechaFin}` : filterFechaInicio ? `Desde ${filterFechaInicio}` : filterFechaFin ? `Hasta ${filterFechaFin}` : 'Todas las fechas'}</p>
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
                        <td>${tarea.fecha_pactada || 'N/A'}</td>
                        <td>${tarea.fecha_entregada || 'N/A'}</td>
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
                                                                <td className="date-cell">{t.fecha_pactada}</td>
                                                                <td className="date-cell text-red-600">{t.fecha_entregada}</td>
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
                                                                <td>{tarea.fecha_pactada || 'N/A'}</td>
                                                                <td>{tarea.fecha_entregada || 'N/A'}</td>
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




        </>
    );
};

export default Reportes;
