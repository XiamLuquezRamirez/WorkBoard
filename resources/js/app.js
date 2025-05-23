import React from 'react';
import { createRoot } from 'react-dom/client';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import { UserProvider } from './components/UserContext';
import App from './components/App';
// Determinar qué componente mostrar basado en la ruta actual

const root = createRoot(document.getElementById('app'));

root.render(
    <React.StrictMode>
        <UserProvider>
            <App />
        </UserProvider> 
    </React.StrictMode>
);

// Habilitar hot reloading
if (module.hot) {
    module.hot.accept();
}
