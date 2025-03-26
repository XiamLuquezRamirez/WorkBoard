import { Axios } from 'axios';
import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaThList, FaCamera } from 'react-icons/fa';
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

    const handleVerFunciones = (id) => {
       
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
                                            <button title="Ver tareas" className="edit-button">
                                                <FaListCheck />
                                            </button>
                                            <button title="Ver funciones" onClick={() => handleVerFunciones(empleado.id)} className="edit-button">
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
                            <div className="form-group col-2">
                                    <label>Fecha de Nacimiento</label>
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
        </div>
    );
};

export default EmployeeModal; 