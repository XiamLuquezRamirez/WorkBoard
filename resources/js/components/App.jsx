return (
    <div className="app-container">
        <Sidebar />
        <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            {/* Contenido de la aplicación */}
        </div>
    </div>
); 