<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Presencia de cada persona en el plano de la oficina.
 *
 * Una fila por empleado. El estado lo elige la persona (disponible, ocupado,
 * en reunión, almorzando, ausente) y vale sólo el día en que lo puso: el de
 * ayer no debe seguir diciendo «ausente» hoy. «visto_en» es el último latido
 * de la aplicación abierta; sin latido reciente la persona sale desconectada.
 */
return new class extends Migration
{
    protected $connection = 'mysql2';

    public function up(): void
    {
        DB::connection('mysql2')->statement("
            CREATE TABLE IF NOT EXISTS presencia_empleados (
                empleado INT NOT NULL PRIMARY KEY,
                estado ENUM('disponible','ocupado','reunion','almuerzo','ausente') NULL,
                nota VARCHAR(80) NULL,
                fecha DATE NULL,
                visto_en DATETIME NULL,
                saludo_a INT NULL,
                saludo_en DATETIME NULL,
                updated_at TIMESTAMP NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    public function down(): void
    {
        DB::connection('mysql2')->statement("DROP TABLE IF EXISTS presencia_empleados");
    }
};
