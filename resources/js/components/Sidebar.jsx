import React from 'react';
import { FaHome, FaChartBar, FaCog } from 'react-icons/fa';
import { Link, useLocation } from 'react-router-dom';
import { useUser } from './UserContext';

const Sidebar = () => {
    const location = useLocation();
    const { user } = useUser();
    const esSupervisor = user?.tipo_usuario === "Supervisor";

    return (
        <nav className="sidebar">
            <Link
                to="/dashboard"
                className={`sidebar-icon ${location.pathname === '/dashboard' ? 'active' : ''}`}
            >
                <FaHome size={24} />
            </Link>

            <Link
                to="/reports"
                className={`sidebar-icon ${location.pathname === '/reports' ? 'active' : ''}`}
            >
                <FaChartBar size={24} />
            </Link>

            {!esSupervisor && (
                <Link
                    to="/parameters"
                    className={`sidebar-icon ${location.pathname === '/parameters' ? 'active' : ''}`}
                >
                    <FaCog size={24} />
                </Link>
            )}
        </nav>
    );
};

export default Sidebar;
