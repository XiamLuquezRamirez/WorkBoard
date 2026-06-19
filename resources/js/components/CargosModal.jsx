import React, { useState, useEffect, useCallback } from 'react';
import { FaTimes, FaPlus, FaEdit, FaTrash, FaSave, FaArrowLeft, FaBriefcase } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';
import Swal from 'sweetalert2';
import Paginador from './Paginador';

const estadoBadge = (estado) => {
    const activo = estado === 'Activo' || estado == null;
    return (
        <span className={`dm-badge ${activo ? 'dm-badge--activo' : 'dm-badge--inactivo'}`}>
            {activo ? 'Activo' : 'Inactivo'}
        </span>
    );
};

const CargosModal = ({ isOpen, onClose }) => {
    const [view, setView] = useState('list');
    const [cargos, setCargos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const [form, setForm] = useState({ nombre: '', estado: 'Activo' });
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [pagina, setPagina] = useState(1);
    const POR_PAGINA = 5;

    const cargarCargos = useCallback(() => {
        setLoading(true);
        axiosInstance.get('/parametros/cargos')
            .then(r => setCargos(Array.isArray(r.data) ? r.data : []))
            .catch(() => Swal.fire('Error', 'No se pudieron cargar los cargos', 'error'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (isOpen) cargarCargos();
    }, [isOpen, cargarCargos]);

    const abrirCrear = () => {
        setForm({ nombre: '', estado: 'Activo' });
        setFormError('');
        setSelected(null);
        setView('form');
    };

    const abrirEditar = (cargo) => {
        setForm({ nombre: cargo.nombre, estado: cargo.estado || 'Activo' });
        setFormError('');
        setSelected(cargo);
        setView('form');
    };

    const volverLista = () => {
        setView('list');
        setSelected(null);
    };

    const handleGuardar = () => {
        if (!form.nombre.trim()) { setFormError('El nombre es obligatorio'); return; }
        setSaving(true);
        const req = selected
            ? axiosInstance.put(`/parametros/cargos/${selected.id}`, form)
            : axiosInstance.post('/parametros/cargos', form);

        req.then(() => {
            Swal.fire({ icon: 'success', title: selected ? 'Cargo actualizado' : 'Cargo creado', timer: 1400, showConfirmButton: false });
            cargarCargos();
            volverLista();
        })
        .catch(err => {
            const msg = err.response?.data?.message || 'Error al guardar';
            Swal.fire('Error', msg, 'error');
        })
        .finally(() => setSaving(false));
    };

    const handleEliminar = (cargo) => {
        Swal.fire({
            title: `¿Eliminar "${cargo.nombre}"?`,
            text: 'Esta acción no se puede deshacer.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Eliminar',
        }).then(res => {
            if (!res.isConfirmed) return;
            axiosInstance.delete(`/parametros/cargos/${cargo.id}`)
                .then(() => {
                    Swal.fire({ icon: 'success', title: 'Cargo eliminado', timer: 1400, showConfirmButton: false });
                    cargarCargos();
                })
                .catch(err => {
                    const msg = err.response?.data?.message || 'No se puede eliminar';
                    Swal.fire('No se puede eliminar', msg, 'warning');
                });
        });
    };

    const cargosFiltrados = cargos.filter(c =>
        c.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );
    const totalPaginas = Math.max(1, Math.ceil(cargosFiltrados.length / POR_PAGINA));
    const paginaActual = Math.min(pagina, totalPaginas);
    const cargosPagina = cargosFiltrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal-report dm-modal">

                {/* Header */}
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {view !== 'list' && (
                            <button className="rdm-back-btn" onClick={volverLista}>
                                <FaArrowLeft /> Cargos
                            </button>
                        )}
                        <h2 style={{ margin: 0 }}>
                            {view === 'list' && <><FaBriefcase style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />Gestión de Cargos</>}
                            {view === 'form' && (selected ? `Editar: ${selected.nombre}` : 'Nuevo Cargo')}
                        </h2>
                    </div>
                    <button className="close-button" onClick={onClose}><FaTimes /></button>
                </div>

                {/* ── Vista lista ── */}
                {view === 'list' && (
                    <div className="dm-body">
                        <div className="dm-toolbar">
                            <input
                                type="text"
                                className="dm-search"
                                placeholder="Buscar cargo…"
                                value={busqueda}
                                onChange={e => { setBusqueda(e.target.value); setPagina(1); }}
                            />
                            <button className="dm-btn dm-btn--primary" onClick={abrirCrear}>
                                <FaPlus /> Nuevo Cargo
                            </button>
                        </div>

                        {loading ? (
                            <div className="dm-empty">Cargando…</div>
                        ) : cargosFiltrados.length === 0 ? (
                            <div className="dm-empty">No hay cargos{busqueda ? ' que coincidan' : ' registrados'}.</div>
                        ) : (
                            <div className="dm-table-wrap">
                                <table className="dm-table">
                                    <thead>
                                        <tr>
                                            <th>Nombre</th>
                                            <th style={{ textAlign: 'center' }}>Empleados</th>
                                            <th style={{ textAlign: 'center' }}>Estado</th>
                                            <th style={{ textAlign: 'center' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cargosPagina.map(cargo => (
                                            <tr key={cargo.id} className={cargo.estado === 'Inactivo' ? 'dm-row--inactivo' : ''}>
                                                <td className="dm-td-nombre">{cargo.nombre}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className="dm-count-badge">{cargo.total_empleados || 0}</span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>{estadoBadge(cargo.estado)}</td>
                                                <td>
                                                    <div className="dm-actions">
                                                        <button className="dm-action-btn dm-action-btn--edit" title="Editar" onClick={() => abrirEditar(cargo)}>
                                                            <FaEdit />
                                                        </button>
                                                        <button className="dm-action-btn dm-action-btn--delete" title="Eliminar" onClick={() => handleEliminar(cargo)}>
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

                        {!loading && cargosFiltrados.length > 0 && (
                            <Paginador
                                currentPage={paginaActual}
                                totalPages={totalPaginas}
                                onPageChange={setPagina}
                            />
                        )}
                    </div>
                )}

                {/* ── Vista formulario ── */}
                {view === 'form' && (
                    <div className="dm-body">
                        <div className="dm-form">
                            <div className="dm-form-group">
                                <label className="dm-label">Nombre del cargo <span className="dm-required">*</span></label>
                                <input
                                    type="text"
                                    className={`dm-input ${formError ? 'dm-input--error' : ''}`}
                                    value={form.nombre}
                                    onChange={e => { setForm(f => ({ ...f, nombre: e.target.value })); setFormError(''); }}
                                    placeholder="Ej: DESARROLLADOR DE SOFTWARE"
                                    autoFocus
                                />
                                {formError && <span className="dm-form-error">{formError}</span>}
                            </div>

                            <div className="dm-form-group">
                                <label className="dm-label">Estado</label>
                                <select
                                    className="dm-input"
                                    value={form.estado}
                                    onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                                >
                                    <option value="Activo">Activo</option>
                                    <option value="Inactivo">Inactivo</option>
                                </select>
                            </div>

                            <div className="dm-form-actions">
                                <button className="dm-btn dm-btn--secondary" onClick={volverLista} disabled={saving}>
                                    Cancelar
                                </button>
                                <button className="dm-btn dm-btn--primary" onClick={handleGuardar} disabled={saving}>
                                    <FaSave /> {saving ? 'Guardando…' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default CargosModal;
