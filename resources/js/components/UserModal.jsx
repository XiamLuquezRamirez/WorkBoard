import React, { useState, useEffect } from 'react';
import { FaPlus,
    FaEdit,
    FaUser,
    FaLock,
    FaEnvelope,
    FaCamera,
    FaSave,
    FaTimes,
    FaUsers,
    FaBan,
    FaCheck,
    FaArrowLeft } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';
import Swal from 'sweetalert2';
import Paginador from './Paginador';

const ROLES = ['Administrador', 'Supervisor', 'Empleado'];

const errorDe = (error, porDefecto) => {
    const d = error?.response?.data;
    if (d?.errors) return Object.values(d.errors).flat().join(' ');
    return d?.error || d?.message || porDefecto;
};

const UserModal = ({ isOpen, onClose }) => {
    // Solo un Administrador puede dar el rol de Administrador (el servidor
    // también lo exige); a un Supervisor la opción se le muestra deshabilitada.
    const soyAdministrador = (() => {
        try {
            return JSON.parse(localStorage.getItem('userWorkBoard') || '{}').tipo_usuario === 'Administrador';
        } catch {
            return false;
        }
    })();
    const [showAddForm, setShowAddForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [usuarios, setUsuarios] = useState([]);
    const [empleados, setEmpleados] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(5);
    const [guardando, setGuardando] = useState(false);
    const [cambiandoEstado, setCambiandoEstado] = useState(null);

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
        lider_seguimiento: 'No',
        foto: null,
        fotoPreview: ''
    };

    const [newUser, setNewUser] = useState(initialUserState);

    // Calcular los usuarios a mostrar según la página actual
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = usuarios.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(usuarios.length / itemsPerPage);

    useEffect(() => {
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

    const recargar = () => (searchTerm.length > 0 ? buscarUsuarios() : cargarUsuarios());

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

    // La contraseña sólo se pide al crear o si se marcó «Cambiar contraseña».
    const pideContrasena = newUser.accion === 'guardar' || newUser.cambiar_password;

    //guardar usuario
    const handleGuardarUsuario = () => {
        if (!newUser.name || !newUser.email || !newUser.role) {
            Swal.fire({
                title: 'Faltan datos',
                text: 'Completa nombre, email y rol.',
                icon: 'warning',
                confirmButtonText: 'OK',
            });
            return;
        }

        if (pideContrasena) {
            if (!newUser.password || !newUser.password_confirmation) {
                Swal.fire({
                    title: 'Falta la contraseña',
                    text: newUser.accion === 'guardar'
                        ? 'Escribe y confirma la contraseña del usuario nuevo.'
                        : 'Escribe y confirma la nueva contraseña, o desmarca «Cambiar contraseña».',
                    icon: 'warning',
                    confirmButtonText: 'OK',
                });
                return;
            }

            if (newUser.password.length < 6) {
                Swal.fire({
                    title: 'Contraseña muy corta',
                    text: 'La contraseña debe tener al menos 6 caracteres.',
                    icon: 'warning',
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
        delete userData.fotoPreview;
        if (!pideContrasena) {
            delete userData.password;
            delete userData.password_confirmation;
        }

        setGuardando(true);
        axiosInstance.post('/guardarUsuario', userData)
            .then(() => {
                Swal.fire({
                    title: 'Usuario guardado correctamente',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false,
                });
                setShowAddForm(false);
                setNewUser(initialUserState);
                recargar();
            })
            .catch((error) => {
                console.error('Error al guardar el usuario:', error);
                Swal.fire({
                    title: 'Error',
                    text: errorDe(error, 'Hubo un error al guardar el usuario'),
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
            })
            .finally(() => setGuardando(false));
    };

    // Desactivar no borra: el usuario sigue en la lista y no puede entrar
    // hasta que se reactive.
    const handleCambiarEstado = async (usuario) => {
        const activar = usuario.estado === 'Inactivo';
        const { isConfirmed } = await Swal.fire({
            title: activar ? `¿Activar a ${usuario.name}?` : `¿Desactivar a ${usuario.name}?`,
            text: activar
                ? 'Podrá volver a iniciar sesión.'
                : 'No podrá iniciar sesión. Sus tareas e historial se conservan y puedes reactivarlo cuando quieras.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: activar ? 'Sí, activar' : 'Sí, desactivar',
            confirmButtonColor: activar ? '#16a34a' : '#dc2626',
            cancelButtonText: 'Cancelar'
        });
        if (!isConfirmed) return;

        setCambiandoEstado(usuario.id);
        try {
            const r = await axiosInstance.post(`/usuarios/${usuario.id}/estado`, { estado: activar ? 'Activo' : 'Inactivo' });
            setUsuarios(prev => prev.map(u => (u.id === usuario.id ? { ...u, estado: r.data.estado } : u)));
        } catch (error) {
            Swal.fire('Error', errorDe(error, 'No se pudo cambiar el estado del usuario.'), 'error');
        } finally {
            setCambiandoEstado(null);
        }
    };

    const handleEditarUsuario = (usuario) => {
        setNewUser({
            ...usuario,
            password: '',
            password_confirmation: '',
            // Editar no obliga a cambiar la contraseña: sólo si se marca.
            cambiar_password: false,
            accion: 'editar',
            role: usuario.tipo_usuario,
            empleado: usuario.empleado || '',
            estado: usuario.estado || 'Activo',
            id: usuario.id,
            foto: usuario.foto,
            fotoPreview: usuario.foto,
            lider_seguimiento: usuario.lider_seguimiento === 'Si' ? 'Si' : 'No'
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
                            <FaUsers style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />Gestión de Usuarios
                        </h2>
                    </div>
                    <button className="close-button" onClick={onClose}><FaTimes /></button>
                </div>

                {/* Barra de herramientas (Buscar + Nuevo Usuario) */}
                <div className="dm-toolbar">
                    <input
                        type="text"
                        className="dm-search"
                        placeholder="Buscar por nombre, email, rol o empleado…"
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
                                    {currentItems.map(usuario => {
                                        const inactivo = usuario.estado === 'Inactivo';
                                        return (
                                            <tr key={usuario.id} style={inactivo ? { opacity: 0.6 } : undefined}>
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
                                                    <span className={`status-badge ${(usuario.estado || 'Activo').toLowerCase()}`}>
                                                        {usuario.estado || 'Activo'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="dm-actions">
                                                        <button onClick={() => handleEditarUsuario(usuario)} className="dm-action-btn dm-action-btn--edit" title="Editar">
                                                            <FaEdit />
                                                        </button>
                                                        <button
                                                            onClick={() => handleCambiarEstado(usuario)}
                                                            className={`dm-action-btn ${inactivo ? 'dm-action-btn--toggle-on' : 'dm-action-btn--toggle-off'}`}
                                                            title={inactivo ? 'Activar' : 'Desactivar'}
                                                            disabled={cambiandoEstado === usuario.id}
                                                        >
                                                            {inactivo ? <FaCheck /> : <FaBan />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
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
                        <form className="employee-form" onSubmit={(e) => e.preventDefault()}>

                            {/* Foto */}
                            <div className="form-row">
                                <div className="form-group col-12">
                                    <div className="foto-upload-container">
                                        <div className="foto-preview">
                                            {newUser.fotoPreview ? (
                                                <>
                                                    <img src={newUser.fotoPreview} alt="Vista previa" className="avatar-preview" />
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

                            {/* Contraseñas: obligatorias al crear; al editar, sólo si se marca */}
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
                                            Cambiar contraseña
                                        </label>
                                    </div>
                                </div>
                            )}
                            {pideContrasena && (
                                <div className="form-row">
                                    <div className="form-group col-6">
                                        <label>{newUser.accion === 'guardar' ? 'Contraseña' : 'Nueva contraseña'}</label>
                                        <div className="input-icon">
                                            <FaLock />
                                            <input
                                                type="password"
                                                autoComplete="new-password"
                                                value={newUser.password}
                                                onChange={(e) =>
                                                    setNewUser({ ...newUser, password: e.target.value })
                                                }
                                                placeholder="Mínimo 6 caracteres"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group col-6">
                                        <label>Confirmar contraseña</label>
                                        <div className="input-icon">
                                            <FaLock />
                                            <input
                                                type="password"
                                                autoComplete="new-password"
                                                value={newUser.password_confirmation}
                                                onChange={(e) =>
                                                    setNewUser({ ...newUser, password_confirmation: e.target.value })
                                                }
                                                placeholder="Repite la contraseña"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Rol y Empleado */}
                            <div className="form-row">
                                <div className="form-group col-6">
                                    <label>Rol</label>
                                    <select
                                        value={newUser.role}
                                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                    >
                                        <option value="">Seleccionar rol</option>
                                        {ROLES.filter(rol => rol !== 'Administrador' || soyAdministrador || newUser.role === 'Administrador').map(rol => (
                                            <option key={rol} value={rol} disabled={rol === 'Administrador' && !soyAdministrador}>{rol}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group col-6">
                                    <label>{newUser.role === 'Empleado' ? 'Empleado' : 'Ficha de empleado (opcional)'}</label>
                                    <select
                                        value={newUser.empleado}
                                        onChange={(e) => setNewUser({ ...newUser, empleado: e.target.value })}
                                    >
                                        <option value="">{newUser.role === 'Empleado' ? 'Seleccionar empleado' : 'Sin ficha'}</option>
                                        {empleados.map(empleado => (
                                            <option key={empleado.id} value={empleado.id}>
                                                {empleado.nombre}
                                            </option>
                                        ))}
                                    </select>
                                    {newUser.role && newUser.role !== 'Empleado' && (
                                        <small style={{ display: 'block', marginTop: 4, fontSize: '0.75rem', color: '#64748b', lineHeight: 1.35 }}>
                                            Con su ficha aparece en el plano, chatea y convoca reuniones con su nombre.
                                            Sin ficha sólo puede mirar el espacio de trabajo.
                                        </small>
                                    )}
                                </div>
                            </div>

                            {/* Que alguien sea líder se decide en su ficha de
                                empleado y en Departamentos. Aquí sólo queda el
                                administrador que recibe el seguimiento de los
                                líderes, que no tiene ficha de empleado. */}
                            {newUser.role === 'Administrador' && (
                                <div className="form-group col-12">
                                    <div className="visto-bueno-checkbox">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={newUser.lider_seguimiento === 'Si'}
                                                onChange={(e) => setNewUser({ ...newUser, lider_seguimiento: e.target.checked ? 'Si' : 'No' })}
                                            />
                                            Recibe los avisos de seguimiento de los líderes
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Estado */}
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
                                <button type="button" className="save-button" onClick={handleGuardarUsuario} disabled={guardando}>
                                    <FaSave /> {" "} {guardando ? 'Guardando…' : 'Guardar'}
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
