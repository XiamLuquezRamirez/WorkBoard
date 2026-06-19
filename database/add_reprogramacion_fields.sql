-- Agregar campos para reprogramación de tareas
ALTER TABLE tareas_empleados 
ADD COLUMN motivo_reprogramacion TEXT NULL AFTER fecha_entregada,
ADD COLUMN fecha_reprogramacion TIMESTAMP NULL AFTER motivo_reprogramacion; 