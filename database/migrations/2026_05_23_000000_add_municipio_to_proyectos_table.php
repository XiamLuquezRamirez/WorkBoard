<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    protected $connection = 'mysql2';

    public function up(): void
    {
        $cols = DB::connection('mysql2')->select("SHOW COLUMNS FROM proyectos");
        $nombres = array_column($cols, 'Field');

        if (!in_array('municipio', $nombres)) {
            DB::connection('mysql2')->statement(
                "ALTER TABLE proyectos ADD COLUMN municipio VARCHAR(255) NULL AFTER nombre"
            );
        }

        if (!in_array('empresa', $nombres)) {
            DB::connection('mysql2')->statement(
                "ALTER TABLE proyectos ADD COLUMN empresa BIGINT UNSIGNED NULL AFTER municipio"
            );
        }
    }

    public function down(): void
    {
        DB::connection('mysql2')->statement(
            "ALTER TABLE proyectos DROP COLUMN IF EXISTS municipio"
        );
    }
};
