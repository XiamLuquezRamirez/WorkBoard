import React, { useState } from 'react';
import { FaFileUpload, FaSpinner, FaFilePdf, FaFileWord, FaFile, FaEye, FaTimes } from 'react-icons/fa';
import axios from 'axios';
import Swal from 'sweetalert2';

const NewTaskModal = ({ isOpen, onClose, onTaskCreated }) => {
    const [loading, setLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [evidencias, setEvidencias] = useState([]);
    const [nuevaTarea, setNuevaTarea] = useState({
        titulo: '',
        descripcion: '',
        fecha_pactada: '',
        estado: 'Pendiente',
        prioridad: 'Media'
    });

    const handleEvidenciaUpload = async (e) => {
        const files = Array.from(e.target.files);
        
        if (files.length === 0) return;

        setIsUploading(true);
        
        const formData = new FormData();
        files.forEach(file => {
            formData.append('evidencias[]', file);
        });
        
        try {
            const response = await axios.post('/parametros/subirEvidencias', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setEvidencias(prev => [...prev, ...response.data.map(evidencia => ({
                nombre: evidencia.nombre_original,
                ruta: evidencia.ruta,
                tipo: evidencia.tipo
            }))]);

            Swal.fire({
                title: 'Éxito',
                text: 'Archivos subidos correctamente',
                icon: 'success',
                confirmButtonText: 'OK',
            });

        } catch (error) {
            console.error('Error al subir evidencias:', error);
            Swal.fire({
                title: 'Error',
                text: 'Hubo un error al subir las evidencias',
                icon: 'error',
                confirmButtonText: 'OK',
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleGuardarTarea = async () => {
        if (!nuevaTarea.titulo.trim() || !nuevaTarea.fecha_pactada) {
            Swal.fire({
                title: 'Error',
                text: 'Por favor complete los campos requeridos',
                icon: 'error',
                confirmButtonText: 'OK',
            });
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post('/parametros/guardarTarea', {
                ...nuevaTarea,
                evidencias: evidencias
            });

            Swal.fire({
                title: 'Éxito',
                text: 'Tarea creada correctamente',
                icon: 'success',
                confirmButtonText: 'OK',
            });

            onTaskCreated(response.data);
            handleClose();
        } catch (error) {
            console.error('Error al guardar la tarea:', error);
            Swal.fire({
                title: 'Error',
                text: 'Hubo un error al crear la tarea',
                icon: 'error',
                confirmButtonText: 'OK',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setNuevaTarea({
            titulo: '',
            descripcion: '',
            fecha_pactada: '',
            estado: 'Pendiente',
            prioridad: 'Media'
        });
        setEvidencias([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="tareas-modal">
                <div className="modal-header">
                    <h2>Nueva Tarea</h2>
                    <button className="close-button" onClick={handleClose}>&times;</button>
                </div>
                
                <div className="modal-content">
                    <div className="tarea-form">
                        <div className="form-row">
                            <div className="form-group col-12">
                                <label>Título <span className="required">*</span></label>
                                <input
                                    type="text"
                                    value={nuevaTarea.titulo}
                                    onChange={(e) => setNuevaTarea({...nuevaTarea, titulo: e.target.value})}
                                    placeholder="Título de la tarea"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group col-4">
                                <label>Fecha Pactada <span className="required">*</span></label>
                                <input
                                    type="date"
                                    value={nuevaTarea.fecha_pactada}
                                    onChange={(e) => setNuevaTarea({...nuevaTarea, fecha_pactada: e.target.value})}
                                />
                            </div>
                            <div className="form-group col-4">
                                <label>Prioridad</label>
                                <select
                                    value={nuevaTarea.prioridad}
                                    onChange={(e) => setNuevaTarea({...nuevaTarea, prioridad: e.target.value})}
                                >
                                    <option value="Alta">Alta</option>
                                    <option value="Media">Media</option>
                                    <option value="Baja">Baja</option>
                                </select>
                            </div>
                            <div className="form-group col-4">
                                <label>Estado</label>
                                <select
                                    value={nuevaTarea.estado}
                                    onChange={(e) => setNuevaTarea({...nuevaTarea, estado: e.target.value})}
                                >
                                    <option value="Pendiente">Pendiente</option>
                                    <option value="En Progreso">En Progreso</option>
                                    <option value="Completada">Completada</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group col-12">
                                <label>Descripción</label>
                                <textarea
                                    value={nuevaTarea.descripcion}
                                    onChange={(e) => setNuevaTarea({...nuevaTarea, descripcion: e.target.value})}
                                    placeholder="Descripción detallada de la tarea"
                                    rows="3"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group col-12">
                                <label>Evidencias</label>
                                <div className="evidencia-upload-container">
                                    <input
                                        type="file"
                                        multiple
                                        onChange={handleEvidenciaUpload}
                                        className="evidencia-input"
                                        disabled={isUploading}
                                    />
                                    {isUploading && (
                                        <div className="upload-loader-overlay">
                                            <div className="upload-loader">
                                                <div className="spinner"></div>
                                                <span>Subiendo archivos...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="evidencias-preview">
                                    {evidencias.map((evidencia, index) => (
                                        <div key={index} className="evidencia-item">
                                            <div className="file-icon">
                                                {evidencia.tipo.includes('pdf') ? (
                                                    <FaFilePdf className="evidencia-icon pdf" />
                                                ) : evidencia.tipo.includes('word') ? (
                                                    <FaFileWord className="evidencia-icon word" />
                                                ) : (
                                                    <FaFile className="evidencia-icon" />
                                                )}
                                            </div>
                                            <span className="evidencia-nombre">{evidencia.nombre}</span>
                                            <div className="evidencia-actions">
                                                <button
                                                    type="button"
                                                    onClick={() => window.open(`/storage/${evidencia.ruta}`, '_blank')}
                                                    className="view-evidencia"
                                                >
                                                    <FaEye />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEvidencias(evidencias.filter((_, i) => i !== index))}
                                                    className="remove-evidencia"
                                                >
                                                    <FaTimes />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="form-actions">
                            <button 
                                className="cancel-button"
                                onClick={handleClose}
                            >
                                Cancelar
                            </button>
                            <button 
                                className="save-button"
                                onClick={handleGuardarTarea}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <FaSpinner className="spinner" /> 
                                        Guardando...
                                    </>
                                ) : (
                                    'Guardar Tarea'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewTaskModal; 