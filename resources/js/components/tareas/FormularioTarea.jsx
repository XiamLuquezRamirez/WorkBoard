import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
    FaPlus, FaTimes, FaSave, FaCheck, FaRegCircle, FaPaperclip, FaCopy,
    FaUser, FaFolder, FaCalendarAlt, FaListUl, FaClipboardCheck, FaBullseye,
} from 'react-icons/fa';
import axiosInstance from '../../axiosConfig';
import { getImageUrl } from '../../utils/assetHelper';
import EditorCriteriosNuevos, { criterioVacio, criteriosParaEnviar, validarCriterios } from '../criterios/EditorCriteriosNuevos';
import './formularioTarea.css';

/** Fecha local AAAA-MM-DD. toISOString daría la de Greenwich, un día después por la noche. */
export const hoyLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ymd = (v) => {
    const s = String(v || '').split('T')[0].split(' ')[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

/** «hoy», «mañana», «en 5 días», «hace 2 días». */
export const plazoEnPalabras = (fecha) => {
    if (!fecha) return '';
    const dias = Math.round((new Date(`${fecha}T00:00:00`) - new Date(`${hoyLocal()}T00:00:00`)) / 86400000);
    if (dias === 0) return 'hoy';
    if (dias === 1) return 'mañana';
    if (dias > 1) return `en ${dias} días`;
    return dias === -1 ? 'venció ayer' : `venció hace ${-dias} días`;
};

const fechaLarga = (f) => (f
    ? new Date(`${f}T00:00:00`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : '');

const errorDe = (e, porDefecto) => {
    const d = e?.response?.data;
    if (d?.errors) return Object.values(d.errors).flat().join(' ');
    return d?.error || d?.message || porDefecto;
};

let siguienteId = 1;
const nuevoItem = (titulo, fecha_vencimiento = '', id = null) => ({ tempId: `i${siguienteId++}`, id, titulo, fecha_vencimiento });

/**
 * Formulario de tarea, el mismo en todas las pantallas que crean o editan
 * tareas (tablero del administrador, mis tareas y gestión de empleados).
 *
 * Antes cada pantalla tenía su copia y se habían separado: una permitía crear
 * la tarea ya Completada, otra no pedía fecha futura, otra exigía proyecto
 * para el checklist. Aquí se valida igual en todas y el servidor repite las
 * mismas reglas.
 *
 * Al crear, la tarea nace con su propósito y sus criterios de aceptación.
 * Al editar, los criterios se gestionan uno a uno en el detalle de la tarea,
 * donde queda la trazabilidad de cada cambio.
 */
export default function FormularioTarea({
    empleadoId,
    empleadoNombre,
    tarea = null,
    plantillas = [],
    proyectos: proyectosDados,
    onGuardada,
    onCancelar,
}) {
    const editando = !!tarea?.id;

    const [datos, setDatos] = useState(() => ({
        titulo: tarea?.titulo || '',
        descripcion: tarea?.descripcion || '',
        proposito: tarea?.proposito || '',
        fecha_pactada: ymd(tarea?.fecha_pactada),
        prioridad: tarea?.prioridad || 'Media',
        estado: tarea?.estado || 'Pendiente',
        proyecto_id: tarea?.proyecto_id ? String(tarea.proyecto_id) : '',
    }));
    const [criterios, setCriterios] = useState([criterioVacio()]);
    const [items, setItems] = useState([]);
    const [itemsBorrados, setItemsBorrados] = useState([]);
    const [tituloChecklist, setTituloChecklist] = useState('');
    const [textoItem, setTextoItem] = useState('');
    const [fechaItem, setFechaItem] = useState('');
    const [checklistsAjenos, setChecklistsAjenos] = useState(null);
    const [adjuntos, setAdjuntos] = useState([]);
    const [subiendo, setSubiendo] = useState(false);
    const [plantillaId, setPlantillaId] = useState('');
    const [proyectosCargados, setProyectosCargados] = useState([]);
    const [guardando, setGuardando] = useState(false);
    const [intentado, setIntentado] = useState(false);

    const proyectos = proyectosDados || proyectosCargados;
    const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

    useEffect(() => {
        if (proyectosDados) return;
        axiosInstance.get('/cargarProyectos').then((r) => setProyectosCargados(r.data || [])).catch(() => {});
    }, [proyectosDados]);

    // Al editar, el checklist actual se trae para poder corregirlo aquí mismo.
    useEffect(() => {
        if (!editando) return;
        axiosInstance.get(`/subtareas/${tarea.id}`)
            .then((r) => {
                const filas = Array.isArray(r.data) ? r.data : [];
                setItems(filas.map((s) => nuevoItem(s.titulo || '', ymd(s.fecha_vencimiento), s.id)));
                setTituloChecklist(filas[0]?.checklist_titulo || '');
            })
            .catch(() => {});
    }, [editando, tarea?.id]);

    // ─── Plantilla y copia de checklist ─────────────────────────────────────

    const aplicarPlantilla = async (id) => {
        setPlantillaId(id);
        if (!id) return;
        try {
            const [t, s, c] = await Promise.all([
                axiosInstance.get(`/cargarTareaSeleccionada/${id}`),
                axiosInstance.get(`/subtareas/${id}`),
                // Una tarea heredada puede no tener criterios, o no ser visible.
                axiosInstance.get(`/tareas/${id}/criterios`).catch(() => ({ data: null })),
            ]);
            const p = t.data || {};
            const fecha = ymd(p.fecha_pactada);
            setDatos((d) => ({
                ...d,
                titulo: p.titulo || '',
                descripcion: p.descripcion || '',
                proposito: p.proposito || '',
                // Una fecha ya vencida no sirve: se deja para que la elijan.
                fecha_pactada: fecha && fecha >= hoyLocal() ? fecha : '',
                prioridad: ['Alta', 'Media', 'Baja'].includes(p.prioridad) ? p.prioridad : 'Media',
                proyecto_id: p.proyecto_id ? String(p.proyecto_id) : '',
            }));
            const filas = Array.isArray(s.data) ? s.data : [];
            setItems(filas.map((x) => nuevoItem(x.titulo || '', ymd(x.fecha_vencimiento) >= hoyLocal() ? ymd(x.fecha_vencimiento) : '')));
            setTituloChecklist(filas[0]?.checklist_titulo || '');
            const previos = c.data?.criterios || [];
            setCriterios(previos.length
                ? previos.map((x) => ({ descripcion: x.descripcion, obligatorio: !!x.obligatorio, requiere_evidencia: !!x.requiere_evidencia }))
                : [criterioVacio()]);
        } catch {
            Swal.fire('Error', 'No se pudo cargar la tarea de plantilla.', 'error');
        }
    };

    // Los checklists que se pueden copiar se piden al abrir el formulario: si
    // se pidieran al desplegar la lista, llegarían con la lista ya abierta.
    useEffect(() => {
        if (!empleadoId) return;
        axiosInstance.get(`/checklists-empleado/${empleadoId}`)
            .then((r) => setChecklistsAjenos(Array.isArray(r.data) ? r.data : []))
            .catch(() => setChecklistsAjenos([]));
    }, [empleadoId]);

    const copiarChecklist = (tareaId) => {
        const origen = (checklistsAjenos || []).find((c) => String(c.tarea_id) === String(tareaId));
        if (!origen) return;
        setItems((prev) => [...prev, ...origen.items.map((i) => nuevoItem(i.titulo, ymd(i.fecha_vencimiento)))]);
        if (origen.checklist_titulo && !tituloChecklist) setTituloChecklist(origen.checklist_titulo);
    };

    // ─── Checklist ──────────────────────────────────────────────────────────

    const agregarItem = () => {
        const t = textoItem.trim();
        if (!t) return;
        setItems((prev) => [...prev, nuevoItem(t, fechaItem)]);
        setTextoItem('');
        setFechaItem('');
    };

    const cambiarItem = (tempId, campo, valor) => setItems((prev) => prev.map((i) => (i.tempId === tempId ? { ...i, [campo]: valor } : i)));

    const quitarItem = (item) => {
        if (item.id) setItemsBorrados((prev) => [...prev, item.id]);
        setItems((prev) => prev.filter((i) => i.tempId !== item.tempId));
    };

    // ─── Adjuntos ───────────────────────────────────────────────────────────

    const subirAdjuntos = async (e) => {
        const archivos = Array.from(e.target.files || []);
        e.target.value = '';
        if (!archivos.length) return;
        setSubiendo(true);
        try {
            const fd = new FormData();
            archivos.forEach((a) => fd.append('evidencias[]', a));
            const r = await axiosInstance.post('/subirEvidencias', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setAdjuntos((prev) => [...prev, ...(r.data?.evidencias || []).map((ev) => ({
                nombre: ev.nombre_original, ruta: ev.ruta, tipo: ev.tipo,
            }))]);
        } catch (err) {
            Swal.fire('Error', errorDe(err, 'No se pudieron subir los archivos.'), 'error');
        } finally {
            setSubiendo(false);
        }
    };

    // ─── Validación ─────────────────────────────────────────────────────────

    // Lo que falta para poder guardar. Repite las reglas del servidor para
    // avisar antes de enviar; al editar se relajan igual que allí, porque
    // las tareas antiguas nacieron sin propósito ni criterios.
    const requisitos = useMemo(() => {
        const r = [
            { ok: datos.titulo.trim() !== '', texto: 'Título' },
            editando
                ? { ok: datos.descripcion.trim() !== '', texto: 'Descripción' }
                : { ok: datos.descripcion.trim().length >= 10, texto: 'Descripción (10+ caracteres)' },
        ];
        if (!editando) {
            r.push({ ok: datos.proposito.trim().length >= 10, texto: 'Para qué sirve (10+ caracteres)' });
            r.push({ ok: !validarCriterios(criterios), texto: 'Al menos un criterio de aceptación' });
        }
        r.push(editando
            ? { ok: !!datos.fecha_pactada, texto: 'Fecha de entrega' }
            : { ok: !!datos.fecha_pactada && datos.fecha_pactada >= hoyLocal(), texto: 'Fecha de entrega desde hoy' });
        return r;
    }, [datos, criterios, editando]);

    const listo = requisitos.every((r) => r.ok);

    // ─── Guardar ────────────────────────────────────────────────────────────

    // Enter en un campo de una línea no envía la tarea: el formulario es largo
    // y se enviaría a medio escribir. Se guarda con el botón.
    const evitarEnvioConEnter = (e) => {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'submit') e.preventDefault();
    };

    const guardar = async (e) => {
        e.preventDefault();
        setIntentado(true);
        if (!listo) {
            const faltan = requisitos.filter((r) => !r.ok).map((r) => `<li>${r.texto}</li>`).join('');
            Swal.fire({
                title: 'Falta completar',
                html: `<ul style="text-align:left;margin:0">${faltan}</ul>${!editando && validarCriterios(criterios) ? `<p style="margin-top:.6rem">${validarCriterios(criterios)}</p>` : ''}`,
                icon: 'warning',
            });
            return;
        }

        setGuardando(true);
        try {
            const cuerpo = {
                ...datos,
                proyecto_id: datos.proyecto_id || null,
                empleado: empleadoId,
                evidencias: adjuntos,
                accion: editando ? 'editar' : 'guardar',
            };
            if (editando) cuerpo.id = tarea.id;
            else cuerpo.criterios = criteriosParaEnviar(criterios);

            const r = await axiosInstance.post('/guardarTarea', cuerpo);
            const tareaId = r.data?.tarea_id || tarea?.id;

            const filas = items.map((i) => ({ ...i, titulo: i.titulo.trim() })).filter((i) => i.titulo);
            const subtarea = (i) => ({
                titulo: i.titulo,
                fecha_vencimiento: i.fecha_vencimiento || null,
                checklist_titulo: tituloChecklist.trim() || null,
            });
            if (tareaId) {
                await Promise.all([
                    ...filas.filter((i) => !i.id).map((i) => axiosInstance.post('/subtareas', { tarea_id: tareaId, ...subtarea(i) })),
                    ...filas.filter((i) => i.id).map((i) => axiosInstance.put(`/subtareas/${i.id}`, subtarea(i))),
                    ...itemsBorrados.map((id) => axiosInstance.delete(`/subtareas/${id}`)),
                ]);
            }

            Swal.fire({ title: editando ? 'Tarea actualizada' : 'Tarea creada', icon: 'success', timer: 1600, showConfirmButton: false });
            if (onGuardada) await onGuardada(r.data);
        } catch (err) {
            Swal.fire('No se pudo guardar', errorDe(err, 'Hubo un error al guardar la tarea.'), 'error');
        } finally {
            setGuardando(false);
        }
    };

    // ─── Render ─────────────────────────────────────────────────────────────

    const criteriosValidos = criteriosParaEnviar(criterios);
    const proyecto = proyectos.find((p) => String(p.id) === String(datos.proyecto_id));
    const vencida = datos.fecha_pactada && datos.fecha_pactada < hoyLocal();
    const estadosPosibles = editando && !['Pendiente', 'En Proceso'].includes(datos.estado)
        ? ['Pendiente', 'En Proceso', datos.estado]
        : ['Pendiente', 'En Proceso'];

    return (
        <form className={`ft ${intentado ? 'ft-intentado' : ''}`} onSubmit={guardar} onKeyDown={evitarEnvioConEnter} noValidate>
            <div className="ft-rejilla">
                <div className="ft-campos">
                    {!editando && plantillas.length > 0 && (
                        <div className="ft-plantilla">
                            <FaCopy />
                            <select value={plantillaId} onChange={(e) => aplicarPlantilla(e.target.value)}>
                                <option value="">Empezar en blanco</option>
                                {plantillas.map((p) => <option key={p.id} value={p.id}>Copiar de: {p.titulo}</option>)}
                            </select>
                            <span>Trae título, propósito, criterios, proyecto y checklist de una tarea existente.</span>
                        </div>
                    )}

                    <Seccion n={1} titulo="Qué hay que hacer">
                        <label className="ft-campo">
                            <span>Título</span>
                            <input type="text" value={datos.titulo} onChange={cambiar('titulo')} maxLength={255}
                                placeholder="Ej.: Presentar la cuenta de cobro de octubre" className={!requisitos[0].ok ? 'ft-falta' : ''} />
                        </label>
                        <label className="ft-campo">
                            <span>Descripción</span>
                            <textarea rows={3} value={datos.descripcion} onChange={cambiar('descripcion')}
                                placeholder="El trabajo concreto: qué se entrega y con qué alcance"
                                className={!requisitos[1].ok ? 'ft-falta' : ''} />
                        </label>
                    </Seccion>

                    <Seccion n={2} titulo="Para qué sirve" ayuda="El propósito, no el trabajo: qué cambia cuando la tarea está hecha.">
                        <label className="ft-campo">
                            <input type="text" value={datos.proposito} onChange={cambiar('proposito')} maxLength={500}
                                placeholder="Ej.: Que el cliente pague a tiempo y no se retrase la nómina"
                                className={!editando && datos.proposito.trim().length < 10 ? 'ft-falta' : ''} />
                        </label>
                    </Seccion>

                    <Seccion n={3} titulo="Cómo se acepta">
                        {editando ? (
                            <p className="ft-nota">
                                Los criterios de aceptación se gestionan en el detalle de la tarea, donde cada cambio
                                queda en su historial.
                            </p>
                        ) : (
                            <EditorCriteriosNuevos valor={criterios} onCambio={setCriterios} />
                        )}
                    </Seccion>

                    <Seccion n={4} titulo="Plazo y prioridad">
                        <div className="ft-fila">
                            <label className="ft-campo">
                                <span>Fecha de entrega</span>
                                <input type="date" value={datos.fecha_pactada} onChange={cambiar('fecha_pactada')}
                                    min={editando ? undefined : hoyLocal()}
                                    className={!requisitos[requisitos.length - 1].ok ? 'ft-falta' : ''} />
                            </label>
                            <label className="ft-campo">
                                <span>Prioridad</span>
                                <select value={datos.prioridad} onChange={cambiar('prioridad')}>
                                    <option value="Alta">Alta</option>
                                    <option value="Media">Media</option>
                                    <option value="Baja">Baja</option>
                                </select>
                            </label>
                            <label className="ft-campo">
                                <span>{editando ? 'Estado' : 'Empieza en'}</span>
                                <select value={datos.estado} onChange={cambiar('estado')} disabled={editando && !['Pendiente', 'En Proceso'].includes(datos.estado)}>
                                    {estadosPosibles.map((e) => <option key={e} value={e}>{e}</option>)}
                                </select>
                            </label>
                        </div>
                        <label className="ft-campo">
                            <span>Proyecto (opcional)</span>
                            <select value={datos.proyecto_id} onChange={cambiar('proyecto_id')}>
                                <option value="">Sin proyecto</option>
                                {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </label>
                    </Seccion>

                    <Seccion n={5} titulo="Pasos para hacerla" opcional ayuda="El checklist mide cuánto se ha ejecutado; los criterios, si el resultado sirve.">
                        <div className="ft-checklist-cabecera">
                            <input type="text" value={tituloChecklist} onChange={(e) => setTituloChecklist(e.target.value)}
                                placeholder="Título del checklist (opcional)" />
                            <select value="" onChange={(e) => copiarChecklist(e.target.value)} disabled={!checklistsAjenos?.length}>
                                <option value="">{checklistsAjenos === null ? 'Cargando checklists…' : checklistsAjenos.length ? 'Copiar pasos de otra tarea…' : 'No hay checklists para copiar'}</option>
                                {(checklistsAjenos || []).map((c) => (
                                    <option key={c.tarea_id} value={c.tarea_id}>
                                        {c.tarea_titulo}{c.checklist_titulo ? ` — ${c.checklist_titulo}` : ''} ({c.items.length})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {items.length > 0 && (
                            <ol className="ft-items">
                                {items.map((i) => (
                                    <li key={i.tempId}>
                                        <input type="text" value={i.titulo} onChange={(e) => cambiarItem(i.tempId, 'titulo', e.target.value)} />
                                        <input type="date" value={i.fecha_vencimiento || ''} title="Fecha del paso"
                                            onChange={(e) => cambiarItem(i.tempId, 'fecha_vencimiento', e.target.value)} />
                                        <button type="button" className="ft-quitar" title="Quitar paso" onClick={() => quitarItem(i)}><FaTimes /></button>
                                    </li>
                                ))}
                            </ol>
                        )}

                        <div className="ft-item-nuevo">
                            <input type="text" value={textoItem} placeholder="Nuevo paso y Enter"
                                onChange={(e) => setTextoItem(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarItem(); } }} />
                            <input type="date" value={fechaItem} onChange={(e) => setFechaItem(e.target.value)} title="Fecha del paso (opcional)" />
                            <button type="button" className="ft-agregar" disabled={!textoItem.trim()} onClick={agregarItem}><FaPlus /></button>
                        </div>
                    </Seccion>

                    <Seccion n={6} titulo="Adjuntos" opcional ayuda="Se guardan con las evidencias de la tarea.">
                        <label className={`ft-subir ${subiendo ? 'es-subiendo' : ''}`}>
                            <FaPaperclip /> {subiendo ? 'Subiendo…' : 'Adjuntar archivos'}
                            <input type="file" multiple onChange={subirAdjuntos} disabled={subiendo} />
                        </label>
                        {adjuntos.length > 0 && (
                            <ul className="ft-adjuntos">
                                {adjuntos.map((a, k) => (
                                    <li key={a.ruta}>
                                        <a href={getImageUrl(`storage/${a.ruta}`)} target="_blank" rel="noopener noreferrer">{a.nombre}</a>
                                        <button type="button" className="ft-quitar" title="Quitar" onClick={() => setAdjuntos((prev) => prev.filter((_, j) => j !== k))}><FaTimes /></button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Seccion>
                </div>

                {/* La tarea completa de un vistazo, mientras se escribe: lo
                    que verá el responsable y lo que falta para guardarla. */}
                <aside className="ft-vista" aria-label="Visión general de la tarea">
                    <div className="ft-vista-caja">
                        <span className="ft-vista-etiqueta">Visión general</span>
                        <h3 className={datos.titulo.trim() ? '' : 'es-vacio'}>{datos.titulo.trim() || 'Sin título todavía'}</h3>
                        <div className="ft-chips">
                            <span className={`ft-chip p-${datos.prioridad.toLowerCase()}`}>Prioridad {datos.prioridad}</span>
                            <span className="ft-chip">{datos.estado}</span>
                        </div>

                        <dl className="ft-datos">
                            {empleadoNombre && (<><dt><FaUser /> Responsable</dt><dd>{empleadoNombre}</dd></>)}
                            <dt><FaBullseye /> Para qué</dt>
                            <dd className={datos.proposito.trim() ? '' : 'es-vacio'}>{datos.proposito.trim() || 'Sin definir'}</dd>
                            <dt><FaCalendarAlt /> Entrega</dt>
                            <dd className={datos.fecha_pactada ? (vencida ? 'es-mal' : '') : 'es-vacio'}>
                                {datos.fecha_pactada ? <>{fechaLarga(datos.fecha_pactada)} <small>· {plazoEnPalabras(datos.fecha_pactada)}</small></> : 'Sin fecha'}
                            </dd>
                            {proyecto && (<><dt><FaFolder /> Proyecto</dt><dd>{proyecto.nombre}</dd></>)}
                        </dl>

                        <div className="ft-resumen">
                            <div>
                                <FaClipboardCheck />
                                <b>{editando ? '—' : criteriosValidos.length}</b>
                                <span>criterios</span>
                            </div>
                            <div><FaListUl /><b>{items.filter((i) => i.titulo.trim()).length}</b><span>pasos</span></div>
                            <div><FaPaperclip /><b>{adjuntos.length}</b><span>adjuntos</span></div>
                        </div>

                        {!editando && criteriosValidos.length > 0 && (
                            <ul className="ft-vista-criterios">
                                {criteriosValidos.slice(0, 4).map((c, k) => (
                                    <li key={k}>
                                        {c.descripcion}
                                        {(!c.obligatorio || c.requiere_evidencia) && (
                                            <small>{[!c.obligatorio && 'opcional', c.requiere_evidencia && 'con evidencia'].filter(Boolean).join(' · ')}</small>
                                        )}
                                    </li>
                                ))}
                                {criteriosValidos.length > 4 && <li className="ft-mas">y {criteriosValidos.length - 4} más</li>}
                            </ul>
                        )}

                        <ul className="ft-requisitos">
                            {requisitos.map((r) => (
                                <li key={r.texto} className={r.ok ? 'es-ok' : ''}>
                                    {r.ok ? <FaCheck /> : <FaRegCircle />} {r.texto}
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>
            </div>

            <div className="ft-pie">
                <span className={`ft-estado-listo ${listo ? 'es-listo' : ''}`}>
                    {listo ? 'Lista para guardar' : `Faltan ${requisitos.filter((r) => !r.ok).length} datos`}
                </span>
                {onCancelar && (
                    <button type="button" className="ft-btn" onClick={onCancelar} disabled={guardando}>
                        <FaTimes /> Cancelar
                    </button>
                )}
                <button type="submit" className="ft-btn ft-primario" disabled={guardando || subiendo}>
                    <FaSave /> {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear tarea'}
                </button>
            </div>
        </form>
    );
}

function Seccion({ n, titulo, ayuda, opcional, children }) {
    return (
        <section className="ft-seccion">
            <header>
                <span className="ft-num">{n}</span>
                <h4>{titulo}{opcional && <em>opcional</em>}</h4>
            </header>
            {ayuda && <p className="ft-ayuda">{ayuda}</p>}
            {children}
        </section>
    );
}
