import React from 'react';
import { FaTimes, FaCheck, FaTimes as FaX } from 'react-icons/fa';
import '../../css/NotificationsModal.css';

const NotificationsModal = ({ isOpen, onClose, observaciones }) => {
    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (e.target.className === 'notifications-modal-overlay') {
            onClose();
        }
    };

    return (
        <div 
            className="notifications-modal-overlay" 
            onClick={handleOverlayClick} 
            style={{ 
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1070
            }}
        >
            <div 
                className="notifications-modal" 
                style={{ 
                    background: 'white',
                    borderRadius: '8px',
                    padding: '20px',
                    width: '90%',
                    maxWidth: '700px',
                    maxHeight: '80vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    zIndex: 1071
                }}
            >
                <div className="notifications-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '15px', marginBottom: '15px', borderBottom: '1px solid #e5e7eb', position: 'relative'}}>
                    <h3 className="notifications-title">
                        Observaciones de la Tarea
                    </h3>
                    <button
                        onClick={onClose}
                        className="notifications-close"
                        title="Cerrar"
                        aria-label="Cerrar"
                        style={{
                            position: 'relative',
                            top: '10px',
                            right: '10px',
                            background: 'transparent',
                            border: 'none',
                            color: '#6b7280',
                            cursor: 'pointer',
                            padding: '5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem',
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%'
                        }}
                    >
                        <FaTimes />
                    </button>
                </div>

                <div className="notifications-content">
                    {observaciones && observaciones.length > 0 ? (
                        observaciones.map((obs, index) => (
                            <div key={index} className="notification-item">
                                <div className="notification-header">
                                    <div className="notification-user">
                                        <span className="notification-username" style={{textTransform: 'capitalize'}}>
                                            {obs.creador || 'Usuario'}
                                        </span>
                                     
                                    </div>
                                    <div className={`notification-status ${obs.visto_bueno ? 'status-approved' : 'status-not-approved'}`}>
                                        {obs.visto_bueno ? (
                                            <>
                                                <FaCheck /> Aprobado
                                            </>
                                        ) : (
                                            <>
                                                <FaX /> No aprobado
                                            </>
                                        )}
                                    </div>
                                </div>
                                <p className="notification-text">
                                    {obs.observaciones || 'Sin observaciones'}
                                </p>
                            </div>
                        ))
                    ) : (
                        <div className="notification-item">
                            <p className="notification-text text-center">
                                No hay observaciones para esta tarea
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationsModal; 