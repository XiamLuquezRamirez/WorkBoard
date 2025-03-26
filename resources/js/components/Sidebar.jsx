import React from 'react';
import { FaHome, FaChartBar, FaCog } from 'react-icons/fa';

const Sidebar = ({ activeMenu, onMenuClick }) => {
    return (
        <nav className="sidebar">
            <div 
                className={`sidebar-icon ${activeMenu === 'home' ? 'active' : ''}`}
                onClick={() => onMenuClick('home')}
            >
                <FaHome size={24} />
            </div>
            <div 
                className={`sidebar-icon ${activeMenu === 'reports' ? 'active' : ''}`}
                onClick={() => onMenuClick('reports')}
            >
                <FaChartBar size={24} />
            </div>
            <div 
                className={`sidebar-icon ${activeMenu === 'settings' ? 'active' : ''}`}
                onClick={() => onMenuClick('settings')}
            >
                <FaCog size={24} />
            </div>
        </nav>
    );
};

export default Sidebar; 