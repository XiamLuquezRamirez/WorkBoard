import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
    FaCheck, FaTimes, FaPlus, FaTrash, FaEdit, FaArrowUp, FaArrowDown,
    FaLink, FaFileUpload, FaHistory, FaChevronDown,
} from 'react-icons/fa';
import axiosInstance from '../../axiosConfig';
import { getImageUrl } from '../../utils/assetHelper';
import './criterios.css';

const ESTADO_CLASE = {
    'Pendiente':   'es-pendiente',
    'Cumplido':    'es-cumplido',
    'No cumplido': 'es-nocumplido',
};

const GENERAL_CLASE = {
    'Sin criterios':             'g-vacio',
    'Pendiente de verificación': 'g-pendiente',
    'Con incumplimientos':       'g-mal',
    'Lista para aceptar':        'g-lista',
    'Aceptada':                  'g-aceptada',
};

const EVENTOS = {
    creado: 'creó el criterio',
    editado: 'editó el criterio',
    eliminado: 'eliminó el criterio',
    reordenado: 'reordenó los criterios',
    declarado: 'declaró el cumplimiento',
    declaracion_retirada: 'retiró su declaración',
    verificado: 'verificó el criterio',
    evidencia_agregada: 'añadió una evidencia',
    evidencia_eliminada: 'quitó una evidencia',
    enviada_revision: 'envió la tarea a revisión',
    tarea_aceptada: 'aceptó la entrega',
    tarea_devuelta: 'devolvió la entrega',
    migrado: 'migró el criterio anterior',
};

const fecha = (iso) => {
    if (!iso) return '';
    const t = new Date(String(iso).replace(' ', 'T') + (String(iso).includes('Z') ? '' : 'Z'));
    return Number.isNaN(t.getTime())
        ? String(iso)
        : t.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

const avisar = (titulo, texto, icono) => Swal.fire({ title: titulo, text: texto, icon: icono, timer: icono === 'success' ? 1600 : undefined });

const errorDe = (e, porDefecto) => {
    const d = e?.response?.data;
    if (d?.errors) return Object.values(d.errors).flat().join(' ');
    return d?.error || d?.message || porDefecto;
};

/**
 * Criterios de aceptación de una tarea.
 *
 * Sección independiente del checklist: no lee ni escribe subtareas y su
 * indicador es suyo. Lo que cada usuario puede hacer lo decide el servidor
 * (permisos en la respuesta); aquí sólo se ocultan los botones que no le
 * corresponden, para no ofrecer acciones que acabarían en un 403.
 *
 * onCargado recibe los datos cada vez que se recargan, para que la visión
 * general de la tarea muestre las mismas cifras sin pedirlas otra vez.
 * abrirSenal: al cambiar, despliega la sección (la visión general la usa
 * para llevar al usuario hasta aquí).
 */
export default function CriteriosAceptacion({ task, onUpdate, onCargado, abrirSenal, onEstadoCambiado }) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(false);
    const [abierto, setAbierto] = useState(task?.estado === 'En Revisión');
    const [ocupado, setOcupado] = useState(false);
    const [nuevo, setNuevo] = useState({ descripcion: '', obligatorio: true, requiere_evidencia: false, responsable_verificacion: '' });
    const [editando, setEditando] = useState(null);
    const [historial, setHistorial] = useState(null);
    const [personas, setPersonas] = useState([]);

    const cargar = useCallback(() => {
        if (!task?.id) return Promise.resolve();
        return axiosInstance.get(`/tareas/${task.id}/criterios`)
            .then((r) => { setDatos(r.data); setError(false); })
            .catch(() => setError(true));
    }, [task?.id]);

    useEffect(() => { cargar(); }, [cargar, task?.estado]);

    useEffect(() => { if (datos && onCargado) onCargado(datos); }, [datos]); // eslint-disable-line react-hooks/exhaustive-deps

    // Si el servidor dice que la tarea cambió de estado (aceptada, devuelta),
    // el detalle se entera para actualizar su cabecera.
    useEffect(() => {
        if (datos?.estado_tarea && datos.estado_tarea !== task?.estado && onEstadoCambiado) {
            onEstadoCambiado(datos.estado_tarea);
        }
    }, [datos?.estado_tarea]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { if (abrirSenal) setAbierto(true); }, [abrirSenal]);

    // Quién puede ser responsable de verificación: la gente del alcance del
    // usuario. Sólo se pide si puede gestionar.
    useEffect(() => {
        if (!datos?.permisos?.gestionar || personas.length) return;
        axiosInstance.get('/equipo/convocables')
            .then((r) => setPersonas(Array.isArray(r.data) ? r.data : []))
            .catch(() => {});
    }, [datos?.permisos?.gestionar, personas.length]);

    /** Ejecuta una acción, recarga y avisa. Centraliza el manejo de errores. */
    const accion = async (fn, exito, refrescarTarea = false) => {
        setOcupado(true);
        try {
            const r = await fn();
            await cargar();
            if (historial) verHistorial(true);
            if (refrescarTarea && onUpdate) onUpdate();
            if (exito) avisar('Listo', r?.data?.success || exito, 'success');
            return true;
        } catch (e) {
            const bloqueos = e?.response?.data?.bloqueos;
            Swal.fire({
                title: 'No se pudo completar',
                html: bloqueos?.length
                    ? `${errorDe(e, '')}<ul style="text-align:left;margin:.6rem 0 0">${bloqueos.map((b) => `<li>${b.replace(/</g, '&lt;')}</li>`).join('')}</ul>`
                    : errorDe(e, 'Error inesperado.'),
                icon: 'error',
            });
            return false;
        } finally {
            setOcupado(false);
        }
    };

    const verHistorial = (forzar = false) => {
        if (historial && !forzar) { setHistorial(null); return; }
        axiosInstance.get(`/tareas/${task.id}/criterios/historial`)
            .then((r) => setHistorial(r.data))
            .catch(() => setHistorial([]));
    };

    // ─── Gestión ────────────────────────────────────────────────────────────

    const agregar = async (e) => {
        e.preventDefault();
        if (nuevo.descripcion.trim().length < 5) {
            avisar('Criterio muy corto', 'Describe la condición en al menos 5 caracteres.', 'warning');
            return;
        }
        const ok = await accion(() => axiosInstance.post(`/tareas/${task.id}/criterios`, {
            ...nuevo,
            responsable_verificacion: nuevo.responsable_verificacion || null,
        }), 'Criterio añadido.');
        if (ok) setNuevo({ descripcion: '', obligatorio: true, requiere_evidencia: false, responsable_verificacion: '' });
    };

    const guardarEdicion = async () => {
        if (!editando || editando.descripcion.trim().length < 5) return;
        const ok = await accion(() => axiosInstance.put(`/criterios/${editando.id}`, {
            descripcion: editando.descripcion,
            obligatorio: editando.obligatorio,
            requiere_evidencia: editando.requiere_evidencia,
            responsable_verificacion: editando.responsable_verificacion || null,
        }), 'Criterio actualizado.');
        if (ok) setEditando(null);
    };

    const eliminar = async (c) => {
        const { isConfirmed } = await Swal.fire({
            title: '¿Eliminar este criterio?',
            text: 'Dejará de contar para la aceptación. Su historial se conserva.',
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar',
        });
        if (isConfirmed) accion(() => axiosInstance.delete(`/criterios/${c.id}`), 'Criterio eliminado.');
    };

    const mover = (indice, delta) => {
        const ids = datos.criterios.map((c) => c.id);
        const destino = indice + delta;
        if (destino < 0 || destino >= ids.length) return;
        [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
        accion(() => axiosInstance.put(`/tareas/${task.id}/criterios/orden`, { orden: ids }), null);
    };

    // ─── Colaborador ────────────────────────────────────────────────────────

    const declarar = (c) => accion(
        () => axiosInstance.put(`/criterios/${c.id}/declarar`, { cumplido: !c.declarado_at }),
        null
    );

    const evidenciaEnlace = async (c) => {
        const { value, isConfirmed } = await Swal.fire({
            title: 'Enlace de evidencia',
            input: 'url',
            inputPlaceholder: 'https://…',
            showCancelButton: true,
            confirmButtonText: 'Añadir', cancelButtonText: 'Cancelar',
        });
        if (!isConfirmed || !value) return;
        accion(() => axiosInstance.post(`/criterios/${c.id}/evidencias`, {
            tipo: 'enlace', ruta: value, nombre: value,
        }), 'Evidencia añadida.');
    };

    const evidenciaArchivo = (c, archivo) => {
        if (!archivo) return;
        accion(async () => {
            const fd = new FormData();
            fd.append('evidencias[]', archivo);
            const subida = await axiosInstance.post('/subirEvidencias', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const ev = subida.data?.evidencias?.[0];
            if (!ev) throw new Error('No se pudo subir el archivo.');
            return axiosInstance.post(`/criterios/${c.id}/evidencias`, {
                tipo: 'archivo', ruta: ev.ruta, nombre: ev.nombre_original, mime: ev.tipo,
            });
        }, 'Evidencia añadida.');
    };

    const quitarEvidencia = (ev) => accion(() => axiosInstance.delete(`/criterios/evidencias/${ev.id}`), null);

    // ─── Verificación y aceptación ──────────────────────────────────────────

    const verificar = async (c, estado) => {
        let observacion = '';
        if (estado === 'No cumplido') {
            const { value, isConfirmed } = await Swal.fire({
                title: '¿Qué falta para cumplirlo?',
                input: 'textarea',
                inputPlaceholder: 'El responsable verá esta observación',
                showCancelButton: true,
                confirmButtonText: 'Marcar no cumplido', cancelButtonText: 'Cancelar',
                inputValidator: (v) => (!v || !v.trim()) ? 'Indica qué falta.' : undefined,
            });
            if (!isConfirmed) return;
            observacion = value;
        }
        accion(() => axiosInstance.put(`/criterios/${c.id}/verificar`, { estado, observacion }), null);
    };

    const aceptar = async () => {
        if (ocupado) return;
        const { isConfirmed } = await Swal.fire({
            title: '¿Aceptar la entrega?',
            text: 'La tarea quedará cerrada como Completada.',
            icon: 'question', showCancelButton: true,
            confirmButtonText: 'Aceptar entrega', cancelButtonText: 'Cancelar',
        });
        if (isConfirmed) accion(() => axiosInstance.put(`/tareas/${task.id}/aceptar`), 'Entrega aceptada.', true);
    };

    const devolver = async () => {
        if (ocupado) return;
        const { value, isConfirmed } = await Swal.fire({
            title: 'Devolver la entrega',
            input: 'textarea',
            inputPlaceholder: 'Qué hay que corregir',
            showCancelButton: true,
            confirmButtonText: 'Devolver', cancelButtonText: 'Cancelar',
            inputValidator: (v) => (!v || v.trim().length < 5) ? 'Explica la corrección (mínimo 5 caracteres).' : undefined,
        });
        if (isConfirmed) accion(() => axiosInstance.put(`/tareas/${task.id}/devolver`, { observacion: value }), 'Entrega devuelta.', true);
    };

    // ─── Render ─────────────────────────────────────────────────────────────

    if (error) return <div className="ca-caja"><p className="ca-vacio">No fue posible cargar los criterios de aceptación.</p></div>;
    if (!datos) return <div className="ca-caja"><p className="ca-vacio">Cargando criterios…</p></div>;

    const { criterios, resumen, permisos, aceptaciones } = datos;
    // El estado que manda es el que devolvió el servidor en la última carga.
    const estado = datos.estado_tarea || task.estado;
    const enRevision = estado === 'En Revisión';
    const cerrada = enRevision || estado === 'Completada';
    const puedeVerificar = (c) => enRevision && permisos.verificar.includes(c.id);
    const puedeDeclarar = permisos.declarar && !cerrada;
    // El líder gestiona todos; el responsable añade y cambia sólo los suyos.
    const puedeAnadir = permisos.gestionar || permisos.proponer;
    const puedeEditar = (c) => permisos.gestionar || (permisos.editar || []).includes(c.id);

    return (
        <section className="ca-caja">
            <button type="button" className="ca-cabecera" onClick={() => setAbierto((v) => !v)}>
                <span className="ca-titulo">Criterios de aceptación</span>
                <span className={`ca-general ${GENERAL_CLASE[resumen.estado_general] || ''}`}>
                    {resumen.estado_general}
                </span>
                {resumen.total > 0 && (
                    <span className="ca-cuenta">{resumen.cumplidos}/{resumen.total} cumplidos</span>
                )}
                <FaChevronDown className={`ca-flecha ${abierto ? 'es-abierta' : ''}`} />
            </button>

            {/* Indicador propio: distinto del avance del checklist, que mide
                la ejecución. Éste mide si el resultado cumple lo pactado. */}
            {resumen.total > 0 && (
                <div className="ca-barra" title={`${resumen.porcentaje}% de criterios cumplidos`}>
                    <span style={{ width: `${resumen.porcentaje}%` }} />
                </div>
            )}

            {abierto && (
                <div className="ca-cuerpo">
                    <div className="ca-cifras">
                        <span><b>{resumen.total}</b> definidos</span>
                        <span><b>{resumen.pendientes}</b> pendientes</span>
                        <span className="c-ok"><b>{resumen.cumplidos}</b> cumplidos</span>
                        <span className="c-mal"><b>{resumen.no_cumplidos}</b> no cumplidos</span>
                        {resumen.declarados > 0 && <span><b>{resumen.declarados}</b> declarados por el responsable</span>}
                    </div>

                    {criterios.length === 0 && (
                        <p className="ca-vacio">
                            Esta tarea no tiene criterios de aceptación.
                            {puedeAnadir ? ' Añade las condiciones que debe cumplir el resultado.' : ''}
                        </p>
                    )}

                    <ol className="ca-lista">
                        {criterios.map((c, i) => (
                            <li key={c.id} className={`ca-item ${ESTADO_CLASE[c.estado] || ''}`}>
                                {editando?.id === c.id ? (
                                    <div className="ca-editor">
                                        <textarea
                                            rows={2}
                                            value={editando.descripcion}
                                            onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })}
                                        />
                                        <Opciones valor={editando} onCambio={setEditando} personas={personas} />
                                        <div className="ca-botones">
                                            <button type="button" className="ca-btn ca-primario" disabled={ocupado} onClick={guardarEdicion}>Guardar</button>
                                            <button type="button" className="ca-btn" onClick={() => setEditando(null)}>Cancelar</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="ca-linea">
                                            <span className="ca-num">{i + 1}</span>
                                            <p className="ca-desc">{c.descripcion}</p>
                                            <span className={`ca-estado ${ESTADO_CLASE[c.estado]}`}>{c.estado}</span>
                                        </div>

                                        <div className="ca-meta">
                                            <span className={c.obligatorio ? 'm-oblig' : ''}>{c.obligatorio ? 'Obligatorio' : 'Opcional'}</span>
                                            {c.requiere_evidencia === 1 && <span>Requiere evidencia</span>}
                                            {c.responsable_nombre && <span>Verifica: {c.responsable_nombre}</span>}
                                            {!permisos.gestionar && puedeEditar(c) && <span className="m-propio">Lo escribiste tú</span>}
                                            {c.declarado_at && (
                                                <span className="m-declarado"><FaCheck /> Declarado por {c.declarado_nombre || 'el responsable'}</span>
                                            )}
                                            {c.fecha_verificacion && (
                                                <span>Verificado por {c.verificado_nombre} · {fecha(c.fecha_verificacion)}</span>
                                            )}
                                        </div>

                                        {c.observacion && <p className="ca-obs">{c.observacion}</p>}

                                        {c.evidencias.length > 0 && (
                                            <ul className="ca-evidencias">
                                                {c.evidencias.map((ev) => (
                                                    <li key={ev.id}>
                                                        <a
                                                            href={ev.tipo === 'archivo' ? getImageUrl(`storage/${ev.ruta}`) : ev.ruta}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            {ev.tipo === 'archivo' ? <FaFileUpload /> : <FaLink />} {ev.nombre || ev.ruta}
                                                        </a>
                                                        <span className="ca-ev-quien">{ev.subido_por}</span>
                                                        {estado !== 'Completada' && (permisos.gestionar || ev.subido_id === permisos.yo) && (
                                                            <button type="button" className="ca-mini" title="Quitar evidencia" onClick={() => quitarEvidencia(ev)}>
                                                                <FaTimes />
                                                            </button>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        <div className="ca-acciones">
                                            {puedeVerificar(c) && (
                                                <>
                                                    <button type="button" className="ca-btn ca-ok" disabled={ocupado} onClick={() => verificar(c, 'Cumplido')}>
                                                        <FaCheck /> Cumplido
                                                    </button>
                                                    <button type="button" className="ca-btn ca-no" disabled={ocupado} onClick={() => verificar(c, 'No cumplido')}>
                                                        <FaTimes /> No cumplido
                                                    </button>
                                                    {c.estado !== 'Pendiente' && (
                                                        <button type="button" className="ca-btn" disabled={ocupado} onClick={() => verificar(c, 'Pendiente')}>
                                                            Deshacer
                                                        </button>
                                                    )}
                                                </>
                                            )}

                                            {puedeDeclarar && (
                                                <button type="button" className={`ca-btn ${c.declarado_at ? 'ca-activo' : ''}`} disabled={ocupado} onClick={() => declarar(c)}>
                                                    {c.declarado_at ? 'Retirar declaración' : 'Declarar cumplido'}
                                                </button>
                                            )}

                                            {(puedeDeclarar || puedeVerificar(c)) && estado !== 'Completada' && (
                                                <>
                                                    <button type="button" className="ca-btn" disabled={ocupado} onClick={() => evidenciaEnlace(c)}>
                                                        <FaLink /> Enlace
                                                    </button>
                                                    <label className="ca-btn ca-archivo">
                                                        <FaFileUpload /> Archivo
                                                        <input
                                                            type="file"
                                                            disabled={ocupado}
                                                            onChange={(e) => { evidenciaArchivo(c, e.target.files?.[0]); e.target.value = ''; }}
                                                        />
                                                    </label>
                                                </>
                                            )}

                                            {puedeEditar(c) && (
                                                <span className="ca-gestion">
                                                    {permisos.gestionar && (
                                                        <>
                                                            <button type="button" className="ca-mini" title="Subir" disabled={ocupado || i === 0} onClick={() => mover(i, -1)}><FaArrowUp /></button>
                                                            <button type="button" className="ca-mini" title="Bajar" disabled={ocupado || i === criterios.length - 1} onClick={() => mover(i, 1)}><FaArrowDown /></button>
                                                        </>
                                                    )}
                                                    <button
                                                        type="button" className="ca-mini" title="Editar"
                                                        onClick={() => setEditando({
                                                            id: c.id, descripcion: c.descripcion, obligatorio: !!c.obligatorio,
                                                            requiere_evidencia: !!c.requiere_evidencia,
                                                            responsable_verificacion: c.responsable_verificacion || '',
                                                        })}
                                                    ><FaEdit /></button>
                                                    <button type="button" className="ca-mini ca-borrar" title="Eliminar" onClick={() => eliminar(c)}><FaTrash /></button>
                                                </span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </li>
                        ))}
                    </ol>

                    {puedeAnadir && (
                        <form className="ca-nuevo" onSubmit={agregar}>
                            <textarea
                                rows={2}
                                placeholder="Nueva condición que debe cumplir el resultado. Ej.: El sistema genera un identificador único"
                                value={nuevo.descripcion}
                                onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })}
                            />
                            <Opciones valor={nuevo} onCambio={setNuevo} personas={personas} />
                            <button type="submit" className="ca-btn ca-primario" disabled={ocupado}><FaPlus /> Añadir criterio</button>
                        </form>
                    )}

                    {!permisos.gestionar && cerrada && estado !== 'Completada' && criterios.length > 0 && (
                        <p className="ca-nota">La tarea está en revisión: sus criterios ya no se modifican.</p>
                    )}

                    {/* Aceptación final: una acción aparte. Marcar todos los
                        criterios no la provoca; la decide alguien autorizado. */}
                    {permisos.aceptar && enRevision && (
                        <div className="ca-aceptacion">
                            <h4>Aceptación de la entrega</h4>
                            {resumen.bloqueos.length > 0 ? (
                                <ul className="ca-bloqueos">
                                    {resumen.bloqueos.map((b) => <li key={b}>{b}</li>)}
                                </ul>
                            ) : criterios.length === 0 ? (
                                <p className="ca-nota">No tiene criterios de aceptación: decide con lo entregado.</p>
                            ) : (
                                <p className="ca-lista-ok">Todos los criterios obligatorios están cumplidos.</p>
                            )}
                            <div className="ca-botones">
                                <button
                                    type="button" className="ca-btn ca-ok ca-grande"
                                    disabled={ocupado || resumen.bloqueos.length > 0}
                                    onClick={aceptar}
                                >
                                    Aceptar entrega
                                </button>
                                <button type="button" className="ca-btn ca-no ca-grande" disabled={ocupado} onClick={devolver}>
                                    Devolver con observaciones
                                </button>
                            </div>
                        </div>
                    )}

                    {aceptaciones.length > 0 && (
                        <div className="ca-decisiones">
                            <h5>Decisiones</h5>
                            <ul>
                                {aceptaciones.map((a) => (
                                    <li key={a.id} className={a.resultado === 'Aceptada' ? 'd-ok' : 'd-no'}>
                                        <b>{a.resultado}</b> por {a.usuario || '—'} · {fecha(a.cuando)}
                                        {a.observacion && <span> — {a.observacion}</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <button type="button" className="ca-historial-btn" onClick={() => verHistorial()}>
                        <FaHistory /> {historial ? 'Ocultar historial' : 'Ver historial'}
                    </button>

                    {historial && (
                        <ul className="ca-historial">
                            {historial.length === 0 && <li>Sin movimientos.</li>}
                            {historial.map((h) => (
                                <li key={h.id}>
                                    <span className="h-cuando">{fecha(h.cuando)}</span>
                                    <span><b>{h.usuario || 'Sistema'}</b> {EVENTOS[h.evento] || h.evento}
                                        {h.antes?.estado && h.despues?.estado && ` (${h.antes.estado} → ${h.despues.estado})`}
                                        {h.observacion && <em> — {h.observacion}</em>}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </section>
    );
}

/** Obligatorio, evidencia y responsable: comunes al alta y a la edición. */
function Opciones({ valor, onCambio, personas }) {
    return (
        <div className="ca-opciones">
            <label>
                <input type="checkbox" checked={!!valor.obligatorio} onChange={(e) => onCambio({ ...valor, obligatorio: e.target.checked })} />
                Obligatorio
            </label>
            <label>
                <input type="checkbox" checked={!!valor.requiere_evidencia} onChange={(e) => onCambio({ ...valor, requiere_evidencia: e.target.checked })} />
                Requiere evidencia
            </label>
            {personas.length > 0 && (
                <select
                    value={valor.responsable_verificacion || ''}
                    onChange={(e) => onCambio({ ...valor, responsable_verificacion: e.target.value })}
                    title="Quién verifica este criterio, además del líder"
                >
                    <option value="">Verifica: el líder</option>
                    {personas.map((p) => <option key={p.id} value={p.id}>Verifica: {p.nombre}</option>)}
                </select>
            )}
        </div>
    );
}
