<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Carbon;
use App\Mail\NotificacionMailable;

class EmpleadosController extends Controller
{
    function cargarNotificaciones(Request $request)
    {
        $id = $request->input('id');
        $tipo = $request->input('tipo');

        // Se devuelven las no leídas completas más un tramo reciente de leídas,
        // para que la pestaña "Leídas" del modal conserve el historial en lugar
        // de vaciarse en el siguiente sondeo. El histórico completo puede tener
        // miles de filas por receptor, de ahí el tope en las leídas.
        $limiteLeidas = 50;

        $receptorId = $id;
        $tipoReceptor = 'usuario';

        if ($tipo === 'empleado') {
            $empleado = DB::connection('mysql2')->table('empleados')
                ->join('users', 'empleados.id', 'users.empleado')
                ->select('users.id as id_usuario', 'empleados.*')
                ->where('users.id', $id)->first();
            if (!$empleado) {
                return response()->json([]);
            }
            $receptorId = $empleado->id_usuario;
            $tipoReceptor = 'empleado';
        }

        $base = fn () => DB::connection('mysql2')->table('notif_generales')
            ->where('id_receptor', $receptorId)
            ->where('tipo_receptor', $tipoReceptor);

        $noLeidas = $base()->where('leido', 0)
            ->orderBy('notif_generales.id', 'desc')
            ->get();

        $leidas = $base()->where('leido', 1)
            ->orderBy('notif_generales.id', 'desc')
            ->limit($limiteLeidas)
            ->get();

        // 'leida' se expone además de 'leido' porque el frontend filtra por ese
        // nombre; se mantiene 'leido' para no romper otros consumidores.
        $notificaciones = $noLeidas->concat($leidas)->map(function ($n) {
            $n->leida = (int) $n->leido === 1;
            return $n;
        })->values();

        return response()->json($notificaciones);
    }

    function actualizarUsuario(Request $request)
    {
        $usuario = $request->all();
        $fotoUrl = $this->procesarFoto($usuario['foto'] ?? null);

        if (isset($usuario['cambiar_password']) && $usuario['cambiar_password']) {
            $usuarios = DB::connection('mysql2')->table('users')->where('id', $usuario['id'])->update([
                'name' => $usuario['name'],
                'email' => $usuario['email'],
                'password' => Hash::make($usuario['new_password']),
                'foto' => $fotoUrl
            ]);
            DB::connection('mysql')->table('users')->where('id_usuario_tarea', $usuario['id'])->update([
                'name' => $usuario['name'],
                'email' => $usuario['email'],
                'password' => Hash::make($usuario['new_password'])
            ]);
        } else {

            $usuarios = DB::connection('mysql2')->table('users')->where('id', $usuario['id'])->update([
                'name' => $usuario['name'],
                'email' => $usuario['email'],
                'foto' => $fotoUrl
            ]);
            //insertra en la tabla de usuario de chat empresarial
            DB::connection('mysql')->table('users')->where('id_usuario_tarea', $usuario['id'])->update([
                'name' => $usuario['name'],
                'email' => $usuario['email']
            ]);
        }

        $usuario = DB::connection('mysql2')->table('users')->where('id', $usuario['id'])->first();

        return response()->json([
            'success' => 'Usuario actualizado correctamente',
            'user' => $usuario,
            'status' => 'success'
        ], 200);
    }
    

    private function registrarActividad(int $tareaId, string $tipo, string $mensaje): void
    {
        DB::connection('mysql2')->table('notif_generales')->insert([
            'id_emisor'     => 0,
            'tipo_emisor'   => 'sistema',
            'id_receptor'   => 0,
            'tipo_receptor' => 'sistema',
            'mensaje'       => $mensaje,
            'tarea_id'      => $tareaId,
            'leido'         => 1,
            'fecha'         => now(),
            'tipo'          => $tipo,
        ]);
    }

    function guardarObservacionesEmpleado(Request $request, $id)
    {
        $observaciones = $request->all();
        $observaciones = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
            'observacion_entrega' => $observaciones['observacion_entrega']
        ]);
        return response()->json(['success' => 'Observaciones guardadas correctamente'], 200);
    }

    function archivarTarea($id)
    {
        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
            'archivar' => 1,
            'fecha_archivada' => date('Y-m-d H:i:s')
        ]);
        return response()->json(['success' => 'Tarea archivada correctamente'], 200);
    }

    function desarchivarTarea($id)
    {
        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
            'archivar' => 0
        ]);
        return response()->json(['success' => 'Tarea desarchivada correctamente'], 200);
    }

    function eliminarTarea($id)
    {
        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->delete();
        $evidencias = DB::connection('mysql2')->table('evidencia_tarea')->where('tarea', $id)->delete();
        $notificaciones = DB::connection('mysql2')->table('notif_generales')->where('tarea_id', $id)->delete();
        return response()->json(['success' => 'Tarea eliminada correctamente'], 200);
    }


    function cargarEmpleados()
    {
        $empleados = DB::connection('mysql2')->table('empleados')
            ->join('empresas', 'empleados.empresa', 'empresas.id')
            ->join('departamentos', 'empleados.departamento', '=', 'departamentos.id')
            ->join('cargos', 'empleados.cargo', '=', 'cargos.id')
            ->select('empleados.*', 'empresas.nombre as nombre_empresa', 'departamentos.nombre as nombre_departamento', 'cargos.nombre as nombre_cargo')
            ->where('empleados.estado_registro', 'Activo')
            ->get();
        return response()->json($empleados);
    }

    function buscarEmpleados()
    {

        $searchTerm = request('params.search');

        $empleados = DB::connection('mysql2')->table('empleados')
            ->join('empresas', 'empleados.empresa', 'empresas.id')
            ->join('cargos', 'empleados.cargo', 'cargos.id')
            ->select('empleados.*', 'empresas.nombre as nombre_empresa', 'cargos.nombre as nombre_cargo')
            ->where('empleados.estado_registro', 'Activo')
            ->where(function ($query) use ($searchTerm) {
                $query->where('empleados.nombres', 'like', '%' . $searchTerm . '%')
                    ->orWhere('empleados.apellidos', 'like', '%' . $searchTerm . '%')
                    ->orWhere('empleados.identificacion', 'like', '%' . $searchTerm . '%');
            })
            ->get();

        return response()->json($empleados);
    }


    function cargarEmpresas()
    {
        $empresas = DB::connection('mysql2')->table('empresas')
            ->where('estado', 'ACTIVO')
            ->get();
        return response()->json($empresas);
    }

    function cargarDepartamentos()
    {
        $departamentos = DB::connection('mysql2')->table('departamentos')->get();
        return response()->json($departamentos);
    }

    private function procesarFoto(?string $foto): ?string
    {
        return $foto;
    }

    function guardarEmpleado(Request $request)
    {
        $empleado = $request->all();

        DB::connection('mysql2')->beginTransaction();
        try {
            if ($empleado['accion'] == 'guardar') {
                $fotoUrl = $this->procesarFoto($empleado['foto'] ?? null);

                $empleadoId = DB::connection('mysql2')->table('empleados')->insertGetId(
                    [
                        'identificacion' => $empleado['identificacion'],
                        'nombres' => $empleado['nombres'],
                        'apellidos' => $empleado['apellidos'],
                        'email' => $empleado['email'],
                        'departamento' => $empleado['departamento'],
                        'empresa' => $empleado['empresa'],
                        'cargo' => $empleado['cargo'],
                        'telefono' => $empleado['telefono'],
                        'fecha_nacimiento' => $empleado['fecha_nacimiento'],
                        'fecha_ingreso' => $empleado['fecha_ingreso'],
                        'tipo_contrato' => $empleado['tipo_contrato'],
                        'direccion' => $empleado['direccion'],
                        'foto' => $fotoUrl,
                        'estado_registro' => 'Activo',
                        'estado' => $empleado['estado'],
                        'lider' => $empleado['lider']
                    ]
                );

                $usuario = DB::connection('mysql2')->table('users')->insertGetId([
                    'name' => $empleado['nombres'] . ' ' . $empleado['apellidos'],
                    'email' => $empleado['email'],
                    'password' => Hash::make($empleado['identificacion']),
                    'tipo_usuario' => 'Empleado',
                    'estado' => 'Activo',
                    'empleado' => $empleadoId,
                    'lider' => $empleado['lider'],
                    'foto' => $fotoUrl
                ]);
                //insertra en la tabla de usuario de chat empresarial
                DB::connection('mysql')->table('users')->insert([
                    'name' => $empleado['nombres'] . ' ' . $empleado['apellidos'],
                    'email' => $empleado['email'],
                    'password' => Hash::make($empleado['identificacion']),
                    'avatar' => 'otro.png',
                    'id_usuario_tarea' => $usuario
                ]);
            } else {
                $empleadoData = $empleado;
                $fotoUrl = $this->procesarFoto($empleadoData['foto'] ?? null);

                $updateResult = DB::connection('mysql2')->table('empleados')->where('id', $empleadoData['id'])->update([
                    'identificacion' => $empleadoData['identificacion'],
                    'nombres' => $empleadoData['nombres'],
                    'apellidos' => $empleadoData['apellidos'],
                    'email' => $empleadoData['email'],
                    'departamento' => $empleadoData['departamento'],
                    'empresa' => $empleadoData['empresa'],
                    'cargo' => $empleadoData['cargo'],
                    'telefono' => $empleadoData['telefono'],
                    'fecha_nacimiento' => $empleadoData['fecha_nacimiento'],
                    'fecha_ingreso' => $empleadoData['fecha_ingreso'],
                    'tipo_contrato' => $empleadoData['tipo_contrato'],
                    'direccion' => $empleadoData['direccion'],
                    'foto' => $fotoUrl,
                    'estado' => $empleadoData['estado'],
                    'lider' => $empleadoData['lider']
                ]);

                $usuario = DB::connection('mysql2')->table('users')->where('email', $empleadoData['email'])->update([
                    'name' => $empleadoData['nombres'] . ' ' . $empleadoData['apellidos'],
                    'email' => $empleadoData['email'],
                    'tipo_usuario' => 'Empleado',
                    'empleado' => $empleadoData['id'],
                    'lider' => $empleadoData['lider'],
                    'foto' => $fotoUrl
                ]);

                //insertra en la tabla de usuario de chat empresarial
                DB::connection('mysql')->table('users')->where('email', $empleadoData['email'])->update([
                    'name' => $empleadoData['nombres'] . ' ' . $empleadoData['apellidos'],
                    'email' => $empleadoData['email']
                ]);
            }


            // Auto-asignar al líder del departamento
            $deptId = ($empleado['accion'] == 'guardar') ? $empleado['departamento'] : $empleadoData['departamento'];
            $empId  = ($empleado['accion'] == 'guardar') ? $empleadoId : $empleadoData['id'];

            $dept = DB::connection('mysql2')->table('departamentos')
                ->where('id', $deptId)
                ->select('lider_id')
                ->first();

            if ($dept && $dept->lider_id && $dept->lider_id != $empId) {
                // Eliminar asignación anterior (cambio de departamento / reasignación)
                DB::connection('mysql2')->table('lideres_empleados')
                    ->where('empleado', $empId)
                    ->delete();

                DB::connection('mysql2')->table('lideres_empleados')->insert([
                    'lider'    => $dept->lider_id,
                    'empleado' => $empId,
                ]);
            }

            DB::connection('mysql2')->commit();

        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }

        return response()->json(['success' => 'Empleado guardado correctamente'], 200);
    }

    function eliminarEmpleado($id)
    {
        $empleado = DB::connection('mysql2')->table('empleados')
            ->where('id', $id)
            ->update([
                'estado_registro' => 'Eliminado'
            ]);
        return response()->json(['success' => 'Empleado eliminado correctamente'], 200);
    }

    function cargarFunciones($id)
    {
        $funciones = DB::connection('mysql2')->table('funciones_empleado')
            ->join('empleados', 'funciones_empleado.empleado', '=', 'empleados.id')
            ->select('funciones_empleado.*', 'empleados.nombres', 'empleados.apellidos')
            ->where('funciones_empleado.empleado', $id)
            ->where('funciones_empleado.estado', 'Activo')
            ->get();
        return response()->json($funciones);
    }

    function guardarFuncion(Request $request)
    {
        $funcionEmpleado = $request->all();
        DB::connection('mysql2')->beginTransaction();
        try {

            $funcion = DB::connection('mysql2')->table('funciones_empleado')->insert([
                'empleado' => $funcionEmpleado['empleado'],
                'descripcion' => $funcionEmpleado['funcion'],
                'estado' => 'Activo'
            ]);

            DB::connection('mysql2')->commit();
        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
        //obtener la ultima funcion insertada
        $funcion = DB::connection('mysql2')->table('funciones_empleado')
            ->where('empleado', $funcionEmpleado['empleado'])
            ->where('estado', 'Activo')
            ->orderBy('id', 'desc')
            ->first();
        return response()->json([
            'success' => 'Función guardada correctamente',
            'funcion' => $funcion
        ], 200);
    }

    function actualizarFuncion(Request $request, $id)
    {
        $funcionEmpleado = $request->all();
        $funcion = DB::connection('mysql2')->table('funciones_empleado')->where('id', $id)->update([
            'descripcion' => $funcionEmpleado['descripcion']
        ]);
        return response()->json(['success' => 'Función actualizada correctamente'], 200);
    }

    function cargarTareas($id)
    {
        $tareas = DB::connection('mysql2')->table('tareas_empleados')
            ->leftJoin('proyectos', 'tareas_empleados.proyecto_id', '=', 'proyectos.id')
            ->select('tareas_empleados.*', 'proyectos.nombre as proyecto_nombre')
            ->where('empleado', $id)
            ->where('estado_reg', 'Activo')
            ->orderByRaw("FIELD(prioridad, 'Alta', 'Media', 'Baja')")
            ->orderBy('tareas_empleados.id', 'desc')
            ->get();

        //obtener observaciones de las tareas
        $observaciones = DB::connection('mysql2')->table('observaciones_tareas')
            ->join('users', 'observaciones_tareas.creador', 'users.id')
            ->select('observaciones_tareas.*', 'users.name as creador')
            ->whereIn('id_tarea', $tareas->pluck('id'))
            ->orderBy('observaciones_tareas.fecha', 'desc')
            ->get();


        // Agregar observaciones a las tareas
        $tareas = $tareas->map(function ($tarea) use ($observaciones) {
            $tarea->observaciones = $observaciones->where('id_tarea', $tarea->id)->values();
            return $tarea;
        });



        // Obtener los IDs de las tareas
        $tareasIds = $tareas->pluck('id');

        // Obtener las evidencias relacionadas a esas tareas
        $evidencias = DB::connection('mysql2')->table('evidencia_tarea')
            ->whereIn('tarea', $tareasIds)
            ->get();

        // Agregar evidencias a las tareas
        $tareas = $tareas->map(function ($tarea) use ($evidencias) {
            $tarea->evidencias = $evidencias->where('tarea', $tarea->id)->values();
            return $tarea;
        });

        // Agregar conteos de subtareas
        $subtareasCounts = DB::connection('mysql2')->table('subtareas')
            ->whereIn('tarea_id', $tareasIds)
            ->select('tarea_id', DB::raw('COUNT(*) as subtareas_total'), DB::raw('SUM(completada) as subtareas_completadas'))
            ->groupBy('tarea_id')
            ->get()
            ->keyBy('tarea_id');

        $tareas = $tareas->map(function ($tarea) use ($subtareasCounts) {
            $counts = $subtareasCounts->get($tarea->id);
            $tarea->subtareas_total = $counts ? (int)$counts->subtareas_total : 0;
            $tarea->subtareas_completadas = $counts ? (int)$counts->subtareas_completadas : 0;
            return $tarea;
        });

        //obtener notificaciones de las tareas atrasadas
        self::obtenerNotificacionesTareasAtrasadas();


        return response()->json([
            'tareas' => $tareas
        ]);
    }

    function obtenerNotificacionesTareasAtrasadas()
    {
        $tareasAtrasadas = DB::connection('mysql2')->table('tareas_empleados')
            ->join('empleados', 'tareas_empleados.empleado', 'empleados.id')
            ->whereRaw('DATE(fecha_pactada) < CURDATE()')
            ->where('tareas_empleados.estado', '!=', 'Completada')
            ->where('tareas_empleados.estado_reg', 'Activo')
            ->where('tareas_empleados.pausada', 0)
            ->where('tareas_empleados.aprobada', 1)
            ->select(
                DB::connection('mysql2')->raw('CONCAT(empleados.nombres, " ", empleados.apellidos) as nombre_empleado'),
                'tareas_empleados.*'
            )
            ->get();

        foreach ($tareasAtrasadas as $tarea) {
            // Una sola notificación por tarea por día, independientemente de si fue leída
            $notificacionExistente = DB::connection('mysql2')->table('notif_generales')
                ->where('tarea_id', $tarea->id)
                ->where('tipo', 'TareaAtrasada')
                ->whereDate('fecha', now()->toDateString())
                ->first();

            //fecha Formateada
            $fechaPactada = date('d/m/Y', strtotime($tarea->fecha_pactada));

            if (!$notificacionExistente) {
                // Obtener el líder del empleado
                $lider = DB::connection('mysql2')->table('lideres_empleados')
                    ->where('empleado', $tarea->empleado)
                    ->first();

                if ($lider) {
                    // Obtener el usuario líder
                    $usuarioLider = DB::connection('mysql2')->table('users')
                        ->where('empleado', $lider->lider)
                        ->first();

                    if ($usuarioLider) {
                        // Crear la notificación para el líder
                        DB::connection('mysql2')->table('notif_generales')->insert([
                            'id_emisor' => $tarea->empleado,
                            'tipo_emisor' => 'empleado',
                            'id_receptor' => $usuarioLider->id,
                            'tipo_receptor' => 'usuario',
                            'mensaje' => 'El empleado ' . $tarea->nombre_empleado . ' tiene una tarea atrasada: ' . $tarea->titulo . ' (Fecha pactada: ' . $fechaPactada . ')',
                            'tarea_id' => $tarea->id,
                            'leido' => 0,
                            'fecha' => now(),
                            'tipo' => 'TareaAtrasada'
                        ]);
                    }
                } else {
                    // Si no hay líder, notificar al administrador
                    $admin = DB::connection('mysql2')->table('users')
                        ->where('tipo_usuario', 'Administrador')
                        ->where('lider_seguimiento', 'Si')
                        ->first();

                    if ($admin) {
                        DB::connection('mysql2')->table('notif_generales')->insert([
                            'id_emisor' => $tarea->empleado,
                            'tipo_emisor' => 'empleado',
                            'id_receptor' => $admin->id,
                            'tipo_receptor' => 'usuario',
                            'mensaje' => 'El empleado ' . $tarea->nombre_empleado . ' tiene una tarea atrasada: ' . $tarea->titulo . ' (Fecha pactada: ' . $fechaPactada . ')',
                            'tarea_id' => $tarea->id,
                            'leido' => 0,
                            'fecha' => now(),
                            'tipo' => 'TareaAtrasada'
                        ]);
                    }
                }
            }
        }
    }

    function guardarTarea(Request $request)
    {
        $accion = $request->input('accion', 'guardar');

        // Validación unificada en el servidor. Antes cada pantalla aplicaba sus
        // propias reglas en el cliente y ninguna se comprobaba aquí: Dashboard y
        // EmployeeModal exigían descripción >= 10 caracteres pero no fecha futura,
        // mientras EmployeeInterface exigía fecha futura pero no longitud mínima.
        //
        // Las reglas estrictas (longitud mínima y fecha no pasada) sólo se aplican
        // al crear. Al editar se relajan a propósito: existen tareas antiguas con
        // descripciones de pocos caracteres y con fecha pactada ya vencida, y
        // exigirles el formato nuevo impediría guardar cambios en campos ajenos.
        $reglas = [
            'titulo'        => 'required|string|max:255',
            'descripcion'   => 'required|string',
            'fecha_pactada' => 'required|date',
            'empleado'      => 'required|integer',
            'prioridad'     => 'required|string',
            'estado'        => 'required|string',
            'proyecto_id'   => 'nullable|integer',
            'accion'        => 'nullable|in:guardar,editar',
        ];
        if ($accion === 'guardar') {
            $reglas['descripcion']   = 'required|string|min:10';
            $reglas['fecha_pactada'] = 'required|date|after_or_equal:today';
        } else {
            $reglas['id'] = 'required|integer';
        }

        $request->validate($reglas, [
            'descripcion.min'                => 'La descripción debe tener al menos 10 caracteres.',
            'fecha_pactada.after_or_equal'   => 'La fecha pactada no puede ser anterior a hoy.',
        ]);

        $tarea = $request->all();
        DB::connection('mysql2')->beginTransaction();
        try {
            if ($accion == 'guardar') {
                $IdTarea = DB::connection('mysql2')->table('tareas_empleados')->insertGetId([
                    'titulo' => $tarea['titulo'],
                    'empleado' => $tarea['empleado'],
                    'descripcion' => $tarea['descripcion'],
                    'fecha_pactada' => $tarea['fecha_pactada'],
                    'prioridad' => $tarea['prioridad'],
                    'estado' => $tarea['estado'],
                    'estado_reg' => 'Activo',
                    'fecha_creacion' => now(),
                    'pausada' => 0,
                    'editable' => 1,
                    'proyecto_id' => $tarea['proyecto_id'] ?? null,
                ]);
            } else {
                DB::connection('mysql2')->table('tareas_empleados')->where('id', $tarea['id'])->update([
                    'titulo' => $tarea['titulo'],
                    'descripcion' => $tarea['descripcion'],
                    'fecha_pactada' => $tarea['fecha_pactada'],
                    'prioridad' => $tarea['prioridad'],
                    'estado' => $tarea['estado'],
                    'proyecto_id' => $tarea['proyecto_id'] ?? null,
                ]);
                $IdTarea = $tarea['id'];
            }

            /// isertar evidencia
            if (isset($tarea['evidencias']) && count($tarea['evidencias']) > 0) {
                $evidencias = $tarea['evidencias'];
                foreach ($evidencias as $evidencia) {
                    $evidencia = DB::connection('mysql2')->table('evidencia_tarea')->insert([
                        'tarea' => $IdTarea,
                        'evidencia' => $evidencia['ruta'],
                        'nombre' => $evidencia['nombre'],
                        'tipo' => $evidencia['tipo']
                    ]);
                }
            }

            //guardar notificacion solo al crear
            if ($accion == 'guardar') {
                self::guardarNotificacion($IdTarea, 'Tarea');
            }

            //consultar tareas del empleado
            DB::connection('mysql2')->commit();
        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }


        $tareas = DB::connection('mysql2')->table('tareas_empleados')
            ->leftJoin('proyectos', 'tareas_empleados.proyecto_id', '=', 'proyectos.id')
            ->select('tareas_empleados.*', 'proyectos.nombre as proyecto_nombre')
            ->where('empleado', $tarea['empleado'])
            ->orderBy('tareas_empleados.id', 'desc')
            ->get();

        return response()->json([
            'success' => 'Tarea guardada correctamente',
            'tarea_id' => $IdTarea,
            'tareas' => $tareas
        ], 200);
    }



    function buscarTareas($id, Request $request)
    {
        $searchTerm = $request->input('search');
        $tareas = DB::connection('mysql2')->table('tareas_empleados')
            ->leftJoin('proyectos', 'tareas_empleados.proyecto_id', '=', 'proyectos.id')
            ->select('tareas_empleados.*', 'proyectos.nombre as proyecto_nombre')
            ->where('empleado', $id)
            ->where('estado_reg', 'Activo')
            ->orderBy('tareas_empleados.id', 'desc')
            ->where(function ($query) use ($searchTerm) {
                $query->where('titulo', 'like', '%' . $searchTerm . '%')
                    ->orWhere('descripcion', 'like', '%' . $searchTerm . '%')
                    ->orWhere('estado', 'like', '%' . $searchTerm . '%')
                    ->orWhere('prioridad', 'like', '%' . $searchTerm . '%');
            })
            ->get();

        $tareasIds = $tareas->pluck('id');

        // Obtener las evidencias relacionadas a esas tareas
        $evidencias = DB::connection('mysql2')->table('evidencia_tarea')
            ->whereIn('tarea', $tareasIds)
            ->get();

        // Agregar evidencias a las tareas
        $tareas = $tareas->map(function ($tarea) use ($evidencias) {
            $tarea->evidencias = $evidencias->where('tarea', $tarea->id)->values();
            return $tarea;
        });

        // Agregar conteos de subtareas
        $subtareasCountsBuscar = DB::connection('mysql2')->table('subtareas')
            ->whereIn('tarea_id', $tareasIds)
            ->select('tarea_id', DB::raw('COUNT(*) as subtareas_total'), DB::raw('SUM(completada) as subtareas_completadas'))
            ->groupBy('tarea_id')
            ->get()
            ->keyBy('tarea_id');

        $tareas = $tareas->map(function ($tarea) use ($subtareasCountsBuscar) {
            $counts = $subtareasCountsBuscar->get($tarea->id);
            $tarea->subtareas_total = $counts ? (int)$counts->subtareas_total : 0;
            $tarea->subtareas_completadas = $counts ? (int)$counts->subtareas_completadas : 0;
            return $tarea;
        });

        return response()->json([
            'tareas' => $tareas
        ]);
    }

    function actualizarTarea(Request $request, $id)
    {
        $tarea = $request->all();
        DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
            'titulo'      => $tarea['titulo'],
            'descripcion' => $tarea['descripcion'],
            'fecha_pactada' => $tarea['fecha_pactada'],
            'prioridad'   => $tarea['prioridad'],
            'proyecto_id' => $tarea['proyecto_id'] ?? null,
        ]);
        // devolver proyecto_nombre para que el frontend actualice la vista
        $proyecto = null;
        if (!empty($tarea['proyecto_id'])) {
            $proyecto = DB::connection('mysql2')->table('proyectos')
                ->where('id', $tarea['proyecto_id'])
                ->value('nombre');
        }
        return response()->json([
            'success' => 'Tarea actualizada correctamente',
            'proyecto_nombre' => $proyecto,
        ], 200);
    }


    function actualizarEstadoTarea(Request $request, $id)
    {
        $tarea = $request->all();

        // Una tarea pausada no se mueve arrastrándola: primero debe reanudarse
        // por su flujo propio (pausarTarea con pausada=false), que además deja
        // constancia en el historial de actividad. Sin esta comprobación, mover
        // la tarjeta saltaba la reanudación y dejaba la tarea en un estado
        // contradictorio: activa según 'estado' pero marcada como pausada.
        $actual = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->first();
        if (!$actual) {
            return response()->json(['error' => 'Tarea no encontrada'], 404);
        }
        if ((int) ($actual->pausada ?? 0) === 1) {
            return response()->json([
                'error' => 'La tarea está en pausa. Debe reanudarse antes de cambiar su estado.',
                'pausada' => true,
            ], 409);
        }

        DB::connection('mysql2')->beginTransaction();
        try {
            if ($tarea['estado'] == 'Completada' &&  !empty($tarea['fecha_entregada'])) {
                $tareas = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
                    'estado' => $tarea['estado'],
                    'fecha_entregada' => $tarea['fecha_entregada']
                ]);
            } else {
                $tareas = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
                    'estado' => $tarea['estado']
                ]);
            }
            //insertar evidencias
            if (isset($tarea['evidencias'])) {
                foreach ($tarea['evidencias'] as $evidencia) {
                if($evidencia['tipo'] !== 'application/link'){
                        DB::connection('mysql2')->table('evidencia_tarea')->insert([
                            'tarea' => $id,
                            'evidencia' => $evidencia['ruta'],
                            'nombre' => $evidencia['nombre'],
                            'tipo' => $evidencia['tipo']
                        ]);
                    }
                }
            }

            //consultar evidencias de la tarea
            $evidencias = DB::connection('mysql2')->table('evidencia_tarea')->where('tarea', $id)->get();

            //consuktar tarea

            ///guardar notificacion
            self::guardarNotificacion($id, 'Estado');
            DB::connection('mysql2')->commit();
            return response()->json([
                'success' => 'Estado de la tarea actualizado correctamente',
                'evidencias' => $evidencias
            ], 200);
        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    function guardarNotificacion($idTarea, $tipo)
    {

        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $idTarea)->first();
        if (!$tarea) return;
        $titulo = $tarea->titulo;
        $empleado = $tarea->empleado;

        $usuarioActual = DB::connection('mysql2')->table('users')->where('email', Auth::user()->email)->first();
        // CASO 1: Empleado crea tarea

       
        if (
            $usuarioActual->tipo_usuario == 'Empleado' &&
            ($usuarioActual->lider == 'No' || is_null($usuarioActual->lider))
        ) {

            $empleado = DB::connection('mysql2')->table('empleados')
                ->join('users', 'empleados.id', 'users.empleado')
                ->select('empleados.*', 'users.id as id_usuario')
                ->where('users.id', $usuarioActual->id)->first();

            

            $lider = DB::connection('mysql2')->table('lideres_empleados')
                ->where('empleado', $empleado->id)
                ->first();


            if ($empleado && $lider && $lider->lider) {
                // Tiene líder → notificar al líder
                $receptor = DB::connection('mysql2')->table('empleados')
                    ->join('users', 'empleados.id', 'users.empleado')
                    ->select('users.*')
                    ->where('empleados.id', $lider->lider)->first();
                $tipoReceptor = 'empleado';
            } else {
                // No tiene líder → notificar a administrador
                $receptor = DB::connection('mysql2')->table('users')
                    ->where('tipo_usuario', 'Administrador')
                    ->select('users.*')
                    ->first();
                $tipoReceptor = 'usuario';
            }

            $tipoAccion = '';
            if ($tipo == 'Tarea') {
                $tipoAccion = ' ha creado una tarea.';
            } else if ($tipo == 'Estado') {
                $tipoAccion = ' ha actualizado el estado de la tarea a ' . $tarea->estado;
            }

            if ($receptor) {
                $mensaje = 'El empleado ' . $empleado->nombres . ' ' . $empleado->apellidos . $tipoAccion . ' (' . $titulo . ')';
                $notif = DB::connection('mysql2')->table('notif_generales')->insertGetId([
                    'id_emisor' => $empleado->id_usuario,
                    'tipo_emisor' => 'empleado',
                    'id_receptor' => $receptor->id,
                    'tipo_receptor' => $tipoReceptor,
                    'mensaje' => $mensaje,
                    'tarea_id' => $idTarea,
                    'leido' => 0,
                    'fecha' => now(),
                    'tipo' => $tipo
                ]);
            }

            // ----------------------------------------------
            // CASO 2: Líder o Administrador asigna tarea a otro
            // ----------------------------------------------
        } else if ($usuarioActual->lider == 'Si' || $usuarioActual->tipo_usuario == 'Administrador') {
            // $empleadoReceptor debe estar definido
            // Validamos si la tarea fue asignada a otra persona
            $empleadoReceptor = DB::connection('mysql2')->table('users')
                ->where('empleado', $empleado)
                ->first();

            $tipoAccion = '';
            if ($tipo == 'Tarea') {
                $tipoAccion = ' te ha asignado una tarea.';
            } else if ($tipo == 'Estado') {
                $tipoAccion = ' te ha actualizado el estado de la tarea a ' . $tarea->estado;
            } else if ($tipo == 'Aprobada') {
                if ($tarea->aprobada == 1) {
                    $tipoAccion = ' ha aprobado la tarea';
                } else {
                    $tipoAccion = ' ha definido la tarea como no aprobada';
                }
            } else if ($tipo == 'Rechazada') {
                $tipoAccion = ' ha rechazado la tarea';
            } else if ($tipo == 'VistoBueno') {
                $tipoAccion = ' ha generado un visto bueno para la tarea';
            } else if ($tipo == 'Observacion') {
                $tipoAccion = ' ha realizado observaciones a la tarea';
            } else if ($tipo == 'Reprogramada') {
                $tipoAccion = ' ha reprogramado la tarea';
            }


            if ($empleadoReceptor->id != $usuarioActual->id) {
                $mensaje = 'El usuario ' . $usuarioActual->name . $tipoAccion . ' (' . $titulo . ')';
                $notif = DB::connection('mysql2')->table('notif_generales')->insertGetId([
                    'id_emisor' => $usuarioActual->id,
                    'tipo_emisor' => 'usuario',
                    'id_receptor' => $empleadoReceptor->id,
                    'tipo_receptor' => 'empleado',
                    'mensaje' => $mensaje,
                    'tarea_id' => $idTarea,
                    'leido' => 0,
                    'fecha' => now(),
                    'tipo' => $tipo
                ]);
            } else {
                // ----------------------------------------------
                // CASO 3: Líder crea tarea para sí mismo
                // ----------------------------------------------
                $adminReceptor = DB::connection('mysql2')->table('users')
                    ->where('tipo_usuario', 'Administrador')
                    ->where('lider_seguimiento', 'Si')
                    ->first();

                $tipoAccion = '';
                if ($tipo == 'Tarea') {
                    $tipoAccion = ' ha creado una tarea.';
                } else if ($tipo == 'Estado') {
                    $tipoAccion = ' ha actualizado el estado de la tarea a ' . $tarea->estado;
                } else if ($tipo == 'Aprobada') {
                    if ($tarea->aprobada == 1) {
                        $tipoAccion = ' ha aprobado la tarea';
                    } else {
                        $tipoAccion = ' ha definido la tarea como no aprobada';
                    }
                } else if ($tipo == 'Rechazada') {
                    $tipoAccion = ' ha rechazado la tarea';
                } else if ($tipo == 'VistoBueno') {
                    $tipoAccion = ' ha generado un visto bueno para la tarea';
                } else if ($tipo == 'Observacion') {
                    $tipoAccion = ' ha realizado observaciones a la tarea';
                } else if ($tipo == 'Reprogramada') {
                    $tipoAccion = ' ha reprogramado la tarea';
                }

                if ($adminReceptor) {
                    $mensaje = 'El usuario ' . $usuarioActual->name . ' (líder) ' . $tipoAccion . ' (' . $titulo . ')';
                    $notif = DB::connection('mysql2')->table('notif_generales')->insertGetId([
                        'id_emisor' => $usuarioActual->id,
                        'tipo_emisor' => 'usuario',
                        'id_receptor' => $adminReceptor->id,
                        'tipo_receptor' => 'usuario',
                        'mensaje' => $mensaje,
                        'tarea_id' => $idTarea,
                        'leido' => 0,
                        'fecha' => now(),
                        'tipo' => $tipo
                    ]);
                }
            }
        }
    


        //enviar notificacion a los usuarios
        if ($tipo == 'Tarea' || ($tipo == 'Estado' && $tarea->estado == 'Completada') || $tipo == 'Aprobada' || $tipo == 'Rechazada' || $tipo == 'VistoBueno' || $tipo == 'Observacion' || $tipo == 'Reprogramada') {
           // self::enviarNotificacion($notif);
        }
    }

    function enviarNotificacion($notif)
    {
        $notificacion = DB::connection('mysql2')->table('notif_generales')->where('id', $notif)->first();
        $usuario = DB::connection('mysql2')->table('users')->where('id', $notificacion->id_receptor)->first();
        $usuarioReceptor = DB::connection('mysql2')->table('users')->where('id', $notificacion->id_receptor)->first();

        $notificacion = [
            'name' => $usuarioReceptor->name,
            'message' => $notificacion->mensaje,
            'tipo' => $notificacion->tipo,
            'emisor' => 'Lider'
        ];

        $email = $usuario->email;

        Mail::to($email)->send(new NotificacionMailable($notificacion));
        return response()->json(['success' => 'Notificación enviada correctamente'], 200);
    }

    function cargarEmpleadosTareas()
    {
        $empleados = DB::connection('mysql2')->table('empleados')
            ->where('estado_registro', 'Activo')
            ->where('empleados.estado', 'Activo')
            ->leftJoin("cargos", "empleados.cargo", "cargos.id")
            ->leftJoin("departamentos", "empleados.departamento", "departamentos.id")
            ->leftJoin("empresas", "empleados.empresa", "empresas.id")
            ->select("empleados.*", "cargos.nombre as cargo", "departamentos.nombre as departamento", "empresas.nombre as empresa")
            ->get()
            ->unique('id')
            ->values();

        $empleadosData = [];


        foreach ($empleados as $empleado) {
            // Obtener las tareas asignadas al empleado
            $tareas = DB::connection('mysql2')->table('tareas_empleados')
                ->leftJoin('proyectos', 'tareas_empleados.proyecto_id', '=', 'proyectos.id')
                ->select('tareas_empleados.*', 'proyectos.nombre as proyecto_nombre')
                ->where('empleado', $empleado->id)
                ->where('estado_reg', 'Activo')
                ->get();

            // Obtener las funciones del empleado
            $funciones = DB::connection('mysql2')->table('funciones_empleado')
                ->where('empleado', $empleado->id)
                ->where('estado', 'Activo')
                ->get();

            // Contar las tareas según su estado
            $tareasCompletadas = $tareas->where('estado', 'Completada')->count();
            $tareasPendientes = $tareas->where('estado', 'Pendiente')->count();
            $tareasEnProceso = $tareas->where('estado', 'En Proceso')->count();

            //CALCULAR TAREAS ATRASADAS si la fecha pactada es menor a la fecha actual
            $tareasAtrasadas = $tareas->filter(function ($t) {
                return $t->fecha_pactada
                    && $t->fecha_pactada < now()->toDateString()
                    && $t->estado !== 'Completada'
                    && !$t->pausada;
            })->count();

            //agregar evidencias a las tareas
            $evidencias = DB::connection('mysql2')->table('evidencia_tarea')->whereIn('tarea', $tareas->pluck('id'))->get();
            $tareas = $tareas->map(function ($tarea) use ($evidencias) {
                $tarea->evidencias = $evidencias->where('tarea', $tarea->id)->values();
                return $tarea;
            });

            //cargar observaciones de las tareas
            $observaciones = DB::connection('mysql2')->table('observaciones_tareas')
                ->join('users', 'observaciones_tareas.creador', 'users.id')
                ->select('observaciones_tareas.*', 'users.name as creador')
                ->whereIn('id_tarea', $tareas->pluck('id'))
                ->orderBy('observaciones_tareas.fecha', 'desc')
                ->get();

            //agregar observaciones a las tareas
            $tareas = $tareas->map(function ($tarea) use ($observaciones) {
                $tarea->observaciones = $observaciones->where('id_tarea', $tarea->id)->values();
                return $tarea;
            });

            // Agregar conteos de subtareas
            $subtareasCountsEmp = DB::connection('mysql2')->table('subtareas')
                ->whereIn('tarea_id', $tareas->pluck('id'))
                ->select('tarea_id', DB::raw('COUNT(*) as subtareas_total'), DB::raw('SUM(completada) as subtareas_completadas'))
                ->groupBy('tarea_id')
                ->get()
                ->keyBy('tarea_id');

            $tareas = $tareas->map(function ($tarea) use ($subtareasCountsEmp) {
                $counts = $subtareasCountsEmp->get($tarea->id);
                $tarea->subtareas_total = $counts ? (int)$counts->subtareas_total : 0;
                $tarea->subtareas_completadas = $counts ? (int)$counts->subtareas_completadas : 0;
                return $tarea;
            });

            // Calcular eficiencia y avance
            $totalTareas = $tareas->count();
            $eficiencia = $totalTareas > 0 ? round(($tareasCompletadas / $totalTareas) * 100, 2) : 0;
            $avance = $totalTareas > 0 ? round(($tareasCompletadas / $totalTareas) * 100, 2) : 0;

            //eficiencia operativa
            $inicioMes = date('Y-m-01'); // Primer día del mes actual
            $finMes = date('Y-m-t');     // Último día del mes actual


            $eficienciaOperativa = DB::connection('mysql2')->table('tareas_empleados')
                ->selectRaw('
                    COUNT(*) as total_completadas,
                    SUM(CASE WHEN fecha_entregada <= fecha_pactada THEN 1 ELSE 0 END) as completadas_a_tiempo,
                    ROUND(SUM(CASE WHEN fecha_entregada <= fecha_pactada THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as eficiencia
                ')
                ->where('estado', 'Completada')
                ->where('empleado', $empleado->id)
                ->whereBetween('fecha_entregada', [$inicioMes, $finMes])
                ->first();

            if ($eficienciaOperativa->eficiencia > 0) {
                $eficienciaOperativa = $eficienciaOperativa->eficiencia ?? 0;
            } else {
                $eficienciaOperativa = 0;
            }


            // Obtener últimas 3 tareas
            $tareasRecientes = $tareas->sortByDesc('fecha_creacion')->take(3)->map(function ($tarea) {
                return [
                    'id' => $tarea->id,
                    'titulo' => $tarea->titulo,
                    'estado' => $tarea->estado
                ];
            })->values();

            // Construir estructura
            $empleadosData[] = [
                'id' => $empleado->id,
                'nombre' => $empleado->nombres . ' ' . $empleado->apellidos,
                'cargo' => $empleado->cargo,
                'departamento' => $empleado->departamento,
                'empresa' => $empleado->empresa,
                'contacto' => [
                    'email' => $empleado->email,
                    'telefono' => $empleado->telefono
                ],
                'foto' => $empleado->foto,
                'tareas' => $tareas,
                'funciones' => $funciones,
                'rendimiento' => [
                    'tareasAsignadas' => $totalTareas,
                    'tareas' => [
                        'completadas' => $tareasCompletadas,
                        'pendientes' => $tareasPendientes,
                        'enProceso' => $tareasEnProceso,
                        'atrasadas' => $tareasAtrasadas
                    ],
                    'tiempoPromedioTarea' => '2.5 días', // Esto podrías calcularlo según la BD
                    'eficiencia' => $eficiencia,
                    'eficienciaOperativa' => $eficienciaOperativa,
                    'ultimaActividad' => $empleado->ultima_actividad ?? null,
                    'ranking' => rand(1, 10) // Puedes definir una lógica real para esto
                ],
                'avance' => $avance,
                'tareasRecientes' => $tareasRecientes
            ];
        }

        return response()->json($empleadosData);
    }

    function eliminarEvidencia($id)
    {
        $evidencia = DB::connection('mysql2')->table('evidencia_tarea')->where('id', $id)->delete();
        return response()->json(['success' => 'Evidencia eliminada correctamente'], 200);
    }

    function cargarTareaSeleccionada($id)
    {
        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->first();

        //obtener observaciones de las tareas
        $observaciones = DB::connection('mysql2')->table('observaciones_tareas')
            ->join('users', 'observaciones_tareas.creador', 'users.id')
            ->select('observaciones_tareas.*', 'users.name as creador')
            ->where('id_tarea', $tarea->id)
            ->orderBy('observaciones_tareas.fecha', 'desc')
            ->get();

        // Agregar observaciones a las tareas
        $tarea->observaciones = $observaciones;



        $evidencias = DB::connection('mysql2')->table('evidencia_tarea')->where('tarea', $id)->get();

        $tarea->evidencias = $evidencias;

        return response()->json($tarea);
    }

    function cambiarEstadoNotificacion(Request $request, $id)
    {
        $notificacion = $request->all();
        DB::connection('mysql2')->table('notif_generales')->where('id', $id)->update(['leido' => 1]);
        return response()->json(['success' => 'Notificación actualizada correctamente'], 200);
    }

    function realizarObservaciones(Request $request, $id)
    {
        $data = $request->all();
        $usuarioActual = DB::connection('mysql2')->table('users')->where('email', Auth::user()->email)->first();
        $observaciones = DB::connection('mysql2')->table('observaciones_tareas')->insert([
            'id_tarea' => $id,
            'observaciones' => $data['observaciones'],
            'fecha' => now(),
            'creador' => $usuarioActual->id
        ]);

        self::guardarNotificacion($id, 'Observacion');

        return response()->json(['success' => 'Observaciones realizadas correctamente'], 200);
    }




    function cargarUsuarios()
    {
        $usuarios = DB::connection('mysql2')->table('users')
            ->leftJoin('empleados', 'users.empleado', '=', 'empleados.id') // 🔹 LEFT JOIN para incluir admins
            ->select(
                'users.*',
                DB::connection('mysql2')->raw('IFNULL(CONCAT(empleados.nombres, " ", empleados.apellidos), "---") as nombre_empleado')
            )
            ->get();

        return response()->json($usuarios);
    }

    function buscarUsuarios(Request $request)
    {
        $searchTerm = $request->input('search');
        $usuarios = DB::connection('mysql2')->table('users')
            ->leftJoin('empleados', 'users.empleado', 'empleados.id')
            ->select(
                'users.*',
                DB::connection('mysql2')->raw('IFNULL(CONCAT(empleados.nombres, " ", empleados.apellidos), "---") as nombre_empleado')
            )
            ->where('users.estado', 'Activo')
            ->where(function ($query) use ($searchTerm) {
                $query->where('users.name', 'like', '%' . $searchTerm . '%')
                    ->orWhere('users.email', 'like', '%' . $searchTerm . '%')
                    ->orWhere('empleados.nombres', 'like', '%' . $searchTerm . '%')
                    ->orWhere('empleados.apellidos', 'like', '%' . $searchTerm . '%');
            })
            ->get();
        return response()->json($usuarios);
    }

    function listaEmpleados()
    {
        $empleados = DB::connection('mysql2')->table('empleados')
            ->where('estado_registro', 'Activo')
            ->select(
                'id',
                DB::connection('mysql2')->raw('CONCAT(nombres, " ", apellidos) as nombre')
            )
            ->get();
        return response()->json($empleados);
    }



    function guardarUsuario(Request $request)
    {
        $usuario = $request->all();
        if ($usuario['accion'] == 'guardar') {
            $fotoUrl = $this->procesarFoto($usuario['foto'] ?? null);
            $usuarioId = DB::connection('mysql2')->table('users')->insertGetId([
                'name' => $usuario['name'],
                'email' => $usuario['email'],
                'password' => Hash::make($usuario['password']),
                'tipo_usuario' => $usuario['role'],
                'empleado' => $usuario['empleado'],
                'estado' => $usuario['estado'],
                'foto' => $fotoUrl,
                'lider_seguimiento' => $usuario['lider_seguimiento']
            ]);

            //insertra en la tabla de usuario de chat empresarial
            DB::connection('mysql')->table('users')->insert([
                'name' => $usuario['name'],
                'email' => $usuario['email'],
                'password' => Hash::make($usuario['password']),
                'avatar' => 'otro.png',
                'id_usuario_tarea' => $usuarioId
            ]);
        } else {
            $fotoUrl = $this->procesarFoto($usuario['foto'] ?? null);

            if ($usuario['cambiar_password']) {
                $usuarios = DB::connection('mysql2')->table('users')->where('id', $usuario['id'])->update([
                    'name' => $usuario['name'],
                    'email' => $usuario['email'],
                    'password' => Hash::make($usuario['password']),
                    'tipo_usuario' => $usuario['role'],
                    'empleado' => $usuario['empleado'],
                    'estado' => $usuario['estado'],
                    'foto' => $fotoUrl,
                    'lider_seguimiento' => $usuario['lider_seguimiento']
                ]);

                DB::connection('mysql')->table('users')->where('id_usuario_tarea', $usuario['id'])->update([
                    'name' => $usuario['name'],
                    'email' => $usuario['email'],
                    'password' => Hash::make($usuario['password'])
                ]);
            } else {
                $usuarioUpdate = DB::connection('mysql2')->table('users')->where('id', $usuario['id'])->update([
                    'name' => $usuario['name'],
                    'email' => $usuario['email'],
                    'tipo_usuario' => $usuario['role'],
                    'empleado' => $usuario['empleado'],
                    'estado' => $usuario['estado'],
                    'foto' => $fotoUrl,
                    'lider_seguimiento' => $usuario['lider_seguimiento']
                ]);

                DB::connection('mysql')->table('users')->where('id_usuario_tarea', $usuario['id'])->update([
                    'name' => $usuario['name'],
                    'email' => $usuario['email']
                ]);
            }
        }
        return response()->json(['success' => 'Usuario guardado correctamente'], 200);
    }

    function eliminarUsuario($id)
    {
        $usuario = DB::connection('mysql2')->table('users')->where('id', $id)->delete();
        return response()->json(['success' => 'Usuario eliminado correctamente'], 200);
    }

    function buscarEmpresas(Request $request)
    {
        $searchTerm = $request->input('search');
        $empresas = DB::connection('mysql2')->table('empresas')
            ->where('nombre', 'like', '%' . $searchTerm . '%')
            ->where('estado', 'Activo')
            ->get();
        return response()->json($empresas);
    }

    function guardarEmpresa(Request $request)
    {
        $compania = $request->all();

        DB::connection('mysql2')->beginTransaction();
        try {
            if ($compania['accion'] == 'guardar') {
                $empresa = DB::connection('mysql2')->table('empresas')->insert([
                    'nombre' => $compania['nombre'],
                    'direccion' => $compania['direccion'],
                    'telefono' => $compania['telefono'],
                    'representante' => $compania['representante'],
                    'nit' => $compania['nit'],
                    'logo' => $compania['logo'],
                    'estado' => 'ACTIVO'
                ]);

                if (!$empresa) {
                    throw new \Exception('Error al guardar la empresa');
                }
            } else {
                $empresa = DB::connection('mysql2')->table('empresas')->where('id', $compania['id'])->update([
                    'nombre' => $compania['nombre'],
                    'direccion' => $compania['direccion'],
                    'telefono' => $compania['telefono'],
                    'representante' => $compania['representante'],
                    'nit' => $compania['nit'],
                    'logo' => $compania['logo']
                ]);

                if ($empresa === false) {
                    throw new \Exception('Error al actualizar la empresa');
                }
            }

            DB::connection('mysql2')->commit();
            return response()->json(['success' => 'Empresa guardada correctamente'], 200);
        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    function eliminarEmpresa($id)
    {
        $empresa = DB::connection('mysql2')->table('empresas')->where('id', $id)->update([
            'estado' => 'ELIMINADO'
        ]);
        return response()->json(['success' => 'Empresa eliminada correctamente'], 200);
    }

    function cargarLideres()
    {
        $lideres = DB::connection('mysql2')->table('empleados')
            ->join('empresas', 'empleados.empresa', '=', 'empresas.id')
            ->join('departamentos as dept_propio', 'empleados.departamento', '=', 'dept_propio.id')
            ->join('cargos', 'empleados.cargo', '=', 'cargos.id')
            // solo empleados que son lider_id de algún departamento
            ->whereExists(function ($q) {
                $q->select(DB::raw(1))
                  ->from('departamentos')
                  ->whereColumn('departamentos.lider_id', 'empleados.id');
            })
            ->select(
                'empleados.*',
                'empresas.nombre as nombre_empresa',
                'dept_propio.nombre as nombre_departamento',
                'cargos.nombre as nombre_cargo',
                DB::connection('mysql2')->raw('(SELECT COUNT(*) FROM lideres_empleados WHERE lider = empleados.id) as empleados_asignados')
            )
            ->where('empleados.estado_registro', 'Activo')
            ->get();
        return response()->json($lideres);
    }

    function cargarEmpleadosLider($id)
    {
        $empleados = DB::connection('mysql2')->table('lideres_empleados')
            ->join('empleados', 'lideres_empleados.empleado', '=', 'empleados.id')
            ->select('empleados.*', 'lideres_empleados.lider')
            ->where('lideres_empleados.lider', $id)
            ->where('empleados.estado_registro', 'Activo')
            ->get();
        return response()->json($empleados);
    }

    function guardarAsignacionesLider(Request $request)
    {
        $asignaciones = $request->all();
        $liderId = $asignaciones['lider_id'];
        $empleados = $asignaciones['empleados'];

        //eliminar las asignaciones anteriores
        DB::connection('mysql2')->table('lideres_empleados')->where('lider', $liderId)->delete();

        foreach ($empleados as $empleado) {
            $empleadoId = $empleado['id'];

            $asignacion = DB::connection('mysql2')->table('lideres_empleados')->insert([
                'lider' => $liderId,
                'empleado' => $empleadoId
            ]);
        }

        return response()->json(['success' => 'Asignaciones guardadas correctamente'], 200);
    }

    function informeTareas()
    {
        $alcance = $this->alcanceEmpleadosInformes();

        // Los joins con empleados y sus tablas asociadas son LEFT: hay tareas
        // activas cuyo empleado ya no figura en 'empleados' —personas dadas de
        // baja cuyo registro se eliminó— y con INNER JOIN quedaban fuera del
        // informe sin dejar rastro. El trabajo realizado sigue contando aunque
        // su responsable haya salido; el nombre se recupera de 'users'.
        $tareas = DB::connection('mysql2')->table('tareas_empleados')
            ->leftJoin('empleados', function ($join) {
                $join->on('tareas_empleados.empleado', '=', 'empleados.id')
                     ->where('empleados.estado_registro', 'Activo')
                     ->where('empleados.estado', 'Activo');
            })
            ->leftJoin('users', 'tareas_empleados.empleado', '=', 'users.empleado')
            ->leftJoin('empresas', 'empleados.empresa', '=', 'empresas.id')
            ->leftJoin('departamentos', 'empleados.departamento', '=', 'departamentos.id')
            ->leftJoin('cargos', 'empleados.cargo', '=', 'cargos.id')
            ->select(
                'tareas_empleados.*',
                DB::connection('mysql2')->raw(
                    'COALESCE(NULLIF(TRIM(CONCAT(COALESCE(empleados.nombres, ""), " ", COALESCE(empleados.apellidos, ""))), ""), users.name, "Sin responsable") as empleado'
                ),
                'empresas.nombre as empresa',
                'departamentos.nombre as departamento',
                'cargos.nombre as cargo'
            )
            ->where('aprobada', 1)
            ->where('estado_reg', 'Activo')
            ->when($alcance !== null, function ($q) use ($alcance) {
                $q->whereIn('tareas_empleados.empleado', $alcance);
            })
            ->get();

        return response()->json($tareas);
    }

    function informeEficiencia()
    {
        $alcance = $this->alcanceEmpleadosInformes();

        // Mismo criterio que informeTareas: con INNER JOIN se perdían las tareas
        // de empleados ya eliminados, lo que falseaba el cálculo de eficiencia al
        // dejar fuera trabajo realmente entregado.
        $tareas = DB::connection('mysql2')->table('tareas_empleados')
            ->leftJoin('empleados', function ($join) {
                $join->on('tareas_empleados.empleado', '=', 'empleados.id')
                     ->where('empleados.estado_registro', 'Activo')
                     ->where('empleados.estado', 'Activo');
            })
            ->leftJoin('users', 'tareas_empleados.empleado', '=', 'users.empleado')
            ->leftJoin('cargos', 'empleados.cargo', '=', 'cargos.id')
            ->leftJoin('departamentos', 'empleados.departamento', '=', 'departamentos.id')
            ->select(
                'tareas_empleados.id',
                'tareas_empleados.estado',
                'tareas_empleados.fecha_pactada',
                'tareas_empleados.fecha_entregada',
                'tareas_empleados.rechazada',
                'tareas_empleados.pausada',
                DB::connection('mysql2')->raw(
                    'COALESCE(NULLIF(TRIM(CONCAT(COALESCE(empleados.nombres, ""), " ", COALESCE(empleados.apellidos, ""))), ""), users.name, "Sin responsable") as nombre_empleado'
                ),
                'cargos.nombre as cargo',
                'departamentos.nombre as departamento'
            )
            ->where('tareas_empleados.estado_reg', 'Activo')
            ->when($alcance !== null, function ($q) use ($alcance) {
                $q->whereIn('tareas_empleados.empleado', $alcance);
            })
            // Se ordena por la columna de la tarea y no por empleados.id, que con
            // el LEFT JOIN puede ser NULL y dispersaría las filas de un mismo
            // responsable eliminado.
            ->orderBy('tareas_empleados.empleado')
            ->get();

        return response()->json($tareas);
    }

    function informeProyectos()
    {
        $alcance = $this->alcanceEmpleadosInformes();

        // Proyectos con sus tareas activas.
        // El alcance se aplica dentro del leftJoin (no en el where) para que un
        // proyecto siga apareciendo aunque ninguna de sus tareas sea visible
        // para el usuario; de lo contrario el filtro convertiría el leftJoin en
        // un inner join y descartaría proyectos completos.
        $rows = DB::connection('mysql2')->table('proyectos')
            ->leftJoin('tareas_empleados', function ($join) use ($alcance) {
                $join->on('tareas_empleados.proyecto_id', '=', 'proyectos.id')
                     ->where('tareas_empleados.estado_reg', 'Activo');
                if ($alcance !== null) {
                    $join->whereIn('tareas_empleados.empleado', $alcance);
                }
            })
            ->leftJoin('empleados', function ($join) {
                $join->on('tareas_empleados.empleado', '=', 'empleados.id')
                     ->where('empleados.estado_registro', 'Activo')
                     ->where('empleados.estado', 'Activo');
            })
            ->leftJoin('departamentos', 'empleados.departamento', '=', 'departamentos.id')
            ->select(
                'proyectos.id as proyecto_id',
                'proyectos.nombre as proyecto_nombre',
                'proyectos.estado as proyecto_estado',
                'proyectos.fecha_inicio',
                'proyectos.fecha_fin_estimada',
                'tareas_empleados.id as tarea_id',
                'tareas_empleados.titulo',
                'tareas_empleados.estado',
                'tareas_empleados.fecha_pactada',
                'tareas_empleados.fecha_entregada',
                'tareas_empleados.rechazada',
                'tareas_empleados.pausada',
                DB::connection('mysql2')->raw('CONCAT(empleados.nombres, " ", empleados.apellidos) AS nombre_empleado'),
                'departamentos.nombre as departamento'
            )
            ->orderBy('proyectos.nombre')
            ->orderBy('tareas_empleados.id')
            ->get();

        // Agrupar por proyecto
        $proyectos = [];
        foreach ($rows as $row) {
            $pid = $row->proyecto_id;
            if (!isset($proyectos[$pid])) {
                $proyectos[$pid] = [
                    'id'                 => $pid,
                    'nombre'             => $row->proyecto_nombre,
                    'estado'             => $row->proyecto_estado,
                    'fecha_inicio'       => $row->fecha_inicio,
                    'fecha_fin_estimada' => $row->fecha_fin_estimada,
                    'tareas'             => [],
                ];
            }
            if ($row->tarea_id) {
                $proyectos[$pid]['tareas'][] = [
                    'id'              => $row->tarea_id,
                    'titulo'          => $row->titulo,
                    'estado'          => $row->estado,
                    'fecha_pactada'   => $row->fecha_pactada,
                    'fecha_entregada' => $row->fecha_entregada,
                    'rechazada'       => $row->rechazada,
                    'pausada'         => $row->pausada,
                    'empleado'        => $row->nombre_empleado,
                    'departamento'    => $row->departamento,
                ];
            }
        }

        return response()->json(array_values($proyectos));
    }

    function verificarEmpleadoLider($id)
    {
        $empleado = DB::connection('mysql2')->table('lideres_empleados')->where('empleado', $id)->first();
        if ($empleado) {
            return response()->json(['existe' => true]);
        } else {
            return response()->json(['existe' => false]);
        }
    }

    function eliminarFuncion($id)
    {
        $funcion = DB::connection('mysql2')->table('funciones_empleado')->where('id', $id)->delete();
        return response()->json(['success' => 'Funcion eliminada correctamente'], 200);
    }

    function cargarActividades($id)
    {
        $actividades = DB::connection('mysql2')->table('actividades_empleado')->where('empleado', $id)->get();
        return response()->json($actividades);
    }

    function guardarActividad(Request $request)
    {
        $actividadActual = $request->all();
        $actividad = DB::connection('mysql2')->table('actividades_empleado')->insert([
            'empleado' => $actividadActual['empleado'],
            'descripcion' => $actividadActual['actividad']
        ]);

        $actividad = DB::connection('mysql2')->table('actividades_empleado')
            ->where('empleado', $actividadActual['empleado'])
            ->orderBy('id', 'desc')
            ->first();

        return response()->json(['success' => 'Actividad guardada correctamente', 'actividad' => $actividad], 200);
    }

    function eliminarActividad($id)
    {
        $actividad = DB::connection('mysql2')->table('actividades_empleado')->where('id', $id)->delete();
        return response()->json(['success' => 'Actividad eliminada correctamente'], 200);
    }

    function actualizarActividad($id, Request $request)
    {
        $actividadActual = $request->all();
        $actividad = DB::connection('mysql2')->table('actividades_empleado')->where('id', $id)->update([
            'descripcion' => $actividadActual['descripcion']
        ]);

        return response()->json(['success' => 'Actividad actualizada correctamente'], 200);
    }

    function vistoBueno(Request $request, $id)
    {
        $data = $request->all();
        //dd($data);
        //manejo de errores
        try {

            DB::connection('mysql2')->table('tareas_empleados')
                ->where('id', $id)
                ->update([
                    'visto_bueno' => (int) filter_var($data['visto_bueno'], FILTER_VALIDATE_BOOLEAN),
                    'rechazada' => '0'
                ]);

            self::guardarNotificacion($id, 'VistoBueno');


            return response()->json(['success' => 'Visto bueno actualizado correctamente'], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    function rechazarTarea($id, Request $request)
    {

        $data = $request->all();
       // dd($data);
        try {

            DB::connection('mysql2')->table('tareas_empleados')
                ->where('id', $id)
                ->update([
                    'rechazada' => (int) filter_var($data['rechazada'], FILTER_VALIDATE_BOOLEAN),
                    'visto_bueno' => '0',
                    'estado' => $data['rechazada'] ? 'En Proceso' : 'Completada'
                ]);

            self::guardarNotificacion($id, 'Rechazada');

            return response()->json(['success' => 'Tarea rechazada correctamente'], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    function aprobarTarea($id, Request $request)
    {
        $data = $request->all();
        if ($data['aprobada']) {
            $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
                'aprobada' => (int) filter_var($data['aprobada'], FILTER_VALIDATE_BOOLEAN),
                'fecha_aprobacion' => $data['aprobada'] ? now() : null,
                'editable' => 0
            ]);

            self::guardarNotificacion($id, 'Aprobada');
        } else {
            $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
                'aprobada' => (int) filter_var($data['aprobada'], FILTER_VALIDATE_BOOLEAN),
                'fecha_aprobacion' => $data['aprobada'] ? now() : null,
                'editable' => 1
            ]);
        }
        return response()->json(['success' => 'Tarea aprobada correctamente'], 200);
    }
    function habilitarEdicion($id, Request $request)
    {
        $data = $request->all();

        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
            'editable' => (int) filter_var($data['editable'], FILTER_VALIDATE_BOOLEAN),
        ]);

        return response()->json(['success' => 'Tarea habilitada correctamente'], 200);
    }



    function pausarTarea($id, Request $request)
    {
        $data = $request->all();
        try {
            $pausada = (int) filter_var($data['pausada'], FILTER_VALIDATE_BOOLEAN);
            $update = ['pausada' => $pausada];
            if (!$pausada) {
                $row = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->first();
                $cols = array_column(
                    DB::connection('mysql2')->select("SHOW COLUMNS FROM tareas_empleados"),
                    'Field'
                );
                if (in_array('fecha_reprogramacion', $cols)) {
                    $update['fecha_reprogramacion'] = null;
                }
                if (in_array('motivo_reprogramacion', $cols) && $row && !(int)($row->reprogramada ?? 0)) {
                    $update['motivo_reprogramacion'] = null;
                }
            }
            DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update($update);
            $actor = DB::connection('mysql2')->table('users')->where('email', Auth::user()->email)->value('name') ?? 'Usuario';
            $motivo = trim($data['motivo'] ?? '');
            $motivoStr = $motivo ? " Motivo: {$motivo}." : '';
            if ($pausada) {
                $this->registrarActividad($id, 'Pausada', "Tarea pausada por {$actor}.{$motivoStr}");
            } else {
                $this->registrarActividad($id, 'Reanudada', "Tarea reanudada por {$actor}.{$motivoStr}");
            }
            return response()->json(['success' => 'Estado de pausa actualizado correctamente'], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Solicitud de pausa con motivo y fecha de reanudación esperada.
     * Envía correo: empleado → su líder; líder → administrador de seguimiento.
     */
    public function solicitarPausa(Request $request)
    {
        $data = $request->validate([
            'tarea_id' => 'required|integer',
            'motivo' => 'required|string|min:3|max:5000',
            'fecha_reanudacion' => 'required|date',
        ]);

        $usuarioActual = DB::connection('mysql2')->table('users')->where('email', Auth::user()->email)->first();
        if (!$usuarioActual) {
            return response()->json(['ok' => false, 'mensaje' => 'Usuario no encontrado'], 403);
        }

        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $data['tarea_id'])->first();
        if (!$tarea) {
            return response()->json(['ok' => false, 'mensaje' => 'Tarea no encontrada'], 404);
        }

        $esDueño = $usuarioActual->empleado && (int) $usuarioActual->empleado === (int) $tarea->empleado;
        $esAdmin = strcasecmp($usuarioActual->tipo_usuario ?? '', 'Administrador') === 0;
        $esLiderDeAsignado = false;
        if (!$esDueño && !$esAdmin && $usuarioActual->empleado) {
            $esLiderDeAsignado = DB::connection('mysql2')->table('lideres_empleados')
                ->where('lider', $usuarioActual->empleado)
                ->where('empleado', $tarea->empleado)
                ->exists();
        }
        if (!$esDueño && !$esAdmin && !$esLiderDeAsignado) {
            return response()->json(['ok' => false, 'mensaje' => 'No autorizado para solicitar pausa en esta tarea'], 403);
        }

        $usuarioEsLider = $this->usuarioEsLiderParaNotificaciones($usuarioActual) || $esLiderDeAsignado;

        // Verificar que no haya solicitud pendiente
        $pendiente = DB::connection('mysql2')->table('pausas_solicitadas')
            ->where('tarea_id', $data['tarea_id'])
            ->where('estado', 'Pendiente')
            ->exists();
        if ($pendiente) {
            return response()->json(['ok' => false, 'mensaje' => 'Ya existe una solicitud de pausa pendiente para esta tarea.'], 422);
        }

        $tipoAprobador = $usuarioEsLider ? 'admin' : 'lider';

        DB::connection('mysql2')->table('pausas_solicitadas')->insert([
            'tarea_id'            => $data['tarea_id'],
            'solicitado_por'      => $usuarioActual->empleado ?? null,
            'solicitado_por_user' => $usuarioActual->id,
            'motivo'              => $data['motivo'],
            'fecha_reanudacion'   => Carbon::parse($data['fecha_reanudacion'])->toDateString(),
            'estado'              => 'Pendiente',
            'tipo_aprobador'      => $tipoAprobador,
            'fecha_solicitud'     => now(),
        ]);

        $fechaFmt = Carbon::parse($data['fecha_reanudacion'])->format('d/m/Y');
        $this->registrarActividad(
            $data['tarea_id'],
            'Pausa solicitada',
            "Pausa solicitada por {$usuarioActual->name}. Motivo: {$data['motivo']} — Reanudación estimada: {$fechaFmt}."
        );

        $this->notificarSolicitudPausa($tarea, $usuarioActual, $data['motivo'], $data['fecha_reanudacion']);

        return response()->json(['ok' => true, 'mensaje' => 'Solicitud de pausa enviada correctamente'], 201);
    }

    function resolverSolicitudPausa(Request $request, $id)
    {
        // aprobado_por se acepta por compatibilidad con el frontend pero NO se usa:
        // el resolutor se deriva del usuario autenticado.
        $data = $request->validate([
            'accion'               => 'required|in:aprobar,rechazar',
            'aprobado_por'         => 'nullable|integer',
            'observacion_rechazo'  => 'nullable|string',
        ]);

        $solicitud = DB::connection('mysql2')->table('pausas_solicitadas')->where('id', $id)->first();
        if (!$solicitud) {
            return response()->json(['message' => 'Solicitud no encontrada'], 404);
        }
        if ($solicitud->estado !== 'Pendiente') {
            return response()->json(['message' => 'La solicitud ya fue resuelta'], 422);
        }

        $tareaPausa = DB::connection('mysql2')->table('tareas_empleados')->where('id', $solicitud->tarea_id)->first();
        $resolutor = $this->resolutorAutorizado($tareaPausa);
        if (!$resolutor) {
            return response()->json(['message' => 'No autorizado para resolver esta solicitud'], 403);
        }

        $estado = $data['accion'] === 'aprobar' ? 'Aprobada' : 'Rechazada';

        DB::connection('mysql2')->table('pausas_solicitadas')->where('id', $id)->update([
            'estado'              => $estado,
            'aprobado_por'        => $resolutor->id,
            'observacion_rechazo' => $data['observacion_rechazo'] ?? null,
            'fecha_resolucion'    => now(),
        ]);

        $aprobadorNombre = $resolutor->name ?? 'Usuario';

        if ($data['accion'] === 'aprobar') {
            $update = ['pausada' => 1];
            $cols = array_column(
                DB::connection('mysql2')->select("SHOW COLUMNS FROM tareas_empleados"),
                'Field'
            );
            if (in_array('motivo_reprogramacion', $cols)) {
                $update['motivo_reprogramacion'] = $solicitud->motivo;
            }
            if (in_array('fecha_reprogramacion', $cols)) {
                $update['fecha_reprogramacion'] = Carbon::parse($solicitud->fecha_reanudacion)->startOfDay();
            }
            DB::connection('mysql2')->table('tareas_empleados')->where('id', $solicitud->tarea_id)->update($update);

            $fechaFmt = Carbon::parse($solicitud->fecha_reanudacion)->format('d/m/Y');
            $this->registrarActividad(
                $solicitud->tarea_id,
                'Pausa aprobada',
                "Pausa aprobada por {$aprobadorNombre}. Reanudación estimada: {$fechaFmt}."
            );
        } else {
            $obs = $data['observacion_rechazo'] ? " Observación: {$data['observacion_rechazo']}." : '';
            $this->registrarActividad(
                $solicitud->tarea_id,
                'Pausa rechazada',
                "Solicitud de pausa rechazada por {$aprobadorNombre}.{$obs}"
            );
        }

        return response()->json(['message' => ucfirst($estado) . ' correctamente']);
    }

    function historialPausas($tareaId)
    {
        $rows = DB::connection('mysql2')->table('pausas_solicitadas as p')
            ->leftJoin('empleados as e', 'p.solicitado_por', '=', 'e.id')
            ->leftJoin('users as ua', 'p.aprobado_por', '=', 'ua.id')
            ->leftJoin('empleados as ea', 'ua.empleado', '=', 'ea.id')
            ->select(
                'p.*',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre_solicitante'),
                DB::connection('mysql2')->raw('CONCAT(ea.nombres, " ", ea.apellidos) as nombre_aprobador')
            )
            ->where('p.tarea_id', $tareaId)
            ->orderBy('p.fecha_solicitud', 'desc')
            ->get();

        return response()->json($rows);
    }

    /**
     * Estado completo del Tablero de Seguimiento.
     *
     * Devuelve en una sola respuesta las columnas del kanban, los KPIs, la carga
     * del equipo, las alertas de vencimiento y las próximas entregas, todo
     * restringido al alcance del usuario autenticado (ver alcanceEmpleadosInformes).
     *
     * El frontend consulta este endpoint periódicamente y deriva las animaciones
     * comparando la respuesta con la anterior, por lo que aquí no se emite ningún
     * evento: la respuesta describe el estado actual completo, no un delta.
     */
    function tableroEstado(Request $request)
    {
        $conn = DB::connection('mysql2');
        $alcance = $this->alcanceEmpleadosInformes();
        $dias = max(1, min(365, (int) $request->query('dias', 7)));
        $hoy = Carbon::today();

        // Base común: tareas vivas y no archivadas dentro del alcance.
        // archivar admite NULL en la mayoría de filas históricas, por lo que la
        // comparación debe contemplarlo explícitamente: 'archivar <> 1' por sí
        // solo descarta los NULL y vaciaría el tablero.
        // El join con empleados es LEFT y su filtro de actividad va dentro de la
        // condición: hay 150 tareas activas cuyo empleado ya no existe en la
        // tabla, y un INNER JOIN las descartaba del tablero sin dejar rastro.
        // Una tarea sigue siendo trabajo pendiente aunque su responsable haya
        // salido; se muestra con el responsable sin resolver.
        $base = function () use ($conn, $alcance) {
            $q = $conn->table('tareas_empleados as t')
                ->leftJoin('empleados as e', function ($join) {
                    $join->on('t.empleado', '=', 'e.id')
                         ->where('e.estado_registro', 'Activo')
                         ->where('e.estado', 'Activo');
                })
                // Respaldo del nombre: si el empleado ya no está en 'empleados'
                // pero conserva su usuario, se recupera de ahí en lugar de dejar
                // la tarjeta sin responsable.
                ->leftJoin('users as u', 't.empleado', '=', 'u.empleado')
                ->leftJoin('proyectos as p', 't.proyecto_id', '=', 'p.id')
                ->where('t.estado_reg', 'Activo')
                ->where(function ($w) {
                    $w->whereNull('t.archivar')->orWhere('t.archivar', '<>', 1);
                });
            if ($alcance !== null) {
                $q->whereIn('t.empleado', $alcance);
            }
            return $q->select(
                't.id',
                't.titulo',
                't.estado',
                't.prioridad',
                't.fecha_pactada',
                't.fecha_entregada',
                't.pausada',
                't.rechazada',
                't.visto_bueno',
                't.motivo_reprogramacion',
                't.empleado as empleado_id',
                'p.nombre as proyecto_nombre',
                'u.name as empleado_usuario',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as empleado')
            );
        };

        // Una tarea sólo cuenta como pausada si además sigue sin resolverse. El
        // sistema no limpia la bandera 'pausada' al cambiar de estado
        // (actualizarEstadoTarea escribe únicamente 'estado'), así que una tarea
        // reanudada o cerrada puede arrastrarla indefinidamente. Sin esta
        // condición la tarjeta se quedaría atrapada en "En Pausa" pese a haber
        // vuelto a "En Proceso": el estado explícito manda sobre la bandera.
        $estaPausada = function ($q) {
            return $q->where('t.pausada', 1)
                ->whereNotIn('t.estado', ['Completada', 'En Proceso']);
        };

        $noPausada = function ($q) {
            return $q->where(function ($w) {
                $w->whereNull('t.pausada')
                  ->orWhere('t.pausada', '<>', 1)
                  ->orWhereIn('t.estado', ['Completada', 'En Proceso']);
            });
        };

        // Avance por checklist, en una única consulta agregada para no repetir un
        // conteo por tarjeta. Sólo unas pocas tareas tienen subtareas, así que el
        // mapa resultante es pequeño; las que no aparecen simplemente no muestran
        // porcentaje.
        $avances = $conn->table('subtareas')
            ->select('tarea_id',
                DB::connection('mysql2')->raw('COUNT(*) as total'),
                DB::connection('mysql2')->raw('SUM(CASE WHEN completada = 1 THEN 1 ELSE 0 END) as hechas'))
            ->groupBy('tarea_id')
            ->get()
            ->keyBy('tarea_id');

        $mapear = function ($rows) use ($hoy, $avances) {
            return collect($rows)->map(function ($t) use ($hoy, $avances) {
                $dias = null;
                if ($t->fecha_pactada) {
                    $dias = $hoy->diffInDays(Carbon::parse($t->fecha_pactada)->startOfDay(), false);
                }

                // Avance sólo cuando la tarea tiene checklist; el resto queda en null
                // y la tarjeta no dibuja barra alguna.
                $checklist = null;
                $a = $avances[$t->id] ?? null;
                if ($a && (int) $a->total > 0) {
                    $checklist = [
                        'total'  => (int) $a->total,
                        'hechas' => (int) $a->hechas,
                        'pct'    => (int) round($a->hechas / $a->total * 100),
                    ];
                }

                return [
                    'id'              => (int) $t->id,
                    'titulo'          => $t->titulo,
                    'estado'          => $t->estado,
                    'prioridad'       => $t->prioridad,
                    'fecha_pactada'   => $t->fecha_pactada,
                    'fecha_entregada' => $t->fecha_entregada,
                    'empleado_id'     => (int) $t->empleado_id,
                    // Con el LEFT JOIN el nombre llega nulo si el empleado ya no
                    // está en 'empleados': se recurre al de su usuario y, sólo si
                    // tampoco existe, se indica que no tiene responsable.
                    'empleado'        => $t->empleado ?: ($t->empleado_usuario ?: 'Sin responsable'),
                    'proyecto'        => $t->proyecto_nombre,
                    // Coherente con el criterio de la columna "En Pausa": una tarea
                    // reanudada o cerrada no se pinta como pausada aunque conserve
                    // la bandera de una pausa anterior.
                    'pausada'         => (int) ($t->pausada ?? 0) === 1
                                          && !in_array($t->estado, ['Completada', 'En Proceso'], true),
                    'motivo'          => $t->motivo_reprogramacion,
                    'dias_restantes'  => $dias,
                    'checklist'       => $checklist,
                ];
            })->values();
        };

        $pendiente = $mapear($noPausada($base())->where('t.estado', 'Pendiente')->orderBy('t.fecha_pactada')->get());
        $proceso   = $mapear($noPausada($base())->where('t.estado', 'En Proceso')->orderBy('t.fecha_pactada')->get());
        $pausa = $mapear($estaPausada($base())->orderBy('t.fecha_pactada')->get());

        // Completadas dentro de la ventana; si no hay ninguna (histórico inactivo)
        // se degrada a las últimas completadas para no dejar la columna vacía.
        $desde = $hoy->copy()->subDays($dias)->toDateString();
        $completadas = $mapear(
            $base()->where('t.estado', 'Completada')
                ->whereNotNull('t.fecha_entregada')
                ->whereDate('t.fecha_entregada', '>=', $desde)
                ->orderByDesc('t.fecha_entregada')->get()
        );
        $modoCompletadas = 'ventana';
        if ($completadas->isEmpty()) {
            $completadas = $mapear(
                $base()->where('t.estado', 'Completada')
                    ->whereNotNull('t.fecha_entregada')
                    ->orderByDesc('t.fecha_entregada')->limit(8)->get()
            );
            $modoCompletadas = $completadas->isEmpty() ? 'vacio' : 'fallback';
        }

        $activas = $pendiente->count() + $proceso->count() + $pausa->count();
        $totalCiclo = $activas + $completadas->count();

        // Carga por integrante: tareas activas (no completadas) de cada empleado.
        $porEmpleado = $pendiente->concat($proceso)->concat($pausa)->groupBy('empleado_id');
        $maxCarga = $porEmpleado->map->count()->max() ?: 1;

        // Las fotos NO se incluyen aquí: en esta instalación se almacenan como
        // base64 dentro de la columna (hasta ~55 KB cada una) y esta respuesta se
        // consulta cada pocos segundos durante toda la jornada. El frontend las
        // pide una sola vez a /tablero/avatares y las cachea.
        $equipoQuery = $conn->table('empleados as e')
            ->leftJoin('cargos as c', 'e.cargo', '=', 'c.id')
            ->where('e.estado_registro', 'Activo')
            ->where('e.estado', 'Activo')
            ->select('e.id', 'c.nombre as cargo',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre'));
        if ($alcance !== null) {
            $equipoQuery->whereIn('e.id', $alcance);
        }
        $equipo = collect($equipoQuery->orderBy('e.nombres')->get())
            ->map(function ($e) use ($porEmpleado, $maxCarga) {
                $n = isset($porEmpleado[$e->id]) ? $porEmpleado[$e->id]->count() : 0;
                return [
                    'id'        => (int) $e->id,
                    'nombre'    => $e->nombre,
                    'cargo'     => $e->cargo,
                    'activas'   => $n,
                    'carga_pct' => (int) round($n / $maxCarga * 100),
                ];
            })
            ->sortByDesc('activas')->values();

        // Alertas y próximas entregas sobre tareas aún no completadas.
        $sinCompletar = $pendiente->concat($proceso)->concat($pausa);
        $alertas = [
            'vencidas'   => $sinCompletar->filter(fn ($t) => $t['dias_restantes'] !== null && $t['dias_restantes'] < 0)->count(),
            'vencen_hoy' => $sinCompletar->filter(fn ($t) => $t['dias_restantes'] === 0)->count(),
            'proximas'   => $sinCompletar->filter(fn ($t) => $t['dias_restantes'] !== null && $t['dias_restantes'] > 0 && $t['dias_restantes'] <= 7)->count(),
            'pausadas'   => $pausa->count(),
        ];

        $entregas = $sinCompletar
            ->filter(fn ($t) => $t['fecha_pactada'] !== null)
            ->sortBy('fecha_pactada')
            ->take(6)
            ->map(fn ($t) => [
                'id'            => $t['id'],
                'titulo'        => $t['titulo'],
                'fecha_pactada' => $t['fecha_pactada'],
                'empleado'      => $t['empleado'],
                'dias_restantes' => $t['dias_restantes'],
            ])->values();

        $usuario = $conn->table('users')->where('email', Auth::user()->email ?? '')->first();
        $departamento = null;
        if ($usuario && $usuario->empleado) {
            $departamento = $conn->table('empleados as e')
                ->leftJoin('departamentos as d', 'e.departamento', '=', 'd.id')
                ->where('e.id', $usuario->empleado)->value('d.nombre');
        }

        return response()->json([
            'servidor_ts' => now()->toIso8601String(),
            'alcance' => [
                'tipo'         => $alcance === null ? 'global' : 'equipo',
                'departamento' => $departamento,
                'empleados'    => $alcance === null ? null : count($alcance),
                'dias_ventana' => $dias,
            ],
            'kpis' => [
                'total'      => $totalCiclo,
                'pendiente'  => $pendiente->count(),
                'proceso'    => $proceso->count(),
                'pausa'      => $pausa->count(),
                'completadas' => $completadas->count(),
                'avance_pct' => $totalCiclo > 0 ? (int) round($completadas->count() / $totalCiclo * 100) : 0,
            ],
            'columnas' => [
                'pendiente'   => $pendiente,
                'proceso'     => $proceso,
                'pausa'       => $pausa,
                'completadas' => ['modo' => $modoCompletadas, 'items' => $completadas],
            ],
            'equipo'   => $equipo,
            'alertas'  => $alertas,
            'entregas' => $entregas,
        ]);
    }

    /**
     * Avatares de los empleados dentro del alcance del usuario, indexados por id.
     *
     * Se sirve aparte de tableroEstado porque las fotos se guardan como base64 en
     * la propia columna y cambian muy rara vez: el tablero las pide una vez al
     * montar y las reutiliza, en lugar de arrastrarlas en cada sondeo.
     */
    function tableroAvatares()
    {
        $alcance = $this->alcanceEmpleadosInformes();

        $q = DB::connection('mysql2')->table('empleados')
            ->where('estado_registro', 'Activo')
            ->where('estado', 'Activo')
            ->whereNotNull('foto')
            ->select('id', 'foto');
        if ($alcance !== null) {
            $q->whereIn('id', $alcance);
        }

        return response()->json($q->get()->pluck('foto', 'id'));
    }

    /**
     * Devuelve los ids de empleados que el usuario autenticado puede ver en los informes.
     *
     * - Administrador y Supervisor: null (sin restricción, ven toda la organización).
     * - Líder: sus empleados asignados en lideres_empleados, más él mismo.
     * - Empleado: únicamente él mismo.
     * - Sin usuario o sin empleado asociado: array vacío (no ve nada).
     *
     * La relación replica la misma consulta que construye 'empleados_asignados'
     * en el login (Auth\LoginController), de modo que el alcance del servidor
     * coincide con el que el frontend ya venía aplicando en el cliente.
     */
    private function alcanceEmpleadosInformes(): ?array
    {
        $email = Auth::user()->email ?? null;
        if (!$email) {
            return [];
        }

        $usuarioActual = DB::connection('mysql2')->table('users')->where('email', $email)->first();
        if (!$usuarioActual) {
            return [];
        }

        $tipo = strtolower(trim($usuarioActual->tipo_usuario ?? ''));
        if ($tipo === 'administrador' || $tipo === 'supervisor') {
            return null;
        }

        $empleadoId = $usuarioActual->empleado ?? null;
        if (!$empleadoId) {
            return [];
        }

        $ids = [(int) $empleadoId];

        if ($this->usuarioEsLiderParaNotificaciones($usuarioActual)) {
            $asignados = DB::connection('mysql2')->table('lideres_empleados')
                ->join('empleados', 'lideres_empleados.empleado', 'empleados.id')
                ->where('lideres_empleados.lider', $empleadoId)
                ->where('empleados.estado_registro', 'Activo')
                ->pluck('empleados.id')
                ->all();

            $ids = array_merge($ids, array_map('intval', $asignados));
        }

        return array_values(array_unique($ids));
    }

    /**
     * Verifica que el usuario autenticado pueda resolver (aprobar/rechazar) una
     * solicitud de pausa o reprogramación sobre una tarea.
     *
     * Puede resolver un Administrador, o el líder del empleado dueño de la tarea.
     * El dueño de la tarea nunca puede resolver su propia solicitud.
     *
     * Devuelve el registro de users del resolutor, o null si no está autorizado.
     * El id devuelto es el que debe persistirse en aprobado_por: confiar en el
     * valor enviado por el cliente permitía atribuir la aprobación a un tercero.
     */
    private function resolutorAutorizado($tarea): ?object
    {
        $email = Auth::user()->email ?? null;
        if (!$email) {
            return null;
        }

        $usuarioActual = DB::connection('mysql2')->table('users')->where('email', $email)->first();
        if (!$usuarioActual || !$tarea) {
            return null;
        }

        if (strcasecmp($usuarioActual->tipo_usuario ?? '', 'Administrador') === 0) {
            return $usuarioActual;
        }

        if (!$usuarioActual->empleado) {
            return null;
        }

        // El dueño de la tarea no resuelve su propia solicitud.
        if ((int) $usuarioActual->empleado === (int) $tarea->empleado) {
            return null;
        }

        $esLiderDeAsignado = DB::connection('mysql2')->table('lideres_empleados')
            ->where('lider', $usuarioActual->empleado)
            ->where('empleado', $tarea->empleado)
            ->exists();

        return $esLiderDeAsignado ? $usuarioActual : null;
    }

    private function usuarioEsLiderParaNotificaciones($u): bool
    {
        if (!$u || strcasecmp($u->tipo_usuario ?? '', 'Administrador') === 0) {
            return false;
        }
        if (strcasecmp(trim($u->tipo_usuario ?? ''), 'Lider') === 0) {
            return true;
        }
        $tipo = strtolower($u->tipo_usuario ?? '');
        if ($tipo !== '' && str_contains($tipo, 'lider')) {
            return true;
        }
        $lid = strtolower(trim((string) ($u->lider ?? '')));

        return $lid === 'si' || $lid === 'sí';
    }

    /**
     * Inserta notificación in-app y envía correo al líder (empleado) o al administrador (líder).
     */
    private function notificarSolicitudPausa($tarea, $usuarioActual, string $motivo, string $fechaReanudacion): void
    {
        $titulo = $tarea->titulo ?? 'Tarea';
        $actorNombre = $usuarioActual->name ?? 'Usuario';

        $empleadoAsignado = DB::connection('mysql2')->table('empleados')->where('id', $tarea->empleado)->first();
        $nombreAsignado = $empleadoAsignado
            ? trim(($empleadoAsignado->nombres ?? '') . ' ' . ($empleadoAsignado->apellidos ?? ''))
            : 'Asignado';

        $mensajeBase = $actorNombre . ' ha solicitado pausa para la tarea «' . $titulo . '» (asignada a ' . $nombreAsignado . '). '
            . 'Motivo: ' . $motivo . '. Fecha de reanudación prevista: ' . $fechaReanudacion . '.';

        $receptor = null;
        $tipoReceptor = 'usuario';
        $idEmisor = (int) $usuarioActual->id;
        $tipoEmisor = 'usuario';

        if (strcasecmp($usuarioActual->tipo_usuario ?? '', 'Administrador') === 0) {
            return;
        }

        if ($this->usuarioEsLiderParaNotificaciones($usuarioActual)) {
            $receptor = DB::connection('mysql2')->table('users')
                ->where('tipo_usuario', 'Administrador')
                ->where('lider_seguimiento', 'Si')
                ->first();
            if (!$receptor) {
                $receptor = DB::connection('mysql2')->table('users')
                    ->where('tipo_usuario', 'Administrador')
                    ->orderBy('id')
                    ->first();
            }
            $tipoReceptor = 'usuario';
        } else {
            $empleadoActor = null;
            if ($usuarioActual->empleado) {
                $empleadoActor = DB::connection('mysql2')->table('empleados')
                    ->join('users', 'empleados.id', 'users.empleado')
                    ->select('empleados.*', 'users.id as id_usuario')
                    ->where('empleados.id', $usuarioActual->empleado)
                    ->first();
            }

            if ($empleadoActor) {
                $idEmisor = (int) $empleadoActor->id_usuario;
                $tipoEmisor = 'empleado';
            }

            $liderRow = null;
            if ($empleadoActor) {
                $liderRow = DB::connection('mysql2')->table('lideres_empleados')
                    ->where('empleado', $empleadoActor->id)
                    ->first();
            }

            if ($liderRow && $liderRow->lider) {
                $receptor = DB::connection('mysql2')->table('empleados')
                    ->join('users', 'empleados.id', 'users.empleado')
                    ->select('users.*')
                    ->where('empleados.id', $liderRow->lider)
                    ->first();
                $tipoReceptor = 'empleado';
            } else {
                $receptor = DB::connection('mysql2')->table('users')
                    ->where('tipo_usuario', 'Administrador')
                    ->orderBy('id')
                    ->first();
                $tipoReceptor = 'usuario';
            }
        }

        if (!$receptor || empty($receptor->email)) {
            return;
        }

        try {
            DB::connection('mysql2')->table('notif_generales')->insert([
                'id_emisor' => $idEmisor,
                'tipo_emisor' => $tipoEmisor,
                'id_receptor' => $receptor->id,
                'tipo_receptor' => $tipoReceptor,
                'mensaje' => $mensajeBase,
                'tarea_id' => $tarea->id,
                'leido' => 0,
                'fecha' => now(),
                'tipo' => 'PausaSolicitada',
            ]);
        } catch (\Exception $e) {
            // Si el tipo no está permitido en ENUM, omitir notificación in-app pero intentar correo
        }

        try {
            Mail::to($receptor->email)->send(new NotificacionMailable([
                'name' => $receptor->name ?? 'Usuario',
                'message' => $mensajeBase,
            ]));
        } catch (\Exception $e) {
            // No bloquear la solicitud de pausa si el correo falla
        }
    }

    function reprogramarTarea($id, Request $request)
    {
        $data = $request->all();
        
        try {
            $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
                'fecha_pactada' => $data['fecha_pactada'],
                'motivo_reprogramacion' => $data['motivo_reprogramacion'],
                'reprogramada' => 1
            ]);

            $fechaFmt = Carbon::parse($data['fecha_pactada'])->format('d/m/Y');
            $actor = DB::connection('mysql2')->table('users')->where('email', Auth::user()->email)->value('name') ?? 'Usuario';
            $motivo = trim($data['motivo_reprogramacion'] ?? '');
            $motivoStr = $motivo ? " Motivo: {$motivo}." : '';
            $this->registrarActividad($id, 'Reprogramada', "Tarea reprogramada por {$actor}. Nueva fecha: {$fechaFmt}.{$motivoStr}");

            return response()->json(['success' => 'Tarea reprogramada correctamente'], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    function obtenerObservacion($id)
    {
        $observacion = DB::connection('mysql2')->table('observaciones_tareas')->where('id', $id)->first();
        $usuario = DB::connection('mysql2')->table('users')->where('id', $observacion->creador)->first();
        $receptor = DB::connection('mysql')->table('users')->where('email', $usuario->email)->first();

        return response()->json(['idReceptor' => $receptor->id]);
    }

    // ─── Proyectos ──────────────────────────────────────────────────────────────

    function cargarProyectos()
    {
        $proyectos = DB::connection('mysql2')->table('proyectos')
            ->leftJoin('empresas', 'proyectos.empresa', 'empresas.id')
            ->select('proyectos.*', 'empresas.nombre as empresa_nombre', 'empresas.id as empresa_id')
            ->orderBy('proyectos.nombre')
            ->get();

        return response()->json($proyectos);
    }

    function guardarProyecto(Request $request)
    {
        $proyecto = $request->all();

        DB::connection('mysql2')->beginTransaction();
        try {
            $datos = [
                'nombre'           => $proyecto['nombre'],
                'municipio'        => $proyecto['municipio'] ?? null,
                'empresa'          => $proyecto['empresa'] ?? null,
                'fecha_inicio'     => $proyecto['fechaInicio'] ?? null,
                'fecha_fin_estimada' => $proyecto['fechaFin'] ?? null,
                'estado'           => 'Activo',
            ];

            if ($proyecto['accion'] == 'guardar') {
                DB::connection('mysql2')->table('proyectos')->insert($datos);
            } else {
                $resultado = DB::connection('mysql2')->table('proyectos')
                    ->where('id', $proyecto['id'])
                    ->update($datos);

                if ($resultado === false) {
                    throw new \Exception('Error al actualizar el proyecto');
                }
            }

            DB::connection('mysql2')->commit();
            return response()->json(['success' => 'Proyecto guardado correctamente'], 200);
        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    function eliminarProyecto($id)
    {
        DB::connection('mysql2')->table('tareas_empleados')->where('proyecto_id', $id)->update(['proyecto_id' => null]);
        DB::connection('mysql2')->table('proyectos')->where('id', $id)->delete();

        return response()->json(['success' => true]);
    }

    function importarProyectosIniciales()
    {
        $proyectos = [
            ['municipio' => 'RIOHACHA',        'nombre' => 'IMPLEMENTACIÓN DE AMBIENTES EDUCATIVOS TECNOLÓGICOS PARA EL FORTALECIMIENTO DEL APRENDIZAJE INTEGRAL EN SEDES EDUCATIVAS OFICIALES DE RIOHACHA Y FONSECA, LA GUAJIRA'],
            ['municipio' => 'DISTRACCIÓN',     'nombre' => 'IMPLEMENTACIÓN DE AMBIENTES TECNOLÓGICOS DE APRENDIZAJE EN SEDES EDUCATIVAS OFICIALES DE LOS MUNICIPIOS DE DISTRACCIÓN Y FONSECA EN EL DEPARTAMENTO DE LA GUAJIRA'],
            ['municipio' => 'BECERRIL',        'nombre' => 'MEJORAMIENTO INTEGRAL DE LA INFRAESTRUCTURA EDUCATIVA Y DOTACIÓN DE AMBIENTES ACADÉMICOS ESPECIALIZADOS EN EL MUNICIPIO DE BECERRIL, CESAR'],
            ['municipio' => 'BECERRIL',        'nombre' => 'MEJORAMIENTO DE INFRAESTRUCTURA EDUCATIVA PARA LA IMPLEMENTACIÓN DE AMBIENTES PEDAGÓGICOS INNOVADORES EN LA INSTITUCIÓN EDUCATIVA TRUJILLO SEDE (1) DEL MUNICIPIO DE BECERRIL, CESAR'],
            ['municipio' => 'SAN JUAN DEL CESAR', 'nombre' => 'IMPLEMENTACIÓN DE AMBIENTES TECNOLÓGICOS DE APRENDIZAJE EN LAS SEDES EDUCATIVAS PÚBLICAS DEL MUNICIPIO DE SAN JUAN DEL CESAR, LA GUAJIRA'],
            ['municipio' => 'VALLEDUPAR',      'nombre' => 'FORTALECIMIENTO DE LA CALIDAD EDUCATIVA MEDIANTE LA IMPLEMENTACIÓN DE AMBIENTES TECNOLÓGICOS Y EL MEJORAMIENTO DE LA INFRAESTRUCTURA EDUCATIVA EN LAS SEDES EDUCATIVAS OFICIALES RURALES DEL MUNICIPIO DE VALLEDUPAR, CESAR'],
            ['municipio' => 'URUMITA',         'nombre' => 'FORTALECIMIENTO DE LA CALIDAD EDUCATIVA MEDIANTE EL MEJORAMIENTO DE AMBIENTES TECNOLÓGICOS PARA LA EDUCACIÓN INTEGRAL EN LAS SEDES EDUCATIVAS PÚBLICAS DEL MUNICIPIO DE URUMITA, LA GUAJIRA'],
            ['municipio' => 'NOROSÍ',          'nombre' => 'SUMINISTRO DE HERRAMIENTAS TECNOLOGICAS PARA EL FORTALECIMIENTO DE LA EDUCACIÓN EN LAS SEDES EDUCATIVAS OFICIALES DEL MUNICIPIO DE NOROSÍ, BOLIVAR'],
            ['municipio' => 'YONDÓ',           'nombre' => 'SUMINISTRO DE HERRAMIENTAS TECNOLÓGICAS PARA EL FORTALECIMIENTO DE LA EDUCACIÓN EN LAS SEDES EDUCATIVAS OFICIALES DEL MUNICIPIO DE YONDO, ANTIOQUIA'],
            ['municipio' => 'EL PASO',         'nombre' => 'FORTALECIMIENTO DE LA CALIDAD EDUCATIVA MEDIANTE LA CREACIÓN DE AMBIENTES TECNOLÓGICOS PARA LA EDUCACIÓN INTEGRAL EN EL MUNICIPIO DE EL PASO CESAR'],
            ['municipio' => 'FONSECA',         'nombre' => 'FORTALECIMIENTO DE LA CALIDAD EDUCATIVA MEDIANTE EL MEJORAMIENTO DE AMBIENTES TECNOLÓGICOS PARA LA EDUCACIÓN INTEGRAL EN LAS SEDES EDUCATIVAS PÚBLICAS DEL MUNICIPIO DE FONSECA, LA GUAJIRA'],
        ];

        $insertados = 0;
        foreach ($proyectos as $p) {
            $existe = DB::connection('mysql2')->table('proyectos')
                ->where('nombre', $p['nombre'])
                ->exists();

            if (!$existe) {
                DB::connection('mysql2')->table('proyectos')->insert([
                    'nombre'    => $p['nombre'],
                    'municipio' => $p['municipio'],
                    'estado'    => 'Activo',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $insertados++;
            }
        }

        return response()->json(['success' => true, 'insertados' => $insertados]);
    }

    // ─── Subtareas ───────────────────────────────────────────────────────────────

    function cargarSubtareas($tarea_id)
    {
        $subtareas = DB::connection('mysql2')->table('subtareas')
            ->where('tarea_id', $tarea_id)
            ->orderBy('orden')
            ->orderBy('id')
            ->get();

        return response()->json($subtareas);
    }

    function guardarSubtarea(Request $request)
    {
        $id = DB::connection('mysql2')->table('subtareas')->insertGetId([
            'tarea_id'          => $request->tarea_id,
            'titulo'            => $request->titulo,
            'completada'        => 0,
            'fecha_vencimiento' => $request->fecha_vencimiento ?: null,
            'orden'             => $request->orden ?? 0,
            'checklist_titulo'  => $request->checklist_titulo ?? null,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        $subtarea = DB::connection('mysql2')->table('subtareas')->where('id', $id)->first();

        return response()->json(['success' => true, 'subtarea' => $subtarea]);
    }

    function actualizarSubtarea(Request $request, $id)
    {
        $data = ['updated_at' => now()];

        if ($request->has('completada')) {
            $data['completada'] = $request->completada ? 1 : 0;
        }
        if ($request->has('titulo')) {
            $data['titulo'] = $request->titulo;
        }
        if ($request->has('fecha_vencimiento')) {
            $data['fecha_vencimiento'] = $request->fecha_vencimiento ?: null;
        }
        if ($request->has('checklist_titulo')) {
            $data['checklist_titulo'] = $request->checklist_titulo ?: null;
        }

        DB::connection('mysql2')->table('subtareas')->where('id', $id)->update($data);

        $subtarea = DB::connection('mysql2')->table('subtareas')->where('id', $id)->first();

        return response()->json(['success' => true, 'subtarea' => $subtarea]);
    }

    function eliminarSubtarea($id)
    {
        DB::connection('mysql2')->table('subtareas')->where('id', $id)->delete();

        return response()->json(['success' => true]);
    }

    function checklistsEmpleado($empleado_id)
    {
        $tareas = DB::connection('mysql2')->table('tareas_empleados')
            ->whereIn('id', function($q) {
                $q->select('tarea_id')->from('subtareas');
            })
            ->where('empleado', $empleado_id)
            ->select('id', 'titulo')
            ->orderBy('id', 'desc')
            ->get();

        $result = [];
        foreach ($tareas as $tarea) {
            $items = DB::connection('mysql2')->table('subtareas')
                ->where('tarea_id', $tarea->id)
                ->select('titulo', 'fecha_vencimiento', 'checklist_titulo')
                ->orderBy('orden')->orderBy('id')
                ->get();
            if ($items->isNotEmpty()) {
                $result[] = [
                    'tarea_id'        => $tarea->id,
                    'tarea_titulo'    => $tarea->titulo,
                    'checklist_titulo'=> $items->first()->checklist_titulo ?? null,
                    'items'           => $items->map(fn($s) => [
                        'titulo'           => $s->titulo,
                        'fecha_vencimiento'=> $s->fecha_vencimiento,
                    ])->values()
                ];
            }
        }

        return response()->json($result);
    }

    // ── Gestión de Departamentos ──────────────────────────────────────────────

    function cargarDepartamentosDetalle()
    {
        $departamentos = DB::connection('mysql2')->table('departamentos')
            ->leftJoin('empleados as e', 'departamentos.lider_id', '=', 'e.id')
            ->leftJoin('users as u', 'u.empleado', '=', 'e.id')
            ->select(
                'departamentos.id',
                'departamentos.nombre',
                'departamentos.estado',
                'departamentos.lider_id',
                DB::raw("CONCAT(e.nombres, ' ', e.apellidos) as lider_nombre"),
                'e.id as lider_emp_id',
                'u.id as lider_user_id',
                'u.independencia as lider_independencia',
                DB::raw("(SELECT COUNT(*) FROM empleados WHERE departamento = departamentos.id AND estado_registro = 'Activo' AND estado = 'Activo') as total_empleados")
            )
            ->get();
        return response()->json($departamentos);
    }

    function crearDepartamento(Request $request)
    {
        $id = DB::connection('mysql2')->table('departamentos')->insertGetId([
            'nombre' => $request->nombre,
            'estado' => 'Activo',
        ]);
        return response()->json(['id' => $id, 'message' => 'Departamento creado']);
    }

    function editarDepartamento(Request $request, $id)
    {
        DB::connection('mysql2')->table('departamentos')->where('id', $id)->update([
            'nombre' => $request->nombre,
            'estado' => $request->estado ?? 'Activo',
        ]);
        return response()->json(['message' => 'Departamento actualizado']);
    }

    function eliminarDepartamento($id)
    {
        $count = DB::connection('mysql2')->table('empleados')
            ->where('departamento', $id)
            ->where('estado_registro', 'Activo')
            ->count();
        if ($count > 0) {
            return response()->json(['message' => 'No se puede eliminar: tiene empleados activos asignados'], 422);
        }
        DB::connection('mysql2')->table('departamentos')->where('id', $id)->delete();
        return response()->json(['message' => 'Departamento eliminado']);
    }

    function asignarLiderDepartamento(Request $request, $id)
    {
        $nuevoLiderId = $request->lider_id ?: null;

        // Obtener líder anterior para revocarle el flag si ya no lidera ningún dpto
        $anterior = DB::connection('mysql2')->table('departamentos')->where('id', $id)->value('lider_id');

        DB::connection('mysql2')->table('departamentos')->where('id', $id)->update([
            'lider_id' => $nuevoLiderId,
        ]);

        // Marcar nuevo líder en empleados y users
        if ($nuevoLiderId) {
            DB::connection('mysql2')->table('empleados')->where('id', $nuevoLiderId)->update(['lider' => 'Si']);
            DB::connection('mysql2')->table('users')->where('empleado', $nuevoLiderId)->update(['lider' => 'Si']);
        }

        // Si había un líder anterior diferente y ya no lidera ningún departamento, revocarle el flag
        if ($anterior && $anterior != $nuevoLiderId) {
            $sigueComoLider = DB::connection('mysql2')->table('departamentos')
                ->where('lider_id', $anterior)->exists();
            if (!$sigueComoLider) {
                DB::connection('mysql2')->table('empleados')->where('id', $anterior)->update(['lider' => 'No']);
                DB::connection('mysql2')->table('users')->where('empleado', $anterior)->update(['lider' => 'No']);
            }
        }

        return response()->json(['message' => 'Líder asignado correctamente']);
    }

    // ── Gestión de Cargos ─────────────────────────────────────────────────────

    function cargarCargos()
    {
        $cargos = DB::connection('mysql2')->table('cargos')
            ->select('cargos.*',
                DB::raw("(SELECT COUNT(*) FROM empleados WHERE empleados.cargo = cargos.id AND empleados.estado_registro = 'Activo') as total_empleados")
            )
            ->orderBy('nombre')
            ->get();
        return response()->json($cargos);
    }

    function crearCargo(Request $request)
    {
        $nombre = trim($request->nombre ?? '');
        if (!$nombre) return response()->json(['message' => 'El nombre es obligatorio'], 422);

        $existe = DB::connection('mysql2')->table('cargos')
            ->whereRaw('LOWER(nombre) = ?', [strtolower($nombre)])->exists();
        if ($existe) return response()->json(['message' => 'Ya existe un cargo con ese nombre'], 422);

        $id = DB::connection('mysql2')->table('cargos')->insertGetId([
            'nombre' => strtoupper($nombre),
            'estado' => 'Activo',
        ]);
        return response()->json(['id' => $id, 'message' => 'Cargo creado']);
    }

    function actualizarCargo(Request $request, $id)
    {
        $nombre = trim($request->nombre ?? '');
        if (!$nombre) return response()->json(['message' => 'El nombre es obligatorio'], 422);

        $existe = DB::connection('mysql2')->table('cargos')
            ->whereRaw('LOWER(nombre) = ?', [strtolower($nombre)])
            ->where('id', '!=', $id)->exists();
        if ($existe) return response()->json(['message' => 'Ya existe un cargo con ese nombre'], 422);

        DB::connection('mysql2')->table('cargos')->where('id', $id)->update([
            'nombre' => strtoupper($nombre),
            'estado' => $request->estado ?? 'Activo',
        ]);
        return response()->json(['message' => 'Cargo actualizado']);
    }

    function eliminarCargo($id)
    {
        $count = DB::connection('mysql2')->table('empleados')
            ->where('cargo', $id)->where('estado_registro', 'Activo')->count();
        if ($count > 0) {
            return response()->json(['message' => "No se puede eliminar: tiene $count empleado(s) activo(s) asignado(s)"], 422);
        }
        DB::connection('mysql2')->table('cargos')->where('id', $id)->delete();
        return response()->json(['message' => 'Cargo eliminado']);
    }

    function empleadosDepartamento($id)
    {
        $empleados = DB::connection('mysql2')->table('empleados')
            ->leftJoin('users as u', 'empleados.id', '=', 'u.empleado')
            ->leftJoin('cargos', 'empleados.cargo', '=', 'cargos.id')
            ->select(
                'empleados.id',
                'empleados.nombres',
                'empleados.apellidos',
                'empleados.email',
                'empleados.foto',
                'empleados.lider',
                'cargos.nombre as nombre_cargo',
                'u.id as user_id',
                'u.lider as user_lider',
                'u.independencia'
            )
            ->where('empleados.departamento', $id)
            ->where('empleados.estado_registro', 'Activo')
            ->where('empleados.estado', 'Activo')
            ->orderBy('empleados.nombres')
            ->get();
        return response()->json($empleados);
    }

    function toggleIndependencia(Request $request, $id)
    {
        $user = DB::connection('mysql2')->table('users')->where('id', $id)->first();
        if (!$user) {
            return response()->json(['message' => 'Usuario no encontrado'], 404);
        }
        $nuevo = ($user->independencia === 'Si') ? 'No' : 'Si';
        DB::connection('mysql2')->table('users')->where('id', $id)->update(['independencia' => $nuevo]);
        return response()->json(['independencia' => $nuevo]);
    }

    // ── Actividades y Comentarios de Tarea ────────────────────────────────────

    function actividadesComentariosTarea($id)
    {
        $actividades = DB::connection('mysql2')->table('notif_generales')
            ->where('tarea_id', $id)
            ->orderByDesc('id')
            ->get()
            ->map(fn($n) => [
                'tipo_entrada' => 'actividad',
                'id'           => 'a_' . $n->id,
                'texto'        => $n->mensaje,
                'tipo'         => $n->tipo,
                'autor'        => null,
                'fecha'        => $n->fecha_creacion,
            ])
            ->groupBy(fn($n) => $n['tipo'] . '||' . $n['texto'])
            ->map(function ($grupo) {
                $primero = $grupo->first();
                $count   = $grupo->count();
                if ($count > 1) {
                    $primero['texto'] .= ' (×' . $count . ')';
                }
                return $primero;
            })
            ->values();

        $comentarios = DB::connection('mysql2')->table('observaciones_tareas')
            ->join('users', 'observaciones_tareas.creador', '=', 'users.id')
            ->select('observaciones_tareas.*', 'users.name as nombre_autor')
            ->where('id_tarea', $id)
            ->get()
            ->map(fn($c) => [
                'tipo_entrada' => 'comentario',
                'id'           => 'c_' . $c->id,
                'texto'        => $c->observaciones,
                'tipo'         => 'Comentario',
                'autor'        => $c->nombre_autor,
                'fecha'        => $c->fecha . ' 00:00:00',
            ]);

        $merged = $actividades->concat($comentarios)
            ->sortByDesc('fecha')
            ->values();

        return response()->json($merged);
    }

    // ── Reprogramaciones ─────────────────────────────────────────────────────

    function solicitarReprogramacion(Request $request)
    {
        // solicitado_por, solicitado_por_user y tipo_aprobador se aceptan por
        // compatibilidad con el frontend actual pero NO se usan: el solicitante y
        // el tipo de aprobador se derivan del usuario autenticado, igual que en
        // solicitarPausa. Confiar en esos campos permitía que quien solicita
        // eligiera a su propio aprobador.
        $data = $request->validate([
            'tarea_id'             => 'required|integer',
            'solicitado_por'       => 'nullable|integer',
            'solicitado_por_user'  => 'nullable|integer',
            'fecha_actual'         => 'nullable|date',
            'fecha_nueva'          => 'required|date',
            'motivo'               => 'required|string|min:5',
            'tipo_aprobador'       => 'nullable|in:lider,admin',
        ]);

        $usuarioActual = DB::connection('mysql2')->table('users')->where('email', Auth::user()->email)->first();
        if (!$usuarioActual) {
            return response()->json(['message' => 'Usuario no encontrado'], 403);
        }

        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $data['tarea_id'])->first();
        if (!$tarea) {
            return response()->json(['message' => 'Tarea no encontrada'], 404);
        }

        $esDueño = $usuarioActual->empleado && (int) $usuarioActual->empleado === (int) $tarea->empleado;
        $esAdmin = strcasecmp($usuarioActual->tipo_usuario ?? '', 'Administrador') === 0;
        $esLiderDeAsignado = false;
        if (!$esDueño && !$esAdmin && $usuarioActual->empleado) {
            $esLiderDeAsignado = DB::connection('mysql2')->table('lideres_empleados')
                ->where('lider', $usuarioActual->empleado)
                ->where('empleado', $tarea->empleado)
                ->exists();
        }
        if (!$esDueño && !$esAdmin && !$esLiderDeAsignado) {
            return response()->json(['message' => 'No autorizado para solicitar reprogramación en esta tarea'], 403);
        }

        $usuarioEsLider = $this->usuarioEsLiderParaNotificaciones($usuarioActual) || $esLiderDeAsignado;
        $tipoAprobador  = $usuarioEsLider ? 'admin' : 'lider';

        // Sólo puede existir una solicitud pendiente por tarea
        $pendiente = DB::connection('mysql2')->table('reprogramaciones_tareas')
            ->where('tarea_id', $data['tarea_id'])
            ->where('estado', 'Pendiente')
            ->exists();
        if ($pendiente) {
            return response()->json(['message' => 'Ya existe una solicitud de reprogramación pendiente para esta tarea.'], 422);
        }

        $id = DB::connection('mysql2')->table('reprogramaciones_tareas')->insertGetId([
            'tarea_id'            => $data['tarea_id'],
            'solicitado_por'      => $usuarioActual->empleado,
            'solicitado_por_user' => $usuarioActual->id,
            'fecha_actual'        => $data['fecha_actual'] ?? $tarea->fecha_pactada,
            'fecha_nueva'         => $data['fecha_nueva'],
            'motivo'              => $data['motivo'],
            'estado'              => 'Pendiente',
            'tipo_aprobador'      => $tipoAprobador,
            'fecha_solicitud'     => now(),
        ]);

        $solicitante = $usuarioActual->name ?? 'Usuario';
        $fechaNuevaFmt = Carbon::parse($data['fecha_nueva'])->format('d/m/Y');
        $fechaActualFmt = $data['fecha_actual'] ? Carbon::parse($data['fecha_actual'])->format('d/m/Y') : 'N/A';
        $this->registrarActividad(
            $data['tarea_id'],
            'Reprogramación solicitada',
            "Reprogramación solicitada por {$solicitante}. Nueva fecha: {$fechaNuevaFmt} (antes: {$fechaActualFmt}). Motivo: {$data['motivo']}."
        );

        return response()->json(['id' => $id, 'message' => 'Solicitud enviada correctamente'], 201);
    }

    function resolverReprogramacion(Request $request, $id)
    {
        // aprobado_por se acepta por compatibilidad con el frontend pero NO se usa:
        // el resolutor se deriva del usuario autenticado.
        $data = $request->validate([
            'accion'                => 'required|in:aprobar,rechazar',
            'aprobado_por'          => 'nullable|integer',
            'observacion_rechazo'   => 'nullable|string',
        ]);

        $reprg = DB::connection('mysql2')->table('reprogramaciones_tareas')->where('id', $id)->first();
        if (!$reprg) {
            return response()->json(['message' => 'Solicitud no encontrada'], 404);
        }
        if ($reprg->estado !== 'Pendiente') {
            return response()->json(['message' => 'La solicitud ya fue resuelta'], 422);
        }

        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $reprg->tarea_id)->first();
        $resolutor = $this->resolutorAutorizado($tarea);
        if (!$resolutor) {
            return response()->json(['message' => 'No autorizado para resolver esta solicitud'], 403);
        }

        $estado = $data['accion'] === 'aprobar' ? 'Aprobada' : 'Rechazada';

        DB::connection('mysql2')->table('reprogramaciones_tareas')->where('id', $id)->update([
            'estado'               => $estado,
            'aprobado_por'         => $resolutor->id,
            'observacion_rechazo'  => $data['observacion_rechazo'] ?? null,
            'fecha_resolucion'     => now(),
        ]);

        $aprobadorNombre = $resolutor->name ?? 'Usuario';

        if ($data['accion'] === 'aprobar') {
            DB::connection('mysql2')->table('tareas_empleados')->where('id', $reprg->tarea_id)->update([
                'fecha_pactada'          => $reprg->fecha_nueva,
                'motivo_reprogramacion'  => $reprg->motivo,
                'reprogramada'           => 1,
            ]);
            $fechaNuevaFmt = Carbon::parse($reprg->fecha_nueva)->format('d/m/Y');
            $this->registrarActividad(
                $reprg->tarea_id,
                'Reprogramación aprobada',
                "Reprogramación aprobada por {$aprobadorNombre}. Nueva fecha pactada: {$fechaNuevaFmt}."
            );
        } else {
            $obsRechazo = $data['observacion_rechazo'] ? " Observación: {$data['observacion_rechazo']}." : '';
            $this->registrarActividad(
                $reprg->tarea_id,
                'Reprogramación rechazada',
                "Reprogramación rechazada por {$aprobadorNombre}.{$obsRechazo}"
            );
        }

        return response()->json(['message' => ucfirst($estado) . ' correctamente']);
    }

    function historialReprogramaciones($tareaId)
    {
        $rows = DB::connection('mysql2')->table('reprogramaciones_tareas as r')
            ->leftJoin('empleados as e', 'r.solicitado_por', '=', 'e.id')
            ->leftJoin('users as ua', 'r.aprobado_por', '=', 'ua.id')
            ->leftJoin('empleados as ea', 'ua.empleado', '=', 'ea.id')
            ->select(
                'r.*',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre_solicitante'),
                DB::connection('mysql2')->raw('CONCAT(ea.nombres, " ", ea.apellidos) as nombre_aprobador')
            )
            ->where('r.tarea_id', $tareaId)
            ->orderBy('r.fecha_solicitud', 'desc')
            ->get();

        return response()->json($rows);
    }

    function reprogramacionesPendientes(Request $request)
    {
        $userId   = $request->query('user_id');
        $rolQuery = DB::connection('mysql2')->table('users')->where('id', $userId)->value('tipo_usuario');
        $isAdmin  = ($rolQuery === 'Administrador');

        $query = DB::connection('mysql2')->table('reprogramaciones_tareas as r')
            ->join('tareas_empleados as t', 'r.tarea_id', '=', 't.id')
            ->join('empleados as e', 'r.solicitado_por', '=', 'e.id')
            ->select(
                'r.*',
                't.titulo as tarea_titulo',
                't.fecha_pactada as fecha_pactada_actual',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre_solicitante')
            )
            ->where('r.estado', 'Pendiente');

        if (!$isAdmin) {
            $query->where('r.tipo_aprobador', 'lider');
        }

        return response()->json($query->orderBy('r.fecha_solicitud', 'desc')->get());
    }

    function informeReprogramaciones(Request $request)
    {
        $inicio = $request->query('inicio');
        $fin    = $request->query('fin');
        $alcance = $this->alcanceEmpleadosInformes();

        $query = DB::connection('mysql2')->table('reprogramaciones_tareas as r')
            ->join('tareas_empleados as t', 'r.tarea_id', '=', 't.id')
            ->join('empleados as e', function ($join) {
                $join->on('r.solicitado_por', '=', 'e.id')
                     ->where('e.estado_registro', 'Activo')
                     ->where('e.estado', 'Activo');
            })
            ->leftJoin('departamentos as d', 'e.departamento', '=', 'd.id')
            ->leftJoin('users as ua', 'r.aprobado_por', '=', 'ua.id')
            ->leftJoin('empleados as ea', 'ua.empleado', '=', 'ea.id')
            ->select(
                'r.*',
                't.titulo as tarea_titulo',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre_solicitante'),
                'd.nombre as departamento',
                DB::connection('mysql2')->raw('CONCAT(ea.nombres, " ", ea.apellidos) as nombre_aprobador')
            )
            ->orderBy('r.fecha_solicitud', 'desc');

        // Alcance por rol: se incluye la solicitud si el solicitante está dentro
        // del alcance o si lo está el empleado dueño de la tarea reprogramada,
        // de modo que un líder siga viendo las reprogramaciones de las tareas de
        // su equipo aunque las haya solicitado un tercero.
        if ($alcance !== null) {
            $query->where(function ($q) use ($alcance) {
                $q->whereIn('r.solicitado_por', $alcance)
                  ->orWhereIn('t.empleado', $alcance);
            });
        }

        if ($inicio) $query->where('r.fecha_solicitud', '>=', $inicio . ' 00:00:00');
        if ($fin)    $query->where('r.fecha_solicitud', '<=', $fin . ' 23:59:59');

        return response()->json($query->get());
    }

    function migrarFotos()
    {
        $migrados = 0;

        $empleados = DB::connection('mysql2')->table('empleados')
            ->whereNotNull('foto')
            ->where('foto', 'like', 'data:image%')
            ->get(['id', 'foto']);

        foreach ($empleados as $emp) {
            $url = $this->procesarFoto($emp->foto);
            DB::connection('mysql2')->table('empleados')->where('id', $emp->id)->update(['foto' => $url]);
            DB::connection('mysql2')->table('users')->where('empleado', $emp->id)->update(['foto' => $url]);
            $migrados++;
        }

        // Usuarios sin empleado vinculado (administradores)
        $users = DB::connection('mysql2')->table('users')
            ->whereNotNull('foto')
            ->where('foto', 'like', 'data:image%')
            ->whereNull('empleado')
            ->get(['id', 'foto']);

        foreach ($users as $user) {
            $url = $this->procesarFoto($user->foto);
            DB::connection('mysql2')->table('users')->where('id', $user->id)->update(['foto' => $url]);
            $migrados++;
        }

        return response()->json(['success' => true, 'migrados' => $migrados]);
    }
}
