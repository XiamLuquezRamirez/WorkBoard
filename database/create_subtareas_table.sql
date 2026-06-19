-- Ejecutar en la base de datos de work-board (mysql2)
-- Si la tabla NO existe aún, usar este CREATE:
CREATE TABLE IF NOT EXISTS subtareas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tarea_id INT NOT NULL,
    titulo VARCHAR(500) NOT NULL,
    checklist_titulo VARCHAR(200) NULL,
    completada TINYINT(1) DEFAULT 0,
    fecha_vencimiento DATE NULL,
    orden INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tarea_id (tarea_id)
);

-- Si la tabla YA EXISTE, ejecutar solo esto:
-- ALTER TABLE subtareas ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE NULL AFTER completada;
-- ALTER TABLE subtareas ADD COLUMN IF NOT EXISTS checklist_titulo VARCHAR(200) NULL AFTER titulo;
