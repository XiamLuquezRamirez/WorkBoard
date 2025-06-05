import React, { useState } from 'react';
import { FaBell, FaClipboardList, FaComment, FaCalendar, FaCheckCircle, FaTimesCircle, FaExclamationTriangle } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';
import TaskDetailsModal from './TaskDetailsModal';
import Swal from 'sweetalert2';


const NotificationModal = ({ isOpen, onClose, notifications, setNotifications, currentUser }) => {
    const [activeTab, setActiveTab] = useState('unread'); // 'read' o 'unread'
    const [selectedTask, setSelectedTask] = useState(null);
    const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
    const [tipo, setTipo] = useState(currentUser?.tipo_usuario);

    if (!isOpen) return null;

    const getIcon = (tipo) => {
        switch (tipo) {
            case 'Tarea':
                return {
                    icon: <FaClipboardList />
                };
            case 'Estado':
                return {
                    icon: <FaComment />
                };
            case 'Aprobada':
                return {
                    icon: <FaCheckCircle />
                };
            case 'Rechazada':
                return {
                    icon: <FaTimesCircle />
                };
            case 'VistoBueno':
                return {
                    icon: <FaCheckCircle />
                };
            case 'Observacion':
                return {
                    icon: <FaComment />
                };
            case 'TareaAtrasada':
                return {
                    icon: <FaExclamationTriangle />
                };
            default:
                return {
                    icon: <FaBell />
                };
        }
    };

    //const { icon, mensaje1, mensaje2 } = getIcon(notificacion.tipo);


    const handleMarkAsRead = (notificationId) => {
        setNotifications(notifications.map(notif =>
            notif.id === notificationId
                ? { ...notif, leida: true }
                : notif
        ));
    };

    const formatDate = (fecha) => {
        if (!fecha) return '';
        const [year, month, day] = fecha.split('-');
        return `${day}/${month}/${year}`;
    };

    const handleNotificationClick = async (notification) => {
        // Marcar como leída si no lo está
        if (!notification.leida) {
            handleMarkAsRead(notification.id);
        }
        console.log(notification);
        // Cambiar estado de la notificacion en la base de datos
        await axiosInstance.get(`/cambioEstadoNotificaciones/${notification.id}`, {
            leida: true
        });

        // Abrir el detalle de la tarea
        try {
            const response = await axiosInstance.get(`/cargarTareaSeleccionada/${notification.tarea_id}`);

            if (response.data) {
                const tarea = response.data;
                if (tarea) {
                    setSelectedTask(tarea);
                    setShowTaskDetailsModal(true);
                }
            }
        } catch (error) {
            console.error('Error al cargar los detalles de la tarea:', error);
            Swal.fire('Error', 'No se pudieron cargar los detalles de la tarea', 'error');
        }

    };

    // Filtrar notificaciones por estado
    const readNotifications = notifications.filter(notif => notif.leida);
    const unreadNotifications = notifications.filter(notif => !notif.leida);



    return (
        <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && onClose()}>
            <div className="notification-modal">
                <div className="modal-header">
                    <h2>Notificaciones</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <div className="tabs">
                        <button
                            className={`tab ${activeTab === 'unread' ? 'active' : ''}`}
                            onClick={() => setActiveTab('unread')}
                        >
                            No leídas ({unreadNotifications.length})
                        </button>
                        <button
                            className={`tab ${activeTab === 'read' ? 'active' : ''}`}
                            onClick={() => setActiveTab('read')}
                        >
                            Leídas ({readNotifications.length})
                        </button>
                    </div>
                    <div className="notifications-list">
                        {activeTab === 'unread' ? (
                            notifications.filter(n => !n.leida).length > 0 ? (
                                notifications.filter(n => !n.leida).map(notification => (
                                    <div
                                        key={notification.id}
                                        className="notification-item"
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <div className="notification-icon">
                                            {getIcon(notification.tipo).icon}
                                        </div>
                                        {/* mostrar el nombre si es lider o empleado  o admin*/}

                                        <div className="notification-content">
                                            <p className="notification-description">{notification.mensaje}</p>
                                            <p className="notification-date">{formatDate(notification.fecha)}</p>
                                        </div>

                                    </div>
                                ))
                            ) : (
                                <p className="no-notifications">No hay notificaciones sin leer</p>
                            )
                        ) : (
                            notifications.filter(n => n.leida).length > 0 ? (
                                notifications.filter(n => n.leida).map(notification => (
                                    <div
                                        key={notification.id}
                                        className="notification-item"
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <div className="notification-icon">
                                            {getIcon(notification.tipo).icon}
                                        </div>
                                        {/* mostrar el nombre si es lider o empleado  o admin*/}

                                        <div className="notification-content">
                                            <p className="notification-description">{notification.mensaje}</p>
                                            <p className="notification-date">{formatDate(notification.fecha)}</p>
                                        </div>

                                    </div>
                                ))
                            ) : (
                                <p className="no-notifications">No hay notificaciones leídas</p>
                            )
                        )}
                    </div>
                </div>
            </div>
            {showTaskDetailsModal && selectedTask && (
                <TaskDetailsModal
                    task={selectedTask}
                    onClose={() => {
                        setShowTaskDetailsModal(false);
                        setSelectedTask(null);
                    }}
                    onUpdate={() => {
                        // Actualizar la lista de notificaciones si es necesario
                        setNotifications(prevNotifications =>
                            prevNotifications.map(notif =>
                                notif.id_tarea === selectedTask.id
                                    ? { ...notif, leida: true }
                                    : notif
                            )
                        );
                    }}
                />
            )}
        </div>
    );
};

export default NotificationModal; 