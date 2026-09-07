<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    protected $connection = 'mysql2';

    public function up(): void
    {
        DB::connection('mysql2')->statement("
            CREATE TABLE IF NOT EXISTS tablero_videos (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                titulo VARCHAR(200) NOT NULL,
                video_id VARCHAR(20) NOT NULL,
                orden INT NOT NULL DEFAULT 0,
                estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
                created_at TIMESTAMP NULL,
                updated_at TIMESTAMP NULL,
                INDEX idx_estado_orden (estado, orden)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void
    {
        DB::connection('mysql2')->statement("DROP TABLE IF EXISTS tablero_videos");
    }
};
