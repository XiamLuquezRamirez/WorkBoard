import React, { useState, useRef, useEffect } from 'react';
import {
    FaFileUpload, FaCheck,
    FaClock, FaSpinner, FaDownload,
    FaTrash, FaFile, FaImage, FaEdit, FaSave, FaEye, FaPause, FaPlay, FaComment,
    FaLink, FaGoogleDrive, FaArchive, FaCalendar, FaFolder, FaPlus, FaTimes
} from 'react-icons/fa';    
import axios from 'axios';
import Swal from 'sweetalert2';
import FileViewerModal from './FileViewerModal';
import NotificationsModal from './NotificationsModal';
import config from '../config';
import { useUser } from './UserContext';
import axiosInstance from '../axiosConfig';
import { FaCircleCheck, FaCircle, FaCircleXmark } from 'react-icons/fa6';

/** Normaliza aprobada desde API (1, "1", true, etc.) */
const esTareaAprobadaValor = (v) => {
    if (v === true || v === 1 || v === '1') return true;
    if (typeof v === 'string' && v.trim() === '1') return true;
    const n = Number(v);
    return n === 1;
};

const TaskDetailsModal = ({ task, onClose, onUpdate, showObservacionesButton, isArchived = false, onUnarchive, overlayZIndex }) => {
    const [loading, setLoading] = useState(false);
    const [currentStatus, setCurrentStatus] = useState(task.estado);
    const [isChangingStatus, setIsChangingStatus] = useState(false);
    const [previewFiles, setPreviewFiles] = useState([]);
    const [evidencias, setEvidencias] = useState(
        task.evidencias
            ? task.evidencias.map(evidencia => ({
                id: evidencia.id,
                nombre: evidencia.nombre,
                ruta: evidencia.evidencia,
                tipo: evidencia.tipo
            }))
            : []);
    const [observaciones, setObservaciones] = useState(task.observacion_entrega || '');
    const [vistoBueno, setVistoBueno] = useState(task.visto_bueno === 1);
    const { user } = useUser();
   
    const fileInputRef = useRef(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
    const [isEditingTask, setIsEditingTask] = useState(false);
    const [isButtonObservaciones, setIsButtonObservaciones] = useState(false);
    const [aprobada, setAprobada] = useState(() => esTareaAprobadaValor(task?.aprobada));
    const [rechazada, setRechazada] = useState(task.rechazada === 1);
    const [isUploading, setIsUploading] = useState(false);
    const [pausada, setPausada] = useState(task.pausada === 1);
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const [chatReceptor, setChatReceptor] = useState(task.empleado);
    const [isIframeLoading, setIsIframeLoading] = useState(true);
    const [editable, setEditable] = useState(task.editable === 1);
    const [pausaSolicitada, setPausaSolicitada] = useState(false);
    const [pausaMotivo, setPausaMotivo] = useState('');
    const [pausaFechaReanudacion, setPausaFechaReanudacion] = useState('');
    const [pausaSubmitting, setPausaSubmitting] = useState(false);
    const [showReanudarForm, setShowReanudarForm] = useState(false);
    const [reanudarFecha, setReanudarFecha] = useState('');
    const [reanudarMotivo, setReanudarMotivo] = useState('');
    const [reanudarSubmitting, setReanudarSubmitting] = useState(false);
    //fecha de tarea en fomao local
    const [editedTask, setEditedTask] = useState({
        titulo: task.titulo,
        descripcion: task.descripcion,
        prioridad: task.prioridad,
        fecha_pactada: task.fecha_pactada,
        proyecto_id: task.proyecto_id ?? ''
    });
    const [proyectos, setProyectos] = useState([]);
    //obtener el id del usuario logueado de variable de sesion laravel
    const chatUser = user.user_id_chat;
    
    // Nuevo estado para el link de Drive
    const [driveLink, setDriveLink] = useState('');
    const [showDriveInput, setShowDriveInput] = useState(false);
    // Estado para manejar links temporales (no guardados en BD aún)
    const [tempDriveLinks, setTempDriveLinks] = useState([]);
    // Estado para manejar la selección de radio buttons
    const [revisionSelection, setRevisionSelection] = useState('');
    // Subtareas / checklist (misma UX que EmployeeModal: panel, título, copiar, filas inline)
    const [subtareas, setSubtareas] = useState([]);
    const [nuevaSubtarea, setNuevaSubtarea] = useState('');
    const [nuevaSubtareaFecha, setNuevaSubtareaFecha] = useState('');
    const [checklistTitulo, setChecklistTitulo] = useState('');
    const [checklistsExistentes, setChecklistsExistentes] = useState([]);
    const [selectedChecklistId, setSelectedChecklistId] = useState('');
    // actividades y comentarios
    const [actividadesComentarios, setActividadesComentarios] = useState([]);
    const [comentarioNuevo, setComentarioNuevo] = useState('');
    const [guardandoComentario, setGuardandoComentario] = useState(false);
    // reprogramaciones
    const [historialReprg, setHistorialReprg] = useState([]);
    const [reprgPendiente, setReprgPendiente] = useState(null);
    const [showReprgForm, setShowReprgForm] = useState(false);
    const [reprgFechaNueva, setReprgFechaNueva] = useState('');
    const [reprgMotivo, setReprgMotivo] = useState('');
    const [reprgSubmitting, setReprgSubmitting] = useState(false);
    const [resolviendoReprg, setResolviendoReprg] = useState(false);
    // pausas solicitadas
    const [historialPausas, setHistorialPausas] = useState([]);
    const [pausaPendiente, setPausaPendiente] = useState(null);
    const [resolviendoPausa, setResolviendoPausa] = useState(false);
    const subtareasRef = useRef([]);
    const checklistTituloRef = useRef('');

    // Ref del overlay para anclar SweetAlert2 dentro del modal.
    // Esto evita conflictos de foco/click cuando se dispara Swal desde un modal abierto.
    const modalOverlayRef = useRef(null);

    const fireSwal = (arg1, arg2, arg3) => {
        // Cuando hay un modal anidado abierto (reprg o pausa) usamos document.body
        // para que Swal quede en el stacking context raíz y su z-index global funcione.
        const target = (showReprgForm || pausaSolicitada || showReanudarForm)
            ? document.body
            : (modalOverlayRef.current || document.body);
        if (typeof arg1 === 'string') {
            return Swal.fire({
                title: arg1,
                text: arg2,
                icon: arg3,
                target,
            });
        }
        return Swal.fire({
            ...arg1,
            target,
        });
    };

    // Asegura que SweetAlert2 quede por encima del detalle de tarea y del modal de pausa (overlay pausa ≈ base+40).
    useEffect(() => {
        const styleId = 'task-details-swal2-zindex';
        let styleEl = document.getElementById(styleId);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }

        let baseZ = Number(overlayZIndex);
        if (!Number.isFinite(baseZ) || baseZ <= 0) {
            baseZ = 10000;
        }
        const zIndex = baseZ + 120;
        styleEl.textContent = `.swal2-container,.swal2-backdrop{z-index:${zIndex} !important;}`;

        return () => {
            const existing = document.getElementById(styleId);
            if (existing) existing.remove();
        };
    }, [overlayZIndex]);

    useEffect(() => {
        setCurrentStatus(task.estado);
        setEvidencias(
            task.evidencias
                ? task.evidencias.map(evidencia => ({
                    id: evidencia.id,
                    nombre: evidencia.nombre,
                    ruta: evidencia.evidencia,
                    tipo: evidencia.tipo
                }))
                : []
        );
        setVistoBueno(task.visto_bueno === 1);
        setAprobada(esTareaAprobadaValor(task.aprobada));
        setRechazada(task.rechazada === 1);
        setObservaciones(task.observacion_entrega || '');
        setEditedTask({
            titulo: task.titulo,
            descripcion: task.descripcion,
            prioridad: task.prioridad,
            fecha_pactada: task.fecha_pactada
        });

        // Inicializar selección de radio buttons
        if (task.visto_bueno === 1 && task.rechazada !== 1) {
            setRevisionSelection('visto_bueno');
        } else if (task.rechazada === 1) {
            setRevisionSelection('rechazada');
        } else {
            setRevisionSelection('');
        }

        setPausada(task.pausada === 1);

        // Cargar subtareas
        axiosInstance.get(`/subtareas/${task.id}`)
            .then(r => {
                const rows = Array.isArray(r.data) ? r.data : [];
                const mapped = rows.map(s => ({
                    ...s,
                    completada: Number(s?.completada) === 1 ? 1 : 0,
                }));
                setSubtareas(mapped);
                setChecklistTitulo(mapped[0]?.checklist_titulo || '');
                setSelectedChecklistId('');
                setChecklistsExistentes([]);
            })
            .catch(() => {});

        // Cargar historial de reprogramaciones
        axiosInstance.get(`/reprogramaciones/tarea/${task.id}`)
            .then(r => {
                const rows = Array.isArray(r.data) ? r.data : [];
                setHistorialReprg(rows);
                setReprgPendiente(rows.find(x => x.estado === 'Pendiente') || null);
            })
            .catch(() => {});

        // Cargar historial de pausas solicitadas
        axiosInstance.get(`/pausas/tarea/${task.id}`)
            .then(r => {
                const rows = Array.isArray(r.data) ? r.data : [];
                setHistorialPausas(rows);
                setPausaPendiente(rows.find(x => x.estado === 'Pendiente') || null);
            })
            .catch(() => {});

        // Cargar feed de actividades y comentarios
        axiosInstance.get(`/tarea/${task.id}/actividades-comentarios`)
            .then(r => setActividadesComentarios(Array.isArray(r.data) ? r.data : []))
            .catch(() => {});
    }, [task]);
 
    const currentUser = user;    

    // Líder: flag en users (variantes por BD) o tiene empleados bajo su cargo (login devuelve empleados_asignados).
    const liderFlagSi = (() => {
        const v = currentUser?.lider;
        if (v === true || v === 1 || v === '1') return true;
        const s = String(v ?? '').trim().toLowerCase();
        return s === 'si' || s === 'sí' || s === 'yes';
    })();
    const liderConEquipo =
        Array.isArray(currentUser?.empleados_asignados) &&
        currentUser.empleados_asignados.length > 0;
    const tipoUsuarioNorm = String(currentUser?.tipo_usuario ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const isLiderPorTipo =
        tipoUsuarioNorm === 'lider' ||
        (tipoUsuarioNorm.length > 0 && tipoUsuarioNorm.includes('lider'));
    const isLider = liderFlagSi || liderConEquipo || isLiderPorTipo;
    const isOwnTask =
        String(currentUser?.empleado ?? '').trim() !== '' &&
        String(currentUser?.empleado ?? '').trim() === String(task?.empleado ?? '').trim();
    const isAdmin = currentUser?.tipo_usuario === 'Administrador';
    // Líder con independencia activa: puede supervisar sus propias tareas sin intervención externa
    const isIndependiente = (() => {
        const v = currentUser?.independencia;
        if (v === true || v === 1 || v === '1') return true;
        const s = String(v ?? '').trim().toLowerCase();
        return s === 'si' || s === 'sí';
    })();


    const canSupervisarPropia = isLider && isIndependiente && isOwnTask;
    // Checklist: el asignado siempre (si no está archivada). En modo "Editar tarea",
    // admin o líder editando una tarea ajena pueden gestionar ítems igual que el asignado.
    const canEditChecklistWhileEditingTask =
        isEditingTask && !isArchived && (isAdmin || (isLider && !isOwnTask) || canSupervisarPropia);
    const canEditChecklist =
        !isArchived && (isOwnTask || canEditChecklistWhileEditingTask);
    // Tarea aprobada: en **tu** tarea (asignada a ti) solo marcas completado; aunque seas líder no puedes editar/eliminar/reemplazar el checklist — solo administrador. En tarea ajena aprobada, admin o líder en modo edición sí pueden la estructura.
    const isTaskApproved = aprobada === true || esTareaAprobadaValor(task?.aprobada);
    const canEditChecklistStructure =
        canEditChecklist &&
        (isEditingTask ||
         !isTaskApproved ||
            (isTaskApproved && isOwnTask && isAdmin) ||
            (isTaskApproved && !isOwnTask && (isAdmin || isLider)));

    useEffect(() => {
        subtareasRef.current = subtareas;
    }, [subtareas]);

    useEffect(() => {
        checklistTituloRef.current = checklistTitulo;
    }, [checklistTitulo]);

    useEffect(() => {
        if (!task?.id || !task?.empleado || isArchived || !canEditChecklistStructure) return;
        let cancelled = false;
        axiosInstance
            .get(`/checklists-empleado/${task.empleado}`)
            .then(r => {
                if (!cancelled) setChecklistsExistentes(Array.isArray(r.data) ? r.data : []);
            })
            .catch(() => {
                if (!cancelled) setChecklistsExistentes([]);
            });
        return () => {
            cancelled = true;
        };
    }, [task?.id, task?.empleado, isArchived, canEditChecklistStructure]);

    const openSolicitudPausaModal = () => {
        setPausaMotivo('');
        setPausaFechaReanudacion('');
        setPausaSolicitada(true);
    };

    const handleSolicitarPausaSubmit = async (e) => {
        e.preventDefault();
        const motivo = pausaMotivo.trim();
        const fechaReanudacion = pausaFechaReanudacion;
        if (!motivo || motivo.length < 3) {
            await fireSwal('Motivo requerido', 'Describa el motivo de la pausa (mínimo 3 caracteres).', 'warning');
            return;
        }
        if (!fechaReanudacion) {
            await fireSwal('Fecha requerida', 'Indique la fecha de reanudación prevista.', 'warning');
            return;
        }
        setPausaSubmitting(true);
        try {
            await axiosInstance.post('/solicitarPausa', {
                tarea_id: task.id,
                motivo,
                fecha_reanudacion: fechaReanudacion,
            });
            await recargarHistorialPausas();
            setPausaSolicitada(false);
            await fireSwal('¡Listo!', 'Solicitud de pausa enviada. Queda pendiente de aprobación.', 'success');
        } catch (err) {
            const errs = err?.response?.data?.errors;
            let msg =
                err?.response?.data?.mensaje ||
                err?.response?.data?.message ||
                err?.message ||
                'No se pudo registrar la pausa';
            if (errs && typeof errs === 'object') {
                const first = Object.values(errs)[0];
                if (Array.isArray(first) && first[0]) msg = first[0];
            }
            await fireSwal('Error', msg, 'error');
        } finally {
            setPausaSubmitting(false);
        }
    };

    const openReanudarForm = () => {
        setReanudarFecha(task.fecha_pactada || '');
        setReanudarMotivo('');
        setShowReanudarForm(true);
    };

    const handleReanudar = async (e) => {
        e.preventDefault();
        if (!reanudarFecha) {
            await fireSwal('Fecha requerida', 'Indique la nueva fecha pactada para continuar.', 'warning');
            return;
        }
        if (!reanudarMotivo.trim()) {
            await fireSwal('Motivo requerido', 'Indique el motivo de la reanudación.', 'warning');
            return;
        }
        setReanudarSubmitting(true);
        try {
            await axiosInstance.put(`/pausarTarea/${task.id}`, { pausada: false, motivo: reanudarMotivo });
            await axiosInstance.put(`/reprogramarTarea/${task.id}`, {
                fecha_pactada: reanudarFecha,
                motivo_reprogramacion: reanudarMotivo,
            });
            setPausada(false);
            setEditedTask(prev => ({ ...prev, fecha_pactada: reanudarFecha }));
            setShowReanudarForm(false);
            onUpdate();
            await fireSwal('¡Listo!', 'Tarea reanudada y fecha actualizada correctamente.', 'success');
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'No se pudo reanudar la tarea';
            await fireSwal('Error', msg, 'error');
        } finally {
            setReanudarSubmitting(false);
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);

        // Crear previsualizaciones
        const newPreviewFiles = files.map(file => ({
            file,
            name: file.name,
            preview: file.type.startsWith('image/')
                ? URL.createObjectURL(file)
                : null,
            type: file.type
        }));

        setPreviewFiles([...previewFiles, ...newPreviewFiles]);
    };

    const handleArchiveTask = async () => {
        await axiosInstance.put(`/archivarTarea/${task.id}`);
        onUpdate();
        fireSwal('¡Éxito!', 'Tarea archivada correctamente', 'success');
    };

    const removeFile = (index) => {
        setPreviewFiles(prev => {
            const newFiles = [...prev];
            // Liberar URL si es una imagen
            if (newFiles[index].preview) {
                URL.revokeObjectURL(newFiles[index].preview);
            }
            newFiles.splice(index, 1);
            return newFiles;
        });
    };

    const removeTempLink = (index) => {
        setTempDriveLinks(prev => prev.filter((_, i) => i !== index));
    };

    const handleUploadEvidences = async () => {
        if (previewFiles.length === 0) {
            fireSwal('Error', 'Seleccione archivos para subir', 'error');
            return;
        }

        setLoading(true);

        const formData = new FormData();
        previewFiles.forEach(fileData => {
            formData.append('evidencias[]', fileData.file);
        });
        formData.append('tarea_id', task.id);

        try {
            const response = await axiosInstance.post('/subirEvidencias', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });


            // Limpiar previsualizaciones
            previewFiles.forEach(fileData => {
                if (fileData.preview) {
                    URL.revokeObjectURL(fileData.preview);
                }
            });

            setPreviewFiles([]);

            // Actualizar el estado de evidencias con las nuevas
            const nuevasEvidencias = response.data.evidencias.map(evidencia => ({
                id: evidencia.id,
                nombre: evidencia.nombre_original,
                ruta: evidencia.ruta,
                tipo: evidencia.tipo,
                created_at: new Date().toISOString()
            }));

            setEvidencias(prevEvidencias => [...prevEvidencias, ...nuevasEvidencias]);

            // Actualizar estado de la tarea y evidencias, agregar fecha de entrega formato aaaa-mm-dd
            await axiosInstance.put(`/actualizarEstadoTarea/${task.id}`, {
                estado: currentStatus,
                evidencias: nuevasEvidencias,
                fecha_entregada: new Date().toISOString().split('T')[0]
            });

            onUpdate();
            fireSwal('¡Éxito!', 'Evidencias subidas correctamente', 'success');
        } catch (error) {
            fireSwal('Error', 'Error al subir las evidencias', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Función para validar y procesar links de Drive
    const validateDriveLink = (link) => {
        // Validar que sea un link de Google Drive
        const drivePatterns = [
            /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
            /^https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
            /^https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/,
            /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
            /^https:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/,
            /^https:\/\/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/,
        ];

        for (let pattern of drivePatterns) {
            if (pattern.test(link)) {
                return true;
            }
        }
        return false;
    };

    // Función para agregar link de Drive como evidencia
    const handleAddDriveLink = () => {
        if (!driveLink.trim()) {
            fireSwal('Error', 'Por favor ingrese un link de Drive', 'error');
            return;
        }

        if (!validateDriveLink(driveLink)) {
            fireSwal('Error', 'Por favor ingrese un link válido de Google Drive', 'error');
            return;
        }

        // Agregar el link a la lista temporal (no se guarda en BD aún)
        const nuevoLink = {
            id: Date.now(), // ID temporal
            nombre: 'Link de Drive',
            ruta: driveLink,
            tipo: 'application/link',
            created_at: new Date().toISOString()
        };

        // Agregar a la lista de links temporales
        setTempDriveLinks(prevLinks => [...prevLinks, nuevoLink]);
        
        // Limpiar el campo y ocultar el input
        setDriveLink('');
        setShowDriveInput(false);
        
        fireSwal('¡Éxito!', 'Link de Drive agregado a la lista. Presione "Subir evidencias" para guardarlo.', 'success');
    };

    // Función para subir archivos y links de Drive
    const handleUploadEvidencesAndLinks = async () => {
        if (previewFiles.length === 0 && tempDriveLinks.length === 0) {
            fireSwal('Error', 'Seleccione archivos o agregue links de Drive', 'error');
            return;
        }

        setLoading(true);

        try {
            let nuevasEvidencias = [];

            // Subir archivos si existen
            if (previewFiles.length > 0) {
                const formData = new FormData();
                previewFiles.forEach(fileData => {
                    formData.append('evidencias[]', fileData.file);
                });
                formData.append('tarea_id', task.id);

                const response = await axiosInstance.post('/subirEvidencias', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });

                nuevasEvidencias = response.data.evidencias.map(evidencia => ({
                    id: evidencia.id,
                    nombre: evidencia.nombre_original,
                    ruta: evidencia.ruta,
                    tipo: evidencia.tipo,
                    created_at: new Date().toISOString()
                }));

                // Limpiar previsualizaciones
                previewFiles.forEach(fileData => {
                    if (fileData.preview) {
                        URL.revokeObjectURL(fileData.preview);
                    }
                });
                setPreviewFiles([]);
            }

            // Guardar links de Drive temporales en la base de datos
            if (tempDriveLinks.length > 0) {
                for (const linkData of tempDriveLinks) {
                    const response = await axiosInstance.post('/guardarEvidenciaLink', {
                        tarea_id: task.id,
                        evidencia: linkData.ruta,
                        nombre: linkData.nombre,
                        tipo: linkData.tipo
                    });

                    if (response.data.success) {
                        nuevasEvidencias.push({
                            id: response.data.evidencia_id,
                            nombre: linkData.nombre,
                            ruta: linkData.ruta,
                            tipo: linkData.tipo,
                            created_at: linkData.created_at
                        });
                    }
                }
                
                // Limpiar links temporales
                setTempDriveLinks([]);
            }

            setEvidencias(prevEvidencias => [...prevEvidencias, ...nuevasEvidencias]);
            setDriveLink('');
            setShowDriveInput(false);

            // Actualizar estado de la tarea
            await axiosInstance.put(`/actualizarEstadoTarea/${task.id}`, {
                estado: currentStatus,
                evidencias: nuevasEvidencias
            });

            onUpdate();
            fireSwal('¡Éxito!', 'Evidencias subidas correctamente', 'success');
        } catch (error) {
            fireSwal('Error', 'Error al subir las evidencias', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (newStatus) => {
        if (newStatus === currentStatus) return;

        if (newStatus === 'Completada' && subtareas.length > 0 && subtareasCompletadas < subtareas.length) {
            fireSwal('Checklist incompleto', `Debes completar todas las subtareas antes de cerrar la tarea. (${subtareasCompletadas}/${subtareas.length} completadas)`, 'warning');
            return;
        }

        setIsChangingStatus(true);

        try {
            if (newStatus === 'Completada') {
                const result = await fireSwal({
                    title: 'Completar tarea',
                    text: '¿Desea agregar evidencias antes de completar la tarea?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, agregar evidencias',
                    cancelButtonText: 'No, solo completar',
                    showDenyButton: true,
                    denyButtonText: 'Cancelar'
                });

                // Si se presiona "Cancelar"
                if (result.isDenied) {
                    setIsChangingStatus(false);
                    return;
                }
                const fechaEntrega = new Date().toISOString().split('T')[0];

                // Si se presiona "No, solo completar"
                if (result.isDismissed) {
                    //agregar fecha de entrega
                    await axiosInstance.put(`/actualizarEstadoTarea/${task.id}`, {
                        estado: newStatus,
                        fecha_entregada: fechaEntrega
                    });
                    setCurrentStatus(newStatus);
                    onUpdate();
                    fireSwal('¡Éxito!', 'Estado actualizado correctamente', 'success');
                    return;
                }

                // Si se presiona "Sí, agregar evidencias"
                if (result.isConfirmed) {
                    const { value: uploadConfirmed } = await fireSwal({
                        title: 'Subir evidencias',
                        html: `
                            <div class="swal-evidence-upload">
                                <div class="upload-options">
                                    <div class="file-upload-section">
                                        <div id="preview-container" class="preview-container"></div>
                                        <input type="file" id="swal-evidence" multiple class="swal2-file">
                                    </div>
                                    <div class="drive-link-section">
                                        <button type="button" id="swal-drive-toggle" class="drive-link-button">
                                            <i class="fas fa-google-drive"></i> Agregar Link de Drive
                                        </button>
                                        <div id="swal-drive-input" class="drive-link-input" style="display: none;">
                                            <input type="text" id="swal-link-evidencia" placeholder="Ingrese el link de la evidencia" class="drive-link-field">
                                            <button type="button" id="swal-add-link" class="add-link-button">
                                                <i class="fas fa-link"></i> Agregar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `,
                        didOpen: () => {
                            const fileInput = document.getElementById('swal-evidence');
                            const previewContainer = document.getElementById('preview-container');
                            const driveToggle = document.getElementById('swal-drive-toggle');
                            const driveInput = document.getElementById('swal-drive-input');
                            const linkInput = document.getElementById('swal-link-evidencia');
                            const addLinkBtn = document.getElementById('swal-add-link');
                            let selectedFiles = [];
                            let driveLinks = [];

                            // Toggle para mostrar/ocultar input de Drive
                            driveToggle.addEventListener('click', () => {
                                const isVisible = driveInput.style.display !== 'none';
                                driveInput.style.display = isVisible ? 'none' : 'flex';
                                driveToggle.innerHTML = isVisible ? 
                                    '<i class="fas fa-google-drive"></i> Agregar Link de Drive' : 
                                    '<i class="fas fa-google-drive"></i> Ocultar Link de Drive';
                            });

                            // Agregar link de Drive
                            addLinkBtn.addEventListener('click', () => {
                                const link = linkInput.value.trim();
                                if (link && validateDriveLink(link)) {
                                    driveLinks.push(link);
                                    linkInput.value = '';
                                    updatePreview();
                                } else {
                                    Swal.showValidationMessage('Por favor ingrese un link válido de Google Drive');
                                }
                            });

                            fileInput.addEventListener('change', (e) => {
                                const files = Array.from(e.target.files);
                                selectedFiles = files;
                                updatePreview();
                            });

                            function updatePreview() {
                                let previewHTML = '';
                                
                                // Archivos
                                if (selectedFiles.length > 0) {
                                    previewHTML += '<h6>Archivos seleccionados:</h6>';
                                    selectedFiles.forEach((file, index) => {
                                        previewHTML += `
                                            <div class="preview-item">
                                                ${file.type.startsWith('image/')
                                                ? `<img src="${URL.createObjectURL(file)}" class="preview-image">`
                                                : `<div class="preview-file-icon">
                                                        <i class="fas fa-file"></i>
                                                    </div>`
                                            }
                                                <span class="preview-filename">${file.name}</span>
                                                <button type="button" class="preview-remove" data-type="file" data-index="${index}">
                                                    <i class="fas fa-times"></i>
                                                </button>
                                            </div>
                                        `;
                                    });
                                }

                                // Links de Drive
                                if (driveLinks.length > 0) {
                                    previewHTML += '<h6>Links de Drive:</h6>';
                                    driveLinks.forEach((link, index) => {
                                        previewHTML += `
                                            <div class="preview-item">
                                                <div class="preview-file-icon">
                                                    <i class="fas fa-google-drive"></i>
                                                </div>
                                                <span class="preview-filename">
                                                    <a href="${link}" target="_blank">${link}</a>
                                                </span>
                                                <button type="button" class="preview-remove" data-type="link" data-index="${index}">
                                                    <i class="fas fa-times"></i>
                                                </button>
                                            </div>
                                        `;
                                    });
                                }

                                previewContainer.innerHTML = previewHTML;

                                // Event listeners para botones de eliminar
                                document.querySelectorAll('.preview-remove').forEach(button => {
                                    button.addEventListener('click', (e) => {
                                        const type = e.currentTarget.dataset.type;
                                        const index = parseInt(e.currentTarget.dataset.index);
                                        
                                        if (type === 'file') {
                                            selectedFiles.splice(index, 1);
                                        } else if (type === 'link') {
                                            driveLinks.splice(index, 1);
                                        }
                                        
                                        e.currentTarget.closest('.preview-item').remove();
                                    });
                                });
                            }
                        },
                        confirmButtonText: 'Subir y completar',
                        cancelButtonText: 'Cancelar',
                        showCancelButton: true,
                        preConfirm: async () => {
                            const fileInput = document.getElementById('swal-evidence');
                            const linkInput = document.getElementById('swal-link-evidencia');
                            const files = Array.from(fileInput.files);
                            const driveLinks = [];

                            // Obtener links de Drive del preview
                            const previewItems = document.querySelectorAll('.preview-item');
                            previewItems.forEach(item => {
                                const linkElement = item.querySelector('a');
                                if (linkElement) {
                                    driveLinks.push(linkElement.href);
                                }
                            });

                            if (files.length === 0 && driveLinks.length === 0) {
                                Swal.showValidationMessage('Seleccione al menos un archivo o ingrese un link de Drive');
                                return false;
                            }

                            try {
                                setLoading(true);
                                let nuevasEvidencias = [];

                                // Subir archivos si existen
                                if (files.length > 0) {
                                    const formData = new FormData();
                                    files.forEach(file => {
                                        formData.append('evidencias[]', file);
                                    });

                                    const response = await axiosInstance.post('/subirEvidencias', formData, {
                                        headers: {
                                            'Content-Type': 'multipart/form-data'
                                        }
                                    });

                                    nuevasEvidencias = response.data.evidencias.map(evidencia => ({
                                        id: evidencia.id,
                                        nombre: evidencia.nombre_original,
                                        ruta: evidencia.ruta,
                                        tipo: evidencia.tipo
                                    }));
                                }

                                // Agregar links de Drive si existen
                                for (const link of driveLinks) {
                                    const response = await axiosInstance.post('/guardarEvidenciaLink', {
                                        tarea_id: task.id,
                                        evidencia: link,
                                        nombre: 'Link de Drive',
                                        tipo: 'application/link'
                                    });

                                    if (response.data.success) {
                                        nuevasEvidencias.push({
                                            id: response.data.evidencia_id,
                                            nombre: 'Link de Drive',
                                            ruta: link,
                                            tipo: 'application/link'
                                        });
                                    }
                                }

                                // Actualizar estado de la tarea
                                await axiosInstance.put(`/actualizarEstadoTarea/${task.id}`, {
                                    estado: newStatus,
                                    evidencias: nuevasEvidencias,
                                    fecha_entregada: fechaEntrega
                                });

                                setCurrentStatus(newStatus);
                                onUpdate();
                                fireSwal('¡Éxito!', 'Tarea completada con evidencias', 'success');
                                //actualizar la lista de evidencias
                                setEvidencias(prevEvidencias => [...prevEvidencias, ...nuevasEvidencias]);
                                return true;
                            } catch (error) {
                                Swal.showValidationMessage('Error al subir las evidencias');
                                return false;
                            } finally {
                                setLoading(false);
                            }
                        }
                    });

                    if (uploadConfirmed) {
                        fireSwal('¡Éxito!', 'Tarea completada con evidencias', 'success');
                    }
                }
            } else {
                // Cambio a otros estados
                await axiosInstance.put(`/actualizarEstadoTarea/${task.id}`, {
                    estado: newStatus
                });
                setCurrentStatus(newStatus);
                onUpdate();
                fireSwal('¡Éxito!', 'Estado actualizado correctamente', 'success');
            }
        } catch (error) {
            fireSwal('Error', 'Error al actualizar el estado', 'error');
        } finally {
            setIsChangingStatus(false);
        }
    };

    const handleDeleteTask = async () => {
        try {
            const result = await fireSwal({
                title: '¿Está seguro?',
                text: 'Esta acción no se puede deshacer',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                await axiosInstance.delete(`/eliminarTarea/${task.id}`);
                onUpdate();
                onClose();
                //actualizar la lista de tareas
                fireSwal('¡Eliminado!', 'La tarea ha sido eliminada', 'success');
            }
        } catch (error) {
            fireSwal('Error', 'Error al eliminar la tarea', 'error');
        }
    };

    const handleDeleteEvidence = async (evidenceId) => {
        try {
            const result = await fireSwal({
                title: '¿Está seguro?',
                text: 'Esta acción no se puede deshacer',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                await axiosInstance.delete(`/eliminarEvidencia/${evidenceId}`);
                // Actualizar el estado local eliminando la evidencia
                setEvidencias(prevEvidencias =>
                    prevEvidencias.filter(ev => ev.id !== evidenceId)
                );
                onUpdate();
                fireSwal('¡Eliminado!', 'La evidencia ha sido eliminada', 'success');
            }
        } catch (error) {
            fireSwal('Error', 'Error al eliminar la evidencia', 'error');
        }
    };

    const handleSaveObservations = async () => {

        if (observaciones.trim().length === 0) {
            fireSwal('Error', 'No se pueden guardar observaciones vacías', 'error');
            return;
        }

        try {
            setLoading(true);
            await axiosInstance.put(`/guardarObservacionesEmpleado/${task.id}`, {
                observacion_entrega: observaciones.trim()
            });

            onUpdate();
            fireSwal('¡Éxito!', 'Observación guardada correctamente', 'success');
        } catch (error) {
            fireSwal('Error', 'Error al guardar la observación', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVistoBueno = async (checked) => {
        setVistoBueno(checked);
        if (checked) {
            setRechazada(false); // Desactivar rechazada si se activa visto bueno
        }
        setIsUploading(true);
        try {
            await axiosInstance.put(`/vistoBueno/${task.id}`, {
                visto_bueno: checked
            });
            onUpdate();
            setIsUploading(false);
            fireSwal('¡Éxito!', 'Visto bueno actualizado correctamente', 'success');
        } catch (error) {
            fireSwal('Error', 'Error al actualizar el visto bueno', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRechazada = async (checked) => {
        setRechazada(checked);
        if (checked) {
            setVistoBueno(false); // Desactivar visto bueno si se activa rechazada
        }
        setIsUploading(true);
        try {
            await axiosInstance.put(`/rechazarTarea/${task.id}`, {
                rechazada: checked
            });
            onUpdate();
            fireSwal('¡Éxito!', 'Tarea rechazada correctamente', 'success');
        } catch (error) {
            fireSwal('Error', 'Error al rechazar la tarea', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleAprobada = async (checked) => {
        setAprobada(checked);
        setIsUploading(true);
        try {
            await axiosInstance.put(`/aprobarTarea/${task.id}`, {
                aprobada: checked
            });
            onUpdate();
            if (checked) {
                fireSwal('¡Éxito!', 'Tarea aprobada correctamente', 'success');
            } else {
                fireSwal('¡Éxito!', 'Tarea desaprobada correctamente', 'success');
            }
        } catch (error) {
            fireSwal('Error', 'Error al aprobar la tarea', 'error');
        } finally {
            setIsUploading(false);
        }
    };

   

    const handlePausada = async (checked) => {
        if (checked) {
            const result = await fireSwal({
                title: 'Pausar tarea',
                html: `
                    <div style="text-align: left;">
                        <label for="motivo-pausa" style="display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px;">
                            Motivo de la pausa:
                        </label>
                        <textarea id="motivo-pausa" class="swal2-textarea"
                            placeholder="Ingrese el motivo de la pausa..."
                            style="margin: 0; width: 100%; height: 100px; padding: 10px; border: 2px solid #e1e5e9; border-radius: 6px; font-size: 14px; resize: vertical; font-family: inherit;"></textarea>
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Pausar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#f97316',
                cancelButtonColor: '#6c757d',
                preConfirm: () => {
                    const motivo = document.getElementById('motivo-pausa').value.trim();
                    if (!motivo) {
                        Swal.showValidationMessage('El motivo es obligatorio');
                        return false;
                    }
                    return motivo;
                }
            });
            if (!result.isConfirmed) return;
            setPausada(true);
            try {
                await axiosInstance.put(`/pausarTarea/${task.id}`, { pausada: true, motivo: result.value });
                onUpdate();
                await fireSwal('¡Éxito!', 'Tarea pausada correctamente', 'success');
            } catch (error) {
                setPausada(false);
                await fireSwal('Error', 'Error al pausar la tarea', 'error');
            }
            return;
        }

        setPausada(false);

        try {
            await axiosInstance.put(`/pausarTarea/${task.id}`, {
                pausada: false
            });

            // Si se está quitando la pausa (checked = false), preguntar si quiere reprogramar
            if (!checked) {
                const { isConfirmed, isDismissed } = await fireSwal({
                    title: '¿Reprogramar tarea?',
                    text: '¿Deseas reprogramar la fecha de esta tarea?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, reprogramar',
                    cancelButtonText: 'No, continuar',
                    reverseButtons: true,
                    allowOutsideClick: false,
                    allowEscapeKey: true
                });

                if (isConfirmed) {
                    
                                        // Mostrar modal para seleccionar fecha y motivos
                    const result = await fireSwal({
                        title: 'Reprogramar Tarea',
                        html: `
                            <div style="margin-bottom: 20px;">
                                <div style="text-align: left; margin-bottom: 15px;">
                                    <label for="fecha_pactada" style="display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px;">
                                        <i class="fa fa-calendar" style="margin-right: 5px; color: #007bff;"></i>
                                        Nueva fecha pactada:
                                    </label>
                                    <input id="fecha_pactada" type="date" class="swal2-input" value="${task.fecha_pactada}" 
                                        style=" margin: 0;width: 100%; padding: 10px; border: 2px solid #e1e5e9; border-radius: 6px; font-size: 14px; transition: border-color 0.3s ease;">
                                </div>
                                <div style="text-align: left;">
                                    <label for="motivo_reprogramacion" style="display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px;">
                                        <i class="fa fa-comment" style="margin-right: 5px; color: #007bff;"></i>
                                        Motivo de reprogramación:
                                </label>
                                    <textarea id="motivo_reprogramacion" class="swal2-textarea" 
                                            placeholder="Ingrese el motivo de la reprogramación..." 
                                            style="margin: 0; width: 100%; height: 120px; padding: 12px; border: 2px solid #e1e5e9; border-radius: 6px; font-size: 14px; resize: vertical; font-family: inherit; line-height: 1.4;"></textarea>
                                </div>
                            </div>
                        `,
                        focusConfirm: false,
                        showCancelButton: true,
                        confirmButtonText: '<i class="fa fa-check"></i> Reprogramar',
                        cancelButtonText: '<i class="fa fa-times"></i> Cancelar',
                        confirmButtonColor: '#28a745',
                        cancelButtonColor: '#6c757d',
                        width: '500px',
                        customClass: {
                            popup: 'reprogramar-modal',
                            title: 'reprogramar-title',
                            content: 'reprogramar-content'
                        },
                        allowOutsideClick: true,
                        allowEscapeKey: true,
                        backdrop: true,
                        preConfirm: () => {
                            const fecha = document.getElementById('fecha_pactada').value;
                            const motivo = document.getElementById('motivo_reprogramacion').value;
                            
                            if (!fecha) {
                                Swal.showValidationMessage('La fecha es obligatoria');
                                return false;
                            }
                            
                            if (!motivo.trim()) {
                                Swal.showValidationMessage('El motivo es obligatorio');
                                return false;
                            }
                            
                            return { fecha_pactada: fecha, motivo_reprogramacion: motivo };
                        }
                        

                    });

                    if (result.isConfirmed && result.value) {
                        // Llamar al endpoint para reprogramar
                        await axiosInstance.put(`/reprogramarTarea/${task.id}`, result.value);
                        
                        // Actualizar la fecha en el estado local
                        setEditedTask(prev => ({
                            ...prev,
                            fecha_pactada: result.value.fecha_pactada
                        }));
                        
                        await fireSwal('¡Éxito!', 'Tarea reprogramada correctamente', 'success');
                    } else {
                        // Limpiar backdrop y modales residuales
                        limpiarBackdrops();
                    }
                    
                    if (result.dismiss) {
                        /* modal reprogramación cerrado */
                    }
                }
            }
            
            onUpdate();
        } catch (error) {
            await fireSwal('Error', 'Error al procesar la tarea', 'error');
        } finally {
            setIsUploading(false);
        }
    };



    const handleFileClick = (evidencia) => {

        setSelectedFile({
            ruta: evidencia.ruta,
            nombre: evidencia.nombre,
            tipo: evidencia.tipo
        });

    };

    const handleChat = async (observationId) => {
        //conmsultar en la base de datos de la tarea el id del empleado que realizo la observacion
        const observation = await axiosInstance.get(`/obtenerObservacionUser/${observationId}`);
        setChatReceptor(observation.data.idReceptor);
        setIsChatModalOpen(true);
    };

    const handleCloseFileViewer = () => {
        setSelectedFile(null);
    };

    const handleNotificationsClick = () => {
        setIsNotificationsModalOpen(true);
    };

    const handleEditTask = () => {
        setIsEditingTask(true);
        if (proyectos.length === 0) {
            axiosInstance.get('/cargarProyectos')
                .then(r => setProyectos(Array.isArray(r.data) ? r.data : []))
                .catch(() => {});
        }
    };

    const handleHabilitarEdicion = async (checked) => {
        setEditable(checked);
        setIsUploading(true);
        try {
            await axiosInstance.put(`/habilitarEdicion/${task.id}`, {
                editable: checked
            });
            onUpdate();
            Swal.fire('¡Éxito!', 'Tarea habilitada correctamente', 'success');
        } catch (error) {
            Swal.fire('Error', 'Error al habilitar la tarea', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const recargarFeedComentarios = async () => {
        try {
            const r = await axiosInstance.get(`/tarea/${task.id}/actividades-comentarios`);
            setActividadesComentarios(Array.isArray(r.data) ? r.data : []);
        } catch { /* ignore */ }
    };

    const handleGuardarComentario = async () => {
        if (!comentarioNuevo.trim() || comentarioNuevo.trim().length < 2) return;
        setGuardandoComentario(true);
        try {
            await axiosInstance.put(`/realizarObservaciones/${task.id}`, {
                observaciones: comentarioNuevo.trim(),
            });
            setComentarioNuevo('');
            await recargarFeedComentarios();
        } catch {
            fireSwal('Error', 'No se pudo guardar el comentario', 'error');
        } finally {
            setGuardandoComentario(false);
        }
    };

    const recargarHistorialReprg = async () => {
        try {
            const r = await axiosInstance.get(`/reprogramaciones/tarea/${task.id}`);
            const rows = Array.isArray(r.data) ? r.data : [];
            setHistorialReprg(rows);
            setReprgPendiente(rows.find(x => x.estado === 'Pendiente') || null);
        } catch { /* ignore */ }
    };

    const recargarHistorialPausas = async () => {
        try {
            const r = await axiosInstance.get(`/pausas/tarea/${task.id}`);
            const rows = Array.isArray(r.data) ? r.data : [];
            setHistorialPausas(rows);
            setPausaPendiente(rows.find(x => x.estado === 'Pendiente') || null);
        } catch { /* ignore */ }
    };

    const handleResolverSolicitudPausa = async (pausaId, accion) => {
        let observacion = '';
        if (accion === 'rechazar') {
            const { value, isDismissed } = await fireSwal({
                title: 'Motivo de rechazo (opcional)',
                input: 'textarea',
                inputPlaceholder: 'Describa brevemente el motivo del rechazo…',
                showCancelButton: true,
                confirmButtonText: 'Rechazar solicitud',
                cancelButtonText: 'Cancelar',
            });
            if (isDismissed) return;
            observacion = value || '';
        }
        setResolviendoPausa(true);
        try {
            await axiosInstance.put(`/pausas/${pausaId}/resolver`, {
                accion,
                aprobado_por: currentUser.id,
                observacion_rechazo: observacion,
            });
            await recargarHistorialPausas();
            if (accion === 'aprobar') {
                setPausada(true);
            }
            onUpdate();
            await fireSwal('¡Listo!', accion === 'aprobar' ? 'Pausa aprobada. La tarea ha sido pausada.' : 'Solicitud rechazada.', 'success');
        } catch (err) {
            const msg = err?.response?.data?.message || 'Error al resolver la solicitud';
            fireSwal('Error', msg, 'error');
        } finally {
            setResolviendoPausa(false);
        }
    };

    const handleSolicitarReprogramacion = async (e) => {
        e.preventDefault();
        if (!reprgFechaNueva) {
            fireSwal('Error', 'La nueva fecha es obligatoria', 'error');
            return;
        }
        if (!reprgMotivo.trim() || reprgMotivo.trim().length < 5) {
            fireSwal('Error', 'El motivo debe tener al menos 5 caracteres', 'error');
            return;
        }
        setReprgSubmitting(true);
        try {
            if (isLider && isIndependiente) {
                await axiosInstance.put(`/reprogramarTarea/${task.id}`, {
                    fecha_pactada: reprgFechaNueva,
                    motivo_reprogramacion: reprgMotivo.trim(),
                });
                setEditedTask(prev => ({ ...prev, fecha_pactada: reprgFechaNueva }));
                setShowReprgForm(false);
                setReprgFechaNueva('');
                setReprgMotivo('');
                onUpdate();
                await fireSwal('¡Listo!', 'Tarea reprogramada correctamente.', 'success');
            } else {
            await axiosInstance.post('/reprogramaciones/solicitar', {
                tarea_id: task.id,
                solicitado_por: currentUser.empleado,
                solicitado_por_user: currentUser.id,
                fecha_actual: task.fecha_pactada,
                fecha_nueva: reprgFechaNueva,
                motivo: reprgMotivo.trim(),
                tipo_aprobador: isLider ? 'admin' : 'lider',
            });
            await recargarHistorialReprg();
            setShowReprgForm(false);
            setReprgFechaNueva('');
            setReprgMotivo('');
            await fireSwal('¡Listo!', 'Solicitud enviada. Queda pendiente de aprobación.', 'success');
            }
        } catch (err) {
            const errs = err?.response?.data?.errors;
            let msg = err?.response?.data?.message || 'Error al enviar la solicitud';
            if (errs) {
                const first = Object.values(errs)[0];
                if (Array.isArray(first) && first[0]) msg = first[0];
            }
            fireSwal('Error', msg, 'error');
        } finally {
            setReprgSubmitting(false);
        }
    };

    const handleResolverReprogramacion = async (reprgId, accion) => {
        let observacion = '';
        if (accion === 'rechazar') {
            const { value, isDismissed } = await fireSwal({
                title: 'Motivo de rechazo (opcional)',
                input: 'textarea',
                inputPlaceholder: 'Describa brevemente el motivo del rechazo…',
                showCancelButton: true,
                confirmButtonText: 'Rechazar solicitud',
                cancelButtonText: 'Cancelar',
            });
            if (isDismissed) return;
            observacion = value || '';
        }
        setResolviendoReprg(true);
        try {
            await axiosInstance.put(`/reprogramaciones/${reprgId}/resolver`, {
                accion,
                aprobado_por: currentUser.id,
                observacion_rechazo: observacion,
            });
            await recargarHistorialReprg();
            onUpdate();
            fireSwal('¡Listo!',
                accion === 'aprobar'
                    ? 'Reprogramación aprobada. La fecha de la tarea ha sido actualizada.'
                    : 'Solicitud rechazada.',
                'success');
        } catch (err) {
            fireSwal('Error', err?.response?.data?.message || 'Error al procesar la solicitud', 'error');
        } finally {
            setResolviendoReprg(false);
        }
    };

    const handleSaveTask = async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.put(`/actualizarTarea/${task.id}`, editedTask);
            setIsEditingTask(false);

            task.titulo = editedTask.titulo;
            task.descripcion = editedTask.descripcion;
            task.prioridad = editedTask.prioridad;
            task.fecha_pactada = editedTask.fecha_pactada;
            task.proyecto_id = editedTask.proyecto_id || null;
            task.proyecto_nombre = res.data?.proyecto_nombre ?? null;

            onUpdate();

            setEditedTask({
                titulo: editedTask.titulo,
                descripcion: editedTask.descripcion,
                prioridad: editedTask.prioridad,
                fecha_pactada: editedTask.fecha_pactada,
                proyecto_id: editedTask.proyecto_id
            });
            Swal.fire('¡Éxito!', 'Tarea actualizada correctamente', 'success');
        } catch (error) {
            Swal.fire('Error', 'Error al actualizar la tarea', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEdit = () => {
        setIsEditingTask(false);
        setEditedTask({
            titulo: task.titulo,
            descripcion: task.descripcion,
            prioridad: task.prioridad,
            fecha_pactada: task.fecha_pactada,
            proyecto_id: task.proyecto_id ?? ''
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditedTask(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Nueva función para manejar el cambio de selección de radio buttons
    const handleRevisionChange = (value) => {
        setRevisionSelection(value);
        if (value === 'visto_bueno') {
            handleVistoBueno(true);
        } else if (value === 'rechazada') {
            handleRechazada(true);
        }
    };

    // ── Subtareas / checklist (misma UX que EmployeeModal) ───────────────────────
    const loadChecklistsExistentes = async (empleadoId) => {
        if (!empleadoId) return;
        try {
            const r = await axiosInstance.get(`/checklists-empleado/${empleadoId}`);
            setChecklistsExistentes(Array.isArray(r.data) ? r.data : []);
        } catch {
            setChecklistsExistentes([]);
        }
    };

    const persistSubtareaRow = async (id) => {
        if (!canEditChecklistStructure) return;
        const s = subtareasRef.current.find(x => x.id === id);
        if (!s) return;
        const titulo = (s.titulo || '').trim();
        if (!titulo) {
            fireSwal('Error', 'El ítem del checklist no puede estar vacío', 'error');
            try {
                const r = await axiosInstance.get(`/subtareas/${task.id}`);
                const rows = Array.isArray(r.data) ? r.data : [];
                setSubtareas(rows.map(x => ({
                    ...x,
                    completada: Number(x?.completada) === 1 ? 1 : 0,
                })));
            } catch {
                /* ignore */
            }
            return;
        }
        const checklistTit = checklistTituloRef.current?.trim() || null;
        try {
            await axiosInstance.put(`/subtareas/${id}`, {
                titulo,
                fecha_vencimiento: s.fecha_vencimiento || null,
                checklist_titulo: checklistTit,
            });
            setSubtareas(prev =>
                prev.map(x =>
                    x.id === id
                        ? { ...x, titulo, fecha_vencimiento: s.fecha_vencimiento || null, checklist_titulo: checklistTit }
                        : x
                )
            );
        } catch {
            fireSwal('Error', 'No se pudo guardar el ítem del checklist', 'error');
        }
    };

    const persistChecklistTituloToAllRows = async () => {
        if (!canEditChecklistStructure) return;
        const rows = subtareasRef.current;
        if (rows.length === 0) return;
        if (rows.some(s => !(s.titulo || '').trim())) {
            return;
        }
        const checklistTit = checklistTituloRef.current?.trim() || null;
        try {
            await Promise.all(
                rows.map(s =>
                    axiosInstance.put(`/subtareas/${s.id}`, {
                        titulo: (s.titulo || '').trim(),
                        fecha_vencimiento: s.fecha_vencimiento || null,
                        checklist_titulo: checklistTit,
                    })
                )
            );
            setSubtareas(prev => prev.map(s => ({ ...s, checklist_titulo: checklistTit })));
        } catch {
            fireSwal('Error', 'No se pudo guardar el título del checklist', 'error');
        }
    };

    const handleCopyChecklist = async (tareaId) => {
        setSelectedChecklistId(tareaId);
        if (!tareaId || !canEditChecklistStructure) return;
        const found = checklistsExistentes.find(c => String(c.tarea_id) === String(tareaId));
        if (!found) return;
        const res = await fireSwal({
            title: '¿Reemplazar checklist?',
            text: 'Se eliminarán los ítems actuales y se copiarán los del checklist seleccionado.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, reemplazar',
            cancelButtonText: 'Cancelar',
        });
        if (!res.isConfirmed) {
            setSelectedChecklistId('');
            return;
        }
        try {
            const ids = subtareasRef.current.map(s => s.id);
            if (ids.length > 0) {
                await Promise.all(ids.map(id => axiosInstance.delete(`/subtareas/${id}`)));
            }
            const tituloChecklist = found.checklist_titulo || checklistTituloRef.current?.trim() || null;
            await Promise.all(
                (found.items || []).map(item =>
                    axiosInstance.post('/subtareas', {
                        tarea_id: task.id,
                        titulo: item.titulo,
                        fecha_vencimiento: item.fecha_vencimiento || null,
                        checklist_titulo: tituloChecklist,
                    })
                )
            );
            setChecklistTitulo(found.checklist_titulo || '');
            const r = await axiosInstance.get(`/subtareas/${task.id}`);
            const rows = Array.isArray(r.data) ? r.data : [];
            setSubtareas(
                rows.map(s => ({
                    ...s,
                    completada: Number(s?.completada) === 1 ? 1 : 0,
                }))
            );
            setSelectedChecklistId('');
            fireSwal('Listo', 'Checklist copiado correctamente', 'success');
        } catch {
            fireSwal('Error', 'No se pudo copiar el checklist', 'error');
            try {
                const r = await axiosInstance.get(`/subtareas/${task.id}`);
                const rows = Array.isArray(r.data) ? r.data : [];
                setSubtareas(
                    rows.map(s => ({
                        ...s,
                        completada: Number(s?.completada) === 1 ? 1 : 0,
                    }))
                );
                setChecklistTitulo(rows[0]?.checklist_titulo || '');
            } catch {
                /* ignore */
            }
        }
    };

    const handleAddSubtarea = async () => {
        if (!canEditChecklistStructure) return;
        const titulo = nuevaSubtarea.trim();
        if (!titulo) return;
        const checklistTit = checklistTituloRef.current?.trim() || null;
        try {
            const r = await axiosInstance.post('/subtareas', {
                tarea_id: task.id,
                titulo,
                fecha_vencimiento: nuevaSubtareaFecha || null,
                checklist_titulo: checklistTit,
            });
            setSubtareas(prev => [...prev, r.data.subtarea]);
            setNuevaSubtarea('');
            setNuevaSubtareaFecha('');
        } catch {
            fireSwal('Error', 'No se pudo agregar el ítem de checklist', 'error');
        }
    };

    const handleToggleSubtarea = async (subtarea) => {
        if (!canEditChecklist) return;
        const estabaCompletada = Number(subtarea?.completada) === 1;
        const prevEstado = estabaCompletada ? 1 : 0;
        const nuevoEstado = estabaCompletada ? 0 : 1;
        setSubtareas(prev => prev.map(s => s.id === subtarea.id ? { ...s, completada: nuevoEstado } : s));
        try {
            await axiosInstance.put(`/subtareas/${subtarea.id}`, { completada: nuevoEstado });
            onUpdate();
        } catch {
            setSubtareas(prev => prev.map(s => s.id === subtarea.id ? { ...s, completada: prevEstado } : s));
        }
    };

    const handleDeleteSubtarea = async (id) => {
        if (!canEditChecklistStructure) return;
        const snapshot = subtareasRef.current;
        setSubtareas(prev => prev.filter(s => s.id !== id));
        try {
            await axiosInstance.delete(`/subtareas/${id}`);
        } catch {
            fireSwal('Error', 'No se pudo eliminar la subtarea', 'error');
            setSubtareas(snapshot);
        }
    };

    const isVencida = (fecha) => fecha && new Date(fecha + 'T00:00:00') < new Date(new Date().toDateString());

    const isSubtareaCompletada = (s) => Number(s?.completada) === 1;

    // Puede resolver la reprogramación pendiente según tipo_aprobador
    const canResolverReprg = reprgPendiente && (
        (reprgPendiente.tipo_aprobador === 'lider' && isLider && !isOwnTask) ||
        (reprgPendiente.tipo_aprobador === 'admin' && isAdmin)
    );

    // Puede resolver la solicitud de pausa pendiente
    const canResolverPausa = pausaPendiente && (
        (pausaPendiente.tipo_aprobador === 'lider' && isLider && !isOwnTask) ||
        (pausaPendiente.tipo_aprobador === 'admin' && isAdmin)
    );

    const fmtFecha = (f) => {
        if (!f) return '—';
        const d = new Date(f + 'T12:00:00');
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    };
    const subtareasCompletadas = subtareas.filter(isSubtareaCompletada).length;
    const progresoSubtareas = subtareas.length > 0 ? Math.round((subtareasCompletadas / subtareas.length) * 100) : 0;

    return (
        <>
            {/* Modal principal de detalles */}
            {isUploading && (
                <div className="loader">
                    <div className="justify-content-center jimu-primary-loading"></div>
                </div>
            )}
            {task && (
                <div
                    className={`modal-overlay${overlayZIndex ? ' task-details-overlay' : ''}`}
                    style={overlayZIndex ? { zIndex: overlayZIndex } : undefined}
                    ref={modalOverlayRef}
                    onClick={(e) => e.target === e.currentTarget && onClose()}
                >
                    <div className={`task-details-modal ${isArchived ? 'archived' : ''}`}>
                        {isArchived && (
                            <div className="archived-badge">
                                📁 Tarea Archivada
                            </div>
                        )}
                        <div className="modal-header">
                            <h2 className='modal-title'>
                                Detalles de la Tarea
                                {/* Mostrar Aprobación */}
                                {aprobada ? (
                                    <FaCircleCheck color='green' title='Aprobada' style={{ marginRight: '0.5rem' }} />
                                ) : (
                                    <FaCircleCheck color='grey' title='No aprobada' style={{ marginRight: '0.5rem', opacity: 0.5 }} />
                                )}

                                {/* Mostrar Visto Bueno */}
                                {(currentStatus === 'Completada' && vistoBueno && !rechazada) ? (
                                    <FaEye color='green' title='Visto bueno' style={{ marginRight: '0.5rem' }} />
                                ) : (
                                    <FaEye color='grey' title='Pendiente de visto bueno' style={{ marginRight: '0.5rem', opacity: 0.5 }} />
                                )}

                                {/* Mostrar Rechazada */}
                                {(currentStatus === 'Completada' || currentStatus === 'En Proceso') && rechazada ? (
                                    <FaCircleXmark color='red' title='Rechazada' style={{ marginRight: '0.5rem' }} />
                                ) : null}

                                {/* Mostrar / solicitar pausa (solo asignado: envía solicitud a líder o admin) */}
                                {pausada && isOwnTask && !isAdmin && !isArchived ? (
                                    <FaPause
                                        color="orange"
                                        title="Tarea pausada — clic para reanudar"
                                        onClick={openReanudarForm}
                                        style={{ marginRight: '0.5rem', cursor: 'pointer' }}
                                    />
                                ) : pausada ? (
                                    <FaPause color="orange" title="Pausada" style={{ marginRight: '0.5rem' }} />
                                ) : isOwnTask && isLider && isIndependiente && !isArchived ? (
                                    <FaPause
                                        color="#64748b"
                                        title="Pausar tarea directamente"
                                        onClick={async () => {
                                            const result = await fireSwal({
                                                title: 'Pausar tarea',
                                                html: `<div style="text-align:left"><label style="display:block;margin-bottom:8px;font-weight:600;font-size:14px">Motivo de la pausa:</label><textarea id="motivo-pausa-lider" class="swal2-textarea" placeholder="Ingrese el motivo..." style="margin:0;width:100%;height:100px;padding:10px;border:2px solid #e1e5e9;border-radius:6px;font-size:14px;resize:vertical;font-family:inherit;"></textarea></div>`,
                                                focusConfirm: false,
                                                showCancelButton: true,
                                                confirmButtonText: 'Pausar',
                                                cancelButtonText: 'Cancelar',
                                                confirmButtonColor: '#f97316',
                                                preConfirm: () => {
                                                    const m = document.getElementById('motivo-pausa-lider').value.trim();
                                                    if (!m) { Swal.showValidationMessage('El motivo es obligatorio'); return false; }
                                                    return m;
                                                }
                                            });
                                            if (!result.isConfirmed) return;
                                            try {
                                                await axiosInstance.put(`/pausarTarea/${task.id}`, { pausada: true, motivo: result.value });
                                                setPausada(true);
                                                onUpdate();
                                                await fireSwal('¡Éxito!', 'Tarea pausada correctamente.', 'success');
                                            } catch { await fireSwal('Error', 'No se pudo pausar la tarea.', 'error'); }
                                        }}
                                        style={{ marginRight: '0.5rem', cursor: 'pointer' }}
                                    />
                                ) : isOwnTask && !isAdmin && !isArchived ? (
                                    pausaPendiente ? (
                                        <FaPause color="#f97316" title="Solicitud de pausa pendiente de aprobación" style={{ marginRight: '0.5rem', opacity: 0.7 }} />
                                    ) : (
                                    <FaPause
                                        color="#64748b"
                                        title="Solicitar pausa"
                                        onClick={openSolicitudPausaModal}
                                        style={{ marginRight: '0.5rem', cursor: 'pointer' }}
                                    />
                                    )

                                ) : (
                                    <FaPause
                                        color="grey"
                                        title="No pausada"
                                        style={{ marginRight: '0.5rem', opacity: 0.45 }}
                                    />
                                )}
                            </h2>

                            <button className="close-button" onClick={onClose}>&times;</button>

                        </div>

                        <div className="modal-body">
                            {/* Panel izquierdo: Información de la tarea */}
                            <div className="task-info-panel">
                                <div className="edit-buttons">
                                    {/* Botón para desarchivar tarea */}
                                    {isArchived && onUnarchive && (
                                        <button className="unarchive-button" onClick={onUnarchive}>
                                            <FaArchive /> Desarchivar Tarea
                                        </button>
                                    )}
                                    
                                    {/* Botón para archivar tarea */}
                                    {!isArchived && task.estado === 'Completada' && vistoBueno && !rechazada && (
                                        <button className="archive-button" onClick={handleArchiveTask}>
                                            <FaArchive /> Archivar Tarea
                                        </button>
                                    )}
        
                                    {!isAdmin ? (
                                        !isEditingTask ? (
                                            <>
                                                {/* mostrar editar y eliminar si eres lider y no eres el dueño de la tarea*/}
                                                {isLider && !isOwnTask && (
                                                    <>
                                                        <button className="edit-button" onClick={handleEditTask}>
                                                            <FaEdit /> Editar Tarea
                                                        </button>

                                                        <button className="delete-button" onClick={handleDeleteTask}>
                                                            <FaTrash /> Eliminar Tarea
                                                        </button>
                                                    </>
                                                
                                                )}
                                                        
                                                {(isOwnTask && ((task.aprobada === 0 || task.aprobada === null || task.editable === 1) || canSupervisarPropia)) && (
                                                    <>
                                                        <button className="edit-button" onClick={handleEditTask}>
                                                            <FaEdit /> Editar Tarea
                                                        </button>
                                                        
                                                        <button className="delete-button" onClick={handleDeleteTask}>
                                                            <FaTrash /> Eliminar Tarea
                                                        </button>
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <button className="save-button" onClick={handleSaveTask} disabled={loading}>
                                                    {loading ? <FaSpinner className="spinner" /> : <FaSave />} Guardar
                                                </button>
                                                <button className="cancel-button" onClick={handleCancelEdit}>
                                                    Cancelar
                                                </button>
                                            </>
                                        )
                                    ) : (
                                        !isEditingTask ? (

                                            <>
                                                {(task.aprobada === 1) && (
                                                    <>
                                                        <div className="habilitar-checkbox">
                                                            <label>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={editable}
                                                                    onChange={(e) => {
                                                                        handleHabilitarEdicion(e.target.checked);
                                                                    }} />
                                                                Habilitar edición empleado
                                                            </label>
                                                        </div>
                                                    </>
                                                )}

                                                <button className="edit-button" onClick={handleEditTask}>
                                                    <FaEdit /> Editar Tarea
                                                </button>

                                                <button className="delete-button" onClick={handleDeleteTask}>
                                                    <FaTrash /> Eliminar Tarea
                                                </button>
                                            </>


                                        ) : (
                                            <>
                                                <button className="save-button" onClick={handleSaveTask} disabled={loading}>
                                                    {loading ? <FaSpinner className="spinner" /> : <FaSave />} Guardar
                                                </button>
                                                <button className="cancel-button" onClick={handleCancelEdit}>
                                                    Cancelar
                                                </button>
                                            </>
                                        )
                                    )}

                                </div>
                                <div className="task-header">
                                    {isEditingTask ? (
                                        <div className="edit-form">
                                            <div className="form-group">
                                                <label htmlFor="titulo">Título:</label>
                                                <input
                                                    type="text"
                                                    id="titulo"
                                                    name="titulo"
                                                    value={editedTask.titulo}
                                                    onChange={handleInputChange}
                                                    className="form-control"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label htmlFor="descripcion">Descripción:</label>
                                                <textarea
                                                    id="descripcion"
                                                    name="descripcion"
                                                    value={editedTask.descripcion}
                                                    onChange={handleInputChange}
                                                    className="form-control"
                                                    rows="4"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label htmlFor="prioridad">Prioridad:</label>
                                                <select
                                                    id="prioridad"
                                                    name="prioridad"
                                                    value={editedTask.prioridad}
                                                    onChange={handleInputChange}
                                                    className="form-control"
                                                >
                                                    <option value="Alta">Alta</option>
                                                    <option value="Media">Media</option>
                                                    <option value="Baja">Baja</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label htmlFor="fecha_pactada">Fecha límite:</label>
                                                <input
                                                    type="date"
                                                    id="fecha_pactada"
                                                    name="fecha_pactada"
                                                    value={editedTask.fecha_pactada}
                                                    onChange={handleInputChange}
                                                    className="form-control"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label htmlFor="proyecto_id">Proyecto:</label>
                                                <select
                                                    id="proyecto_id"
                                                    name="proyecto_id"
                                                    value={editedTask.proyecto_id || ''}
                                                    onChange={handleInputChange}
                                                    className="form-control"
                                                >
                                                    <option value="">— Sin proyecto —</option>
                                                    {proyectos.map(p => (
                                                        <option key={p.id} value={p.id}>{p.nombre}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <h3>{task.titulo}</h3>
                                            <div className="priority-container">
                                                <span className={`prioridad-badge ${task.prioridad.toLowerCase()}`}>
                                                    Prioridad: <strong>{task.prioridad}</strong>
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {!isEditingTask && (
                                    <div className="task-description">
                                        <p>{task.descripcion}</p>
                                    </div>
                                )}

                                <div className="task-dates">
                                    {/* Fecha creación */}
                                    <div className="date-item">
                                        <FaCalendar />
                                        <span>  Fecha creación: {new Date(task.fecha_creacion + 'T00:00:00').toLocaleDateString()}</span>
                                    </div>

                                    {/* Fecha límite */}
                                    <div className="date-item">
                                        <FaClock />
                                        <span>  Fecha límite: {new Date(task.fecha_pactada + 'T00:00:00').toLocaleDateString()}</span>
                                    </div>

                                    {/* Fecha aprobación */}
                                    {task.fecha_aprobacion && (
                                    <div className="date-item">
                                        <FaCheck />
                                        <span>  Fecha aprobación: {new Date(task.fecha_aprobacion + 'T00:00:00').toLocaleDateString()}</span>
                                    </div>
                                    )}

                                    {/* Fecha entrega */}
                                    {task.fecha_entregada && (
                                        <div className="date-item">
                                            <FaCheck />
                                            <span>Entregado: {new Date(task.fecha_entregada + 'T00:00:00').toLocaleDateString()}</span>
                                        </div>
                                    )}
                                </div>

                                {pausada && (task.fecha_reprogramacion || task.motivo_reprogramacion) && (
                                    <div className="task-pausa-info-panel" aria-label="Información de pausa">
                                        <h4 className="task-pausa-info-heading">
                                            <FaPause /> Pausa
                                        </h4>
                                        {task.fecha_reprogramacion && (
                                            <div className="task-pausa-info-row">
                                                <span className="task-pausa-info-label">Reanudación prevista</span>
                                                <span className="task-pausa-info-value">
                                                    {new Date(
                                                        String(task.fecha_reprogramacion).includes('T')
                                                            ? task.fecha_reprogramacion
                                                            : String(task.fecha_reprogramacion).slice(0, 10) + 'T12:00:00'
                                                    ).toLocaleDateString()}
                                                </span>
                                            </div>
                                        )}
                                        {task.motivo_reprogramacion && (
                                            <div className="task-pausa-info-row task-pausa-info-motivo">
                                                <span className="task-pausa-info-label">Motivo</span>
                                                <p className="task-pausa-info-motivo-text">{task.motivo_reprogramacion}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {task.proyecto_nombre && (
                                    <div className="task-proyecto-panel" aria-label="Proyecto asociado">
                                        <div className="task-proyecto-icon" aria-hidden="true">
                                            <FaFolder />
                                        </div>
                                        <div className="task-proyecto-content">
                                            <span className="task-proyecto-label">Proyecto</span>
                                            <p className="task-proyecto-nombre">{task.proyecto_nombre}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Pausa: badge pendiente para el dueño */}
                                {isOwnTask && !isArchived && !pausada && pausaPendiente && (
                                    <div className="repr-owner-section">
                                        <div className="repr-pending-badge" style={{ background: '#fff7ed', borderColor: '#f97316', color: '#c2410c' }}>
                                            <FaPause style={{ marginRight: '0.4rem' }} />
                                            Solicitud de pausa pendiente de aprobación
                                            <span className="repr-pending-date"> — reanudación: {fmtFecha(pausaPendiente.fecha_reanudacion)}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Reprogramación: solicitud y estado para el dueño */}
                                {isOwnTask && !isArchived && (
                                    <div className="repr-owner-section">
                                        {reprgPendiente ? (
                                            <div className="repr-pending-badge">
                                                <FaClock style={{ marginRight: '0.4rem' }} />
                                                Solicitud de reprogramación pendiente de aprobación
                                                <span className="repr-pending-date"> — {fmtFecha(reprgPendiente.fecha_nueva)}</span>
                                            </div>
                                        ) : (
                                            <button
                                                className="repr-solicitar-btn"
                                                onClick={() => setShowReprgForm(true)}
                                            >
                                                <FaCalendar style={{ marginRight: '0.4rem' }} />
                                                {isLider && isIndependiente ? 'Reprogramar tarea' : 'Solicitar reprogramación'}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Solo mostrar controles de estado si es el dueño de la tarea */}
                                {isOwnTask && (
                                    <div className={"status-control"} style={{ marginTop: '1rem' }}>
                                        <h4>Cambiar estado de la tarea</h4>
                                        <div className={`status-buttons ${task.aprobada ? '' : 'disabled-status'}`}>
                                            <button
                                                className={`status-button pending ${currentStatus === 'Pendiente' ? 'active' : ''}`}
                                                onClick={() => handleStatusChange('Pendiente')}
                                                disabled={isChangingStatus || currentStatus === 'Pendiente'}
                                            >
                                                <FaClock /> Pendiente
                                            </button>
                                            <button
                                                className={`status-button in-progress ${currentStatus === 'En Proceso' ? 'active' : ''}`}
                                                onClick={() => handleStatusChange('En Proceso')}
                                                disabled={isChangingStatus || currentStatus === 'En Proceso'}
                                            >
                                                <FaSpinner /> En Proceso
                                            </button>
                                            <button
                                                className={`status-button completed ${currentStatus === 'Completada' ? 'active' : ''}`}
                                                onClick={() => handleStatusChange('Completada')}
                                                disabled={isChangingStatus || currentStatus === 'Completada'}
                                            >
                                                <FaCheck /> Completada
                                            </button>
                                        </div>
                                    </div>
                                )}



                                {/* ── Checklist (misma UX que EmployeeModal) ─ */}
                                <div className="subtareas-section">
                                    <h4 className="subtareas-title">
                                        ☑ Checklist
                                        <span className="subtareas-counter">
                                            {subtareasCompletadas}/{subtareas.length}
                                        </span>
                                    </h4>

                                    <div className="subtareas-progress">
                                        <span className="subtareas-progress-pct">{progresoSubtareas}%</span>
                                        <div className="subtareas-progress-bar">
                                            <div
                                                className="subtareas-progress-fill"
                                                style={{ width: `${progresoSubtareas}%` }}
                                            />
                                        </div>
                                    </div>

                                    {!canEditChecklist && (
                                        <p style={{ margin: '0.35rem 0 0.75rem', color: '#6b7280', fontSize: '0.85rem' }}>
                                            Solo el empleado asignado a la tarea puede marcar el checklist. Si no eres el asignado, verás el avance y el estado de cada ítem (solo lectura).
                                        </p>
                                    )}

                                    {canEditChecklist && !canEditChecklistStructure && (
                                        <p style={{ margin: '0.35rem 0 0.75rem', color: '#6b7280', fontSize: '0.85rem' }}>
                                            La tarea está aprobada: solo puedes marcar ítems como completados. Si esta tarea es tuya (estás asignado), editar, eliminar o reemplazar el checklist solo lo puede hacer un administrador, aunque tengas rol de líder.
                                        </p>
                                    )}

                                            {canEditChecklistStructure && (
                                                <div className="checklist-form-section">
                                                    <div className="checklist-header-row">
                                                        <input
                                                            type="text"
                                                            className="checklist-titulo-input"
                                                            placeholder="Título del checklist (opcional)..."
                                                            value={checklistTitulo}
                                                            onChange={e => setChecklistTitulo(e.target.value)}
                                                            onBlur={() => persistChecklistTituloToAllRows()}
                                                        />
                                                        {checklistsExistentes.filter(c => String(c.tarea_id) !== String(task.id)).length > 0 && (
                                                            <select
                                                                className="checklist-copy-select"
                                                                value={selectedChecklistId}
                                                                onFocus={() => {
                                                                    if (
                                                                        checklistsExistentes.length === 0 &&
                                                                        task?.empleado
                                                                    ) {
                                                                        loadChecklistsExistentes(task.empleado);
                                                                    }
                                                                }}
                                                                onChange={e => handleCopyChecklist(e.target.value)}
                                                            >
                                                                <option value="">Copiar de existente...</option>
                                                                {checklistsExistentes
                                                                    .filter(c => String(c.tarea_id) !== String(task.id))
                                                                    .map(c => (
                                                                    <option key={c.tarea_id} value={c.tarea_id}>
                                                                        {c.tarea_titulo}
                                                                        {c.checklist_titulo ? ` — ${c.checklist_titulo}` : ''}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {!canEditChecklistStructure && subtareas.length > 0 && subtareas[0]?.checklist_titulo && (
                                                <p className="checklist-titulo-display">{subtareas[0].checklist_titulo}</p>
                                            )}

                                            {subtareas.length === 0 && (
                                                <p style={{ margin: '0.35rem 0 0.75rem', color: '#6b7280', fontSize: '0.9rem' }}>
                                                    Esta tarea aún no tiene ítems de checklist.
                                                </p>
                                            )}

                                            <ul className="subtareas-list">
                                                {subtareas.map(sub => (
                                                    <li
                                                        key={sub.id}
                                                        className={`subtarea-item ${isSubtareaCompletada(sub) ? 'completada' : ''} ${!isSubtareaCompletada(sub) && isVencida(sub.fecha_vencimiento) ? 'vencida' : ''}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="subtarea-checkbox"
                                                            checked={isSubtareaCompletada(sub)}
                                                            disabled={!canEditChecklist}
                                                            title={
                                                                canEditChecklist
                                                                    ? 'Marcar como completado'
                                                                    : 'Solo el empleado asignado a la tarea puede marcar ítems'
                                                            }
                                                            onChange={() => handleToggleSubtarea(sub)}
                                                        />
                                                        {canEditChecklistStructure ? (
                                                            <>
                                                                <input
                                                                    type="text"
                                                                    className="subtarea-edit-input"
                                                                    value={sub.titulo}
                                                                    placeholder="Descripción del ítem..."
                                                                    onChange={e =>
                                                                        setSubtareas(prev =>
                                                                            prev.map(x =>
                                                                                x.id === sub.id ? { ...x, titulo: e.target.value } : x
                                                                            )
                                                                        )
                                                                    }
                                                                    onBlur={() => persistSubtareaRow(sub.id)}
                                                                />
                                                                <input
                                                                    type="date"
                                                                    className="subtarea-edit-date"
                                                                    value={sub.fecha_vencimiento || ''}
                                                                    onChange={e =>
                                                                        setSubtareas(prev =>
                                                                            prev.map(x =>
                                                                                x.id === sub.id
                                                                                    ? { ...x, fecha_vencimiento: e.target.value }
                                                                                    : x
                                                                            )
                                                                        )
                                                                    }
                                                                    onBlur={() => persistSubtareaRow(sub.id)}
                                                                    title="Fecha de vencimiento"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    className="subtarea-delete"
                                                                    style={{ opacity: 1 }}
                                                                    title="Quitar ítem"
                                                                    onClick={() => handleDeleteSubtarea(sub.id)}
                                                                >
                                                                    <FaTimes />
                                                                </button>
                                                            </>
                                                        ) : canEditChecklist ? (
                                                            <div className="subtarea-info">
                                                                {isSubtareaCompletada(sub) && (
                                                                    <FaCheck
                                                                        title="Completado"
                                                                        style={{ color: '#16a34a', marginRight: '0.35rem', flexShrink: 0 }}
                                                                    />
                                                                )}
                                                                <span className="subtarea-texto">{sub.titulo}</span>
                                                                {sub.fecha_vencimiento && (
                                                                    <span
                                                                        className={`subtarea-fecha ${isVencida(sub.fecha_vencimiento) && !isSubtareaCompletada(sub) ? 'vencida' : ''}`}
                                                                    >
                                                                        <FaClock style={{ fontSize: '0.65rem' }} />
                                                                        {new Date(sub.fecha_vencimiento + 'T00:00:00').toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="subtarea-info">
                                                                {isSubtareaCompletada(sub) && (
                                                                    <FaCheck
                                                                        title="Completado"
                                                                        style={{ color: '#16a34a', marginRight: '0.35rem', flexShrink: 0 }}
                                                                    />
                                                                )}
                                                                <span className="subtarea-texto">{sub.titulo}</span>
                                                                {sub.fecha_vencimiento && (
                                                                    <span
                                                                        className={`subtarea-fecha ${isVencida(sub.fecha_vencimiento) && !isSubtareaCompletada(sub) ? 'vencida' : ''}`}
                                                                    >
                                                                        <FaClock style={{ fontSize: '0.65rem' }} />
                                                                        {new Date(sub.fecha_vencimiento + 'T00:00:00').toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>

                                            {canEditChecklistStructure && (
                                                <div className="subtarea-add-row">
                                                    <input
                                                        type="text"
                                                        className="subtarea-add-input"
                                                        placeholder="Ítem del checklist..."
                                                        value={nuevaSubtarea}
                                                        onChange={e => setNuevaSubtarea(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddSubtarea();
                                                            }
                                                        }}
                                                    />
                                                    <input
                                                        type="date"
                                                        className="subtarea-add-date"
                                                        value={nuevaSubtareaFecha}
                                                        onChange={e => setNuevaSubtareaFecha(e.target.value)}
                                                        title="Fecha de vencimiento (opcional)"
                                                    />
                                                    <button
                                                        type="button"
                                                        className="subtarea-add-btn"
                                                        onClick={handleAddSubtarea}
                                                        disabled={!nuevaSubtarea.trim()}
                                                    >
                                                        <FaPlus />
                                                    </button>
                                                </div>
                                            )}
                                </div>
                            </div>

                            {/* Panel derecho: Evidencias */}
                            <div className="evidence-panel ">
                                <h4>Evidencias de la tarea</h4>

                                {/* Nota de entrega del empleado */}
                                <div className="observations-section">
                                    <h5>Nota de entrega</h5>

                                    {isOwnTask && (
                                        <>
                                            <textarea
                                                value={observaciones}
                                                onChange={(e) => setObservaciones(e.target.value)}
                                                placeholder="Escriba una nota sobre la entrega de esta tarea (visible para su líder)..."
                                                rows="3"
                                                className="observations-textarea"
                                            />
                                            {observaciones.trim() && (
                                                <button
                                                    className="save-observations-button"
                                                    onClick={handleSaveObservations}
                                                    disabled={loading}
                                                    style={{ marginTop: '8px' }}
                                                >
                                                    {loading ? <><FaSpinner className="spinner" /> Guardando...</> : <><FaSave /> Guardar nota</>}
                                                </button>
                                            )}
                                        </>
                                    )}

                                    {((isLider && !isOwnTask) || isAdmin || canSupervisarPropia) && (
                                        <div className="employee-observations">
                                            <h6>Nota de entrega del empleado</h6>
                                            {task.observacion_entrega ? (
                                                <div className="observation-card employee-observation">
                                                    <p className="observation-text">❝{task.observacion_entrega}❞</p>
                                                </div>
                                            ) : (
                                                <p className="no-observations">Sin nota de entrega</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Sección de carga de archivos - Solo para el dueño de la tarea */}
                                {isOwnTask && (
                                    <div key={task.id} className="evidence-upload">
                                        <div className="upload-options">
                                            <div className="file-upload-section">
                                                <input
                                                    type="file"
                                                    multiple
                                                    onChange={handleFileChange}
                                                    className="file-input"
                                                    id="evidence-files"
                                                    ref={fileInputRef}
                                                />
                                                <label htmlFor="evidence-files" className="upload-button">
                                                    <FaFileUpload /> Seleccionar archivos
                                                </label>
                                            </div>
                                            
                                            <div className="drive-link-section">
                                                <button
                                                    type="button"
                                                    className="drive-link-button"
                                                    onClick={() => setShowDriveInput(!showDriveInput)}
                                                >
                                                    <FaGoogleDrive /> {showDriveInput ? 'Ocultar' : 'Agregar'} Link de Drive
                                                </button>
                                                
                                                {showDriveInput && (
                                                    <div className="drive-link-input">
                                                        <input
                                                            type="text"
                                                            value={driveLink}
                                                            onChange={(e) => setDriveLink(e.target.value) }
                                                            placeholder="Pegue aquí el link de Google Drive..."
                                                            className="drive-link-field"
                                                        />
                                                        <button
                                                            type="button"
                                                            className="add-link-button"
                                                            onClick={handleAddDriveLink}
                                                            disabled={loading || !driveLink.trim()}
                                                        >
                                                            {loading ? <FaSpinner className="spinner" /> : <FaLink />}
                                                            Agregar
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Preview de archivos seleccionados */}
                                {(previewFiles.length > 0 || tempDriveLinks.length > 0) && (
                                    <div className="preview-files">
                                        <h5>Evidencias a subir</h5>
                                        
                                        {/* Preview de archivos */}
                                        {previewFiles.length > 0 && (
                                            <div className="preview-list">
                                                <h6>Archivos seleccionados:</h6>
                                                {previewFiles.map((fileData, index) => (
                                                    <div key={index} className="preview-item">
                                                        <div className="preview-content">
                                                            {fileData.preview ? (
                                                                <img
                                                                    src={fileData.preview}
                                                                    alt={fileData.name}
                                                                    className="preview-image"
                                                                />
                                                            ) : (
                                                                <div className="file-icon">
                                                                    {fileData.type.includes('image') ? (
                                                                        <FaImage />
                                                                    ) : (
                                                                        <FaFile />
                                                                    )}
                                                                </div>
                                                            )}
                                                            <span className="preview-name">{fileData.name}</span>
                                                        </div>
                                                        <button
                                                            className="remove-file"
                                                            onClick={() => removeFile(index)}
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {/* Preview de links de Drive temporales */}
                                        {tempDriveLinks.length > 0 && (
                                            <div className="preview-list">
                                                <h6>Links de Drive:</h6>
                                                {tempDriveLinks.map((linkData, index) => (
                                                    <div key={linkData.id} className="preview-item">
                                                        <div className="preview-content">
                                                            <div className="file-icon">
                                                                <FaGoogleDrive />
                                                            </div>
                                                            <span className="preview-name">
                                                                <a href={linkData.ruta} target="_blank" rel="noopener noreferrer">
                                                                    {linkData.ruta}
                                                                </a>
                                                            </span>
                                                        </div>
                                                        <button
                                                            className="remove-file"
                                                            onClick={() => removeTempLink(index)}
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        <button
                                            className="upload-selected"
                                            onClick={handleUploadEvidencesAndLinks}
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <>
                                                    <FaSpinner className="spinner" />
                                                    Subiendo...
                                                </>
                                            ) : (
                                                <>
                                                    <FaFileUpload />
                                                    Subir evidencias
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* Lista de evidencias existentes */}
                                <div className="evidence-list">
                                    <h5>Evidencias cargadas</h5>
                                    {evidencias.length > 0 ? (
                                        evidencias.map(evidencia => (
                                            <div key={evidencia.id} className="evidence-item">
                                                <div className="evidence-info">
                                                    <div className="evidence-icon">
                                                        {evidencia.tipo === 'application/link' ? (
                                                            <FaGoogleDrive />
                                                        ) : evidencia.tipo?.includes('image') ? (
                                                            <FaImage />
                                                        ) : (
                                                            <FaFile />
                                                        )}
                                                    </div>
                                                    <div className="evidence-details">
                                                        <span className="evidence-name">
                                                            {evidencia.tipo === 'application/link' ? (
                                                                <a 
                                                                    href={evidencia.ruta} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="drive-link"
                                                                >
                                                                    {evidencia.nombre}
                                                                </a>
                                                            ) : (
                                                                evidencia.nombre
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="evidence-actions">
                                                    {evidencia.tipo === 'application/link' ? (
                                                        <button
                                                            onClick={() => window.open(evidencia.ruta, '_blank')}
                                                            className="download-button"
                                                            title="Abrir link"
                                                        >
                                                            <FaLink />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleFileClick(evidencia)}
                                                            className="download-button"
                                                            title="Ver archivo"
                                                        >
                                                            <FaDownload />
                                                        </button>
                                                    )}
                                                    {isOwnTask && (
                                                        <button
                                                            className="delete-button"
                                                            onClick={() => handleDeleteEvidence(evidencia.id)}
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="no-evidence">No hay evidencias cargadas</p>
                                    )}
                                </div>
                            </div>

                            {/* Panel de supervisión - Para líderes, admins, y líderes independientes sobre sus propias tareas */}
                            {((isLider && !isOwnTask) || isAdmin || canSupervisarPropia) && (
                                <>
                                    <div className='aprobacion-vistoBueno-container'>
                                        <div className='aprobacion-panel'>
                                            <h4>Aprobación de la tarea</h4>
                                            <div className="aprobacion-checkbox">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={aprobada}
                                                        onChange={(e) => {
                                                            handleAprobada(e.target.checked);
                                                        }} />
                                                    Aprobar tarea
                                                </label>
                                            </div>
                                        </div>

                                        {task.estado === 'Completada' && (
                                            <div className='vistoBueno-panel'>
                                                <h4>Revisión final</h4>
                                                <div className="revision-opciones">
                                                    <label>
                                                        <input
                                                            type="radio"
                                                            name="revision"
                                                            value="visto_bueno"
                                                            checked={revisionSelection === 'visto_bueno'}
                                                            onChange={() => handleRevisionChange('visto_bueno')}
                                                        />
                                                        Dar visto bueno
                                                    </label>
                                                    <label>
                                                        <input
                                                            type="radio"
                                                            name="revision"
                                                            value="rechazada"
                                                            checked={revisionSelection === 'rechazada'}
                                                            onChange={() => handleRevisionChange('rechazada')}
                                                        />
                                                        Rechazar tarea
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        <div className='aprobacion-panel'>
                                            <h4>Pausar tarea</h4>
                                            <div className="aprobacion-checkbox">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={pausada}
                                                        onChange={(e) => {
                                                            handlePausada(e.target.checked);
                                                        }} />
                                                    Tarea pausada
                                                </label>
                                            </div>
                                        </div>

                                        {canResolverReprg && (
                                            <div className="aprobacion-panel repr-approval-panel">
                                                <h4>📅 Solicitud de reprogramación</h4>
                                                <div className="repr-approval-info">
                                                    <p><strong>Solicitada por:</strong> {reprgPendiente.nombre_solicitante}</p>
                                                    <p><strong>Fecha actual:</strong> {fmtFecha(reprgPendiente.fecha_actual)}</p>
                                                    <p><strong>Nueva fecha:</strong> <span className="repr-fecha-nueva">{fmtFecha(reprgPendiente.fecha_nueva)}</span></p>
                                                    <p><strong>Motivo:</strong> {reprgPendiente.motivo}</p>
                                                </div>
                                                <div className="repr-approval-actions">
                                                    <button
                                                        className="repr-btn repr-btn-aprobar"
                                                        onClick={() => handleResolverReprogramacion(reprgPendiente.id, 'aprobar')}
                                                        disabled={resolviendoReprg}
                                                    >
                                                        <FaCheck /> Aprobar
                                                    </button>
                                                    <button
                                                        className="repr-btn repr-btn-rechazar"
                                                        onClick={() => handleResolverReprogramacion(reprgPendiente.id, 'rechazar')}
                                                        disabled={resolviendoReprg}
                                                    >
                                                        <FaTimes /> Rechazar
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {canResolverPausa && (
                                            <div className="aprobacion-panel repr-approval-panel">
                                                <h4>⏸️ Solicitud de pausa</h4>
                                                <div className="repr-approval-info">
                                                    <p><strong>Solicitada por:</strong> {pausaPendiente.nombre_solicitante}</p>
                                                    <p><strong>Reanudación estimada:</strong> <span className="repr-fecha-nueva">{fmtFecha(pausaPendiente.fecha_reanudacion)}</span></p>
                                                    <p><strong>Motivo:</strong> {pausaPendiente.motivo}</p>
                                                </div>
                                                <div className="repr-approval-actions">
                                                    <button
                                                        className="repr-btn repr-btn-aprobar"
                                                        onClick={() => handleResolverSolicitudPausa(pausaPendiente.id, 'aprobar')}
                                                        disabled={resolviendoPausa}
                                                    >
                                                        <FaCheck /> Aprobar
                                                    </button>
                                                    <button
                                                        className="repr-btn repr-btn-rechazar"
                                                        onClick={() => handleResolverSolicitudPausa(pausaPendiente.id, 'rechazar')}
                                                        disabled={resolviendoPausa}
                                                    >
                                                        <FaTimes /> Rechazar
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                    </div>


                                </>
                            )}

                            {historialReprg.length > 0 && (
                                <div className="repr-history-section">
                                    <h4 className="repr-history-title">📅 Historial de reprogramaciones</h4>
                                    <div className="repr-history-list">
                                        {historialReprg.map(r => (
                                            <div key={r.id} className={`repr-history-item repr-history-item--${r.estado.toLowerCase()}`}>
                                                <div className="repr-history-header">
                                                    <span className={`repr-estado-badge repr-estado-${r.estado.toLowerCase()}`}>{r.estado}</span>
                                                    <span className="repr-history-date">{fmtFecha(r.fecha_solicitud?.split(' ')[0] || r.fecha_solicitud)}</span>
                                                </div>
                                                <p className="repr-history-row"><strong>Solicitada por:</strong> {r.nombre_solicitante}</p>
                                                <p className="repr-history-row"><strong>Fecha anterior:</strong> {fmtFecha(r.fecha_actual)} → <strong>Nueva:</strong> {fmtFecha(r.fecha_nueva)}</p>
                                                <p className="repr-history-row"><strong>Motivo:</strong> {r.motivo}</p>
                                                {r.nombre_aprobador && (
                                                    <p className="repr-history-row"><strong>{r.estado === 'Aprobada' ? 'Aprobada' : 'Rechazada'} por:</strong> {r.nombre_aprobador}</p>
                                                )}
                                                {r.observacion_rechazo && (
                                                    <p className="repr-history-row repr-rechazo-obs"><strong>Motivo rechazo:</strong> {r.observacion_rechazo}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── Actividades y Comentarios ── */}
                            <div className="act-feed-section">
                                <h4 className="act-feed-title">💬 Actividades y Comentarios</h4>

                                {/* Input para nuevo comentario */}
                                {(isOwnTask || isLider || isAdmin) && !isArchived && (
                                    <div className="act-comment-box">
                                        <textarea
                                            className="act-comment-input"
                                            rows={2}
                                            placeholder="Escribe un comentario..."
                                            value={comentarioNuevo}
                                            onChange={e => setComentarioNuevo(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGuardarComentario();
                                            }}
                                            disabled={guardandoComentario}
                                        />
                                        <button
                                            className="act-comment-send"
                                            onClick={handleGuardarComentario}
                                            disabled={guardandoComentario || !comentarioNuevo.trim()}
                                        >
                                            {guardandoComentario ? <FaSpinner className="spinner" /> : <FaComment />}
                                            {guardandoComentario ? ' Enviando...' : ' Comentar'}
                                        </button>
                                    </div>
                                )}

                                {/* Feed */}
                                <div className="act-feed-list">
                                    {actividadesComentarios.length === 0 ? (
                                        <p className="act-feed-empty">Sin actividades registradas aún.</p>
                                    ) : (
                                        actividadesComentarios.map(entry => {
                                            const esComentario = entry.tipo_entrada === 'comentario';
                                            const iconoActividad = {
                                                'Aprobada': '✅', 'VistoBueno': '👁️', 'Rechazada': '❌',
                                                'Estado': '🔄', 'Tarea': '📋', 'Reprogramada': '📅',
                                                'Observacion': '💬', 'Pausada': '⏸️', 'Reanudada': '▶️',
                                                'Pausa solicitada': '⏸️', 'Pausa aprobada': '✅', 'Pausa rechazada': '❌',
                                                'Reprogramación solicitada': '📤', 'Reprogramación aprobada': '✅',
                                                'Reprogramación rechazada': '❌',
                                            }[entry.tipo] || '⚡';

                                            const fechaStr = (() => {
                                                if (!entry.fecha) return '';
                                                const d = new Date(entry.fecha.includes('T') ? entry.fecha : entry.fecha.replace(' ', 'T'));
                                                return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                                            })();

                                            return (
                                                <div key={entry.id} className={`act-feed-item ${esComentario ? 'act-feed-item--comentario' : 'act-feed-item--actividad'}`}>
                                                    <div className="act-feed-icon">
                                                        {esComentario ? <FaComment size={13} /> : <span>{iconoActividad}</span>}
                                                    </div>
                                                    <div className="act-feed-body">
                                                        {esComentario && (
                                                            <span className="act-feed-autor">{entry.autor}</span>
                                                        )}
                                                        <p className="act-feed-texto">{entry.texto}</p>
                                                        <span className="act-feed-fecha">{fechaStr}</span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* Modal de chat */}
            {isChatModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-chat">
                        <div className="modal-header">
                            <h2 className='modal-title'>Chat</h2>
                            <button className="close-button" onClick={() => setIsChatModalOpen(false)}>
                                &times;
                            </button>
                        </div>
                        <div className="modal-content">
                            {isIframeLoading && (
                                <div className="loader">
                                    <div className="justify-content-center jimu-primary-loading"></div>
                                </div>
                            )}
                            <iframe
                                src={`https://ingeer.co/chat-empresarial/public/chat-redireccionado-workboard/${chatUser}/${chatReceptor}`}
                                title="Chat"
                                className="chat-iframe"
                                style={{ width: '100%', height: '100%' }}
                                onLoad={() => {
                                    setIsIframeLoading(false);
                                }}
                            ></iframe>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de notificaciones (independiente) */}
            {isNotificationsModalOpen && (
                <NotificationsModal
                    isOpen={isNotificationsModalOpen}
                    onClose={() => setIsNotificationsModalOpen(false)}
                    observaciones={task.observaciones || []}
                />
            )}

            {/* Modal solicitud de pausa (encima del detalle de tarea) */}
            {pausaSolicitada && (
                <div
                    className="modal-overlay task-pausa-solicitud-overlay"
                    style={{
                        zIndex: Number.isFinite(Number(overlayZIndex)) ? Number(overlayZIndex) + 40 : 10040,
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !pausaSubmitting) setPausaSolicitada(false);
                    }}
                >
                    <div
                        className="task-pausa-solicitud-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="task-pausa-solicitud-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="task-pausa-solicitud-accent" aria-hidden="true" />
                        <div className="task-pausa-solicitud-header">
                            <div className="task-pausa-solicitud-heading">
                                <span className="task-pausa-solicitud-icon" aria-hidden="true">
                                    <FaPause />
                                </span>
                                <div>
                                    <h2 id="task-pausa-solicitud-title" className="task-pausa-solicitud-title">
                                        Solicitud de pausa
                                    </h2>
                                    <p className="task-pausa-solicitud-subtitle">
                                        Se pausará la tarea y se enviará un correo a su responsable (líder o administrador).
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="close-button task-pausa-solicitud-close"
                                onClick={() => !pausaSubmitting && setPausaSolicitada(false)}
                                aria-label="Cerrar"
                            >
                                &times;
                            </button>
                        </div>
                        <form className="task-pausa-solicitud-body" onSubmit={handleSolicitarPausaSubmit}>
                            <div className="task-pausa-solicitud-field">
                                <label htmlFor="pausa-motivo">Motivo</label>
                                <textarea
                                    id="pausa-motivo"
                                    className="task-pausa-solicitud-textarea"
                                    rows={4}
                                    placeholder="Explique brevemente el motivo de la pausa…"
                                    value={pausaMotivo}
                                    onChange={(e) => setPausaMotivo(e.target.value)}
                                    disabled={pausaSubmitting}
                                />
                            </div>
                            <div className="task-pausa-solicitud-field">
                                <label htmlFor="pausa-fecha-reanudacion">Fecha de reanudación prevista</label>
                                <input
                                    id="pausa-fecha-reanudacion"
                                    type="date"
                                    className="task-pausa-solicitud-date"
                                    value={pausaFechaReanudacion}
                                    onChange={(e) => setPausaFechaReanudacion(e.target.value)}
                                    disabled={pausaSubmitting}
                                />
                            </div>
                            <div className="task-pausa-solicitud-actions">
                                <button
                                    type="button"
                                    className="task-pausa-solicitud-btn task-pausa-solicitud-btn-secondary"
                                    onClick={() => !pausaSubmitting && setPausaSolicitada(false)}
                                    disabled={pausaSubmitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="task-pausa-solicitud-btn task-pausa-solicitud-btn-primary"
                                    disabled={pausaSubmitting}
                                >
                                    {pausaSubmitting ? (
                                        <>
                                            <FaSpinner className="spinner" /> Enviando…
                                        </>
                                    ) : (
                                        <>
                                            <FaPause /> Registrar pausa
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de reanudación + reprogramación */}
            {showReanudarForm && (
                <div
                    className="modal-overlay task-pausa-solicitud-overlay"
                    style={{
                        zIndex: Number.isFinite(Number(overlayZIndex)) ? Number(overlayZIndex) + 40 : 10040,
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !reanudarSubmitting) setShowReanudarForm(false);
                    }}
                >
                    <div
                        className="task-pausa-solicitud-modal"
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="task-pausa-solicitud-accent" style={{ background: 'linear-gradient(90deg,#16a34a,#22c55e)' }} aria-hidden="true" />
                        <div className="task-pausa-solicitud-header">
                            <div className="task-pausa-solicitud-heading">
                                <span className="task-pausa-solicitud-icon" aria-hidden="true" style={{ background: '#dcfce7', color: '#16a34a' }}>
                                    <FaPlay />
                                </span>
                                <div>
                                    <h2 className="task-pausa-solicitud-title">Reanudar tarea</h2>
                                    <p className="task-pausa-solicitud-subtitle">
                                        Define la nueva fecha pactada y el motivo de reanudación.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="close-button task-pausa-solicitud-close"
                                onClick={() => !reanudarSubmitting && setShowReanudarForm(false)}
                                aria-label="Cerrar"
                            >
                                &times;
                            </button>
                        </div>
                        <form className="task-pausa-solicitud-body" onSubmit={handleReanudar}>
                            <div className="task-pausa-solicitud-field">
                                <label htmlFor="reanudar-fecha">Nueva fecha pactada</label>
                                <input
                                    id="reanudar-fecha"
                                    type="date"
                                    className="task-pausa-solicitud-date"
                                    value={reanudarFecha}
                                    onChange={(e) => setReanudarFecha(e.target.value)}
                                    disabled={reanudarSubmitting}
                                />
                            </div>
                            <div className="task-pausa-solicitud-field">
                                <label htmlFor="reanudar-motivo">Motivo de reanudación</label>
                                <textarea
                                    id="reanudar-motivo"
                                    className="task-pausa-solicitud-textarea"
                                    rows={4}
                                    placeholder="Indique por qué se reanuda la tarea y cualquier cambio relevante…"
                                    value={reanudarMotivo}
                                    onChange={(e) => setReanudarMotivo(e.target.value)}
                                    disabled={reanudarSubmitting}
                                />
                            </div>
                            <div className="task-pausa-solicitud-actions">
                                <button
                                    type="button"
                                    className="task-pausa-solicitud-btn task-pausa-solicitud-btn-secondary"
                                    onClick={() => !reanudarSubmitting && setShowReanudarForm(false)}
                                    disabled={reanudarSubmitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="task-pausa-solicitud-btn task-pausa-solicitud-btn-primary"
                                    style={{ background: '#16a34a' }}
                                    disabled={reanudarSubmitting}
                                >
                                    {reanudarSubmitting ? (
                                        <><FaSpinner className="spinner" /> Guardando…</>
                                    ) : (
                                        <><FaPlay /> Reanudar tarea</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de solicitud de reprogramación */}
            {showReprgForm && (
                <div
                    className="modal-overlay task-pausa-solicitud-overlay"
                    style={{ zIndex: Number.isFinite(Number(overlayZIndex)) ? Number(overlayZIndex) + 40 : 10040 }}
                    onClick={(e) => { if (e.target === e.currentTarget && !reprgSubmitting) setShowReprgForm(false); }}
                >
                    <div
                        className="task-pausa-solicitud-modal repr-form-modal"
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="task-pausa-solicitud-accent repr-accent" aria-hidden="true" />
                        <div className="task-pausa-solicitud-header">
                            <div className="task-pausa-solicitud-heading">
                                <span className="task-pausa-solicitud-icon repr-icon" aria-hidden="true">
                                    <FaCalendar />
                                </span>
                                <div>
                                    <h2 className="task-pausa-solicitud-title">
                                        {isLider && isIndependiente ? 'Reprogramar tarea' : 'Solicitar reprogramación'}
                                    </h2>
                                    <p className="task-pausa-solicitud-subtitle">
                                        {isLider && isIndependiente
                                            ? 'La reprogramación se aplicará de inmediato.'
                                            : isLider
                                                ? 'Su solicitud será enviada al Administrador para aprobación.'
                                                : 'Su solicitud será enviada a su líder para aprobación.'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="close-button task-pausa-solicitud-close"
                                onClick={() => !reprgSubmitting && setShowReprgForm(false)}
                                aria-label="Cerrar"
                            >
                                &times;
                            </button>
                        </div>
                        <form className="task-pausa-solicitud-body" onSubmit={handleSolicitarReprogramacion}>
                            <div className="task-pausa-solicitud-field">
                                <label htmlFor="reprg-fecha">Nueva fecha pactada</label>
                                <input
                                    id="reprg-fecha"
                                    type="date"
                                    className="task-pausa-solicitud-date"
                                    value={reprgFechaNueva}
                                    onChange={(e) => setReprgFechaNueva(e.target.value)}
                                    disabled={reprgSubmitting}
                                />
                            </div>
                            <div className="task-pausa-solicitud-field">
                                <label htmlFor="reprg-motivo">Motivo de la reprogramación</label>
                                <textarea
                                    id="reprg-motivo"
                                    className="task-pausa-solicitud-textarea"
                                    rows={4}
                                    placeholder="Explique brevemente el motivo de la reprogramación…"
                                    value={reprgMotivo}
                                    onChange={(e) => setReprgMotivo(e.target.value)}
                                    disabled={reprgSubmitting}
                                />
                            </div>
                            <div className="task-pausa-solicitud-actions">
                                <button
                                    type="button"
                                    className="task-pausa-solicitud-btn task-pausa-solicitud-btn-secondary"
                                    onClick={() => !reprgSubmitting && setShowReprgForm(false)}
                                    disabled={reprgSubmitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="task-pausa-solicitud-btn task-pausa-solicitud-btn-primary repr-submit-btn"
                                    disabled={reprgSubmitting}
                                >
                                    {reprgSubmitting ? (
                                        <><FaSpinner className="spinner" /> {isLider && isIndependiente ? 'Reprogramando…' : 'Enviando…'}</>
                                    ) : (
                                        <><FaCalendar /> {isLider && isIndependiente ? 'Reprogramar' : 'Enviar solicitud'}</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
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
    );
};

export default TaskDetailsModal; 