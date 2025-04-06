import React, { useState } from 'react';
import { FaBell, FaClipboardList, FaComment, FaCalendar } from 'react-icons/fa';
import '../css/NotificationModal.css';

const NotificationModal = ({ isOpen, onClose, notifications, setNotifications }) => {
    const [activeTab, setActiveTab] = useState('unread'); // 'read' o 'unread'
    
    if (!isOpen) return null;

    const getIcon = (tipo) => {
        switch (tipo) {
            case 'tarea':
                return <FaClipboardList />;
            case 'mensaje':
                return <FaComment />;
            case 'recordatorio':
                return <FaCalendar />;
            default:
                return <FaBell />;
        }
    };

    const handleMarkAsRead = (notificationId) => {
        setNotifications(notifications.map(notif => 
            notif.id === notificationId 
                ? {...notif, leida: true}
                : notif
        ));
    };

    const handleNotificationClick = (notification) => {
        // Marcar como leída si no lo está
        if (!notification.leida) {
            handleMarkAsRead(notification.id);
        }
        
        // Abrir el detalle de la tarea
        if (notification.tipo === 'tarea') {
            // Aquí puedes implementar la lógica para abrir el detalle de la tarea
            // Por ejemplo, redirigir a la página de detalle de la tarea
            window.location.href = `/tareas/${notification.tarea_id}`;
        }
        // Puedes añadir más condiciones para otros tipos de notificaciones
    };

    // Filtrar notificaciones por estado
    const readNotifications = notifications.filter(notif => notif.leida);
    const unreadNotifications = notifications.filter(notif => !notif.leida);

    return (
        <div className="modal-overlay">
            <div className="notification-modal">
                <div className="modal-header">
                    <h2>Notificaciones</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                <div className="tab-container">
                    <button 
                        className={`tab-button ${activeTab === 'read' ? 'active' : ''}`}
                        onClick={() => setActiveTab('read')}
                    >
                        Notificaciones leídas ({readNotifications.length})
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'unread' ? 'active' : ''}`}
                        onClick={() => setActiveTab('unread')}
                    >
                        Notificaciones no leídas ({unreadNotifications.length})
                    </button>
                </div>

                <div className="tab-content">
                    {activeTab === 'read' ? (
                        <div className="tab-content-item">
                            {readNotifications.length === 0 ? (
                                <p className="no-notifications">No hay notificaciones leídas</p>
                            ) : (
                                readNotifications.map(notification => (
                                    <div 
                                        key={notification.id} 
                                        className="notification-item"
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <div className="notification-icon">
                                            {getIcon(notification.tipo)}
                                        </div>
                                        <div className="notification-content">
                                            <p className="notification-employee">{notification.nombres} {notification.apellidos}</p>
                                            <p className="notification-description">{notification.descripcion}</p>
                                            <p className="notification-date">{notification.fecha}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="tab-content-item">
                            {unreadNotifications.length === 0 ? (
                                <p className="no-notifications">No hay notificaciones no leídas</p>
                            ) : (
                                unreadNotifications.map(notification => (
                                    <div 
                                        key={notification.id} 
                                        className="notification-item unread"
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <div className="notification-icon">
                                            {getIcon(notification.tipo)}
                                        </div>
                                        <div className="notification-content">
                                            <p className="notification-employee">{notification.nombres} {notification.apellidos}</p>
                                            <p className="notification-description">{notification.descripcion}</p>
                                            <p className="notification-date">{notification.fecha}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationModal; 