import React, { useState, useEffect, useCallback } from 'react';
import {
    FaTimes, FaPlus, FaEdit, FaTrash, FaUsers,
    FaArrowLeft, FaSave, FaUserTie, FaToggleOn,
    FaToggleOff, FaBuilding, FaCheck, FaBan,
} from 'react-icons/fa';
import axiosInstance from '../axiosConfig';
import Swal from 'sweetalert2';

// ── helpers ────────────────────────────────────────────────────────────────

const estadoBadge = (estado) => {
    const activo = estado === 'Activo' || estado == null;
    return (
        <span className={`dm-badge ${activo ? 'dm-badge--activo' : 'dm-badge--inactivo'}`}>
            {activo ? 'Activo' : 'Inactivo'}
        </span>
    );
};

const Avatar = ({ src, nombre }) => {
    if (src) return <img src={src} alt={nombre} className="dm-avatar" />;
    const initials = (nombre || '?').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
    return <div className="dm-avatar dm-avatar--initials">{initials}</div>;
};

// ── main component ─────────────────────────────────────────────────────────

const DepartmentModal = ({ isOpen, onClose }) => {
    // vista: 'list' | 'form' | 'detail'
    const [view, setView] = useState('list');
    const [departamentos, setDepartamentos] = useState([]);
    const [loading, setLoading] = useState(false);

    // todos los empleados disponibles para asignar como líder
    const [lideresDisponibles, setLideresDisponibles] = useState([]);

    // departamento actualmente seleccionado (para detail / form)
    const [selected, setSelected] = useState(null);

    // estado del formulario create/edit
    const [form, setForm] = useState({ nombre: '', estado: 'Activo' });
    const [formError, setFormError] = useState('');
    const [savingForm, setSavingForm] = useState(false);

    // estado del panel de detalle
    const [empleadosDept, setEmpleadosDept] = useState([]);
    const [loadingEmpleados, setLoadingEmpleados] = useState(false);
    const [liderSelId, setLiderSelId] = useState('');
    const [savingLider, setSavingLider] = useState(false);
    const [togglingId, setTogglingId] = useState(null);

    // filtro de búsqueda en la lista
    const [busqueda, setBusqueda] = useState('');

    // ── data loaders ───────────────────────────────────────────────────────

    const cargarDepartamentos = useCallback(() => {
        setLoading(true);
        axiosInstance.get('/parametros/departamentos')
            .then(r => setDepartamentos(r.data))
            .catch(() => Swal.fire('Error', 'No se pudieron cargar los departamentos', 'error'))
            .finally(() => setLoading(false));
    }, []);

    const cargarLideres = useCallback(() => {
        axiosInstance.post('/cargarEmpleados')
            .then(r => setLideresDisponibles(r.data))
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (isOpen) {
            cargarDepartamentos();
            cargarLideres();
        }
    }, [isOpen, cargarDepartamentos, cargarLideres]);

    const cargarEmpleadosDept = (deptId) => {
        setLoadingEmpleados(true);
        axiosInstance.get(`/parametros/departamentos/${deptId}/empleados`)
            .then(r => setEmpleadosDept(r.data))
            .catch(() => Swal.fire('Error', 'No se pudieron cargar los empleados', 'error'))
            .finally(() => setLoadingEmpleados(false));
    };

    // ── navegación ─────────────────────────────────────────────────────────

    const abrirCrear = () => {
        setForm({ nombre: '', estado: 'Activo' });
        setFormError('');
        setSelected(null);
        setView('form');
    };

    const abrirEditar = (dept) => {
        setForm({ nombre: dept.nombre, estado: dept.estado || 'Activo' });
        setFormError('');
        setSelected(dept);
        setView('form');
    };

    const abrirDetalle = (dept) => {
        setSelected(dept);
        setLiderSelId(dept.lider_id || '');
        setEmpleadosDept([]);
        cargarEmpleadosDept(dept.id);
        setView('detail');
    };

    const volverLista = () => {
        setView('list');
        setSelected(null);
    };

    // ── CRUD ───────────────────────────────────────────────────────────────

    const handleGuardarForm = () => {
        if (!form.nombre.trim()) { setFormError('El nombre es obligatorio'); return; }
        setSavingForm(true);
        const req = selected
            ? axiosInstance.put(`/parametros/departamentos/${selected.id}`, form)
            : axiosInstance.post('/parametros/departamentos', form);

        req.then(() => {
            Swal.fire({ icon: 'success', title: selected ? 'Departamento actualizado' : 'Departamento creado', timer: 1500, showConfirmButton: false });
            cargarDepartamentos();
            volverLista();
        })
        .catch(err => {
            const msg = err.response?.data?.message || 'Error al guardar';
            Swal.fire('Error', msg, 'error');
        })
        .finally(() => setSavingForm(false));
    };

    const handleEliminar = (dept) => {
        Swal.fire({
            title: `¿Eliminar "${dept.nombre}"?`,
            text: 'Esta acción no se puede deshacer.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Eliminar',
        }).then(res => {
            if (!res.isConfirmed) return;
            axiosInstance.delete(`/parametros/departamentos/${dept.id}`)
                .then(() => {
                    Swal.fire({ icon: 'success', title: 'Departamento eliminado', timer: 1400, showConfirmButton: false });
                    cargarDepartamentos();
                })
                .catch(err => {
                    const msg = err.response?.data?.message || 'Error al eliminar';
                    Swal.fire('No se puede eliminar', msg, 'warning');
                });
        });
    };

    const handleToggleEstado = (dept) => {
        const nuevo = dept.estado === 'Activo' ? 'Inactivo' : 'Activo';
        axiosInstance.put(`/parametros/departamentos/${dept.id}`, { nombre: dept.nombre, estado: nuevo })
            .then(() => cargarDepartamentos())
            .catch(() => Swal.fire('Error', 'No se pudo cambiar el estado', 'error'));
    };

    // ── líder del departamento ─────────────────────────────────────────────

    const handleGuardarLider = () => {
        setSavingLider(true);
        axiosInstance.post(`/parametros/departamentos/${selected.id}/lider`, { lider_id: liderSelId || null })
            .then(() => {
                Swal.fire({ icon: 'success', title: 'Líder asignado', timer: 1400, showConfirmButton: false });
                cargarDepartamentos();
                // actualizar selected en memoria
                setSelected(prev => ({ ...prev, lider_id: liderSelId || null }));
            })
            .catch(() => Swal.fire('Error', 'No se pudo asignar el líder', 'error'))
            .finally(() => setSavingLider(false));
    };

    // ── independencia ──────────────────────────────────────────────────────

    const handleToggleIndependencia = (emp) => {
        if (!emp.user_id) {
            Swal.fire('Sin usuario', 'Este empleado no tiene usuario del sistema asignado.', 'info');
            return;
        }
        setTogglingId(emp.user_id);
        axiosInstance.post(`/parametros/usuarios/${emp.user_id}/independencia`)
            .then(r => {
                setEmpleadosDept(prev => prev.map(e =>
                    e.user_id === emp.user_id ? { ...e, independencia: r.data.independencia } : e
                ));
            })
            .catch(() => Swal.fire('Error', 'No se pudo cambiar la independencia', 'error'))
            .finally(() => setTogglingId(null));
    };

    // ── filtrado de lista ──────────────────────────────────────────────────

    const departamentosFiltrados = departamentos.filter(d =>
        d.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );

    if (!isOpen) return null;

    // ══ RENDER ═════════════════════════════════════════════════════════════
    
    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal-report dm-modal">

                {/* ── Header ── */}
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {view !== 'list' && (
                            <button className="rdm-back-btn" onClick={volverLista}>
                                <FaArrowLeft /> Departamentos
                            </button>
                        )}
                        <h2 style={{ margin: 0 }}>
                            {view === 'list' && 'Gestión de Departamentos'}
                            {view === 'form' && (selected ? `Editar: ${selected.nombre}` : 'Nuevo Departamento')}
                            {view === 'detail' && selected?.nombre}
                        </h2>
                    </div>
                    <button className="close-button" onClick={onClose}><FaTimes /></button>
                </div>

                {/* ══ VISTA: LISTA ══ */}
                {view === 'list' && (
                    <div className="dm-body">
                        {/* toolbar */}
                        <div className="dm-toolbar">
                            <input
                                className="dm-search"
                                type="text"
                                placeholder="Buscar departamento…"
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                            />
                            <button className="dm-btn dm-btn--primary" onClick={abrirCrear}>
                                <FaPlus /> Nuevo Departamento
                            </button>
                        </div>

                        {loading ? (
                            <div className="dm-empty">Cargando…</div>
                        ) : departamentosFiltrados.length === 0 ? (
                            <div className="dm-empty">No hay departamentos{busqueda ? ' que coincidan' : ''}.</div>
                        ) : (
                            <div className="dm-table-wrap">
                                <table className="dm-table">
                                    <thead>
                                        <tr>
                                            <th>Departamento</th>
                                            <th>Estado</th>
                                            <th>Líder asignado</th>
                                            <th style={{ textAlign: 'center' }}>Empleados</th>
                                            <th style={{ textAlign: 'center' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {departamentosFiltrados.map(dept => (
                                            <tr key={dept.id} className={dept.estado === 'Inactivo' ? 'dm-row--inactivo' : ''}>
                                                <td>
                                                    <div className="dm-dept-name">
                                                        <FaBuilding className="dm-dept-icon" />
                                                        {dept.nombre}
                                                    </div>
                                                </td>
                                                <td>{estadoBadge(dept.estado)}</td>
                                                <td>
                                                    {dept.lider_nombre
                                                        ? <span className="dm-lider-chip"><FaUserTie /> {dept.lider_nombre}</span>
                                                        : <span className="dm-sin-lider">Sin líder</span>}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className="dm-emp-count">{dept.total_empleados}</span>
                                                </td>
                                                <td>
                                                    <div className="dm-actions">
                                                        <button
                                                            className="dm-action-btn dm-action-btn--view"
                                                            title="Ver detalle / empleados"
                                                            onClick={() => abrirDetalle(dept)}
                                                        >
                                                            <FaUsers />
                                                        </button>
                                                        <button
                                                            className="dm-action-btn dm-action-btn--edit"
                                                            title="Editar"
                                                            onClick={() => abrirEditar(dept)}
                                                        >
                                                            <FaEdit />
                                                        </button>
                                                        <button
                                                            className={`dm-action-btn ${dept.estado === 'Activo' ? 'dm-action-btn--toggle-off' : 'dm-action-btn--toggle-on'}`}
                                                            title={dept.estado === 'Activo' ? 'Desactivar' : 'Activar'}
                                                            onClick={() => handleToggleEstado(dept)}
                                                        >
                                                            {dept.estado === 'Activo' ? <FaBan /> : <FaCheck />}
                                                        </button>
                                                        <button
                                                            className="dm-action-btn dm-action-btn--delete"
                                                            title="Eliminar"
                                                            onClick={() => handleEliminar(dept)}
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ══ VISTA: FORMULARIO ══ */}
                {view === 'form' && (
                    <div className="dm-body">
                        <div className="dm-form">
                            <div className="dm-form-group">
                                <label className="dm-label">Nombre del departamento <span className="dm-required">*</span></label>
                                <input
                                    className={`dm-input ${formError ? 'dm-input--error' : ''}`}
                                    type="text"
                                    value={form.nombre}
                                    onChange={e => { setForm(p => ({ ...p, nombre: e.target.value })); setFormError(''); }}
                                    placeholder="Ej: Departamento de Sistemas"
                                    autoFocus
                                    onKeyDown={e => e.key === 'Enter' && handleGuardarForm()}
                                />
                                {formError && <span className="dm-form-error">{formError}</span>}
                            </div>

                            {selected && (
                                <div className="dm-form-group">
                                    <label className="dm-label">Estado</label>
                                    <select
                                        className="dm-input"
                                        value={form.estado}
                                        onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}
                                    >
                                        <option value="Activo">Activo</option>
                                        <option value="Inactivo">Inactivo</option>
                                    </select>
                                </div>
                            )}

                            <div className="dm-form-actions">
                                <button className="dm-btn dm-btn--secondary" onClick={volverLista}>
                                    <FaTimes /> Cancelar
                                </button>
                                <button
                                    className="dm-btn dm-btn--primary"
                                    onClick={handleGuardarForm}
                                    disabled={savingForm}
                                >
                                    <FaSave /> {savingForm ? 'Guardando…' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══ VISTA: DETALLE ══ */}
                {view === 'detail' && selected && (
                    <div className="dm-body dm-detail">

                        {/* ── Sección: Asignar líder ── */}
                        <section className="dm-section">
                            <h3 className="dm-section-title"><FaUserTie /> Líder de Área</h3>
                            <div className="dm-lider-row">
                                <select
                                    className="dm-input dm-lider-select"
                                    value={liderSelId}
                                    onChange={e => setLiderSelId(e.target.value)}
                                >
                                    <option value="">— Sin líder —</option>
                                    {lideresDisponibles.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.nombres} {emp.apellidos}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    className="dm-btn dm-btn--primary"
                                    onClick={handleGuardarLider}
                                    disabled={savingLider}
                                >
                                    <FaSave /> {savingLider ? 'Guardando…' : 'Asignar líder'}
                                </button>
                            </div>
                            {selected.lider_nombre && (
                                <p className="dm-lider-actual">
                                    Líder actual: <strong>{selected.lider_nombre}</strong>
                                    {selected.lider_independencia === 'Si' && (
                                        <span className="dm-indep-badge dm-indep-badge--on">Independencia activa</span>
                                    )}
                                </p>
                            )}
                        </section>

                        {/* ── Sección: Empleados ── */}
                        <section className="dm-section">
                            <h3 className="dm-section-title">
                                <FaUsers /> Empleados del departamento
                                <span className="dm-count-chip">{empleadosDept.length}</span>
                            </h3>

                            {loadingEmpleados ? (
                                <div className="dm-empty">Cargando empleados…</div>
                            ) : empleadosDept.length === 0 ? (
                                <div className="dm-empty">No hay empleados activos en este departamento.</div>
                            ) : (
                                <div className="dm-emp-list">
                                    {empleadosDept.map(emp => {
                                        const esLider = emp.lider === 'Si' || emp.user_lider === 'Si';
                                        const indActiva = emp.independencia === 'Si';
                                        const toggling = togglingId === emp.user_id;

                                        return (
                                            <div key={emp.id} className={`dm-emp-card ${esLider ? 'dm-emp-card--lider' : ''}`}>
                                                <Avatar src={emp.foto} nombre={`${emp.nombres} ${emp.apellidos}`} />
                                                <div className="dm-emp-info">
                                                    <p className="dm-emp-nombre">
                                                        {emp.nombres} {emp.apellidos}
                                                        {esLider && <span className="dm-lider-tag">Líder</span>}
                                                    </p>
                                                    <p className="dm-emp-cargo">{emp.nombre_cargo || '—'}</p>
                                                    <p className="dm-emp-email">{emp.email}</p>
                                                </div>

                                                {/* Independencia: solo para líderes */}
                                                {esLider && (
                                                    <div className="dm-indep-wrap">
                                                        <span className="dm-indep-label">Independencia</span>
                                                        <button
                                                            className={`dm-toggle-btn ${indActiva ? 'dm-toggle-btn--on' : 'dm-toggle-btn--off'}`}
                                                            title={indActiva ? 'Desactivar independencia' : 'Activar independencia'}
                                                            onClick={() => handleToggleIndependencia(emp)}
                                                            disabled={toggling}
                                                        >
                                                            {indActiva
                                                                ? <><FaToggleOn className="dm-toggle-icon" /> Activa</>
                                                                : <><FaToggleOff className="dm-toggle-icon" /> Inactiva</>}
                                                        </button>
                                                        <p className="dm-indep-hint">
                                                            {indActiva
                                                                ? 'El líder puede gestionar tareas de forma autónoma'
                                                                : 'Requiere supervisión del administrador'}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DepartmentModal;
