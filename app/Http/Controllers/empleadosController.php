<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;

class empleadosController extends Controller
{
    function guardarEmpleado(Request $request)
    {
        $empleado = $request->all();


        DB::beginTransaction();
        try {
            if ($empleado['accion'] == 'guardar') {

                $empleadoId = DB::table('empleados')->insertGetId(
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
                        'telefono' => $empleado['telefono'],
                        'foto' => $empleado['foto'],
                        'estado_registro' => 'Activo',
                        'estado' => $empleado['estado'],
                        'lider' => $empleado['lider']
                    ]
                );

                $usuario = DB::table('users')->insert([
                    'name' => $empleado['nombres'] . ' ' . $empleado['apellidos'],
                    'email' => $empleado['email'],
                    'password' => Hash::make($empleado['identificacion']),
                    'tipo_usuario' => 'Empleado',
                    'estado' => 'Activo',
                    'empleado' => $empleadoId,
                    'lider' => $empleado['lider']
                ]);
            } else {
                $empleadoData = $empleado; // Guardamos los datos originales

                $updateResult = DB::table('empleados')->where('id', $empleadoData['id'])->update([
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
                    'foto' => $empleadoData['foto'],
                    'estado' => $empleadoData['estado'],
                    'lider' => $empleadoData['lider']
                ]);

                $usuario = DB::table('users')->where('email', $empleadoData['email'])->update([
                    'name' => $empleadoData['nombres'],
                    'email' => $empleadoData['email'],
                    'password' => Hash::make($empleadoData['identificacion']),
                    'tipo_usuario' => 'Empleado',
                    'empleado' => $empleadoData['id'],
                    'lider' => $empleadoData['lider']
                ]);
            }


            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
        return response()->json(['success' => 'Empleado guardado correctamente'], 200);
    }

    function cambiarEstadoNotificacion(Request $request, $id)
    {
        $notificacion = $request->all();
        DB::table('notificaciones')->where('id', $id)->update(['leida' => 1]);  
        return response()->json(['success' => 'Notificación actualizada correctamente'], 200);
    }

    function guardarAsignacionesLider(Request $request)
    {
        $asignaciones = $request->all();
        $liderId = $asignaciones['lider_id'];
        $empleados = $asignaciones['empleados'];

        //eliminar las asignaciones anteriores
        DB::table('lideres_empleados')->where('lider', $liderId)->delete();

        foreach ($empleados as $empleado) {
            $empleadoId = $empleado['id'];

            $asignacion = DB::table('lideres_empleados')->insert([
                'lider' => $liderId,
                'empleado' => $empleadoId
            ]);
        }

        return response()->json(['success' => 'Asignaciones guardadas correctamente'], 200);
    }

    function cargarNotificaciones(Request $request)
    {
        $tipo = $request->input('tipo');
        $id = $request->input('id');
     
        if ($tipo == 'Administrador') {
            $notificaciones = DB::table('notificaciones')
                ->orderBy('fecha', 'desc')
                ->get();
        } else {
           
            if ($tipo == 'empleado') {
                $notificaciones = DB::table('notificaciones')
                ->join('empleados', 'notificaciones.id_empleado', '=', 'empleados.id')
                ->select('notificaciones.*', 'empleados.nombres', 'empleados.apellidos')
                ->where('id_empleado', $id)
                ->where('leida', 'No')
                ->where('emisor', '!=', $tipo)
                ->orderBy('fecha', 'desc')
                ->get();
             
            }else{
                $notificaciones = DB::table('notificaciones')
                ->join('empleados', 'notificaciones.id_empleado', '=', 'empleados.id')
                ->select('notificaciones.*', 'empleados.nombres', 'empleados.apellidos')
                ->where('id_lider', $id)
                ->where('leida', 'No')
                ->where('emisor', '!=', $tipo)
                ->orderBy('fecha', 'desc')
                ->get();
            }

           
        }
        return response()->json($notificaciones);
    }

    function cargarEmpresas()
    {
        $empresas = DB::table('empresas')->get();
        return response()->json($empresas);
    }

    function cargarDepartamentos()
    {
        $departamentos = DB::table('departamentos')->get();
        return response()->json($departamentos);
    }

    function cargarCargos()
    {
        $cargos = DB::table('cargos')->get();
        return response()->json($cargos);
    }

    function cargarEmpleados()
    {
        $empleados = DB::table('empleados')
            ->join('empresas', 'empleados.empresa', 'empresas.id')
            ->join('departamentos', 'empleados.departamento', '=', 'departamentos.id')
            ->join('cargos', 'empleados.cargo', '=', 'cargos.id')
            ->select('empleados.*', 'empresas.nombre as nombre_empresa', 'departamentos.nombre as nombre_departamento', 'cargos.nombre as nombre_cargo')
            ->where('empleados.estado_registro', 'Activo')
            ->get();
        return response()->json($empleados);
    }

    function cargarLideres()
    {
        $lideres = DB::table('empleados')
            ->join('empresas', 'empleados.empresa', 'empresas.id')
            ->join('departamentos', 'empleados.departamento', '=', 'departamentos.id')
            ->join('cargos', 'empleados.cargo', '=', 'cargos.id')
            ->select(
                'empleados.*',
                'empresas.nombre as nombre_empresa',
                'departamentos.nombre as nombre_departamento',
                'cargos.nombre as nombre_cargo',
                DB::raw('(SELECT COUNT(*) FROM lideres_empleados WHERE lider = empleados.id) as empleados_asignados')
            )
            ->where('empleados.estado_registro', 'Activo')
            ->where('empleados.lider', 'Si')
            ->get();
        return response()->json($lideres);
    }



    function eliminarEmpleado($id)
    {
        $empleado = DB::table('empleados')
            ->where('id', $id)
            ->update([
                'estado_registro' => 'Eliminado'
            ]);
        return response()->json(['success' => 'Empleado eliminado correctamente'], 200);
    }

    function cargarFunciones($id)
    {
        $funciones = DB::table('funciones_empleado')
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
        DB::beginTransaction();
        try {

            $funcion = DB::table('funciones_empleado')->insert([
                'empleado' => $funcionEmpleado['empleado'],
                'descripcion' => $funcionEmpleado['funcion'],
                'estado' => 'Activo'
            ]);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
        //obtener la ultima funcion insertada
        $funcion = DB::table('funciones_empleado')
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
        $funcion = DB::table('funciones_empleado')->where('id', $id)->update([
            'descripcion' => $funcionEmpleado['descripcion']
        ]);
    }

    function eliminarFuncion($id)
    {
        $funcion = DB::table('funciones_empleado')->where('id', $id)->update([
            'estado' => 'Inactivo'
        ]);
        return response()->json(['success' => 'Función eliminada correctamente'], 200);
    }

    function cargarTareas($id)
    {
        $tareas = DB::table('tareas_empleados')
            ->where('empleado', $id)
            ->where('estado_reg', 'Activo')
            ->orderBy('id', 'desc')
            ->get();

        // Obtener los IDs de las tareas
        $tareasIds = $tareas->pluck('id');

        // Obtener las evidencias relacionadas a esas tareas
        $evidencias = DB::table('evidencia_tarea')
            ->whereIn('tarea', $tareasIds)
            ->get();

        // Agregar evidencias a las tareas
        $tareas = $tareas->map(function ($tarea) use ($evidencias) {
            $tarea->evidencias = $evidencias->where('tarea', $tarea->id)->values();
            return $tarea;
        });



        return response()->json([
            'tareas' => $tareas
        ]);
    }

    function buscarTareas($id, Request $request)
    {
        $searchTerm = $request->input('search');
        $tareas = DB::table('tareas_empleados')
            ->where('empleado', $id)
            ->where('estado_reg', 'Activo')
            ->orderBy('id', 'desc')
            ->where(function ($query) use ($searchTerm) {
                $query->where('titulo', 'like', '%' . $searchTerm . '%')
                    ->orWhere('descripcion', 'like', '%' . $searchTerm . '%')
                    ->orWhere('estado', 'like', '%' . $searchTerm . '%')
                    ->orWhere('prioridad', 'like', '%' . $searchTerm . '%');
            })
            ->get();

        $tareasIds = $tareas->pluck('id');

        // Obtener las evidencias relacionadas a esas tareas
        $evidencias = DB::table('evidencia_tarea')
            ->whereIn('tarea', $tareasIds)
            ->get();

        // Agregar evidencias a las tareas
        $tareas = $tareas->map(function ($tarea) use ($evidencias) {
            $tarea->evidencias = $evidencias->where('tarea', $tarea->id)->values();
            return $tarea;
        });

        return response()->json([
            'tareas' => $tareas
        ]);
    }

    function guardarTarea(Request $request)
    {
        $tarea = $request->all();

        DB::beginTransaction();
        try {

            $IdTarea = DB::table('tareas_empleados')->insertGetId([
                'titulo' => $tarea['titulo'],
                'empleado' => $tarea['empleado'],
                'descripcion' => $tarea['descripcion'],
                'fecha_pactada' => $tarea['fecha_pactada'],
                'prioridad' => $tarea['prioridad'],
                'estado' => $tarea['estado'],
                'estado_reg' => 'Activo',
                'fecha_creacion' => now()
            ]);

            /// isertar evidencia
            if (isset($tarea['evidencias']) && count($tarea['evidencias']) > 0) {
                $evidencias = $tarea['evidencias'];
                foreach ($evidencias as $evidencia) {
                    $evidencia = DB::table('evidencia_tarea')->insert([
                        'tarea' => $IdTarea,
                        'evidencia' => $evidencia['ruta'],
                        'nombre' => $evidencia['nombre'],
                        'tipo' => $evidencia['tipo']
                    ]);
                }
            }

            //consultar lider del empleado
            $lider = DB::table('lideres_empleados')->where('empleado', $tarea['empleado'])->first();

            //insertar notificacion
            if ($lider || Auth::user()->tipo_usuario == 'Administrador') {
                DB::table('notificaciones')->insert([
                    'id_lider' => $lider->lider,
                    'id_empleado' => $tarea['empleado'],
                    'id_tarea' => $IdTarea,
                    'descripcion' => 'Se te ha asignado una nueva tarea',
                    'leida' => 0,
                    'fecha' => now(),
                    'tipo' => 'Tarea',
                    'emisor' => 'Lider'
                ]);
            } else {
                DB::table('notificaciones')->insert([
                    'id_lider' => $tarea['empleado'],
                    'id_empleado' => $tarea['empleado'],
                    'id_tarea' => $IdTarea,
                    'descripcion' => 'Ha creado una nueva tarea',
                    'leida' => 'No',
                    'fecha' => now(),
                    'tipo' => 'Tarea',
                    'emisor' => 'Empleado'
                ]);
            }

            //consultar tareas del empleado
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }


        $tareas = DB::table('tareas_empleados')
            ->where('empleado', $tarea['empleado'])
            ->orderBy('id', 'desc')
            ->get();

        return response()->json([
            'success' => 'Tarea guardada correctamente',
            'tareas' => $tareas
        ], 200);
    }

    function actualizarEstadoTarea(Request $request, $id)
    {
        $tarea = $request->all();

        DB::beginTransaction();
        try {
            // actualizar estado de la tarea si es completada agregar fecha entregada
            if ($tarea['estado'] == 'Completada') {
                $tareas = DB::table('tareas_empleados')->where('id', $id)->update([
                    'estado' => $tarea['estado'],
                    'fecha_entregada' => now()
                ]);
            } else {
                $tareas = DB::table('tareas_empleados')->where('id', $id)->update([
                    'estado' => $tarea['estado']
                ]);
            }
            //insertar evidencias
            if (isset($tarea['evidencias'])) {
                $evidencias = $tarea['evidencias'];
                foreach ($evidencias as $evidencia) {
                    $evidencia = DB::table('evidencia_tarea')->insert([
                        'tarea' => $id,
                        'evidencia' => $evidencia['ruta'],
                        'nombre' => $evidencia['nombre'],
                        'tipo' => $evidencia['tipo']
                    ]);
                }
            }

            //consultar evidencias de la tarea
            $evidencias = DB::table('evidencia_tarea')->where('tarea', $id)->get();

            //consultar empleado de la tarea
            $empleado = DB::table('tareas_empleados')->where('id', $id)->first();

            
            $lider = DB::table('lideres_empleados')
            ->where('empleado', $empleado->empleado)
            ->first();
            
            //insertar notificacion
            if (Auth::user()->lider == 'Si' || Auth::user()->tipo_usuario == 'Administrador') {
                DB::table('notificaciones')->insert([
                    'id_lider' => $lider->lider,
                    'id_empleado' => $empleado->empleado,
                    'id_tarea' => $id,
                    'descripcion' => 'Se te ha actualizado el estado de la tarea a ' . $tarea['estado'],
                    'leida' => 0,
                    'fecha' => now(),
                    'tipo' => 'Tarea',
                    'emisor' => 'Lider'
                ]);
            } else {
                DB::table('notificaciones')->insert([
                    'id_lider' => $lider->lider,
                    'id_empleado' => $empleado->empleado,
                    'id_tarea' => $id,
                    'descripcion' => 'Ha actualizado el estado de la tarea a ' . $tarea['estado'],
                    'leida' => 0,
                    'fecha' => now(),
                    'tipo' => 'Tarea',
                    'emisor' => 'Empleado'
                ]);
            }


            DB::commit();
            return response()->json([
                'success' => 'Estado de la tarea actualizado correctamente',
                'evidencias' => $evidencias
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    function cargarEmpleadosLider($id)
    {
        $empleados = DB::table('lideres_empleados')
            ->join('empleados', 'lideres_empleados.empleado', '=', 'empleados.id')
            ->select('empleados.*', 'lideres_empleados.lider')
            ->where('lideres_empleados.lider', $id)
            ->get();
        return response()->json($empleados);
    }

    function cargarUsuarios()
    {
        $usuarios = DB::table('users')
            ->leftJoin('empleados', 'users.empleado', '=', 'empleados.id') // 🔹 LEFT JOIN para incluir admins
            ->select(
                'users.*',
                DB::raw('IFNULL(CONCAT(empleados.nombres, " ", empleados.apellidos), "---") as nombre_empleado')
            )
            ->get();

        return response()->json($usuarios);
    }


    function buscarUsuarios(Request $request)
    {
        $searchTerm = $request->input('search');
        $usuarios = DB::table('users')
            ->leftJoin('empleados', 'users.empleado', 'empleados.id')
            ->select(
                'users.*',
                DB::raw('IFNULL(CONCAT(empleados.nombres, " ", empleados.apellidos), "---") as nombre_empleado')
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

    function buscarEmpresas(Request $request)
    {
        $searchTerm = $request->input('search');
        $empresas = DB::table('empresas')->where('nombre', 'like', '%' . $searchTerm . '%')->get();
        return response()->json($empresas);
    }

    function buscarEmpleados(Request $request)
    {
        $searchTerm = $request->input('search');
        $empleados = DB::table('empleados')
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

    function guardarUsuario(Request $request)
    {
        $usuario = $request->all();
        if ($usuario['accion'] == 'guardar') {
            $usuario = DB::table('users')->insert([
                'name' => $usuario['name'],
                'email' => $usuario['email'],
                'password' => Hash::make($usuario['password']),
                'tipo_usuario' => $usuario['role'],
                'empleado' => $usuario['empleado'],
                'estado' => $usuario['estado']
            ]);
        } else {
            if ($usuario['cambiar_password']) {
                $usuario = DB::table('users')->where('id', $usuario['id'])->update([
                    'name' => $usuario['name'],
                    'email' => $usuario['email'],
                    'password' => Hash::make($usuario['password']),
                    'tipo_usuario' => $usuario['role'],
                    'empleado' => $usuario['empleado'],
                    'estado' => $usuario['estado']
                ]);
            } else {
                $usuario = DB::table('users')->where('id', $usuario['id'])->update([
                    'name' => $usuario['name'],
                    'email' => $usuario['email'],
                    'tipo_usuario' => $usuario['role'],
                    'empleado' => $usuario['empleado'],
                    'estado' => $usuario['estado']
                ]);
            }
        }
        return response()->json(['success' => 'Usuario guardado correctamente'], 200);
    }

    function eliminarUsuario($id)
    {
        $usuario = DB::table('users')->where('id', $id)->delete();
        return response()->json(['success' => 'Usuario eliminado correctamente'], 200);
    }

    function actualizarUsuario(Request $request)
    {
        $usuario = $request->all();

        if (!$usuario['cambiar_password']) {
            $usuarios = DB::table('users')->where('id', $usuario['id'])->update([
                'name' => $usuario['name'],
                'email' => $usuario['email'],
                'password' => Hash::make($usuario['new_password'])
            ]);
        } else {

            $usuarios = DB::table('users')->where('id', $usuario['id'])->update([
                'name' => $usuario['name'],
                'email' => $usuario['email']
            ]);
        }

        $usuario = DB::table('users')->where('id', $usuario['id'])->first();

        return response()->json([
            'success' => 'Usuario actualizado correctamente',
            'user' => $usuario,
            'status' => 'success'
        ], 200);
    }

    function cargarTareasEmpleado($id)
    {
        $tareas = DB::table('tareas_empleados')
            ->where('empleado', $id)
            ->where('estado_reg', 'Activo')
            ->get();

        $tareasIds = $tareas->pluck('id');

        $evidencias = DB::table('evidencia_tarea')
            ->whereIn('tarea', $tareasIds)
            ->get();

        $tareas = $tareas->map(function ($tarea) use ($evidencias) {
            $tarea->evidencias = $evidencias->where('tarea', $tarea->id)->values();
            return $tarea;
        });

        return response()->json($tareas);
    }

    function completarTareaConEvidencias(Request $request)
    {


        $tarea = $request->all();
        $tarea = DB::table('tareas_empleados')->where('id', $tarea['id'])->update([
            'estado' => $tarea['estado']
        ]);

        $evidencias = $tarea['evidencias'];
        foreach ($evidencias as $evidencia) {
            $evidencia = DB::table('evidencia_tarea')->insert([
                'tarea' => $tarea['id'],
                'evidencia' => $evidencia['ruta'],
                'nombre' => $evidencia['nombre'],
                'tipo' => $evidencia['tipo']
            ]);
        }

        return response()->json(['success' => 'Tarea actualizada correctamente'], 200);
    }

    function eliminarEvidencia($id)
    {
        $evidencia = DB::table('evidencia_tarea')->where('id', $id)->delete();
        return response()->json(['success' => 'Evidencia eliminada correctamente'], 200);
    }

    function cargarEmpleadosTareas()
    {
        $empleados = DB::table('empleados')
            ->where('estado_registro', 'Activo')
            ->leftJoin("cargos", "empleados.cargo", "cargos.id")
            ->leftJoin("departamentos", "empleados.departamento", "departamentos.id")
            ->leftJoin("empresas", "empleados.empresa", "empresas.id")
            ->select("empleados.*", "cargos.nombre as cargo", "departamentos.nombre as departamento", "empresas.nombre as empresa")

            ->get();

        $empleadosData = [];

        foreach ($empleados as $empleado) {
            // Obtener las tareas asignadas al empleado
            $tareas = DB::table('tareas_empleados')
                ->where('empleado', $empleado->id)
                ->where('estado_reg', 'Activo')
                ->get();

            // Obtener las funciones del empleado
            $funciones = DB::table('funciones_empleado')
                ->where('empleado', $empleado->id)
                ->where('estado', 'Activo')
                ->get();

            // Contar las tareas según su estado
            $tareasCompletadas = $tareas->where('estado', 'Completada')->count();
            $tareasPendientes = $tareas->where('estado', 'Pendiente')->count();
            $tareasEnProceso = $tareas->where('estado', 'En Proceso')->count();

            //CALCULAR TAREAS ATRASADAS si la fecha pactada es menor a la fecha actual
            if ($tareas->where('fecha_pactada', '<', now())->count() > 0) {
                $tareasAtrasadas = $tareas->where('fecha_pactada', '<', now())->count();
            } else {
                $tareasAtrasadas = 0;
            }


            // Calcular eficiencia y avance
            $totalTareas = $tareas->count();
            $eficiencia = $totalTareas > 0 ? round(($tareasCompletadas / $totalTareas) * 100, 2) : 0;
            $avance = $totalTareas > 0 ? round(($tareasCompletadas / $totalTareas) * 100, 2) : 0;

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
                    'ultimaActividad' => $empleado->ultima_actividad ?? null,
                    'ranking' => rand(1, 10) // Puedes definir una lógica real para esto
                ],
                'avance' => $avance,
                'tareasRecientes' => $tareasRecientes
            ];
        }

        return response()->json($empleadosData);
    }

    function cargarTareaSeleccionada($id)
    {
        $tarea = DB::table('tareas_empleados')->where('id', $id)->first();

        $evidencias = DB::table('evidencia_tarea')->where('tarea', $id)->get();

        $tarea->evidencias = $evidencias;

        return response()->json($tarea);
    }

    function realizarObservaciones(Request $request, $id)
    {
      
        $data = $request->all();
        
        $observaciones = DB::table('observaciones_tareas')->insert([
            'id_tarea' => $id,
            'observaciones' => $data['observaciones'], 
            'visto_bueno' => $data['visto_bueno']
        ]);

        //actualizar estado de la tarea
        $tarea = DB::table('tareas_empleados')->where('id', $id)->update([
            'visto_bueno' => $data['visto_bueno']
        ]);

        //generar notificacion
        $notificacion = DB::table('notificaciones')->insert([
            'id_tarea' => $id,
            'descripcion' => 'Se han realizado observaciones a la tarea',
            'fecha' => now(),
            'tipo' => 'Observaciones',
            'leida' => 0,
            'emisor' => 'Lider',
            'id_empleado' => $data['id_empleado'],
            'id_lider' => $data['id_lider']
        ]);

        return response()->json(['success' => 'Observaciones realizadas correctamente'], 200);
    }
}
