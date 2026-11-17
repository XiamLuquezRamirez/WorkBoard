import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaThList, FaThListCheck, FaCamera, FaCheck, FaTimes, FaFile, FaEye, FaFilePdf, FaFileWord, FaSpinner, FaSave, FaUserTie, FaArrowLeft } from 'react-icons/fa';
import { FaListCheck } from 'react-icons/fa6';
import Swal from 'sweetalert2';
import FileViewerModal from './FileViewerModal';
import TaskDetailsModal from './TaskDetailsModal';
import axiosInstance from '../axiosConfig';
import Paginador from './Paginador';
import { getImageUrl, getAssetUrl } from '../utils/assetHelper';
import FormularioTarea from './tareas/FormularioTarea';



const EmployeeModal = ({ isOpen, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [empresas, setEmpresas] = useState([]);
    const [departamentos, setDepartamentos] = useState([]);
    const [cargos, setCargos] = useState([]);
    const defaultFotoPreview = getImageUrl('images/default.png');

    const initialEmpleadoState = {
        id: '',
        identificacion: '',
        nombres: '',
        apellidos: '',
        email: '',
        departamento: '',
        empresa: '',
        cargo: '',
        foto: null,
        fotoPreview: defaultFotoPreview,
        fecha_nacimiento: '',
        fecha_ingreso: '',
        tipo_contrato: '',
        estado: 'Activo',
        direccion: '',
        telefono: '',
        accion: 'guardar',
        lider: 'No'
    };

    const [newEmpleado, setNewEmpleado] = useState(initialEmpleadoState);
    const [empleados, setEmpleados] = useState([]);

    // Calcular los empleados a mostrar según la página actual
    const [currentPage, setCurrentPage] = useState(1);

    const [itemsPerPage] = useState(5);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = empleados.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(empleados.length / itemsPerPage);

    const [showFuncionesModal, setShowFuncionesModal] = useState(false);
    const [nuevaFuncion, setNuevaFuncion] = useState('');
    const [funcionesEmpleado, setFuncionesEmpleado] = useState([]);
    const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null);
    const [funcionEditando, setFuncionEditando] = useState(null);
    const [funcionEditada, setFuncionEditada] = useState('');

    const [showTareasModal, setShowTareasModal] = useState(false);
    const [tareasEmpleado, setTareasEmpleado] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [mostrarFormularioTarea, setMostrarFormularioTarea] = useState(false);
    const [proyectos, setProyectos] = useState([]);
    const [searchTarea, setSearchTarea] = useState('');
    const [editandoTarea, setEditandoTarea] = useState(null);
    const [evidencias, setEvidencias] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [showEvidenciasModal, setShowEvidenciasModal] = useState(false);
    const [tareaActual, setTareaActual] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const [showTaskDetails, setShowTaskDetails] = useState(false);

    const [activeTab, setActiveTab] = useState('funciones');
    const [nuevaActividad, setNuevaActividad] = useState('');
    const [actividadesEmpleado, setActividadesEmpleado] = useState([]);
    const [actividadEditando, setActividadEditando] = useState(null);
    const [actividadEditada, setActividadEditada] = useState('');

    useEffect(() => {
        const delaySearch = setTimeout(() => {
            if (searchTerm.length > 0) {
                buscarEmpleados();
            } else {
                cargarEmpleados();
            }
        }, 500);

        return () => clearTimeout(delaySearch);
    }, [searchTerm]);


    //cargar tareas
    useEffect(() => {
        const delaySearch = setTimeout(() => {
            if (searchTarea.length > 0) {
                buscarTareas();
            }
        }, 500);

        return () => clearTimeout(delaySearch);
    }, [searchTarea]);

    

    useEffect(() => {
        cargarEmpresas();
        cargarDepartamentos();
        cargarCargos();
        axiosInstance.get('/cargarProyectos').then(r => setProyectos(r.data)).catch(() => {});
    }, []);

    const buscarEmpleados = () => {
        setLoading(true);
        axiosInstance.post('/buscarEmpleados', {
            params: {
                search: searchTerm,
                filters: {
                    nombre: true,
                    cargo: true,
                    empresa: true
                }
            }
        })
            .then((response) => {
                setEmpleados(response.data);
                setLoading(false);
            })
    }

    const cargarEmpleados = () => {
        setLoading(true);
        axiosInstance.post('/cargarEmpleados')
            .then((response) => {

                setEmpleados(response.data);
                setLoading(false);
            })
            .catch((error) => {
                console.error('Error al cargar los empleados:', error);
            });
    };

    const buscarTareas = () => {
        axiosInstance.get(`/buscarTareas/${empleadoSeleccionado.id}`, {
            params: {
                search: searchTarea
            }
        })
            .then((response) => {
                setTareasEmpleado(response.data.tareas);
            })
            .catch((error) => {
                console.error('Error al cargar las tareas:', error);
            });
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewEmpleado(prev => ({
                    ...prev,
                    foto: reader.result,
                    fotoPreview: previewUrl
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const cargarEmpresas = () => {
        axiosInstance.get('/parametros/cargarEmpresas')
            .then((response) => {
                setEmpresas(response.data);
            })
            .catch((error) => {
                console.error('Error al cargar las empresas:', error);
            });
    };

    const cargarDepartamentos = () => {
        axiosInstance.get('/parametros/cargarDepartamentos')
            .then((response) => {
                setDepartamentos(response.data);
            });
    };

    const cargarCargos = () => {
        axiosInstance.get('/parametros/cargarCargos')
            .then((response) => {
                setCargos(response.data);
            });
    };

    //GUARDAR EMPLEADO
    const handleGuardarEmpleado = () => {
        axiosInstance
            .post('/guardarEmpleados', newEmpleado)
            .then((response) => {
                if (response.data.success) {
                    Swal.fire({
                        title: 'Empleado guardado correctamente',
                        icon: 'success',
                        confirmButtonText: 'OK',
                    });

                    setShowAddForm(false);
                    setNewEmpleado(initialEmpleadoState);
                    cargarEmpleados();
                } else {
                    throw new Error('Error al guardar el empleado');
                }
            })
            .catch((error) => {
                console.error('Error al guardar el empleado:', error);
                Swal.fire({
                    title: 'Error',
                    text: error?.response?.data?.error || 'Hubo un error al guardar el empleado',
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
            });
    };

    //EDITAR EMPLEADO
    const handleEditarEmpleado = (empleado) => {
        setNewEmpleado({
            ...empleado,
            fecha_nacimiento: empleado.fecha_nacimiento || '',
            fecha_ingreso: empleado.fecha_ingreso || '',
            tipo_contrato: empleado.tipo_contrato || '',
            lider: empleado.lider === 'Si' ? 'Si' : 'No',
            accion: 'editar',
            id: empleado.id
        });

        let foto = empleado.foto;
        if (foto) {
            setNewEmpleado(prev => ({
                ...prev,
                foto: foto,
                fotoPreview: foto
            }));
        }

        setShowAddForm(true);
    };

    //ELIMINAR EMPLEADO    
    const handleEliminarEmpleado = (id) => {
        Swal.fire({
            title: '¿Estás seguro?',
            text: 'No podrás revertir esto.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Si, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                axiosInstance.delete(`/eliminarEmpleado/${id}`)
                    .then((response) => {
                        Swal.fire({
                            title: 'Empleado eliminado correctamente',
                            icon: 'success',
                            confirmButtonText: 'OK',
                        });
                        cargarEmpleados();
                    })
                    .catch((error) => {
                        console.error('Error al eliminar el empleado:', error);
                    });
            }
        });
    };

    const handleVerFunciones = (empleado) => {
        setEmpleadoSeleccionado(empleado);

        // Cargar funciones
        axiosInstance.get(`/cargarFunciones/${empleado.id}`)
            .then((response) => {
                setFuncionesEmpleado(response.data);
            })
            .catch((error) => {
                console.error('Error al cargar las funciones:', error);
            });

        // Cargar actividades
        axiosInstance.get(`/cargarActividades/${empleado.id}`)
            .then((response) => {
                setActividadesEmpleado(response.data);
            })
            .catch((error) => {
                console.error('Error al cargar las actividades:', error);
            });

        setShowFuncionesModal(true);
    };

    const handleGuardarFuncion = () => {
        if (!nuevaFuncion.trim()) {
            Swal.fire({
                title: 'Error',
                text: 'Por favor ingrese una función',
                icon: 'error',
                confirmButtonText: 'OK',
            });
            return;
        }

        const data = {
            empleado: empleadoSeleccionado.id,
            funcion: nuevaFuncion
        };

        axiosInstance.post('/guardarFuncion', data)
            .then((response) => {
                if (response.data.funcion) {
                    setFuncionesEmpleado(prevFunciones => [...prevFunciones, response.data.funcion]);
                    setNuevaFuncion('');
                    Swal.fire({
                        title: 'Función agregada correctamente',
                        icon: 'success',
                        confirmButtonText: 'OK',
                    });
                }
            })
            .catch((error) => {
                console.error('Error al guardar la función:', error);
                Swal.fire({
                    title: 'Error',
                    text: 'Hubo un error al guardar la función',
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
            });
    };

    const handleEditarFuncion = (funcion) => {
        setFuncionEditando(funcion.id);
        setFuncionEditada(funcion.descripcion);
    };

    const handleGuardarEdicionFuncion = (id) => {
        if (!funcionEditada.trim()) {
            Swal.fire({
                title: 'Error',
                text: 'La función no puede estar vacía',
                icon: 'error',
                confirmButtonText: 'OK',
            });
            return;
        }

        const data = {
            id: id,
            empleado: empleadoSeleccionado,
            descripcion: funcionEditada
        };

        axiosInstance.put(`/actualizarFuncion/${id}`, data)
            .then((response) => {
                setFuncionesEmpleado(prevFunciones =>
                    prevFunciones.map(funcion =>
                        funcion.id === id ? { ...funcion, descripcion: funcionEditada } : funcion
                    )
                );
                setFuncionEditando(null);
                setFuncionEditada('');
                Swal.fire({
                    title: 'Función actualizada correctamente',
                    icon: 'success',
                    confirmButtonText: 'OK',
                });
            })
            .catch((error) => {
                console.error('Error al actualizar la función:', error);
                Swal.fire({
                    title: 'Error',
                    text: 'Hubo un error al actualizar la función',
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
            });
    };

    const handleEditarTarea = (tarea) => {
        setEditandoTarea(tarea);
        setMostrarFormularioTarea(true);
    };

    const cerrarFormularioTarea = () => {
        setMostrarFormularioTarea(false);
        setEditandoTarea(null);
    };

    const handleEliminarFuncion = (id) => {
        axiosInstance.delete(`/eliminarFuncion/${id}`)
            .then((response) => {
                Swal.fire({
                    title: 'Función eliminada correctamente',
                    icon: 'success',
                    confirmButtonText: 'OK',
                });
                setFuncionesEmpleado(prevFunciones => prevFunciones.filter(funcion => funcion.id !== id));
            })
            .catch((error) => {
                console.error('Error al eliminar la función:', error);
                Swal.fire({
                    title: 'Error',
                    text: 'Hubo un error al eliminar la función',
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
            });
    }

    const handleGuardarActividad = () => {
        if (!nuevaActividad.trim()) {
            Swal.fire({
                title: 'Error',
                text: 'Por favor ingrese una actividad',
                icon: 'error',
                confirmButtonText: 'OK',
            });
            return;
        }

        const data = {
            empleado: empleadoSeleccionado.id,
            actividad: nuevaActividad
        };

        axiosInstance.post('/guardarActividad', data)
            .then((response) => {
                if (response.data.actividad) {
           
                    setActividadesEmpleado(prevActividades => [...prevActividades, response.data.actividad]);
                    setNuevaActividad('');

                    Swal.fire({
                        title: 'Actividad agregada correctamente',
                        icon: 'success',
                        confirmButtonText: 'OK',
                    });


                }
            })
            .catch((error) => {
                console.error('Error al guardar la actividad:', error);
                Swal.fire({
                    title: 'Error',
                    text: 'Hubo un error al guardar la actividad',
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
            });
    };

    const handleEditarActividad = (actividad) => {
        setActividadEditando(actividad.id);
        setActividadEditada(actividad.descripcion);
    };

    const handleGuardarEdicionActividad = (id) => {
        if (!actividadEditada.trim()) {
            Swal.fire({
                title: 'Error',
                text: 'La actividad no puede estar vacía',
                icon: 'error',
                confirmButtonText: 'OK',
            });
            return;
        }

        const data = {
            id: id,
            empleado: empleadoSeleccionado,
            descripcion: actividadEditada
        };

        axiosInstance.put(`/actualizarActividad/${id}`, data)
            .then((response) => {
                setActividadesEmpleado(prevActividades =>
                    prevActividades.map(actividad =>
                        actividad.id === id ? { ...actividad, descripcion: actividadEditada } : actividad
                    )
                );
                setActividadEditando(null);
                setActividadEditada('');
                Swal.fire({
                    title: 'Actividad actualizada correctamente',
                    icon: 'success',
                    confirmButtonText: 'OK',
                });
            })
            .catch((error) => {
                console.error('Error al actualizar la actividad:', error);
                Swal.fire({
                    title: 'Error',
                    text: 'Hubo un error al actualizar la actividad',
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
            });
    };

    const handleEliminarActividad = (id) => {
        axiosInstance.delete(`/eliminarActividad/${id}`)
            .then((response) => {
                Swal.fire({
                    title: 'Actividad eliminada correctamente',
                    icon: 'success',
                    confirmButtonText: 'OK',
                });
                setActividadesEmpleado(prevActividades => prevActividades.filter(actividad => actividad.id !== id));
            })
            .catch((error) => {
                console.error('Error al eliminar la actividad:', error);
                Swal.fire({
                    title: 'Error',
                    text: 'Hubo un error al eliminar la actividad',
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
            });
    };

    const cargarTareas = (empleado) => {

        setEmpleadoSeleccionado(empleado);
        axiosInstance.get(`/cargarTareas/${empleado.id}`)
            .then((response) => {
                setTareasEmpleado(response.data.tareas);
                setShowTareasModal(true);
            })
            .catch((error) => {
                console.error('Error al cargar las tareas:', error);
            });
    };


    const handleEvidenciaUpload = async (e) => {
        const files = Array.from(e.target.files);

        if (files.length === 0) return;

        setIsUploading(true);

        const formData = new FormData();
        files.forEach(file => {
            formData.append('evidencias[]', file);
        });

        try {
            const response = await axiosInstance.post('/subirEvidencias', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            setEvidencias(prev => [...prev, ...response.data.evidencias.map(evidencia => ({
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

    const handleActualizarEstadoTarea = (tarea, nuevoEstado) => {
        // Completada ya no se elige: la tarea se cierra aceptando la entrega.
        actualizarEstadoTarea(tarea.id, nuevoEstado);
    };

    const actualizarEstadoTarea = (tareaId, nuevoEstado, evidencias = []) => {
        const data = {
            estado: nuevoEstado,
            fecha_entregada: nuevoEstado === 'Completada' ? tareaActual.fecha_entregada : null,
            evidencias: evidencias
        };
        //preguntar si exixte contro fecha de entrega
        if (nuevoEstado === 'Completada') {
       
            if (tareaActual.fecha_entregada === null ) {
                Swal.fire({
                    title: 'Error',
                    text: 'Debes seleccionar una fecha de entrega',
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
                return;
            }
        }
        axiosInstance.put(`/actualizarEstadoTarea/${tareaId}`, data)
            .then((response) => {
                setTareasEmpleado(tareasEmpleado.map(tarea =>
                    tarea.id === tareaId ? response.data : tarea
                ));
                if (nuevoEstado === 'Completada') {
                    setShowEvidenciasModal(false);
                    setShowTareasModal(false);
                    setEvidencias([]);
                    Swal.fire({
                        title: 'Tarea completada',
                        text: 'La tarea se ha marcado como completada correctamente',
                        icon: 'success',
                        confirmButtonText: 'OK',
                    });
                } else {
                    Swal.fire({
                        title: 'Tarea actualizada',
                        text: 'La tarea se ha actualizado correctamente',
                        icon: 'success',
                        confirmButtonText: 'OK',
                    });

                    setShowTareasModal(false);
                }
            })
            .catch((error) => {
                console.error('Error al actualizar el estado:', error);
                // Con criterios de aceptación, Completada se responde con un
                // 409 que explica cómo cerrarla: mejor mostrarlo que ocultarlo.
                Swal.fire({
                    title: error?.response?.data?.requiere_verificacion ? 'Requiere aceptación' : 'Error',
                    text: error?.response?.data?.error || 'Hubo un error al actualizar el estado de la tarea',
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
            });
    };


    const handleFileClick = (evidencia) => {

        setSelectedFile({
            ruta: evidencia.evidencia,
            nombre: evidencia.nombre,
            tipo: evidencia.tipo
        });

    };

    const handleCloseFileViewer = () => {
        setSelectedFile(null);
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-overlay">
                <div className="modal-employee">
                    <div className="modal-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <h2 style={{ margin: 0 }}>
                                <FaUserTie style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />Gestión de Empleados
                            </h2>
                        </div>
                        <button className="close-button" onClick={onClose}><FaTimes /></button>
                    </div>
                    <div className="dm-toolbar">
                        <input
                            type="text"
                            className="dm-search"
                            placeholder="Buscar empleado..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <button className="dm-btn dm-btn--primary"
                            onClick={() => {
                                setNewEmpleado(initialEmpleadoState);
                                setShowAddForm(true);
                            }}
                        >
                            <FaPlus /> Nuevo Empleado
                        </button>
                    </div>
                    <div className="modal-content" style={{
                        flex: 1,
                        width: '100%',
                        overflow: 'auto',
                        padding: '20px'
                    }}>
                        {loading ? (
                            <div className="loader">
                                <div className="justify-content-center jimu-primary-loading"></div>
                            </div>
                        ) : empleados.length === 0 ? (
                            <div className="no-data-message">
                                <p>No hay empleados disponibles</p>
                            </div>
                        ) : (
                            <>
                                <table className="employee-table" style={{
                                    width: '100%',
                                    tableLayout: 'fixed',
                                    borderCollapse: 'collapse'
                                }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '5%' }}>Foto</th>
                                            <th style={{ width: '25%' }}>Nombre</th>
                                            <th style={{ width: '12%' }}>Cargo</th>
                                            <th style={{ width: '20%' }}>Empresa</th>
                                            <th style={{ width: '23%' }}>Email</th>
                                            <th style={{ width: '15%' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentItems.map(empleado => (
                                            <tr key={empleado.id}>
                                                <td>
                                                    <img
                                                        src={empleado.foto}
                                                        alt={empleado.nombre}
                                                        className="employee-mini-photo"
                                                    />
                                                </td>
                                                <td style={{ textTransform: 'capitalize' }}>{empleado.nombres} {empleado.apellidos}</td>
                                                <td>{empleado.nombre_cargo}</td>
                                                <td>{empleado.nombre_empresa}</td>
                                                <td>{empleado.email}</td>
                                                <td>
                                                    <div className="dm-actions">
                                                        <button title="Ver tareas" onClick={() => cargarTareas(empleado)} className="dm-action-btn dm-action-btn--view">
                                                            <FaListCheck />
                                                        </button>
                                                        <button title="Ver funciones y Actividades" onClick={() => handleVerFunciones(empleado)} className="dm-action-btn dm-action-btn--view">
                                                            <FaThList />
                                                        </button>
                                                        <button title="Editar empleado" onClick={() => handleEditarEmpleado(empleado)} className="dm-action-btn dm-action-btn--edit">
                                                            <FaEdit />
                                                        </button>
                                                        <button title="Eliminar empleado" onClick={() => handleEliminarEmpleado(empleado.id)} className="dm-action-btn dm-action-btn--delete">
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <Paginador
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>
            {showAddForm && (
                <div className="modal-overlay">
                    <div className="form-modal-large">
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <button className="rdm-back-btn" onClick={() => setShowAddForm(false)}>
                                    <FaArrowLeft /> Empleados
                                </button>
                                <h2 style={{ margin: 0 }}>
                                    {newEmpleado.accion === 'editar'
                                        ? `Editar: ${newEmpleado.nombres} ${newEmpleado.apellidos}`
                                        : 'Nuevo Empleado'}
                                </h2>
                            </div>
                            <button className="close-button" onClick={onClose}><FaTimes /></button>
                        </div>
                        <form className="employee-form">
                            <div className="form-group col-12">

                                <div className="foto-upload-container">
                                    <div className="foto-preview">
                                        {newEmpleado.fotoPreview ? (
                                            <>
                                                <img
                                                    src={newEmpleado.fotoPreview}
                                                    alt="Preview"
                                                    className="avatar-preview"
                                                />
                                                <button
                                                    type="button"
                                                    className="change-photo-btn"
                                                    onClick={() => document.getElementById('foto-input').click()}
                                                >
                                                    Cambiar
                                                </button>
                                            </>
                                        ) : (
                                            <div
                                                className="upload-placeholder"
                                                onClick={() => document.getElementById('foto-input').click()}
                                            >
                                                <FaCamera className="camera-icon" />
                                                <span>Subir foto</span>
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        id="foto-input"
                                        type="file"
                                        accept="image/*"
                                        className="file-input hidden"
                                        onChange={handleImageChange}
                                    />
                                </div>
                            </div>
                            <div className="form-row">

                                <div className="form-group col-4">
                                    <label>Identificación</label>
                                    <input type="text"
                                        onChange={(e) => setNewEmpleado({ ...newEmpleado, identificacion: e.target.value })}
                                        value={newEmpleado.identificacion}
                                        className="form-control"
                                        name="identificacion"
                                        id='identificacion'
                                    />
                                </div>
                                <div className="form-group col-4">
                                    <label>Nombres</label>
                                    <input type="text"
                                        onChange={(e) => setNewEmpleado({ ...newEmpleado, nombres: e.target.value })}
                                        value={newEmpleado.nombres}
                                        className="form-control"
                                        name="nombres"
                                        id='nombres'
                                    />
                                </div>
                                <div className="form-group col-4">
                                    <label>Apellidos</label>
                                    <input type="text"
                                        onChange={(e) => setNewEmpleado({ ...newEmpleado, apellidos: e.target.value })}
                                        value={newEmpleado.apellidos}
                                        className="form-control"
                                        name="apellidos"
                                        id='apellidos'
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group col-3">
                                    <label>F. Nacimiento</label>
                                    <input type="date"
                                        onChange={(e) => setNewEmpleado({ ...newEmpleado, fecha_nacimiento: e.target.value })}
                                        value={newEmpleado.fecha_nacimiento}
                                        className="form-control"
                                        name="fecha_nacimiento"
                                        id='fecha_nacimiento'
                                    />
                                </div>
                                <div className="form-group col-4">
                                    <label>Email</label>
                                    <input type="email"
                                        onChange={(e) => setNewEmpleado({ ...newEmpleado, email: e.target.value })}
                                        value={newEmpleado.email}
                                        className="form-control"
                                        name="email"
                                        id='email'
                                    />
                                </div>
                                <div className="form-group col-3">
                                    <label>Teléfono</label>
                                    <input type="tel"
                                        onChange={(e) => setNewEmpleado({ ...newEmpleado, telefono: e.target.value })}
                                        value={newEmpleado.telefono}
                                        className="form-control"
                                        name="telefono"
                                        id='telefono'
                                    />
                                </div>
                                <div className="form-group col-4">
                                    <label>Dirección</label>
                                    <input
                                        type="text"
                                        placeholder="Dirección completa"
                                        value={newEmpleado.direccion || ''}
                                        onChange={(e) => setNewEmpleado(prev => ({
                                            ...prev,
                                            direccion: e.target.value
                                        }))}
                                    />
                                </div>

                            </div>

                            <div className="form-row">
                                <div className="form-group col-4">
                                    <label>Departamento</label>
                                    <select onChange={(e) => setNewEmpleado({ ...newEmpleado, departamento: e.target.value })}
                                        value={newEmpleado.departamento}
                                        className="form-control"
                                        name="departamento"
                                        id='departamento'
                                    >

                                        <option value="">Seleccionar departamento</option>
                                        {departamentos.map(departamento => (
                                            <option key={departamento.id} value={departamento.id}>{departamento.nombre}</option>
                                        ))}

                                    </select>
                                </div>
                                <div className="form-group col-4">
                                    <label>Cargo</label>
                                    <select onChange={(e) => setNewEmpleado({ ...newEmpleado, cargo: e.target.value })}
                                        value={newEmpleado.cargo}
                                        className="form-control"
                                        name="cargo"
                                        id='cargo'
                                    >
                                        <option value="">Seleccionar cargo</option>
                                        {cargos.map(cargo => (
                                            <option key={cargo.id} value={cargo.id}>{cargo.nombre}</option>
                                        ))}

                                    </select>
                                </div>
                                <div className="form-group col-4">
                                    <label>Empresa</label>
                                    <select onChange={(e) => setNewEmpleado({ ...newEmpleado, empresa: e.target.value })}
                                        value={newEmpleado.empresa}
                                        className="form-control"
                                        name="empresa"
                                        id='empresa'
                                    >
                                        <option value="">Seleccionar empresa</option>
                                        {empresas.map(empresa => (
                                            <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group col-3">
                                    <label>Fecha de Ingreso</label>
                                    <input type="date"
                                        onChange={(e) => setNewEmpleado({ ...newEmpleado, fecha_ingreso: e.target.value })}
                                        value={newEmpleado.fecha_ingreso}
                                        className="form-control"
                                        name="fecha_ingreso"
                                        id='fecha_ingreso'
                                    />
                                </div>
                                <div className="form-group col-3">
                                    <label>Tipo de Contrato</label>
                                    <select onChange={(e) => setNewEmpleado({ ...newEmpleado, tipo_contrato: e.target.value })}
                                        value={newEmpleado.tipo_contrato}
                                        className="form-control"
                                        name="tipo_contrato"
                                        id='tipo_contrato'
                                    >
                                        <option value="">Seleccionar tipo</option>
                                        <option value="indefinido">Indefinido</option>
                                        <option value="fijo">Término Fijo</option>
                                        <option value="servicios">Prestación de Servicios</option>
                                    </select>
                                </div>
                                <div className="form-group col-2">
                                    <label>Estado</label>
                                    <select onChange={(e) => setNewEmpleado({ ...newEmpleado, estado: e.target.value })}
                                        value={newEmpleado.estado}
                                        className="form-control"
                                        name="estado"
                                        id='estado'
                                    >
                                        <option value="Activo">Activo</option>
                                        <option value="Inactivo">Inactivo</option>
                                    </select>
                                </div>
                            </div>

                            {/* Si es líder se decide aquí, en su ficha; antes se
                                confundía con «Líder de seguimiento» del modal de
                                usuarios. Quien lidera un departamento es líder por
                                esa asignación y se gestiona en Departamentos. */}
                            <div className="form-row">
                                <div className="form-group col-4">
                                    <label>¿Es líder?</label>
                                    <select
                                        onChange={(e) => setNewEmpleado({ ...newEmpleado, lider: e.target.value })}
                                        value={newEmpleado.lider === 'Si' ? 'Si' : 'No'}
                                        className="form-control"
                                        name="lider"
                                        id="lider"
                                        disabled={!!newEmpleado.departamentos_liderados}
                                    >
                                        <option value="No">No</option>
                                        <option value="Si">Sí</option>
                                    </select>
                                </div>
                                <div className="form-group col-8">
                                    <p className="form-hint" style={{ margin: '1.9rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                        {newEmpleado.departamentos_liderados
                                            ? <>Lidera <strong>{newEmpleado.departamentos_liderados}</strong>. Para cambiarlo, asigna otro líder en Departamentos.</>
                                            : 'Un líder ve el tablero y el espacio de su equipo y supervisa sus tareas.'}
                                    </p>
                                </div>
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="cancel-button"
                                    onClick={() => setShowAddForm(false)}
                                >
                                    <FaTimes /> {' '} Cancelar
                                </button>
                                <button type="button" onClick={handleGuardarEmpleado} className="save-button">
                                    <FaSave /> {' '} Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showFuncionesModal && (
                <div className="modal-overlay">
                    <div className="funciones-modal">
                        <div className="modal-header">
                            <h2>Funciones y Actividades del Empleado</h2>
                            <button
                                className="close-button"
                                onClick={() => setShowFuncionesModal(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className='tab-container-funciones'>
                            <div
                                className={`tab-item ${activeTab === 'funciones' ? 'active' : ''}`}
                                onClick={() => setActiveTab('funciones')}
                            >
                                <h3>Funciones</h3>
                            </div>
                            <div
                                className={`tab-item ${activeTab === 'actividades' ? 'active' : ''}`}
                                onClick={() => setActiveTab('actividades')}
                            >
                                <h3>Actividades</h3>
                            </div>
                        </div>

                        <div className="funciones-content">
                            {activeTab === 'funciones' ? (
                                <>
                                    <div className="nueva-funcion">
                                        <input
                                            type="text"
                                            placeholder="Nueva función..."
                                            value={nuevaFuncion}
                                            onChange={(e) => setNuevaFuncion(e.target.value)}
                                            className="funcion-input"
                                        />
                                        <button
                                            className="add-funcion-button"
                                            onClick={handleGuardarFuncion}
                                        >
                                            <FaPlus /> Agregar
                                        </button>
                                    </div>
                                    <div className="funciones-list">
                                        {funcionesEmpleado && funcionesEmpleado.length > 0 ? (
                                            funcionesEmpleado.map((funcion) => (
                                                <div key={`funcion-${funcion.id}`} className="funcion-item">
                                                    {funcionEditando === funcion.id ? (
                                                        <div className="funcion-edit-container">
                                                            <input
                                                                type="text"
                                                                value={funcionEditada}
                                                                onChange={(e) => setFuncionEditada(e.target.value)}
                                                                className="funcion-edit-input"
                                                                autoFocus
                                                            />
                                                            <div className="funcion-edit-buttons">
                                                                <button
                                                                    className="save-edit-button"
                                                                    onClick={() => handleGuardarEdicionFuncion(funcion.id)}
                                                                >
                                                                    <FaCheck />
                                                                </button>
                                                                <button
                                                                    className="cancel-edit-button"
                                                                    onClick={() => {
                                                                        setFuncionEditando(null);
                                                                        setFuncionEditada('');
                                                                    }}
                                                                >
                                                                    <FaTimes />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <span>{funcion.descripcion}</span>
                                                            <div className="funcion-buttons">
                                                                <button
                                                                    className="edit-funcion-button"
                                                                    onClick={() => handleEditarFuncion(funcion)}
                                                                >
                                                                    <FaEdit />
                                                                </button>
                                                                <button
                                                                    className="delete-funcion-button"
                                                                    onClick={() => handleEliminarFuncion(funcion.id)}
                                                                >
                                                                    <FaTrash />
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="no-funciones">
                                                No hay funciones registradas
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="nueva-funcion">
                                        <input
                                            type="text"
                                            placeholder="Nueva actividad..."
                                            value={nuevaActividad}
                                            onChange={(e) => setNuevaActividad(e.target.value)}
                                            className="funcion-input"
                                        />
                                        <button
                                            className="add-funcion-button"
                                            onClick={handleGuardarActividad}
                                        >
                                            <FaPlus /> Agregar
                                        </button>
                                    </div>
                                    <div className="funciones-list">
                                        {actividadesEmpleado && actividadesEmpleado.length > 0 ? (
                                            actividadesEmpleado.map((actividad) => (
                                                <div key={`actividad-${actividad.id}`} className="funcion-item">
                                                    {actividadEditando === actividad.id ? (
                                                        <div className="funcion-edit-container">
                                                            <input
                                                                type="text"
                                                                value={actividadEditada}
                                                                onChange={(e) => setActividadEditada(e.target.value)}
                                                                className="funcion-edit-input"
                                                                autoFocus
                                                            />
                                                            <div className="funcion-edit-buttons">
                                                                <button
                                                                    className="save-edit-button"
                                                                    onClick={() => handleGuardarEdicionActividad(actividad.id)}
                                                                >
                                                                    <FaCheck />
                                                                </button>
                                                                <button
                                                                    className="cancel-edit-button"
                                                                    onClick={() => {
                                                                        setActividadEditando(null);
                                                                        setActividadEditada('');
                                                                    }}
                                                                >
                                                                    <FaTimes />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <span>{actividad.descripcion}</span>
                                                            <div className="funcion-buttons">
                                                                <button
                                                                    className="edit-funcion-button"
                                                                    onClick={() => handleEditarActividad(actividad)}
                                                                >
                                                                    <FaEdit />
                                                                </button>
                                                                <button
                                                                    className="delete-funcion-button"
                                                                    onClick={() => handleEliminarActividad(actividad.id)}
                                                                >
                                                                    <FaTrash />
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="no-funciones">
                                                No hay actividades registradas
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showTareasModal && (
                <div className="modal-overlay">
                    {isSaving && (
                        <div className="loader">
                            <div className="justify-content-center jimu-primary-loading"></div>
                        </div>
                    )}
                    <div className={`tareas-modal${mostrarFormularioTarea ? ' ft-modal-ancho' : ''}`}>
                        <div className="modal-header">
                            <h2>
                                {mostrarFormularioTarea ? (editandoTarea ? 'Editar Tarea' : 'Nueva Tarea') :
                                    `TAREAS DE ${empleadoSeleccionado.nombres} ${empleadoSeleccionado.apellidos}`}
                            </h2>
                            <div className="modal-header-actions">

                                <button
                                    className="close-button"
                                    onClick={() => {
                                        setShowTareasModal(false);
                                        cerrarFormularioTarea();
                                    }}
                                >
                                    &times;
                                </button>
                            </div>
                        </div>
                        {!mostrarFormularioTarea && (
                            <div className="dm-toolbar">
                                <input
                                    type="text"
                                    className="dm-search"
                                    placeholder="Buscar por título, descripción, estado o prioridad"
                                    value={searchTarea}
                                    onChange={(e) => setSearchTarea(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') buscarTareas(); }}
                                    onBlur={buscarTareas}
                                />
                                <button
                                    className="dm-btn dm-btn--primary"
                                    onClick={() => { setEditandoTarea(null); setMostrarFormularioTarea(true); }}
                                >
                                    <FaPlus /> Nueva Tarea
                                </button>
                            </div>
                        )}
                        <div className="tareas-content">
                            {mostrarFormularioTarea ? (
                                <FormularioTarea
                                    key={editandoTarea?.id || 'nueva'}
                                    empleadoId={empleadoSeleccionado.id}
                                    empleadoNombre={`${empleadoSeleccionado.nombres} ${empleadoSeleccionado.apellidos}`}
                                    tarea={editandoTarea}
                                    proyectos={proyectos}
                                    onGuardada={(datos) => {
                                        if (Array.isArray(datos?.tareas)) setTareasEmpleado(datos.tareas);
                                        cerrarFormularioTarea();
                                    }}
                                    onCancelar={cerrarFormularioTarea}
                                />
                            ) : (
                                <div className="tareas-list">
                                    {tareasEmpleado.length > 0 ? (
                                        tareasEmpleado.map((tarea) => (

                                            <div key={tarea.id} className={`tarea-item tarea-item-empleado ${tarea.estado.toLowerCase()}`}>
                                                <div className="tarea-item-empleado-top">
                                                    <div className="tarea-item-empleado-title">
                                                        <h4>{tarea.titulo || 'Sin título'}</h4>
                                                    </div>
                                                    <div className="tarea-item-empleado-meta">
                                                        {tarea.proyecto_nombre && (
                                                            <span className="proyecto-badge">
                                                                {tarea.proyecto_nombre}
                                                            </span>
                                                        )}
                                                        <span className={`prioridad-badge ${(tarea.prioridad || 'media').toLowerCase()}`}>
                                                            {tarea.prioridad || 'Media'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <p className="tarea-descripcion tarea-item-empleado-descripcion">{tarea.descripcion}</p>

                                                <div className="tarea-item-empleado-panel">
                                                    <div className="tarea-item-empleado-fechas tarea-fechas">
                                                        {tarea.fecha_pactada && (
                                                            <span>Pactada: {new Date(tarea.fecha_pactada + 'T00:00:00').toLocaleDateString()}</span>
                                                        )}
                                                        {tarea.fecha_entregada && (
                                                            <span>Entregada: {new Date(tarea.fecha_entregada + 'T00:00:00').toLocaleDateString()}</span>
                                                        )}
                                                    </div>

                                                    <div className="tarea-item-empleado-acciones">
                                                        <div className="tarea-estado tarea-item-empleado-estado">
                                                            {/* Toda tarea se cierra aceptando la entrega desde
                                                                su detalle; en revisión sólo sale aceptándola o
                                                                devolviéndola. */}
                                                            <select
                                                                value={tarea.estado}
                                                                onChange={(e) => handleActualizarEstadoTarea(tarea, e.target.value)}
                                                                className={`estado-select ${tarea.estado.toLowerCase()}`}
                                                                disabled={tarea.estado === 'En Revisión'}
                                                                title={tarea.estado === 'En Revisión' ? 'En revisión: ábrela para aceptar o devolver la entrega' : undefined}
                                                            >
                                                                <option value="Pendiente">Pendiente</option>
                                                                <option value="En Proceso">En Proceso</option>
                                                                <option value="En Revisión">En Revisión</option>
                                                                <option value="Completada" disabled={tarea.estado !== 'Completada'}>Completada (al aceptar)</option>
                                                                <option value="Cancelada">Cancelada</option>
                                                            </select>
                                                        </div>

                                                        <div className="btn-editar-tarea tarea-item-empleado-botones">
                                                            <button className="btn-editar-tarea-button" onClick={() => handleEditarTarea(tarea)}>
                                                                <FaEdit /> Editar
                                                            </button>
                                                            <button
                                                                className="btn-editar-tarea-button btn-editar-tarea-button--secondary"
                                                                onClick={(e) => { e.stopPropagation(); setSelectedTask(tarea); setShowTaskDetails(true); }}
                                                            >
                                                                <FaEye /> Detalles
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {tarea.evidencias && tarea.evidencias.length > 0 && (
                                                    <div className="tarea-evidencias tarea-item-empleado-evidencias">
                                                        <h5>Evidencias:</h5>
                                                        {tarea.evidencias.some(e => !e || !e.evidencia || !e.tipo) && (
                                                            <p className="evidencias-warning">
                                                                Algunas evidencias no están disponibles o están dañadas
                                                            </p>
                                                        )}
                                                        <div className="evidencias-list evidencias-list-empleado">
                                                            {tarea.evidencias
                                                                .filter(evidencia => evidencia && evidencia.evidencia && evidencia.tipo)
                                                                .map((evidencia) => (
                                                                    <div key={evidencia.id} className="evidencia-item evidencia-item-empleado">
                                                                        <div className="evidencia-item-empleado-preview">
                                                                            {evidencia.tipo?.startsWith('image/') ? (
                                                                                <img
                                                                                    src={getImageUrl(`storage/${evidencia.evidencia}`)}
                                                                                    alt={evidencia.nombre || 'Sin nombre'}
                                                                                    className="evidencia-thumbnail evidencia-thumbnail-empleado"
                                                                                />
                                                                            ) : (
                                                                                <div className="file-icon file-icon-empleado">
                                                                                    {evidencia.tipo?.includes('pdf') ? (
                                                                                        <FaFilePdf className="evidencia-icon pdf" />
                                                                                    ) : evidencia.tipo?.includes('word') ? (
                                                                                        <FaFileWord className="evidencia-icon word" />
                                                                                    ) : (
                                                                                        <FaFile className="evidencia-icon" />
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        <div className="evidencia-item-empleado-body">
                                                                            <span className="evidencia-nombre evidencia-nombre-empleado">
                                                                                {evidencia.nombre || 'Archivo sin nombre'}
                                                                            </span>
                                                                            {evidencia.evidencia && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleFileClick(evidencia)}
                                                                                    className="view-evidencia view-evidencia-empleado"
                                                                                    title="Ver evidencias"
                                                                                >
                                                                                    <FaEye />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="no-tareas">
                                            No hay tareas registradas
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            )}

            {showEvidenciasModal && (
                <div className="modal-overlay">
                    <div className="evidencias-modal">
                        <div className="modal-header">
                            <h2>Completar Tarea</h2>
                            <button
                                className="close-button"
                                onClick={() => {
                                    setShowEvidenciasModal(false);
                                    setTareasEmpleado(tareasEmpleado.map(t =>
                                        t.id === tareaActual.id
                                            ? { ...t, estado: tareaActual.estado }
                                            : t
                                    ));
                                }}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="modal-content">
                            <div className="tarea-info">
                                <h3>{tareaActual?.titulo}</h3>
                                <p>{tareaActual?.descripcion}</p>
                            </div>
                            <div className=''>
                                <div className="form-group">
                                    <label className='form-label'>Fecha de entrega</label>
                                    <input type="date" value={tareaActual?.fecha_entregada} onChange={(e) => setTareaActual({ ...tareaActual, fecha_entregada: e.target.value })} />
                                </div>
                            </div>
                            <div className="">
                                <h4>Adjuntar Evidencias</h4>
                                <p className="evidencias-hint">* Debe adjuntar al menos una evidencia para completar la tarea</p>

                                <div className="evidencia-upload-container">
                                    <input
                                        type="file"
                                        multiple
                                        onChange={handleEvidenciaUpload}
                                        className="evidencia-input"
                                        disabled={isUploading}
                                    />
                                    {isUploading && (
                                        <div className="loader">
                                            <div className="justify-content-center jimu-primary-loading"></div>
                                        </div>
                                    )}
                                </div>

                                <div className="evidencias-preview">
                                    {evidencias.map((evidencia, index) => (
                                        <div key={index} className="evidencia-item">
                                            {evidencia.tipo.startsWith('image/') ? (
                                                <img
                                                    src={`/storage/${evidencia.ruta}`}
                                                    alt={evidencia.nombre}
                                                    className="evidencia-thumbnail"
                                                />
                                            ) : (
                                                <div className="file-icon">
                                                    {evidencia.tipo.includes('pdf') ? (
                                                        <FaFilePdf className="evidencia-icon pdf" />
                                                    ) : evidencia.tipo.includes('word') ? (
                                                        <FaFileWord className="evidencia-icon word" />
                                                    ) : (
                                                        <FaFile className="evidencia-icon" />
                                                    )}
                                                </div>
                                            )}
                                            <span className="evidencia-nombre">{evidencia.nombre}</span>
                                            <button
                                                type="button"
                                                onClick={() => setEvidencias(evidencias.filter((_, i) => i !== index))}
                                                className="remove-evidencia"
                                                disabled={isUploading}
                                            >
                                                <FaTimes />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button
                                    className="cancel-button"
                                    onClick={() => {
                                        setShowEvidenciasModal(false);
                                        setTareasEmpleado(tareasEmpleado.map(t =>
                                            t.id === tareaActual.id
                                                ? { ...t, estado: tareaActual.estado }
                                                : t
                                        ));
                                    }}
                                >
                                    <FaTimes /> {' '} Cancelar
                                </button>
                                <button
                                    className="complete-button"
                                    onClick={() => {
                                        if (evidencias.length === 0) {
                                            Swal.fire({
                                                title: 'Error',
                                                text: 'Debe adjuntar al menos una evidencia',
                                                icon: 'error',
                                                confirmButtonText: 'OK',
                                            });
                                            return;
                                        }
                                        actualizarEstadoTarea(tareaActual.id, 'Completada', evidencias);
                                    }}
                                    disabled={isUploading || evidencias.length === 0}
                                >
                                    <FaCheck /> {' '} Completar Tarea
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de detalles de tarea */}
            {showTaskDetails && selectedTask && (
                <TaskDetailsModal
                    task={selectedTask}
                    onClose={() => { setShowTaskDetails(false); setSelectedTask(null); }}
                    onUpdate={() => {
                        axiosInstance.get(`/cargarTareas/${empleadoSeleccionado.id}`)
                            .then(r => setTareasEmpleado(r.data.tareas))
                            .catch(() => {});
                    }}
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

    )
}

export default EmployeeModal;
