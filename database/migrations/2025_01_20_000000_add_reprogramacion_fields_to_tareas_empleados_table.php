<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    protected $connection = 'mysql2';

    public function up(): void
    {
        $cols = DB::connection('mysql2')
            ->select("SHOW COLUMNS FROM tareas_empleados");
        $nombres = array_column($cols, 'Field');

        if (!in_array('motivo_reprogramacion', $nombres)) {
            DB::connection('mysql2')->statement(
                "ALTER TABLE tareas_empleados ADD COLUMN motivo_reprogramacion TEXT NULL AFTER fecha_entregada"
            );
        }

        if (!in_array('fecha_reprogramacion', $nombres)) {
            DB::connection('mysql2')->statement(
                "ALTER TABLE tareas_empleados ADD COLUMN fecha_reprogramacion TIMESTAMP NULL AFTER motivo_reprogramacion"
            );
        }
    }

    public function down(): void
    {
        $cols = DB::connection('mysql2')
            ->select("SHOW COLUMNS FROM tareas_empleados");
        $nombres = array_column($cols, 'Field');

        if (in_array('motivo_reprogramacion', $nombres)) {
            DB::connection('mysql2')->statement(
                "ALTER TABLE tareas_empleados DROP COLUMN motivo_reprogramacion"
            );
        }

        if (in_array('fecha_reprogramacion', $nombres)) {
            DB::connection('mysql2')->statement(
                "ALTER TABLE tareas_empleados DROP COLUMN fecha_reprogramacion"
            );
        }
    }
};
