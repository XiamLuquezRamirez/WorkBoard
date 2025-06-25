import React, { useState, useEffect } from 'react';
import { FaBell, FaChevronDown, FaUserCircle, FaSignOutAlt, FaSignInAlt } from 'react-icons/fa';
import { getImageUrl, getAssetUrl } from '../utils/assetHelper';
import axiosInstance from '../axiosConfig';
import { useUser } from './UserContext';
import ProfileModal from './ProfileModal';
import NotificationsModal from './NotificationsModal';
import Swal from 'sweetalert2';

const Header = ({ currentUser, showUserMenu, setShowUserMenu, setIsSidebarOpen }) => {
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const { user, setUser } = useUser();
    const [hover, setHover] = useState(false);

    useEffect(() => {
        if (!user) return;

        const intervalo = setInterval(() => {
            if (user.tipo_usuario === "Administrador") {
                cargarNotificaciones('admin');
            } else if (user.lider === "Si") {
                cargarNotificaciones('lider');
            } else {
                cargarNotificaciones('empleado');
            }
        }, 10000); // 10000ms = 10 segundos

        // Cargar inmediatamente también
        if (user.tipo_usuario === "Administrador") {
            cargarNotificaciones('admin');
        } else if (user.lider === "Si") {
            cargarNotificaciones('lider');
        } else {
            cargarNotificaciones('empleado');
        }

        // Limpieza del intervalo al desmontar el componente o si cambia el usuario
        return () => clearInterval(intervalo);
    }, [user]);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await axiosInstance.post('/logout');
            // Limpiar el localStorage
            localStorage.removeItem('userWorkBoard');
            // Redirigir inmediatamente a la página de login
            //obtener la url actual
            const url = getAssetUrl('login');
            window.location.href = url;
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
        } finally {
            setIsLoggingOut(false);
        }
    };

    const cargarNotificaciones = async (tipo) => {
        const response = await axiosInstance.get("/notificaciones", {
            params: {
                tipo: tipo,
                id: currentUser.id
            },
        });
        setNotifications(response.data);
    };

    const handleUpdateUser = (updatedUser) => {
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
    };

    return (
        <header className="header">
            <div className="header-content">
                <div className="logo-section">
                    <img src={getImageUrl('images/logo.png')} alt="Logo" />
                </div>
                <div className="header-right">
                    <div className="notification-section">
                        <div className="notification-icon" onClick={() => setShowNotificationModal(true)}>
                            <FaBell size={30} />
                            {notifications.filter((n) => !n.leida).length >
                                0 && (
                                    <span className="notification-badge">
                                        {
                                            notifications.filter((n) => !n.leida)
                                                .length
                                        }
                                    </span>
                                )}
                        </div>
                    </div>

                    <div
                        className="user-section"
                        style={{ marginRight: "25px" }}
                    >
                        <div
                            className="user-button"
                            onClick={() => setShowUserMenu(!showUserMenu)}
                        >
                            <div className="user-avatar">
                                <img src={currentUser?.foto} alt="Avatar" />
                            </div>
                            <span style={{ textTransform: "capitalize" }}>
                                {currentUser?.name || "Usuario"}
                            </span>
                            <FaChevronDown />
                        </div>

                        <div
                            className={`user-dropdown ${showUserMenu ? "active" : ""
                                }`}
                        >
                            <div
                                className={`dropdown-item ${isLoggingOut ? "disabled" : ""
                                    }`}
                                onClick={() => {
                                    setShowProfileModal(true);
                                    setShowUserMenu(false);
                                }}
                            >
                                <FaUserCircle />
                                <span>Mi Perfil</span>
                            </div>

                            <div
                                className={`dropdown-item ${isLoggingOut ? "disabled" : ""
                                    }`}
                                onClick={
                                    !isLoggingOut ? handleLogout : undefined
                                }
                                onMouseEnter={() => setHover(true)}
                                onMouseLeave={() => setHover(false)}
                            >

                                {hover ? <FaSignOutAlt /> : <FaSignInAlt />}

                                <span>
                                    {isLoggingOut
                                        ? "Cerrando sesión..."
                                        : "Cerrar Sesión"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showProfileModal && (
                <ProfileModal
                    isOpen={showProfileModal}
                    onClose={() => setShowProfileModal(false)}
                    currentUser={currentUser}
                    updateUser={handleUpdateUser}
                />
            )}

            {showNotificationModal && (
                <NotificationsModal
                    isOpen={showNotificationModal}
                    onClose={() => setShowNotificationModal(false)}
                    notifications={notifications}
                    currentUser={currentUser}
                    setNotifications={setNotifications}
                />
            )}

        </header>
    );


};

export default Header;
