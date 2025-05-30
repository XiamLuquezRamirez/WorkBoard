import React from 'react';
import { FaTimes } from 'react-icons/fa';

const FileViewerModal = ({ isOpen, onClose, fileUrl, fileName, fileType }) => {
    if (!isOpen) return null;
  


    const isImage = fileType?.toLowerCase().includes('image');
    const isPDF = fileType?.toLowerCase().includes('pdf');
    const isViewable = isImage || isPDF;

  

    // Construir la URL completa del archivo
    const fullFileUrl = fileUrl?.startsWith('http') 
        ? fileUrl 
        : fileUrl?.startsWith('/storage/') 
            ? fileUrl 
            : `/storage/${fileUrl}`;
            
    return (
        <div className="file-viewer-modal-overlay" onClick={onClose}>
            <div className="file-viewer-modal" onClick={e => e.stopPropagation()}>
                <div className="file-viewer-header">
                    <h3 className="file-viewer-title">{fileName}</h3>
                    <button
                        onClick={onClose}
                        className="file-viewer-close"
                    >
                        <FaTimes />
                    </button>
                </div>
                <div className="file-viewer-content">
                    {isViewable ? (
                        isImage ? (
                            <img
                                src={fullFileUrl} Z  
                                alt={fileName}
                                className="file-viewer-image"
                                onError={(e) => {
                                    console.error('Error al cargar la imagen:', e);
                                    e.target.style.display = 'none';
                                }}
                            />
                        ) : (
                            <iframe
                                src={fullFileUrl}
                                className="file-viewer-iframe"
                                title={fileName}
                                onError={(e) => {
                                    console.error('Error al cargar el PDF:', e);
                                }}
                            />
                        )
                    ) : (
                        <div className="file-viewer-download">
                            <p className="file-viewer-download-text">
                                Este tipo de archivo no se puede previsualizar.
                            </p>
                            <a
                                href={fullFileUrl}
                                download={fileName}
                                className="file-viewer-download-button"
                            >
                                Descargar archivo
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FileViewerModal; 