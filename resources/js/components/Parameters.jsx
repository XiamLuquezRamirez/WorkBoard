import React, { useState, useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { useUser } from './UserContext';
import { FaArrowLeft, FaUsers, FaUserTie, FaBuilding, FaFileAlt, FaBriefcase, FaVideo } from 'react-icons/fa';
import EmployeeModal from './EmployeeModal';
import UserModal from './UserModal';
import CompanyModal from './CompanyModal';
import ProjectModal from './ProjectModal';
import LeaderModal from './LeaderModal';
import DepartmentModal from './DepartmentModal';
import CargosModal from './CargosModal';
import VideosTableroModal from './VideosTableroModal';
import { getImageUrl, getAssetUrl } from '../utils/assetHelper';



const Parameters = () => {
    const { user } = useUser();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showCompanyModal, setShowCompanyModal] = useState(false);
    const [showLeaderModal, setShowLeaderModal] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showDepartmentModal, setShowDepartmentModal] = useState(false);
    const [showCargosModal, setShowCargosModal] = useState(false);
    const [showVideosModal, setShowVideosModal] = useState(false);
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
            id: 6,
            title: 'Proyectos',
            icon: <FaFileAlt size={25} />,
            description: 'Gestión de proyectos',
            color: '#059669',
            onClick: () => setShowProjectModal(true)
        },
        {
            id: 7,
            title: 'Departamentos',
            icon: <FaBuilding size={25} />,
            description: 'Gestión de departamentos',
            color: '#059669',
            onClick: () => setShowDepartmentModal(true)
        },
        {
            id: 8,
            title: 'Cargos',
            icon: <FaBriefcase size={25} />,
            description: 'Gestión de cargos y posiciones de empleados',
            color: '#7c3aed',
            onClick: () => setShowCargosModal(true)
        },
        {
            id: 9,
            title: 'Vídeos del Tablero',
            icon: <FaVideo size={25} />,
            description: 'Vídeos ambientales del Tablero de Seguimiento',
            color: '#0891b2',
            onClick: () => setShowVideosModal(true)
        }
    ];

    //

    useEffect(() => {
        document.title = "Parámetros del Sistema - WorkBoard";
    }, []);

    const backDashboard = () => {
        const fullPath = getAssetUrl('dashboard');              
        window.location.href = fullPath;
    };



    return (
        <div className="dashboard-container">
            <Sidebar />

            <Header
                showUserMenu={showUserMenu}
                setShowUserMenu={setShowUserMenu}
                currentUser={user}
            />
            <div className="parameters-container">
                <div className="parameters-header">
                    <h1>Parámetros del Sistema</h1>
                    <button className="back-button" onClick={ backDashboard }>
                        <FaArrowLeft /> Regresar al Dashboard
                    </button>
                </div>

                <div className="parameters-grid">
                    {parameterCards.map((card, index) => (
                        <div
                            key={card.id}
                            className="parameter-card"
                            onClick={card.onClick}
                            style={{ '--card-index': index }}
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

                {/* Modal empleados */}
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
                {showProjectModal && (
                    <ProjectModal
                        isOpen={showProjectModal}
                        onClose={() => setShowProjectModal(false)}
                    />
                )}
                {showDepartmentModal && (
                    <DepartmentModal
                        isOpen={showDepartmentModal}
                        onClose={() => setShowDepartmentModal(false)}
                    />
                )}
                {showCargosModal && (
                    <CargosModal
                        isOpen={showCargosModal}
                        onClose={() => setShowCargosModal(false)}
                    />
                )}

                {showVideosModal && (
                    <VideosTableroModal onClose={() => setShowVideosModal(false)} />
                )}
            </div>
        </div>

    );
};

export default Parameters;
