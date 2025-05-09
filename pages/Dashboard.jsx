const Dashboard = () => {
  return (
    <div className="flex w-full h-screen overflow-hidden">
      {/* Sidebar fijo */}
      <div className="w-20 h-screen bg-blue-600 flex flex-col items-center py-6 gap-8 flex-shrink-0">
        {/* Icono de Home */}
        <button className="w-12 h-12 bg-blue-700 rounded-lg flex items-center justify-center text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </button>

        {/* Icono de Gráfica/Estadísticas */}
        <button className="w-12 h-12 hover:bg-blue-700 rounded-lg flex items-center justify-center text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </button>

        {/* Icono de Configuración */}
        <button className="w-12 h-12 hover:bg-blue-700 rounded-lg flex items-center justify-center text-white mt-auto">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Contenido principal con scroll */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">Tablero de seguimiento de empleados</h1>
          
          {/* Grid de cards */}
          <div className="grid grid-cols-2 gap-6">
            {/* Card de empleado 1 */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-4 mb-6">
                <img src="/avatar.jpg" alt="Empleado" className="w-16 h-16 rounded-full" />
                <div>
                  <h3 className="text-lg font-semibold">Marcos Sanz</h3>
                  <p className="text-blue-600">Desarrollo</p>
                  <p className="text-gray-500 text-sm">CSI DESARROLLOS</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 text-center mb-6 bg-gray-50 rounded-lg p-3">
                <div>
                  <p className="text-2xl font-bold text-blue-600">12</p>
                  <p className="text-sm text-gray-500">COMPLETADAS</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">3</p>
                  <p className="text-sm text-gray-500">EN PROCESO</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">5</p>
                  <p className="text-sm text-gray-500">PENDIENTES</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span>Progreso General</span>
                  <span>70%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{width: '70%'}}></div>
                </div>
              </div>
            </div>

            {/* Card de empleado 2 */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-4 mb-6">
                <img src="/avatar.jpg" alt="Empleado" className="w-16 h-16 rounded-full" />
                <div>
                  <h3 className="text-lg font-semibold">Ana López</h3>
                  <p className="text-blue-600">Diseño UX/UI</p>
                  <p className="text-gray-500 text-sm">CSI DESARROLLOS</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 text-center mb-6 bg-gray-50 rounded-lg p-3">
                <div>
                  <p className="text-2xl font-bold text-blue-600">15</p>
                  <p className="text-sm text-gray-500">COMPLETADAS</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">4</p>
                  <p className="text-sm text-gray-500">EN PROCESO</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">2</p>
                  <p className="text-sm text-gray-500">PENDIENTES</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span>Progreso General</span>
                  <span>85%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{width: '85%'}}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard; 