import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaUser, FaLock, FaEnvelope, FaUserShield } from 'react-icons/fa';
import axios from 'axios';
import Swal from 'sweetalert2';

const UserModal = ({ isOpen, onClose }) => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [usuarios, setUsuarios] = useState([]);
    const [roles, setRoles] = useState([]);
    const [empleados, setEmpleados] = useState([]);

    const initialUserState = {
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: '',
        empleado: '',
        estado: 'Activo',
        cambiar_password: false,
        accion: 'guardar'
    };

    const [newUser, setNewUser] = useState(initialUserState);
    
    

    useEffect(() => {
        cargarUsuarios();
        cargarRoles();
        cargarEmpleados();
    }, []);

    useEffect(() => {
        const delaySearch = setTimeout(() => {
            if (searchTerm.length > 0) {
                buscarUsuarios();
            } else {
                cargarUsuarios();
            }
        }, 500);

        return () => clearTimeout(delaySearch);
    }, [searchTerm]);

    const cargarUsuarios = () => {
        axios.get('/parametros/cargarUsuarios')
        .then((response) => {
            setUsuarios(response.data);
        })
        .catch((error) => {
            console.error('Error al cargar los usuarios:', error);
        });
    };

    const buscarUsuarios = () => {
        setLoading(true);
        axios.get('/parametros/buscarUsuarios', { 
            params: { 
                search: searchTerm,
                filters: {
                    name: true,
                    email: true,
                    role: true,
                    empleado: true
                }
            } 
        })
        .then((response) => {
            setUsuarios(response.data);
            setLoading(false);
        })
        .catch((error) => {
            console.error('Error al buscar usuarios:', error);
            setLoading(false);
            Swal.fire({
                title: 'Error',
                text: 'Hubo un error al buscar usuarios',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        });
    };
    

    //roles en un array
    const rolesAvtivos = ['Administrador', 'Empleado'];

    const cargarRoles = () => {
        setRoles(rolesAvtivos);
    };
    
    //cargar empleados
    const cargarEmpleados = () => {
        axios.get('/parametros/cargarEmpleados')
        .then((response) => {
            setEmpleados(response.data);
        })
        .catch((error) => {
            console.error('Error al cargar los empleados:', error);
        });
    };
//guardar usuario
    const handleGuardarUsuario = () => {
        if (!newUser.name || !newUser.email || !newUser.role) {
            Swal.fire({
                title: 'Error',
                text: 'Por favor complete todos los campos requeridos',
                icon: 'error',
                confirmButtonText: 'OK',
            });
            return;
        }

        if (!newUser.accion || (newUser.accion === 'editar' && newUser.cambiar_password)) {
            if (!newUser.password || !newUser.password_confirmation) {
                Swal.fire({
                    title: 'Error',
                    text: 'Por favor complete los campos de contraseña',
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
                return;
            }

            if (newUser.password !== newUser.password_confirmation) {
                Swal.fire({
                    title: 'Error',
                    text: 'Las contraseñas no coinciden',
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
                return;
            }
        }
   

        const userData = { ...newUser };
        if (newUser.accion === 'editar' && !newUser.cambiar_password) {
            delete userData.password;
            delete userData.password_confirmation;
        }

        
        axios.post('/parametros/guardarUsuario', userData)
        .then((response) => {
            Swal.fire({
                title: 'Usuario guardado correctamente',
                icon: 'success',
                confirmButtonText: 'OK',
            });
            setShowAddForm(false);
            setNewUser(initialUserState);
            cargarUsuarios();
        })
        .catch((error) => {
            console.error('Error al guardar el usuario:', error);
            Swal.fire({
                title: 'Error',
                text: 'Hubo un error al guardar el usuario',
                icon: 'error',
                confirmButtonText: 'OK',
            });
        });
    };

    const handleEliminarUsuario = (id) => {
        Swal.fire({
            title: '¿Estás seguro?',
            text: 'No podrás revertir esto.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Si, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if(result.isConfirmed){
                axios.delete(`/parametros/eliminarUsuario/${id}`)
                .then((response) => {
                    Swal.fire({
                        title: 'Usuario eliminado correctamente',
                        icon: 'success',
                        confirmButtonText: 'OK',
                    });
                    cargarUsuarios();
                })
                .catch((error) => {
                    console.error('Error al eliminar el usuario:', error);
                });
            }
        });
    };

    const handleEditarUsuario = (usuario) => {
        setNewUser({
            ...usuario,
            password: '',
            password_confirmation: '',
            cambiar_password: false,
            accion: 'editar',
            role: usuario.tipo_usuario,
            id: usuario.id
        });
        setShowAddForm(true);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                <div className="modal-header">
                    <h2>Gestión de Usuarios</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-toolbar">
                    <div className={`search-box ${loading ? 'loading' : ''}`}>
                        <FaSearch />
                        <input 
                            type="text"
                            placeholder="Buscar por nombre, email, rol o empleado..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {loading && <div className="search-spinner"></div>}
                    </div>
                    <button 
                        className="add-button"
                        onClick={() => {
                            setNewUser(initialUserState);
                            setShowAddForm(true);
                        }}
                    >
                        <FaPlus /> Nuevo Usuario
                    </button>
                </div>

                <div className="modal-content">
                    {usuarios.length === 0 ? (
                        <div className="no-data-message">
                            <p>No hay usuarios disponibles</p>
                        </div>
                    ) : (
                        
                        <table className="employee-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Email</th>
                                <th>Rol</th>
                                <th>Empleado</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usuarios.map(usuario => (
                                <tr key={usuario.id}>
                                    <td style={{textTransform: 'capitalize'}}>{usuario.name}</td>
                                    <td>{usuario.email}</td>
                                    <td className="text-center">{usuario.tipo_usuario}</td>
                                    <td style={{textTransform: 'capitalize', textAlign: usuario.nombre_empleado === '---' ? 'center' : 'left'}}>{usuario.nombre_empleado}</td>
                                    <td>
                                        <span className={`status-badge ${usuario.estado.toLowerCase()}`}>
                                            {usuario.estado}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button title="Editar usuario" onClick={() => handleEditarUsuario(usuario)} className="edit-button">
                                                <FaEdit />
                                            </button>
                                            <button title="Eliminar usuario" onClick={() => handleEliminarUsuario(usuario.id)} className="delete-button">
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                        </tbody>
                    </table>
                    )} 
                   
                </div>
            </div>

            {showAddForm && (
                <div className="modal-overlay">
                    <div className="form-modal-large">
                        <div className="modal-header">
                            <h2>{newUser.accion === 'editar' ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
                            <button 
                                className="close-button" 
                                onClick={() => setShowAddForm(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <form className="employee-form">
                            <div className="form-row">
                                <div className="form-group col-6">
                                    <label>Nombre</label>
                                    <div className="input-icon">
                                        <FaUser />
                                        <input 
                                            type="text"
                                            value={newUser.name}
                                            onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                                            placeholder="Nombre completo"
                                        />
                                    </div>
                                </div>
                                <div className="form-group col-6">
                                    <label>Email</label>
                                    <div className="input-icon">
                                        <FaEnvelope />
                                        <input 
                                            type="email"
                                            value={newUser.email}
                                            onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                                            placeholder="correo@ejemplo.com"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-row">
                                {(!newUser.accion || newUser.cambiar_password) ? (
                                    <>
                                        <div className="form-group col-6">
                                            <label>Contraseña</label>
                                            <div className="input-icon">
                                                <FaLock />
                                                <input 
                                                    type="password"
                                                    value={newUser.password}
                                                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group col-6">
                                            <label>Confirmar Contraseña</label>
                                            <div className="input-icon">
                                                <FaLock />
                                                <input 
                                                    type="password"
                                                    value={newUser.password_confirmation}
                                                    onChange={(e) => setNewUser({...newUser, password_confirmation: e.target.value})}
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="form-group col-12">
                                        <div className="password-change-control">
                                            <label>
                                                <input 
                                                    type="checkbox"
                                                    checked={newUser.cambiar_password}
                                                    onChange={(e) => setNewUser({
                                                        ...newUser, 
                                                        cambiar_password: e.target.checked,
                                                        password: '',
                                                        password_confirmation: ''
                                                    })}
                                                />
                                                Cambiar contraseña
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="form-row">
                                <div className="form-group col-6">
                                    <label>Rol</label>
                                    <div className="input-icon">
                                        <FaUserShield />
                                        <select
                                            value={newUser.role}
                                            onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                                        >
                                            <option value="">Seleccionar rol</option>
                                            {roles.map(rol => (
                                                <option key={rol} value={rol}>{rol}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group col-6">
                                    <label>Empleado</label>
                                    <div className="input-icon">
                                        <FaUser />
                                        <select
                                            value={newUser.empleado}
                                            onChange={(e) => setNewUser({...newUser, empleado: e.target.value})}
                                            disabled={newUser.role !== 'Empleado'}
                                        >
                                            <option value="">Seleccionar empleado</option>
                                            {empleados.map(empleado => (
                                                <option key={empleado.id} value={empleado.id}>
                                                    {empleado.nombres} {empleado.apellidos}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group col-6">
                                    <label>Estado</label>
                                    <select
                                        value={newUser.estado}
                                        onChange={(e) => setNewUser({...newUser, estado: e.target.value})}
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
                                <button type="button" onClick={handleGuardarUsuario} className="save-button">
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

export default UserModal;
