import React, { useState } from 'react';
import { 
    FaUsers, 
    FaUserTie, 
    FaCog, 
    FaBuilding, 
    FaClipboardList,
    FaChartLine
} from 'react-icons/fa';
import EmployeeModal from './EmployeeModal';

const Parameters = () => {
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);

    const parameterCards = [
        {
            id: 1,
            title: 'Usuarios',
            icon: <FaUsers size={24} />,
            description: 'Gestión de usuarios y permisos del sistema',
            color: '#2563eb'
        },
        {
            id: 2,
            title: 'Empleados',
            icon: <FaUserTie size={24} />,
            description: 'Administración de empleados y sus perfiles',
            color: '#0891b2'
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
                <p>Configuración general y administración del sistema</p>
            </div>

            <div className="parameters-grid">
                {parameterCards.map(card => (
                    <div 
                        key={card.id} 
                        className="parameter-card"
                        onClick={() => {
                            if (card.title === 'Empleados') {
                                setShowEmployeeModal(true);
                            }
                        }}
                    >
                        <div 
                            className="parameter-icon" 
                            style={{ backgroundColor: `${card.color}15`, color: card.color }}
                        >
                            {card.icon}
                        </div>
                        <div className="parameter-content">
                            <h3>{card.title}</h3>
                            <p>{card.description}</p>
                        </div>
                        <button 
                            className="parameter-button"
                            style={{ backgroundColor: card.color }}
                        >
                            Configurar
                        </button>
                    </div>
                ))}
            </div>

            <EmployeeModal 
                isOpen={showEmployeeModal}
                onClose={() => setShowEmployeeModal(false)}
            />
        </div>
    );
};

export default Parameters; 