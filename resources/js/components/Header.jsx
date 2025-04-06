import React, { useState, useEffect } from "react";
import {
    FaUserCircle,
    FaBell,
    FaCog,
    FaSignOutAlt,
    FaChevronDown,
} from "react-icons/fa";
import AuthMiddleware from "../middleware/AuthMiddleware";
import ProfileModal from "./ProfileModal";
import Swal from "sweetalert2";
import NotificationModal from "./NotificationModal";
import NotificationsModal from "./NotificationsModal";

const Header = ({ showUserMenu, setShowUserMenu }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        try {
            const user = AuthMiddleware.getUser();
            if (user && typeof user === "object") {
                setCurrentUser(user);
            } else {
                // Si no hay usuario válido, redirigir al login
                window.location.href = "/";
            }
        } catch (error) {
            console.error("Error al obtener el usuario:", error);
            // En caso de error, redirigir al login
            window.location.href = "/";
        }
    }, []);

    /// caragar notificaciones despues de cargar el usuario

    useEffect(() => {
        if (!currentUser) return;
    
        const intervalo = setInterval(() => {
            if (currentUser.tipo_usuario === "Administrador") {
                cargarNotificaciones('admin');
            } else if (currentUser.lider === "Si") {
                cargarNotificaciones('lider');
            } else {
                cargarNotificaciones('empleado');
            }
        }, 10000); // 10000ms = 10 segundos
    
        // Cargar inmediatamente también
        if (currentUser.tipo_usuario === "Administrador") {
            cargarNotificaciones('admin');
        } else if (currentUser.lider === "Si") {
            cargarNotificaciones('lider');
        } else {
            cargarNotificaciones('empleado');
        }
    
        // Limpieza del intervalo al desmontar el componente o si cambia el usuario
        return () => clearInterval(intervalo);
    }, [currentUser]);
    

    const cargarNotificaciones = async (tipo) => {
        const response = await axios.get("/notificaciones", {
            params: {
                tipo: tipo,
                id: currentUser.empleado
            },
        });
        setNotifications(response.data);
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            // Primero cerramos el menú de usuario
            setShowUserMenu(false);

            // Mostramos un loading suave
            Swal.fire({
                title: "Cerrando sesión",
                text: "Por favor espere...",
                allowOutsideClick: false,
                showConfirmButton: false,
                willOpen: () => {
                    Swal.showLoading();
                },
            });

            // Llamamos al logout
            await AuthMiddleware.logout();
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            Swal.fire({
                title: "Error",
                text: "Hubo un problema al cerrar la sesión",
                icon: "error",
                confirmButtonText: "OK",
            });
        } finally {
            setIsLoggingOut(false);
        }
    };

    const handleUpdateUser = (updatedUser) => {
        setCurrentUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
    };

    return (
        <header className="header">
            <div className="header-content">
                <div className="logo-section">
                    <img src="/images/logo.png" alt="Logo" />
                </div>
                <div className="header-right">
                    <div className="notification-section">
                        <div
                            className="notification-icon"
                            onClick={() => setShowNotificationModal(true)}
                        >
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
                                <FaUserCircle size={35} />
                            </div>
                            <span style={{ textTransform: "capitalize" }}>
                                {currentUser?.name || "Usuario"}
                            </span>
                            <FaChevronDown />
                        </div>

                        <div
                            className={`user-dropdown ${
                                showUserMenu ? "active" : ""
                            }`}
                        >
                            <div
                                className="dropdown-item"
                                onClick={() => {
                                    setShowProfileModal(true);
                                    setShowUserMenu(false);
                                }}
                            >
                                <FaUserCircle />
                                <span>Mi Perfil</span>
                            </div>

                            <div
                                className={`dropdown-item ${
                                    isLoggingOut ? "disabled" : ""
                                }`}
                                onClick={
                                    !isLoggingOut ? handleLogout : undefined
                                }
                            >
                                <FaSignOutAlt />
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
                <NotificationModal
                    isOpen={showNotificationModal}
                    onClose={() => setShowNotificationModal(false)}
                    notifications={notifications}
                    setNotifications={setNotifications}
                />
            )}
        </header>
    );
};

export default Header;
