import React, { useState, useEffect } from 'react';
import { FaPlus,
    FaEdit,
    FaTrash,
    FaSearch,
    FaUser,
    FaLock,
    FaEnvelope,
    FaCamera,
    FaSave,
    FaTimes,
    FaUsers,
    FaArrowLeft } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';
import Swal from 'sweetalert2';
import Paginador from './Paginador';



const UserModal = ({ isOpen, onClose }) => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [usuarios, setUsuarios] = useState([]);
    const [roles, setRoles] = useState([]);
    const [lider, setLider] = useState([]);
    const [empleados, setEmpleados] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(5);

    const initialUserState = {
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: '',
        empleado: '',
        estado: 'Activo',
        cambiar_password: false,
        accion: 'guardar',        
        lider_seguimiento: '',
        foto: null,
        fotoPreview: ''

    };

    const [newUser, setNewUser] = useState(initialUserState);

    // Calcular los usuarios a mostrar segÃºn la pÃ¡gina actual
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = usuarios.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(usuarios.length / itemsPerPage);


    useEffect(() => {
        cargarRoles();
        cargarEmpleados();
        cargarLideres();
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
        setLoading(true);
        axiosInstance.get('/cargarUsuarios')
            .then((response) => {
                setUsuarios(response.data);
            })
            .catch((error) => {
                console.error('Error al cargar los usuarios:', error);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewUser(prev => ({
                    ...prev,
                    foto: reader.result,
                    fotoPreview: previewUrl
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const buscarUsuarios = () => {
        setLoading(true);
        axiosInstance.get('/buscarUsuarios', {
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
    const rolesAvtivos = ['Administrador', 'Supervisor', 'Empleado'];
    const lidesActivos = ['Si', 'No']
    const cargarRoles = () => {
        setRoles(rolesAvtivos);
    };

    const cargarLideres = () => {
        setLider(lidesActivos);
    }

    //cargar empleados
    const cargarEmpleados = () => {
        axiosInstance.get('/listaEmpleados')
            .then((response) => {
                setEmpleados(response.data);
            })
            .catch((error) => {
                console.error('Error al cargar los empleados:', error);
            });
    };
    //guardar usuario
    const handleGuardarUsuario = () => {
        if (!newUser.name || !newUser.email || !newUser.role || !newUser.lider_seguimiento) {
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
                    text: 'Por favor complete los campos de contraseÃ±a',
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
                return;
            }

            if (newUser.password !== newUser.password_confirmation) {
                Swal.fire({
                    title: 'Error',
                    text: 'Las contraseÃ±as no coinciden',
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


        axiosInstance.post('/guardarUsuario', userData)
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
            title: 'Â¿EstÃ¡s seguro?',
            text: 'No podrÃ¡s revertir esto.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Si, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                axiosInstance.delete(`/eliminarUsuario/${id}`)
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
            cambiar_password: true,
            accion: 'editar',
            role: usuario.tipo_usuario,
            id: usuario.id,
            foto: usuario.foto,
            fotoPreview: usuario.foto,
            lider_seguimiento: usuario.lider_seguimiento
        });
        setShowAddForm(true);

    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            {/* Modal principal */}
            <div className="modal-user">

                {/* Encabezado */}
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h2 style={{ margin: 0 }}>
                            <FaUsers style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />GestiÃ³n de Usuarios
                        </h2>
                    </div>
                    <button className="close-button" onClick={onClose}><FaTimes /></button>
                </div>

                {/* Barra de herramientas (Buscar + Nuevo Usuario) */}
                <div className="dm-toolbar">
                    <input
                        type="text"
                        className="dm-search"
                        placeholder="Buscar por nombre, email, rol o empleado..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button
                        className="dm-btn dm-btn--primary"
                        onClick={() => {
                            setNewUser(initialUserState);
                            setShowAddForm(true);
                        }}
                    >
                        <FaPlus /> Nuevo Usuario
                    </button>
                </div>

                {/* Contenido */}
                <div className="modal-content">
                    {loading ? (
                        <div className="loader"><div className="jimu-primary-loading" /></div>
                    ) : usuarios.length === 0 ? (
                        <div className="no-data-message"><p>No hay usuarios disponibles</p></div>
                    ) : (
                        <>
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
                                    {currentItems.map(usuario => (
                                        <tr key={usuario.id}>
                                            <td style={{ textTransform: 'capitalize' }}>{usuario.name}</td>
                                            <td>{usuario.email}</td>
                                            <td className="text-center">{usuario.tipo_usuario}</td>
                                            <td style={{
                                                textTransform: 'capitalize',
                                                textAlign: usuario.nombre_empleado === '---' ? 'center' : 'left'
                                            }}>
                                                {usuario.nombre_empleado}
                                            </td>
                                            <td>
                                                <span className={`status-badge ${usuario.estado.toLowerCase()}`}>
                                                    {usuario.estado}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="dm-actions">
                                                    <button onClick={() => handleEditarUsuario(usuario)} className="dm-action-btn dm-action-btn--edit" title="Editar">
                                                        <FaEdit />
                                                    </button>
                                                    <button onClick={() => handleEliminarUsuario(usuario.id)} className="dm-action-btn dm-action-btn--delete" title="Eliminar">
                                                        <FaTrash />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* PaginaciÃ³n */}
                            <Paginador
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Modal secundario para formulario de usuario */}
            {showAddForm && (
                <div className="modal-overlay">
                    <div className="form-modal-large">
                        {/* Encabezado formulario */}
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <button className="rdm-back-btn" onClick={() => setShowAddForm(false)}>
                                    <FaArrowLeft /> Usuarios
                                </button>
                                <h2 style={{ margin: 0 }}>
                                    {newUser.accion === 'editar'
                                        ? `Editar: ${newUser.name}`
                                        : 'Nuevo Usuario'}
                                </h2>
                            </div>
                            <button className="close-button" onClick={onClose}><FaTimes /></button>
                        </div>

                        {/* Formulario */}
                        <form className="employee-form">

                            {/* Foto */}
                            <div className="form-row">
                                <div className="form-group col-12">
                                    <div className="foto-upload-container">
                                        <div className="foto-preview">
                                            {newUser.fotoPreview ? (
                                                <>
                                                    <img src={newUser.fotoPreview} alt="Preview" className="avatar-preview" />
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
                            </div>

                            {/* Nombre y Email */}
                            <div className="form-row">
                                <div className="form-group col-6">
                                    <label>Nombre</label>
                                    <div className="input-icon">
                                        <FaUser />
                                        <input
                                            type="text"
                                            value={newUser.name}
                                            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
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
                                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                            placeholder="correo@ejemplo.com"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ContraseÃ±as */}
                            {newUser.accion !== 'guardar' && (
                                <div className="form-group col-4">
                                      <div className="visto-bueno-checkbox">
                                        <label>
                                        <input
                                            type="checkbox"
                                            checked={newUser.cambiar_password}
                                            onChange={(e) =>
                                                setNewUser({
                                                    ...newUser,
                                                    cambiar_password: e.target.checked,
                                                    password: '',
                                                    password_confirmation: '',
                                                })
                                            }
                                        />
                                        Cambiar contraseÃ±a
                                        </label>
                                    </div>
                                </div>
                            )}
                            {(newUser.accion === 'guardar' || newUser.cambiar_password) && (
                                <div className="form-row">
                                    <div className="form-group col-6">
                                        <label>ContraseÃ±a</label>
                                        <div className="input-icon">
                                            <FaLock />
                                            <input
                                                type="password"
                                                value={newUser.password}
                                                onChange={(e) =>
                                                    setNewUser({ ...newUser, password: e.target.value })
                                                }
                                                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group col-6">
                                        <label>Confirmar ContraseÃ±a</label>
                                        <div className="input-icon">
                                            <FaLock />
                                            <input
                                                type="password"
                                                value={newUser.password_confirmation}
                                                onChange={(e) =>
                                                    setNewUser({ ...newUser, password_confirmation: e.target.value })
                                                }
                                                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Rol y Empleado */}
                            <div className="form-row">
                                <div className="form-group col-4">
                                    <label>Rol</label>
                                    <select
                                        value={newUser.role}
                                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                    >
                                        <option value="">Seleccionar rol</option>
                                        {roles.map(rol => (
                                            <option key={rol} value={rol}>{rol}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group col-4">
                                    <label>Lider de Seguimiento</label>
                                    <select
                                        value={newUser.lider_seguimiento}
                                        onChange={(e) => setNewUser({ ...newUser, lider_seguimiento: e.target.value })}
                                    >
                                        <option value=""> Lider de seguimiento</option>
                                        {lider.map(lider => (
                                            <option key={lider} value={lider}>{lider}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group col-4">
                                    <label>Empleado</label>
                                    <select
                                        value={newUser.empleado}
                                        onChange={(e) => setNewUser({ ...newUser, empleado: e.target.value })}
                                        disabled={newUser.role !== 'Empleado'}
                                    >
                                        <option value="">Seleccionar empleado</option>
                                        {empleados.map(empleado => (
                                            <option key={empleado.id} value={empleado.id}>
                                                {empleado.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Estado y acciones */}
                            <div className="form-row">
                                <div className="form-group col-6">
                                    <label>Estado</label>
                                    <select
                                        value={newUser.estado}
                                        onChange={(e) => setNewUser({ ...newUser, estado: e.target.value })}
                                    >
                                        <option value="Activo">Activo</option>
                                        <option value="Inactivo">Inactivo</option>
                                    </select>
                                </div>
                            </div>

                            {/* Botones */}
                            <div className="form-actions">
                                <button type="button" className="cancel-button" onClick={() => setShowAddForm(false)}>
                                    <FaTimes /> {" "} Cancelar
                                </button>
                                <button type="button" className="save-button" onClick={handleGuardarUsuario}>
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

export default UserModal;

