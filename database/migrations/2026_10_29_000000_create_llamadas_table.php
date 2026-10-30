<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    protected $connection = 'mysql2';

    public function up(): void
    {
        // Una llamada es una invitación con caducidad, no una sesión: el vídeo
        // vive en Jitsi y aquí sólo consta quién llamó a quién, cuándo y qué
        // respondió. Así el aviso puede aparecer en la pantalla del otro sin
        // necesidad de un servidor de tiempo real.
        DB::connection('mysql2')->statement("
            CREATE TABLE IF NOT EXISTS llamadas (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                emisor INT NOT NULL,
                receptor INT NOT NULL,
                sala VARCHAR(80) NOT NULL,
                estado ENUM('Sonando','Aceptada','Rechazada','Cancelada') NOT NULL DEFAULT 'Sonando',
                created_at TIMESTAMP NULL,
                updated_at TIMESTAMP NULL,
                INDEX idx_receptor_estado (receptor, estado, created_at),
                INDEX idx_emisor (emisor, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void
    {
        DB::connection('mysql2')->statement("DROP TABLE IF EXISTS llamadas");
    }
};
