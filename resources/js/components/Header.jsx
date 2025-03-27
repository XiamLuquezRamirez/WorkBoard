import React from 'react';
import { FaUserCircle, FaBell, FaCog, FaSignOutAlt, FaChevronDown } from 'react-icons/fa';

const Header = ({ userInfo, showUserMenu, setShowUserMenu }) => {
    return (
        <header className="header">
            <div className="header-content">
                <div className="logo-section">
                    <img src="/images/logo.png" alt="Logo" />
                </div>
                
                <div className="user-section">
                    <div 
                        className="user-button"
                        onClick={() => setShowUserMenu(!showUserMenu)}
                    >
                        <img 
                            src={userInfo.foto} 
                            alt={userInfo.nombre}
                            className="user-avatar"
                        />
                        <span>{userInfo.nombre}</span>
                        <FaChevronDown />
                    </div>

                    <div className={`user-dropdown ${showUserMenu ? 'active' : ''}`}>
                        <div className="dropdown-item">
                            <FaUserCircle />
                            <span>Mi Perfil</span>
                        </div>
                        <div className="dropdown-item">
                            <FaBell />
                            <span>Notificaciones </span>
                        </div>                        
                        <div className="dropdown-item">
                            <FaSignOutAlt />
                            <span>Cerrar Sesión</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header; 