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
import CompanyModal from './CompanyModal';
import LeaderModal from './LeaderModal';
import { useNavigate } from 'react-router-dom';
import '../css/parameters.css';

const Parameters = () => {
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showCompanyModal, setShowCompanyModal] = useState(false);
    const [showLeaderModal, setShowLeaderModal] = useState(false);
    const navigate = useNavigate();

    const parameterCards = [
        
        {
            id: 2,
            title: 'Empleados',
            icon: <FaUserTie size={25} />,
            description: 'Administración de empleados y sus perfiles',
            color: '#0891b2',
            onClick: () => setShowEmployeeModal(true)
        },
        {
            id: 1,
            title: 'Usuarios',
            icon: <FaUsers size={25} />,
            description: 'Gestión de usuarios y permisos del sistema',
            color: '#2563eb',
            onClick: () => setShowUserModal(true)
        },
        {
            id: 4,
            title: 'Empresas',
            icon: <FaBuilding size={25} />,
            description: 'Gestión de empresas y sucursales',
            color: '#059669',
            onClick: () => setShowCompanyModal(true)
        },
        {
            id: 5,
            title: 'Lideres de área',
            icon: <FaUserTie size={25} />,
            description: 'Gestión de lideres de area',
            color: '#059669',
            onClick: () => setShowLeaderModal(true)
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

            {showCompanyModal && (
                <CompanyModal 
                    isOpen={showCompanyModal} 
                    onClose={() => setShowCompanyModal(false)} 
                />
            )}

            {showLeaderModal && (
                <LeaderModal 
                    isOpen={showLeaderModal} 
                    onClose={() => setShowLeaderModal(false)} 
                />
            )}

        </div>
    );
};

export default Parameters; 