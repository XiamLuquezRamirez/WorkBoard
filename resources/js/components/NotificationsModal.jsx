import React, { useState } from 'react';
import { FaBell, FaClipboardList, FaComment, FaCalendar } from 'react-icons/fa';
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
                    icon: <FaClipboardList />,
                    mensaje1: 'ha creado una tarea',
                    mensaje2: 'ha asignado una tarea a'
                };
            case 'Mensaje':
                return {
                    icon: <FaComment />,
                    mensaje1: 'le ha enviado un mensaje a',
                    mensaje2: 'le ha enviado un mensaje a'
                };
            case 'Recordatorio':
                return {
                    icon: <FaCalendar />,
                    mensaje1: '',
                    mensaje2: ''
                };
            case 'Observaciones':
                return {
                    icon: <FaComment />,
                    mensaje1: 'le ha hecho una observación',
                    mensaje2: ''
                };
            default:
                return {
                    icon: <FaBell />,
                    mensaje1: 'tiene una nueva notificación',
                    mensaje2: ''
                };
        }
    };
    
    //const { icon, mensaje1, mensaje2 } = getIcon(notificacion.tipo);
    

    const handleMarkAsRead = (notificationId) => {
        setNotifications(notifications.map(notif => 
            notif.id === notificationId 
                ? {...notif, leida: true}
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

        // Cambiar estado de la notificacion en la base de datos
        await axiosInstance.get(`/cambioEstadoNotificaciones/${notification.id}`, {
            leida: true
        });

        // Abrir el detalle de la tarea
            try {
                const response = await axiosInstance.get(`/cargarTareaSeleccionada/${notification.id_tarea}`);
                
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
                                        {tipo === 'Administrador' ? (
                                            <div className="notification-content">
                                                <p className="notification-employee">{
                                                notification.emisor === 'Lider' 
                                                ?
                                                notification.nombre_lider + ` ${getIcon(notification.tipo).mensaje2} ` + notification.nombre_completo 
                                                : 
                                                notification.nombre_completo + ` ${getIcon(notification.tipo).mensaje1} `}</p>
                                                <p className="notification-description">{notification.descripcion}</p>
                                                <p className="notification-date">{formatDate(notification.fecha)}</p>
                                            </div>
                                        ) : (
                                            <div className="notification-content">
                                                <p className="notification-employee">{notification.nombre_completo}</p>
                                                <p className="notification-description">{notification.descripcion}</p>
                                                <p className="notification-date">{formatDate(notification.fecha)}</p>
                                            </div>
                                        )}
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
                                    {tipo === 'Administrador' ? (
                                        <div className="notification-content">
                                            <p className="notification-employee">{notification.emisor === 'Lider' ?  notification.nombre_lider + ` ${getIcon(notification.tipo).mensaje2} ` + notification.nombre_empleado : notification.nombre_empleado + ` ${getIcon(notification.tipo).mensaje1} `}</p>
                                            <p className="notification-description">{notification.descripcion}</p>
                                            <p className="notification-date">{notification.fecha}</p>
                                        </div>
                                    ) : (
                                        <div className="notification-content">
                                            <p className="notification-employee">{notification.nombres} {notification.apellidos}</p>
                                            <p className="notification-description">{notification.descripcion}</p>
                                            <p className="notification-date">{notification.fecha}</p>
                                        </div>
                                    )}
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
                                    ? {...notif, leida: true}
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