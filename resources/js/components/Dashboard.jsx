import React, { useEffect, useState } from 'react';
import axiosInstance from '../axiosConfig';
import { getImageUrl, getAssetUrl } from '../utils/assetHelper';
import Header from './Header';
import Sidebar from './Sidebar';
import { useUser } from './UserContext';
import TaskDetailsModal from './TaskDetailsModal';
import EmployeeInterface from './EmployeeInterface';

import {
    FaSearch,
    FaUser,
    FaTasks,
    FaCheckCircle,
    FaSpinner,
    FaClock,
    FaTimes,
    FaArrowLeft,
    FaEye,
    FaCheck,
    FaEnvelope,
    FaUserTie,
    FaBuilding,
    FaCalendar,
    FaPause
} from 'react-icons/fa';
import { FaCircleCheck, FaCircle, FaCircleXmark } from 'react-icons/fa6';

const Dashboard = () => {
    const { user, loading } = useUser();
    const [error, setError] = useState('');
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeMenu, setActiveMenu] = useState('dashboard');
    const [currentView, setCurrentView] = useState('dashboard');
    const [searchTerm, setSearchTerm] = useState("");
    const [empleados, setEmpleados] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showTasksModal, setShowTasksModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [isLoading2, setIsLoading2] = useState(false);
    const [selectedEstado, setSelectedEstado] = useState(null);
    const [tareasFiltradas, setTareasFiltradas] = useState([]);
    const [showTaskDetails, setShowTaskDetails] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);



    useEffect(() => {
        document.title = "Dashboard - WorkBoard";
    }, []);

    const handleLogout = async () => {
        try {
            await axiosInstance.post('/logout');
            window.location.href = getAssetUrl('/login');
            localStorage.clear();
            window.location.reload();

        } catch (error) {
            setError('Error al cerrar sesión');
            setIsLoading(false);
        }
    };

    //Cargar empleados y tareas

    useEffect(() => {
        if (!isLoading) {
            cargarEmpleados();
        }
    }, [isLoading]);


    const cargarEmpleados = async () => {
        setIsLoading2(true);
        axiosInstance
            .get("/dashboard/cargarEmpleadosTareas")
            .then((response) => {
                setEmpleados(response.data);
                setIsLoading2(false);
            })
            .catch((error) => {
                console.error("Error al cargar los empleados:", error);
                setIsLoading2(false);
            })
            .finally(() => {
                setIsLoading2(false);
            });
    };

    //calcular efcieincia de empleado
    const calcularEficiencia = (empleado) => {
        const tareas = empleado.tareas;
        const tareasCompletadas = tareas.filter(tarea => tarea.estado === 'Completada');
        const tareasPendientes = tareas.filter(tarea => tarea.estado === 'Pendiente' && tarea.pausada === 0 && tarea.aprobada === 1);
        let eficiencia = 0;

        eficiencia = (tareasCompletadas.length + tareasPendientes.length) > 0
        ? (tareasCompletadas.length / (tareasCompletadas.length + tareasPendientes.length)) * 100
        : 0;
        
        if (isNaN(eficiencia)) {
            return 0;
        }
        return Math.round(eficiencia);
    }


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

    if (loading) {
        return <div>Cargando...</div>;
    }

    if (error) {
        return (
            <div className="error-container">
                <h2>Error de Autenticación</h2>
                <p>{error}</p>
                <button onClick={() => {
                    localStorage.clear();
                    window.location.href = getAssetUrl('/login');
                }}>
                    Volver al Login
                </button>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="error-container">
                <h2>Acceso Denegado</h2>
                <p>No tienes permisos para acceder a esta página</p>
                <button onClick={() => {
                    localStorage.clear();
                    window.location.href = getAssetUrl('/login');
                }}>
                    Volver al Login
                </button>
            </div>
        );
    }

    if (user.tipo_usuario !== "Administrador") {
        
        return (
            <div className="dashboard-container">
                <Header
                    currentUser={user}
                    showUserMenu={showUserMenu}
                    setShowUserMenu={setShowUserMenu}
                    setIsSidebarOpen={setIsSidebarOpen}
                />
                <EmployeeInterface user={user} />
            </div>
        );
    }

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
                    //loading
                    <>
                        {isLoading2 ? (
                            <div className="loader">
                                <div className="justify-content-center jimu-primary-loading"></div>
                            </div>
                        ) : (
                            <div className="cards-container">
                                <div className="dashboard-header">
                                    <h1>Tablero de seguimiento de empleados</h1>
                                    <div className="search-container">
                                        <div className="search-box">
                                            <FaSearch />
                                            <input
                                                type="text"
                                                placeholder="Buscar empleado por nombre, departamento o empresa..."
                                                value={searchTerm}
                                                onChange={(e) =>
                                                    setSearchTerm(e.target.value)
                                                }
                                                style={{ width: '400px' }}
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
                                                        <FaUserTie size={13} /> {" "}   {empleado.cargo}
                                                    </p>
                                                    <p className="empresa">
                                                        <FaBuilding size={13} /> {" "}   {empleado.empresa} -{" "}
                                                        {empleado.departamento}
                                                    </p>
                                                    <p className="contacto">
                                                        <FaEnvelope />{" "}
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
                                                        setSelectedEstado(null);
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
                                                            Asignadas
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
                                                            {empleado.rendimiento?.tareas.pendientes || 0}
                                                        </span>
                                                        <span className="stat-label">
                                                            Pendientes
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="kpi-section" title="Porcentaje de tareas completadas dentro del plazo establecido.">
                                                    <div className="kpi-item">
                                                        <span className="kpi-label">
                                                            Eficiencia Operativa
                                                        </span>
                                                        <div className="progress-bar">
                                                            <div
                                                                className="progress-fill"
                                                                style={{
                                                                    width: `${empleado.rendimiento.eficienciaOperativa}%`,
                                                                }}
                                                            />
                                                            <span className="progress-value">
                                                                {Math.round(empleado.rendimiento.eficienciaOperativa, 2)}%
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
                        )}
                    </>
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
            <div className="profile-modal">
                <div className="modal-header">
                    <h2>Perfil de {employee.nombre}</h2>
                    <button className="close-button" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>
                <div className="modal-content">
                    <div className="profile-section">
                        <div className="profile-header">
                            <div className="profile-photo-container">
                                <img
                                    src={employee.foto}
                                    alt={employee.nombre}
                                    className="profile-photo"
                                />
                            </div>
                            <div className="profile-info">
                                <h3 style={{ textTransform: 'capitalize' }}>{employee.nombre}</h3>
                                <p className="cargo">{employee.cargo}</p>
                                <p className="empresa">
                                    {employee.empresa} - {employee.departamento}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="profile-sections">
                        <div className="profile-details">
                            <div className="info-section">
                                <h4>Información de Contacto</h4>
                                <div className="contact-info">
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
                        </div>

                        <div className="info-funciones">
                            <h4>Funciones activas</h4>
                            <ul className="funciones-list">
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
        </div>
    );

    // Componente Modal de Tareas
    const TasksModal = ({ employee, onClose }) => {
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
                                                    <div className="task-card-header-right">
                                                        {tarea.prioridad && (
                                                            <span className={`prioridad-badge ${tarea.prioridad.toLowerCase()}`}>
                                                                {tarea.prioridad}
                                                            </span>
                                                        )}
                                                                <div className="task-card-header-right-icons">
                                                                    {/* Mostrar Aprobación */}
                                                                    {tarea.aprobada ? (
                                                                        <FaCircleCheck color='green' title='Aprobada' style={{ marginRight: '0.5rem' }} />
                                                                    ) : (
                                                                        <FaCircleCheck color='grey' title='No aprobada' style={{ marginRight: '0.5rem', opacity: 0.5 }} />
                                                                    )}

                                                                    {/* Mostrar Visto Bueno */}
                                                                    {(tarea.estado === 'Completada' && tarea.visto_bueno && !tarea.rechazada) ? (
                                                                        <FaEye color='green' title='Visto bueno' style={{ marginRight: '0.5rem' }} />
                                                                    ) : (
                                                                        <FaEye color='grey' title='Pendiente de visto bueno' style={{ marginRight: '0.5rem', opacity: 0.5 }} />
                                                                    )}

                                                                    {/* Mostrar Rechazada */}
                                                                    {(tarea.estado === 'Completada' || tarea.estado === 'En Proceso') && tarea.rechazada ? (
                                                                        <FaCircleXmark color='red' title='Rechazada' style={{ marginRight: '0.5rem' }} />
                                                                    ) : null}

                                                                    {/* Mostrar Pausada */}
                                                                    {tarea.pausada ? (
                                                                        <FaPause color='orange' title='Pausada' style={{ marginRight: '0.5rem' }} />
                                                                    ) : (
                                                                        <FaPause color='grey' title='No pausada' style={{ marginRight: '0.5rem', opacity: 0.5 }} />
                                                                    )}

                                                                </div>
                                                            </div>
                                                </div>
                                                <p className="tarea-descripcion">{tarea.descripcion}</p>
                                                <div className="tarea-footer">
                                                    <span className="fecha">
                                                        <FaCalendar style={{ color: '#215ACC' }} size={13}/>
                                                        {" "}
                                                        <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Fecha creación:</label> {new Date(new Date(tarea.fecha_creacion).getTime() + 24 * 60 * 60 * 1000).toLocaleDateString()}
                                                        {tarea.fecha_aprobacion && (
                                                            <span>
                                                                {" "} <FaCheck style={{ color: '#008000' }} size={13}/> <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Fecha aprobación:</label> {
                                                                tarea.fecha_aprobacion !== '0000-00-00' ?
                                                                new Date(new Date(tarea.fecha_aprobacion).getTime() + 24 * 60 * 60 * 1000).toLocaleDateString()
                                                                : "No aprobada"
                                                                }
                                                            </span>
                                                        )}

                                                        {tarea.fecha_pactada && (
                                                            <span>
                                                                {" "} <FaClock style={{ color: '#C2410C', backgroundColor: '#f9cccf', borderRadius: '50%', padding: '2px' }} size={13}/> <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Fecha pactada:</label> {new Date(new Date(tarea.fecha_pactada).getTime() + 24 * 60 * 60 * 1000).toLocaleDateString()}
                                                            </span>
                                                        )}
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
                        onUpdate={() => {
                            //actualizar la lista de tareas
                            axiosInstance
                                .get("/dashboard/cargarEmpleadosTareas")
                                .then((response) => {
                                    // Actualizar el empleado seleccionado con los nuevos datos
                                    const empleadoActualizado = response.data.find(emp => emp.id === selectedEmployee.id);
                                  
                                    if (empleadoActualizado) {
                                        // Encontrar la tarea actualizada
                                        const tareaActualizada = empleadoActualizado.tareas.find(t => t.id === selectedTask.id);
                                        if (tareaActualizada) {
                                            setSelectedTask(tareaActualizada);
                                            // Asegurarnos de que showTaskDetails permanezca true
                                            setShowTaskDetails(true);
                                            // Mantener el estado seleccionado
                                            setSelectedEstado(tareaActualizada.estado);
                                            // Actualizar las tareas filtradas usando el estado actual de la tarea
                                          
                                        }
                                        const tareasDelEstado = empleadoActualizado.tareas                                           
                                        setTareasFiltradas(tareasDelEstado);

                                        setSelectedEmployee(empleadoActualizado);
                                        // Actualizar la lista de empleados
                                        setEmpleados(prevEmpleados =>
                                            prevEmpleados.map(emp =>
                                                emp.id === empleadoActualizado.id ? empleadoActualizado : emp
                                            )
                                        );
                                    }
                                })
                                .catch((error) => {
                                    console.error("Error al actualizar los datos:", error);
                                });
                        }}
                       
                    />
                )}
            </div>
        );
    };


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
                    currentUser={user}
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

export default Dashboard; 