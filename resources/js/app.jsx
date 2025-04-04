import './bootstrap';
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashBoard from './components/dashBoard';
import Login from './components/Login';
import AuthMiddleware from './middleware/AuthMiddleware';
import './css/employeeModal.css';
import './css/userModal.css';
import './css/CompanyModal.css';
import './css/login.css';
import './css/profileModal.css';
import Sidebar from './components/Sidebar';
import Parameters from './components/Parameters';
import Layout from './components/Layout';

// Configurar interceptores de axios
AuthMiddleware.setupAxiosInterceptors();

// Componente protegido
const ProtectedRoute = ({ children }) => {
    if (!AuthMiddleware.isAuthenticated()) {
        return <Navigate to="/login" />;
    }
    return children;
};

const App = () => {
    const [currentView, setCurrentView] = useState('dashboard');

    return (
        <Router>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<DashBoard />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="parameters" element={<Parameters />} />
                </Route>
            </Routes>
        </Router>
    );
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
                <Route path="/parameters" element={<Parameters />} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>
);

export default App;
