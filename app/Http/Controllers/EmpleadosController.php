<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use App\Mail\NotificacionMailable;

class EmpleadosController extends Controller
{
    function cargarNotificaciones(Request $request)
    {
        $tipo = $request->input('tipo');
        $id = $request->input('id');

        //consultar tareas atrasadas
        $tareasAtrasadas = DB::table('tareas_empleados')
            ->join('empleados', 'tareas_empleados.empleado', 'empleados.id')
            ->where('fecha_pactada', '<', now())
            ->where('tareas_empleados.estado', '!=', 'Completada')
            ->where('tareas_empleados.estado_reg', 'Activo')
            ->select(
                DB::raw('CONCAT(empleados.nombres, " ", empleados.apellidos) as nombre_empleado'),
                'tareas_empleados.*'
            )
            ->get();

        //insertar notificacion
        // foreach ($tareasAtrasadas as $tarea) {
        //     //consultar lider del empleado
        //     $lider = DB::table('lideres_empleados')
        //         ->join('empleados', 'lideres_empleados.lider', 'empleados.id')
        //         ->where('empleado', $tarea->empleado)
        //         ->select(
        //             DB::raw('CONCAT(empleados.nombres, " ", empleados.apellidos) as nombre_lider'),
        //             'lideres_empleados.lider'
        //         )
        //         ->first();
        //         if ($lider) {
        //             $liderSeleccionado = $lider->lider;
        //         } else {
        //             $liderSeleccionado = Auth::user()->id;
        //         }

        //     $notificacion = [
        //         'id_empleado' => $tarea->empleado,
        //         'id_lider' => $liderSeleccionado,
        //         'descripcion' => 'Tiene una tarea atrasada ' . $tarea->titulo . ' fecha pactada ' . $tarea->fecha_pactada,
        //         'fecha' => now(),
        //         'tipo' => 'Recordatorio',
        //         'leida' => 0,
        //         'emisor' => 'Lider'
        //     ];
        // }

        // //insertar notificacion
        // DB::table('notificaciones')->insert($notificacion);

        if ($tipo == 'admin') {
            $notificaciones = DB::table('notificaciones')
                ->join('empleados as empleado', 'notificaciones.id_empleado', 'empleado.id')
                ->join('users as lider', 'notificaciones.id_lider', 'lider.id')
                ->select(
                    'notificaciones.*',
                    DB::raw('CONCAT(empleado.nombres, " ", empleado.apellidos) as nombre_completo'),
                    DB::raw('CONCAT(lider.name) as nombre_lider')
                )
                ->where('leida', 0)
                ->orderBy('notificaciones.id', 'desc')
                ->get();
        } else {
            if ($tipo == 'empleado') {

                $notificaciones = DB::table('notificaciones')
                    ->join('users', 'notificaciones.id_lider', 'users.id')
                    ->select('notificaciones.*', 'users.name as nombre_completo')
                    ->where('id_empleado', $id)
                    ->where('leida', 0)
                    ->where('emisor', '!=', $tipo)
                    ->orderBy('notificaciones.id', 'desc')
                    ->get();
                   
            } else {
                $notificaciones = DB::table('notificaciones')
                    ->join('empleados', 'notificaciones.id_empleado', 'empleados.id')
                    ->select(
                        'notificaciones.*',
                        DB::raw('CONCAT(empleados.nombres, " ", empleados.apellidos) as nombre_completo')
                    )
                    ->where('id_lider', Auth::user()->id)
                    ->where('leida', 0)
                    ->where('emisor', '!=', $tipo)
                    ->orderBy('notificaciones.id', 'desc')
                    ->get();
            }
        }

        //agregar notificaciones de tareas atrasadas
        // $notificaciones = $notificaciones->merge($notificacion);
        return response()->json($notificaciones);
    }

    function actualizarUsuario(Request $request)
    {
        $usuario = $request->all();

        if (!$usuario['cambiar_password']) {
            $usuarios = DB::table('users')->where('id', $usuario['id'])->update([
                'name' => $usuario['name'],
                'email' => $usuario['email'],
                'password' => Hash::make($usuario['new_password']),
                'foto' => $usuario['foto']
            ]);
        } else {

            $usuarios = DB::table('users')->where('id', $usuario['id'])->update([
                'name' => $usuario['name'],
                'email' => $usuario['email'],
                'foto' => $usuario['foto']
            ]);
        }

        $usuario = DB::table('users')->where('id', $usuario['id'])->first();

        return response()->json([
            'success' => 'Usuario actualizado correctamente',
            'user' => $usuario,
            'status' => 'success'
        ], 200);
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

    function buscarEmpleados()
    {

        $searchTerm = request('params.search');

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


    function cargarEmpresas()
    {
        $empresas = DB::table('empresas')
            ->where('estado', 'ACTIVO')
            ->get();
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
                    'lider' => $empleado['lider'],
                    'foto' => $empleado['foto']
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
                    'name' => $empleadoData['nombres'] . ' ' . $empleadoData['apellidos'],
                    'email' => $empleadoData['email'],
                    'password' => Hash::make($empleadoData['identificacion']),
                    'tipo_usuario' => 'Empleado',
                    'empleado' => $empleadoData['id'],
                    'lider' => $empleadoData['lider'],
                    'foto' => $empleadoData['foto']
                ]);
            }


            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }



        return response()->json(['success' => 'Empleado guardado correctamente'], 200);
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
        return response()->json(['success' => 'Función actualizada correctamente'], 200);
    }

    function cargarTareas($id)
    {
        $tareas = DB::table('tareas_empleados')
            ->where('empleado', $id)
            ->where('estado_reg', 'Activo')
            ->orderBy('id', 'desc')
            ->get();

        //obtener observaciones de las tareas
        $observaciones = DB::table('observaciones_tareas')
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
            if ($tarea['accion'] == 'guardar') {
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
            } else {
                $IdTarea = DB::table('tareas_empleados')->where('id', $tarea['id'])->update([
                    'titulo' => $tarea['titulo'],
                    'descripcion' => $tarea['descripcion'],
                    'fecha_pactada' => $tarea['fecha_pactada'],
                    'prioridad' => $tarea['prioridad'],
                    'estado' => $tarea['estado'],
                ]);
            }

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
            $lider = DB::table('lideres_empleados')
                ->leftJoin('users', 'lideres_empleados.lider', 'users.empleado')
                ->select('users.id')
                ->where('lideres_empleados.empleado', $tarea['empleado'])
                ->first();

            $liderEmpleado = "No";
            if ($lider) {
                $lider = $lider;
                $liderEmpleado = "Si";
            } else {
                $lider = DB::table('users')->where('lider_seguimiento', 'Si')->first();
           
                if ($lider) {
                    $lider = $lider->id;
                } else {
                    $lider = DB::table('users')->where('tipo_usuario', 'Administrador')->first();
                    $lider = $lider->id;
                }
            }

            //insertar notificacion


            if ($liderEmpleado == 'Si' || Auth::user()->tipo_usuario == 'Administrador') {

                $descripcion = 'Te ha asignado una nueva tarea, "' . $tarea['titulo'] . '"';
                $emisor = 'Lider';


                DB::table('notificaciones')->insert([
                    'id_lider' => Auth::user()->id,
                    'id_empleado' => $tarea['empleado'],
                    'id_tarea' => $IdTarea,
                    'descripcion' => $descripcion,
                    'leida' => 0,
                    'fecha' => now(),
                    'tipo' => 'Tarea',
                    'emisor' => 'Lider'
                ]);

                //      $this->enviarNotificacion($descripcion, $tarea['empleado'], $emisor, $lider->id);
            } else {
                $descripcion = 'Ha creado una nueva tarea, "' . $tarea['titulo'] . '"';
                $emisor = 'Empleado';
                DB::table('notificaciones')->insert([
                    'id_lider' => $lider,
                    'id_empleado' => $tarea['empleado'],
                    'id_tarea' => $IdTarea,
                    'descripcion' => $descripcion,
                    'leida' => 0,
                    'fecha' => now(),
                    'tipo' => 'Tarea',
                    'emisor' => 'Empleado'
                ]);
                //     $this->enviarNotificacion($descripcion, $tarea['empleado'], $emisor, $lider->id);
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

    function enviarNotificacion($descripcion, $empleado, $emisor, $lider)
    {
        if ($emisor == 'Lider') {
            $empleado = DB::table('empleados')->where('id', $empleado)->first();
            $notificacion = [
                'name' => $empleado->nombres . ' ' . $empleado->apellidos,
                'message' => $descripcion,
                'tipo' => 'nueva-tarea',
                'emisor' => 'Lider'
            ];
            $email = $empleado->email;
        } else {
            $lider = DB::table('users')->where('id', $lider)->first();
            $empleado = DB::table('empleados')->where('id', $empleado)->first();
            $notificacion = [
                'name' => $lider->name,
                'message' => $descripcion,
                'tipo' => 'nueva-tarea',
                'empleado' => $empleado->nombres . ' ' . $empleado->apellidos,
                'emisor' => 'Empleado'
            ];
            $email = $lider->email;
        }


        Mail::to($email)->send(new NotificacionMailable($notificacion));
        return response()->json(['success' => 'Notificación enviada correctamente'], 200);
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

    function actualizarTarea(Request $request, $id)
    {
        $tarea = $request->all();
        DB::table('tareas_empleados')->where('id', $id)->update([
            'titulo' => $tarea['titulo'],
            'descripcion' => $tarea['descripcion'],
            'fecha_pactada' => $tarea['fecha_pactada'],
            'prioridad' => $tarea['prioridad']
        ]);
        return response()->json(['success' => 'Tarea actualizada correctamente'], 200);
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
                    'fecha_entregada' => $tarea['fecha_entregada']
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

            if ($lider) {
                $lider = $lider->lider;
            } else {
                $lider = DB::table('users')->where('lider_seguimiento', 'Si')->first();
                if ($lider) {
                    $lider = $lider->id;
                } else {
                    $lider = DB::table('users')->where('tipo_usuario', 'Administrador')->first();
                    $lider = $lider->id;
                }
            }

            //insertar notificacion
            if (Auth::user()->lider == 'Si' || Auth::user()->tipo_usuario == 'Administrador') {
                DB::table('notificaciones')->insert([
                    'id_lider' => $lider,
                    'id_empleado' => $empleado->empleado,
                    'id_tarea' => $id,
                    'descripcion' => 'Te ha actualizado el estado de la tarea a ' . $tarea['estado'],
                    'leida' => 0,
                    'fecha' => now(),
                    'tipo' => 'Mensaje',
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
                    'tipo' => 'Mensaje',
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

            //agregar evidencias a las tareas
            $evidencias = DB::table('evidencia_tarea')->whereIn('tarea', $tareas->pluck('id'))->get();
            $tareas = $tareas->map(function ($tarea) use ($evidencias) {
                $tarea->evidencias = $evidencias->where('tarea', $tarea->id)->values();
                return $tarea;
            });

            //cargar observaciones de las tareas
            $observaciones = DB::table('observaciones_tareas')
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

    function eliminarEvidencia($id)
    {
        $evidencia = DB::table('evidencia_tarea')->where('id', $id)->delete();
        return response()->json(['success' => 'Evidencia eliminada correctamente'], 200);
    }

    function cargarTareaSeleccionada($id)
    {
        $tarea = DB::table('tareas_empleados')->where('id', $id)->first();

        //obtener observaciones de las tareas
        $observaciones = DB::table('observaciones_tareas')
            ->join('users', 'observaciones_tareas.creador', 'users.id')
            ->select('observaciones_tareas.*', 'users.name as creador')
            ->where('id_tarea', $tarea->id)
            ->orderBy('observaciones_tareas.fecha', 'desc')
            ->get();

        // Agregar observaciones a las tareas
        $tarea->observaciones = $observaciones;



        $evidencias = DB::table('evidencia_tarea')->where('tarea', $id)->get();

        $tarea->evidencias = $evidencias;

        return response()->json($tarea);
    }

    function cambiarEstadoNotificacion(Request $request, $id)
    {
        $notificacion = $request->all();
        DB::table('notificaciones')->where('id', $id)->update(['leida' => 1]);
        return response()->json(['success' => 'Notificación actualizada correctamente'], 200);
    }

    function realizarObservaciones(Request $request, $id)
    {

        $data = $request->all();

        $observaciones = DB::table('observaciones_tareas')->insert([
            'id_tarea' => $id,
            'observaciones' => $data['observaciones'],
            'fecha' => now(),
            'creador' => Auth::user()->id
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

    function vistoBueno(Request $request, $id)
    {
        $data = $request->all();
        //manejo de errores
        try {

            DB::table('tareas_empleados')
                ->where('id', $id)
                ->update([
                    'visto_bueno' => (int) filter_var($data['visto_bueno'], FILTER_VALIDATE_BOOLEAN)
                ]);

            //consultar empleado de la tarea
            $empleado = DB::table('tareas_empleados')->where('id', $id)->first();

            //consultar lider de la tarea
            $lider = DB::table('lideres_empleados')
                ->join('users', 'lideres_empleados.lider', 'users.empleado')
                ->select('users.id')
                ->where('lideres_empleados.empleado', $empleado->empleado)->first();


            if ($lider) {
                $lider = $lider->id;
            } else {
                $lider = Auth::user()->id;
            }


            if ($data['visto_bueno']) {
                $descripcion = 'ha generado un visto bueno para la tarea';
            } else {
                $descripcion = 'ha quitado el visto bueno de la tarea';
            }

            //generar notificacion
            $notificacion = DB::table('notificaciones')->insert([
                'id_tarea' => $id,
                'descripcion' => $descripcion,
                'fecha' => now(),
                'tipo' => 'Mensaje',
                'leida' => 0,
                'emisor' => 'Lider',
                'id_empleado' => $empleado->empleado,
                'id_lider' => $lider
            ]);


            return response()->json(['success' => 'Visto bueno actualizado correctamente'], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
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

    function listaEmpleados()
    {
        $empleados = DB::table('empleados')
            ->where('estado_registro', 'Activo')
            ->select(
                'id',
                DB::raw('CONCAT(nombres, " ", apellidos) as nombre')
            )
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
                'estado' => $usuario['estado'],
                'foto' => $usuario['foto'],
                'lider_seguimiento' => $usuario['lider_seguimiento']
            ]);
        } else {
            if ($usuario['cambiar_password']) {
                $usuario = DB::table('users')->where('id', $usuario['id'])->update([
                    'name' => $usuario['name'],
                    'email' => $usuario['email'],
                    'password' => Hash::make($usuario['password']),
                    'tipo_usuario' => $usuario['role'],
                    'empleado' => $usuario['empleado'],
                    'estado' => $usuario['estado'],
                    'foto' => $usuario['foto'],
                    'lider_seguimiento' => $usuario['lider_seguimiento']
                ]);
            } else {
                $usuario = DB::table('users')->where('id', $usuario['id'])->update([
                    'name' => $usuario['name'],
                    'email' => $usuario['email'],
                    'tipo_usuario' => $usuario['role'],
                    'empleado' => $usuario['empleado'],
                    'estado' => $usuario['estado'],
                    'foto' => $usuario['foto'],
                    'lider_seguimiento' => $usuario['lider_seguimiento']
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

    function buscarEmpresas(Request $request)
    {
        $searchTerm = $request->input('search');
        $empresas = DB::table('empresas')
            ->where('nombre', 'like', '%' . $searchTerm . '%')
            ->where('estado', 'Activo')
            ->get();
        return response()->json($empresas);
    }

    function guardarEmpresa(Request $request)
    {
        $compania = $request->all();

        DB::beginTransaction();
        try {
            if ($compania['accion'] == 'guardar') {
                $empresa = DB::table('empresas')->insert([
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
                $empresa = DB::table('empresas')->where('id', $compania['id'])->update([
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

            DB::commit();
            return response()->json(['success' => 'Empresa guardada correctamente'], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    function eliminarEmpresa($id)
    {
        $empresa = DB::table('empresas')->where('id', $id)->update([
            'estado' => 'ELIMINADO'
        ]);
        return response()->json(['success' => 'Empresa eliminada correctamente'], 200);
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

    function cargarEmpleadosLider($id)
    {
        $empleados = DB::table('lideres_empleados')
            ->join('empleados', 'lideres_empleados.empleado', '=', 'empleados.id')
            ->select('empleados.*', 'lideres_empleados.lider')
            ->where('lideres_empleados.lider', $id)
            ->get();
        return response()->json($empleados);
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

    function informeTareas()
    {
        $tareas = DB::table('tareas_empleados')
            ->join('empleados', 'tareas_empleados.empleado', 'empleados.id')
            ->join('empresas', 'empleados.empresa', 'empresas.id')
            ->select(
                'tareas_empleados.*',
                DB::raw('concat(empleados.nombres, " ", empleados.apellidos) as empleado'),
                'empresas.nombre as empresa'
            )
            ->where('estado_reg', 'Activo')
            ->get();

        return response()->json($tareas);
    }

    function verificarEmpleadoLider($id)
    {
        $empleado = DB::table('lideres_empleados')->where('empleado', $id)->first();
        if ($empleado) {
            return response()->json(['existe' => true]);
        } else {
            return response()->json(['existe' => false]);
        }
    }

    function eliminarFuncion($id)
    {
        $funcion = DB::table('funciones_empleado')->where('id', $id)->delete();
        return response()->json(['success' => 'Funcion eliminada correctamente'], 200);
    }

    function cargarActividades($id)
    {
        $actividades = DB::table('actividades_empleado')->where('empleado', $id)->get();
        return response()->json($actividades);
    }

    function guardarActividad(Request $request)
    {
        $actividadActual = $request->all();
        $actividad = DB::table('actividades_empleado')->insert([
            'empleado' => $actividadActual['empleado'],
            'descripcion' => $actividadActual['actividad']
        ]);

        $actividad = DB::table('actividades_empleado')
            ->where('empleado', $actividadActual['empleado'])
            ->orderBy('id', 'desc')
            ->first();

        return response()->json(['success' => 'Actividad guardada correctamente', 'actividad' => $actividad], 200);
    }

    function eliminarActividad($id)
    {
        $actividad = DB::table('actividades_empleado')->where('id', $id)->delete();
        return response()->json(['success' => 'Actividad eliminada correctamente'], 200);
    }

    function actualizarActividad($id, Request $request)
    {
        $actividadActual = $request->all();
        $actividad = DB::table('actividades_empleado')->where('id', $id)->update([
            'descripcion' => $actividadActual['descripcion']
        ]);

        return response()->json(['success' => 'Actividad actualizada correctamente'], 200);
    }

    function rechazarTarea($id, Request $request)
    {

        $data = $request->all();
        try {

            DB::table('tareas_empleados')
                ->where('id', $id)
                ->update([
                    'rechazada' => (int) filter_var($data['rechazada'], FILTER_VALIDATE_BOOLEAN),
                    'estado' => $data['rechazada'] ? 'En Proceso' : 'Completada'
                ]);

                $empleado = DB::table('tareas_empleados')->where('id', $id)->first();

                //consultar lider de la tarea
                $lider = DB::table('lideres_empleados')
                    ->join('users', 'lideres_empleados.lider', 'users.empleado')
                    ->select('users.id')
                    ->where('lideres_empleados.empleado', $empleado->empleado)->first();
    
    
                if ($lider) {
                    $lider = $lider->id;
                } else {
                    $lider = Auth::user()->id;
                }
    
    
                if ($data['rechazada']) {
                    $descripcion = 'ha rechazado la tarea';
                } else {
                    $descripcion = 'ha generado un visto bueno para la tarea';
                }
    
                //generar notificacion
                $notificacion = DB::table('notificaciones')->insert([
                    'id_tarea' => $id,
                    'descripcion' => $descripcion,
                    'fecha' => now(),
                    'tipo' => 'Mensaje',
                    'leida' => 0,
                    'emisor' => 'Lider',
                    'id_empleado' => $empleado->empleado,
                    'id_lider' => $lider
                ]);

                return response()->json(['success' => 'Tarea rechazada correctamente'], 200);

        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    function aprobarTarea($id, Request $request)
    {
        $data = $request->all();
        $tarea = DB::table('tareas_empleados')->where('id', $id)->update([
            'aprobada' => (int) filter_var($data['aprobada'], FILTER_VALIDATE_BOOLEAN)
        ]);

        return response()->json(['success' => 'Tarea aprobada correctamente'], 200);
    }
}
