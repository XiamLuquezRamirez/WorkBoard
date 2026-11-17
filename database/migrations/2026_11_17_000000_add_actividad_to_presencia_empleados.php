<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Uso del equipo en la presencia: si la persona está usando la computadora,
 * lleva un rato sin tocarla o tiene la pantalla bloqueada.
 *
 * Sólo se guarda ese estado y su hora: nunca qué programas usa ni qué
 * escribe. Lo informa el navegador (ver detectorActividad.js).
 */
return new class extends Migration
{
    protected $connection = 'mysql2';

    public function up(): void
    {
        DB::connection('mysql2')->statement("
            ALTER TABLE presencia_empleados
                ADD COLUMN IF NOT EXISTS uso_equipo ENUM('activo','inactivo','bloqueado') NULL AFTER visto_en,
                ADD COLUMN IF NOT EXISTS uso_equipo_en DATETIME NULL AFTER uso_equipo
        ");
    }

    public function down(): void
    {
        DB::connection('mysql2')->statement("
            ALTER TABLE presencia_empleados
                DROP COLUMN IF EXISTS uso_equipo_en,
                DROP COLUMN IF EXISTS uso_equipo
        ");
    }
};
