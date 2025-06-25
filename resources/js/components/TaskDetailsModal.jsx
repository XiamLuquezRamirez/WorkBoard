import React, { useState, useRef, useEffect } from 'react';
import {
    FaFileUpload, FaCheck,
    FaClock, FaSpinner, FaDownload,
    FaTrash, FaFile, FaImage, FaEdit, FaSave, FaEye, FaPause, FaComment
} from 'react-icons/fa';
import axios from 'axios';
import Swal from 'sweetalert2';
import FileViewerModal from './FileViewerModal';
import NotificationsModal from './NotificationsModal';
import config from '../config';
import { useUser } from './UserContext';
import axiosInstance from '../axiosConfig';
import { FaCircleCheck, FaCircle, FaCircleXmark } from 'react-icons/fa6';

const TaskDetailsModal = ({ task, onClose, onUpdate, showObservacionesButton }) => {
    const [loading, setLoading] = useState(false);
    const [currentStatus, setCurrentStatus] = useState(task.estado);
    const [isChangingStatus, setIsChangingStatus] = useState(false);
    const [previewFiles, setPreviewFiles] = useState([]);
    const [evidencias, setEvidencias] = useState(
        task.evidencias
            ? task.evidencias.map(evidencia => ({
                id: evidencia.id,
                nombre: evidencia.nombre,
                ruta: evidencia.evidencia,
                tipo: evidencia.tipo
            }))
            : []);
    const [observaciones, setObservaciones] = useState('');
    const [vistoBueno, setVistoBueno] = useState(task.visto_bueno === 1);
    const { user } = useUser();
    const fileInputRef = useRef(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
    const [isEditingTask, setIsEditingTask] = useState(false);
    const [isButtonObservaciones, setIsButtonObservaciones] = useState(false);
    const [aprobada, setAprobada] = useState(task.aprobada === 1);
    const [rechazada, setRechazada] = useState(task.rechazada === 1);
    const [isUploading, setIsUploading] = useState(false);
    const [pausada, setPausada] = useState(task.pausada === 1);
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const [chatReceptor, setChatReceptor] = useState(task.empleado);
    const [isIframeLoading, setIsIframeLoading] = useState(true);
    const [habilitarEdicion, setHabilitarEdicion] = useState(false);
    //fecha de tarea en fomao local
    const [editedTask, setEditedTask] = useState({
        titulo: task.titulo,
        descripcion: task.descripcion,
        prioridad: task.prioridad,
        fecha_pactada: task.fecha_pactada
    });
    //obtener el id del usuario logueado de variable de sesion laravel
    const chatUser = user.user_id_chat;

    console.log(chatUser);

    // Agregar useEffect para actualizar estados cuando task cambia
    useEffect(() => {
        setCurrentStatus(task.estado);
        setEvidencias(
            task.evidencias
                ? task.evidencias.map(evidencia => ({
                    id: evidencia.id,
                    nombre: evidencia.nombre,
                    ruta: evidencia.evidencia,
                    tipo: evidencia.tipo
                }))
                : []
        );
        setVistoBueno(task.visto_bueno === 1);
        setAprobada(task.aprobada === 1);
        setRechazada(task.rechazada === 1);
        setEditedTask({
            titulo: task.titulo,
            descripcion: task.descripcion,
            prioridad: task.prioridad,
            fecha_pactada: task.fecha_pactada
        });
    }, [task]);

    const currentUser = user;
    const isLider = currentUser?.lider === 'Si';
    const isOwnTask = currentUser?.empleado === task.empleado;
    const isAdmin = currentUser?.tipo_usuario === 'Administrador';

    console.log(`isOwnTask ${isOwnTask}`);

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);

        // Crear previsualizaciones
        const newPreviewFiles = files.map(file => ({
            file,
            name: file.name,
            preview: file.type.startsWith('image/')
                ? URL.createObjectURL(file)
                : null,
            type: file.type
        }));

        setPreviewFiles([...previewFiles, ...newPreviewFiles]);
    };

    const removeFile = (index) => {
        setPreviewFiles(prev => {
            const newFiles = [...prev];
            // Liberar URL si es una imagen
            if (newFiles[index].preview) {
                URL.revokeObjectURL(newFiles[index].preview);
            }
            newFiles.splice(index, 1);
            return newFiles;
        });
    };

    const handleUploadEvidences = async () => {
        if (previewFiles.length === 0) {
            Swal.fire('Error', 'Seleccione archivos para subir', 'error');
            return;
        }

        setLoading(true);

        const formData = new FormData();
        previewFiles.forEach(fileData => {
            formData.append('evidencias[]', fileData.file);
        });
        formData.append('tarea_id', task.id);

        try {
            const response = await axiosInstance.post('/subirEvidencias', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });


            // Limpiar previsualizaciones
            previewFiles.forEach(fileData => {
                if (fileData.preview) {
                    URL.revokeObjectURL(fileData.preview);
                }
            });

            setPreviewFiles([]);

            // Actualizar el estado de evidencias con las nuevas
            const nuevasEvidencias = response.data.evidencias.map(evidencia => ({
                id: evidencia.id,
                nombre: evidencia.nombre_original,
                ruta: evidencia.ruta,
                tipo: evidencia.tipo,
                created_at: new Date().toISOString()
            }));

            setEvidencias(prevEvidencias => [...prevEvidencias, ...nuevasEvidencias]);

            // Actualizar estado de la tarea y evidencias, agregar fecha de entrega formato aaaa-mm-dd
            await axiosInstance.put(`/actualizarEstadoTarea/${task.id}`, {
                estado: currentStatus,
                evidencias: nuevasEvidencias,
                fecha_entregada: new Date().toISOString().split('T')[0]
            });

            onUpdate();
            Swal.fire('¡Éxito!', 'Evidencias subidas correctamente', 'success');
        } catch (error) {
            Swal.fire('Error', 'Error al subir las evidencias', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (newStatus) => {
        if (newStatus === currentStatus) return;
        setIsChangingStatus(true);

        try {
            if (newStatus === 'Completada') {
                const result = await Swal.fire({
                    title: 'Completar tarea',
                    text: '¿Desea agregar evidencias antes de completar la tarea?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, agregar evidencias',
                    cancelButtonText: 'No, solo completar',
                    showDenyButton: true,
                    denyButtonText: 'Cancelar'
                });

                // Si se presiona "Cancelar"
                if (result.isDenied) {
                    setIsChangingStatus(false);
                    return;
                }
                const fechaEntrega = new Date().toISOString().split('T')[0];

                // Si se presiona "No, solo completar"
                if (result.isDismissed) {
                    //agregar fecha de entrega
                    await axiosInstance.put(`/actualizarEstadoTarea/${task.id}`, {
                        estado: newStatus,
                        fecha_entregada: fechaEntrega
                    });
                    setCurrentStatus(newStatus);
                    onUpdate();
                    Swal.fire('¡Éxito!', 'Estado actualizado correctamente', 'success');
                    return;
                }

                // Si se presiona "Sí, agregar evidencias"
                if (result.isConfirmed) {
                    const { value: uploadConfirmed } = await Swal.fire({
                        title: 'Subir evidencias',
                        html: `
                            <div class="swal-evidence-upload">
                                <div id="preview-container" class="preview-container"></div>
                                <input type="file" id="swal-evidence" multiple class="swal2-file">
                            </div>
                        `,
                        didOpen: () => {
                            const fileInput = document.getElementById('swal-evidence');
                            const previewContainer = document.getElementById('preview-container');
                            let selectedFiles = [];

                            fileInput.addEventListener('change', (e) => {
                                const files = Array.from(e.target.files);
                                selectedFiles = files;

                                previewContainer.innerHTML = files.map((file, index) => `
                                    <div class="preview-item">
                                        ${file.type.startsWith('image/')
                                        ? `<img src="${URL.createObjectURL(file)}" class="preview-image">`
                                        : `<div class="preview-file-icon">
                                                <i class="fas fa-file"></i>
                                            </div>`
                                    }
                                        <span class="preview-filename">${file.name}</span>
                                        <button type="button" class="preview-remove" data-index="${index}">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                `).join('');

                                document.querySelectorAll('.preview-remove').forEach(button => {
                                    button.addEventListener('click', (e) => {
                                        const index = e.currentTarget.dataset.index;
                                        selectedFiles.splice(index, 1);
                                        e.currentTarget.closest('.preview-item').remove();
                                    });
                                });
                            });
                        },
                        confirmButtonText: 'Subir y completar',
                        cancelButtonText: 'Cancelar',
                        showCancelButton: true,
                        preConfirm: async () => {
                            const fileInput = document.getElementById('swal-evidence');
                            const files = Array.from(fileInput.files);

                            if (files.length === 0) {
                                Swal.showValidationMessage('Seleccione al menos un archivo');
                                return false;
                            }

                            try {
                                setLoading(true);
                                const formData = new FormData();
                                files.forEach(file => {
                                    formData.append('evidencias[]', file);
                                });

                                // Subir evidencias
                                const response = await axiosInstance.post('/subirEvidencias', formData, {
                                    headers: {
                                        'Content-Type': 'multipart/form-data'
                                    }
                                });

                                // Actualizar estado de la tarea
                                await axiosInstance.put(`/actualizarEstadoTarea/${task.id}`, {
                                    estado: newStatus,
                                    evidencias: response.data,
                                    fecha_entregada: fechaEntrega
                                });

                                setCurrentStatus(newStatus);
                                onUpdate();
                                return true;
                            } catch (error) {
                                Swal.showValidationMessage('Error al subir las evidencias');
                                return false;
                            } finally {
                                setLoading(false);
                            }
                        }
                    });

                    if (uploadConfirmed) {
                        Swal.fire('¡Éxito!', 'Tarea completada con evidencias', 'success');
                    }
                }
            } else {
                // Cambio a otros estados
                await axiosInstance.put(`/actualizarEstadoTarea/${task.id}`, {
                    estado: newStatus
                });
                setCurrentStatus(newStatus);
                onUpdate();
                Swal.fire('¡Éxito!', 'Estado actualizado correctamente', 'success');
            }
        } catch (error) {
            Swal.fire('Error', 'Error al actualizar el estado', 'error');
        } finally {
            setIsChangingStatus(false);
        }
    };

    const handleDeleteTask = async () => {
        try {
            const result = await Swal.fire({
                title: '¿Está seguro?',
                text: 'Esta acción no se puede deshacer',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                await axiosInstance.delete(`/eliminarTarea/${task.id}`);
                onUpdate();
                onClose();
                Swal.fire('¡Eliminado!', 'La tarea ha sido eliminada', 'success');
            }
        } catch (error) {
            Swal.fire('Error', 'Error al eliminar la tarea', 'error');
        }
    };

    const handleDeleteEvidence = async (evidenceId) => {
        try {
            const result = await Swal.fire({
                title: '¿Está seguro?',
                text: 'Esta acción no se puede deshacer',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                await axiosInstance.delete(`/eliminarEvidencia/${evidenceId}`);
                // Actualizar el estado local eliminando la evidencia
                setEvidencias(prevEvidencias =>
                    prevEvidencias.filter(ev => ev.id !== evidenceId)
                );
                onUpdate();
                Swal.fire('¡Eliminado!', 'La evidencia ha sido eliminada', 'success');
            }
        } catch (error) {
            Swal.fire('Error', 'Error al eliminar la evidencia', 'error');
        }
    };

    const handleSaveObservations = async () => {

        if (observaciones.length === 0) {
            Swal.fire('Error', 'No se pueden guardar observaciones vacías', 'error');
            return;
        }

        try {
            setLoading(true);
            await axiosInstance.put(`/realizarObservaciones/${task.id}`, {
                observaciones,
                id_empleado: task.empleado,
                id_lider: currentUser.empleado
            });

            onUpdate();
            //limpiar campo de observaciones
            setObservaciones('');
            setIsButtonObservaciones(false);
            Swal.fire('¡Éxito!', 'Observaciones guardadas correctamente', 'success');
        } catch (error) {
            Swal.fire('Error', 'Error al guardar las observaciones', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVistoBueno = async (checked) => {

        setVistoBueno(checked);
        setIsUploading(true);
        try {
            await axiosInstance.put(`/vistoBueno/${task.id}`, {
                visto_bueno: checked
            });
            onUpdate();
            setIsUploading(false);
            Swal.fire('¡Éxito!', 'Visto bueno actualizado correctamente', 'success');
        } catch (error) {
            Swal.fire('Error', 'Error al actualizar el visto bueno', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleAprobada = async (checked) => {
        setAprobada(checked);
        setIsUploading(true);
        try {
            await axiosInstance.put(`/aprobarTarea/${task.id}`, {
                aprobada: checked
            });
            onUpdate();
            Swal.fire('¡Éxito!', 'Tarea aprobada correctamente', 'success');
        } catch (error) {
            Swal.fire('Error', 'Error al aprobar la tarea', 'error');
        } finally {
            setIsUploading(false);
        }
    };


    const handlePausada = async (checked) => {
        setPausada(checked);
        setIsUploading(true);
        try {
            await axiosInstance.put(`/pausarTarea/${task.id}`, {
                pausada: checked
            });
            onUpdate();
            Swal.fire('¡Éxito!', 'Tarea pausada correctamente', 'success');
        } catch (error) {
            Swal.fire('Error', 'Error al pausar la tarea', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRechazada = async (checked) => {
        setRechazada(checked);
        setIsUploading(true);
        try {
            await axiosInstance.put(`/rechazarTarea/${task.id}`, {
                rechazada: checked
            });
            onUpdate();
            Swal.fire('¡Éxito!', 'Tarea rechazada correctamente', 'success');
        } catch (error) {
            Swal.fire('Error', 'Error al rechazar la tarea', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileClick = (evidencia) => {

        setSelectedFile({
            ruta: evidencia.ruta,
            nombre: evidencia.nombre,
            tipo: evidencia.tipo
        });

    };

    const handleChat = async (observationId) => {
        //conmsultar en la base de datos de la tarea el id del empleado que realizo la observacion
        const observation = await axiosInstance.get(`/obtenerObservacion/${observationId}`);
        setChatReceptor(observation.data.idReceptor);
        setIsChatModalOpen(true);
    };

    const handleCloseFileViewer = () => {
        setSelectedFile(null);
    };

    const handleNotificationsClick = () => {
        setIsNotificationsModalOpen(true);
    };

    const handleEditTask = () => {
        setIsEditingTask(true);
    };

    const handleHabilitarEdicion = (checked) => {
        setHabilitarEdicion(checked);
    };

    const handleSaveTask = async () => {
        try {
            setLoading(true);
            await axiosInstance.put(`/actualizarTarea/${task.id}`, editedTask);
            setIsEditingTask(false);

            // Actualizar el objeto task con los nuevos valores
            task.titulo = editedTask.titulo;
            task.descripcion = editedTask.descripcion;
            task.prioridad = editedTask.prioridad;
            task.fecha_pactada = editedTask.fecha_pactada;

            onUpdate();

            setEditedTask({
                titulo: editedTask.titulo,
                descripcion: editedTask.descripcion,
                prioridad: editedTask.prioridad,
                fecha_pactada: editedTask.fecha_pactada
            });
            Swal.fire('¡Éxito!', 'Tarea actualizada correctamente', 'success');
        } catch (error) {
            Swal.fire('Error', 'Error al actualizar la tarea', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEdit = () => {
        setIsEditingTask(false);
        setEditedTask({
            titulo: task.titulo,
            descripcion: task.descripcion,
            prioridad: task.prioridad,
            fecha_pactada: task.fecha_pactada
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditedTask(prev => ({
            ...prev,
            [name]: value
        }));
    };

    return (
        <>
            {/* Modal principal de detalles */}
            {isUploading && (
                <div className="loader">
                    <div className="justify-content-center jimu-primary-loading"></div>
                </div>
            )}
            {task && (
                <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && onClose()}>
                    <div className="task-details-modal">
                        <div className="modal-header">
                            <h2 className='modal-title'>
                                Detalles de la Tarea
                                {/* Mostrar Aprobación */}
                                {aprobada ? (
                                    <FaCircleCheck color='green' title='Aprobada' style={{ marginRight: '0.5rem' }} />
                                ) : (
                                    <FaCircleCheck color='grey' title='No aprobada' style={{ marginRight: '0.5rem', opacity: 0.5 }} />
                                )}

                                {/* Mostrar Visto Bueno */}
                                {(currentStatus === 'Completada' && vistoBueno && !rechazada) ? (
                                    <FaEye color='green' title='Visto bueno' style={{ marginRight: '0.5rem' }} />
                                ) : (
                                    <FaEye color='grey' title='Pendiente de visto bueno' style={{ marginRight: '0.5rem', opacity: 0.5 }} />
                                )}

                                {/* Mostrar Rechazada */}
                                {(currentStatus === 'Completada' || currentStatus === 'En Proceso') && rechazada ? (
                                    <FaCircleXmark color='red' title='Rechazada' style={{ marginRight: '0.5rem' }} />
                                ) : null}

                                {/* Mostrar Pausada */}
                                {pausada ? (
                                    <FaPause color='orange' title='Pausada' style={{ marginRight: '0.5rem' }} />
                                ) : (
                                    <FaPause color='grey' title='No pausada' style={{ marginRight: '0.5rem', opacity: 0.5 }} />
                                )}
                            </h2>

                            <button className="close-button" onClick={onClose}>&times;</button>

                        </div>

                        <div className="modal-body">
                            {/* Panel izquierdo: Información de la tarea */}
                            <div className="task-info-panel">
                                <div className="edit-buttons">
                                    {!isAdmin ? (
                                        !isEditingTask ? (
                                            <>
                                                {(task.aprobada === 0 || task.aprobada === null) && (
                                                    <>
                                                        <button className="edit-button" onClick={handleEditTask}>
                                                            <FaEdit /> Editar Tarea
                                                        </button>

                                                        <button className="delete-button" onClick={handleDeleteTask}>
                                                            <FaTrash /> Eliminar Tarea
                                                        </button>
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <button className="save-button" onClick={handleSaveTask} disabled={loading}>
                                                    {loading ? <FaSpinner className="spinner" /> : <FaSave />} Guardar
                                                </button>
                                                <button className="cancel-button" onClick={handleCancelEdit}>
                                                    Cancelar
                                                </button>
                                            </>
                                        )
                                    ) : (
                                        !isEditingTask ? (

                                            <>
                                                {(task.aprobada === 1) && (
                                                    <>
                                                        <div className="habilitar-checkbox">
                                                            <label>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={habilitarEdicion}
                                                                    onChange={(e) => {
                                                                        handleHabilitarEdicion(e.target.checked);
                                                                    }} />
                                                                Habilitar edición empleado
                                                            </label>
                                                        </div>
                                                    </>
                                                )}

                                                <button className="edit-button" onClick={handleEditTask}>
                                                    <FaEdit /> Editar Tarea
                                                </button>

                                                <button className="delete-button" onClick={handleDeleteTask}>
                                                    <FaTrash /> Eliminar Tarea
                                                </button>
                                            </>


                                        ) : (
                                            <>
                                                <button className="save-button" onClick={handleSaveTask} disabled={loading}>
                                                    {loading ? <FaSpinner className="spinner" /> : <FaSave />} Guardar
                                                </button>
                                                <button className="cancel-button" onClick={handleCancelEdit}>
                                                    Cancelar
                                                </button>
                                            </>
                                        )
                                    )}

                                </div>
                                <div className="task-header">
                                    {isEditingTask ? (
                                        <div className="edit-form">
                                            <div className="form-group">
                                                <label htmlFor="titulo">Título:</label>
                                                <input
                                                    type="text"
                                                    id="titulo"
                                                    name="titulo"
                                                    value={editedTask.titulo}
                                                    onChange={handleInputChange}
                                                    className="form-control"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label htmlFor="descripcion">Descripción:</label>
                                                <textarea
                                                    id="descripcion"
                                                    name="descripcion"
                                                    value={editedTask.descripcion}
                                                    onChange={handleInputChange}
                                                    className="form-control"
                                                    rows="4"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label htmlFor="prioridad">Prioridad:</label>
                                                <select
                                                    id="prioridad"
                                                    name="prioridad"
                                                    value={editedTask.prioridad}
                                                    onChange={handleInputChange}
                                                    className="form-control"
                                                >
                                                    <option value="Alta">Alta</option>
                                                    <option value="Media">Media</option>
                                                    <option value="Baja">Baja</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label htmlFor="fecha_pactada">Fecha límite:</label>
                                                <input
                                                    type="date"
                                                    id="fecha_pactada"
                                                    name="fecha_pactada"
                                                    value={editedTask.fecha_pactada}
                                                    onChange={handleInputChange}
                                                    className="form-control"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <h3>{task.titulo}</h3>
                                            <div className="priority-container">
                                                <span className={`prioridad-badge ${task.prioridad.toLowerCase()}`}>
                                                    Prioridad: <strong>{task.prioridad}</strong>
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {!isEditingTask && (
                                    <div className="task-description">
                                        <p>{task.descripcion}</p>
                                    </div>
                                )}

                                <div className="task-dates">
                                    <div className="date-item">
                                        <FaClock />
                                        <span>  Fecha límite: {new Date(task.fecha_pactada + 'T00:00:00').toLocaleDateString()}</span>
                                    </div>
                                    {task.fecha_entregada && (
                                        <div className="date-item">
                                            <FaCheck />
                                            <span>Entregado: {new Date(task.fecha_entregada).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Solo mostrar controles de estado si es el dueño de la tarea */}
                                {isOwnTask && (
                                    <div className={"status-control"}>
                                        <h4>Cambiar estado de la tarea</h4>
                                        <div className={`status-buttons ${task.aprobada ? '' : 'disabled-status'}`}>
                                            <button
                                                className={`status-button pending ${currentStatus === 'Pendiente' ? 'active' : ''}`}
                                                onClick={() => handleStatusChange('Pendiente')}
                                                disabled={isChangingStatus || currentStatus === 'Pendiente'}
                                            >
                                                <FaClock /> Pendiente
                                            </button>
                                            <button
                                                className={`status-button in-progress ${currentStatus === 'En Proceso' ? 'active' : ''}`}
                                                onClick={() => handleStatusChange('En Proceso')}
                                                disabled={isChangingStatus || currentStatus === 'En Proceso'}
                                            >
                                                <FaSpinner /> En Proceso
                                            </button>
                                            <button
                                                className={`status-button completed ${currentStatus === 'Completada' ? 'active' : ''}`}
                                                onClick={() => handleStatusChange('Completada')}
                                                disabled={isChangingStatus || currentStatus === 'Completada'}
                                            >
                                                <FaCheck /> Completada
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Panel derecho: Evidencias */}
                            <div className="evidence-panel ">
                                <h4>Evidencias de la tarea</h4>

                                {/* Sección de carga de archivos - Solo para el dueño de la tarea */}
                                {isOwnTask && (
                                    <div key={task.id} className="evidence-upload">
                                        <input
                                            type="file"
                                            multiple
                                            onChange={handleFileChange}
                                            className="file-input"
                                            id="evidence-files"
                                            ref={fileInputRef}
                                        />
                                        <label htmlFor="evidence-files" className="upload-button">
                                            <FaFileUpload /> Seleccionar archivos
                                        </label>
                                    </div>
                                )}

                                {/* Preview de archivos seleccionados */}
                                {previewFiles.length > 0 && (
                                    <div className="preview-files">
                                        <h5>Archivos seleccionados</h5>
                                        <div className="preview-list">
                                            {previewFiles.map((fileData, index) => (
                                                <div key={index} className="preview-item">
                                                    <div className="preview-content">
                                                        {fileData.preview ? (
                                                            <img
                                                                src={fileData.preview}
                                                                alt={fileData.name}
                                                                className="preview-image"
                                                            />
                                                        ) : (
                                                            <div className="file-icon">
                                                                {fileData.type.includes('image') ? (
                                                                    <FaImage />
                                                                ) : (
                                                                    <FaFile />
                                                                )}
                                                            </div>
                                                        )}
                                                        <span className="preview-name">{fileData.name}</span>
                                                    </div>
                                                    <button
                                                        className="remove-file"
                                                        onClick={() => removeFile(index)}
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            className="upload-selected"
                                            onClick={handleUploadEvidences}
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <>
                                                    <FaSpinner className="spinner" />
                                                    Subiendo...
                                                </>
                                            ) : (
                                                <>
                                                    <FaFileUpload />
                                                    Subir evidencias
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* Lista de evidencias existentes */}
                                <div className="evidence-list">
                                    <h5>Evidencias cargadas</h5>
                                    {evidencias.length > 0 ? (
                                        evidencias.map(evidencia => (
                                            <div key={evidencia.id} className="evidence-item">
                                                <div className="evidence-info">
                                                    <div className="evidence-icon">
                                                        {evidencia.tipo?.includes('image') ? (
                                                            <FaImage />
                                                        ) : (
                                                            <FaFile />
                                                        )}
                                                    </div>
                                                    <div className="evidence-details">
                                                        <span className="evidence-name">{evidencia.nombre}</span>
                                                    </div>
                                                </div>
                                                <div className="evidence-actions">
                                                    <button
                                                        onClick={() => handleFileClick(evidencia)}
                                                        className="download-button"
                                                        title="Ver archivo"
                                                    >
                                                        <FaDownload />
                                                    </button>
                                                    {isOwnTask && (
                                                        <button
                                                            className="delete-button"
                                                            onClick={() => handleDeleteEvidence(evidencia.id)}
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="no-evidence">No hay evidencias cargadas</p>
                                    )}
                                </div>
                            </div>

                            {/* Panel de observaciones - Solo para líderes  o administradores */}
                            {((isLider && !isOwnTask) || isAdmin) && (
                                <>
                                    <div className='aprobacion-vistoBueno-container'>
                                        <div className='aprobacion-panel'>
                                            <h4>Aprobación de la tarea</h4>
                                            <div className="aprobacion-checkbox">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={aprobada}
                                                        onChange={(e) => {
                                                            handleAprobada(e.target.checked);
                                                        }} />
                                                    Aprobar tarea
                                                </label>
                                            </div>
                                        </div>

                                        {task.estado === 'Completada' && (
                                            <div className='vistoBueno-panel'>
                                                <h4>Revisión final</h4>
                                                <div className="revision-opciones">
                                                    <label>
                                                        <input
                                                            type="radio"
                                                            name="revision"
                                                            value="visto_bueno"
                                                            checked={vistoBueno && !rechazada}
                                                            onChange={() => {
                                                                handleVistoBueno(true);
                                                                handleRechazada(false);
                                                            }}
                                                        />
                                                        Dar visto bueno
                                                    </label>
                                                    <label>
                                                        <input
                                                            type="radio"
                                                            name="revision"
                                                            value="rechazada"
                                                            checked={rechazada}
                                                            onChange={() => {
                                                                handleVistoBueno(false);
                                                                handleRechazada(true);
                                                            }}
                                                        />
                                                        Rechazar tarea
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        <div className='aprobacion-panel'>
                                            <h4>Pausar tarea</h4>
                                            <div className="aprobacion-checkbox">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={pausada}
                                                        onChange={(e) => {
                                                            handlePausada(e.target.checked);
                                                        }} />
                                                    Tarea pausada
                                                </label>
                                            </div>
                                        </div>



                                    </div>
                                    <div className="observations-panel">
                                        <h4>Observaciones</h4>
                                        <textarea
                                            value={observaciones}
                                            onChange={(e) => {
                                                setObservaciones(e.target.value)
                                            }}
                                            onFocus={() => setIsButtonObservaciones(true)}
                                            placeholder="Escriba sus observaciones aquí..."
                                            rows="2"
                                            className="observations-textarea"
                                        />
                                        {isButtonObservaciones && (
                                            <button
                                                className="save-observations-button"
                                                onClick={handleSaveObservations}
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <>
                                                        <FaSpinner className="spinner" />
                                                        Guardando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <FaSave /> Guardar Observaciones
                                                    </>
                                                )}
                                            </button>
                                        )}



                                    </div>


                                </>
                            )}

                            <div className="observations-list">
                                <h4 className="observations-title">📝 Lista de Observaciones</h4>
                                {task.observaciones.length > 0 ? (
                                    task.observaciones.map((observacion) => {
                                        const fecha = new Date(observacion.fecha + 'T12:00:00'); // Evita cambio de zona horaria
                                        const fechaFormateada = fecha.toLocaleDateString();

                                        return (
                                            <div key={observacion.id} className="observation-card">
                                                <p className="observation-text">❝{observacion.observaciones}❞</p>
                                                <div className="observation-meta">
                                                    <span><strong>Creador:</strong> {observacion.creador}</span>
                                                    <span><strong>Fecha:</strong> {fechaFormateada}</span>
                                                </div>
                                                <div className="observation-actions">
                                                    <button className="chat-button" title="Chat" onClick={() => handleChat(observacion.id)}>
                                                        <FaComment />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="no-observations">✨ No hay observaciones registradas</p>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* Modal de chat */}
            {isChatModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-chat">
                        <div className="modal-header">
                            <h2 className='modal-title'>Chat</h2>
                            <button className="close-button" onClick={() => setIsChatModalOpen(false)}>
                                &times;
                            </button>
                        </div>
                        <div className="modal-content">
                            {isIframeLoading && (
                                <div className="loader">
                                    <div className="justify-content-center jimu-primary-loading"></div>
                                </div>
                            )}
                            <iframe
                                src={`https://ingeer.co/chat-empresarial/public/chat-redireccionado-workboard/${chatUser}/${chatReceptor}`}
                                title="Chat"
                                className="chat-iframe"
                                style={{ width: '100%', height: '100%' }}
                                onLoad={() => {
                                    setIsIframeLoading(false);
                                }}
                            ></iframe>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de notificaciones (independiente) */}
            {isNotificationsModalOpen && (
                <NotificationsModal
                    isOpen={isNotificationsModalOpen}
                    onClose={() => setIsNotificationsModalOpen(false)}
                    observaciones={task.observaciones || []}
                />
            )}

            {/* Modal de visualización de archivos (independiente) */}
            {selectedFile && (
                <div className="modal-overlay" style={{ zIndex: 1070 }}>
                    <FileViewerModal
                        isOpen={!!selectedFile}
                        onClose={handleCloseFileViewer}
                        fileUrl={selectedFile?.ruta}
                        fileName={selectedFile?.nombre}
                        fileType={selectedFile?.tipo}
                    />
                </div>
            )}
        </>
    );
};

export default TaskDetailsModal; 