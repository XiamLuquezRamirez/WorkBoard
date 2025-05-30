import React, { useState, useEffect } from "react";
import {
    FaArrowLeft,
    FaChartArea,
    FaChartBar,
    FaChartLine,
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

    // Promedio de días por tarea (solo completadas)
    const promedioTiempoData = tareas.reduce((acc, tarea) => {

        if (
            tarea.estado === "Completada" &&
            tarea.fecha_creacion &&
            tarea.fecha_entregada &&
            tarea.fecha_creacion >= startDate &&
            tarea.fecha_creacion <= endDate &&
            tarea.fecha_entregada >= startDate &&
            tarea.fecha_entregada <= endDate
        ) {
            const dias =
                (new Date(tarea.fecha_entregada) -
                    new Date(tarea.fecha_creacion)) /
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
            return tarea.fecha_creacion >= startDate && tarea.fecha_creacion <= endDate;
        })
        .map((tarea) => {
            const diasEstimados = calcularDias(tarea.fecha_creacion, tarea.fecha_pactada);
            const diasReales = tarea.fecha_entregada ? calcularDias(tarea.fecha_creacion, tarea.fecha_entregada) : null;
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
            .filter(t => t.empleado === empleado && t.fecha_creacion >= startDate && t.fecha_creacion <= endDate);
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
            })
            .catch((error) => console.error("Error fetching tasks:", error));
    }

    //informe de cumplimiento de tareas
    // 1. No iniciadas vs completadas
    const noIniciadas = tareas
        .filter(t => t.estado === "Pendiente" && t.fecha_creacion >= startDate && t.fecha_creacion <= endDate)
        .length;
    const completadas = tareas
        .filter(t => t.estado === "Completada" && t.fecha_creacion >= startDate && t.fecha_creacion <= endDate)
        .length;

    // 2. Recurrentes no cumplidas (mismo título + no completada)
    const titulos = tareas
        .filter(t => t.fecha_creacion >= startDate && t.fecha_creacion <= endDate)
        .map(t => t.titulo);
    const titulosRecurrentes = titulos.filter((titulo, i, arr) => arr.indexOf(titulo) !== i);
    const recurrentesNoCumplidas = tareas.filter(
        t => titulosRecurrentes.includes(t.titulo) &&
            t.estado !== "Completada" &&
            t.fecha_creacion >= startDate &&
            t.fecha_creacion <= endDate
    );

    // 3. Incumplimiento de fechas (fecha_entregada > fecha_pactada)
    const incumplidas = tareas.filter(t => {
        if (!t.fecha_entregada) return false;
        return new Date(t.fecha_entregada) > new Date(t.fecha_pactada) &&
            t.fecha_creacion >= startDate &&
            t.fecha_creacion <= endDate;
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
                                X
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
                                        height={300}
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
                                X
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
                                X
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
                                X
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
        </>
    );
};

export default Reportes;
