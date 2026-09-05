import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
    FaPlus, FaClock, FaSpinner, FaCheck,
    FaEye, FaSearch, FaFile, FaFileWord,
    FaFileImage, FaFilePdf, FaTimes,
    FaSave, FaArrowLeft, FaLock, FaLink, FaArchive, FaFolder,
    FaCalendar, FaChevronLeft, FaChevronRight, FaChevronDown, FaChartBar, FaEllipsisV, FaPause,
    FaDesktop
} from 'react-icons/fa';
import TaskDetailsModal from './TaskDetailsModal';
import ReportesDepartamentoModal from './ReportesDepartamentoModal';
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
    const [isSaving, setIsSaving] = useState(false);
    const [proyectos, setProyectos] = useState([]);
    const [subtareasForm, setSubtareasForm] = useState([]);
    const [nuevaSubtareaTexto, setNuevaSubtareaTexto] = useState('');
    const [nuevaSubtareaFecha, setNuevaSubtareaFecha] = useState('');
    const [checklistTitulo, setChecklistTitulo] = useState('');
    const [showChecklist, setShowChecklist] = useState(false);
    const [checklistsExistentes, setChecklistsExistentes] = useState([]);
    const [selectedChecklistId, setSelectedChecklistId] = useState('');
    const [formProyectoId, setFormProyectoId] = useState('');
    const [newTaskTitulo, setNewTaskTitulo] = useState('');
    const [newTaskDescripcion, setNewTaskDescripcion] = useState('');
    const [newTaskFecha, setNewTaskFecha] = useState('');
    const [newTaskPrioridad, setNewTaskPrioridad] = useState('Media');
    const [newTaskEstado, setNewTaskEstado] = useState('Pendiente');
    const [selectedPlantillaId, setSelectedPlantillaId] = useState('');
    const checklistBlockRef = useRef(null);
    const optionsDropdownRef = useRef(null);
    const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
    const [showReportesModal, setShowReportesModal] = useState(false);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [calendarMonthAnchor, setCalendarMonthAnchor] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const resetNewTaskModalState = () => {
        setSubtareasForm([]);
        setNuevaSubtareaTexto('');
        setNuevaSubtareaFecha('');
        setShowChecklist(false);
        setChecklistTitulo('');
        setSelectedChecklistId('');
        setFormProyectoId('');
        setSelectedPlantillaId('');
        setNewTaskTitulo('');
        setNewTaskDescripcion('');
        setNewTaskFecha('');
        setNewTaskPrioridad('Media');
        setNewTaskEstado('Pendiente');
        setChecklistsExistentes([]);
    };

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

    useEffect(() => {
        if (!showChecklist || !showNewTaskModal) return;
        const t = window.setTimeout(() => {
            checklistBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 80);
        return () => window.clearTimeout(t);
    }, [showChecklist, showNewTaskModal]);

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

            // Validar checklist antes de mover a Completada
            if (destinationId === 'Completada' && (moved.subtareas_total || 0) > 0 && (moved.subtareas_completadas || 0) < moved.subtareas_total) {
                Swal.fire({
                    title: 'Checklist incompleto',
                    text: `Debes completar todas las subtareas antes de mover la tarea a Completada. (${moved.subtareas_completadas || 0}/${moved.subtareas_total} completadas)`,
                    icon: 'warning',
                    confirmButtonText: 'Entendido'
                });
                return;
            }

            // Actualizar el estado de la tarea
            moved.estado = destinationId;

            // Si se mueve a Completada, agregar la fecha de finalización
            if (destinationId === "Completada") {
                moved.fecha_entregada = new Date().toISOString().split('T')[0];
            }

            destItems.splice(destination.index, 0, moved);

            newColumns[sourceId].items = sourceItems;
            newColumns[destinationId].items = destItems;

            // Preparar datos para actualizar en el servidor
            const updateData = {
                estado: destinationId
            };

            // Si se mueve a Completada, incluir la fecha de finalización
            if (destinationId === "Completada") {
                updateData.fecha_entregada = new Date().toISOString().split('T')[0];
            }

            // Actualizar en el servidor. Si lo rechaza —por ejemplo porque la
            // tarea está pausada— hay que devolver la tarjeta a su columna: de
            // lo contrario quedaría movida en pantalla sin estarlo en la base
            // de datos.
            const columnasPrevias = columns;
            axiosInstance.put(`/actualizarEstadoTarea/${draggableId}`, updateData)
                .catch(error => {
                    console.error('Error al actualizar estado:', error);
                    setColumns(columnasPrevias);
                    const msg = error?.response?.data?.error
                        || 'No fue posible actualizar el estado de la tarea.';
                    Swal.fire({
                        title: error?.response?.status === 409 ? 'Tarea en pausa' : 'Error',
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
        resetNewTaskModalState();
        setShowNewTaskModal(true);
        setShowTareasEmpleado(false);
        setAsignarTareasEmpleado(true);
    };

    const handleTaskClick = (task) => {
        setSelectedTask(task);
        setShowTaskDetails(true);
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

    const aplicarPlantillaDesdeTarea = async (tareaId) => {
        if (!tareaId) return;
        try {
            const [tRes, sRes] = await Promise.all([
                axiosInstance.get(`/cargarTareaSeleccionada/${tareaId}`),
                axiosInstance.get(`/subtareas/${tareaId}`),
            ]);
            const t = tRes.data;
            setNewTaskTitulo(t.titulo || '');
            setNewTaskDescripcion(t.descripcion || '');
            setNewTaskFecha(normalizeYmd(t.fecha_pactada) || '');
            const pr = String(t.prioridad || 'Media').trim();
            setNewTaskPrioridad(['Alta', 'Media', 'Baja'].includes(pr) ? pr : 'Media');
            const est = String(t.estado || 'Pendiente').trim();
            setNewTaskEstado(est === 'En Proceso' ? 'En Proceso' : 'Pendiente');
            setFormProyectoId(t.proyecto_id ? String(t.proyecto_id) : '');
            const subs = Array.isArray(sRes.data) ? sRes.data : [];
            if (subs.length > 0) {
                setShowChecklist(true);
                setChecklistTitulo(subs[0]?.checklist_titulo || '');
                setSubtareasForm(
                    subs.map((s, i) => ({
                        tempId: Date.now() + i,
                        titulo: s.titulo || '',
                        fecha_vencimiento: normalizeYmd(s.fecha_vencimiento) || '',
                    }))
                );
            } else {
                setShowChecklist(false);
                setChecklistTitulo('');
                setSubtareasForm([]);
            }
            setSelectedPlantillaId(String(tareaId));
            setSelectedChecklistId('');
            window.requestAnimationFrame(() => {
                checklistBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        } catch (err) {
            console.error('Error al cargar plantilla:', err);
            Swal.fire('Error', 'No se pudo cargar la plantilla de la tarea', 'error');
        }
    };

    const onPlantillaSelectChange = (value) => {
        if (!value) {
            resetNewTaskModalState();
            return;
        }
        aplicarPlantillaDesdeTarea(value);
    };

    const handleSubmitNewTask = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {

            let empleado = null;
            if (asignarTareasEmpleado) {
                empleado = empleadoAsignado;
            } else {
                empleado = user.empleado;
            }

            if (!String(newTaskTitulo || '').trim() || !String(newTaskDescripcion || '').trim() || !newTaskFecha) {
                Swal.fire({
                    title: 'Error',
                    text: 'Completa título, descripción y fecha límite',
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
                return;
            }

            if (newTaskFecha < new Date().toISOString().split('T')[0]) {
                Swal.fire({
                    title: 'Error',
                    text: 'La fecha pactada no puede ser menor a la fecha actual',
                    icon: 'error',
                    confirmButtonText: 'OK',
                });
                return;
            }

            const response = await axiosInstance.post('/guardarTarea', {
                titulo: newTaskTitulo,
                descripcion: newTaskDescripcion,
                fecha_pactada: newTaskFecha,
                prioridad: newTaskPrioridad,
                empleado: empleado,
                estado: newTaskEstado,
                proyecto_id: formProyectoId || null,
                accion: 'guardar'
            });

            // Guardar subtareas si las hay
            const tareaId = response.data.tarea_id;
            if (tareaId && subtareasForm.length > 0) {
                const items = subtareasForm
                    .map(s => ({ ...s, titulo: String(s.titulo || '').trim() }))
                    .filter(s => s.titulo.length > 0);
                await Promise.all(items.map(s =>
                    axiosInstance.post('/subtareas', {
                        tarea_id: tareaId,
                        titulo: s.titulo,
                        fecha_vencimiento: s.fecha_vencimiento || null,
                        checklist_titulo: checklistTitulo || null
                    })
                ));
            }
            resetNewTaskModalState();

            // Cerrar el modal primero
            setShowNewTaskModal(false);

            // preguntar si la tarea es para un empleado o para el lider
            const tasksResponse = await axiosInstance.get(`/cargarTareas/${user.empleado}`);
            const tasks = tasksResponse.data.tareas;

            // Organizar las tareas en las columnas
      
            const newColumns = {
                'Pendiente': {
                    title: 'Pendiente',
                    items: tasks.filter(task => task.estado === 'Pendiente'),
                    iconComponent: 'FaClock',
                    color: '#f97316'
                },
                'En Proceso': {
                    title: 'En Proceso',
                    items: tasks.filter(task => task.estado === 'En Proceso'),
                    iconComponent: 'FaSpinner',
                    color: '#2563eb'
                },
                'Completada': {
                    title: 'Completada',
                    items: tasks.filter(task => task.estado === 'Completada' && !task.archivar),
                    iconComponent: 'FaCheck',
                    color: '#16a34a'
                }
            };

            setColumns(newColumns);
            Swal.fire('¡Éxito!', 'Tarea creada correctamente', 'success');
        } catch (error) {
            console.error('Error al crear la tarea:', error);
            Swal.fire('Error', 'Error al crear la tarea', 'error');
        } finally {
            setIsSaving(false);
        }
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
        }J
    };

    return (
        <div className="kanban-container">
            <div className="kanban-header">
                <h2>Mis Tareas</h2>

                <div className="header-right">
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
                                        resetNewTaskModalState();
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

            {/* Modal de nueva tarea */}
            {showNewTaskModal && (
                <>  
                {isSaving && (
                    <div className="loader">
                        <div className="justify-content-center jimu-primary-loading"></div>
                    </div>
                )}
                <div className="modal-overlay">
                    <div className="new-task-modal">
                        <div className="modal-header">
                            <h2>Nueva Tarea</h2>
                            <button
                                type="button"
                                className="close-button"
                                onClick={() => { setShowNewTaskModal(false); resetNewTaskModalState(); }}
                            >
                                &times;
                            </button>
                        </div>
                        <form className="new-task-modal-form" onSubmit={handleSubmitNewTask}>
                            <div className="new-task-modal-body">
                                <div className="form-group">
                                    <label htmlFor="plantilla_tarea">Plantilla (tarea ya creada)</label>
                                    <select
                                        id="plantilla_tarea"
                                        className="plantilla-tarea-select"
                                        value={selectedPlantillaId}
                                        onChange={e => onPlantillaSelectChange(e.target.value)}
                                    >
                                        <option value="">Empezar en blanco</option>
                                        {tareasPlantillaOpciones.map(opt => (
                                            <option key={opt.id} value={String(opt.id)}>
                                                {opt.titulo}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="plantilla-tarea-hint">
                                        Carga título, descripción, fechas, prioridad, proyecto y checklist de una tarea tuya del tablero para editar solo lo necesario.
                                    </p>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="titulo">Título</label>
                                    <input
                                        type="text"
                                        id="titulo"
                                        name="titulo"
                                        value={newTaskTitulo}
                                        onChange={e => setNewTaskTitulo(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="descripcion">Descripción</label>
                                    <textarea
                                        id="descripcion"
                                        name="descripcion"
                                        value={newTaskDescripcion}
                                        onChange={e => setNewTaskDescripcion(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="fecha_pactada">Fecha límite</label>
                                    <input
                                        type="date"
                                        id="fecha_pactada"
                                        name="fecha_pactada"
                                        value={newTaskFecha}
                                        onChange={e => setNewTaskFecha(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="prioridad">Prioridad</label>
                                    <select
                                        id="prioridad"
                                        name="prioridad"
                                        value={newTaskPrioridad}
                                        onChange={e => setNewTaskPrioridad(e.target.value)}
                                        required
                                    >
                                        <option value="Alta">Alta</option>
                                        <option value="Media">Media</option>
                                        <option value="Baja">Baja</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="estado">Estado</label>
                                    <select
                                        id="estado"
                                        name="estado"
                                        value={newTaskEstado}
                                        onChange={e => setNewTaskEstado(e.target.value)}
                                        required
                                    >
                                        <option value="Pendiente">Pendiente</option>
                                        <option value="En Proceso">En Proceso</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="proyecto_id">Proyecto (opcional)</label>
                                    <select
                                        id="proyecto_id"
                                        name="proyecto_id"
                                        value={formProyectoId}
                                        onChange={e => setFormProyectoId(e.target.value)}
                                    >
                                        <option value="">Sin proyecto</option>
                                        {proyectos.map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group" ref={checklistBlockRef}>
                                    <div className="checklist-toggle-row">
                                        <button
                                            type="button"
                                            className={`checklist-toggle-btn${showChecklist ? ' active' : ''}`}
                                            onClick={() => {
                                                const empId = asignarTareasEmpleado ? empleadoAsignado : user?.empleado;
                                                if (!showChecklist && empId) {
                                                    loadChecklistsExistentes(empId);
                                                }
                                                setShowChecklist(prev => !prev);
                                            }}
                                        >
                                            ☑ Checklist
                                        </button>
                                        <span className="checklist-hint">Aquí abajo agregas los ítems</span>
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
                                                        <option value="">Copiar checklist de otra tarea…</option>
                                                        {checklistsExistentes.map(c => (
                                                            <option key={c.tarea_id} value={c.tarea_id}>
                                                                {c.tarea_titulo}{c.checklist_titulo ? ` — ${c.checklist_titulo}` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                            {subtareasForm.length > 0 && (
                                                <ul className="subtareas-list checklist-items-preview new-task-subtareas-editable">
                                                    {subtareasForm.map(s => (
                                                        <li key={s.tempId} className="subtarea-item">
                                                            <input
                                                                type="text"
                                                                className="subtarea-edit-input"
                                                                value={s.titulo}
                                                                placeholder="Descripción del ítem..."
                                                                onChange={e =>
                                                                    setSubtareasForm(prev =>
                                                                        prev.map(x =>
                                                                            x.tempId === s.tempId
                                                                                ? { ...x, titulo: e.target.value }
                                                                                : x
                                                                        )
                                                                    )
                                                                }
                                                            />
                                                            <input
                                                                type="date"
                                                                className="subtarea-edit-date"
                                                                value={s.fecha_vencimiento || ''}
                                                                onChange={e =>
                                                                    setSubtareasForm(prev =>
                                                                        prev.map(x =>
                                                                            x.tempId === s.tempId
                                                                                ? { ...x, fecha_vencimiento: e.target.value }
                                                                                : x
                                                                        )
                                                                    )
                                                                }
                                                                title="Fecha de vencimiento del ítem"
                                                            />
                                                            <button
                                                                type="button"
                                                                className="subtarea-delete"
                                                                style={{ opacity: 1 }}
                                                                title="Quitar ítem"
                                                                onClick={() =>
                                                                    setSubtareasForm(prev =>
                                                                        prev.filter(x => x.tempId !== s.tempId)
                                                                    )
                                                                }
                                                            >
                                                                <FaTimes />
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            <div className="checklist-add-zone">
                                                <div className="checklist-add-zone-label">Nuevo ítem del checklist</div>
                                                <div className="subtarea-add-row">
                                                    <input
                                                        type="text"
                                                        className="subtarea-add-input"
                                                        placeholder="Escribe el ítem y pulsa + o Enter"
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
                                                        title="Fecha de vencimiento del ítem"
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
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="modal-actions new-task-modal-actions">
                                <button
                                    type="button"
                                    className="cancel-button-new-task"
                                    onClick={() => { setShowNewTaskModal(false); resetNewTaskModalState(); }}
                                >
                                    <FaTimes /> Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="submit-button-new-task"
                                >
                                    <FaSave /> Crear Tarea
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                </>
            )}

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

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="kanban-board">
                    {Object.entries(columns).map(([columnId, column]) => (
                        <div key={columnId} className="kanban-column" data-status={column.title} style={{ overflow: 'hidden' }}>
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
                                        style={{ overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}
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