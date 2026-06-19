import React, { useState, useEffect } from "react";
import { FaTimes, FaSearch, FaPlus, FaEdit, FaTrash, FaSave, FaFileAlt, FaArrowLeft } from "react-icons/fa";
import axiosInstance from '../axiosConfig';
import Swal from "sweetalert2";
import Paginador from './Paginador';

const ProjectModal = ({ isOpen, onClose }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [proyectos, setProyectos] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [showAddForm, setShowAddForm] = useState(false);
    const [empresas, setEmpresas] = useState([]);

    const initialProjectState = {
        nombre: "",
        municipio: "",
        descripcion: "",
        empresa_id: "",
        empresa_nombre: "",
        estado: "Activo",
        accion: "guardar",
        fechaInicio: "",
        fechaFin: "",
        id: "",
    };
    // Calcular los proyectos a mostrar según la página actual
    const [itemsPerPage] = useState(5);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = proyectos.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(proyectos.length / itemsPerPage);
    const [newProject, setNewProject] = useState(initialProjectState);
    useEffect(() => {
        const delaySearch = setTimeout(() => {
            if (searchTerm.length > 0) {
                buscarProyectos();
            } else {
                cargarProyectos();
            }
        }, 500);
    }, [searchTerm]);

    useEffect(() => {
        cargarEmpresas();
    }, []);

    const cargarEmpresas = () => {
        axiosInstance.get('/parametros/cargarEmpresas').then((response) => {
            setEmpresas(response.data);
        });
    };

    const cargarProyectos = () => {
        setLoading(true);
        axiosInstance.get('/cargarProyectos').then((response) => {
            setProyectos(response.data);
            setLoading(false);
        });
    };

    const handleEditarProyecto = (proyecto) => {
        setShowAddForm(true);
        setNewProject({
            ...proyecto,
            accion: 'editar',
            id: proyecto.id,
            municipio: proyecto.municipio || "",
            fechaInicio: proyecto.fecha_inicio,
            fechaFin: proyecto.fecha_fin_estimada,
            empresa_id: proyecto.empresa_id,
            empresa_nombre: proyecto.empresa_nombre,
        });
    };

    const handleEliminarProyecto = (id) => {
        Swal.fire({
            icon: 'warning',
            title: 'Alerta!',
            text: '¿Estás seguro de querer eliminar el proyecto?',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Si, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                axiosInstance.delete(`/eliminarProyecto/${id}`).then((response) => {
                    cargarProyectos();
                });
            }
        });
    };
    const handleGuardarProyecto = () => {
        if (!newProject.nombre) {
            Swal.fire({
                icon: 'warning',
                title: 'Alerta!',
                text: 'El nombre del proyecto es requerido',
            });
            return;
        }
        if (!newProject.municipio) {
            Swal.fire({
                icon: 'warning',
                title: 'Alerta!',
                text: 'El municipio es requerido',
            });
            return;
        }
        axiosInstance.post('/proyectos/guardarProyecto', newProject)
        .then((response) => {
            Swal.fire({
                icon: 'success',
                title: 'Proyecto creado',
                text: 'El proyecto ha sido creado correctamente',
                showConfirmButton: false,
                timer: 1500
            });
            cargarProyectos();
            setShowAddForm(false);
            setNewProject(initialProjectState);
        })
        .catch((error) => {
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: 'Error al crear el proyecto',
                showConfirmButton: true
            });
        });
    
    };

    return (
        <div className="modal-overlay">
            <div className="modal-project">
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h2 style={{ margin: 0 }}>
                            <FaFileAlt style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />Gestión de Proyectos
                        </h2>
                    </div>
                    <button className="close-button" onClick={onClose}><FaTimes /></button>
                </div>
                <div className="dm-toolbar">
                    <input
                        type="text"
                        className="dm-search"
                        placeholder="Buscar por nombre"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button className="dm-btn dm-btn--primary" onClick={() => {
                        setNewProject(initialProjectState);
                        setShowAddForm(true);
                        setNewProject({ ...newProject, accion: 'guardar' });
                    }}>
                        <FaPlus /> Nuevo Proyecto
                    </button>
                </div>
                {/* cargar proyectos */}
                <div className="modal-content">
                    {loading ? (
                        <div className="loader"><div className="jimu-primary-loading" /></div>
                    ) : proyectos.length === 0 ? (
                        <div className="no-data-message"><p>No hay proyectos disponibles</p></div>
                    ) : (
                        <>
                            <table className="employee-table">
                                <thead>
                                    <tr>
                                        <th>Municipio</th>
                                        <th>Nombre del Proyecto</th>
                                        <th>Empresa</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentItems.map((proyecto) => (
                                        <tr key={proyecto.id}>
                                            <td style={{ whiteSpace: 'nowrap', fontWeight: '600' }}>{proyecto.municipio || '—'}</td>
                                            <td>{proyecto.nombre}</td>
                                            <td>{proyecto.empresa_nombre || '—'}</td>
                                            <td>
                                                <div className="dm-actions">
                                                    <button
                                                        title="Editar proyecto"
                                                        onClick={() => handleEditarProyecto(proyecto)}
                                                        className="dm-action-btn dm-action-btn--edit"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    <button
                                                        title="Eliminar empresa"
                                                        onClick={() => handleEliminarProyecto(proyecto.id)}
                                                        className="dm-action-btn dm-action-btn--delete"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {/* Paginación */}
                            <Paginador
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                            />
                        </>
                    )}
                </div>
            </div>

            {showAddForm && (
                <div className="modal-overlay">
                    <div className="form-modal-large">
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <button className="rdm-back-btn" onClick={() => setShowAddForm(false)}>
                                    <FaArrowLeft /> Proyectos
                                </button>
                                <h2 style={{ margin: 0 }}>
                                    {newProject.accion === 'editar'
                                        ? `Editar: ${newProject.nombre}`
                                        : 'Nuevo Proyecto'}
                                </h2>
                            </div>
                            <button className="close-button" onClick={onClose}><FaTimes /></button>
                        </div>
                        <form className="employee-form">
                            <div className="form-row">
                                <div className="form-group col-6">
                                    <label>Municipio:</label>
                                    <input type="text" className="form-control" value={newProject.municipio} onChange={(e) => setNewProject({ ...newProject, municipio: e.target.value })} placeholder="Ej: RIOHACHA" />
                                </div>
                                <div className="form-group col-6">
                                    <label>Empresa:</label>
                                    <select className="form-control" value={newProject.empresa} onChange={(e) => setNewProject({ ...newProject, empresa: e.target.value })}>
                                        <option value="">Selecciona una empresa</option>
                                        {empresas.map((empresa) => (
                                            <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group col-12">
                                    <label>Nombre del Proyecto:</label>
                                    <input type="text" className="form-control" value={newProject.nombre} onChange={(e) => setNewProject({ ...newProject, nombre: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group col-6">
                                    <label>Fecha de Inicio:</label>
                                    <input type="date" className="form-control" value={newProject.fechaInicio} onChange={(e) => setNewProject({ ...newProject, fechaInicio: e.target.value })} />
                                </div>
                                <div className="form-group col-6">
                                    <label>Fecha de Fin:</label>
                                    <input type="date" className="form-control" value={newProject.fechaFin} onChange={(e) => setNewProject({ ...newProject, fechaFin: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="button" className="cancel-button" onClick={() => setShowAddForm(false)}>
                                    <FaTimes /> {" "} Cancelar
                                </button>
                                <button type="button" onClick={handleGuardarProyecto} className="save-button">
                                    <FaSave /> {" "} Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectModal;