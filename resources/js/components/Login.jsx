import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
import axios from 'axios';
import Swal from 'sweetalert2';

const Login = () => {
    const navigate = useNavigate();
    const [credentials, setCredentials] = useState({
        email: '',
        password: '',
        remember: false
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Verificar si ya hay una sesión activa
        const token = localStorage.getItem('token');
        if (token) {
            navigate('/dashboard');
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await axios.post('/loginUser', credentials);
    
            if (response.data.status === 'success') {
                // Guardar token y datos del usuario
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
                
                // Configurar el token para futuras peticiones
                axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
                
                // Mostrar mensaje de éxito
                Swal.fire({
                    title: '¡Bienvenido!',
                    text: `Hola ${response.data.user.name}`,
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    navigate('/dashboard');
                });
            }
        } catch (error) {
            let errorMessage = 'Error al iniciar sesión';
            
            if (error.response) {
                errorMessage = error.response.data.message || errorMessage;
            }

            setError(errorMessage);
            Swal.fire({
                title: 'Error',
                text: errorMessage,
                icon: 'error',
                confirmButtonText: 'OK'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <img src="/images/logo.png" alt="Logo" className="login-logo" />
                    <h2>Iniciar Sesión</h2>
                </div>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                        <div className="input-icon">
                            <FaUser />
                            <input
                                type="email"
                                placeholder="Correo electrónico"
                                value={credentials.email}
                                onChange={(e) => setCredentials({
                                    ...credentials,
                                    email: e.target.value
                                })}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <div className="input-icon">
                            <FaLock />
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Contraseña"
                                value={credentials.password}
                                onChange={(e) => setCredentials({
                                    ...credentials,
                                    password: e.target.value
                                })}
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

                    <div className="form-group remember-me">
                        <label>
                            <input
                                type="checkbox"
                                checked={credentials.remember}
                                onChange={(e) => setCredentials({
                                    ...credentials,
                                    remember: e.target.checked
                                })}
                            />
                            Recordarme
                        </label>
                    </div>

                    <button 
                        type="submit" 
                        className={`login-button ${loading ? 'loading' : ''}`}
                        disabled={loading}
                    >
                        {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login; 