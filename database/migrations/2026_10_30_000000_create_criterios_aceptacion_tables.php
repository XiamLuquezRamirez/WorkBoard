<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    protected $connection = 'mysql2';

    public function up(): void
    {
        $db = DB::connection('mysql2');

        // Criterios de aceptación: las condiciones que debe cumplir el
        // RESULTADO de una tarea para darla por buena. Son independientes del
        // checklist (subtareas), que mide la EJECUCIÓN: no comparten tabla, ni
        // lógica, ni indicador. Marcar todos como cumplidos no acepta la tarea;
        // eso es una acción aparte, registrada en tarea_aceptaciones.
        //
        // El estado es el veredicto de quien verifica. La declaración del
        // colaborador («ya lo cumplí») va en columnas propias para que nunca
        // pueda confundirse con la verificación.
        $db->statement("
            CREATE TABLE IF NOT EXISTS tarea_criterios (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                tarea_id INT NOT NULL,
                descripcion TEXT NOT NULL,
                orden INT NOT NULL DEFAULT 0,
                obligatorio TINYINT(1) NOT NULL DEFAULT 1,
                requiere_evidencia TINYINT(1) NOT NULL DEFAULT 0,
                estado ENUM('Pendiente','Cumplido','No cumplido') NOT NULL DEFAULT 'Pendiente',
                responsable_verificacion INT NULL,
                declarado_por INT NULL,
                declarado_at TIMESTAMP NULL,
                verificado_por BIGINT UNSIGNED NULL,
                fecha_verificacion TIMESTAMP NULL,
                observacion TEXT NULL,
                creado_por BIGINT UNSIGNED NULL,
                actualizado_por BIGINT UNSIGNED NULL,
                eliminado_por BIGINT UNSIGNED NULL,
                eliminado_at TIMESTAMP NULL,
                created_at TIMESTAMP NULL,
                updated_at TIMESTAMP NULL,
                INDEX idx_tarea_orden (tarea_id, eliminado_at, orden),
                INDEX idx_responsable (responsable_verificacion),
                CONSTRAINT fk_criterio_tarea FOREIGN KEY (tarea_id)
                    REFERENCES tareas_empleados (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $db->statement("
            CREATE TABLE IF NOT EXISTS tarea_criterio_evidencias (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                criterio_id BIGINT UNSIGNED NOT NULL,
                tipo ENUM('archivo','enlace') NOT NULL,
                ruta VARCHAR(1000) NOT NULL,
                nombre VARCHAR(255) NULL,
                mime VARCHAR(120) NULL,
                subido_por BIGINT UNSIGNED NULL,
                eliminado_por BIGINT UNSIGNED NULL,
                eliminado_at TIMESTAMP NULL,
                created_at TIMESTAMP NULL,
                INDEX idx_criterio (criterio_id, eliminado_at),
                CONSTRAINT fk_evidencia_criterio FOREIGN KEY (criterio_id)
                    REFERENCES tarea_criterios (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Historial: sólo se añaden filas. Cada cambio guarda el valor anterior
        // y el nuevo, de modo que una verificación posterior nunca borra el
        // rastro de la anterior. Sin clave foránea a propósito: el historial
        // debe sobrevivir aunque el criterio se elimine.
        $db->statement("
            CREATE TABLE IF NOT EXISTS tarea_criterio_historial (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                tarea_id INT NOT NULL,
                criterio_id BIGINT UNSIGNED NULL,
                evento VARCHAR(40) NOT NULL,
                antes JSON NULL,
                despues JSON NULL,
                observacion TEXT NULL,
                usuario_id BIGINT UNSIGNED NULL,
                created_at TIMESTAMP NULL,
                INDEX idx_tarea (tarea_id, created_at),
                INDEX idx_criterio (criterio_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Cada aceptación o devolución queda como un registro propio, con una
        // foto de cómo estaban los criterios en ese momento: si después se
        // reabre y se vuelve a revisar, la decisión anterior sigue ahí.
        $db->statement("
            CREATE TABLE IF NOT EXISTS tarea_aceptaciones (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                tarea_id INT NOT NULL,
                resultado ENUM('Aceptada','Devuelta') NOT NULL,
                observacion TEXT NULL,
                criterios JSON NULL,
                usuario_id BIGINT UNSIGNED NULL,
                created_at TIMESTAMP NULL,
                INDEX idx_tarea (tarea_id, created_at),
                CONSTRAINT fk_aceptacion_tarea FOREIGN KEY (tarea_id)
                    REFERENCES tareas_empleados (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Las tareas que ya tenían el criterio único en tareas_empleados.criterio
        // pasan a tener ese texto como su primer criterio. La columna antigua no
        // se borra: queda como registro de lo que se pactó.
        $heredadas = $db->table('tareas_empleados')
            ->whereNotNull('criterio')
            ->where('criterio', '<>', '')
            ->whereNotExists(fn ($q) => $q->select($db->raw(1))
                ->from('tarea_criterios')
                ->whereColumn('tarea_criterios.tarea_id', 'tareas_empleados.id'))
            ->get(['id', 'criterio', 'criterio_cumplido', 'verificada_por', 'fecha_verificacion', 'evidencia_criterio']);

        foreach ($heredadas as $t) {
            $cumplido = (int) $t->criterio_cumplido === 1;

            $id = $db->table('tarea_criterios')->insertGetId([
                'tarea_id'           => $t->id,
                'descripcion'        => trim($t->criterio),
                'orden'              => 1,
                'obligatorio'        => 1,
                'estado'             => $cumplido ? 'Cumplido' : 'Pendiente',
                'verificado_por'     => $cumplido ? $t->verificada_por : null,
                'fecha_verificacion' => $cumplido ? $t->fecha_verificacion : null,
                'created_at'         => now(),
                'updated_at'         => now(),
            ]);

            if (!empty($t->evidencia_criterio)) {
                $db->table('tarea_criterio_evidencias')->insert([
                    'criterio_id' => $id,
                    'tipo'        => 'enlace',
                    'ruta'        => $t->evidencia_criterio,
                    'nombre'      => 'Evidencia del criterio anterior',
                    'created_at'  => now(),
                ]);
            }

            $db->table('tarea_criterio_historial')->insert([
                'tarea_id'    => $t->id,
                'criterio_id' => $id,
                'evento'      => 'migrado',
                'despues'     => json_encode(['descripcion' => trim($t->criterio)], JSON_UNESCAPED_UNICODE),
                'observacion' => 'Criterio único anterior convertido en criterio de aceptación.',
                'created_at'  => now(),
            ]);
        }
    }

    public function down(): void
    {
        $db = DB::connection('mysql2');
        $db->statement('DROP TABLE IF EXISTS tarea_aceptaciones');
        $db->statement('DROP TABLE IF EXISTS tarea_criterio_historial');
        $db->statement('DROP TABLE IF EXISTS tarea_criterio_evidencias');
        $db->statement('DROP TABLE IF EXISTS tarea_criterios');
    }
};
