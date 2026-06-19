<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    protected $connection = 'mysql2';

    public function up(): void
    {
        // Crear tabla proyectos si no existe
        DB::connection('mysql2')->statement("
            CREATE TABLE IF NOT EXISTS proyectos (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                descripcion TEXT NULL,
                estado ENUM('Activo','Pausado','Completado','Cancelado') NOT NULL DEFAULT 'Activo',
                fecha_inicio DATE NULL,
                fecha_fin_estimada DATE NULL,
                created_at TIMESTAMP NULL,
                updated_at TIMESTAMP NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Agregar proyecto_id a tareas_empleados solo si no existe
        $cols = DB::connection('mysql2')
            ->select("SHOW COLUMNS FROM tareas_empleados");
        $nombres = array_column($cols, 'Field');

        if (!in_array('proyecto_id', $nombres)) {
            DB::connection('mysql2')->statement(
                "ALTER TABLE tareas_empleados ADD COLUMN proyecto_id BIGINT UNSIGNED NULL AFTER id"
            );
        }
    }

    public function down(): void
    {
        $cols = DB::connection('mysql2')
            ->select("SHOW COLUMNS FROM tareas_empleados");
        $nombres = array_column($cols, 'Field');

        if (in_array('proyecto_id', $nombres)) {
            DB::connection('mysql2')->statement(
                "ALTER TABLE tareas_empleados DROP COLUMN proyecto_id"
            );
        }

        DB::connection('mysql2')->statement("DROP TABLE IF EXISTS proyectos");
    }
};
