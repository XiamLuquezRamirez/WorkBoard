<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    protected $connection = 'mysql2';

    public function up(): void
    {
        DB::connection('mysql2')->statement("
            CREATE TABLE IF NOT EXISTS pausas_solicitadas (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                tarea_id BIGINT UNSIGNED NOT NULL,
                solicitado_por BIGINT UNSIGNED NULL,
                solicitado_por_user BIGINT UNSIGNED NULL,
                motivo TEXT NOT NULL,
                fecha_reanudacion DATE NOT NULL,
                estado ENUM('Pendiente','Aprobada','Rechazada') NOT NULL DEFAULT 'Pendiente',
                tipo_aprobador ENUM('lider','admin') NOT NULL DEFAULT 'lider',
                aprobado_por BIGINT UNSIGNED NULL,
                observacion_rechazo TEXT NULL,
                fecha_solicitud TIMESTAMP NULL,
                fecha_resolucion TIMESTAMP NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void
    {
        DB::connection('mysql2')->statement("DROP TABLE IF EXISTS pausas_solicitadas");
    }
};
