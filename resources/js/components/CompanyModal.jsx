import React, { useState, useEffect } from "react";
import {
    FaPlus,
    FaEdit,
    FaTrash,
    FaSearch,
    FaBuilding,
    FaUserTie,
    FaUserShield,
    FaCamera,
    FaSave,
    FaTimes

} from "react-icons/fa";
import axiosInstance from '../axiosConfig';
import Swal from "sweetalert2";
import Paginador from './Paginador';

const CompanyModal = ({ isOpen, onClose }) => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [empresas, setEmpresas] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);


    const initialCompanyState = {
        nombre: "",
        direccion: "",
        telefono: "",
        estado: "ACTIVO",
        accion: "guardar",
        id: "",
        representante: "",
        logo: null,
        logoPreview: null,
        nit: "",
    };

    const [newCompany, setNewCompany] = useState(initialCompanyState);

    // Calcular los usuarios a mostrar según la página actual
    const [itemsPerPage] = useState(5);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = empresas.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(empresas.length / itemsPerPage);


    useEffect(() => {
        const delaySearch = setTimeout(() => {
            if (searchTerm.length > 0) {
                buscarEmpresas();
            } else {
                cargarEmpresas();
            }
        }, 500);

        return () => clearTimeout(delaySearch);
    }, [searchTerm]);

    const cargarEmpresas = () => {
        setLoading(true);
        axiosInstance
            .get("/cargarEmpresas")
            .then((response) => {
                setEmpresas(response.data);
                setLoading(false);
            })
            .catch((error) => {
                console.error("Error al cargar las empresas:", error);
                setLoading(false);
            });
    };

    const handleImageChange = (e) => {

        const file = e.target.files[0];

        if (file) {
            const previewUrl = URL.createObjectURL(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewCompany(prev => ({
                    ...prev,
                    logo: reader.result,
                    logoPreview: previewUrl
                }));
            };
            reader.readAsDataURL(file);
        }

    };

    const buscarEmpresas = () => {
        setLoading(true);
        axiosInstance
            .get("/buscarEmpresas", { params: { term: searchTerm } })
            .then((response) => {
                setEmpresas(response.data);
                setLoading(false);
            })
            .catch((error) => {
                console.error("Error al buscar las empresas:", error);
                setLoading(false);
            });
    };

    const handleGuardarEmpresa = () => {
        


        //validar campos 
        if (!newCompany.nit) {
            Swal.fire({
                icon: 'warning',
                title: 'Alerta!',
                text: 'El NIT de la empresa es requerido',
            });
            return;
        }
        if (!newCompany.nombre) {
            Swal.fire({
                icon: 'warning',
                title: 'Alerta!',
                text: 'El nombre de la empresa es requerido',
            });
            return;
        }

        if (!newCompany.representante) {
            Swal.fire({
                icon: 'warning',
                title: 'Aelerta!',
                text: 'El representante de la empresa es requerido',
            });
            return;
        }

        // Crear nueva empresa
        axiosInstance.post('/guardarEmpresa', newCompany)
            .then(response => {
              
                Swal.fire({
                    icon: 'success',
                    title: 'Empresa creada',
                    text: 'La empresa ha sido creada correctamente',
                    showConfirmButton: false,
                    timer: 1500
                });
                setNewCompany(initialCompanyState);
                setShowAddForm(false);
                cargarEmpresas();
            })
            .catch(error => {
                console.error('Error al crear la empresa:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error al crear la empresa',
                    text: 'Por favor, verifica los datos e intenta nuevamente',
                    showConfirmButton: true
                });
            });
    };

    //editar empresa
    const handleEditarEmpresa = (empresa) => {

        setShowAddForm(true);
        //cargar la imagen de la empresa
        setNewCompany({ ...empresa, logoPreview: empresa.logo, accion: 'editar' });
    }

    const handleEliminarEmpresa = (id) => {
        Swal.fire({
            icon: 'warning',
            title: 'Alerta!',
            text: '¿Estás seguro de querer eliminar la empresa?',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Si, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                axiosInstance.delete(`/eliminarEmpresa/${id}`)
                    .then(response => {
                        if (response.data.success) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Empresa eliminada',
                                text: 'La empresa ha sido eliminada correctamente',
                            });
                            cargarEmpresas();
                        }
                    });
            }
        });
    }

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-Company">
                <div className="modal-header">
                    <h2>Gestión de Empresas</h2>
                    <button className="close-button" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>

                <div className="modal-toolbar" >
                    <div className={`search-box ${loading ? "loading" : ""}`}>
                        <FaSearch />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, dirección o representante..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {loading && <div className="search-spinner"></div>}
                    </div>

                    <button
                        className="add-button"
                        onClick={() => {
                            setNewCompany(initialCompanyState);
                            setShowAddForm(true);
                            setNewCompany({ ...newCompany, accion: 'guardar' });
                        }}
                    >
                        <FaPlus /> Nueva Empresa
                    </button>
                </div>
                {/* cargar empresas */}
                <div className="modal-content">
                    {loading ? (
                        <div className="loader"><div className="jimu-primary-loading" /></div>
                    ) : empresas.length === 0 ? (
                        <div className="no-data-message"><p>No hay empresas disponibles</p></div>
                    ) : (
                        <>
                            <table className="employee-table">
                                <thead>
                                    <tr>
                                        <th>Nombre</th>
                                        <th>Representante</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {empresas.map((empresa) => (
                                        <tr key={empresa.id}>
                                            <td>{empresa.nombre}</td>
                                            <td>{empresa.representante}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        title="Editar empresa"
                                                        onClick={() =>
                                                            handleEditarEmpresa(
                                                                empresa
                                                            )
                                                        }
                                                        className="edit-button"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    <button
                                                        title="Eliminar empresa"
                                                        onClick={() =>
                                                            handleEliminarEmpresa(
                                                                empresa.id
                                                            )
                                                        }
                                                        className="delete-button"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {/* Paginación */}
                            <Paginador
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                            />
                        </>
                    )}
                </div>
            </div>
            {showAddForm && (
                <div className="modal-overlay">
                    <div className="form-modal-large">
                        <div className="modal-header">
                            <h2>{newCompany.accion === 'editar' ? 'Editar Empresa' : 'Nueva Empresa'}</h2>
                            <button
                                className="close-button"
                                onClick={() => setShowAddForm(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <form className="employee-form">
                            <div className="form-row">
                                <div className="form-group col-12">

                                    <div className="foto-upload-container">
                                        <div className="foto-preview">
                                            {newCompany.logoPreview ? (
                                                <>
                                                    <img
                                                        src={newCompany.logoPreview}
                                                        alt="Preview"
                                                        className="avatar-preview"
                                                    />
                                                    <button
                                                        type="button"
                                                        className="change-photo-btn"
                                                        onClick={() => document.getElementById('logo-input').click()}
                                                    >
                                                        Cambiar
                                                    </button>
                                                </>
                                            ) : (
                                                <div
                                                    className="upload-placeholder"
                                                    onClick={() => document.getElementById('logo-input').click()}
                                                >
                                                    <FaCamera className="camera-icon" />
                                                    <span>Subir foto</span>
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            id="logo-input"
                                            type="file"
                                            accept="image/*"
                                            className="file-input hidden"
                                            onChange={handleImageChange}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="form-row">

                                <div className="form-group col-6">
                                    <label>NIT:</label>
                                    <input type="text" className="form-control" value={newCompany.nit} onChange={(e) => setNewCompany({ ...newCompany, nit: e.target.value })} />
                                </div>
                                <div className="form-group col-6">
                                    <label>Nombre:</label>
                                    <input type="text" className="form-control" value={newCompany.nombre} onChange={(e) => setNewCompany({ ...newCompany, nombre: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group col-6">
                                    <label>Representante:</label>
                                    <input type="text" className="form-control" value={newCompany.representante} onChange={(e) => setNewCompany({ ...newCompany, representante: e.target.value })} />
                                </div>
                                <div className="form-group col-6">
                                    <label>Dirección:</label>
                                    <input type="text" className="form-control" value={newCompany.direccion} onChange={(e) => setNewCompany({ ...newCompany, direccion: e.target.value })} />
                                </div>
                                <div className="form-group col-6">
                                    <label>Teléfono:</label>
                                    <input type="text" className="form-control" value={newCompany.telefono} onChange={(e) => setNewCompany({ ...newCompany, telefono: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="button" className="cancel-button" onClick={() => setShowAddForm(false)}>
                                    <FaTimes /> {" "} Cancelar
                                </button>
                                <button type="button" onClick={handleGuardarEmpresa} className="save-button">
                                    <FaSave /> {" "} Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompanyModal;
