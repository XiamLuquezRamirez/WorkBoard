<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Destinatarios
    |--------------------------------------------------------------------------
    | Correos que reciben el resumen. En .env, separados por coma:
    | RESUMEN_TABLERO_DESTINATARIOS=ing.xiam.luquez@ingeer.co
    */
    'destinatarios' => array_filter(array_map(
        'trim',
        explode(',', (string) env('RESUMEN_TABLERO_DESTINATARIOS', ''))
    )),

    'zona_horaria' => env('RESUMEN_TABLERO_ZONA', 'America/Bogota'),

    /*
    |--------------------------------------------------------------------------
    | Alcance
    |--------------------------------------------------------------------------
    | Correo del líder cuyo equipo se reporta. El resumen se limita a sus
    | empleados asignados en lideres_empleados, más sus propias tareas: el mismo
    | criterio con que el sistema filtra los informes.
    |
    | Vacío = toda la organización. Úsalo sólo para un destinatario que deba ver
    | el tablero completo (Administrador o Supervisor).
    */
    'lider' => env('RESUMEN_TABLERO_LIDER', ''),

    /*
    |--------------------------------------------------------------------------
    | Reglas de clasificación
    |--------------------------------------------------------------------------
    */
    'reglas' => [
        // Días hábiles sin movimiento para considerar una tarea estancada.
        'dias_estancamiento' => (int) env('RESUMEN_TABLERO_DIAS_ESTANCAMIENTO', 5),

        // Horizonte en días para la sección "vencen pronto".
        'dias_horizonte' => (int) env('RESUMEN_TABLERO_DIAS_HORIZONTE', 7),

        // Máximo de filas por sección, para que el correo no crezca sin control.
        'limite_por_seccion' => (int) env('RESUMEN_TABLERO_LIMITE', 25),
    ],

    /*
    |--------------------------------------------------------------------------
    | Mapeo al esquema real de WorkBoard
    |--------------------------------------------------------------------------
    | El proyecto no usa Eloquent para el dominio: todo se consulta con el query
    | builder sobre la conexión 'mysql2'. Por eso aquí se nombran tablas y
    | columnas, no modelos ni relaciones.
    */
    'mapeo' => [
        'conexion' => 'mysql2',

        'tablas' => [
            'tareas'      => 'tareas_empleados',
            'empleados'   => 'empleados',
            'usuarios'    => 'users',
            'lideres'     => 'lideres_empleados',
            'proyectos'   => 'proyectos',
            'movimientos' => 'notif_generales',
            'subtareas'   => 'subtareas',
        ],

        'columnas' => [
            'id'          => 'id',
            'titulo'      => 'titulo',
            'estado'      => 'estado',
            'vencimiento' => 'fecha_pactada',
            'responsable' => 'empleado',
            'proyecto'    => 'proyecto_id',
        ],

        // Estados que cuentan como cerrados: se excluyen del resumen.
        'estados_cerrados' => ['Completada'],

        /*
        | Señal de movimiento.
        |
        | tareas_empleados no tiene updated_at, así que el avance no se puede
        | deducir de la propia fila. notif_generales sí guarda fecha por tarea y
        | cubre el 100% de las abiertas, de modo que sirve de bitácora.
        |
        | 'TareaAtrasada' queda fuera a propósito: la genera el sistema cada vez
        | que revisa los vencimientos, no una persona trabajando. Incluirla haría
        | que toda tarea vencida pareciera "recién movida" y el estancamiento
        | quedaría permanentemente en cero.
        */
        'movimiento' => [
            'columna_tarea'  => 'tarea_id',
            'columna_fecha'  => 'fecha_creacion',
            'columna_tipo'   => 'tipo',
            'tipos_ignorados' => ['TareaAtrasada'],
        ],

        // Opcional: restringir a ciertos proyectos (ids). null = todos.
        'proyectos_incluidos' => null,
    ],

];
