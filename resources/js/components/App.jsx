// App.jsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import LoginForm from './LoginForm';
import { useUser } from './UserContext';
import Parameters from './Parameters';
import Reportes from './Reportes';
import TableroSeguimiento from './tablero/TableroSeguimiento';

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
                    element={
                        !user
                            ? <Navigate to="/login" />
                            : user.tipo_usuario === "Supervisor"
                                ? <Navigate to="/dashboard" />
                                : <Parameters />
                    }
                />

                {/* Tablero de seguimiento: se abre en su propia pestaña, por lo que
                    necesita una ruta propia además del acceso desde el menú del líder */}
                <Route
                    path="/tablero"
                    element={user ? <TableroSeguimiento /> : <Navigate to="/login" />}
                />

                {/* Ruta por defecto */}
                <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
            </Routes>
        </HashRouter>
    );
}

export default App;
