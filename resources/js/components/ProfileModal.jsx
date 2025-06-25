import React, { useState, useEffect } from 'react';
import { FaUser, FaEnvelope, FaLock, FaCamera, FaTimes, FaSave  } from 'react-icons/fa';
import Swal from 'sweetalert2';
import axiosInstance from '../axiosConfig';



const ProfileModal = ({ isOpen, onClose, currentUser, updateUser }) => {
    const [profileData, setProfileData] = useState({
        id: '',
        name: '',
        email: '',
        new_password: '',
        new_password_confirmation: '',
        foto: null,
        fotoPreview: null,
        changePassword: false
    });

    

    useEffect(() => {
        if (currentUser) {
            setProfileData(prev => ({
                ...prev,
                name: currentUser.name,
                email: currentUser.email,
                foto: currentUser.foto,
                fotoPreview: currentUser.foto,
                id: currentUser.id
            }));
        }
    }, [currentUser]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfileData(prev => ({
                    ...prev,
                    foto: reader.result,
                    fotoPreview: previewUrl
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        //limpiar el formdata
       
        const formData = new FormData();
      
        formData.append('id', profileData.id);
        formData.append('name', profileData.name);
        formData.append('email', profileData.email);
        formData.append('foto', profileData.foto);


        if (profileData.changePassword) {
            if (profileData.new_password !== profileData.new_password_confirmation) {
                Swal.fire({
                    title: 'Error',
                    text: 'Las contraseñas no coinciden',
                    icon: 'error'
                });
                return;
            }


            if( profileData.new_password === '' || profileData.new_password_confirmation === ''){
                Swal.fire({
                    title: 'Error',
                    text: 'La contraseña actual no puede estar vacía',
                    icon: 'error'
                });
                return;
            }

            formData.append('cambiar_password', true);
            formData.append('new_password', profileData.new_password);
            formData.append('new_password_confirmation', profileData.new_password_confirmation);
        }


        try {
            const response = await axiosInstance.post('/profile/update', formData);
            
            if (response.data.status === 'success') {
                Swal.fire({
                    title: '¡Éxito!',
                    text: response.data.success,
                    icon: 'success'
                });
                updateUser(response.data.user);
                onClose();
            }
            
        } catch (error) {
            console.error('Error al actualizar el perfil:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al actualizar el perfil',
                showConfirmButton: false
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={(e) => {
            if (e.target.className === 'modal-overlay') {
                onClose();
            }
        }}>
            <div className="profile-modal">
                <div className="modal-header">
                    <h2>Mi Perfil</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="profile-form">
                    <div className="form-group col-12">
                        <div className="foto-upload-container">
                            <div className="foto-preview">
                                {profileData.fotoPreview ? (
                                    <>
                                        <img
                                            src={profileData.fotoPreview}
                                            alt="Preview"
                                            className="avatar-preview"
                                        />
                                        <button
                                            type="button"
                                            className="change-photo-btn"
                                            onClick={() => document.getElementById('foto-input').click()}
                                        >
                                            Cambiar
                                        </button>
                                    </>
                                ) : (
                                    <div
                                        className="upload-placeholder"
                                        onClick={() => document.getElementById('foto-input').click()}
                                    >
                                        <FaCamera className="camera-icon" />
                                        <span>Subir foto</span>
                                    </div>
                                )}
                            </div>
                            <div className="foto-upload-input">
                                <input
                                    id="foto-input"
                                    type="file"
                                    accept="image/*"
                                    className="file-input hidden"
                                    onChange={handleImageChange}
                                />

                            </div>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Nombre</label>
                        <div className="input-icon">
                            <FaUser />
                            <input
                                type="text"
                                value={profileData.name}
                                onChange={(e) => setProfileData(prev => ({
                                    ...prev,
                                    name: e.target.value
                                }))}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <div className="input-icon">
                            <FaEnvelope />
                            <input
                                type="email"
                                value={profileData.email}
                                onChange={(e) => setProfileData(prev => ({
                                    ...prev,
                                    email: e.target.value
                                }))}
                                required
                            />
                        </div>
                    </div>

                    <div className="password-section">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={profileData.changePassword}
                                onChange={(e) => setProfileData(prev => ({
                                    ...prev,
                                    changePassword: e.target.checked
                                }))}
                            />
                            Cambiar contraseña
                        </label>

                        {profileData.changePassword && (
                            <>
                                

                                <div className="form-group">
                                    <label>Nueva contraseña</label>
                                    <div className="input-icon">
                                        <FaLock />
                                        <input
                                            type="password"
                                            value={profileData.new_password}
                                            onChange={(e) => setProfileData(prev => ({
                                                ...prev,
                                                new_password: e.target.value
                                            }))}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Confirmar nueva contraseña</label>
                                    <div className="input-icon">
                                        <FaLock />
                                        <input
                                            type="password"
                                            value={profileData.new_password_confirmation}
                                            onChange={(e) => setProfileData(prev => ({
                                                ...prev,
                                                new_password_confirmation: e.target.value
                                            }))}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="form-actions">
                        <button type="button" className="cancel-button" onClick={onClose}>
                            <FaTimes />
                            Cancelar
                        </button>
                        <button type="submit" className="save-button">
                            <FaSave />
                            Guardar cambios
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileModal;
