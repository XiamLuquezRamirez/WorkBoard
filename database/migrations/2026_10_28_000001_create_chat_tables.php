<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    protected $connection = 'mysql2';

    public function up(): void
    {
        // Una conversación es un canal de departamento o un directo entre dos
        // personas. Se guardan en la misma tabla porque los mensajes son
        // iguales en ambos casos; sólo cambia quién puede leerlos.
        //
        // «clave» identifica la conversación sin depender de su id: «dep:3»
        // para el canal de un departamento y «dir:12-45» (ids ordenados) para
        // un directo. Así el servidor puede crearla al vuelo la primera vez
        // que alguien escribe, sin administrarlas de antemano.
        DB::connection('mysql2')->statement("
            CREATE TABLE IF NOT EXISTS chat_conversaciones (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                clave VARCHAR(60) NOT NULL,
                tipo ENUM('departamento','directo') NOT NULL,
                departamento INT NULL,
                created_at TIMESTAMP NULL,
                updated_at TIMESTAMP NULL,
                UNIQUE KEY uk_clave (clave)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        DB::connection('mysql2')->statement("
            CREATE TABLE IF NOT EXISTS chat_mensajes (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                conversacion BIGINT UNSIGNED NOT NULL,
                empleado INT NOT NULL,
                mensaje TEXT NOT NULL,
                created_at TIMESTAMP NULL,
                updated_at TIMESTAMP NULL,
                INDEX idx_conversacion (conversacion, id),
                CONSTRAINT fk_chat_mensaje_conv FOREIGN KEY (conversacion)
                    REFERENCES chat_conversaciones (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Hasta dónde ha leído cada quien. Guardar el último id leído, en vez
        // de una marca por mensaje, mantiene la tabla pequeña: una fila por
        // persona y conversación, no una por mensaje.
        DB::connection('mysql2')->statement("
            CREATE TABLE IF NOT EXISTS chat_lecturas (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                conversacion BIGINT UNSIGNED NOT NULL,
                empleado INT NOT NULL,
                ultimo_leido BIGINT UNSIGNED NOT NULL DEFAULT 0,
                updated_at TIMESTAMP NULL,
                UNIQUE KEY uk_conv_empleado (conversacion, empleado),
                INDEX idx_empleado (empleado),
                CONSTRAINT fk_chat_lectura_conv FOREIGN KEY (conversacion)
                    REFERENCES chat_conversaciones (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void
    {
        DB::connection('mysql2')->statement("DROP TABLE IF EXISTS chat_lecturas");
        DB::connection('mysql2')->statement("DROP TABLE IF EXISTS chat_mensajes");
        DB::connection('mysql2')->statement("DROP TABLE IF EXISTS chat_conversaciones");
    }
};
