import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaThList, FaCamera, FaCheck, FaTimes, FaFile, FaEye, FaFilePdf, FaFileWord } from 'react-icons/fa';
import { FaListCheck } from 'react-icons/fa6';
import axios from 'axios';
import Swal from 'sweetalert2';

const EmployeeModal = ({ isOpen, onClose }) => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [empresas, setEmpresas] = useState([]);
    const [departamentos, setDepartamentos] = useState([]);
    const [cargos, setCargos] = useState([]);
    const [empleados, setEmpleados] = useState([]);
    const [showFuncionesModal, setShowFuncionesModal] = useState(false);
    const [funcionesEmpleado, setFuncionesEmpleado] = useState([]);
    const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null);
    const [nuevaFuncion, setNuevaFuncion] = useState('');
    const [funcionEditando, setFuncionEditando] = useState(null);
    const [funcionEditada, setFuncionEditada] = useState('');
    const [showTareasModal, setShowTareasModal] = useState(false);
    const [tareasEmpleado, setTareasEmpleado] = useState([]);
    const [nuevaTarea, setNuevaTarea] = useState({
        titulo: '',
        descripcion: '',
        fecha_pactada: '',
        estado: 'Pendiente',
        prioridad: 'Media',
        evidencias: []
    });
    const [editandoTarea, setEditandoTarea] = useState(null);
    const [evidencias, setEvidencias] = useState([]);
    const [mostrarFormularioTarea, setMostrarFormularioTarea] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showEvidenciasModal, setShowEvidenciasModal] = useState(false);
    const [tareaActual, setTareaActual] = useState(null);
    const initialEmpleadoState = {
        id: '',
        identificacion: '',
        nombres: '',
        apellidos: '',
        email: '',
        departamento: '',
        empresa: '',
        cargo: '',
        foto: '',
        fotoPreview: null,
        fechaNacimiento: '',
        fechaIngreso: '',
        tipoContrato: '',
        estado: 'Activo',
        direccion: '',
        telefono: '',
        accion: 'guardar'
    };

    const [newEmpleado, setNewEmpleado] = useState(initialEmpleadoState);

    useEffect(() => {
        cargarEmpresas();
        cargarDepartamentos();
        cargarCargos();
        cargarEmpleados();
    }, []);

    
    const cargarEmpleados = () => {
        axios.get('/parametros/cargarEmpleados')
        .then((response) => {
            
            setEmpleados(response.data);
        })
        .catch((error) => {
            console.error('Error al cargar los empleados:', error);
        });
    };

    const handleEditarFuncion = (funcion) => {
        setFuncionEditando(funcion.id);
        setFuncionEditada(funcion.descripcion);
    };

    const handleGuardarEmpleado = () => {
      
        axios
        .post('/parametros/guardarEmpleados', newEmpleado)
        .then((response) => {
           
           Swal.fire({
            title: 'Empleado guardado correctamente',
            icon: 'success',
            confirmButtonText: 'OK',
           });

           setShowAddForm(false);
           setNewEmpleado(initialEmpleadoState);
           cargarEmpleados();
          
        })
        .catch((error) => {
            console.error('Error al guardar el empleado:', error);
            Swal.fire({
                title: 'Error',
                text: 'Hubo un error al guardar el empleado',
                icon: 'error',
                confirmButtonText: 'OK',
            });
        });
    };

    const cargarEmpresas = () => {
        axios.get('/parametros/cargarEmpresas')
        .then((response) => {
            setEmpresas(response.data);
        })
        .catch((error) => {
            console.error('Error al cargar las empresas:', error);
        });
    };

    const cargarDepartamentos = () => {
        axios.get('/parametros/cargarDepartamentos')
        .then((response) => {
            setDepartamentos(response.data);
        });
    };

    const cargarCargos = () => {
        axios.get('/parametros/cargarCargos')
        .then((response) => {
            setCargos(response.data);
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

    const handleVerFunciones = (empleado) => {
        setEmpleadoSeleccionado(empleado);
        
        axios.get(`/parametros/cargarFunciones/${empleado.id}`)
        .then((response) => {
                
            setFuncionesEmpleado(response.data);
            setShowFuncionesModal(true);
        })
        .catch((error) => {
            console.error('Error al cargar las funciones:', error);
        });
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

        axios.post('/parametros/guardarFuncion', data)
        .then((response) => {
            console.log(response.data);
            if (response.data.funcion) {
                setFuncionesEmpleado(prevFunciones => [...prevFunciones, response.data.funcion]);
                console.log(funcionesEmpleado);
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

    const handleEliminarFuncion = (funcionId) => {
        Swal.fire({
            title: '¿Estás seguro?',
            text: 'No podrás revertir esto.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Si, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if(result.isConfirmed){
                axios.delete(`/parametros/eliminarFuncion/${funcionId}`)
                .then(() => {
                    setFuncionesEmpleado(funcionesEmpleado.filter(f => f.id !== funcionId));
                    Swal.fire({
                        title: 'Función eliminada correctamente',
                        icon: 'success',
                        confirmButtonText: 'OK',
                    });
                })
                .catch((error) => {
                    console.error('Error al eliminar la función:', error);
                });
            }
        });
    };

    const handleEliminarEmpleado = (id) => {
        Swal.fire({
            title: '¿Estás seguro?',
            text: 'No podrás revertir esto.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Si, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if(result.isConfirmed){
                axios.delete(`/parametros/eliminarEmpleado/${id}`)
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

    const handleEditarEmpleado = (empleado) => {
        setNewEmpleado({
            ...empleado,
            fechaNacimiento: empleado.fecha_nacimiento || '',
            fechaIngreso: empleado.fecha_ingreso || '',
            tipoContrato: empleado.tipo_contrato || '',
            accion: 'editar',
            id: empleado.id
        });

        let foto = empleado.foto;
        if(foto){
            setNewEmpleado(prev => ({
                ...prev,
                foto: foto,
                fotoPreview: foto
            }));
        }

        setShowAddForm(true);
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

        axios.put(`/parametros/actualizarFuncion/${id}`, data)
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

    const handleVerTareas = (empleado) => {
        setEmpleadoSeleccionado(empleado);
        
        axios.get(`/parametros/cargarTareas/${empleado.id}`)
        .then((response) => {
            setTareasEmpleado(response.data.tareas);
            console.log(tareasEmpleado.evidencias);
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

    const handleGuardarTarea = () => {
        if (!nuevaTarea.titulo.trim() || !nuevaTarea.fecha_pactada) {
            Swal.fire({
                title: 'Error',
                text: 'Por favor complete los campos requeridos',
                icon: 'error',
                confirmButtonText: 'OK',
            });
            return;
        }

        const tareaData = {
            ...nuevaTarea,
            empleado: empleadoSeleccionado.id,
            evidencias: evidencias
        };


        axios.post('/parametros/guardarTarea', tareaData)
        .then((response) => {
            setTareasEmpleado([...tareasEmpleado, response.data]);
            setNuevaTarea({
                titulo: '',
                descripcion: '',
                fecha_pactada: '',
                estado: 'Pendiente',
                prioridad: 'Media',
                evidencias: []
            });
            setEvidencias([]);
            setMostrarFormularioTarea(false);
            Swal.fire({
                title: 'Tarea guardada correctamente',
                icon: 'success',
                confirmButtonText: 'OK',
            });
        })
        .catch((error) => {
            console.error('Error al guardar la tarea:', error);
        });
    };

    const handleActualizarEstadoTarea = (tarea, nuevoEstado) => {
        if (nuevoEstado === 'Completada') {
            setTareaActual(tarea);
            setShowEvidenciasModal(true);
        } else {
            actualizarEstadoTarea(tarea.id, nuevoEstado);
        }
    };

    const actualizarEstadoTarea = (tareaId, nuevoEstado, evidencias = []) => {
        const data = {
            estado: nuevoEstado,
            fecha_entregada: nuevoEstado === 'Completada' ? tareaActual.fecha_entregada : null,
            evidencias: evidencias
        };

        axios.put(`/parametros/actualizarEstadoTarea/${tareaId}`, data)
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
            }else{
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
            Swal.fire({
                title: 'Error',
                text: 'Hubo un error al actualizar el estado de la tarea',
                icon: 'error',
                confirmButtonText: 'OK',
            });
        });
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                <div className="modal-header">
                    <h2>Gestión de Empleados</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-toolbar">
                    <div className="search-box">
                        <FaSearch />
                        <input 
                            type="text"
                            placeholder="Buscar empleado..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button 
                        className="add-button"
                        onClick={() => {
                            setNewEmpleado(initialEmpleadoState);
                            setShowAddForm(true);
                        }}
                    >
                        <FaPlus /> Nuevo Empleado
                    </button>
                </div>

                <div className="modal-content">
                    <table className="employee-table">
                        <thead>
                            <tr>
                                <th>Foto</th>
                                <th>Nombre</th>
                                <th>Departamento</th>
                                <th>Cargo</th>
                                <th>Empresa</th>
                                <th>Email</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {empleados.map(empleado => (
                                <tr key={empleado.id}>
                                    <td>
                                        <img 
                                            src={empleado.foto} 
                                            alt={empleado.nombre}
                                            className="employee-mini-photo"
                                        />
                                    </td>
                                    <td style={{textTransform: 'capitalize'}}>{empleado.nombres} {empleado.apellidos}</td>
                                    <td>{empleado.nombre_departamento}</td>
                                    <td>{empleado.nombre_cargo}</td>
                                    <td>{empleado.nombre_empresa}</td>
                                    <td>{empleado.email}</td>
                                    <td>
                                        <span className={`status-badge ${empleado.estado.toLowerCase()}`}>
                                            {empleado.estado}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button title="Ver tareas" onClick={() => handleVerTareas(empleado)} className="edit-button">
                                                <FaListCheck />
                                            </button>
                                            <button title="Ver funciones" onClick={() => handleVerFunciones(empleado)} className="edit-button">
                                                <FaThList />
                                            </button>
                                            <button title="Editar empleado" onClick={() => handleEditarEmpleado(empleado)} className="edit-button">
                                                <FaEdit />
                                            </button>
                                            <button title="Eliminar empleado" onClick={() => handleEliminarEmpleado(empleado.id)} className="delete-button">
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {showAddForm && (
                <div className="modal-overlay">
                    <div className="form-modal-large">
                        <div className="modal-header">
                            <h2>Nuevo Empleado</h2>
                            <button 
                                className="close-button" 
                                onClick={() => setShowAddForm(false)}
                            >
                                &times;
                            </button>
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
                                    onChange={(e) => setNewEmpleado({...newEmpleado, identificacion: e.target.value})}
                                    value={newEmpleado.identificacion}
                                    className="form-control"
                                    name="identificacion"
                                    id='identificacion'                                    
                                    />
                                </div>
                                <div className="form-group col-4">
                                    <label>Nombres</label>
                                    <input type="text" 
                                    onChange={(e) => setNewEmpleado({...newEmpleado, nombres: e.target.value})}
                                    value={newEmpleado.nombres}
                                    className="form-control"
                                    name="nombres"
                                    id='nombres'                                    
                                    />
                                </div>
                                <div className="form-group col-4">
                                    <label>Apellidos</label>
                                    <input type="text" 
                                    onChange={(e) => setNewEmpleado({...newEmpleado, apellidos: e.target.value})}
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
                                    onChange={(e) => setNewEmpleado({...newEmpleado, fechaNacimiento: e.target.value})}
                                    value={newEmpleado.fechaNacimiento}
                                    className="form-control"
                                    name="fechaNacimiento"
                                    id='fechaNacimiento'                                    
                                    />
                                </div>
                                <div className="form-group col-4">
                                    <label>Email</label>
                                    <input type="email" 
                                    onChange={(e) => setNewEmpleado({...newEmpleado, email: e.target.value})}
                                    value={newEmpleado.email}
                                    className="form-control"
                                    name="email"
                                    id='email'                                    
                                    />
                                </div>
                                <div className="form-group col-3">
                                    <label>Teléfono</label>
                                    <input type="tel" 
                                    onChange={(e) => setNewEmpleado({...newEmpleado, telefono: e.target.value})}
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
                                    <select onChange={(e) => setNewEmpleado({...newEmpleado, departamento: e.target.value})}
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
                                    <select onChange={(e) => setNewEmpleado({...newEmpleado, cargo: e.target.value})}
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
                                    <select onChange={(e) => setNewEmpleado({...newEmpleado, empresa: e.target.value})}
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
                                <div className="form-group col-4">
                                    <label>Fecha de Ingreso</label>
                                    <input   type="date" 
                                    onChange={(e) => setNewEmpleado({...newEmpleado, fechaIngreso: e.target.value})}
                                    value={newEmpleado.fechaIngreso}
                                    className="form-control"
                                    name="fechaIngreso"
                                    id='fechaIngreso'                                    
                                    />
                                </div>
                                <div className="form-group col-4">
                                    <label>Tipo de Contrato</label>
                                    <select onChange={(e) => setNewEmpleado({...newEmpleado, tipoContrato: e.target.value})}
                                    value={newEmpleado.tipoContrato}
                                    className="form-control"
                                    name="tipoContrato"
                                    id='tipoContrato'                                    
                                    >
                                        <option value="">Seleccionar tipo</option>
                                        <option value="indefinido">Indefinido</option>
                                        <option value="fijo">Término Fijo</option>
                                        <option value="servicios">Prestación de Servicios</option>
                                    </select>
                                </div>
                                <div className="form-group col-4">
                                    <label>Estado</label>
                                    <select onChange={(e) => setNewEmpleado({...newEmpleado, estado: e.target.value})}
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

                            <div className="form-actions">
                                <button 
                                    type="button" 
                                    className="cancel-button"
                                    onClick={() => setShowAddForm(false)}
                                >
                                    Cancelar
                                </button>
                                <button type="button" onClick={handleGuardarEmpleado} className="save-button">
                                    Guardar
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
                            <h2>Funciones del Empleado</h2>
                            <button 
                                className="close-button" 
                                onClick={() => setShowFuncionesModal(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="funciones-content">
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
                        </div>
                    </div>
                </div>
            )}

            {showTareasModal && (
                <div className="modal-overlay">
                    <div className="tareas-modal">
                        <div className="modal-header">
                            <h2>
                                {mostrarFormularioTarea ? 'Nueva Tarea' : 
                                `Tareas de ${empleadoSeleccionado.nombres} ${empleadoSeleccionado.apellidos}`}
                            </h2>
                            <div className="modal-header-actions">
                                {!mostrarFormularioTarea && (
                                    <button 
                                        className="add-button"
                                        onClick={() => setMostrarFormularioTarea(true)}
                                    >
                                        <FaPlus /> Nueva Tarea
                                    </button>
                                )}
                                <button 
                                    className="close-button" 
                                    onClick={() => {
                                        setShowTareasModal(false);
                                        setMostrarFormularioTarea(false);
                                    }}
                                >
                                    &times;
                                </button>
                            </div>
                        </div>
                        
                        <div className="tareas-content">
                            {mostrarFormularioTarea ? (
                                <div className="tarea-form">
                                    <div className="form-row">
                                        <div className="form-group col-12">
                                            <label>Título</label>
                                            <input
                                                type="text"
                                                value={nuevaTarea.titulo}
                                                onChange={(e) => setNuevaTarea({...nuevaTarea, titulo: e.target.value})}
                                                placeholder="Título de la tarea"
                                            />
                                        </div>
                                       
                                    </div>
                                    <div className='form-row'>
                                    <div className="form-group col-6">
                                            <label>Fecha Pactada</label>
                                            <input
                                                type="date"
                                                value={nuevaTarea.fecha_pactada}
                                                onChange={(e) => setNuevaTarea({...nuevaTarea, fecha_pactada: e.target.value})}
                                            />
                                        </div>
                                        <div className="form-group col-6">
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
                                                            onClick={() => window.open(`/storage/${evidencia.ruta}`, '_blank')}
                                                            className="view-evidencia"
                                                        >
                                                            <FaEye />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="form-actions">
                                        <button 
                                            className="cancel-button"
                                            onClick={() => {
                                                setMostrarFormularioTarea(false);
                                                setNuevaTarea({
                                                    titulo: '',
                                                    descripcion: '',
                                                    fecha_pactada: '',
                                                    estado: 'Pendiente',
                                                    prioridad: 'Media',
                                                    evidencias: []
                                                });
                                                setEvidencias([]);
                                            }}
                                        >
                                            Cancelar
                                        </button>
                                        <button onClick={handleGuardarTarea} className="save-button">
                                            Guardar Tarea
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="tareas-list">
                                    {tareasEmpleado.length > 0 ? (
                                        tareasEmpleado.map((tarea) => (
                                            <div key={tarea.id} className={`tarea-item ${tarea.estado.toLowerCase()}`}>
                                                <div className="tarea-header">
                                                    <h4>{tarea.titulo || 'Sin título'}</h4>
                                                    <span className={`prioridad-badge ${(tarea.prioridad || 'media').toLowerCase()}`}>
                                                        {tarea.prioridad || 'Media'}
                                                    </span>
                                                </div>
                                                <p className="tarea-descripcion">{tarea.descripcion}</p>
                                                <div className="tarea-footer">
                                                    <div className="tarea-fechas">
                                                        {tarea.fecha_pactada && (
                                                            <span>Pactada: {new Date(tarea.fecha_pactada).toLocaleDateString()}</span>
                                                        )}
                                                        {tarea.fecha_entregada && (
                                                            <span>Entregada: {new Date(tarea.fecha_entregada).toLocaleDateString()}</span>
                                                        )}
                                                    </div>
                                                    <div className="tarea-estado">
                                                        <select
                                                            value={tarea.estado}
                                                            onChange={(e) => handleActualizarEstadoTarea(tarea, e.target.value)}
                                                            className={`estado-select ${tarea.estado.toLowerCase()}`}
                                                        >
                                                            <option value="Pendiente">Pendiente</option>
                                                            <option value="En Proceso">En Proceso</option>
                                                            <option value="Completada">Completada</option>
                                                            <option value="Cancelada">Cancelada</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                {tarea.evidencias && tarea.evidencias.length > 0 && (
                                                    <div className="tarea-evidencias">
                                                        <h5>Evidencias:</h5>
                                                        {tarea.evidencias.some(e => !e || !e.evidencia || !e.tipo) && (
                                                            <p className="evidencias-warning">
                                                                Algunas evidencias no están disponibles o están dañadas
                                                            </p>
                                                        )}
                                                        <div className="evidencias-list">
                                                            {tarea.evidencias
                                                                .filter(evidencia => evidencia && evidencia.evidencia && evidencia.tipo)
                                                                .map((evidencia) => (
                                                                    <div key={evidencia.id} className="evidencia-item">
                                                                        {evidencia.tipo?.startsWith('image/') ? (
                                                                            <img 
                                                                                src={`/storage/${evidencia.evidencia}`} 
                                                                                alt={evidencia.nombre || 'Sin nombre'} 
                                                                                className="evidencia-thumbnail"
                                                                            />
                                                                        ) : (
                                                                            <div className="file-icon">
                                                                                {evidencia.tipo?.includes('pdf') ? (
                                                                                    <FaFilePdf className="evidencia-icon pdf" />
                                                                                ) : evidencia.tipo?.includes('word') ? (
                                                                                    <FaFileWord className="evidencia-icon word" />
                                                                                ) : (
                                                                                    <FaFile className="evidencia-icon" />
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        <span className="evidencia-nombre">
                                                                            {evidencia.nombre || 'Archivo sin nombre'}
                                                                        </span>
                                                                        {evidencia.evidencia && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => window.open(`/storage/${evidencia.evidencia}`, '_blank')}
                                                                                className="view-evidencia"
                                                                            >
                                                                                <FaEye />
                                                                            </button>
                                                                        )}
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
                                            ? {...t, estado: tareaActual.estado} 
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
                            <div className='form-row'>
                                <div className="form-group col-6">
                                    <label>Fecha de entrega</label>
                                    <input type="date" value={tareaActual?.fecha_entregada} onChange={(e) => setTareaActual({...tareaActual, fecha_entregada: e.target.value})} />
                                </div>
                            </div>
                            <div className="evidencias-section">
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
                                                ? {...t, estado: tareaActual.estado} 
                                                : t
                                        ));
                                    }}
                                >
                                    Cancelar
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
                                    Completar Tarea
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeModal; 