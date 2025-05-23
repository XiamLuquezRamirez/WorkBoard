import React from 'react';

    // Estilos para la paginación
    const paginationStyles = {
        container: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: '1rem',
            gap: '0.5rem'
        },
        button: {
            padding: '0.5rem 1rem',
            border: '1px solid #e2e8f0',
            borderRadius: '0.375rem',
            backgroundColor: '#fff',
            color: '#4a5568',
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
                backgroundColor: '#f7fafc',
            },
            '&:disabled': {
                backgroundColor: '#edf2f7',
                color: '#a0aec0',
                cursor: 'not-allowed'
            }
        },
        activeButton: {
            backgroundColor: '#4299e1',
            color: '#fff',
            borderColor: '#4299e1',
            '&:hover': {
                backgroundColor: '#3182ce',
            }
        },
        pageInfo: {
            color: '#4a5568',
            fontSize: '0.875rem'
        }
    };

const Paginador = ({ currentPage, totalPages, onPageChange }) => {
    return (
        <div style={paginationStyles.container}>
        <button
            style={{
                ...paginationStyles.button,
                ...(currentPage === 1 ? { opacity: 0.5, cursor: 'not-allowed' } : {})
            }}
            onClick={() => onPageChange(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
        >
            Anterior
        </button>
        
        {[...Array(totalPages)].map((_, index) => (
            <button
                key={index + 1}
                style={{
                    ...paginationStyles.button,
                    ...(currentPage === index + 1 ? paginationStyles.activeButton : {})
                }}
                onClick={() => onPageChange(index + 1)}
            >
                {index + 1}
            </button>
        ))}
        
        <button
            style={{
                ...paginationStyles.button,
                ...(currentPage === totalPages ? { opacity: 0.5, cursor: 'not-allowed' } : {})
            }}
            onClick={() => onPageChange(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
        >
            Siguiente
        </button>
        
        <span style={paginationStyles.pageInfo}>
            Página {currentPage} de {totalPages}
        </span>
    </div>
    );
};

export default Paginador;

