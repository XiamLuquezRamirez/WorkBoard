import React, { useState } from 'react';
import { 
    FaUsers, 
    FaUserTie, 
    FaCog, 
    FaBuilding, 
    FaClipboardList,
    FaChartLine,
    FaArrowLeft
} from 'react-icons/fa';
import EmployeeModal from './EmployeeModal';
import UserModal from './UserModal';
import { useNavigate } from 'react-router-dom';
import '../css/parameters.css';

const Parameters = () => {
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const navigate = useNavigate();

    const parameterCards = [
        {
            id: 1,
            title: 'Usuarios',
            icon: <FaUsers size={24} />,
            description: 'Gestión de usuarios y permisos del sistema',
            color: '#2563eb',
            onClick: () => setShowUserModal(true)
        },
        {
            id: 2,
            title: 'Empleados',
            icon: <FaUserTie size={24} />,
            description: 'Administración de empleados y sus perfiles',
            color: '#0891b2',
            onClick: () => setShowEmployeeModal(true)
        },
        {
            id: 3,
            title: 'Configuración General',
            icon: <FaCog size={24} />,
            description: 'Configuraciones generales del sistema',
            color: '#7c3aed'
        },
        {
            id: 4,
            title: 'Empresas',
            icon: <FaBuilding size={24} />,
            description: 'Gestión de empresas y sucursales',
            color: '#059669'
        },
        {
            id: 5,
            title: 'Tipos de Tareas',
            icon: <FaClipboardList size={24} />,
            description: 'Configuración de tipos y categorías de tareas',
            color: '#db2777'
        },
        {
            id: 6,
            title: 'Indicadores',
            icon: <FaChartLine size={24} />,
            description: 'Configuración de métricas e indicadores',
            color: '#ea580c'
        }
    ];

    return (
        <div className="parameters-container">
            <div className="parameters-header">
                <h1>Parámetros del Sistema</h1>
                <button 
                    className="back-button"
                    onClick={() => navigate('/dashboard')}
                >
                    <FaArrowLeft /> Regresar al Dashboard
                </button>
            </div>
           
          

            <div className="parameters-grid">
                {parameterCards.map((card, index) => (
                    <div 
                        key={card.id} 
                        className="parameter-card"
                        onClick={card.onClick}
                        style={{'--card-index': index}}
                    >
                        <div className="card-icon">
                            {card.icon}
                        </div>
                        <div className="card-content">
                            <h3>{card.title}</h3>
                            <p>{card.description}</p>
                        </div>
                    </div>
                ))}
            </div>

            {showEmployeeModal && (
                <EmployeeModal 
                    isOpen={showEmployeeModal} 
                    onClose={() => setShowEmployeeModal(false)} 
                />
            )}

            {showUserModal && (
                <UserModal 
                    isOpen={showUserModal} 
                    onClose={() => setShowUserModal(false)} 
                />
            )}
        </div>
    );
};

export default Parameters; 