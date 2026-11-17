// App.jsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getRutaBase } from '../utils/assetHelper';
import Dashboard from './Dashboard';
import LoginForm from './LoginForm';
import { useUser } from './UserContext';
import Parameters from './Parameters';
import Reportes from './Reportes';
import TableroSeguimiento from './tablero/TableroSeguimiento';
import TimbreLlamada from './equipo/TimbreLlamada';
import AvisoMensajes from './equipo/AvisoMensajes';
import { observarTablas } from '../utils/tablasMoviles';
import { useDetectorActividad } from '../utils/detectorActividad';

function App() {
    const { user } = useUser();

    // Etiqueta las celdas de todas las tablas para que en móvil se lean
    // como fichas (ver utils/tablasMoviles.js y app.css).
    useEffect(() => observarTablas(), []);

    // Uso del equipo para la presencia del plano: activo, inactivo o
    // bloqueado. Sólo con ficha de empleado, que es quien tiene presencia.
    useDetectorActividad(Boolean(user?.empleado));

    return (
        // Direcciones sin «#» («/dashboard»): Laravel sirve la app en cualquier
        // ruta (catch-all de web.php). La base cubre XAMPP («/work-board/public»)
        // y producción («/WorkBoard/public»).
        <BrowserRouter basename={getRutaBase()}>
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
                            : user.tipo_usuario !== "Administrador"
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

            {/* El timbre y el aviso de mensajes viven fuera de las rutas: una
                llamada o un mensaje deben avisar se esté en la pantalla que se
                esté, no sólo en el plano. */}
            {user && <TimbreLlamada />}
            {user && <AvisoMensajes />}
        </BrowserRouter>
    );
}

export default App;
