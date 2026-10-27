<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Campos del método de la Escuela de Líderes en las tareas.
 *
 * Hasta ahora una tarea se daba por hecha porque alguien movía la tarjeta: de
 * las 536 completadas, ninguna tuvo que demostrar nada. Estas columnas separan
 * "la movieron" de "se cumplió lo acordado".
 *
 *   proposito           para qué existe la tarea (no la descripción del trabajo)
 *   criterio            cómo sabremos que se cumplió, pactado al crearla
 *   criterio_cumplido   si alguien verificó ese criterio
 *   evidencia_criterio  enlace o nota que respalda la verificación
 *   verificada_por      quién verificó (users.id), nunca el propio responsable
 *   fecha_verificacion  cuándo
 *   bloqueada           hay un impedimento declarado
 *   motivo_bloqueo      cuál es
 *
 * 'evidencia_criterio' lleva ese nombre y no 'evidencia' porque ya existe la
 * tabla evidencia_tarea, con 211 archivos adjuntos: son cosas distintas —esos
 * son entregables, esto es el respaldo de la verificación— y dos columnas
 * llamadas igual terminarían usándose indistintamente.
 *
 * Nulables a propósito: las 106 tareas vivas nacieron sin criterio y exigirlo
 * retroactivamente dejaría el trabajo en curso en un estado inválido. La
 * obligatoriedad se aplica en la validación al crear, no en el esquema, de modo
 * que lo heredado sigue su curso y lo nuevo entra ya con el método.
 *
 * 'bloqueada' es distinto de 'pausada': la pausa requiere aprobación del líder y
 * detiene el plazo; el bloqueo sólo declara un impedimento y el reloj sigue
 * corriendo, que es justo lo que el líder necesita ver.
 */
return new class extends Migration
{
    protected $connection = 'mysql2';

    /** Columnas a agregar, en el orden en que quedan en la tabla. */
    private const COLUMNAS = [
        'proposito'          => "TEXT NULL",
        'criterio'           => "TEXT NULL",
        'criterio_cumplido'  => "TINYINT(1) NOT NULL DEFAULT 0",
        'evidencia_criterio' => "VARCHAR(500) NULL",
        'verificada_por'     => "INT(11) NULL",
        'fecha_verificacion' => "TIMESTAMP NULL",
        'bloqueada'          => "TINYINT(1) NOT NULL DEFAULT 0",
        'motivo_bloqueo'     => "TEXT NULL",
    ];

    public function up(): void
    {
        $existentes = $this->columnas();

        foreach (self::COLUMNAS as $nombre => $definicion) {
            if (in_array($nombre, $existentes, true)) {
                continue;
            }

            DB::connection('mysql2')->statement(
                "ALTER TABLE tareas_empleados ADD COLUMN `{$nombre}` {$definicion}"
            );
        }

        // El tablero del líder filtra por bloqueadas y por criterio sin
        // verificar; sin índice eso recorre las 642 filas en cada sondeo.
        if (!$this->indiceExiste('idx_bloqueada')) {
            DB::connection('mysql2')->statement(
                'ALTER TABLE tareas_empleados ADD INDEX idx_bloqueada (bloqueada)'
            );
        }

        if (!$this->indiceExiste('idx_criterio_cumplido')) {
            DB::connection('mysql2')->statement(
                'ALTER TABLE tareas_empleados ADD INDEX idx_criterio_cumplido (criterio_cumplido)'
            );
        }
    }

    public function down(): void
    {
        foreach (['idx_bloqueada', 'idx_criterio_cumplido'] as $indice) {
            if ($this->indiceExiste($indice)) {
                DB::connection('mysql2')->statement(
                    "ALTER TABLE tareas_empleados DROP INDEX {$indice}"
                );
            }
        }

        $existentes = $this->columnas();

        foreach (array_keys(self::COLUMNAS) as $nombre) {
            if (in_array($nombre, $existentes, true)) {
                DB::connection('mysql2')->statement(
                    "ALTER TABLE tareas_empleados DROP COLUMN `{$nombre}`"
                );
            }
        }
    }

    /**
     * Columnas actuales leídas con SHOW COLUMNS.
     *
     * Schema::hasColumn() falla en este MySQL: su introspección consulta
     * 'generation_expression', que esta versión no expone.
     */
    private function columnas(): array
    {
        return array_column(
            DB::connection('mysql2')->select('SHOW COLUMNS FROM tareas_empleados'),
            'Field'
        );
    }

    private function indiceExiste(string $nombre): bool
    {
        return !empty(DB::connection('mysql2')->select(
            "SHOW INDEX FROM tareas_empleados WHERE Key_name = ?", [$nombre]
        ));
    }
};
