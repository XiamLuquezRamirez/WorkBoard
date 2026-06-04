import React, { useEffect, useState } from 'react';
import axiosInstance from '../axiosConfig';
import { getImageUrl, getAssetUrl } from '../utils/assetHelper';
import Header from './Header';
import Sidebar from './Sidebar';
import { useUser } from './UserContext';
import TaskDetailsModal from './TaskDetailsModal';
import EmployeeInterface from './EmployeeInterface';
import Swal from 'sweetalert2';

import {
    FaSearch,
    FaUser,
    FaTasks,
    FaCheckCircle,
    FaSpinner,
    FaClock,
    FaTimes,
    FaArrowLeft,
    FaEye,
    FaCheck,
    FaEnvelope,
    FaUserTie,
    FaBuilding,
    FaCalendar,
    FaPause,
    FaFolder,
    FaPlus,
    FaSave
} from 'react-icons/fa';
import { FaCircleCheck, FaCircle, FaCircleXmark } from 'react-icons/fa6';

// Definidos fuera de `Dashboard` para evitar remount del modal
// en cada cambio de estado del Dashboard (se percibe como "recarga").
const ProfileModal = ({ employee, onClose }) => {
    const [activeTab, setActiveTab] = useState('contacto'); // 'contacto' | 'funciones'
    const tabContactoId = 'profile-tab-contacto';
    const tabFuncionesId = 'profile-tab-funciones';
    const panelContactoId = 'profile-panel-contacto';
    const panelFuncionesId = 'profile-panel-funciones';

    return (
        <div className="modal-overlay">
            <div className="profile-modal">
                <div className="modal-header">
                    <h2>PERFIL DE {employee.nombre}</h2>
                    <button className="close-button" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>
                <div className="modal-content">
                    <div className="profile-section">
                        <div className="profile-header">
                            <div className="profile-photo-container">
                                <img
                                    src={employee.foto}
                                    alt={employee.nombre}
                                    className="profile-photo"
                                />
                            </div>
                            <div className="profile-info">
                                <h3 style={{ textTransform: 'capitalize' }}>{employee.nombre}</h3>
                                <p className="cargo">{employee.cargo}</p>
                                <p className="empresa">
                                    {employee.empresa} - {employee.departamento}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="profile-sections">
                        <div className="profile-tabs" role="tablist" aria-label="Información del perfil">
                            <button
                                type="button"
                                id={tabContactoId}
                                className={`profile-tab ${activeTab === 'contacto' ? 'active' : ''}`}
                                role="tab"
                                aria-selected={activeTab === 'contacto'}
                                aria-controls={panelContactoId}
                                onClick={() => setActiveTab('contacto')}
                            >
                                Información de contacto
                            </button>
                            <button
                                type="button"
                                id={tabFuncionesId}
                                className={`profile-tab ${activeTab === 'funciones' ? 'active' : ''}`}
                                role="tab"
                                aria-selected={activeTab === 'funciones'}
                                aria-controls={panelFuncionesId}
                                onClick={() => setActiveTab('funciones')}
                            >
                                Funciones activas
                            </button>
                        </div>

                        <div
                            id={panelContactoId}
                            role="tabpanel"
                            aria-labelledby={tabContactoId}
                            hidden={activeTab !== 'contacto'}
                            className="profile-tabpanel"
                        >
                            <div className="profile-details">
                                <div className="info-section">
                                    <h4>Información de Contacto</h4>
                                    <div className="contact-info">
                                        <p>
                                            <strong>Email:</strong>{' '}
                                            {employee.contacto?.email}
                                        </p>
                                        <p>
                                            <strong>Teléfono:</strong>{' '}
                                            {employee.contacto?.telefono}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div
                            id={panelFuncionesId}
                            role="tabpanel"
                            aria-labelledby={tabFuncionesId}
                            hidden={activeTab !== 'funciones'}
                            className="profile-tabpanel"
                        >
                            <div className="info-funciones">
                                <h4>Funciones activas</h4>
                                <ul className="funciones-list">
                                    {employee.funciones?.map((funciones, index) => (
                                        <li key={index}>{funciones.descripcion}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TasksModal = ({
    employee,
    onClose,
    proyectos,
    mostrarFormTarea,
    setMostrarFormTarea,
    nuevaTarea,
    setNuevaTarea,
    showChecklist,
    setShowChecklist,
    checklistTitulo,
    setChecklistTitulo,
    checklistsExistentes,
    selectedChecklistId,
    subtareasForm,
    setSubtareasForm,
    nuevaSubtareaTexto,
    setNuevaSubtareaTexto,
    nuevaSubtareaFecha,
    setNuevaSubtareaFecha,
    isSavingTarea,
    handleGuardarTareaDesdeBoard,
    loadChecklistsExistentes,
    handleCopyChecklist,
    setChecklistsExistentes,
    setSelectedChecklistId,
    selectedEstado,
    setSelectedEstado,
    tareasFiltradas,
    setTareasFiltradas,
    setSelectedTask,
    setShowTaskDetails,
    showTaskDetails,
    selectedTask,
    selectedEmployee,
    setSelectedEmployee,
    setEmpleados,
    getStatusClass,
    getStatusIcon,
}) => {
    const estados = [
        { id: 'Todas', title: 'Todas las Tareas', icon: FaTasks, color: '#6b7280', count: employee.tareas?.length || 0 },
        { id: 'Pendiente', title: 'Pendientes', icon: FaClock, color: '#f97316', count: employee.tareas?.filter(t => t.estado === 'Pendiente').length || 0 },
        { id: 'En Proceso', title: 'En Proceso', icon: FaSpinner, color: '#2563eb', count: employee.tareas?.filter(t => t.estado === 'En Proceso').length || 0 },
        { id: 'Completada', title: 'Completadas', icon: FaCheck, color: '#16a34a', count: employee.tareas?.filter(t => t.estado === 'Completada').length || 0 },
    ];

    const handleEstadoClick = (estado) => {
        setSelectedEstado(estado);
        if (estado === 'Todas') setTareasFiltradas(employee.tareas || []);
        else setTareasFiltradas(employee.tareas?.filter(t => t.estado === estado) || []);
    };

    const handleTaskClick = (task) => {
        setSelectedTask(task);
        setShowTaskDetails(true);
    };

    const handleBackToEstados = () => {
        setSelectedEstado(null);
        setTareasFiltradas([]);
    };

    const renderIcon = (iconName) => {
        switch (iconName) {
            case 'FaClock': return <FaClock />;
            case 'FaSpinner': return <FaSpinner />;
            case 'FaCheck': return <FaCheck />;
            default: return null;
        }
    };

    return (
        <>
        <div className="modal-overlay">
            <div className="modal-content tasks-modal">
                <div className="modal-header">
                    <h2 style={{ textTransform: 'capitalize' }}>
                        {mostrarFormTarea ? 'NUEVA TAREA' : `TAREAS DE ${employee.nombre}`}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {!mostrarFormTarea && (
                            <button className="add-button" onClick={() => setMostrarFormTarea(true)}>
                                <FaPlus /> Nueva Tarea
                            </button>
                        )}
                        <button className="close-button" onClick={() => { setMostrarFormTarea(false); onClose(); }}>
                            <FaTimes />
                        </button>
                    </div>
                </div>
                <div className="modal-body">
                    {mostrarFormTarea ? (
                        <div className="tarea-form">
                            <div className="form-row">
                                <div className="form-group col-12">
                                    <label className="form-label">Título</label>
                                    <input
                                        type="text"
                                        value={nuevaTarea.titulo}
                                        onChange={e => setNuevaTarea({ ...nuevaTarea, titulo: e.target.value })}
                                        placeholder="Título de la tarea"
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group col-4">
                                    <label className="form-label">Fecha Pactada</label>
                                    <input
                                        type="date"
                                        value={nuevaTarea.fecha_pactada}
                                        onChange={e => setNuevaTarea({ ...nuevaTarea, fecha_pactada: e.target.value })}
                                    />
                                </div>
                                <div className="form-group col-4">
                                    <label>Prioridad</label>
                                    <select value={nuevaTarea.prioridad} onChange={e => setNuevaTarea({ ...nuevaTarea, prioridad: e.target.value })}>
                                        <option value="Alta">Alta</option>
                                        <option value="Media">Media</option>
                                        <option value="Baja">Baja</option>
                                    </select>
                                </div>
                                <div className="form-group col-4">
                                    <label>Estado</label>
                                    <select value={nuevaTarea.estado} onChange={e => setNuevaTarea({ ...nuevaTarea, estado: e.target.value })}>
                                        <option value="Pendiente">Pendiente</option>
                                        <option value="En Proceso">En Proceso</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group col-12">
                                <label>Descripción</label>
                                <textarea
                                    value={nuevaTarea.descripcion}
                                    onChange={e => setNuevaTarea({ ...nuevaTarea, descripcion: e.target.value })}
                                    placeholder="Descripción detallada de la tarea"
                                    rows="3"
                                />
                            </div>
                            <div className="form-group col-12">
                                <label>Proyecto (opcional)</label>
                                <select value={nuevaTarea.proyecto_id} onChange={e => setNuevaTarea({ ...nuevaTarea, proyecto_id: e.target.value })}>
                                    <option value="">Sin proyecto</option>
                                    {proyectos.map(p => (
                                        <option key={p.id} value={p.id}>{p.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Checklist — habilitado aunque no haya proyecto */}
                            <div className="form-group col-12">
                                <div className="checklist-toggle-row">
                                    <button
                                        type="button"
                                        className={`checklist-toggle-btn${showChecklist ? ' active' : ''}`}
                                        onClick={() => {
                                            if (!showChecklist && employee?.id) {
                                                loadChecklistsExistentes(employee.id);
                                            }
                                            setShowChecklist(prev => !prev);
                                        }}
                                    >
                                        ☑ Checklist
                                    </button>
                                </div>
                                {showChecklist && (
                                    <div className="checklist-form-section">
                                        <div className="checklist-header-row">
                                            <input
                                                type="text"
                                                className="checklist-titulo-input"
                                                placeholder="Título del checklist (opcional)..."
                                                value={checklistTitulo}
                                                onChange={e => setChecklistTitulo(e.target.value)}
                                            />
                                            {checklistsExistentes.length > 0 && (
                                                <select
                                                    className="checklist-copy-select"
                                                    value={selectedChecklistId}
                                                    onChange={e => handleCopyChecklist(e.target.value)}
                                                >
                                                    <option value="">Copiar de existente...</option>
                                                    {checklistsExistentes.map(c => (
                                                        <option key={c.tarea_id} value={c.tarea_id}>
                                                            {c.tarea_titulo}{c.checklist_titulo ? ` — ${c.checklist_titulo}` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                        {subtareasForm.length > 0 && (
                                            <ul className="subtareas-list" style={{ marginBottom: '0.5rem' }}>
                                                {subtareasForm.map(s => (
                                                    <li key={s.tempId} className="subtarea-item">
                                                        <input
                                                            type="text"
                                                            className="subtarea-edit-input"
                                                            value={s.titulo}
                                                            onChange={e => setSubtareasForm(prev =>
                                                                prev.map(x => x.tempId === s.tempId ? { ...x, titulo: e.target.value } : x)
                                                            )}
                                                            placeholder="Descripción del ítem..."
                                                        />
                                                        <input
                                                            type="date"
                                                            className="subtarea-edit-date"
                                                            value={s.fecha_vencimiento || ''}
                                                            onChange={e => setSubtareasForm(prev =>
                                                                prev.map(x => x.tempId === s.tempId ? { ...x, fecha_vencimiento: e.target.value } : x)
                                                            )}
                                                            title="Fecha de vencimiento"
                                                        />
                                                        <button
                                                            type="button"
                                                            className="subtarea-delete"
                                                            style={{ opacity: 1 }}
                                                            onClick={() => setSubtareasForm(prev => prev.filter(x => x.tempId !== s.tempId))}
                                                        >
                                                            <FaTimes />
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        <div className="subtarea-add-row">
                                            <input
                                                type="text"
                                                className="subtarea-add-input"
                                                placeholder="Ítem del checklist..."
                                                value={nuevaSubtareaTexto}
                                                onChange={e => setNuevaSubtareaTexto(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (!nuevaSubtareaTexto.trim()) return;
                                                        setSubtareasForm(prev => [...prev, { tempId: Date.now(), titulo: nuevaSubtareaTexto.trim(), fecha_vencimiento: nuevaSubtareaFecha }]);
                                                        setNuevaSubtareaTexto('');
                                                        setNuevaSubtareaFecha('');
                                                    }
                                                }}
                                            />
                                            <input
                                                type="date"
                                                className="subtarea-add-date"
                                                value={nuevaSubtareaFecha}
                                                onChange={e => setNuevaSubtareaFecha(e.target.value)}
                                                title="Fecha de vencimiento"
                                            />
                                            <button
                                                type="button"
                                                className="subtarea-add-btn"
                                                disabled={!nuevaSubtareaTexto.trim()}
                                                onClick={() => {
                                                    if (!nuevaSubtareaTexto.trim()) return;
                                                    setSubtareasForm(prev => [...prev, { tempId: Date.now(), titulo: nuevaSubtareaTexto.trim(), fecha_vencimiento: nuevaSubtareaFecha }]);
                                                    setNuevaSubtareaTexto('');
                                                    setNuevaSubtareaFecha('');
                                                }}
                                            >
                                                <FaPlus />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="form-actions">
                                <button className="cancel-button" onClick={() => {
                                    setMostrarFormTarea(false);
                                    setNuevaTarea({ titulo: '', descripcion: '', fecha_pactada: '', estado: 'Pendiente', prioridad: 'Media', proyecto_id: '', accion: 'guardar' });
                                    setSubtareasForm([]);
                                    setNuevaSubtareaTexto('');
                                    setNuevaSubtareaFecha('');
                                    setShowChecklist(false);
                                    setChecklistTitulo('');
                                    setSelectedChecklistId('');
                                    setChecklistsExistentes([]);
                                }}>
                                    <FaTimes /> Cancelar
                                </button>
                                <button className="save-button" onClick={handleGuardarTareaDesdeBoard} disabled={isSavingTarea}>
                                    <FaSave /> {isSavingTarea ? 'Guardando...' : 'Guardar Tarea'}
                                </button>
                            </div>
                        </div>
                    ) : !selectedEstado ? (
                        <div className="estados-cards">
                            {estados.map((estado) => (
                                <div
                                    key={estado.id}
                                    className="estado-card"
                                    onClick={() => handleEstadoClick(estado.id)}
                                    style={{ borderTop: `4px solid ${estado.color}` }}
                                >
                                    <div className="estado-card-header">
                                        {renderIcon(estado.icon)}
                                        <h3>{estado.title}</h3>
                                    </div>
                                    <div className="estado-card-count">
                                        <span>{estado.count}</span>
                                        <span>tareas</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="tareas-container">
                            <div className="tareas-header">
                                <button className="back-button" onClick={handleBackToEstados}>
                                    <FaArrowLeft /> Volver
                                </button>
                                <h3 style={{ marginTop: '15px' }}>{estados.find(e => e.id === selectedEstado)?.title}</h3>
                            </div>
                            <div className="tareas-list">
                                {tareasFiltradas.length > 0 ? (
                                    tareasFiltradas.map(tarea => (
                                        <div
                                            key={tarea.id}
                                            className="tarea-card"
                                            onClick={() => handleTaskClick(tarea)}
                                        >
                                            <div className="tarea-card-header">
                                                <h4>{tarea.titulo}</h4>
                                                <span className={`status ${getStatusClass(tarea.estado)}`}>
                                                    {getStatusIcon(tarea.estado)}
                                                </span>
                                            </div>
                                            <p className="tarea-descripcion">{tarea.descripcion}</p>
                                            <div className="tarea-card-footer">
                                                <span className="tarea-fechas">
                                                    {tarea.fecha_asignacion && (
                                                        <span>
                                                            {" "} <FaCalendar style={{ color: '#1D4ED8', backgroundColor: '#dceffb', borderRadius: '50%', padding: '2px' }} size={13} /> <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Fecha asignación:</label> {new Date(new Date(tarea.fecha_asignacion).getTime() + 24 * 60 * 60 * 1000).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                    {tarea.fecha_aprobacion && (
                                                        <span>
                                                            {" "} <FaCheck style={{ color: '#008000' }} size={13} /> <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Fecha aprobación:</label> {
                                                            tarea.fecha_aprobacion !== '0000-00-00'
                                                                ? new Date(new Date(tarea.fecha_aprobacion).getTime() + 24 * 60 * 60 * 1000).toLocaleDateString()
                                                                : "No aprobada"
                                                            }
                                                        </span>
                                                    )}
                                                    {tarea.fecha_pactada && (
                                                        <span>
                                                            {" "} <FaClock style={{ color: '#C2410C', backgroundColor: '#f9cccf', borderRadius: '50%', padding: '2px' }} size={13} /> <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Fecha pactada:</label> {new Date(new Date(tarea.fecha_pactada).getTime() + 24 * 60 * 60 * 1000).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="ver-detalles"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleTaskClick(tarea);
                                                    }}
                                                >
                                                    <FaEye /> Ver detalles
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="no-tareas">
                                        <p>No hay tareas en este estado</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        {showTaskDetails && selectedTask && (
            <TaskDetailsModal
                task={selectedTask}
                onClose={() => setShowTaskDetails(false)}
                overlayZIndex={10000}
                onUpdate={() => {
                    axiosInstance
                        .get("/dashboard/cargarEmpleadosTareas")
                        .then((response) => {
                            const empleadoActualizado = response.data.find(emp => emp.id === selectedEmployee.id);
                            if (empleadoActualizado) {
                                setSelectedTask(prev => {
                                    if (!prev) return prev;
                                    return empleadoActualizado.tareas.find(t => t.id === prev.id) || prev;
                                });

                                setTareasFiltradas(prev => {
                                    if (!selectedEstado) return prev;
                                    if (selectedEstado === 'Todas') return empleadoActualizado.tareas || [];
                                    return (empleadoActualizado.tareas || []).filter(t => t.estado === selectedEstado);
                                });

                                setSelectedEmployee(empleadoActualizado);
                                setEmpleados(prevEmpleados =>
                                    prevEmpleados.map(emp =>
                                        emp.id === empleadoActualizado.id ? empleadoActualizado : emp
                                    )
                                );
                            }
                        })
                        .catch((error) => {
                            console.error("Error al actualizar los datos:", error);
                        });
                }}
            />
        )}
        </>
    );
};

const Dashboard = () => {
    const { user, loading } = useUser();
    const [error, setError] = useState('');
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeMenu, setActiveMenu] = useState('dashboard');
    const [currentView, setCurrentView] = useState('dashboard');
    const [searchTerm, setSearchTerm] = useState("");
    const [empleados, setEmpleados] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showTasksModal, setShowTasksModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [isLoading2, setIsLoading2] = useState(false);
    const [selectedEstado, setSelectedEstado] = useState(null);
    const [tareasFiltradas, setTareasFiltradas] = useState([]);
    const [showTaskDetails, setShowTaskDetails] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [mostrarFormTarea, setMostrarFormTarea] = useState(false);
    const [nuevaTarea, setNuevaTarea] = useState({
        titulo: '', descripcion: '', fecha_pactada: '', estado: 'Pendiente',
        prioridad: 'Media', proyecto_id: '', accion: 'guardar'
    });
    const [proyectos, setProyectos] = useState([]);
    const [subtareasForm, setSubtareasForm] = useState([]);
    const [nuevaSubtareaTexto, setNuevaSubtareaTexto] = useState('');
    const [nuevaSubtareaFecha, setNuevaSubtareaFecha] = useState('');
    const [isSavingTarea, setIsSavingTarea] = useState(false);
    const [checklistTitulo, setChecklistTitulo] = useState('');
    const [showChecklist, setShowChecklist] = useState(false);
    const [checklistsExistentes, setChecklistsExistentes] = useState([]);
    const [selectedChecklistId, setSelectedChecklistId] = useState('');
    const [filterDepartamento, setFilterDepartamento] = useState('');



    useEffect(() => {
        document.title = "Dashboard - WorkBoard";
    }, []);

    useEffect(() => {
        axiosInstance.get('/cargarProyectos').then(r => setProyectos(r.data)).catch(() => {});
    }, []);

    const handleLogout = async () => {
        try {
            await axiosInstance.post('/logout');
            window.location.href = getAssetUrl('/login');
            localStorage.clear();
            window.location.reload();

        } catch (error) {
            setError('Error al cerrar sesión');
            setIsLoading(false);
        }
    };

    //Cargar empleados y tareas

    useEffect(() => {
        if (!isLoading) {
            cargarEmpleados();
        }
    }, [isLoading]);


    const cargarEmpleados = async () => {
        setIsLoading2(true);
        axiosInstance
            .get("/dashboard/cargarEmpleadosTareas")
            .then((response) => {
                console.log(response.data);
                setEmpleados(response.data);
                setIsLoading2(false);
            })
            .catch((error) => {
                console.error("Error al cargar los empleados:", error);
                setIsLoading2(false);
            })
            .finally(() => {
                setIsLoading2(false);
            });
    };

    const calcularIndiceDesempeno = (empleado) => {
        const tareas = (empleado.tareas || []).filter(t => t.estado_reg === 'Activo' && t.pausada !== 1);
        const hoy = new Date().toISOString().split('T')[0];
        const asignadas = tareas.length;
        if (asignadas === 0) return null;

        const completadas   = tareas.filter(t => t.estado === 'Completada').length;
        const atrasadas     = tareas.filter(t => t.fecha_pactada && t.fecha_pactada < hoy && t.estado !== 'Completada').length;
        const aTiempo       = tareas.filter(t =>
            t.estado === 'Completada' && t.fecha_entregada && t.fecha_entregada <= t.fecha_pactada
        ).length;
        const reprocesadas  = tareas.filter(t => t.rechazada == 1).length;

        // 4 tasas (0–1), cada una protegida contra división por cero y datos corruptos
        const tasaCompletitud = completadas / asignadas;
        const tasaPuntualidad = aTiempo / Math.max(completadas, 1);
        const tasaVigencia    = 1 - Math.min(atrasadas / asignadas, 1);
        const tasaCalidad     = 1 - Math.min(reprocesadas / Math.max(completadas, 1), 1);

        // Pesos: 40 + 25 + 20 + 15 = 100
        const score =
            tasaCompletitud * 40 +
            tasaPuntualidad * 25 +
            tasaVigencia    * 20 +
            tasaCalidad     * 15;

        return Math.max(0, Math.min(100, Math.round(score)));
    };

    const clasificarEmpleado = (id) => {
        if (id === null)  return { nivel: 'sin-datos', label: 'Sin datos',  color: '#9ca3af' };
        if (id >= 75)     return { nivel: 'alto',      label: '🟢 Alto',    color: '#16a34a' };
        if (id >= 50)     return { nivel: 'medio',     label: '🟡 Medio',   color: '#f59e0b' };
        return                  { nivel: 'bajo',       label: '🔴 Bajo',    color: '#dc2626' };
    };

    const generarMensaje = (emp, id) => {
        if (id === null) return 'Sin tareas asignadas.';
        const hoy = new Date().toISOString().split('T')[0];
        const tareas = (emp.tareas || []).filter(t => t.estado_reg === 'Activo' && t.pausada !== 1);
        const completadas   = tareas.filter(t => t.estado === 'Completada').length;
        const atrasadas     = tareas.filter(t => t.fecha_pactada && t.fecha_pactada < hoy && t.estado !== 'Completada').length;
        const reprocesadas  = tareas.filter(t => t.rechazada == 1).length;
        const proximas      = tareas.filter(t => {
            if (t.estado === 'Completada') return false;
            const dias = Math.ceil((new Date(t.fecha_pactada) - new Date(hoy)) / 86400000);
            return dias >= 0 && dias <= 3;
        }).length;

        const pluralT = (n) => `${n} tarea${n !== 1 ? 's' : ''}`;

        if (id >= 75) {
            if (reprocesadas > 0)
                return `Buen rendimiento. ${pluralT(reprocesadas)} con reproceso afectan la calidad.`;
            if (atrasadas === 0 && proximas === 0)
                return '¡Excelente rendimiento! Al día con todas las tareas.';
            if (proximas > 0)
                return `Buen rendimiento. ${pluralT(proximas)} por vencer pronto.`;
            return 'Buen rendimiento general.';
        }
        if (id >= 50) {
            if (atrasadas > 0 && reprocesadas > 0)
                return `Rendimiento medio. ${pluralT(atrasadas)} atrasada${atrasadas !== 1 ? 's' : ''} y ${pluralT(reprocesadas)} con reproceso.`;
            if (atrasadas > 0)
                return `Rendimiento medio. ${pluralT(atrasadas)} atrasada${atrasadas !== 1 ? 's' : ''}.`;
            if (reprocesadas > 0)
                return `Rendimiento medio. ${pluralT(reprocesadas)} con reproceso reducen la calidad.`;
            return 'Rendimiento aceptable. Puede mejorar la puntualidad.';
        }
        if (atrasadas > 0 && reprocesadas > 0)
            return `Rendimiento crítico: ${pluralT(atrasadas)} atrasada${atrasadas !== 1 ? 's' : ''} y ${pluralT(reprocesadas)} con reproceso.`;
        if (atrasadas > 0)
            return `Rendimiento crítico. ${pluralT(atrasadas)} atrasada${atrasadas !== 1 ? 's' : ''}.`;
        if (reprocesadas > 0)
            return `Rendimiento bajo. ${pluralT(reprocesadas)} requirieron rehacerse.`;
        return 'Rendimiento bajo. Revisar carga de trabajo.';
    };

    const calcularStatsGlobales = (listaEmpleados) => {
        let tareasActivas = 0;
        let tareasAtrasadas = 0;
        let sumaEficiencia = 0;
        const hoy = new Date().toISOString().split('T')[0];

        listaEmpleados.forEach(emp => {
            const tareas = emp.tareas || [];
            tareasActivas += tareas.filter(t => t.estado === 'Pendiente' || t.estado === 'En Proceso').length;
            tareasAtrasadas += tareas.filter(t =>
                t.fecha_pactada && t.fecha_pactada < hoy &&
                t.estado !== 'Completada' && t.pausada !== 1
            ).length;
            sumaEficiencia += calcularIndiceDesempeno(emp) ?? 0;
        });

        return {
            totalEmpleados: listaEmpleados.length,
            tareasActivas,
            tareasAtrasadas,
            eficienciaPromedio: listaEmpleados.length > 0
                ? Math.round(sumaEficiencia / listaEmpleados.length)
                : 0,
        };
    };

    const contarTareasAtrasadas = (empleado) => {
        const hoy = new Date().toISOString().split('T')[0];
        return (empleado.tareas || []).filter(t =>
            t.fecha_pactada && t.fecha_pactada < hoy &&
            t.estado !== 'Completada' && t.pausada !== 1
        ).length;
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case "Completada":
                return <FaCheckCircle color="#54B743" />;
            case "En Proceso":
                return <FaSpinner color="#377AED" />;
            case "Pendiente":
                return <FaClock color="#c2410c" />;
            default:
                return null;
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case "Completada":
                return "status-completed";
            case "En Proceso":
                return "status-progress";
            case "Pendiente":
                return "status-pending";
            default:
                return "";
        }
    };

    if (loading) {
        return <div>Cargando...</div>;
    }

    if (error) {
        return (
            <div className="error-container">
                <h2>Error de Autenticación</h2>
                <p>{error}</p>
                <button onClick={() => {
                    //localStorage.clear();
                   // window.location.href = getAssetUrl('/login');
                }}>
                    Volver al Login
                </button>
            </div>
        );
    }

    

    if (!user) {
        return (
            <div className="error-container">
                <h2>Acceso Denegado</h2>
                <p>No tienes permisos para acceder a esta página</p>
                <button onClick={() => {
                    // localStorage.clear();
                    // window.location.href = getAssetUrl('/login');
                }}>
                    Volver al Login
                </button>
            </div>
        );
    }

    if (!["Administrador", "Supervisor"].includes(user.tipo_usuario)) {

        return (
            <div className="dashboard-container">
                <Header
                    currentUser={user}
                    showUserMenu={showUserMenu}
                    setShowUserMenu={setShowUserMenu}
                    setIsSidebarOpen={setIsSidebarOpen}
                />
                <EmployeeInterface user={user} />
            </div>
        );
    }

    const loadChecklistsExistentes = async (empleadoId) => {
        try {
            const r = await axiosInstance.get(`/checklists-empleado/${empleadoId}`);
            setChecklistsExistentes(r.data);
        } catch {}
    };

    const handleCopyChecklist = (tareaId) => {
        setSelectedChecklistId(tareaId);
        if (!tareaId) return;
        const found = checklistsExistentes.find(c => c.tarea_id == tareaId);
        if (found) {
            setSubtareasForm(found.items.map((item, i) => ({
                tempId: Date.now() + i,
                titulo: item.titulo,
                fecha_vencimiento: item.fecha_vencimiento || ''
            })));
            if (found.checklist_titulo) setChecklistTitulo(found.checklist_titulo);
        }
    };

    const handleGuardarTareaDesdeBoard = async () => {
        if (!nuevaTarea.titulo.trim() || !nuevaTarea.fecha_pactada) {
            Swal.fire({ title: 'Error', text: 'Complete los campos requeridos (título y fecha pactada)', icon: 'error', confirmButtonText: 'OK' });
            return;
        }
        if (nuevaTarea.descripcion.length < 10) {
            Swal.fire({ title: 'Error', text: 'La descripción debe tener al menos 10 caracteres', icon: 'error', confirmButtonText: 'OK' });
            return;
        }
        setIsSavingTarea(true);
        try {
            const response = await axiosInstance.post('/guardarTarea', {
                ...nuevaTarea,
                empleado: selectedEmployee.id,
                evidencias: []
            });
            if (subtareasForm.length > 0 && response.data.tarea_id) {
                await Promise.all(subtareasForm.map(s =>
                    axiosInstance.post('/subtareas', {
                        tarea_id: response.data.tarea_id,
                        titulo: s.titulo,
                        fecha_vencimiento: s.fecha_vencimiento || null,
                        checklist_titulo: checklistTitulo || null
                    })
                ));
            }
            setSubtareasForm([]);
            setNuevaSubtareaTexto('');
            setNuevaSubtareaFecha('');
            setShowChecklist(false);
            setChecklistTitulo('');
            setSelectedChecklistId('');
            setChecklistsExistentes([]);
            setNuevaTarea({ titulo: '', descripcion: '', fecha_pactada: '', estado: 'Pendiente', prioridad: 'Media', proyecto_id: '', accion: 'guardar' });
            setMostrarFormTarea(false);
            const updated = await axiosInstance.get('/dashboard/cargarEmpleadosTareas');
            const emp = updated.data.find(e => e.id === selectedEmployee.id);
            if (emp) {
                setSelectedEmployee(emp);
                setEmpleados(prev => prev.map(e => e.id === emp.id ? emp : e));
            }
            Swal.fire({ title: 'Tarea guardada correctamente', icon: 'success', confirmButtonText: 'OK' });
        } catch (err) {
            console.error(err);
            Swal.fire({ title: 'Error', text: 'Hubo un error al guardar la tarea', icon: 'error', confirmButtonText: 'OK' });
        } finally {
            setIsSavingTarea(false);
        }
    };

    // Función para filtrar empleados
    const filteredEmpleados = empleados.filter((empleado) => {
        const matchSearch =
            empleado.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            empleado.departamento.toLowerCase().includes(searchTerm.toLowerCase()) ||
            empleado.empresa.toLowerCase().includes(searchTerm.toLowerCase());
        const matchDept = !filterDepartamento || empleado.departamento === filterDepartamento;
        return matchSearch && matchDept;
    });

    const renderContent = () => {
        switch (currentView) {
            case "settings":
                return <Parameters />;
            case "home":
            default: {
                const departamentosUnicos = [...new Set(empleados.map(e => e.departamento).filter(Boolean))].sort();
                const stats = calcularStatsGlobales(filteredEmpleados);
                return (
                    //loading
                    <>
                        {isLoading2 ? (
                            <div className="loader">
                                <div className="justify-content-center jimu-primary-loading"></div>
                            </div>
                        ) : (
                            <div className="cards-container">
                                <div className="dashboard-header">
                                    <h1 className="dashboard-header__title">
                                        Tablero de seguimiento de empleados
                                    </h1>
                                    <div
                                        className="dashboard-header__toolbar"
                                        role="search"
                                        aria-label="Buscar y filtrar empleados"
                                    >
                                        <div className="search-box">
                                            <span className="search-icon" aria-hidden="true">
                                                <FaSearch />
                                            </span>
                                            <input
                                                type="search"
                                                id="dashboard-empleados-buscar"
                                                placeholder="Nombre, departamento o empresa…"
                                                value={searchTerm}
                                                onChange={(e) =>
                                                    setSearchTerm(e.target.value)
                                                }
                                                className="search-input"
                                                autoComplete="off"
                                                aria-label="Buscar empleado por nombre, departamento o empresa"
                                            />
                                        </div>
                                        <div className="dept-filter-container">
                                            <select
                                                id="dashboard-filtro-depto"
                                                value={filterDepartamento}
                                                onChange={(e) =>
                                                    setFilterDepartamento(e.target.value)
                                                }
                                                className="dept-filter-select"
                                                aria-label="Filtrar por departamento"
                                            >
                                                <option value="">Todos los departamentos</option>
                                                {departamentosUnicos.map((dept) => (
                                                    <option key={dept} value={dept}>
                                                        {dept}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="dashboard-content-column">
                                    <div className="dashboard-stats-panel">
                                        <div className="stat-kpi">
                                            <span className="stat-kpi-number">{stats.totalEmpleados}</span>
                                            <span className="stat-kpi-label">Empleados activos</span>
                                        </div>
                                        <div className="stat-kpi">
                                            <span className="stat-kpi-number">{stats.tareasActivas}</span>
                                            <span className="stat-kpi-label">Tareas en curso</span>
                                        </div>
                                        <div
                                            className={`stat-kpi ${stats.tareasAtrasadas > 0 ? 'stat-kpi--alert' : ''}`}
                                        >
                                            <span className="stat-kpi-number">{stats.tareasAtrasadas}</span>
                                            <span className="stat-kpi-label">Tareas atrasadas</span>
                                        </div>
                                        <div className="stat-kpi">
                                            <span className="stat-kpi-number">{stats.eficienciaPromedio}%</span>
                                            <span className="stat-kpi-label">Eficiencia promedio</span>
                                        </div>
                                    </div>
                                    <div className="cards-grid">
                                    {filteredEmpleados.map((empleado) => {
                                        const atrasadas = contarTareasAtrasadas(empleado);
                                        return (
                                        <div
                                            key={empleado.id}
                                            className="employee-card"
                                        >
                                            <div className="employee-main-info">
                                                <img
                                                    src={empleado.foto}
                                                    alt={empleado.nombre}
                                                    className="employee-photo"
                                                />
                                                <div className="employee-details">
                                                    <h3>{empleado.nombre}</h3>
                                                    <p className="cargo">
                                                        <FaUserTie size={13} /> {" "}   {empleado.cargo}
                                                    </p>
                                                    <p className="empresa">
                                                        <FaBuilding size={13} /> {" "}   {empleado.empresa} -{" "}
                                                        {empleado.departamento}
                                                    </p>
                                                    <p className="contacto">
                                                        <FaEnvelope />{" "}
                                                        {empleado.contacto?.email}
                                                    </p>
                                                </div>

                                            </div>
                                            {atrasadas > 0 && (
                                                <div className="employee-card-alert-banner">
                                                    <span className="alert-icon">⚠</span>
                                                    <span>{atrasadas} tarea{atrasadas > 1 ? 's' : ''} atrasada{atrasadas > 1 ? 's' : ''}</span>
                                                </div>
                                            )}
                                            <div className="employee-actions">
                                                <button
                                                    className="action-button profile-btn"
                                                    onClick={() => {
                                                        setSelectedEmployee(
                                                            empleado
                                                        );
                                                        setShowProfileModal(true);
                                                    }}
                                                >
                                                    <FaUser /> Perfil
                                                </button>
                                                <button
                                                    className="action-button tasks-btn"
                                                    onClick={() => {
                                                        setSelectedEmployee(
                                                            empleado
                                                        );
                                                        setShowTasksModal(true);
                                                        setSelectedEstado(null);
                                                    }}
                                                >
                                                    <FaTasks /> Tareas
                                                </button>
                                            </div>
                                            <div className="performance-section">
                                                {(() => {
                                                    const id = calcularIndiceDesempeno(empleado);
                                                    const cls = clasificarEmpleado(id);
                                                    const msg = generarMensaje(empleado, id);
                                                    const r = empleado.rendimiento;
                                                    const tareas = (empleado.tareas || []).filter(t => t.estado_reg === 'Activo' && t.pausada !== 1);
                                                    const completadas = r?.tareas?.completadas || 0;
                                                    const aTiempo = tareas.filter(t => t.estado === 'Completada' && t.fecha_entregada && t.fecha_entregada <= t.fecha_pactada).length;
                                                    const reprocesos = tareas.filter(t => t.rechazada == 1).length;
                                                    const pctATiempo = completadas > 0 ? Math.round((aTiempo / completadas) * 100) : 0;
                                                    return (
                                                        <>
                                                            <div className="desempeno-header">
                                                                <span className="desempeno-title">Índice de Desempeño</span>
                                                                <span className={`desempeno-badge desempeno-badge--${cls.nivel}`}>{cls.label}</span>
                                                            </div>
                                                            {id !== null ? (
                                                                <>
                                                                    <div className="desempeno-score">{id}%</div>
                                                                    <div className="desempeno-bar-wrap">
                                                                        <div className="desempeno-bar" style={{ width: `${id}%`, backgroundColor: cls.color }} />
                                                                    </div>
                                                                    <p className="desempeno-msg">{msg}</p>
                                                                </>
                                                            ) : (
                                                                <p className="desempeno-msg desempeno-msg--empty">Sin tareas asignadas.</p>
                                                            )}
                                                            <div className="task-stats-grid">
                                                                <div className="stat-item">
                                                                    <span className="stat-number">{r?.tareasAsignadas || 0}</span>
                                                                    <span className="stat-label">Asignadas</span>
                                                                </div>
                                                                <div className="stat-item">
                                                                    <span className="stat-number">{completadas}</span>
                                                                    <span className="stat-label">✅ Completadas</span>
                                                                </div>
                                                                <div className="stat-item">
                                                                    <span className="stat-number">{r?.tareas?.enProceso || 0}</span>
                                                                    <span className="stat-label">⏳ En Proceso</span>
                                                                </div>
                                                                <div className="stat-item urgent">
                                                                    <span className="stat-number">{atrasadas}</span>
                                                                    <span className="stat-label">⚠️ Atrasadas</span>
                                                                </div>
                                                            </div>
                                                            <div className="desempeno-secundario">
                                                                <span>A tiempo: {aTiempo}/{completadas} ({pctATiempo}%)</span>
                                                                <span>Reprocesos: {reprocesos}</span>
                                                            </div>
                                                        </>
                                                    );
                                                })()}

                                                <div className="urgent-tasks">
                                                    <h5>Tareas Recientes</h5>
                                                    {empleado.tareasRecientes?.map(
                                                        (tarea) => (
                                                            <div
                                                                key={tarea.id}
                                                                className="urgent-task-item"
                                                            >
                                                                <span>
                                                                    {tarea.titulo}
                                                                </span>
                                                                <span
                                                                    className={`status ${getStatusClass(
                                                                        tarea.estado
                                                                    )}`}
                                                                >
                                                                    {getStatusIcon(
                                                                        tarea.estado
                                                                    )}
                                                                </span>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                    })}
                                </div>
                                </div>
                            </div>
                        )}
                    </>
                );
            }
        }
    };

    const renderInterface = () => {
        if (!currentUser) return null;

        if (currentUser.tipo_usuario === "Administrador") {
            return (
                <div className="dashboard-layout">
                    <div className={`sidebar ${isSidebarOpen ? "active" : ""}`}>
                        <Sidebar />
                    </div>
                    <div className="content-area">{renderContent()}</div>
                </div>
            );
        } else {
            //Si el usuario no es administrador, se quita el sidebar
            return <EmployeeInterface user={currentUser} />;
        }
    };

    // Componente Modal de Perfil (legacy; mantenido sin uso)
    const _ProfileModal = ({ employee, onClose }) => (
        <div className="modal-overlay">
            <div className="profile-modal">
                <div className="modal-header">
                    <h2>PERFIL DE {employee.nombre}</h2>
                    <button className="close-button" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>
                <div className="modal-content">
                    <div className="profile-section">
                        <div className="profile-header">
                            <div className="profile-photo-container">
                                <img
                                    src={employee.foto}
                                    alt={employee.nombre}
                                    className="profile-photo"
                                />
                            </div>
                            <div className="profile-info">
                                <h3 style={{ textTransform: 'capitalize' }}>{employee.nombre}</h3>
                                <p className="cargo">{employee.cargo}</p>
                                <p className="empresa">
                                    {employee.empresa} - {employee.departamento}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="profile-sections">
                        <div className="profile-details">
                            <div className="info-section">
                                <h4>Información de Contacto</h4>
                                <div className="contact-info">
                                    <p>
                                        <strong>Email:</strong>{" "}
                                        {employee.contacto?.email}
                                    </p>
                                    <p>
                                        <strong>Teléfono:</strong>{" "}
                                        {employee.contacto?.telefono}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="info-funciones">
                            <h4>Funciones activas</h4>
                            <ul className="funciones-list">
                                {employee.funciones?.map(
                                    (funciones, index) => (
                                        <li key={index}>{funciones.descripcion}</li>
                                    )
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // Componente Modal de Tareas (legacy; mantenido sin uso)
    const _TasksModal = ({ employee, onClose }) => {
        const estados = [
            {
                id: 'Todas',
                title: 'Todas las Tareas',
                icon: FaTasks,
                color: '#6b7280',
                count: employee.tareas?.length || 0
            },
            {
                id: 'Pendiente',
                title: 'Pendientes',
                icon: FaClock,
                color: '#f97316',
                count: employee.tareas?.filter(t => t.estado === 'Pendiente').length || 0
            },
            {
                id: 'En Proceso',
                title: 'En Proceso',
                icon: FaSpinner,
                color: '#2563eb',
                count: employee.tareas?.filter(t => t.estado === 'En Proceso').length || 0
            },
            {
                id: 'Completada',
                title: 'Completadas',
                icon: FaCheck,
                color: '#16a34a',
                count: employee.tareas?.filter(t => t.estado === 'Completada').length || 0
            }
        ];

        const handleEstadoClick = (estado) => {
            setSelectedEstado(estado);
            if (estado === 'Todas') {
                setTareasFiltradas(employee.tareas || []);
            } else {
                setTareasFiltradas(employee.tareas?.filter(t => t.estado === estado) || []);
            }
        };

        const handleTaskClick = (task) => {
            setSelectedTask(task);

            setShowTaskDetails(true);
        };

        const handleBackToEstados = () => {
            setSelectedEstado(null);
            setTareasFiltradas([]);
        };

        const renderIcon = (iconName) => {
            switch (iconName) {
                case 'FaClock':
                    return <FaClock />;
                case 'FaSpinner':
                    return <FaSpinner />;
                case 'FaCheck':
                    return <FaCheck />;
                default:
                    return null;
            }
        };

        return (
            <div className="modal-overlay">
                <div className="modal-content tasks-modal">
                    <div className="modal-header">
                        <h2 style={{ textTransform: 'capitalize' }}>
                            {mostrarFormTarea ? 'NUEVA TAREA' : `TAREAS DE ${employee.nombre}`}
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {!mostrarFormTarea && (
                                <button className="add-button" onClick={() => setMostrarFormTarea(true)}>
                                    <FaPlus /> Nueva Tarea
                                </button>
                            )}
                            <button className="close-button" onClick={() => { setMostrarFormTarea(false); onClose(); }}>
                                <FaTimes />
                            </button>
                        </div>
                    </div>
                    <div className="modal-body">
                        {mostrarFormTarea ? (
                            <div className="tarea-form">
                                <div className="form-row">
                                    <div className="form-group col-12">
                                        <label className="form-label">Título</label>
                                        <input
                                            type="text"
                                            value={nuevaTarea.titulo}
                                            onChange={e => setNuevaTarea({ ...nuevaTarea, titulo: e.target.value })}
                                            placeholder="Título de la tarea"
                                        />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group col-4">
                                        <label className="form-label">Fecha Pactada</label>
                                        <input
                                            type="date"
                                            value={nuevaTarea.fecha_pactada}
                                            onChange={e => setNuevaTarea({ ...nuevaTarea, fecha_pactada: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group col-4">
                                        <label>Prioridad</label>
                                        <select value={nuevaTarea.prioridad} onChange={e => setNuevaTarea({ ...nuevaTarea, prioridad: e.target.value })}>
                                            <option value="Alta">Alta</option>
                                            <option value="Media">Media</option>
                                            <option value="Baja">Baja</option>
                                        </select>
                                    </div>
                                    <div className="form-group col-4">
                                        <label>Estado</label>
                                        <select value={nuevaTarea.estado} onChange={e => setNuevaTarea({ ...nuevaTarea, estado: e.target.value })}>
                                            <option value="Pendiente">Pendiente</option>
                                            <option value="En Proceso">En Proceso</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group col-12">
                                    <label>Descripción</label>
                                    <textarea
                                        value={nuevaTarea.descripcion}
                                        onChange={e => setNuevaTarea({ ...nuevaTarea, descripcion: e.target.value })}
                                        placeholder="Descripción detallada de la tarea"
                                        rows="3"
                                    />
                                </div>
                                <div className="form-group col-12">
                                    <label>Proyecto (opcional)</label>
                                    <select value={nuevaTarea.proyecto_id} onChange={e => setNuevaTarea({ ...nuevaTarea, proyecto_id: e.target.value })}>
                                        <option value="">Sin proyecto</option>
                                        {proyectos.map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Checklist — solo al crear */}
                                <div className="form-group col-12">
                                    <div className="checklist-toggle-row">
                                        <button
                                            type="button"
                                            className={`checklist-toggle-btn${showChecklist ? ' active' : ''}`}
                                            disabled={!nuevaTarea.proyecto_id}
                                            onClick={() => {
                                                if (!showChecklist && selectedEmployee?.id) {
                                                    loadChecklistsExistentes(selectedEmployee.id);
                                                }
                                                setShowChecklist(prev => !prev);
                                            }}
                                        >
                                            ☑ Checklist
                                        </button>
                                        {!nuevaTarea.proyecto_id && (
                                            <span className="checklist-hint">Selecciona un proyecto para agregar checklist</span>
                                        )}
                                    </div>
                                    {showChecklist && (
                                        <div className="checklist-form-section">
                                            <div className="checklist-header-row">
                                                <input
                                                    type="text"
                                                    className="checklist-titulo-input"
                                                    placeholder="Título del checklist (opcional)..."
                                                    value={checklistTitulo}
                                                    onChange={e => setChecklistTitulo(e.target.value)}
                                                />
                                                {checklistsExistentes.length > 0 && (
                                                    <select
                                                        className="checklist-copy-select"
                                                        value={selectedChecklistId}
                                                        onChange={e => handleCopyChecklist(e.target.value)}
                                                    >
                                                        <option value="">Copiar de existente...</option>
                                                        {checklistsExistentes.map(c => (
                                                            <option key={c.tarea_id} value={c.tarea_id}>
                                                                {c.tarea_titulo}{c.checklist_titulo ? ` — ${c.checklist_titulo}` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                            {subtareasForm.length > 0 && (
                                                <ul className="subtareas-list" style={{ marginBottom: '0.5rem' }}>
                                                    {subtareasForm.map(s => (
                                                        <li key={s.tempId} className="subtarea-item">
                                                            <span className="subtarea-texto">{s.titulo}</span>
                                                            {s.fecha_vencimiento && (
                                                                <span className="subtarea-fecha">
                                                                    {new Date(s.fecha_vencimiento + 'T00:00:00').toLocaleDateString()}
                                                                </span>
                                                            )}
                                                            <button type="button" className="subtarea-delete" style={{ opacity: 1 }}
                                                                onClick={() => setSubtareasForm(prev => prev.filter(x => x.tempId !== s.tempId))}>
                                                                <FaTimes />
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            <div className="subtarea-add-row">
                                                <input
                                                    type="text"
                                                    className="subtarea-add-input"
                                                    placeholder="Ítem del checklist..."
                                                    value={nuevaSubtareaTexto}
                                                    onChange={e => setNuevaSubtareaTexto(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            if (!nuevaSubtareaTexto.trim()) return;
                                                            setSubtareasForm(prev => [...prev, { tempId: Date.now(), titulo: nuevaSubtareaTexto.trim(), fecha_vencimiento: nuevaSubtareaFecha }]);
                                                            setNuevaSubtareaTexto('');
                                                            setNuevaSubtareaFecha('');
                                                        }
                                                    }}
                                                />
                                                <input
                                                    type="date"
                                                    className="subtarea-add-date"
                                                    value={nuevaSubtareaFecha}
                                                    onChange={e => setNuevaSubtareaFecha(e.target.value)}
                                                    title="Fecha de vencimiento"
                                                />
                                                <button type="button" className="subtarea-add-btn"
                                                    disabled={!nuevaSubtareaTexto.trim()}
                                                    onClick={() => {
                                                        if (!nuevaSubtareaTexto.trim()) return;
                                                        setSubtareasForm(prev => [...prev, { tempId: Date.now(), titulo: nuevaSubtareaTexto.trim(), fecha_vencimiento: nuevaSubtareaFecha }]);
                                                        setNuevaSubtareaTexto('');
                                                        setNuevaSubtareaFecha('');
                                                    }}>
                                                    <FaPlus />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="form-actions">
                                    <button className="cancel-button" onClick={() => {
                                        setMostrarFormTarea(false);
                                        setNuevaTarea({ titulo: '', descripcion: '', fecha_pactada: '', estado: 'Pendiente', prioridad: 'Media', proyecto_id: '', accion: 'guardar' });
                                        setSubtareasForm([]);
                                        setNuevaSubtareaTexto('');
                                        setNuevaSubtareaFecha('');
                                        setShowChecklist(false);
                                        setChecklistTitulo('');
                                        setSelectedChecklistId('');
                                    }}>
                                        <FaTimes /> Cancelar
                                    </button>
                                    <button className="save-button" onClick={handleGuardarTareaDesdeBoard} disabled={isSavingTarea}>
                                        <FaSave /> {isSavingTarea ? 'Guardando...' : 'Guardar Tarea'}
                                    </button>
                                </div>
                            </div>
                        ) : !selectedEstado ? (
                            <div className="estados-cards">
                                {estados.map((estado) => (

                                    <div
                                        key={estado.id}
                                        className="estado-card"
                                        onClick={() => handleEstadoClick(estado.id)}
                                        style={{ borderTop: `4px solid ${estado.color}` }}
                                    >
                                        <div className="estado-card-header">
                                            {renderIcon(estado.icon)}
                                            <h3>{estado.title}</h3>
                                        </div>
                                        <div className="estado-card-count">
                                            <span>{estado.count}</span>
                                            <span>tareas</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="tareas-container">
                                <div className="tareas-header">
                                    <button className="back-button" onClick={handleBackToEstados}>
                                        <FaArrowLeft /> Volver
                                    </button>
                                    <h3 style={{ marginTop: '15px' }}>{estados.find(e => e.id === selectedEstado)?.title}</h3>
                                </div>
                                <div className="tareas-list">
                                    {tareasFiltradas.length > 0 ? (
                                        tareasFiltradas.map((tarea) => (
                                            <div
                                                key={tarea.id}
                                                className="tarea-item"
                                                onClick={() => handleTaskClick(tarea)}
                                            >
                                                <div className="tarea-header">
                                                    <h4>{tarea.titulo}</h4>
                                                    {tarea.proyecto_nombre && (
                                                        <span className="proyecto-badge">
                                                            <FaFolder style={{ marginRight: '4px', fontSize: '0.7rem' }} />
                                                            {tarea.proyecto_nombre}
                                                        </span>
                                                    )}
                                                    <div className="task-card-header-right">
                                                        {tarea.prioridad && (
                                                            <span className={`prioridad-badge ${tarea.prioridad.toLowerCase()}`}>
                                                                {tarea.prioridad}
                                                            </span>
                                                        )}
                                                                <div className="task-card-header-right-icons">
                                                                    {/* Mostrar Aprobación */}
                                                                    {tarea.aprobada ? (
                                                                        <FaCircleCheck color='green' title='Aprobada' style={{ marginRight: '0.5rem' }} />
                                                                    ) : (
                                                                        <FaCircleCheck color='grey' title='No aprobada' style={{ marginRight: '0.5rem', opacity: 0.5 }} />
                                                                    )}

                                                                    {/* Mostrar Visto Bueno */}
                                                                    {(tarea.estado === 'Completada' && tarea.visto_bueno && !tarea.rechazada) ? (
                                                                        <FaEye color='green' title='Visto bueno' style={{ marginRight: '0.5rem' }} />
                                                                    ) : (
                                                                        <FaEye color='grey' title='Pendiente de visto bueno' style={{ marginRight: '0.5rem', opacity: 0.5 }} />
                                                                    )}

                                                                    {/* Mostrar Rechazada */}
                                                                    {(tarea.estado === 'Completada' || tarea.estado === 'En Proceso') && tarea.rechazada ? (
                                                                        <FaCircleXmark color='red' title='Rechazada' style={{ marginRight: '0.5rem' }} />
                                                                    ) : null}

                                                                    {/* Mostrar Pausada */}
                                                                    {tarea.pausada ? (
                                                                        <FaPause color='orange' title='Pausada' style={{ marginRight: '0.5rem' }} />
                                                                    ) : (
                                                                        <FaPause color='grey' title='No pausada' style={{ marginRight: '0.5rem', opacity: 0.5 }} />
                                                                    )}

                                                                </div>
                                                            </div>
                                                </div>
                                                <p className="tarea-descripcion">{tarea.descripcion}</p>
                                                <div className="tarea-footer">
                                                    <span className="fecha">
                                                        <FaCalendar style={{ color: '#215ACC' }} size={13}/>
                                                        {" "}
                                                        <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Fecha creación:</label> {new Date(new Date(tarea.fecha_creacion).getTime() + 24 * 60 * 60 * 1000).toLocaleDateString()}
                                                        {tarea.fecha_aprobacion && (
                                                            <span>
                                                                {" "} <FaCheck style={{ color: '#008000' }} size={13}/> <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Fecha aprobación:</label> {
                                                                tarea.fecha_aprobacion !== '0000-00-00' ?
                                                                new Date(new Date(tarea.fecha_aprobacion).getTime() + 24 * 60 * 60 * 1000).toLocaleDateString()
                                                                : "No aprobada"
                                                                }
                                                            </span>
                                                        )}

                                                        {tarea.fecha_pactada && (
                                                            <span>
                                                                {" "} <FaClock style={{ color: '#C2410C', backgroundColor: '#f9cccf', borderRadius: '50%', padding: '2px' }} size={13}/> <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Fecha pactada:</label> {new Date(new Date(tarea.fecha_pactada).getTime() + 24 * 60 * 60 * 1000).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="ver-detalles"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleTaskClick(tarea);
                                                        }}
                                                    >
                                                        <FaEye /> Ver detalles
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="no-tareas">
                                            <p>No hay tareas en este estado</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };


    return (
        <div className="dashboard-container">
            <Sidebar
                activeMenu={activeMenu}
                setActiveMenu={setActiveMenu}
                setCurrentView={setCurrentView}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
            />
            <div className="main-content">
                <Header
                    currentUser={user}
                    showUserMenu={showUserMenu}
                    setShowUserMenu={setShowUserMenu}
                    setIsSidebarOpen={setIsSidebarOpen}
                />
                {renderContent()}
            </div>
            {showProfileModal && selectedEmployee && (
                <ProfileModal
                    employee={selectedEmployee}
                    onClose={() => setShowProfileModal(false)}
                />
            )}
            {showTasksModal && selectedEmployee && (
                <TasksModal
                    employee={selectedEmployee}
                    onClose={() => setShowTasksModal(false)}
                    proyectos={proyectos}
                    mostrarFormTarea={mostrarFormTarea}
                    setMostrarFormTarea={setMostrarFormTarea}
                    nuevaTarea={nuevaTarea}
                    setNuevaTarea={setNuevaTarea}
                    showChecklist={showChecklist}
                    setShowChecklist={setShowChecklist}
                    checklistTitulo={checklistTitulo}
                    setChecklistTitulo={setChecklistTitulo}
                    checklistsExistentes={checklistsExistentes}
                    selectedChecklistId={selectedChecklistId}
                    subtareasForm={subtareasForm}
                    setSubtareasForm={setSubtareasForm}
                    nuevaSubtareaTexto={nuevaSubtareaTexto}
                    setNuevaSubtareaTexto={setNuevaSubtareaTexto}
                    nuevaSubtareaFecha={nuevaSubtareaFecha}
                    setNuevaSubtareaFecha={setNuevaSubtareaFecha}
                    isSavingTarea={isSavingTarea}
                    handleGuardarTareaDesdeBoard={handleGuardarTareaDesdeBoard}
                    loadChecklistsExistentes={loadChecklistsExistentes}
                    handleCopyChecklist={handleCopyChecklist}
                    setChecklistsExistentes={setChecklistsExistentes}
                    setSelectedChecklistId={setSelectedChecklistId}
                    selectedEstado={selectedEstado}
                    setSelectedEstado={setSelectedEstado}
                    tareasFiltradas={tareasFiltradas}
                    setTareasFiltradas={setTareasFiltradas}
                    setSelectedTask={setSelectedTask}
                    setShowTaskDetails={setShowTaskDetails}
                    showTaskDetails={showTaskDetails}
                    selectedTask={selectedTask}
                    selectedEmployee={selectedEmployee}
                    setSelectedEmployee={setSelectedEmployee}
                    setEmpleados={setEmpleados}
                    getStatusClass={getStatusClass}
                    getStatusIcon={getStatusIcon}
                />
            )}
        </div>
    );
};

export default Dashboard; 