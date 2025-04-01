import React from 'react';
import { FaHome, FaChartBar, FaCog } from 'react-icons/fa';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const location = useLocation();

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

            <Link 
                to="/parameters"
                className={`sidebar-icon ${location.pathname === '/parameters' ? 'active' : ''}`}
            >
                <FaCog size={24} />
            </Link>
        </nav>
    );
};

export default Sidebar; 