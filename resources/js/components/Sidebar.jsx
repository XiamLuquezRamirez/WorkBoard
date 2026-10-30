import React from 'react';
import { FaHome, FaChartBar, FaCog } from 'react-icons/fa';
import { Link, useLocation } from 'react-router-dom';
import { useUser } from './UserContext';

const Sidebar = () => {
    const location = useLocation();
    const { user } = useUser();
    const esSupervisor = user?.tipo_usuario === "Supervisor";

    // En escritorio es la columna de iconos de la izquierda; en móvil, la
    // barra de navegación inferior (app.css). El texto sólo se ve en móvil,
    // donde un icono suelto no basta para saber a dónde lleva.
    return (
        <nav className="sidebar" aria-label="Navegación principal">
            <Link
                to="/dashboard"
                title="Inicio"
                className={`sidebar-icon ${location.pathname === '/dashboard' ? 'active' : ''}`}
            >
                <FaHome size={24} />
                <span className="sidebar-texto">Inicio</span>
            </Link>

            <Link
                to="/reports"
                title="Reportes"
                className={`sidebar-icon ${location.pathname === '/reports' ? 'active' : ''}`}
            >
                <FaChartBar size={24} />
                <span className="sidebar-texto">Reportes</span>
            </Link>

            {!esSupervisor && (
                <Link
                    to="/parameters"
                    title="Parámetros"
                    className={`sidebar-icon ${location.pathname === '/parameters' ? 'active' : ''}`}
                >
                    <FaCog size={24} />
                    <span className="sidebar-texto">Parámetros</span>
                </Link>
            )}
        </nav>
    );
};

export default Sidebar;
