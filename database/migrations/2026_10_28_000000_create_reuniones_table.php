<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    protected $connection = 'mysql2';

    public function up(): void
    {
        // El enlace no se genera: se pega el de Meet, Zoom o Teams. Montar
        // videollamada propia excede con mucho lo que el tablero necesita, y
        // la organización ya usa esas herramientas.
        DB::connection('mysql2')->statement("
            CREATE TABLE IF NOT EXISTS reuniones (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                titulo VARCHAR(200) NOT NULL,
                descripcion TEXT NULL,
                fecha DATE NOT NULL,
                hora_inicio TIME NOT NULL,
                hora_fin TIME NULL,
                enlace VARCHAR(500) NULL,
                lugar VARCHAR(200) NULL,
                organizador INT NOT NULL,
                estado ENUM('Programada','Cancelada','Realizada') NOT NULL DEFAULT 'Programada',
                created_at TIMESTAMP NULL,
                updated_at TIMESTAMP NULL,
                INDEX idx_fecha (fecha, hora_inicio),
                INDEX idx_organizador (organizador),
                INDEX idx_estado_fecha (estado, fecha)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Asistentes por empleado, no por usuario: el tablero razona en
        // empleados y así la reunión encaja con el resto del dominio.
        DB::connection('mysql2')->statement("
            CREATE TABLE IF NOT EXISTS reuniones_asistentes (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                reunion BIGINT UNSIGNED NOT NULL,
                empleado INT NOT NULL,
                respuesta ENUM('Pendiente','Acepta','Rechaza') NOT NULL DEFAULT 'Pendiente',
                created_at TIMESTAMP NULL,
                updated_at TIMESTAMP NULL,
                UNIQUE KEY uk_reunion_empleado (reunion, empleado),
                INDEX idx_empleado (empleado),
                CONSTRAINT fk_reunion_asistente FOREIGN KEY (reunion)
                    REFERENCES reuniones (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void
    {
        DB::connection('mysql2')->statement("DROP TABLE IF EXISTS reuniones_asistentes");
        DB::connection('mysql2')->statement("DROP TABLE IF EXISTS reuniones");
    }
};
