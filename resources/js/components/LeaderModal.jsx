import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaUserPlus, FaUsers } from 'react-icons/fa';
import axios from 'axios';
import Swal from 'sweetalert2';
import '../css/LeaderModal.css';


const LeaderModal = ({ isOpen, onClose }) => {
    const [lideres, setLideres] = useState([]);
    const [empleados, setEmpleados] = useState([]);
    const [showAsignarModal, setShowAsignarModal] = useState(false);
    const [empleadosACargo, setEmpleadosACargo] = useState([]);
    const [liderSeleccionado, setLiderSeleccionado] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        cargarLideres();
        cargarEmpleados();
    }, []);

    const cargarLideres = () => {
        axios.get('/parametros/cargarLideres')
            .then((response) => {
                setLideres(response.data);
            })
            .catch((error) => {
                console.error('Error al cargar líderes:', error);
            });
    };

    const cargarEmpleados = () => {
        axios.get('/parametros/cargarEmpleados')
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
        axios.get(`/parametros/cargarEmpleadosLider/${lider.id}`)
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

        axios.post('/parametros/guardarAsignacionesLider', data)
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

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-container" style={{
                width: '95%',
                maxWidth: '1200px',
                height: '50vh',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div className="modal-header">
                    <h2>Gestión de Líderes</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-content" style={{
                    flex: 1,
                    width: '100%',
                    overflow: 'auto',
                    padding: '20px'
                }}>
                    <table className="leader-table" style={{
                        width: '100%',
                        tableLayout: 'fixed',
                        borderCollapse: 'collapse'
                    }}>
                        <thead>
                            <tr>
                                <th style={{width: '8%'}}>Foto</th>
                                <th style={{width: '20%'}}>Nombre</th>
                                <th style={{width: '15%'}}>Cargo</th>
                                <th style={{width: '15%'}}>Departamento</th>
                                <th style={{width: '15%'}}>Empresa</th>
                                <th style={{width: '15%'}}>Empleados a cargo</th>
                                <th style={{width: '12%'}}>Acciones</th>
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
                                    <td>{lider.empleados_asignados || 0}</td>
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
                                <h3>Empleados Disponibles</h3>
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
                                                <button
                                                    onClick={() => setEmpleadosACargo([...empleadosACargo, empleado])}
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
                                    Cancelar
                                </button>
                                <button 
                                    className="save-button"
                                    onClick={handleGuardarAsignaciones}
                                >
                                    Guardar Asignaciones
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