import React, { useState, useEffect } from 'react';
import axiosInstance from '../axiosConfig';
import Swal from 'sweetalert2';
import { FaUser, FaLock, FaEye, FaEyeSlash, FaUnlock } from 'react-icons/fa';
import { getImageUrl, getAssetUrl } from '../utils/assetHelper';

const LoginForm = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });

    useEffect(() => {
        document.title = "Inicio de sesión - WorkBoard";
    }, []);

    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [hover, setHover] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        setError('');
        try {
            // Obtener el token CSRF primero
            await axiosInstance.get('/sanctum/csrf-cookie');

            // Intentar el login
            const response = await axiosInstance.post('/login', formData);
          
            if (response.data.message === 'Login exitoso') {
                
                //mostrar un mensaje de exito
                Swal.fire({
                    title: 'Exito',
                    text: 'Inicio de sesión exitoso',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false,
                    showCancelButton: false,
                    showCloseButton: false
                });

                //guardar el token en el localStorage
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
            }else{
                Swal.fire({
                    title: 'Error',
                    text: 'Credenciales incorrectas',
                    icon: 'error'
                });
            }

            // Redirigir al dashboard después del login exitoso
      
            setTimeout(() => {
                const fullPath = getAssetUrl('dashboard');              
                window.location.href = fullPath;
            }, 1500);
        } catch (error) {
            console.error('Error en el login:', error.response?.data || error.message);
            // Aquí puedes manejar el error
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div 
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: `url(${getImageUrl('images/fondo.png')})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundAttachment: 'fixed',
                    filter: 'blur(5px)',
                    opacity: '0.9',
                    zIndex: '-1'
                }}
            />
            <div className="login-card">
                <div className="login-header">
                    <img src={getImageUrl('images/logo.png')} alt="Logo" className="login-logo" />
                    <h2>Iniciar Sesión</h2>
                </div>
                {error && <div className="login-error">{error}</div>}
            
                 
                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="form-group">
                        <div className="input-icon">
                        <FaUser />
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                              
                        </div>
                    </div>
                    <div className="form-group">
                        <div className="input-icon">
                            <FaLock />
                            <input
                                type={showPassword ? "text" : "password"}
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                            />
                            <button
                                type="button"
                                className="toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>
                    </div>
                    
                    <button 
                        type="submit" 
                        className={`login-button ${loading ? 'loading' : ''}`}
                        disabled={loading}
                        onMouseEnter={() => setHover(true)}
                        onMouseLeave={() => setHover(false)}
                    >
                        {loading ? 
                        <>
                        Iniciando sesión...
                        </>
                        : 
                        <>
                        {hover ? <FaUnlock /> : <FaLock />} Iniciar Sesión
                      </>
                        }
                    </button>
                </form>

            </div>
        </div>
    );
};

export default LoginForm;
