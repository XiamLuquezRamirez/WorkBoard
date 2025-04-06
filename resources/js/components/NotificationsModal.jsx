import React, { useState, useEffect } from 'react';
import { FaBell, FaCheck, FaTrash, FaCircle } from 'react-icons/fa';
import axios from 'axios';
import Swal from 'sweetalert2';

const NotificationsModal = ({ isOpen, onClose, notifications, setNotifications }) => {
    
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            cargarNotificaciones();
        }
    }, [isOpen]);

    const cargarNotificaciones = async () => {
       setLoading(true);
        const response = await axios.get("/notificaciones", {
            params: {
                tipo: tipo,
                id: currentUser.empleado
            },
        });
        setNotifications(response.data);
        setLoading(false);
    };

    const marcarComoLeida = async (id) => {
        try {
            await axios.post(`/api/notifications/${id}/read`);
            setNotifications(notifications.map(notif => 
                notif.id === id ? { ...notif, read_at: new Date().toISOString() } : notif
            ));
        } catch (error) {
            console.error('Error al marcar notificación:', error);
        }
    };

    const eliminarNotificacion = async (id) => {
        try {
            await axios.delete(`/api/notifications/${id}`);
            setNotifications(notifications.filter(notif => notif.id !== id));
        } catch (error) {
            console.error('Error al eliminar notificación:', error);
        }
    };

    const marcarTodasComoLeidas = async () => {
        try {
            await axios.post('/api/notifications/mark-all-read');
            setNotifications(notifications.map(notif => ({
                ...notif,
                read_at: notif.read_at || new Date().toISOString()
            })));
        } catch (error) {
            console.error('Error al marcar todas las notificaciones:', error);
        }
    };

    const eliminarTodasLasNotificaciones = () => {
        Swal.fire({
            title: '¿Estás seguro?',
            text: 'Se eliminarán todas las notificaciones',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar todas',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await axios.delete('/api/notifications');
                    setNotifications([]);
                } catch (error) {
                    console.error('Error al eliminar notificaciones:', error);
                }
            }
        });
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="notifications-modal">
                <div className="modal-header">
                    <div className="header-title">
                        <FaBell />
                        <h2>Notificaciones nuevas</h2>
                        {notifications.some(n => !n.read_at) && (
                            <span className="unread-count">
                                {notifications.filter(n => !n.read_at).length}
                            </span>
                        )}
                    </div>
                    <div className="header-actions">
                        <button 
                            className="mark-all-button"
                            onClick={marcarTodasComoLeidas}
                            disabled={!notifications.some(n => !n.read_at)}
                        >
                            <FaCheck /> Marcar todas como leídas
                        </button>
                        <button 
                            className="delete-all-button"
                            onClick={eliminarTodasLasNotificaciones}
                            disabled={notifications.length === 0}
                        >
                            <FaTrash /> Eliminar todas
                        </button>
                        <button className="close-button" onClick={onClose}>&times;</button>
                    </div>
                </div>

                <div className="notifications-content">
                    {loading ? (
                        <div className="loading-spinner">Cargando notificaciones...</div>
                    ) : notifications.length === 0 ? (
                        <div className="no-notifications">
                            <FaBell size={40} />
                            <p>No hay notificaciones</p>
                        </div>
                    ) : (
                        <div className="notifications-list">
                            {notifications.map(notification => (
                                <div 
                                    key={notification.id} 
                                    className={`notification-item ${!notification.read_at ? 'unread' : ''}`}
                                >
                                    <div className="notification-icon">
                                        {!notification.read_at && <FaCircle className="unread-dot" />}
                                        <FaBell />
                                    </div>
                                    <div className="notification-content">
                                        <p className="notification-text">{notification.data.message}</p>
                                        <span className="notification-time">
                                            {new Date(notification.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="notification-actions">
                                        {!notification.read_at && (
                                            <button 
                                                className="mark-read-button"
                                                onClick={() => marcarComoLeida(notification.id)}
                                                title="Marcar como leída"
                                            >
                                                <FaCheck />
                                            </button>
                                        )}
                                        <button 
                                            className="delete-button"
                                            onClick={() => eliminarNotificacion(notification.id)}
                                            title="Eliminar notificación"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationsModal; 