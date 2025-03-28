import React, { useState, useRef } from 'react';
import { FaFileUpload, FaCheck, FaClock, FaSpinner, FaDownload, FaTrash, FaFile, FaImage } from 'react-icons/fa';
import axios from 'axios';
import Swal from 'sweetalert2';
import '../css/TaskDetailsModal.css';

const TaskDetailsModal = ({ task, onClose, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [currentStatus, setCurrentStatus] = useState(task.estado);
    const [isChangingStatus, setIsChangingStatus] = useState(false);
    const [previewFiles, setPreviewFiles] = useState([]);
    const fileInputRef = useRef(null);
    const [evidencias, setEvidencias] = useState(task.evidencias || []);

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
            const response = await axios.post('/parametros/subirEvidencias', formData, {
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
            const nuevasEvidencias = response.data.map(evidencia => ({
                id: evidencia.id,
                nombre: evidencia.nombre_original,
                ruta: evidencia.ruta,
                tipo: evidencia.tipo,
                created_at: new Date().toISOString()
            }));



            setEvidencias(prevEvidencias => [...prevEvidencias, ...nuevasEvidencias]);

            // Actualizar estado de la tarea y evidencias
            await axios.put(`/parametros/actualizarEstadoTarea/${task.id}`, {
                estado: currentStatus,
                evidencias: nuevasEvidencias
            });
            
            onUpdate();
            Swal.fire('¡Éxito!', 'Evidencias subidas correctamente', 'success');
        } catch (error) {
            console.error(error);
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

                console.log(result)
                // Si se presiona "Cancelar"
                if (result.isDenied) {
                    setIsChangingStatus(false);
                    return;
                }

                // Si se presiona "No, solo completar"
                if (result.isDismissed) {
                    await axios.put(`/parametros/actualizarEstadoTarea/${task.id}`, {
                        estado: newStatus
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
                                const response = await axios.post('/parametros/subirEvidencias', formData, {
                                    headers: {
                                        'Content-Type': 'multipart/form-data'
                                    }
                                    
                                });
                               
                                // Actualizar evidencias con las nuevas
                                const nuevasEvidencias = response.data.map(evidencia => ({
                                    id: evidencia.id,
                                    nombre: evidencia.nombre_original,
                                    evidencia: evidencia.ruta,
                                    tipo: evidencia.tipo,
                                    created_at: new Date().toISOString()
                                }));

                                setEvidencias(prev => [...prev, ...nuevasEvidencias]);

                                // Actualizar estado de la tarea y evidencias
                                await axios.put(`/parametros/actualizarEstadoTarea/${task.id}`, {
                                    estado: newStatus,
                                    evidencias: evidencias
                                });

                                return true;
                            } catch (error) {
                                Swal.showValidationMessage(
                                    `Error al subir archivos: ${error.message}`
                                );
                                return false;
                            } finally {
                                setLoading(false);
                            }
                        }
                    });

                    if (uploadConfirmed) {
                        setCurrentStatus(newStatus);
                        onUpdate();
                        Swal.fire('¡Éxito!', 'Tarea completada y evidencias subidas correctamente', 'success');
                    }
                }
            } else {
                // Cambio a otros estados
                await axios.put(`/parametros/actualizarEstadoTarea/${task.id}`, {
                    estado: newStatus
                });
                setCurrentStatus(newStatus);
                onUpdate();
                Swal.fire('¡Éxito!', 'Estado actualizado correctamente', 'success');
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Error al actualizar el estado', 'error');
        } finally {
            setIsChangingStatus(false);
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
                await axios.delete(`/parametros/eliminarEvidencia/${evidenceId}`);
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

    return (
        <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && onClose()}>
            <div className="task-details-modal">
                <div className="modal-header">
                    <h2>Detalles de la Tarea</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-body">
                    {/* Panel izquierdo: Información de la tarea */}
                    <div className="task-info-panel">
                        <div className="task-header">
                            <h3>{task.titulo}</h3>
                            <span className={`priority-badge ${task.prioridad.toLowerCase()}`}>
                                {task.prioridad}
                            </span>
                        </div>

                        <div className="task-description">
                            <p>{task.descripcion}</p>
                        </div>

                        <div className="task-dates">
                            <div className="date-item">
                                <FaClock />
                                <span>Fecha límite: {new Date(task.fecha_pactada).toLocaleDateString()}</span>
                            </div>
                            {task.fecha_entregada && (
                                <div className="date-item">
                                    <FaCheck />
                                    <span>Entregado: {new Date(task.fecha_entregada).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>

                        <div className="status-control">
                            <h4>Cambiar estado de la tarea</h4>
                            <div className="status-buttons">
                                <button 
                                    className={`status-button pending ${currentStatus === 'Pendiente' ? 'active' : ''}`}
                                    onClick={() => handleStatusChange('Pendiente')}
                                    disabled={isChangingStatus || currentStatus === 'Pendiente'}
                                >
                                    <FaClock /> Pendiente
                                </button>
                                <button 
                                    className={`status-button in-progress ${currentStatus === 'En progreso' ? 'active' : ''}`}
                                    onClick={() => handleStatusChange('En progreso')}
                                    disabled={isChangingStatus || currentStatus === 'En progreso'}
                                >
                                    <FaSpinner /> En Progreso
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
                    </div>

                    {/* Panel derecho: Evidencias */}
                    <div className="evidence-panel">
                        <h4>Evidencias de la tarea</h4>
                        
                        {/* Sección de carga de archivos */}
                        <div className="evidence-upload">
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
                            {evidencias.map(evidencia => (
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
                                            <span className="evidence-date">
                                                {new Date(evidencia.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="evidence-actions">
                                        <a 
                                            href={`/storage/${evidencia.evidencia}`} 
                                            target="_blank" 
                                            className="action-button download"
                                            title="Descargar"
                                        >
                                            <FaDownload />
                                        </a>
                                        <button
                                            className="action-button delete"
                                            onClick={() => handleDeleteEvidence(evidencia.id)}
                                            title="Eliminar"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskDetailsModal; 