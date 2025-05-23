import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { FaPlus, FaClock, FaSpinner, FaCheck, FaEye, FaSearch, FaFile, FaFileWord, FaFileImage, FaFilePdf, FaTimes, FaSave } from 'react-icons/fa';
import TaskDetailsModal from './TaskDetailsModal';
import axiosInstance from '../axiosConfig';
import Swal from 'sweetalert2';
const EmployeeInterface = ({ user }) => {
 
    const [columns, setColumns] = useState({
        'Pendiente': {
            title: 'Pendiente',
            items: [],
            icon: FaClock,
            color: '#f97316'
        },
        'En Proceso': {
            title: 'En Proceso',
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
    const [showListaEmpleadosAsignados, setShowListaEmpleadosAsignados] = useState(false);
    const [empleadosAsignados, setEmpleadosAsignados] = useState([]);
    const [showTareasEmpleado, setShowTareasEmpleado] = useState(false);
    const [tareasEmpleado, setTareasEmpleado] = useState([]);
    const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null);
    const [estadoSeleccionado, setEstadoSeleccionado] = useState(null);
    const [mostrarTareasEstado, setMostrarTareasEstado] = useState(false);
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
            const response = await axiosInstance.get(`/cargarTareas/${user.empleado}`);
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
            'En Proceso': {
                ...columns['En Proceso'],
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
        console.log(destination);
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

            // Si se mueve a Completada, agregar la fecha de finalización
            if (destinationId === "Completada") {
                moved.fecha_entregada = new Date().toISOString().split('T')[0];
            }

            destItems.splice(destination.index, 0, moved);

            newColumns[sourceId].items = sourceItems;
            newColumns[destinationId].items = destItems;

            // Preparar datos para actualizar en el servidor
            const updateData = {
                estado: destinationId
            };

            // Si se mueve a Completada, incluir la fecha de finalización
            if (destinationId === "Completada") {
                updateData.fecha_entregada = new Date().toISOString().split('T')[0];
            }

            // Actualizar en el servidor
            axiosInstance.put(`/actualizarEstadoTarea/${draggableId}`, updateData)
                .catch(error => {
                    console.error('Error al actualizar estado:', error);
                });
        }

        setColumns(newColumns);
    };

    const handleTaskClick = (task) => {
        setSelectedTask(task);
        setShowTaskDetails(true);
    };

    const abrirListaEmpleadosAsignados = async () => {
        setShowListaEmpleadosAsignados(true);
        
    };

    const verTareas = async (empleadoId) => {
        try {
            const response = await axiosInstance.get(`/cargarTareas/${empleadoId}`);
            setTareasEmpleado(response.data.tareas);
            
            // Encontrar el empleado seleccionado
            const empleado = user.empleados_asignados.find(emp => emp.id === empleadoId);
            setEmpleadoSeleccionado(empleado);
            
            // Cerrar el modal de empleados y abrir el de tareas
            setShowListaEmpleadosAsignados(false);
            setShowTareasEmpleado(true);
            setMostrarTareasEstado(false);
            setEstadoSeleccionado(null);
        } catch (error) {
            console.error('Error al cargar tareas del empleado:', error);
            Swal.fire('Error', 'No se pudieron cargar las tareas del empleado', 'error');
        }
    };

    const seleccionarEstado = (estado) => {
        setEstadoSeleccionado(estado);
        setMostrarTareasEstado(true);
    };

    const volverAEstados = () => {
        setMostrarTareasEstado(false);
        setEstadoSeleccionado(null);
    };

    const cerrarTareasEmpleado = () => {
        setShowTareasEmpleado(false);
        setMostrarTareasEstado(false);
        setEstadoSeleccionado(null);
    };

    const handleSubmitNewTask = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            const response = await axiosInstance.post('/guardarTarea', {
                titulo: formData.get('titulo'),
                descripcion: formData.get('descripcion'),
                fecha_pactada: formData.get('fecha_pactada'),
                prioridad: formData.get('prioridad'),
                empleado: user.empleado,
                estado: formData.get('estado')
            });

            // Cerrar el modal primero
            setShowNewTaskModal(false);

            // Cargar todas las tareas nuevamente
            const tasksResponse = await axiosInstance.get(`/cargarTareas/${user.empleado}`);
            const tasks = tasksResponse.data.tareas;

            // Organizar las tareas en las columnas
            const newColumns = {
                'Pendiente': {
                    title: 'Pendiente',
                    items: tasks.filter(task => task.estado === 'Pendiente'),
                    iconComponent: 'FaClock',
                    color: '#f97316'
                },
                'En Proceso': {
                    title: 'En Proceso',
                    items: tasks.filter(task => task.estado === 'En Proceso'),
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
                onClick={() => abrirListaEmpleadosAsignados()}
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
                                        <option value="En Proceso">En Proceso</option>
                                        <option value="Completada">Completada</option>
                                    </select>
                                </div>
                                <div className="modal-actions">
                                    <button 
                                        type="button" 
                                        className="cancel-button-new-task"
                                        onClick={() => setShowNewTaskModal(false)}
                                    >
                                      <FaTimes /> Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="submit-button-new-task"
                                    >
                                        <FaSave /> Crear Tarea
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {showListaEmpleadosAsignados && (
                <div className="modal-overlay">
                <div className="lista-empleados-asignados-modal">
                    <div className="modal-header">
                        <h2>Lista de Empleados Asignados</h2>
                        <button 
                            className="close-button"
                            onClick={() => setShowListaEmpleadosAsignados(false)}
                        >
                            &times;
                        </button>
                    </div>
                    <div className="modal-content">
                        <div className="lista-empleados-asignados-container">
                           <table className='table-empleados-asignados'>
                            <thead className='table-header'> 
                                <tr>
                                    <th>Nombre</th>
                                    <th>Opciones</th>
                                </tr>
                            </thead>
                            <tbody className='table-body'>
                                {user.empleados_asignados.map(empleado => (
                                    <tr className='table-row' key={empleado.id}>
                                        <td style={{textTransform: 'capitalize'}}>{empleado.nombre}</td>
                                        <td>
                                                <FaEye onClick={() => verTareas(empleado.id)} className='btn-ver-tareas' style={{fontSize: '2rem', padding: '0'}} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                           </table>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {showTareasEmpleado && (
                <div className="modal-overlay">
                    <div className="tareas-empleado-modal">
                        <div className="modal-header">
                            <h2>Tareas de {empleadoSeleccionado?.nombre}</h2>
                            <button 
                                className="close-button"
                                onClick={cerrarTareasEmpleado}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="modal-content">
                            <div className="tareas-empleado-container">
                                {!mostrarTareasEstado ? (
                                    // Vista de estados (nivel 1)
                                    <div className="estados-cards">
                                        {Object.entries(columns).map(([estado, column]) => (
                                            
                                            <div 
                                                key={estado} 
                                                className="estado-card"
                                                onClick={() => seleccionarEstado(estado)}
                                                style={{ borderTop: `4px solid ${column.color}` }}
                                            >
                                                <div className="estado-card-header">
                                                    {renderIcon(column.iconComponent)}
                                                    <h3>{column.title}</h3>
                                                </div>
                                                <div className="estado-card-count">
                                                    <span>{tareasEmpleado.filter(task => task.estado === estado).length}</span>
                                                    <span>tareas</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    // Vista de tareas de un estado (nivel 2)
                                    <div className="tareas-estado-container">
                                        <button 
                                                className="back-button"
                                                onClick={volverAEstados}
                                            >
                                                &larr; Volver a estados
                                            </button>
                                        <div className="estado-tareas-header">
                                            
                                            <h3>Tareas {estadoSeleccionado}</h3>
                                        </div>
                                        <div className="tareas-list">
                                            {tareasEmpleado
                                                .filter(task => task.estado === estadoSeleccionado)
                                                .map(task => (
                                                    <div 
                                                        key={task.id} 
                                                        className="task-card"
                                                        onClick={() => handleTaskClick(task)}
                                                    >
                                                        <div className="task-card-header">
                                                            <h4 style={{textTransform: 'capitalize', marginBottom: '0.5rem'}}>{task.titulo}</h4>
                                                            {task.prioridad && (
                                                                <span className={`priority-badge ${task.prioridad.toLowerCase()}`}>
                                                                    {task.prioridad}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="task-description">{task.descripcion}</p>
                                                        <div className="task-dates">
                                                            {(task.estado === 'Pendiente' || task.estado === 'En Proceso') && task.fecha_pactada && (
                                                                <span className="date-badge due-date">
                                                                    <FaClock />
                                                                    Fecha límite: {new Date(task.fecha_pactada + 'T00:00:00').toLocaleDateString()}
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
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="kanban-board">
                    {Object.entries(columns).map(([columnId, column]) => (
                        <div key={columnId} className="kanban-column" data-status={column.title} >
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
                                                            {(task.estado === 'Pendiente' || task.estado === 'En Proceso') && task.fecha_pactada && (
                                                                <span className="date-badge due-date">
                                                                    <FaClock />
                                                                    Fecha límite: {new Date(task.fecha_pactada + 'T00:00:00').toLocaleDateString()}
                                                                </span>
                                                            )}
                                                            {task.estado === 'Completada' && task.fecha_entregada && (
                                                                <span className="date-badge completed-date">
                                                                    <FaCheck />
                                                                    Entregado: {new Date(task.fecha_entregada + 'T00:00:00').toLocaleDateString()}
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