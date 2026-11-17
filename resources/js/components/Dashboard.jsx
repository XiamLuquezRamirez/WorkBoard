import React, { useEffect, useRef, useState } from 'react';
import axiosInstance from '../axiosConfig';
import { getImageUrl, getAssetUrl, irAlLogin } from '../utils/assetHelper';
import Header from './Header';
import Sidebar from './Sidebar';
import { useUser } from './UserContext';
import TaskDetailsModal from './TaskDetailsModal';
import EmployeeInterface from './EmployeeInterface';

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
    FaPlus
} from 'react-icons/fa';
import { FaCircleCheck, FaCircle, FaCircleXmark } from 'react-icons/fa6';
import FormularioTarea from './tareas/FormularioTarea';
import PanoramaDashboard from './dashboard/PanoramaDashboard';
import ResolverVencidas from './dashboard/ResolverVencidas';
import { AvataresProvider, useAvatar, resolverFoto } from './tablero/AvataresContext';

/**
 * Foto de la persona. En la carga liviana no viaja (es base64 y pesaba
 * más que todo lo demás junto): se toma del diccionario de avatares, que se
 * pide una sola vez.
 */
const FotoEmpleado = ({ empleado, className }) => {
    const delDiccionario = useAvatar(empleado.id);
    const src = delDiccionario || resolverFoto(empleado.foto);
    if (!src) {
        const ini = String(empleado.nombre || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
        return <span className={`${className} foto-iniciales`} aria-hidden="true">{ini}</span>;
    }
    return <img src={src} alt={empleado.nombre} className={className} />;
};

/**
 * Fechas de la base ('2026-05-12'): se leen como fecha local. Antes se hacía
 * new Date(fecha) + 24 h para compensar que JavaScript las lee como UTC; el
 * parche fallaba con fechas que traen hora y es innecesario así.
 */
const fechaLocal = (txt) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(txt || ''));
    if (!m || txt.startsWith('0000')) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

const fechaCorta = (txt) => {
    const d = fechaLocal(txt);
    return d ? d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};

/** Clasificación del índice que calcula el servidor (IndiceDesempeno). */
const NIVELES = {
    alto:            { label: '🟢 Alto',          color: '#16a34a' },
    medio:           { label: '🟡 Medio',         color: '#f59e0b' },
    bajo:            { label: '🔴 Bajo',          color: '#dc2626' },
    'en-curso':      { label: 'En curso',         color: '#2563eb' },
    'sin-actividad': { label: 'Sin actividad',    color: '#9ca3af' },
    'sin-datos':     { label: 'Sin datos',        color: '#9ca3af' },
};

/** Filtros del dashboard: qué tarjetas mostrar según lo que piden. */
const FILTROS = [
    { id: 'todos',          etiqueta: 'Todos' },
    { id: 'atencion',       etiqueta: 'Necesitan atención', cumple: (i) => (i.atencion || []).length > 0 },
    { id: 'vencidas',       etiqueta: 'Vencidas +7 días',   cumple: (i) => (i.atencion || []).includes('vencidas') },
    { id: 'sin-movimiento', etiqueta: 'Sin movimiento',     cumple: (i) => (i.atencion || []).includes('sin-movimiento') },
    { id: 'sin-tareas',     etiqueta: 'Sin tareas abiertas', cumple: (i) => (i.atencion || []).includes('sin-tareas') },
    { id: 'al-dia',         etiqueta: 'Al día',             cumple: (i) => (i.atencion || []).length === 0 },
];

const ORDENES = {
    atencion: (a, b) => (b.indicadores?.prioridad_atencion || 0) - (a.indicadores?.prioridad_atencion || 0)
        || a.nombre.localeCompare(b.nombre),
    nombre: (a, b) => a.nombre.localeCompare(b.nombre),
    indice: (a, b) => (a.indicadores?.indice ?? 101) - (b.indicadores?.indice ?? 101)
        || a.nombre.localeCompare(b.nombre),
};

/** Etiqueta corta de cada motivo de atención, para la tarjeta. */
const MOTIVOS = {
    vencidas: '⏰ Vencidas +7 días',
    'sin-movimiento': '💤 Sin movimiento esta semana',
    'sin-tareas': '📭 Sin tareas abiertas',
};

const haceDias = (n) => {
    if (n === null || n === undefined) return 'sin movimientos registrados';
    if (n === 0) return 'hoy';
    if (n === 1) return 'ayer';
    return `hace ${n} días`;
};

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
                                <FotoEmpleado empleado={employee} className="profile-photo" />
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
    onTareaGuardada,
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
    esSupervisor,
}) => {
    const estados = [
        { id: 'Todas', title: 'Todas las Tareas', icon: FaTasks, color: '#6b7280', count: employee.tareas?.length || 0 },
        { id: 'Pendiente', title: 'Pendientes', icon: FaClock, color: '#f97316', count: employee.tareas?.filter(t => t.estado === 'Pendiente').length || 0 },
        { id: 'En Proceso', title: 'En Proceso', icon: FaSpinner, color: '#2563eb', count: employee.tareas?.filter(t => t.estado === 'En Proceso').length || 0 },
        { id: 'En Revisión', title: 'En Revisión', icon: FaSearch, color: '#0d9488', count: employee.tareas?.filter(t => t.estado === 'En Revisión').length || 0 },
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
            <div className={`modal-content tasks-modal${mostrarFormTarea ? ' ft-modal-ancho' : ''}`}>
                <div className="modal-header">
                    <h2 style={{ textTransform: 'capitalize' }}>
                        {mostrarFormTarea ? 'NUEVA TAREA' : `TAREAS DE ${employee.nombre}`}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {!mostrarFormTarea && !esSupervisor && (
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
                    {employee.detalle === false && !mostrarFormTarea ? (
                        <p className="no-tareas">Cargando tareas…</p>
                    ) : mostrarFormTarea ? (
                        <FormularioTarea
                            empleadoId={employee.id}
                            empleadoNombre={employee.nombre}
                            proyectos={proyectos}
                            onGuardada={async () => { setMostrarFormTarea(false); await onTareaGuardada(); }}
                            onCancelar={() => setMostrarFormTarea(false)}
                        />
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
                                                            {" "} <FaCalendar style={{ color: '#1D4ED8', backgroundColor: '#dceffb', borderRadius: '50%', padding: '2px' }} size={13} /> <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Fecha asignación:</label> {fechaCorta(tarea.fecha_asignacion)}
                                                        </span>
                                                    )}
                                                    {tarea.fecha_aprobacion && (
                                                        <span>
                                                            {" "} <FaCheck style={{ color: '#008000' }} size={13} /> <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Fecha aprobación:</label> {
                                                            fechaCorta(tarea.fecha_aprobacion) || "No aprobada"
                                                            }
                                                        </span>
                                                    )}
                                                    {tarea.fecha_pactada && (
                                                        <span>
                                                            {" "} <FaClock style={{ color: '#C2410C', backgroundColor: '#f9cccf', borderRadius: '50%', padding: '2px' }} size={13} /> <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Fecha pactada:</label> {fechaCorta(tarea.fecha_pactada)}
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
                        .get("/dashboard/cargarEmpleadosTareas", { params: { empleado: selectedEmployee.id } })
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
    const [proyectos, setProyectos] = useState([]);
    const [filterDepartamento, setFilterDepartamento] = useState('');
    const [filtro, setFiltro] = useState('todos');
    // Resolver vencidas: { departamento } o { empleado: { id, nombre } }.
    const [resolver, setResolver] = useState(null);
    // Por defecto, lo que necesita atención arriba: antes las tarjetas no
    // tenían un orden útil y había que recorrerlas todas para encontrarlo.
    const [orden, setOrden] = useState('atencion');



    useEffect(() => {
        document.title = "Dashboard - WorkBoard";
    }, []);

    // La cabecera del tablero es fija, así que el contenido tiene que apartarse
    // su altura. Esa altura no es constante: la barra de búsqueda envuelve a dos
    // líneas en pantallas angostas y el padding cambia por breakpoint. Un margen
    // escrito a mano se quedaba corto y las tarjetas acababan debajo de ella, así
    // que se mide la cabecera real y se publica para que el CSS la use.
    const cabeceraRef = useRef(null);

    useEffect(() => {
        const cabecera = cabeceraRef.current;
        if (!cabecera) return undefined;

        const medir = () => {
            const alto = Math.ceil(cabecera.getBoundingClientRect().height);
            document.documentElement.style.setProperty('--alto-cabecera-tablero', `${alto}px`);
        };

        medir();
        const observador = new ResizeObserver(medir);
        observador.observe(cabecera);
        return () => observador.disconnect();
    });

    useEffect(() => {
        axiosInstance.get('/cargarProyectos').then(r => setProyectos(r.data)).catch(() => {});
    }, []);

    const handleLogout = async () => {
        try {
            await axiosInstance.post('/logout');
            localStorage.clear();
            irAlLogin();

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
            // Liviana: sólo lo que muestran las tarjetas. El detalle de cada
            // tarea se pide al abrir a la persona.
            .get("/dashboard/cargarEmpleadosTareas", { params: { ligero: 1 } })
            .then((response) => {
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

    /*
     * El índice, las vencidas y el mensaje los calcula el servidor
     * (App\Support\IndiceDesempeno): ventana de 90 días, hora de Bogotá y el
     * mismo criterio de «vencida» que el tablero de equipo. Antes se calculaba
     * aquí con todo el historial y en UTC, y quien llevaba meses sin registrar
     * nada podía salir «Alto».
     */
    const calcularStatsGlobales = (listaEmpleados) => {
        const conIndice = listaEmpleados.filter((e) => e.indicadores?.indice != null);
        const suma = (campo) => listaEmpleados.reduce((a, e) => a + (e.indicadores?.[campo] || 0), 0);
        const completadas30 = suma('completadas_30');
        return {
            // Adopción: ¿se está usando la plataforma para trabajar?
            activosSemana: listaEmpleados.filter((e) => e.indicadores?.activo_semana).length,
            vencidasGraves: suma('vencidas_graves'),
            completadas30,
            pctATiempo30: completadas30 > 0 ? Math.round((suma('a_tiempo_30') / completadas30) * 100) : null,
            sinCriterio: suma('sin_criterio'),
            totalEmpleados: listaEmpleados.length,
            tareasActivas: listaEmpleados.reduce((a, e) => a + (e.indicadores?.pendientes || 0) + (e.indicadores?.en_proceso || 0), 0),
            tareasAtrasadas: listaEmpleados.reduce((a, e) => a + (e.indicadores?.vencidas || 0), 0),
            // Sólo promedia a quien tiene algo que evaluar: contar como 0 a
            // quien no tiene tareas hundía el promedio sin medir nada.
            eficienciaPromedio: conIndice.length
                ? Math.round(conIndice.reduce((a, e) => a + e.indicadores.indice, 0) / conIndice.length)
                : null,
            evaluados: conIndice.length,
        };
    };

    const contarTareasAtrasadas = (empleado) => empleado.indicadores?.vencidas || 0;

    const getStatusIcon = (status) => {
        switch (status) {
            case "Completada":
                return <FaCheckCircle color="#54B743" />;
            case "En Proceso":
                return <FaSpinner color="#377AED" />;
            case "Pendiente":
                return <FaClock color="#c2410c" />;
            case "En Revisión":
                return <FaSearch color="#0d9488" />;
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
            case "En Revisión":
                return "status-review";
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

    // Al abrir las tareas de alguien se pide su detalle completo.
    const abrirDetalle = async (id) => {
        try {
            const r = await axiosInstance.get('/dashboard/cargarEmpleadosTareas', { params: { empleado: id } });
            const emp = r.data.find((e) => e.id === id);
            if (emp) setSelectedEmployee((actual) => (actual && actual.id === id ? emp : actual));
        } catch (e) {
            setSelectedEmployee((actual) => (actual && actual.id === id ? { ...actual, detalle: true, tareas: [] } : actual));
        }
    };

    // Tras crear una tarea se recarga el empleado para ver la tarea nueva.
    const refrescarEmpleadoSeleccionado = async () => {
        const updated = await axiosInstance.get('/dashboard/cargarEmpleadosTareas', { params: { empleado: selectedEmployee.id } });
        const emp = updated.data.find(e => e.id === selectedEmployee.id);
        if (emp) {
            setSelectedEmployee(emp);
            setEmpleados(prev => prev.map(e => e.id === emp.id ? emp : e));
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

    // Los indicadores de arriba miran el área elegida y la búsqueda, pero no
    // el filtro de atención: si no, al elegir «Al día» saldría 0 vencidas.
    const filtroActual = FILTROS.find((f) => f.id === filtro) || FILTROS[0];
    const tarjetas = filteredEmpleados
        .filter((e) => !filtroActual.cumple || filtroActual.cumple(e.indicadores || {}))
        .sort(ORDENES[orden] || ORDENES.atencion);
    // El resumen por área mira la búsqueda pero no el filtro de área: así
    // siempre se ven todas y se puede saltar de una a otra.
    const porBusqueda = empleados.filter((e) => {
        const t = searchTerm.toLowerCase();
        return e.nombre.toLowerCase().includes(t)
            || (e.departamento || '').toLowerCase().includes(t)
            || (e.empresa || '').toLowerCase().includes(t);
    });

    const cuentaFiltro = (f) => (f.cumple
        ? filteredEmpleados.filter((e) => f.cumple(e.indicadores || {})).length
        : filteredEmpleados.length);

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
                                <div className="dashboard-header" ref={cabeceraRef}>
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
                                    {/* Adopción primero: antes de medir el desempeño hay que
                                        saber si la plataforma se está usando para trabajar. */}
                                    <div className="dashboard-stats-panel">
                                        <div
                                            className={`stat-kpi ${stats.totalEmpleados > 0 && stats.activosSemana / stats.totalEmpleados < 0.5 ? 'stat-kpi--alert' : ''}`}
                                            title="Personas con algún movimiento en sus tareas en los últimos 7 días: crear, mover, comentar, entregar…"
                                        >
                                            <span className="stat-kpi-number">
                                                {stats.activosSemana}<small className="stat-kpi-de"> / {stats.totalEmpleados}</small>
                                            </span>
                                            <span className="stat-kpi-label">Movieron trabajo esta semana</span>
                                        </div>
                                        <div
                                            className={`stat-kpi ${stats.vencidasGraves > 0 ? 'stat-kpi--alert stat-kpi--accion' : ''}`}
                                            title="Tareas abiertas que pasaron su fecha pactada hace más de 7 días (sin contar En Revisión ni pausadas). Pulsa para resolverlas."
                                            role={stats.tareasAtrasadas > 0 ? 'button' : undefined}
                                            tabIndex={stats.tareasAtrasadas > 0 ? 0 : undefined}
                                            onClick={() => stats.tareasAtrasadas > 0 && setResolver({ departamento: filterDepartamento })}
                                            onKeyDown={(e) => {
                                                if ((e.key === 'Enter' || e.key === ' ') && stats.tareasAtrasadas > 0) {
                                                    e.preventDefault();
                                                    setResolver({ departamento: filterDepartamento });
                                                }
                                            }}
                                        >
                                            <span className="stat-kpi-number">{stats.vencidasGraves}</span>
                                            <span className="stat-kpi-label">Vencidas hace +7 días</span>
                                            {stats.tareasAtrasadas > stats.vencidasGraves && (
                                                <span className="stat-kpi-sub">{stats.tareasAtrasadas} vencidas en total</span>
                                            )}
                                        </div>
                                        <div className="stat-kpi" title="Entregas de los últimos 30 días que llegaron en su fecha pactada o antes">
                                            <span className="stat-kpi-number">
                                                {stats.pctATiempo30 === null ? '—' : `${stats.pctATiempo30}%`}
                                            </span>
                                            <span className="stat-kpi-label">Entregado a tiempo · 30 días</span>
                                            <span className="stat-kpi-sub">
                                                {stats.completadas30 === 0
                                                    ? 'Ninguna entrega en 30 días'
                                                    : `${stats.completadas30} entrega${stats.completadas30 === 1 ? '' : 's'}`}
                                                {' · eficiencia 90 días: '}
                                                {stats.eficienciaPromedio === null ? '—' : `${stats.eficienciaPromedio}%`}
                                            </span>
                                        </div>
                                        <div
                                            className={`stat-kpi ${stats.sinCriterio > 0 ? 'stat-kpi--aviso' : ''}`}
                                            title="Tareas abiertas sin criterio de aceptación: no se sabe cuándo están terminadas"
                                        >
                                            <span className="stat-kpi-number">{stats.sinCriterio}</span>
                                            <span className="stat-kpi-label">Abiertas sin criterio</span>
                                        </div>
                                    </div>

                                    <PanoramaDashboard
                                        empleados={porBusqueda}
                                        departamento={filterDepartamento}
                                        onElegirDepartamento={setFilterDepartamento}
                                    />

                                    <div className="dashboard-filtros" role="toolbar" aria-label="Filtrar y ordenar personas">
                                        <div className="dashboard-chips">
                                            {FILTROS.map((f) => (
                                                <button
                                                    key={f.id}
                                                    type="button"
                                                    className={`dashboard-chip ${filtro === f.id ? 'es-activo' : ''}`}
                                                    onClick={() => setFiltro(f.id)}
                                                    aria-pressed={filtro === f.id}
                                                >
                                                    {f.etiqueta} <span className="dashboard-chip-n">{cuentaFiltro(f)}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <label className="dashboard-orden">
                                            Ordenar
                                            <select value={orden} onChange={(e) => setOrden(e.target.value)}>
                                                <option value="atencion">Necesitan atención primero</option>
                                                <option value="indice">Índice más bajo primero</option>
                                                <option value="nombre">Nombre</option>
                                            </select>
                                        </label>
                                    </div>
                                    <div className="cards-grid">
                                    {tarjetas.length === 0 && (
                                        <p className="dashboard-vacio">Nadie cumple este filtro.</p>
                                    )}
                                    {tarjetas.map((empleado) => {
                                        const atrasadas = contarTareasAtrasadas(empleado);
                                        const ind = empleado.indicadores || {};
                                        return (
                                        <div
                                            key={empleado.id}
                                            className="employee-card"
                                        >
                                            <div className="employee-main-info">
                                                <FotoEmpleado empleado={empleado} className="employee-photo" />
                                                <div className="employee-details">
                                                    <h3>{empleado.nombre}</h3>
                                                    <p className="cargo">
                                                        <FaUserTie size={13} /> {" "}   {empleado.cargo}
                                                    </p>
                                                    <p className="empresa">
                                                        <FaBuilding size={13} /> {" "}   {empleado.empresa} -{" "}
                                                        {empleado.departamento}
                                                    </p>
                                                    {/* El correo está en «Perfil»: aquí ocupaba
                                                        el sitio de lo que sí ayuda a decidir. */}
                                                </div>

                                            </div>
                                            {(ind.atencion || []).length > 0 && (
                                                <div className="employee-card-motivos">
                                                    {ind.atencion.map((m) => (
                                                        <span key={m} className={`motivo motivo--${m}`}>{MOTIVOS[m] || m}</span>
                                                    ))}
                                                </div>
                                            )}
                                            {atrasadas > 0 && (
                                                <div className="employee-card-alert-banner">
                                                    <span className="alert-icon">⚠</span>
                                                    <span>
                                                        {atrasadas} tarea{atrasadas > 1 ? 's' : ''} vencida{atrasadas > 1 ? 's' : ''}
                                                        {ind.mas_vencida && (
                                                            <span className="mas-vencida" title={ind.mas_vencida.titulo}>
                                                                {' · la más antigua: «'}{ind.mas_vencida.titulo}{'», '}
                                                                {ind.mas_vencida.dias === 1 ? 'hace 1 día' : `hace ${ind.mas_vencida.dias} días`}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="banner-resolver"
                                                        onClick={() => setResolver({ empleado: { id: empleado.id, nombre: empleado.nombre } })}
                                                    >
                                                        Resolver
                                                    </button>
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
                                                        abrirDetalle(empleado.id);
                                                    }}
                                                >
                                                    <FaTasks /> Tareas
                                                </button>
                                            </div>
                                            <div className="performance-section">
                                                {(() => {
                                                    const ind = empleado.indicadores || {};
                                                    const id = ind.indice ?? null;
                                                    const nivel = ind.nivel || 'sin-datos';
                                                    const cls = NIVELES[nivel] || NIVELES['sin-datos'];
                                                    const completadas = ind.completadas || 0;
                                                    const aTiempo = ind.a_tiempo || 0;
                                                    const pctATiempo = completadas > 0 ? Math.round((aTiempo / completadas) * 100) : 0;
                                                    const quieto = (ind.dias_sin_actividad ?? Infinity) > 14;
                                                    return (
                                                        <>
                                                            <div className="desempeno-header">
                                                                <span className="desempeno-title">
                                                                    Índice de Desempeño
                                                                    <small className="desempeno-ventana"> · últimos {ind.ventana_dias || 90} días</small>
                                                                </span>
                                                                <span className={`desempeno-badge desempeno-badge--${nivel}`}>{cls.label}</span>
                                                            </div>
                                                            {id !== null ? (
                                                                <>
                                                                    <div className="desempeno-score">{id}%</div>
                                                                    <div className="desempeno-bar-wrap">
                                                                        <div className="desempeno-bar" style={{ width: `${id}%`, backgroundColor: cls.color }} />
                                                                    </div>
                                                                    <p className="desempeno-msg">{ind.mensaje}</p>
                                                                </>
                                                            ) : (
                                                                <p className="desempeno-msg desempeno-msg--empty">{ind.mensaje || 'Sin tareas asignadas.'}</p>
                                                            )}
                                                            <p className={`desempeno-actividad${quieto ? ' es-quieto' : ''}`}>
                                                                Último movimiento: {haceDias(ind.dias_sin_actividad)}
                                                            </p>
                                                            <div className="task-stats-grid">
                                                                <div className="stat-item">
                                                                    <span className="stat-number">{ind.abiertas || 0}</span>
                                                                    <span className="stat-label">Abiertas</span>
                                                                </div>
                                                                <div className="stat-item">
                                                                    <span className="stat-number">{completadas}</span>
                                                                    <span className="stat-label">✅ Completadas</span>
                                                                </div>
                                                                <div className="stat-item">
                                                                    <span className="stat-number">{ind.en_proceso || 0}</span>
                                                                    <span className="stat-label">⏳ En Proceso</span>
                                                                </div>
                                                                <div className="stat-item urgent">
                                                                    <span className="stat-number">{atrasadas}</span>
                                                                    <span className="stat-label">⚠️ Vencidas</span>
                                                                </div>
                                                            </div>
                                                            <div className="desempeno-secundario">
                                                                <span>A tiempo: {aTiempo}/{completadas} ({pctATiempo}%)</span>
                                                                <span>Reprocesos: {ind.reprocesos || 0}</span>
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
                                                                    {tarea.fecha_creacion && (
                                                                        <small className="urgent-task-fecha"> · {fechaCorta(tarea.fecha_creacion)}</small>
                                                                    )}
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

    return (
        <AvataresProvider todaLaOrganizacion>
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
                    onTareaGuardada={refrescarEmpleadoSeleccionado}
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
                    esSupervisor={user?.tipo_usuario === "Supervisor"}
                />
            )}
            {resolver && (
                <ResolverVencidas
                    departamento={resolver.departamento}
                    empleado={resolver.empleado}
                    onCerrar={() => setResolver(null)}
                    onResuelto={cargarEmpleados}
                />
            )}
        </div>
        </AvataresProvider>
    );
};

export default Dashboard; 