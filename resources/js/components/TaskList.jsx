import React from 'react';
import { FaCheckCircle, FaClock, FaSpinner } from 'react-icons/fa';

const TaskList = ({ tareas }) => {
    const getStatusIcon = (status) => {
        switch(status) {
            case 'completed':
                return <FaCheckCircle color="#0369a1" />;
            case 'progress':
                return <FaSpinner color="#047857" />;
            case 'pending':
                return <FaClock color="#c2410c" />;
            default:
                return null;
        }
    };

    const getStatusClass = (status) => {
        switch(status) {
            case 'completed':
                return 'status-completed';
            case 'progress':
                return 'status-progress';
            case 'pending':
                return 'status-pending';
            default:
                return '';
        }
    };

    const getStatusText = (status) => {
        switch(status) {
            case 'completed':
                return 'Completada';
            case 'progress':
                return 'En Proceso';
            case 'pending':
                return 'Pendiente';
            default:
                return '';
        }
    };

    return (
        <div className="task-list">
            <h4>Tareas Recientes</h4>
            {tareas.map(tarea => (
                <div key={tarea.id} className="task-item">
                    <div className="task-info">
                        <span>{tarea.nombre}</span>
                    </div>
                    <div className={`task-status ${getStatusClass(tarea.estado)}`}>
                        {getStatusIcon(tarea.estado)}
                        <span>{getStatusText(tarea.estado)}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TaskList; 