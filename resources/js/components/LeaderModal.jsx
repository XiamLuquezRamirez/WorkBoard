import React, { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaUsers, FaSave, FaTimes } from 'react-icons/fa';
import axiosInstance from '../axiosConfig';
import Swal from 'sweetalert2';


const LeaderModal = ({ isOpen, onClose }) => {
    const [lideres, setLideres] = useState([]);
    const [empleados, setEmpleados] = useState([]);
    const [showAsignarModal, setShowAsignarModal] = useState(false);
    const [empleadosACargo, setEmpleadosACargo] = useState([]);
    const [liderSeleccionado, setLiderSeleccionado] = useState(null);
    const [loading, setLoading] = useState(false);
    const [busqueda, setBusqueda] = useState('');

    useEffect(() => {
        cargarLideres();
        cargarEmpleados();
    }, []);

    const addEmpleados = (empleado) => {

        // Verificar si el empleado ya esta guardado en la lista de un lider a cargo, verificar en la bd

        axiosInstance.get(`/verificarEmpleadoLider/${empleado.id}`)
            .then((response) => {
                if (response.data.existe) {
                    Swal.fire('Error', 'El empleado ya esta asignado a un lider', 'error');
                } else {
                    setEmpleadosACargo([...empleadosACargo, empleado]);
                }
            });
        
    };

    const cargarLideres = () => {
        axiosInstance.get('/cargarLideres')
            .then((response) => {
                setLideres(response.data);
            })
            .catch((error) => {
                console.error('Error al cargar líderes:', error);
            });
    };



    const cargarEmpleados = () => {
        axiosInstance.post('/cargarEmpleados')
            .then((response) => {
                setEmpleados(response.data);
            })
            .catch((error) => {
                console.error('Error al cargar empleados:', error);
            });
    };

    const handleAsignarEmpleados = (lider) => {
        setLiderSeleccionado(lider);
        // Cargar empleados a cargo del líder
        axiosInstance.get(`/cargarEmpleadosLider/${lider.id}`)
            .then((response) => {
                setEmpleadosACargo(response.data);
                setShowAsignarModal(true);
            })
            .catch((error) => {
                console.error('Error al cargar empleados del líder:', error);
            });
    };

    const handleGuardarAsignaciones = () => {

        if (empleadosACargo.length === 0) {
            Swal.fire({
                title: 'Error',
                text: 'No hay empleados asignados',
                icon: 'error',
                confirmButtonText: 'OK'
            });
            return;
        }

        const data = {
            lider_id: liderSeleccionado.id,
            empleados: empleadosACargo
        };

        axiosInstance.post('/guardarAsignacionesLider', data)
            .then((response) => {
                Swal.fire({
                    title: 'Asignaciones guardadas',
                    icon: 'success',
                    confirmButtonText: 'OK'
                });
                setShowAsignarModal(false);
                cargarLideres();
            })
            .catch((error) => {
                console.error('Error al guardar asignaciones:', error);
                Swal.fire({
                    title: 'Error',
                    text: 'Hubo un error al guardar las asignaciones',
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            });
    };

    const handleBusqueda = (e) => {
        setBusqueda(e.target.value);
        const busqueda = e.target.value;
        if (busqueda.length > 0) {
            const empleadosFiltrados = empleados.filter(empleado => 
                empleado.nombres.toLowerCase().includes(busqueda.toLowerCase())
            );
            setEmpleados(empleadosFiltrados);
        } else {
            cargarEmpleados();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-leader" >
                <div className="modal-header">
                    <h2>Gestión de Líderes</h2>
                    <button className="close-button" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>

                {/* Contenido */}
                <div className="modal-content">
                    {loading ? (
                        <div className="loader"><div className="jimu-primary-loading" /></div>
                    ) : lideres.length === 0 ? (
                        <div className="no-data-message"><p>No hay líderes disponibles</p></div>
                    ) : (
                        <table className="employee-table" style={{
                            width: '100%',
                            tableLayout: 'fixed',
                            borderCollapse: 'collapse'
                        }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '8%' }}>Foto</th>
                                    <th style={{ width: '20%' }}>Nombre</th>
                                    <th style={{ width: '15%' }}>Cargo</th>
                                    <th style={{ width: '15%' }}>Departamento</th>
                                    <th style={{ width: '15%' }}>Empresa</th>
                                    <th style={{ width: '15%' }}>Empleados a cargo</th>
                                    <th style={{ width: '12%' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lideres.map(lider => (
                                    <tr key={lider.id}>
                                        <td>
                                            <img
                                                src={lider.foto}
                                                alt={lider.nombre}
                                                className="employee-mini-photo"
                                            />
                                        </td>
                                        <td>{lider.nombres} {lider.apellidos}</td>
                                        <td>{lider.nombre_cargo}</td>
                                        <td>{lider.nombre_departamento}</td>
                                        <td>{lider.nombre_empresa}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{lider.empleados_asignados || 0}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    title="Asignar empleados"
                                                    onClick={() => handleAsignarEmpleados(lider)}
                                                    className="edit-button"
                                                >
                                                    <FaUsers />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {showAsignarModal && (
                <div className="modal-overlay">
                    <div className="asignar-modal">
                        <div className="modal-header">
                            <h2>Asignar Empleados a {liderSeleccionado?.nombres} {liderSeleccionado?.apellidos}</h2>
                            <button
                                className="close-button"
                                onClick={() => setShowAsignarModal(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="modal-content">
                            <div className="empleados-disponibles">
                                <div className="empleados-header">
                                    <h3>Empleados Disponibles</h3>
                                    {/* Buscador de empleados */}
                                    <input
                                        type="text"
                                        placeholder="Buscar empleado"
                                        className="search-input-empleados"
                                        onChange={handleBusqueda}
                                        onKeyDown={handleBusqueda}
                                    />
                                   
                                </div>
                                <div className="empleados-list">
                                    {empleados
                                        .filter(emp => !empleadosACargo.find(e => e.id === emp.id))
                                        .map(empleado => (
                                            <div key={empleado.id} className="empleado-item">
                                                <img
                                                    src={empleado.foto}
                                                    alt={empleado.nombres}
                                                    className="employee-mini-photo"
                                                />
                                                <span className="ml-2">{empleado.nombres} {empleado.apellidos}</span>
                                                {/* Agregar empleado a la lista de empleados a cargo */}
                                                <button
                                                    onClick={() => addEmpleados(empleado)}
                                                    className="add-button"
                                                >
                                                    <FaPlus />
                                                </button>
                                            </div>
                                        ))}
                                </div>
                            </div>
                            <div className="empleados-asignados">
                                <h3>Empleados Asignados</h3>
                                {empleadosACargo.length === 0 ? (
                                    <p>No hay empleados asignados</p>
                                ) : (
                                    <div className="empleados-list">
                                        {empleadosACargo.map(empleado => (
                                            <div key={empleado.id} className="empleado-item">
                                                <img
                                                    src={empleado.foto}
                                                    alt={empleado.nombres}
                                                    className="employee-mini-photo"
                                                />
                                                <span className="ml-2">{empleado.nombres} {empleado.apellidos}</span>
                                                <button
                                                    onClick={() => setEmpleadosACargo(empleadosACargo.filter(e => e.id !== empleado.id))}
                                                    className="remove-button"
                                                >
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                            </div>
                            <div className="modal-actions">
                                <button
                                    className="cancel-button"
                                    onClick={() => setShowAsignarModal(false)}
                                >
                                    <FaTimes /> Cancelar
                                </button>
                                <button
                                    className="save-button"
                                    onClick={handleGuardarAsignaciones}
                                >
                                    <FaSave /> Guardar Asignaciones
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaderModal; 