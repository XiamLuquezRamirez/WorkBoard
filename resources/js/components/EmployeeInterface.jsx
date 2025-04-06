import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { FaPlus, FaClock, FaSpinner, FaCheck, FaEye, FaSearch, FaFile, FaFileWord, FaFileImage, FaFilePdf } from 'react-icons/fa';
import TaskDetailsModal from './TaskDetailsModal';
import axios from 'axios';
import Swal from 'sweetalert2';
import '../css/EmployeeInterface.css';
import { useUser } from './UserContext';
const EmployeeInterface = ({ user }) => {
 
    const [columns, setColumns] = useState({
        'Pendiente': {
            title: 'Pendiente',
            items: [],
            icon: FaClock,
            color: '#f97316'
        },
        'En progreso': {
            title: 'En Progreso',
            items: [],
            icon: FaSpinner,
            color: '#2563eb'
        },
        'Completada': {
            title: 'Completada',
            items: [],
            icon: FaCheck,
            color: '#16a34a'
        }
    });
    const [selectedTask, setSelectedTask] = useState(null);
    const [showTaskDetails, setShowTaskDetails] = useState(false);
    const [showNewTaskModal, setShowNewTaskModal] = useState(false);

    useEffect(() => {
        loadTasks();
    }, []);

    const getFileIcon = (tipo) => {
        switch (tipo) {
            case 'application/pdf':
                return <FaFilePdf />;
            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                return <FaFileWord />;
            case 'image/jpeg':
            case 'image/png':
                return <FaFileImage />;
            default:
                return <FaFile />;
        }
    };

    const loadTasks = async () => {
        try {
            console.log(user);
            const response = await axios.get(`/parametros/cargarTareas/${user.empleado}`);
            organizeTasks(response.data.tareas);
        } catch (error) {
            console.error('Error al cargar tareas:', error);
        }
    };

    const organizeTasks = (tareas) => {
        // Crear una copia limpia de las columnas con arrays vacíos
        const newColumns = {
            'Pendiente': {
                ...columns['Pendiente'],
                items: []
            },
            'En progreso': {
                ...columns['En progreso'],
                items: []
            },
            'Completada': {
                ...columns['Completada'],
                items: []
            }
        };

        // Distribuir las tareas en las columnas correspondientes
        tareas.forEach(task => {
            const estado = task.estado.trim();
            if (newColumns[estado]) {
                newColumns[estado].items.push(task);
            }
        });

        setColumns(newColumns);
    };

    const onDragEnd = (result) => {
        if (!result || !result.destination) return;
        
        const { source, destination, draggableId } = result;
        const sourceId = source.droppableId;
        const destinationId = destination.droppableId;

        // Crear copias profundas para evitar mutaciones
        const newColumns = JSON.parse(JSON.stringify(columns));
        
        // Obtener las columnas afectadas
        const sourceColumn = newColumns[sourceId];
        const destColumn = newColumns[destinationId];

        if (sourceId === destinationId) {
            // Reordenar en la misma columna
            const items = Array.from(sourceColumn.items);
            const [removed] = items.splice(source.index, 1);
            items.splice(destination.index, 0, removed);

            newColumns[sourceId].items = items;
        } else {
            // Mover entre columnas
            const sourceItems = Array.from(sourceColumn.items);
            const destItems = Array.from(destColumn.items);
            const [moved] = sourceItems.splice(source.index, 1);
            
            // Actualizar el estado de la tarea
            moved.estado = destinationId;
            destItems.splice(destination.index, 0, moved);

            newColumns[sourceId].items = sourceItems;
            newColumns[destinationId].items = destItems;

            // Actualizar en el servidor
            axios.put(`/parametros/actualizarEstadoTarea/${draggableId}`, {
                estado: destinationId
            }).catch(error => {
                console.error('Error al actualizar estado:', error);
            });
        }

        setColumns(newColumns);
    };

    const handleTaskClick = (task) => {
        setSelectedTask(task);
        setShowTaskDetails(true);
    };

    const handleSubmitNewTask = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            const response = await axios.post('/parametros/guardarTarea', {
                titulo: formData.get('titulo'),
                descripcion: formData.get('descripcion'),
                fecha_pactada: formData.get('fecha_pactada'),
                prioridad: formData.get('prioridad'),
                empleado: user.empleado
            });

            // Cerrar el modal primero
            setShowNewTaskModal(false);

            // Cargar todas las tareas nuevamente
            const tasksResponse = await axios.get(`/parametros/cargarTareas/${user.empleado}`);
            const tasks = tasksResponse.data.tareas;

            // Organizar las tareas en las columnas
            const newColumns = {
                'Pendiente': {
                    title: 'Pendiente',
                    items: tasks.filter(task => task.estado === 'Pendiente'),
                    iconComponent: 'FaClock',
                    color: '#f97316'
                },
                'En progreso': {
                    title: 'En progreso',
                    items: tasks.filter(task => task.estado === 'En progreso'),
                    iconComponent: 'FaSpinner',
                    color: '#2563eb'
                },
                'Completada': {
                    title: 'Completada',
                    items: tasks.filter(task => task.estado === 'Completada'),
                    iconComponent: 'FaCheck',
                    color: '#16a34a'
                }
            };

            setColumns(newColumns);
            Swal.fire('¡Éxito!', 'Tarea creada correctamente', 'success');
        } catch (error) {
            console.error('Error al crear la tarea:', error);
            Swal.fire('Error', 'Error al crear la tarea', 'error');
        }
    };

    const renderIcon = (iconName) => {
        switch (iconName) {
            case 'FaClock':
                return <FaClock />;
            case 'FaSpinner':
                return <FaSpinner />;
            case 'FaCheck':
                return <FaCheck />;
            default:
                return null;
        }
    };

    return (
        <div className="kanban-container">
            <div className="kanban-header">
                <h2>Mis Tareas</h2>

                <div className="header-right">
                {user.lider == 'Si' && (
                <button
                className="search-task-button"
                onClick={() => setShowNewTaskModal(true)}
                >
                    <FaSearch /> Seguimiento de Tareas
                </button>
           
                )}
                     <button 
                    className="new-task-button"
                    onClick={() => setShowNewTaskModal(true)}
                >
                    <FaPlus /> Nueva Tarea
                </button>
                </div>
                
            </div>

            {/* Modal de nueva tarea */}
            {showNewTaskModal && (
                <div className="modal-overlay">
                    <div className="new-task-modal">
                        <div className="modal-header">
                            <h2>Nueva Tarea</h2>
                            <button 
                                className="close-button"
                                onClick={() => setShowNewTaskModal(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="modal-content">
                            <form onSubmit={handleSubmitNewTask}>
                                <div className="form-group">
                                    <label htmlFor="titulo">Título</label>
                                    <input 
                                        type="text" 
                                        id="titulo" 
                                        name="titulo" 
                                        required 
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="descripcion">Descripción</label>
                                    <textarea 
                                        id="descripcion" 
                                        name="descripcion" 
                                        required 
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="fecha_pactada">Fecha límite</label>
                                    <input 
                                        type="date" 
                                        id="fecha_pactada" 
                                        name="fecha_pactada" 
                                        required 
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="prioridad">Prioridad</label>
                                    <select id="prioridad" name="prioridad" required>
                                        <option value="Alta">Alta</option>
                                        <option value="Media">Media</option>
                                        <option value="Baja">Baja</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="estado">Estado</label>
                                    <select id="estado" name="estado" required>
                                        <option value="Pendiente">Pendiente</option>
                                        <option value="En Progreso">En Progreso</option>
                                        <option value="Completada">Completada</option>
                                    </select>
                                </div>
                                <div className="modal-actions">
                                    <button 
                                        type="button" 
                                        className="cancel-button"
                                        onClick={() => setShowNewTaskModal(false)}
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="submit-button"
                                    >
                                        Crear Tarea
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="kanban-board">
                    {Object.entries(columns).map(([columnId, column]) => (
                        <div key={columnId} className="kanban-column">
                            <div className="column-header" style={{ backgroundColor: column.color }}>
                                {renderIcon(column.iconComponent)}
                                <h3>{column.title}</h3>
                                <span className="task-count">{column.items.length}</span>
                            </div>
                            <Droppable droppableId={columnId}>
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="task-list"
                                    >
                                        {column.items.map((task, index) => (
                                            <Draggable
                                                key={task.id.toString()}
                                                draggableId={task.id.toString()}
                                                index={index}
                                            >
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={`task-card ${snapshot.isDragging ? 'dragging' : ''}`}
                                                        onClick={() => handleTaskClick(task)}
                                                    >
                                                        <div className="task-card-header">
                                                            <h4>{task.titulo}</h4>
                                                            {task.prioridad && (
                                                                <span className={`priority-badge ${task.prioridad.toLowerCase()}`}>
                                                                    {task.prioridad}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="task-description">{task.descripcion}</p>
                                                        <div className="task-dates">
                                                            {(task.estado === 'Pendiente' || task.estado === 'En progreso') && task.fecha_pactada && (
                                                                <span className="date-badge due-date">
                                                                    <FaClock />
                                                                    Fecha límite: {new Date(task.fecha_pactada).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                            {task.estado === 'Completada' && task.fecha_entregada && (
                                                                <span className="date-badge completed-date">
                                                                    <FaCheck />
                                                                    Entregado: {new Date(task.fecha_entregada).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {task.evidencias && task.evidencias.length > 0 && (
                                                            <div className="evidences-container">
                                                                {task.evidencias.map(evidencia => (
                                                                    <span 
                                                                        key={evidencia.id} 
                                                                        className="evidence-icon" 
                                                                        title={evidencia.nombre}
                                                                    >
                                                                        {getFileIcon(evidencia.tipo)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>

            {showTaskDetails && selectedTask && (
                <TaskDetailsModal
                    task={selectedTask}
                    onClose={() => setShowTaskDetails(false)}
                    onUpdate={loadTasks}
                />
            )}
        </div>
    );
};

export default EmployeeInterface; 