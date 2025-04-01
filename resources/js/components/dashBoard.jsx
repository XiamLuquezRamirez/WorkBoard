import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import TaskList from './TaskList';
import Parameters from './Parameters';
import '../css/dashBoard.css';
import '../css/taskList.css';
import '../css/parameters.css';
import '../css/employeeCard.css';
import { FaCheckCircle, FaSpinner, FaClock, FaSearch } from 'react-icons/fa';
import EmployeeInterface from './EmployeeInterface';
import AuthMiddleware from '../middleware/AuthMiddleware';

const DashBoard = () => {
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [activeMenu, setActiveMenu] = useState('home');
    const [currentView, setCurrentView] = useState('home');
    const [empleados, setEmpleados] = useState([]);



    const [currentUser, setCurrentUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        const user = AuthMiddleware.getUser();
        setCurrentUser(user);
    }, []);

    //Cargar empleados y tareas
    useEffect(() => {
       //Cargar empleados
       cargarEmpleados();

    }, []);

    const cargarEmpleados = async () => {
        axios.get('/parametros/cargarEmpleadosTareas')
        .then((response) => {
            console.log(response.data);
            setEmpleados(response.data);
        })
        .catch((error) => {
            console.error('Error al cargar los empleados:', error);
        });
    }



    const getStatusIcon = (status) => {
        switch(status) {
            case 'Completada':
                return <FaCheckCircle color="#54B743" />;
            case 'En Proceso':
                return <FaSpinner color="#377AED" />;
            case 'Pendiente':
                return <FaClock color="#c2410c" />;
            default:
                return null;
        }
    };

    const getStatusClass = (status) => {
        switch(status) {
            case 'Completada':
                return 'status-completed';
            case 'En Proceso':
                return 'status-progress';
            case 'Pendiente':
                return 'status-pending';
            default:
                return '';
        }
    };

    // Función para filtrar empleados
    const filteredEmpleados = empleados.filter(empleado => 
        empleado.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        empleado.departamento.toLowerCase().includes(searchTerm.toLowerCase()) ||
        empleado.empresa.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderContent = () => {
        switch(currentView) {
            case 'settings':
                return <Parameters />;
            case 'home':
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
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="search-input"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="cards-grid">
                            {filteredEmpleados.map(empleado => (
                                <div key={empleado.id} className="employee-card">
                                    <div className="employee-main-info">
                                        <img 
                                            src={empleado.foto} 
                                            alt={empleado.nombre}
                                            className="employee-photo"
                                        />
                                        <div className="employee-details">
                                            <h3>{empleado.nombre}</h3>
                                            <p className="cargo">{empleado.cargo}</p>
                                            <p className="empresa">{empleado.empresa} - {empleado.departamento}</p>
                                            <p className="contacto">
                                                <i className="fas fa-envelope"></i> {empleado.contacto?.email}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="performance-section">
                                        <h4>Rendimiento</h4>
                                        <div className="task-stats-grid">
                                            <div className="stat-item">
                                                <span className="stat-number">
                                                    {empleado.rendimiento?.tareasAsignadas || 0}
                                                </span>
                                                <span className="stat-label">Total Asignadas</span>
                                            </div>
                                            <div className="stat-item">
                                                <span className="stat-number">
                                                    {empleado.rendimiento?.tareas.completadas || 0}
                                                </span>
                                                <span className="stat-label">Completadas</span>
                                            </div>
                                            <div className="stat-item">
                                                <span className="stat-number">
                                                    {empleado.rendimiento?.tareas.enProceso || 0}
                                                </span>
                                                <span className="stat-label">En Proceso</span>
                                            </div>
                                            <div className="stat-item urgent">
                                                <span className="stat-number">
                                                    {empleado.rendimiento?.tareas.pendientes || 0}
                                                </span>
                                                <span className="stat-label">Pendientes</span>
                                            </div>
                                        </div>

                                        <div className="kpi-section">
                                            <div className="kpi-item">
                                                <span className="kpi-label">Eficiencia</span>
                                                <div className="progress-bar">
                                                    <div 
                                                        className="progress-fill"
                                                        style={{ width: `${empleado.avance}%` }}
                                                    />
                                                    <span className="progress-value">{empleado.avance}%</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="urgent-tasks">
                                            <h5>Tareas Recientes</h5>
                                            {empleado.tareasRecientes?.map(tarea => (
                                                <div key={tarea.id} className="urgent-task-item">
                                                    <span>{tarea.titulo}</span>
                                                    <span className={`status ${getStatusClass(tarea.estado)}`}>
                                                        {getStatusIcon(tarea.estado)}
                                                    </span>
                                                </div>
                                            ))}
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

        if (currentUser.tipo_usuario === 'Administrador') {
            return (
                <div className="dashboard-layout">
                    <div className={`sidebar ${isSidebarOpen ? 'active' : ''}`}>
                        <Sidebar />
                    </div>
                    <div className="content-area">
                        {renderContent()}
                    </div>
                </div>
            );
        } else {
            return <EmployeeInterface user={currentUser} />;
        }
    };

    return (
        <div className="dashboard">
            <Header 
                showUserMenu={showUserMenu} 
                setShowUserMenu={setShowUserMenu}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />
            {renderInterface()}
        </div>
    );
};

export default DashBoard;