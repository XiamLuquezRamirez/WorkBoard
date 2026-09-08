<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Da dueño a los vídeos del panel ambiental.
 *
 * Hasta ahora la lista era única para toda la organización: cualquier líder
 * veía, editaba y borraba los vídeos que hubiera puesto otro. Con esta columna
 * cada líder gestiona y reproduce solamente los suyos.
 *
 * Los vídeos ya existentes quedan con usuario NULL. Se tratan como heredados y
 * los sigue viendo todo el mundo, para no dejar pantallas en blanco tras el
 * despliegue; sólo un Administrador puede editarlos o retirarlos.
 */
return new class extends Migration
{
    protected $connection = 'mysql2';

    public function up(): void
    {
        $existe = DB::connection('mysql2')->select(
            "SHOW COLUMNS FROM tablero_videos LIKE 'usuario'"
        );
        if (empty($existe)) {
            DB::connection('mysql2')->statement(
                "ALTER TABLE tablero_videos
                 ADD COLUMN usuario BIGINT UNSIGNED NULL AFTER titulo,
                 ADD INDEX idx_usuario (usuario)"
            );
        }
    }

    public function down(): void
    {
        $existe = DB::connection('mysql2')->select(
            "SHOW COLUMNS FROM tablero_videos LIKE 'usuario'"
        );
        if (!empty($existe)) {
            DB::connection('mysql2')->statement(
                "ALTER TABLE tablero_videos DROP INDEX idx_usuario, DROP COLUMN usuario"
            );
        }
    }
};
