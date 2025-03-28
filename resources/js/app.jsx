import './bootstrap';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashBoard from './components/dashBoard';
import Login from './components/Login';
import AuthMiddleware from './middleware/AuthMiddleware';
import './css/employeeModal.css';
import './css/userModal.css';
import './css/login.css';
import './css/profileModal.css';

// Configurar interceptores de axios
AuthMiddleware.setupAxiosInterceptors();

// Componente protegido
const ProtectedRoute = ({ children }) => {
    if (!AuthMiddleware.isAuthenticated()) {
        return <Navigate to="/login" />;
    }
    return children;
};

ReactDOM.createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route 
                    path="/dashboard" 
                    element={
                        <ProtectedRoute>
                            <DashBoard />
                        </ProtectedRoute>
                    } 
                />
                <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>
);
