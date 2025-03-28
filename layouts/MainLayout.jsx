const MainLayout = () => {
  return (
    <div className="relative">
      {/* Botón flotante */}
      <button 
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-l-lg shadow-lg z-50"
        onClick={() => window.location.href = '/parametros'}
        style={{ zIndex: 9999 }}
      >
        <div className="flex items-center gap-2">
          <svg 
            className="w-6 h-6" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
          </svg>
          <span>Parámetros</span>
        </div>
      </button>

      {/* Resto de tu aplicación */}
      {children}
    </div>
  );
}; 