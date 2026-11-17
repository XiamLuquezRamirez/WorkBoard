import React from 'react';
import { createRoot } from 'react-dom/client';
import { UserProvider } from './components/UserContext';
import App from './components/App';
import { normalizarUrlDeLaApp } from './utils/assetHelper';

// Direcciones viejas con «#» («/#/dashboard») → «/dashboard» antes de que
// arranque el router.
normalizarUrlDeLaApp();
// Un enlace viejo con «#/…» dentro de la misma página no la recarga: se
// corrige igual y se avisa al router con popstate.
window.addEventListener('hashchange', () => {
    if (window.location.hash.startsWith('#/')) {
        normalizarUrlDeLaApp();
        window.dispatchEvent(new PopStateEvent('popstate'));
    }
});
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
