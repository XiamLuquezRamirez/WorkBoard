import React, { useEffect, useState } from 'react';
import { FaTimes, FaTrash, FaPen, FaPlus } from 'react-icons/fa';
import Swal from 'sweetalert2';
import axiosInstance from '../axiosConfig';

const VACIO = { id: null, titulo: '', url: '', orden: 0, estado: 'Activo' };

/**
 * Gestión de los vídeos ambientales del Tablero de Seguimiento.
 *
 * La lista se administra aquí y no en el propio TV: delante de una pantalla
 * proyectada nadie escribe una URL, así que el tablero se limita a reproducir
 * lo que se haya configurado desde el sistema.
 */
const VideosTableroModal = ({ onClose }) => {
    const [videos, setVideos] = useState([]);
    const [form, setForm] = useState(VACIO);
    const [loading, setLoading] = useState(true);
    const [guardando, setGuardando] = useState(false);

    const cargar = () => {
        setLoading(true);
        axiosInstance.get('/tablero/videos?todos=1')
            .then((r) => setVideos(r.data))
            .catch(() => setVideos([]))
            .finally(() => setLoading(false));
    };

    useEffect(cargar, []);

    const guardar = (e) => {
        e.preventDefault();
        if (!form.titulo.trim() || !form.url.trim()) {
            Swal.fire('Error', 'Indica un nombre y un enlace de YouTube.', 'error');
            return;
        }
        setGuardando(true);
        axiosInstance.post('/tablero/videos', form)
            .then((r) => {
                setForm(VACIO);
                cargar();
                Swal.fire('¡Listo!', r.data.message, 'success');
            })
            .catch((err) => {
                Swal.fire('Error', err?.response?.data?.message || 'No fue posible guardar el vídeo.', 'error');
            })
            .finally(() => setGuardando(false));
    };

    const editar = (v) => {
        // Se reconstruye el enlace a partir del id guardado: es lo que el
        // formulario espera y evita tener que almacenar la URL original.
        setForm({
            id: v.id,
            titulo: v.titulo,
            url: `https://youtu.be/${v.video_id}`,
            orden: v.orden,
            estado: v.estado,
        });
    };

    const alternarEstado = (v) => {
        axiosInstance.post('/tablero/videos', {
            id: v.id,
            titulo: v.titulo,
            url: `https://youtu.be/${v.video_id}`,
            orden: v.orden,
            estado: v.estado === 'Activo' ? 'Inactivo' : 'Activo',
        }).then(cargar);
    };

    const eliminar = (v) => {
        Swal.fire({
            title: '¿Eliminar el vídeo?',
            text: v.titulo,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar',
        }).then((res) => {
            if (!res.isConfirmed) return;
            axiosInstance.delete(`/tablero/videos/${v.id}`)
                .then(() => { cargar(); Swal.fire('Eliminado', '', 'success'); });
        });
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && onClose()}>
            <div className="notification-modal" style={{ maxWidth: 720 }}>
                <div className="modal-header">
                    <h2>Vídeos del Tablero</h2>
                    <button className="close-button" onClick={onClose}><FaTimes /></button>
                </div>

                <div style={{ padding: '14px 18px' }}>
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>
                        Estos vídeos se reproducen en el panel ambiental del Tablero de
                        Seguimiento. Sólo se admiten enlaces de YouTube.
                    </p>

                    <form onSubmit={guardar} className="tbv-form">
                        <input
                            type="text"
                            placeholder="Nombre (ej. Música de fondo)"
                            value={form.titulo}
                            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="Enlace de YouTube"
                            value={form.url}
                            onChange={(e) => setForm({ ...form, url: e.target.value })}
                        />
                        <input
                            type="number"
                            placeholder="Orden"
                            style={{ maxWidth: 90 }}
                            value={form.orden}
                            onChange={(e) => setForm({ ...form, orden: e.target.value })}
                        />
                        <button type="submit" className="tbv-btn-ok" disabled={guardando}>
                            <FaPlus /> {form.id ? 'Actualizar' : 'Agregar'}
                        </button>
                        {form.id && (
                            <button type="button" className="tbv-btn" onClick={() => setForm(VACIO)}>
                                Cancelar
                            </button>
                        )}
                    </form>

                    {loading ? (
                        <p style={{ textAlign: 'center', color: '#64748b' }}>Cargando…</p>
                    ) : (
                        <table className="tbv-tabla">
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }}>Orden</th>
                                    <th>Nombre</th>
                                    <th style={{ width: 130 }}>Vídeo</th>
                                    <th style={{ width: 90 }}>Estado</th>
                                    <th style={{ width: 90 }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {videos.map((v) => (
                                    <tr key={v.id}>
                                        <td>{v.orden}</td>
                                        <td>{v.titulo}</td>
                                        <td>
                                            <a
                                                href={`https://youtu.be/${v.video_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {v.video_id}
                                            </a>
                                        </td>
                                        <td>
                                            <button
                                                className={`tbv-estado ${v.estado === 'Activo' ? 'es-activo' : ''}`}
                                                onClick={() => alternarEstado(v)}
                                                title="Cambiar estado"
                                            >
                                                {v.estado}
                                            </button>
                                        </td>
                                        <td>
                                            <button className="tbv-icono" onClick={() => editar(v)} title="Editar">
                                                <FaPen />
                                            </button>
                                            <button className="tbv-icono tbv-borrar" onClick={() => eliminar(v)} title="Eliminar">
                                                <FaTrash />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {videos.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', color: '#64748b', padding: 18 }}>
                                            Aún no hay vídeos configurados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideosTableroModal;
