import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
    FaPlus, FaClock, FaSpinner, FaCheck,
    FaEye, FaSearch, FaFile, FaFileWord,
    FaFileImage, FaFilePdf, FaTimes,
    FaArrowLeft, FaLock, FaLink, FaArchive, FaFolder,
    FaCalendar, FaChevronLeft, FaChevronRight, FaChevronDown, FaChartBar, FaEllipsisV, FaPause,
    FaDesktop, FaVideo, FaUsers, FaColumns
} from 'react-icons/fa';
import TaskDetailsModal from './TaskDetailsModal';
import ReportesDepartamentoModal from './ReportesDepartamentoModal';
import VideosTableroModal from './VideosTableroModal';
import EspacioEquipoModal from './equipo/EspacioEquipoModal';
import FormularioTarea from './tareas/FormularioTarea';
import TableroEquipoModal from './equipo/TableroEquipoModal';
import ReunionesPendientes from './equipo/ReunionesPendientes';
import BandejaDecisiones from './tareas/BandejaDecisiones';
import { avisoDeEntrega } from '../utils/avisoDeEntrega';
import { AvataresProvider } from './tablero/AvataresContext';
import axiosInstance from '../axiosConfig';
import Swal from 'sweetalert2';
import { FaCircleCheck, FaCircle, FaCircleXmark, FaListCheck } from 'react-icons/fa6';
const EmployeeInterface = ({ user }) => {

    const [columns, setColumns] = useState({
        'Pendiente': {
            title: 'Pendiente',
            items: [],
            icon: FaClock,
            color: '#f97316'
        },
        'En Proceso': {
            title: 'En Proceso',
            items: [],
            icon: FaSpinner,
            color: '#2563eb'
        },
        // El trabajo se entrega aquí: el líder verifica los criterios de
        // aceptación y es él quien acepta la entrega y la cierra.
        'En Revisión': {
            title: 'En Revisión',
            items: [],
            icon: FaSearch,
            color: '#0d9488'
        },
        'Completada': {
            title: 'Completada',
            items: [],
            icon: FaCheck,
            color: '#16a34a'
        }
    });
    const [selectedTask, setSelectedTask] = useState(null);
    const [showTaskDetails, setShowTaskDetails] = useState(false);
    const [showNewTaskModal, setShowNewTaskModal] = useState(false);
    const [showListaEmpleadosAsignados, setShowListaEmpleadosAsignados] = useState(false);
    const [empleadosAsignados, setEmpleadosAsignados] = useState([]);
    const [showTareasEmpleado, setShowTareasEmpleado] = useState(false);
    const [tareasEmpleado, setTareasEmpleado] = useState([]);
    const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null);
    const [estadoSeleccionado, setEstadoSeleccionado] = useState(null);
    const [mostrarTareasEstado, setMostrarTareasEstado] = useState(false);
    const [asignarTareasEmpleado, setAsignarTareasEmpleado] = useState(false);
    const [empleadoAsignado, setEmpleadoAsignado] = useState(null);
    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [tareasArchivadas, setTareasArchivadas] = useState([]);
    const [selectedArchivedTask, setSelectedArchivedTask] = useState(null);
    const [showArchivedTaskDetails, setShowArchivedTaskDetails] = useState(false);
    const [proyectos, setProyectos] = useState([]);
    const optionsDropdownRef = useRef(null);
    // En pantallas estrechas el tablero muestra una columna (o dos) y se
    // desliza en horizontal; las pestañas dicen cuál se está viendo.
    const tableroRef = useRef(null);
    const pestanasRef = useRef(null);
    const [columnaVisible, setColumnaVisible] = useState(0);

    // La pestaña de la columna visible no debe quedar cortada en la barra.
    useEffect(() => {
        const p = pestanasRef.current?.children[columnaVisible];
        const barra = pestanasRef.current;
        if (p && barra) barra.scrollTo({ left: p.offsetLeft - 8, behavior: 'smooth' });
    }, [columnaVisible]);
    const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
    const [showReportesModal, setShowReportesModal] = useState(false);
    const [showVideosModal, setShowVideosModal] = useState(false);
    // Guarda la pestaña con la que abrir el espacio de equipo, o null si está cerrado.
    const [espacioEquipo, setEspacioEquipo] = useState(null);

    // Una notificación de reunión en la campana abre directamente la pestaña
    // Reuniones del Espacio de Equipo.
    useEffect(() => {
        const abrir = () => setEspacioEquipo('reuniones');
        window.addEventListener('wb:abrir-reuniones', abrir);
        return () => window.removeEventListener('wb:abrir-reuniones', abrir);
    }, []);
    const [verTableroEquipo, setVerTableroEquipo] = useState(false);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [calendarMonthAnchor, setCalendarMonthAnchor] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const normalizeYmd = (val) => {
        if (!val) return null;
        const s = String(val).split('T')[0].split(' ')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
        return s;
    };

    const getTaskEndDateKey = (task) => {
        const estado = (task.estado || '').trim();
        if (estado === 'Completada') {
            const ent = normalizeYmd(task.fecha_entregada);
            if (ent) return ent;
        }
        return normalizeYmd(task.fecha_pactada);
    };

    const allKanbanTasks = useMemo(
        () => [
            ...columns['Pendiente'].items,
            ...columns['En Proceso'].items,
            ...columns['Completada'].items,
        ],
        [columns]
    );

    const tareasPlantillaOpciones = useMemo(() => {
        const seen = new Set();
        const list = [];
        for (const t of allKanbanTasks) {
            if (!t?.id || seen.has(t.id)) continue;
            seen.add(t.id);
            list.push({ id: t.id, titulo: (t.titulo || `Tarea #${t.id}`).trim() || `Tarea #${t.id}` });
        }
        list.sort((a, b) => b.id - a.id);
        return list;
    }, [allKanbanTasks]);

    const tasksByEndDate = useMemo(() => {
        const map = {};
        allKanbanTasks.forEach((task) => {
            const key = getTaskEndDateKey(task);
            if (!key) return;
            if (!map[key]) map[key] = [];
            map[key].push(task);
        });
        return map;
    }, [allKanbanTasks]);

    const { calendarCells, calYear, calMonth } = useMemo(() => {
        const y = calendarMonthAnchor.getFullYear();
        const m = calendarMonthAnchor.getMonth();
        const first = new Date(y, m, 1);
        const leading = (first.getDay() + 6) % 7;
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < leading; i++) {
            cells.push({ type: 'empty', key: `pad-${y}-${m}-${i}` });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            cells.push({ type: 'day', day: d, dateKey, key: `day-${y}-${m}-${d}` });
        }
        return { calendarCells: cells, calYear: y, calMonth: m };
    }, [calendarMonthAnchor]);

    const calendarMonthTitle = calendarMonthAnchor.toLocaleDateString('es', {
        month: 'long',
        year: 'numeric',
    });

    const goCalendarPrevMonth = () => {
        setCalendarMonthAnchor((prev) => {
            const y = prev.getFullYear();
            const m = prev.getMonth();
            return new Date(y, m - 1, 1);
        });
    };

    const goCalendarNextMonth = () => {
        setCalendarMonthAnchor((prev) => {
            const y = prev.getFullYear();
            const m = prev.getMonth();
            return new Date(y, m + 1, 1);
        });
    };

    const isCalendarToday = (day) => {
        const now = new Date();
        return (
            now.getDate() === day &&
            now.getMonth() === calMonth &&
            now.getFullYear() === calYear
        );
    };

    useEffect(() => {
        loadTasks();
        loadProyectos();
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (optionsDropdownRef.current && !optionsDropdownRef.current.contains(e.target)) {
                setShowOptionsDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadProyectos = async () => {
        try {
            const response = await axiosInstance.get('/cargarProyectos');
            setProyectos(response.data);
        } catch (error) {
            console.error('Error al cargar proyectos:', error);
        }
    };

    const getFileIcon = (tipo) => {
        switch (tipo) {
            case 'application/pdf':
                return <FaFilePdf />;
            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                return <FaFileWord />;
            case 'image/jpeg':
            case 'image/png':
                return <FaFileImage />;
            case 'application/link':
                return <FaLink />;
            default:
                return <FaFile />;
        }
    };

    const loadTasks = async () => {
        try {
           
            const response = await axiosInstance.get(`/cargarTareas/${user.empleado}`);
            organizeTasks(response.data.tareas);
        } catch (error) {
            console.error('Error al cargar tareas:', error);
        }
    };

    const organizeTasks = (tareas) => {
        // Crear una copia limpia de las columnas con arrays vacíos
        const newColumns = {
            'Pendiente': {
                ...columns['Pendiente'],
                items: []
            },
            'En Proceso': {
                ...columns['En Proceso'],
                items: []
            },
            'En Revisión': {
                ...columns['En Revisión'],
                items: []
            },
            'Completada': {
                ...columns['Completada'],
                items: []
            }
        };

        setTareasArchivadas([]);

        // Distribuir las tareas en las columnas correspondientes
        tareas.forEach(task => {
            const estado = task.estado.trim();
            if (newColumns[estado]) {
                if (!task.archivar) {
                    newColumns[estado].items.push(task);
                }else{
                    setTareasArchivadas(prev => [... prev, task]);
                }
            }
        });



        setColumns(newColumns);
    };

    const onDragEnd = (result) => {

        if (!result || !result.destination) return;

        const { source, destination, draggableId } = result;
        const sourceId = source.droppableId;

        const destinationId = destination.droppableId;

        // Una tarea en pausa no cambia de estado arrastrándola: debe reanudarse
        // primero, para que la reanudación quede registrada en su historial. Se
        // comprueba antes de tocar las columnas para que la tarjeta no llegue a
        // moverse en pantalla y luego regrese.
        if (sourceId !== destinationId) {
            const tareaArrastrada = (columns[sourceId]?.items || [])
                .find((t) => String(t.id) === String(draggableId));
            if (tareaArrastrada && Number(tareaArrastrada.pausada) === 1) {
                Swal.fire({
                    title: 'Tarea en pausa',
                    text: 'Debes reanudar la tarea antes de cambiar su estado.',
                    icon: 'info',
                    confirmButtonText: 'Entendido',
                });
                return;
            }

            // Toda tarea pasa por revisión: de «En Revisión» sale cuando el
            // líder acepta o devuelve la entrega, y una cerrada sólo la reabre
            // él. El servidor lo exige igual; aquí se explica sin mover nada.
            if (sourceId === 'En Revisión') {
                Swal.fire({
                    title: 'En revisión',
                    text: 'Tu líder está revisando esta entrega. Saldrá de aquí cuando la acepte o te la devuelva con observaciones.',
                    icon: 'info',
                    confirmButtonText: 'Entendido',
                });
                return;
            }
            if (sourceId === 'Completada') {
                Swal.fire({
                    title: 'Tarea cerrada',
                    text: 'La entrega ya fue aceptada. Sólo tu líder puede reabrirla.',
                    icon: 'info',
                    confirmButtonText: 'Entendido',
                });
                return;
            }
            // Con independencia la tarea se acepta sola al entregarla (si
            // cumple sus criterios); sin ella, espera la revisión del líder.
            const soyIndependiente = ['si', 'sí'].includes(String(user?.independencia ?? '').trim().toLowerCase());
            if (destinationId === 'Completada') {
                Swal.fire({
                    title: soyIndependiente ? 'Completar la tarea' : 'Se cierra al aceptar la entrega',
                    text: soyIndependiente
                        ? 'Tienes independencia: al entregarla se acepta sola si cumple sus criterios obligatorios.'
                        : 'Envíala a revisión: tu líder la revisará y, si está bien, la cerrará.',
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonText: soyIndependiente ? 'Completar' : 'Enviar a revisión',
                    cancelButtonText: 'Cancelar',
                }).then((r) => {
                    if (r.isConfirmed) {
                        onDragEnd({ ...result, destination: { droppableId: 'En Revisión', index: 0 } });
                    }
                });
                return;
            }
            if (destinationId === 'En Revisión' && !result.confirmado) {
                const total = tareaArrastrada?.subtareas_total || 0;
                const hechas = tareaArrastrada?.subtareas_completadas || 0;
                Swal.fire({
                    title: soyIndependiente ? 'Completar la tarea' : 'Enviar a revisión',
                    text: total > 0 && hechas < total
                        ? `El checklist va ${hechas}/${total}. ${soyIndependiente ? 'Con tu independencia se cerrará al entregarla.' : 'Tu líder revisará lo entregado y lo aceptará o te lo devolverá.'} ¿Enviar de todos modos?`
                        : soyIndependiente
                            ? 'Tienes independencia: se acepta sola si cumple sus criterios obligatorios. Para adjuntar evidencias, entrégala desde el detalle de la tarea.'
                            : 'Tu líder revisará lo entregado y lo aceptará o te lo devolverá con observaciones. Para adjuntar evidencias, envíala desde el detalle de la tarea.',
                    icon: total > 0 && hechas < total ? 'warning' : 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Enviar',
                    cancelButtonText: 'Cancelar',
                }).then((r) => {
                    if (r.isConfirmed) onDragEnd({ ...result, confirmado: true });
                });
                return;
            }
        }

        // Crear copias profundas para evitar mutaciones
        const newColumns = JSON.parse(JSON.stringify(columns));

        // Obtener las columnas afectadas
        const sourceColumn = newColumns[sourceId];
        const destColumn = newColumns[destinationId];

        if (sourceId === destinationId) {
            // Reordenar en la misma columna
            const items = Array.from(sourceColumn.items);
            const [removed] = items.splice(source.index, 1);
            items.splice(destination.index, 0, removed);

            newColumns[sourceId].items = items;
        } else {
            // Mover entre columnas
            const sourceItems = Array.from(sourceColumn.items);
            const destItems = Array.from(destColumn.items);
            const [moved] = sourceItems.splice(source.index, 1);

            // Actualizar el estado de la tarea
            moved.estado = destinationId;

            // La fecha de entrega es la del envío a revisión (la fija el
            // servidor; aquí sólo se refleja sin esperar a recargar).
            if (destinationId === 'En Revisión') {
                const d = new Date();
                moved.fecha_entregada = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }

            destItems.splice(destination.index, 0, moved);

            newColumns[sourceId].items = sourceItems;
            newColumns[destinationId].items = destItems;

            // Preparar datos para actualizar en el servidor
            const updateData = {
                estado: destinationId
            };

            // Actualizar en el servidor. Si lo rechaza —por ejemplo porque la
            // tarea está pausada— hay que devolver la tarjeta a su columna: de
            // lo contrario quedaría movida en pantalla sin estarlo en la base
            // de datos.
            const columnasPrevias = columns;
            axiosInstance.put(`/actualizarEstadoTarea/${draggableId}`, updateData)
                .then((r) => {
                    if (destinationId === 'En Revisión' || destinationId === 'Completada') {
                        const aviso = avisoDeEntrega(r.data);
                        Swal.fire({
                            title: aviso.titulo,
                            text: aviso.texto,
                            icon: aviso.icono,
                            timer: aviso.icono === 'info' ? undefined : 2500,
                            showConfirmButton: aviso.icono === 'info',
                        });
                        // Con independencia la tarjeta termina en Completada
                        // (o se queda en revisión): se recarga del servidor.
                        if (r.data?.estado_final) loadTasks();
                    }
                })
                .catch(error => {
                    console.error('Error al actualizar estado:', error);
                    setColumns(columnasPrevias);
                    const msg = error?.response?.data?.error
                        || 'No fue posible actualizar el estado de la tarea.';
                    // El 409 tiene varias causas: la pausa, que sólo se cierra
                    // aceptándola, o que está en revisión.
                    const d409 = error?.response?.data || {};
                    const titulo409 = d409.requiere_verificacion
                        ? 'Requiere aceptación'
                        : d409.en_revision ? 'En revisión' : 'Tarea en pausa';
                    Swal.fire({
                        title: error?.response?.status === 409 ? titulo409 : 'Error',
                        text: msg,
                        icon: error?.response?.status === 409 ? 'info' : 'error',
                        confirmButtonText: 'Entendido',
                    });
                });
        }

        setColumns(newColumns);
    };

    const abrirReportesDepartamento = () => {
        setShowOptionsDropdown(false);
        setShowReportesModal(true);
    };

    // El tablero está pensado para proyectarse en un TV o segundo monitor, así que
    // se abre en su propia pestaña en lugar de superponerse al área de trabajo.
    // noopener/noreferrer evita que la pestaña nueva conserve acceso a window.opener.
    const abrirTableroSeguimiento = () => {
        setShowOptionsDropdown(false);
        const url = `${window.location.origin}${window.location.pathname}#/tablero`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const asignarTareas = () => {
        setShowNewTaskModal(true);
        setShowTareasEmpleado(false);
        setAsignarTareasEmpleado(true);
    };

    const handleTaskClick = (task) => {
        setSelectedTask(task);
        setShowTaskDetails(true);
    };

    // La bandeja «Necesita tu decisión» se recarga cuando el tablero cambia:
    // entregar una tarea desde su detalle la saca de la bandeja.
    const [recargaBandeja, setRecargaBandeja] = useState(0);

    // «Entregarla» desde la bandeja abre la tarea, que ya está en el tablero.
    const abrirTareaPorId = (id) => {
        const tarea = Object.values(columns).flatMap((c) => c.items || []).find((t) => Number(t.id) === Number(id));
        if (tarea) handleTaskClick(tarea);
    };

    const handleTaskUpdate = async () => {
        // Si estamos viendo las tareas de un empleado específico
        if (showTareasEmpleado && empleadoSeleccionado) {
            try {
                const response = await axiosInstance.get(`/cargarTareas/${empleadoSeleccionado.id}`);
                setTareasEmpleado(response.data.tareas);
            } catch (error) {
                console.error('Error al actualizar tareas del empleado:', error);
            }
        } else {
            // Si estamos en la vista principal, actualizar todas las tareas
            await loadTasks();
        }
        setRecargaBandeja((n) => n + 1);
    };

    const abrirListaEmpleadosAsignados = async () => {
        setShowListaEmpleadosAsignados(true);

    };

    const verTareas = async (empleadoId) => {
        try {
            setEmpleadoAsignado(empleadoId);
            const response = await axiosInstance.get(`/cargarTareas/${empleadoId}`);
            setTareasEmpleado(response.data.tareas);

            // Encontrar el empleado seleccionado
            const empleado = user.empleados_asignados.find(emp => emp.id === empleadoId);
            setEmpleadoSeleccionado(empleado);

            // Cerrar el modal de empleados y abrir el de tareas
            setShowListaEmpleadosAsignados(false);
            setShowTareasEmpleado(true);
            setMostrarTareasEstado(false);
            setEstadoSeleccionado(null);
        } catch (error) {
            console.error('Error al cargar tareas del empleado:', error);
            Swal.fire('Error', 'No se pudieron cargar las tareas del empleado', 'error');
        }
    };

    const seleccionarEstado = (estado) => {
        setEstadoSeleccionado(estado);
        setMostrarTareasEstado(true);
    };

    const volverAEstados = () => {
        setMostrarTareasEstado(false);
        setEstadoSeleccionado(null);
    };

    const volverAEmpleados = () => {
        setShowTareasEmpleado(false);
        setMostrarTareasEstado(false);
        setEstadoSeleccionado(null);
        setShowListaEmpleadosAsignados(true);
    };

    const cerrarTareasEmpleado = () => {
        setShowTareasEmpleado(false);
        setMostrarTareasEstado(false);
        setEstadoSeleccionado(null);
    };

    const renderIcon = (iconName) => {
        switch (iconName) {
            case 'FaClock':
                return <FaClock />;
            case 'FaSpinner':
                return <FaSpinner />;
            case 'FaSearch':
                return <FaSearch />;
            case 'FaCheck':
                return <FaCheck />;
            default:
                return null;
        }
    };

    const handleArchivedTaskClick = (task) => {
        setSelectedArchivedTask(task);
        setShowArchivedTaskDetails(true);
    };

    const handleUnarchiveTask = async (taskId) => {
        try {
            await axiosInstance.put(`/desarchivarTarea/${taskId}`);
            await loadTasks(); // Recargar tareas para actualizar la lista
            setShowArchivedTaskDetails(false);
            setSelectedArchivedTask(null);
            Swal.fire('¡Éxito!', 'Tarea desarchivada correctamente', 'success');
        } catch (error) {
            console.error('Error al desarchivar tarea:', error);
            Swal.fire('Error', 'Error al desarchivar la tarea', 'error');
        }
    };

    return (
        <div className="kanban-container">
            <div className="kanban-header">
                <h2>Mis Tareas</h2>

                <div className="header-right">
                    {/* El Espacio de Equipo (plano, reuniones y chat) es de
                        todos: cualquiera escribe, llama o convoca a un
                        compañero. El tablero del equipo sigue siendo del líder. */}
                    <div className="acciones-equipo">
                        {user.lider == 'Si' && (
                            <button
                                className="btn-equipo es-tablero"
                                onClick={() => setVerTableroEquipo(true)}
                                title="Tablero del equipo"
                            >
                                <FaColumns /> <span>Tablero de Equipo</span>
                            </button>
                        )}
                            <button
                                className="btn-equipo es-espacio"
                                onClick={() => setEspacioEquipo('actividad')}
                                title="Espacio de equipo"
                            >
                                <FaUsers /> <span>Espacio de Equipo</span>
                            </button>
                    </div>

                    <div className="task-options-dropdown" ref={optionsDropdownRef}>
                        <button
                            className="task-options-btn"
                            onClick={() => setShowOptionsDropdown(prev => !prev)}
                        >
                            <FaEllipsisV /> <span>Opciones</span> <FaChevronDown className={showOptionsDropdown ? 'rotated' : ''} />
                        </button>
                        {showOptionsDropdown && (
                            <div className="task-options-menu">
                                <button
                                    className="task-options-item item-new"
                                    onClick={() => {
                                        setShowNewTaskModal(true);
                                        setAsignarTareasEmpleado(false);
                                        setShowOptionsDropdown(false);
                                    }}
                                >
                                    <FaPlus /> Nueva Tarea
                                </button>
                                <button
                                    className="task-options-item item-calendar"
                                    onClick={() => {
                                        const d = new Date();
                                        setCalendarMonthAnchor(new Date(d.getFullYear(), d.getMonth(), 1));
                                        setShowCalendarModal(true);
                                        setShowOptionsDropdown(false);
                                    }}
                                >
                                    <FaCalendar /> Calendario
                                </button>
                                <button
                                    className="task-options-item item-archive"
                                    onClick={() => {
                                        setShowArchiveModal(true);
                                        setShowOptionsDropdown(false);
                                    }}
                                >
                                    <FaArchive /> Tareas Archivadas
                                </button>
                                {user.lider == 'Si' && (
                                    <>
                                        <div className="task-options-divider" />
                                        <button
                                            className="task-options-item item-seguimiento"
                                            onClick={() => {
                                                abrirListaEmpleadosAsignados();
                                                setShowOptionsDropdown(false);
                                            }}
                                        >
                                            <FaSearch /> Seguimiento de Tareas
                                        </button>
                                        <button
                                            className="task-options-item item-reportes"
                                            onClick={abrirReportesDepartamento}
                                        >
                                            <FaChartBar /> Reportes del Departamento
                                        </button>
                                        <button
                                            className="task-options-item item-videos"
                                            onClick={() => {
                                                setShowOptionsDropdown(false);
                                                setShowVideosModal(true);
                                            }}
                                        >
                                            <FaVideo /> Vídeos del Tablero
                                        </button>
                                        <button
                                            className="task-options-item item-tablero"
                                            onClick={abrirTableroSeguimiento}
                                        >
                                            <FaDesktop /> Tablero de Seguimiento
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Modal de nueva tarea: para mí o para alguien de mi equipo. */}
            {showNewTaskModal && (() => {
                const paraOtro = asignarTareasEmpleado && empleadoAsignado;
                const destinatario = paraOtro
                    ? (user.empleados_asignados || []).find(e => String(e.id) === String(empleadoAsignado))?.nombre
                    : 'Yo';
                return (
                    <div className="modal-overlay">
                        <div className="new-task-modal ft-modal-ancho">
                            <div className="modal-header">
                                <h2>Nueva Tarea</h2>
                                <button type="button" className="close-button" onClick={() => setShowNewTaskModal(false)}>
                                    &times;
                                </button>
                            </div>
                            <div className="new-task-modal-body">
                                <FormularioTarea
                                    empleadoId={paraOtro ? empleadoAsignado : user.empleado}
                                    empleadoNombre={destinatario}
                                    proyectos={proyectos}
                                    plantillas={tareasPlantillaOpciones}
                                    onGuardada={async () => { setShowNewTaskModal(false); await loadTasks(); }}
                                    onCancelar={() => setShowNewTaskModal(false)}
                                />
                            </div>
                        </div>
                    </div>
                );
            })()}

            {showListaEmpleadosAsignados && (
                <div className="modal-overlay">
                    <div className="lista-empleados-asignados-modal">
                        <div className="modal-header">
                            <h2>👥 Empleados Asignados</h2>
                            <button className="close-button" onClick={() => setShowListaEmpleadosAsignados(false)}>
                                &times;
                            </button>
                        </div>
                        <div className="modal-content empleados-grid">
                            {user.empleados_asignados.map((empleado) => (
                                <div className="empleado-card" key={empleado.id}>
                                    <div className="empleado-info">
                                        <span className="empleado-nombre">{empleado.nombre.toLowerCase()}</span>
                                    </div>
                                    <button className="btn-ver" onClick={() => verTareas(empleado.id)}>
                                        <FaEye /> Ver Tareas
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            )}

            {showTareasEmpleado && (
                <div className="modal-overlay">
                    <div className="tareas-empleado-modal">
                        <div className="modal-header">
                            <h2>TAREAS DE {empleadoSeleccionado?.nombre}</h2>
                            <button
                                className="close-button"
                                onClick={cerrarTareasEmpleado}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="modal-content">
                            <div className="tareas-empleado-container">
                                {!mostrarTareasEstado ? (
                                    // Vista de estados (nivel 1)
                                    <>
                                        <div className="estados-cards">
                                            {Object.entries(columns).map(([estado, column]) => (

                                                <div
                                                    key={estado}
                                                    className="estado-card"
                                                    onClick={() => seleccionarEstado(estado)}
                                                    style={{ borderTop: `4px solid ${column.color}` }}
                                                >
                                                    <div className="estado-card-header">
                                                        {renderIcon(column.iconComponent)}
                                                        <h3>{column.title}</h3>
                                                    </div>
                                                    <div className="estado-card-count">
                                                        <span>{tareasEmpleado.filter(task => task.estado === estado).length}</span>
                                                        <span>tareas</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="buttons-container">
                                            <button
                                                className="back-button"
                                                onClick={volverAEmpleados}
                                            >
                                                <FaArrowLeft /> Volver a empleados
                                            </button>
                                            <button className="asignar-tareas-button" onClick={() => asignarTareas()}>
                                                <FaPlus /> Asignar Tareas
                                            </button>
                                        </div>


                                    </>

                                ) : (
                                    // Vista de tareas de un estado (nivel 2)
                                    <div className="tareas-estado-container">

                                        <div className="estado-tareas-header" >

                                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Tareas {estadoSeleccionado}</div>
                                        </div>
                                        <div className="tareas-list-container">
                                        <div className="tareas-list" >
                                            {tareasEmpleado
                                                .filter(task => task.estado === estadoSeleccionado)
                                                .map(task => (
                                                    <div
                                                        key={task.id}
                                                        className="task-card"
                                                        onClick={() => handleTaskClick(task)}
                                                    >
                                                        <div className="task-card-header">
                                                            <h4 style={{ textTransform: 'capitalize', marginBottom: '0.5rem' }}>{task.titulo}</h4>
                                                            {task.proyecto_nombre && (
                                                                <span className="proyecto-badge">
                                                                    <FaFolder style={{ marginRight: '4px', fontSize: '0.7rem' }} />
                                                                    {task.proyecto_nombre}
                                                                </span>
                                                            )}
                                                            <div className="task-card-header-right">
                                                                {task.prioridad && (
                                                                    <span className={`prioridad-badge ${task.prioridad.toLowerCase()}`}>
                                                                        {task.prioridad}
                                                                    </span>
                                                                )}
                                                                <div className="task-card-header-right-icons">
                                                                    {/* Mostrar Aprobación */}
                                                                    {task.aprobada ? (
                                                                        <FaCircleCheck color='green' title='Aprobada' style={{ marginRight: '0.5rem' }} />
                                                                    ) : (
                                                                        <FaCircleCheck color='grey' title='No aprobada' style={{ marginRight: '0.5rem', opacity: 0.5 }} />
                                                                    )}

                                                                    {/* Mostrar Visto Bueno */}
                                                                    {(task.estado === 'Completada' && task.visto_bueno && !task.rechazada) ? (
                                                                        <FaEye color='green' title='Visto bueno' style={{ marginRight: '0.5rem' }} />
                                                                    ) : (
                                                                        <FaEye color='grey' title='Pendiente de visto bueno' style={{ marginRight: '0.5rem', opacity: 0.5 }} />
                                                                    )}

                                                                    {/* Mostrar Rechazada */}
                                                                    {(task.estado === 'Completada' || task.estado === 'En Proceso') && task.rechazada ? (
                                                                        <FaCircleXmark color='red' title='Rechazada' style={{ marginRight: '0.5rem' }} />
                                                                    ) : null}

                                                                    {/* Mostrar Pausada */}
                                                                    {(task.pausada == 1 || task.pausada === true) ? (
                                                                        <FaPause color='#f97316' title='Tarea pausada' style={{ marginRight: '0.5rem' }} />
                                                                    ) : null}

                                                                </div>
                                                            </div>
                                                        </div>
                                                        <p className="task-description">{task.descripcion.substring(0, 100)}...</p>
                                                        <div className="task-dates">
                                                            {(task.estado === 'Pendiente' || task.estado === 'En Proceso') && task.fecha_pactada && (
                                                                <span className="date-badge due-date">
                                                                    <FaClock />
                                                                    Fecha límite: {new Date(task.fecha_pactada + 'T00:00:00').toLocaleDateString()}
                                                                </span>
                                                            )}
                                                            {task.estado === 'Completada' && task.fecha_entregada && (
                                                                <span className="date-badge completed-date">
                                                                    <FaCheck />
                                                                    Entregado: {new Date(task.fecha_entregada).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {task.evidencias && task.evidencias.length > 0 && (
                                                            <div className="evidences-container">
                                                                {task.evidencias.map(evidencia => (
                                                                    <span
                                                                        key={evidencia.id}
                                                                        className="evidence-icon"
                                                                        title={evidencia.nombre}
                                                                    >
                                                                        {getFileIcon(evidencia.tipo)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {task.subtareas_total > 0 && (
                                                            <div className={`checklist-badge${task.subtareas_completadas === task.subtareas_total ? ' completo' : ''}`}>
                                                                <FaListCheck />
                                                                <span>{task.subtareas_completadas}/{task.subtareas_total}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    ))}
                                            </div>
                                        </div>
                                        <button
                                            className="back-button"
                                            onClick={volverAEstados}
                                        >
                                            &larr; Volver a estados
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <BandejaDecisiones
                onAbrirTarea={abrirTareaPorId}
                onCambio={loadTasks}
                recarga={recargaBandeja}
            />

            <ReunionesPendientes onVerTodas={() => setEspacioEquipo('reuniones')} />

            {/* Sólo se ven en móvil y tablet: en escritorio caben las cuatro columnas. */}
            <nav className="kanban-pestanas" aria-label="Columnas del tablero" ref={pestanasRef}>
                {Object.entries(columns).map(([columnId, column], i) => (
                    <button
                        key={columnId}
                        type="button"
                        className={i === columnaVisible ? 'es-activa' : ''}
                        style={{ '--color-columna': column.color }}
                        aria-current={i === columnaVisible ? 'true' : undefined}
                        onClick={() => {
                            const t = tableroRef.current;
                            const col = t?.children[i];
                            if (col) t.scrollTo({ left: col.offsetLeft - t.firstElementChild.offsetLeft, behavior: 'smooth' });
                        }}
                    >
                        {column.title}
                        <span>{column.items.length}</span>
                    </button>
                ))}
            </nav>

            <DragDropContext onDragEnd={onDragEnd}>
                <div
                    className="kanban-board"
                    ref={tableroRef}
                    onScroll={(e) => {
                        // La columna visible es la que tiene el borde izquierdo
                        // más cerca del borde del tablero.
                        const t = e.currentTarget;
                        let mejor = 0;
                        let distancia = Infinity;
                        [...t.children].forEach((c, i) => {
                            const d = Math.abs(c.offsetLeft - t.firstElementChild.offsetLeft - t.scrollLeft);
                            if (d < distancia) { distancia = d; mejor = i; }
                        });
                        if (mejor !== columnaVisible) setColumnaVisible(mejor);
                    }}
                >
                    {Object.entries(columns).map(([columnId, column]) => (
                        <div key={columnId} className="kanban-column" data-status={column.title}>
                            <div className="column-header" style={{ backgroundColor: column.color }}>
                                {renderIcon(column.iconComponent)}
                                <h3>{column.title}</h3>
                                <span className="task-count">{column.items.length}</span>
                            </div>
                            <Droppable droppableId={columnId}>
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="task-list"
                                    >
                                        {column.items.map((task, index) => (
                                            <Draggable
                                                key={task.id.toString()}
                                                draggableId={task.id.toString()}
                                                index={index}
                                                isDragDisabled={!task.aprobada}
                                            >
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={`task-card ${snapshot.isDragging ? 'dragging' : ''} ${!task.aprobada ? 'disabled-drag' : ''}`}
                                                        onClick={() => handleTaskClick(task)}
                                                    >
                                                        <div className="kanban-column-visto-bueno">
                                                              {/* Mostrar Aprobación */}
                                                              {task.aprobada ? (
                                                                        <FaCircleCheck color='green' title='Aprobada' style={{ marginRight: '0.5rem' }} />
                                                                    ) : (
                                                                        <FaCircleCheck color='grey' title='No aprobada' style={{ marginRight: '0.5rem', opacity: 0.5 }} />
                                                                    )}

                                                                    {/* Mostrar Visto Bueno */}
                                                                    {task.estado === 'Completada' && task.visto_bueno && !task.rechazada ? (
                                                                        <FaEye color='green' title='Visto bueno' style={{ marginRight: '0.5rem' }} />
                                                                    ) : (
                                                                        <FaEye color='grey' title='Pendiente de visto bueno' style={{ marginRight: '0.5rem', opacity: 0.5 }} />
                                                                    )}

                                                                    {/* Mostrar Rechazada */}
                                                                    {(task.estado === 'Completada' || task.estado === 'En Proceso') && task.rechazada ? (
                                                                        <FaCircleXmark color='red' title='Rechazada' style={{ marginRight: '0.5rem' }} />
                                                                    ) : null}

                                                                    {/* Mostrar Pausada */}
                                                                    {(task.pausada == 1 || task.pausada === true) ? (
                                                                        <FaPause color='#f97316' title='Tarea pausada' style={{ marginRight: '0.5rem' }} />
                                                                    ) : null}


                                                        </div>
                                                        <div className="task-card-header">
                                                            <h4>{task.titulo}</h4>
                                                          
                                                            {task.prioridad && (
                                                                <span className={`prioridad-badge ${task.prioridad.toLowerCase()}`}>
                                                                    {task.prioridad}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {/* cortar descripcion a 100 caracteres */}
                                                        <p className="task-description">{task.descripcion.substring(0, 100)}...</p>
                                                        {task.proyecto_nombre && (
                                                                <span className="proyecto-badge">
                                                                    <FaFolder style={{ marginRight: '4px', fontSize: '0.7rem' }} />
                                                                    {task.proyecto_nombre}
                                                                </span>
                                                            )}
                                                        <div className="task-dates">
                                                            {(task.estado === 'Pendiente' || task.estado === 'En Proceso') && task.fecha_pactada && (
                                                                <span className="date-badge due-date">
                                                                    <FaClock />
                                                                    Fecha límite: {new Date(task.fecha_pactada + 'T00:00:00').toLocaleDateString()}
                                                                </span>
                                                            )}
                                                            {task.estado === 'Completada' && task.fecha_entregada && (
                                                                <span className="date-badge completed-date">
                                                                    <FaCheck />
                                                                    Entregado: {new Date(task.fecha_entregada + 'T00:00:00').toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {task.evidencias && task.evidencias.length > 0 && (
                                                            <div className="evidences-container">
                                                                {task.evidencias.map(evidencia => (
                                                                    <span
                                                                        key={evidencia.id}
                                                                        className="evidence-icon"
                                                                        title={evidencia.nombre}
                                                                    >
                                                                        {getFileIcon(evidencia.tipo)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {task.subtareas_total > 0 && (
                                                            <div className={`checklist-badge${task.subtareas_completadas === task.subtareas_total ? ' completo' : ''}`}>
                                                                <FaListCheck />
                                                                <span>{task.subtareas_completadas}/{task.subtareas_total}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>

            {showTaskDetails && selectedTask && (
                <TaskDetailsModal
                    task={selectedTask}
                    onClose={() => setShowTaskDetails(false)}
                    onUpdate={handleTaskUpdate}
                />
            )}

            {showCalendarModal && (
                <div
                    className="modal-overlay"
                    role="presentation"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowCalendarModal(false);
                    }}
                >
                    <div className="employee-calendar-modal" role="dialog" aria-labelledby="employee-calendar-title">
                        <div className="modal-header employee-calendar-header">
                            <h2 id="employee-calendar-title">
                                <FaCalendar style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
                                Calendario de tareas
                            </h2>
                            <button
                                type="button"
                                className="close-button"
                                onClick={() => setShowCalendarModal(false)}
                                aria-label="Cerrar calendario"
                            >
                                &times;
                            </button>
                        </div>
                        <div className="modal-content employee-calendar-body">
                            <div className="employee-calendar-toolbar">
                                <button
                                    type="button"
                                    className="employee-calendar-nav-btn"
                                    onClick={goCalendarPrevMonth}
                                    aria-label="Mes anterior"
                                >
                                    <FaChevronLeft />
                                </button>
                                <span className="employee-calendar-month-label">{calendarMonthTitle}</span>
                                <button
                                    type="button"
                                    className="employee-calendar-nav-btn"
                                    onClick={goCalendarNextMonth}
                                    aria-label="Mes siguiente"
                                >
                                    <FaChevronRight />
                                </button>
                            </div>
                            <p className="employee-calendar-hint">
                                Pendientes y en proceso por fecha límite; completadas por fecha de entrega.
                            </p>
                            <div className="employee-calendar-weekdays" aria-hidden="true">
                                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((label) => (
                                    <div key={label} className="employee-calendar-weekday">
                                        {label}
                                    </div>
                                ))}
                            </div>
                            <div className="employee-calendar-grid">
                                {calendarCells.map((cell) =>
                                    cell.type === 'empty' ? (
                                        <div key={cell.key} className="employee-calendar-cell employee-calendar-cell--empty" />
                                    ) : (
                                        <div
                                            key={cell.key}
                                            className={`employee-calendar-cell${isCalendarToday(cell.day) ? ' employee-calendar-cell--today' : ''}`}
                                        >
                                            <div className="employee-calendar-daynum">{cell.day}</div>
                                            <div className="employee-calendar-tasks">
                                                {(tasksByEndDate[cell.dateKey] || []).map((task) => {
                                                    const estado = (task.estado || '').trim();
                                                    const estadoClass =
                                                        estado === 'Completada'
                                                            ? 'done'
                                                            : estado === 'En Proceso'
                                                              ? 'progress'
                                                              : 'pending';
                                                    return (
                                                        <button
                                                            key={task.id}
                                                            type="button"
                                                            className={`employee-calendar-task ${estadoClass}`}
                                                            title={task.titulo}
                                                            onClick={() => {
                                                                handleTaskClick(task);
                                                                setShowCalendarModal(false);
                                                            }}
                                                        >
                                                            {task.titulo.length > 42
                                                                ? `${task.titulo.slice(0, 42)}…`
                                                                : task.titulo}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showArchiveModal && (
                <div className="modal-overlay">
                    <div className="tareas-archivadas-modal">
                        <div className="modal-header">
                            <h2>📁 Tareas Archivadas</h2>
                            <button className="close-button" onClick={() => setShowArchiveModal(false)}>
                                &times;
                            </button>
                        </div>
                        <div className="modal-content">
                            <div className="tareas-archivadas-container">
                                {tareasArchivadas.length === 0 ? (
                                    <div className="no-archived-tasks">
                                        <div className="no-archived-icon">📁</div>
                                        <h3>No hay tareas archivadas</h3>
                                        <p>Las tareas archivadas aparecerán aquí cuando las archives</p>
                                    </div>
                                ) : (
                                    tareasArchivadas.map(task => (
                                        <div 
                                            className="tarea-archivada-card" 
                                            key={task.id}
                                            onClick={() => handleArchivedTaskClick(task)}
                                        >
                                            <div className="archived-task-header">
                                                <div className="archived-task-info">
                                                    <h4>{task.titulo}</h4>
                                                    <p className="archived-task-description">
                                                        {task.descripcion.length > 100 
                                                            ? `${task.descripcion.substring(0, 100)}...` 
                                                            : task.descripcion
                                                        }
                                                    </p>
                                                </div>
                                                <div className="archived-task-meta">
                                                    <span className={`prioridad-badge ${task.prioridad?.toLowerCase()}`}>
                                                        {task.prioridad}
                                                    </span>
                                                    <span className="archived-date">
                                                        Archivada: {new Date(task.fecha_archivada + 'T00:00:00').toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="archived-task-footer">
                                                <div className="archived-task-dates">
                                                    {task.fecha_pactada && (
                                                        <span className="date-badge due-date">
                                                            <FaClock />
                                                            Fecha límite: {new Date(task.fecha_pactada + 'T00:00:00').toLocaleDateString()}
                                                        </span>
                                                    )}
                                                    {task.fecha_entregada && (
                                                        <span className="date-badge completed-date">
                                                            <FaCheck />
                                                            Entregado: {new Date(task.fecha_entregada + 'T00:00:00').toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                                {task.evidencias && task.evidencias.length > 0 && (
                                                    <div className="evidences-container">
                                                        <span className="evidence-count">
                                                            {task.evidencias.length} evidencia{task.evidencias.length !== 1 ? 's' : ''}
                                                        </span>
                                                        {task.evidencias.slice(0, 3).map(evidencia => (
                                                            <span
                                                                key={evidencia.id}
                                                                className="evidence-icon"
                                                                title={evidencia.nombre}
                                                            >
                                                                {getFileIcon(evidencia.tipo)}
                                                            </span>
                                                        ))}
                                                        {task.evidencias.length > 3 && (
                                                            <span className="evidence-more">
                                                                +{task.evidencias.length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showReportesModal && (
                <ReportesDepartamentoModal
                    user={user}
                    onClose={() => setShowReportesModal(false)}
                />
            )}

            {showVideosModal && (
                <VideosTableroModal onClose={() => setShowVideosModal(false)} />
            )}

            {verTableroEquipo && (
                <TableroEquipoModal onCerrar={() => setVerTableroEquipo(false)} />
            )}

            {espacioEquipo && (
                <EspacioEquipoModal
                    pestanaInicial={espacioEquipo}
                    onCerrar={() => setEspacioEquipo(null)}
                />
            )}

            {showArchivedTaskDetails && selectedArchivedTask && (
                <TaskDetailsModal
                    task={selectedArchivedTask}
                    onClose={() => {
                        setShowArchivedTaskDetails(false);
                        setSelectedArchivedTask(null);
                    }}
                    onUpdate={handleTaskUpdate}
                    isArchived={true}
                    onUnarchive={() => handleUnarchiveTask(selectedArchivedTask.id)}
                />
            )}

        </div>
    );
};

export default EmployeeInterface; 