import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import TaskList from './TaskList';
import Parameters from './Parameters';
import '../css/dashBoard.css';
import '../css/taskList.css';
import '../css/parameters.css';
import { FaCheckCircle, FaSpinner, FaClock } from 'react-icons/fa';
import EmployeeInterface from './EmployeeInterface';
import AuthMiddleware from '../middleware/AuthMiddleware';

const DashBoard = () => {
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [activeMenu, setActiveMenu] = useState('home');
    const [currentView, setCurrentView] = useState('home');
    const [empleados] = useState([
        {
            id: 1,
            nombre: 'Marcos Sanz',
            departamento: 'Desarrollo',
            empresa: 'CSI DESARROLLOS',
            foto: '/images/empleados/xiam.jpg',
            avance: 70,
            tareas: {
                completadas: 12,
                pendientes: 5,
                enProceso: 3
            },
            tareasRecientes: [
                { id: 1, nombre: 'Desarrollo Frontend', estado: 'completed' },
                { id: 2, nombre: 'Testing unitario', estado: 'progress' },
                { id: 3, nombre: 'Documentación API', estado: 'pending' }
            ]
        },
        {
            id: 2,
            nombre: 'Ana López',
            departamento: 'Diseño UX/UI',
            empresa: 'CSI DESARROLLOS',
            foto: '/images/empleados/xiam.jpg',
            avance: 85,
            tareas: {
                completadas: 15,
                pendientes: 2,
                enProceso: 4
            },
            tareasRecientes: [
                { id: 1, nombre: 'Diseño Dashboard', estado: 'completed' },
                { id: 2, nombre: 'Prototipo Mobile', estado: 'progress' },
                { id: 3, nombre: 'User Research', estado: 'pending' }
            ]
        },
        // ... más empleados
    ]);

    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const user = AuthMiddleware.getUser();
        setCurrentUser(user);
    }, []);

    const userInfo = {
        nombre: 'Admin Usuario',
        email: 'admin@empresa.com',
        foto: '/images/empleados/xiam.jpg'
    };

    const getStatusIcon = (status) => {
        switch(status) {
            case 'completed':
                return <FaCheckCircle color="#0369a1" />;
            case 'progress':
                return <FaSpinner color="#047857" />;
            case 'pending':
                return <FaClock color="#c2410c" />;
            default:
                return null;
        }
    };

    const getStatusClass = (status) => {
        switch(status) {
            case 'completed':
                return 'status-completed';
            case 'progress':
                return 'status-progress';
            case 'pending':
                return 'status-pending';
            default:
                return '';
        }
    };

    const renderContent = () => {
        switch(currentView) {
            case 'settings':
                return <Parameters />;
            case 'home':
            default:
                return (
                    <div className="cards-container">
                        <h1>Tablero de seguimiento de empleados</h1>
                        <div className="cards-grid">
                            {empleados.map(empleado => (
                                <div key={empleado.id} className="employee-card">
                                    <div className="employee-card-pattern"></div>
                                    <div className="employee-header">
                                        <img 
                                            src={empleado.foto} 
                                            alt={empleado.nombre}
                                            className="employee-photo"
                                        />
                                        <div className="employee-info">
                                            <h3>{empleado.nombre}</h3>
                                            <p className="cargo">{empleado.departamento}</p>
                                            <p className="empresa">{empleado.empresa}</p>
                                        </div>
                                    </div>

                                    <div className="employee-content">
                                        <div className="employee-stats">
                                            <div className="stat-box">
                                                <div className="stat-value">{empleado.tareas.completadas}</div>
                                                <div className="stat-label">Completadas</div>
                                            </div>
                                            <div className="stat-box">
                                                <div className="stat-value">{empleado.tareas.enProceso}</div>
                                                <div className="stat-label">En Proceso</div>
                                            </div>
                                            <div className="stat-box">
                                                <div className="stat-value">{empleado.tareas.pendientes}</div>
                                                <div className="stat-label">Pendientes</div>
                                            </div>
                                        </div>
                                        
                                        <div className="progress-section">
                                            <div className="progress-header">
                                                <span>Progreso General</span>
                                                <span>{empleado.avance}%</span>
                                            </div>
                                            <div className="progress-bar">
                                                <div 
                                                    className="progress-fill"
                                                    style={{ width: `${empleado.avance}%` }}
                                                />
                                            </div>
                                        </div>

                                        <TaskList tareas={empleado.tareasRecientes} />
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
                <>
                    <div style={{display: 'flex'}}>
                    <Sidebar />
                    <div className="main-content">
                        {renderContent()}
                    </div>

                    </div>
                    
                </>
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
            />
            {renderInterface()}
        </div>
    );
};

export default DashBoard;