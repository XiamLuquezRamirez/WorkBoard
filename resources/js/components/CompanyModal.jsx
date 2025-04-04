import React, { useState, useEffect } from "react";
import {
    FaPlus,
    FaEdit,
    FaTrash,
    FaSearch,
    FaBuilding,
    FaUserTie,
    FaUserShield,
} from "react-icons/fa";
import axios from "axios";
import Swal from "sweetalert2";

const CompanyModal = ({ isOpen, onClose }) => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [empresas, setEmpresas] = useState([]);

    const initialCompanyState = {
        nombre: "",
        direccion: "",
        telefono: "",
        estado: "Activo",
        accion: "guardar",
        id: "",
        representante: "",
        logo: null,
        logoPreview: null,
        nit: "",
    };

    const [newCompany, setNewCompany] = useState(initialCompanyState);



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
        axios
            .get("/parametros/cargarEmpresas")
            .then((response) => {
                setEmpresas(response.data);
                setLoading(false);
            })
            .catch((error) => {
                console.error("Error al cargar las empresas:", error);
                setLoading(false);
            });
    };

    const buscarEmpresas = () => {
        setLoading(true);
        axios
            .get("/parametros/buscarEmpresas", { params: { term: searchTerm } })
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
        console.log(newCompany);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                <div className="modal-header">
                    <h2>Gestión de Empresas</h2>
                    <button className="close-button" onClick={onClose}>
                        &times;
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
                        }}
                    >
                        <FaPlus /> Nueva Empresa
                    </button>
                </div>

                <div className="modal-content">
                    {empresas.length === 0 ? (
                        <div className="no-data-message">
                            <p>No hay empresas disponibles</p>
                        </div>
                    ) : (
                      
                        <div>
                            {loading ? (
                                <div className="loading-spinner">
                                    <div className="spinner-border" role="status">
                                        <span className="sr-only">Cargando...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="modal-content">
                                <table className="company-table">
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
                            </div>
                            )}
                        </div>
                      
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

                                

                                <div className="form-group col-4">
                                    <label>NIT</label>
                                    <input type="text" className="form-control" value={newCompany.nit} onChange={(e) => setNewCompany({...newCompany, nit: e.target.value})} />
                                </div>
                                <div className="form-group col-8">
                                    <label>Nombre</label>
                                    <input type="text" className="form-control" value={newCompany.nombre} onChange={(e) => setNewCompany({...newCompany, nombre: e.target.value})} />
                                </div>
                                <div className="form-group col-6">
                                    <label>Representante</label>
                                    <input type="text" className="form-control" value={newCompany.representante} onChange={(e) => setNewCompany({...newCompany, representante: e.target.value})} />
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="cancel-button" onClick={() => setShowAddForm(false)}>
                                    Cancelar
                                </button>
                                <button type="button" onClick={handleGuardarEmpresa} className="save-button">
                                    Guardar
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
