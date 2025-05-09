import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import TaskList from "./TaskList";
import Parameters from "./Parameters";
import "../css/dashBoard.css";
import "../css/taskList.css";
import "../css/parameters.css";
import "../css/employeeCard.css";
import {
    FaCheckCircle,
    FaSpinner,
    FaClock,
    FaSearch,
    FaUser,
    FaTasks,
    FaTimes,
    FaPlus,
    FaCheck,
    FaEye,
    FaFile,
    FaFileWord,
    FaFileImage,
    FaFilePdf,
    FaArrowLeft,
} from "react-icons/fa";
import EmployeeInterface from "./EmployeeInterface";
import AuthMiddleware from "../middleware/AuthMiddleware";
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import TaskDetailsModal from './TaskDetailsModal';
import axios from 'axios';

const DashBoard = () => {
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [activeMenu, setActiveMenu] = useState("home");
    const [currentView, setCurrentView] = useState("home");
    const [empleados, setEmpleados] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedEmployeeButton, setSelectedEmployeeButton] = useState(null);
    const [tareasFiltradas, setTareasFiltradas] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    window.location.href = '/login';
                    return;
                }

                // Verificar si el token es válido
                const response = await axios.get('/api/check-auth', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.data.valid) {
                    localStorage.clear();
                    window.location.href = '/login';
                    return;
                }

                const user = AuthMiddleware.getUser();
                if (!user) {
                    localStorage.clear();
                    window.location.href = '/login';
                    return;
                }

                setCurrentUser(user);
                setIsLoading(false);
            } catch (error) {
                console.error('Error de autenticación:', error);
                localStorage.clear();
                window.location.href = '/login';
            }
        };

        checkAuth();
    }, []);

    //Cargar empleados y tareas
    useEffect(() => {
        if (!isLoading) {
            cargarEmpleados();
        }
    }, [isLoading]);

    const mostrarTareas = ({ employee, estado }) => {
        //Filtrar tareas por estado

        let tareasFiltradas = [];
        if (estado === 'Todas') {
            tareasFiltradas = employee.tareas;
            setTareasFiltradas(tareasFiltradas);
        } else {
            tareasFiltradas = employee.tareas.filter(tarea => tarea.estado === estado);
            setTareasFiltradas(tareasFiltradas);
        }
    };

    const cargarEmpleados = async () => {
        axios
            .get("/parametros/cargarEmpleadosTareas")
            .then((response) => {
                setEmpleados(response.data);
            })
            .catch((error) => {
                console.error("Error al cargar los empleados:", error);
            });
    };

    const [currentModalProfile, setCurrentModalProfile] = useState(false);
    const [currentModalTasks, setCurrentModalTasks] = useState(false);

    const handleCloseModalProfile = () => {
        setCurrentModalProfile(false);
    };

    const handleCloseModalTasks = () => {
        setCurrentModalTasks(false);
    };

    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showTasksModal, setShowTasksModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    const getStatusIcon = (status) => {
        switch (status) {
            case "Completada":
                return <FaCheckCircle color="#54B743" />;
            case "En Proceso":
                return <FaSpinner color="#377AED" />;
            case "Pendiente":
                return <FaClock color="#c2410c" />;
            default:
                return null;
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case "Completada":
                return "status-completed";
            case "En Proceso":
                return "status-progress";
            case "Pendiente":
                return "status-pending";
            default:
                return "";
        }
    };

    // Función para filtrar empleados
    const filteredEmpleados = empleados.filter(
        (empleado) =>
            empleado.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            empleado.departamento
                .toLowerCase()
                .includes(searchTerm.toLowerCase()) ||
            empleado.empresa.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderContent = () => {
        switch (currentView) {
            case "settings":
                return <Parameters />;
            case "home":
            default:
                return (
                    <div className="cards-container">
                        <div className="dashboard-header">
                            <h1>Tablero de seguimiento de empleados</h1>
                            <div className="search-container">
                                <div className="search-box">
                                    <FaSearch className="search-icon" />
                                    <input
                                        type="text"
                                        placeholder="Buscar empleado por nombre, departamento o empresa..."
                                        value={searchTerm}
                                        onChange={(e) =>
                                            setSearchTerm(e.target.value)
                                        }
                                        className="search-input"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="cards-grid">
                            {filteredEmpleados.map((empleado) => (
                                <div
                                    key={empleado.id}
                                    className="employee-card"
                                >
                                    <div className="employee-main-info">
                                        <img
                                            src={empleado.foto}
                                            alt={empleado.nombre}
                                            className="employee-photo"
                                        />
                                        <div className="employee-details">
                                            <h3>{empleado.nombre}</h3>
                                            <p className="cargo">
                                                {empleado.cargo}
                                            </p>
                                            <p className="empresa">
                                                {empleado.empresa} -{" "}
                                                {empleado.departamento}
                                            </p>
                                            <p className="contacto">
                                                <i className="fas fa-envelope"></i>{" "}
                                                {empleado.contacto?.email}
                                            </p>
                                        </div>

                                    </div>
                                    <div className="employee-actions">
                                        <button
                                            className="action-button profile-btn"
                                            onClick={() => {
                                                setSelectedEmployee(
                                                    empleado
                                                );
                                                setShowProfileModal(true);
                                            }}
                                        >
                                            <FaUser /> Perfil
                                        </button>
                                        <button
                                            className="action-button tasks-btn"
                                            onClick={() => {
                                                setSelectedEmployee(
                                                    empleado
                                                );
                                                setShowTasksModal(true);
                                            }}
                                        >
                                            <FaTasks /> Tareas
                                        </button>
                                    </div>
                                    <div className="performance-section">
                                        <h4>Rendimiento</h4>
                                        <div className="task-stats-grid">
                                            <div className="stat-item">
                                                <span className="stat-number">
                                                    {empleado.rendimiento
                                                        ?.tareasAsignadas || 0}
                                                </span>
                                                <span className="stat-label">
                                                    Total Asignadas
                                                </span>
                                            </div>
                                            <div className="stat-item">
                                                <span className="stat-number">
                                                    {empleado.rendimiento
                                                        ?.tareas.completadas ||
                                                        0}
                                                </span>
                                                <span className="stat-label">
                                                    Completadas
                                                </span>
                                            </div>
                                            <div className="stat-item">
                                                <span className="stat-number">
                                                    {empleado.rendimiento
                                                        ?.tareas.enProceso || 0}
                                                </span>
                                                <span className="stat-label">
                                                    En Proceso
                                                </span>
                                            </div>
                                            <div className="stat-item urgent">
                                                <span className="stat-number">
                                                    {empleado.rendimiento
                                                        ?.tareas.pendientes ||
                                                        0}
                                                </span>
                                                <span className="stat-label">
                                                    Pendientes
                                                </span>
                                            </div>
                                        </div>

                                        <div className="kpi-section">
                                            <div className="kpi-item">
                                                <span className="kpi-label">
                                                    Eficiencia
                                                </span>
                                                <div className="progress-bar">
                                                    <div
                                                        className="progress-fill"
                                                        style={{
                                                            width: `${empleado.avance}%`,
                                                        }}
                                                    />
                                                    <span className="progress-value">
                                                        {empleado.avance}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="urgent-tasks">
                                            <h5>Tareas Recientes</h5>
                                            {empleado.tareasRecientes?.map(
                                                (tarea) => (
                                                    <div
                                                        key={tarea.id}
                                                        className="urgent-task-item"
                                                    >
                                                        <span>
                                                            {tarea.titulo}
                                                        </span>
                                                        <span
                                                            className={`status ${getStatusClass(
                                                                tarea.estado
                                                            )}`}
                                                        >
                                                            {getStatusIcon(
                                                                tarea.estado
                                                            )}
                                                        </span>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
        }
    };

    const renderInterface = () => {
        if (!currentUser) return null;

        if (currentUser.tipo_usuario === "Administrador") {
            return (
                <div className="dashboard-layout">
                    <div className={`sidebar ${isSidebarOpen ? "active" : ""}`}>
                        <Sidebar />
                    </div>
                    <div className="content-area">{renderContent()}</div>
                </div>
            );
        } else {
            //Si el usuario no es administrador, se quita el sidebar
            return <EmployeeInterface user={currentUser} />;
        }
    };

    // Componente Modal de Perfil
    const ProfileModal = ({ employee, onClose }) => (
        <div className="modal-overlay">
            <div className="modal-content profile-modal">
                <div className="modal-header">
                    <h2>Perfil del Empleado</h2>
                    <button className="close-button" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>
                <div className="modal-body">
                    <div className="profile-header">
                        <div className="profile-photo-container">
                            <img
                                src={employee.foto}
                                alt={employee.nombre}
                                className="profile-photo"
                            />
                            <div className="profile-info">
                                <h3 style={{ textTransform: 'capitalize' }}>{employee.nombre}</h3>
                                <p className="cargo">{employee.cargo}</p>
                                <p className="empresa">
                                    {employee.empresa} - {employee.departamento}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="profile-details">
                        <div className="info-section">
                            <h4>Información de Contacto</h4>
                            <p>
                                <strong>Email:</strong>{" "}
                                {employee.contacto?.email}
                            </p>
                            <p>
                                <strong>Teléfono:</strong>{" "}
                                {employee.contacto?.telefono}
                            </p>
                        </div>

                    </div>
                    <div className="info-funciones">
                        <h4>Funciones activas</h4>
                        <ul>
                            {employee.funciones?.map(
                                (funciones, index) => (
                                    <li key={index}>{funciones.descripcion}</li>
                                )
                            )}
                        </ul>
                    </div>
                </div>

            </div>
        </div>
    );

    // Componente Modal de Tareas
    const TasksModal = ({ employee, onClose }) => {
        const [selectedEstado, setSelectedEstado] = useState(null);
        const [tareasFiltradas, setTareasFiltradas] = useState([]);
        const [showTaskDetails, setShowTaskDetails] = useState(false);
        const [selectedTask, setSelectedTask] = useState(null);

        const estados = [
            {
                id: 'Todas',
                title: 'Todas las Tareas',
                icon: FaTasks,
                color: '#6b7280',
                count: employee.tareas?.length || 0
            },
            {
                id: 'Pendiente',
                title: 'Pendientes',
                icon: FaClock,
                color: '#f97316',
                count: employee.tareas?.filter(t => t.estado === 'Pendiente').length || 0
            },
            {
                id: 'En Proceso',
                title: 'En Proceso',
                icon: FaSpinner,
                color: '#2563eb',
                count: employee.tareas?.filter(t => t.estado === 'En Proceso').length || 0
            },
            {
                id: 'Completada',
                title: 'Completadas',
                icon: FaCheck,
                color: '#16a34a',
                count: employee.tareas?.filter(t => t.estado === 'Completada').length || 0
            }
        ];

        const handleEstadoClick = (estado) => {
            setSelectedEstado(estado);
            if (estado === 'Todas') {
                setTareasFiltradas(employee.tareas || []);
            } else {
                setTareasFiltradas(employee.tareas?.filter(t => t.estado === estado) || []);
            }
        };

        const handleTaskClick = (task) => {
            setSelectedTask(task);
            console.log(task);
            setShowTaskDetails(true);
        };

        const handleBackToEstados = () => {
            setSelectedEstado(null);
            setTareasFiltradas([]);
        };

        const renderIcon = (iconName) => {
            switch (iconName) {
                case 'FaClock':
                    return <FaClock />;
                case 'FaSpinner':
                    return <FaSpinner />;
                case 'FaCheck':
                    return <FaCheck />;
                default:
                    return null;
            }
        };

        return (
            <div className="modal-overlay">
                <div className="modal-content tasks-modal">
                    <div className="modal-header">
                        <h2 style={{ textTransform: 'capitalize' }}>Tareas de {employee.nombre}</h2>
                        <button className="close-button" onClick={onClose}>
                            <FaTimes />
                        </button>
                    </div>
                    <div className="modal-body">
                        {!selectedEstado ? (
                            <div className="estados-cards">
                                {estados.map((estado) => (

                                    <div
                                        key={estado.id}
                                        className="estado-card"
                                        onClick={() => handleEstadoClick(estado.id)}
                                        style={{ borderTop: `4px solid ${estado.color}` }}
                                    >
                                        <div className="estado-card-header">
                                            {renderIcon(estado.icon)}
                                            <h3>{estado.title}</h3>
                                        </div>
                                        <div className="estado-card-count">
                                            <span>{estado.count}</span>
                                            <span>tareas</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="tareas-container">
                                <div className="tareas-header">
                                    <button className="back-button" onClick={handleBackToEstados}>
                                        <FaArrowLeft /> Volver
                                    </button>
                                    <h3 style={{ marginTop: '15px' }}>{estados.find(e => e.id === selectedEstado)?.title}</h3>
                                </div>
                                <div className="tareas-list">
                                    {tareasFiltradas.length > 0 ? (
                                        tareasFiltradas.map((tarea) => (
                                            <div
                                                key={tarea.id}
                                                className="tarea-item"
                                                onClick={() => handleTaskClick(tarea)}
                                            >
                                                <div className="tarea-header">
                                                    <h4>{tarea.titulo}</h4>
                                                    <span className={`priority ${tarea.prioridad.toLowerCase()}`}>
                                                        {tarea.prioridad}
                                                    </span>
                                                </div>
                                                <p className="tarea-descripcion">{tarea.descripcion}</p>
                                                <div className="tarea-footer">
                                                    <span className="fecha">
                                                        {new Date(tarea.fecha_pactada).toLocaleDateString()}
                                                    </span>
                                                    <button className="ver-detalles">
                                                        <FaEye /> Ver detalles
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="no-tareas">
                                            <p>No hay tareas en este estado</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {showTaskDetails && selectedTask && (
                    <TaskDetailsModal
                        task={selectedTask}
                        onClose={() => setShowTaskDetails(false)}

                    />
                )}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Cargando...</p>
            </div>
        );
    }

    // Si el usuario no es administrador, mostrar la interfaz de empleado con header
    if (currentUser && currentUser.tipo_usuario !== "Administrador") {
        return (
            <div className="dashboard-container">
                <div className="main-content">
                    <Header
                        currentUser={currentUser}
                        showUserMenu={showUserMenu}
                        setShowUserMenu={setShowUserMenu}
                        setIsSidebarOpen={setIsSidebarOpen}
                    />
                    <EmployeeInterface user={currentUser} />
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <Sidebar
                activeMenu={activeMenu}
                setActiveMenu={setActiveMenu}
                setCurrentView={setCurrentView}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
            />
            <div className="main-content">
                <Header
                    currentUser={currentUser}
                    showUserMenu={showUserMenu}
                    setShowUserMenu={setShowUserMenu}
                    setIsSidebarOpen={setIsSidebarOpen}
                />
                {renderContent()}
            </div>
            {showProfileModal && selectedEmployee && (
                <ProfileModal
                    employee={selectedEmployee}
                    onClose={() => setShowProfileModal(false)}
                />
            )}
            {showTasksModal && selectedEmployee && (
                <TasksModal
                    employee={selectedEmployee}
                    onClose={() => setShowTasksModal(false)}
                />
            )}
        </div>
    );
};

export default DashBoard;
