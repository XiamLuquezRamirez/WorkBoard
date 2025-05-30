// App.jsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import LoginForm from './LoginForm';
import { useUser } from './UserContext';
import Parameters from './Parameters';
import Reportes from './Reportes';

function App() {
    const { user } = useUser();

    return (
        <HashRouter>
            <Routes>
                {/* Ruta pública */}
                <Route
                    path="/login"
                    element={user ? <Navigate to="/dashboard" /> : <LoginForm />}
                />

                {/* Ruta protegida */}
                <Route
                    path="/dashboard"
                    element={user ? <Dashboard /> : <Navigate to="/login" />}
                />

                {/* Ruta protegida para reportes */}
                <Route
                    path="/reports"
                    element={user ? <Reportes /> : <Navigate to="/login" />}
                />

                {/* Ruta protegida para parameters */}
                <Route
                    path="/parameters"
                    element={user ? <Parameters /> : <Navigate to="/login" />}
                />

                {/* Ruta por defecto */}
                <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
            </Routes>
        </HashRouter>
    );
}

export default App;
