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
        $id = $request->input('id');
        $tipo = $request->input('tipo');
        // $usuarioActual = Auth::user();
        if ($tipo === 'empleado') {
            // Obtener ID del empleado asociado
            $empleado = DB::connection('mysql2')->table('empleados')
                ->join('users', 'empleados.id', 'users.empleado')
                ->select('users.id as id_usuario', 'empleados.*')
                ->where('users.id', $id)->first();
            if ($empleado) {
                $notificaciones = DB::connection('mysql2')->table('notif_generales')->where('id_receptor', $empleado->id_usuario)
                    ->where('tipo_receptor', 'empleado')
                    ->where('leido', 0)
                    ->orderBy('notif_generales.id', 'desc')
                    ->get();
            }
        } else {
            // Usuario administrador o líder
            $notificaciones = DB::connection('mysql2')->table('notif_generales')->where('id_receptor', $id)
                ->where('tipo_receptor', 'usuario')
                ->where('leido', 0)
                ->orderBy('notif_generales.id', 'desc')
                ->get();
        }


        //agregar notificaciones de tareas atrasadas
        // $notificaciones = $notificaciones->merge($notificacion);
        return response()->json($notificaciones);
    }

    function actualizarUsuario(Request $request)
    {
        $usuario = $request->all();
        if (isset($usuario['cambiar_password']) && $usuario['cambiar_password']) {
            $usuarios = DB::connection('mysql2')->table('users')->where('id', $usuario['id'])->update([
                'name' => $usuario['name'],
                'email' => $usuario['email'],
                'password' => Hash::make($usuario['new_password']),
                'foto' => $usuario['foto']
            ]);
            //insertra en la tabla de usuario de chat empresarial
            DB::connection('mysql')->table('users')->where('id_usuario_tarea', $usuario['id'])->update([
                'name' => $usuario['name'],
                'email' => $usuario['email'],
                'password' => Hash::make($usuario['new_password'])
            ]);
        } else {

            $usuarios = DB::connection('mysql2')->table('users')->where('id', $usuario['id'])->update([
                'name' => $usuario['name'],
                'email' => $usuario['email'],
                'foto' => $usuario['foto']
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

    function cargarCargos()
    {
        $cargos = DB::connection('mysql2')->table('cargos')->get();
        return response()->json($cargos);
    }

    function guardarEmpleado(Request $request)
    {
        $empleado = $request->all();


        DB::connection('mysql2')->beginTransaction();
        try {
            if ($empleado['accion'] == 'guardar') {

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
                        'telefono' => $empleado['telefono'],
                        'foto' => $empleado['foto'],
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
                    'foto' => $empleado['foto']
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
                $empleadoData = $empleado; // Guardamos los datos originales

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
                    'foto' => $empleadoData['foto'],
                    'estado' => $empleadoData['estado'],
                    'lider' => $empleadoData['lider']
                ]);

                $usuario = DB::connection('mysql2')->table('users')->where('email', $empleadoData['email'])->update([
                    'name' => $empleadoData['nombres'] . ' ' . $empleadoData['apellidos'],
                    'email' => $empleadoData['email'],
                    'tipo_usuario' => 'Empleado',
                    'empleado' => $empleadoData['id'],
                    'lider' => $empleadoData['lider'],
                    'foto' => $empleadoData['foto']
                ]);

                //insertra en la tabla de usuario de chat empresarial
                DB::connection('mysql')->table('users')->where('email', $empleadoData['email'])->update([
                    'name' => $empleadoData['nombres'] . ' ' . $empleadoData['apellidos'],
                    'email' => $empleadoData['email']
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
        ->where('empleado', $id)
        ->where('estado_reg', 'Activo')
        ->orderByRaw("FIELD(prioridad, 'Alta', 'Media', 'Baja')")
        ->orderBy('id', 'desc')
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
            ->where('fecha_pactada', '<', now())
            ->where('tareas_empleados.estado', '!=', 'Completada')
            ->where('tareas_empleados.estado_reg', 'Activo')
            ->select(
                DB::connection('mysql2')->raw('CONCAT(empleados.nombres, " ", empleados.apellidos) as nombre_empleado'),
                'tareas_empleados.*'
            )
            ->get();

        foreach ($tareasAtrasadas as $tarea) {
            // Verificar si ya existe una notificación para esta tarea
            $notificacionExistente = DB::connection('mysql2')->table('notif_generales')
                ->where('tarea_id', $tarea->id)
                ->where('tipo', 'TareaAtrasada')
                ->where('leido', 0)
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
        $tarea = $request->all();
        DB::connection('mysql2')->beginTransaction();
        try {
            if ($tarea['accion'] == 'guardar') {
                $IdTarea = DB::connection('mysql2')->table('tareas_empleados')->insertGetId([
                    'titulo' => $tarea['titulo'],
                    'empleado' => $tarea['empleado'],
                    'descripcion' => $tarea['descripcion'],
                    'fecha_pactada' => $tarea['fecha_pactada'],
                    'prioridad' => $tarea['prioridad'],
                    'estado' => $tarea['estado'],
                    'estado_reg' => 'Activo',
                    'fecha_creacion' => now(),
                    'pausada' => 0
                ]);
            } else {
                $IdTarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $tarea['id'])->update([
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
                    $evidencia = DB::connection('mysql2')->table('evidencia_tarea')->insert([
                        'tarea' => $IdTarea,
                        'evidencia' => $evidencia['ruta'],
                        'nombre' => $evidencia['nombre'],
                        'tipo' => $evidencia['tipo']
                    ]);
                }
            }

            //guardar notificacion
            self::guardarNotificacion($IdTarea, 'Tarea');

            //consultar tareas del empleado
            DB::connection('mysql2')->commit();
        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }


        $tareas = DB::connection('mysql2')->table('tareas_empleados')
            ->where('empleado', $tarea['empleado'])
            ->orderBy('id', 'desc')
            ->get();

        return response()->json([
            'success' => 'Tarea guardada correctamente',
            'tareas' => $tareas
        ], 200);
    }



    function buscarTareas($id, Request $request)
    {
        $searchTerm = $request->input('search');
        $tareas = DB::connection('mysql2')->table('tareas_empleados')
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
        $evidencias = DB::connection('mysql2')->table('evidencia_tarea')
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
        DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
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


        DB::connection('mysql2')->beginTransaction();
        try {
            // actualizar estado de la tarea si es completada agregar fecha entregada
            if ($tarea['estado'] == 'Completada') {
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
            if (isset($tarea['evidencias']['evidencias'])) {
                foreach ($tarea['evidencias']['evidencias'] as $evidencia) {
                    DB::connection('mysql2')->table('evidencia_tarea')->insert([
                        'tarea' => $id,
                        'evidencia' => $evidencia['ruta'],
                        'nombre' => $evidencia['nombre_original'],
                        'tipo' => $evidencia['tipo']
                    ]);
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
        $titulo = $tarea->titulo;
        $empleado = $tarea->empleado;

        $usuarioActual = DB::connection('mysql2')->table('users')->where('email', Auth::user()->email)->first();
        // CASO 1: Empleado crea tarea
        if ($usuarioActual->tipo_usuario == 'Empleado' && $usuarioActual->lider == 'No') {

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
        if ($tipo == 'Tarea' || ($tipo == 'Estado' && $tarea->estado == 'Completada') || $tipo == 'Aprobada' || $tipo == 'Rechazada' || $tipo == 'VistoBueno' || $tipo == 'Observacion') {
          //  self::enviarNotificacion($notif);
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
            ->leftJoin("cargos", "empleados.cargo", "cargos.id")
            ->leftJoin("departamentos", "empleados.departamento", "departamentos.id")
            ->leftJoin("empresas", "empleados.empresa", "empresas.id")
            ->select("empleados.*", "cargos.nombre as cargo", "departamentos.nombre as departamento", "empresas.nombre as empresa")
            ->get();

        $empleadosData = [];


        foreach ($empleados as $empleado) {
            // Obtener las tareas asignadas al empleado
            $tareas = DB::connection('mysql2')->table('tareas_empleados')
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
            if ($tareas->where('fecha_pactada', '<', now())->count() > 0) {
                $tareasAtrasadas = $tareas->where('fecha_pactada', '<', now())->count();
            } else {
                $tareasAtrasadas = 0;
            }

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

                    if($eficienciaOperativa->eficiencia > 0){
                        $eficienciaOperativa = $eficienciaOperativa->eficiencia ?? 0;
                    }else{
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

    function vistoBueno(Request $request, $id)
    {
        $data = $request->all();
        //manejo de errores
        try {

            DB::connection('mysql2')->table('tareas_empleados')
                ->where('id', $id)
                ->update([
                    'visto_bueno' => (int) filter_var($data['visto_bueno'], FILTER_VALIDATE_BOOLEAN)
                ]);

            self::guardarNotificacion($id, 'VistoBueno');


            return response()->json(['success' => 'Visto bueno actualizado correctamente'], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
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
            $usuarioId = DB::connection('mysql2')->table('users')->insertGetId([
                'name' => $usuario['name'],
                'email' => $usuario['email'],
                'password' => Hash::make($usuario['password']),
                'tipo_usuario' => $usuario['role'],
                'empleado' => $usuario['empleado'],
                'estado' => $usuario['estado'],
                'foto' => $usuario['foto'],
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

            if ($usuario['cambiar_password']) {
                $usuario = DB::connection('mysql2')->table('users')->where('id', $usuario['id'])->update([
                    'name' => $usuario['name'],
                    'email' => $usuario['email'],
                    'password' => Hash::make($usuario['password']),
                    'tipo_usuario' => $usuario['role'],
                    'empleado' => $usuario['empleado'],
                    'estado' => $usuario['estado'],
                    'foto' => $usuario['foto'],
                    'lider_seguimiento' => $usuario['lider_seguimiento']
                ]);


                //insertra en la tabla de usuario de chat empresarial
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
                    'foto' => $usuario['foto'],
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
            ->join('empresas', 'empleados.empresa', 'empresas.id')
            ->join('departamentos', 'empleados.departamento', '=', 'departamentos.id')
            ->join('cargos', 'empleados.cargo', '=', 'cargos.id')
            ->select(
                'empleados.*',
                'empresas.nombre as nombre_empresa',
                'departamentos.nombre as nombre_departamento',
                'cargos.nombre as nombre_cargo',
                DB::connection('mysql2')->raw('(SELECT COUNT(*) FROM lideres_empleados WHERE lider = empleados.id) as empleados_asignados')
            )
            ->where('empleados.estado_registro', 'Activo')
            ->where('empleados.lider', 'Si')
            ->get();
        return response()->json($lideres);
    }

    function cargarEmpleadosLider($id)
    {
        $empleados = DB::connection('mysql2')->table('lideres_empleados')
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
        $tareas = DB::connection('mysql2')->table('tareas_empleados')
            ->join('empleados', 'tareas_empleados.empleado', 'empleados.id')
            ->join('empresas', 'empleados.empresa', 'empresas.id')
            ->select(
                'tareas_empleados.*',
                DB::connection('mysql2')->raw('concat(empleados.nombres, " ", empleados.apellidos) as empleado'),
                'empresas.nombre as empresa'
            )
            ->where('aprobada', 1)
            ->where('pausada', 0)
            ->where('estado_reg', 'Activo')
            ->get();

        return response()->json($tareas);
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

    function rechazarTarea($id, Request $request)
    {

        $data = $request->all();
        try {

            DB::connection('mysql2')->table('tareas_empleados')
                ->where('id', $id)
                ->update([
                    'rechazada' => (int) filter_var($data['rechazada'], FILTER_VALIDATE_BOOLEAN),
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

        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
            'aprobada' => (int) filter_var($data['aprobada'], FILTER_VALIDATE_BOOLEAN),
            'fecha_aprobacion' => $data['aprobada'] ? now() : null
        ]);

        self::guardarNotificacion($id, 'Aprobada');

        return response()->json(['success' => 'Tarea aprobada correctamente'], 200);
    }

    function pausarTarea($id, Request $request)
    {
        $data = $request->all();
        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
            'pausada' => (int) filter_var($data['pausada'], FILTER_VALIDATE_BOOLEAN)
        ]);
    }

    function obtenerObservacion($id)
    {
        $observacion = DB::connection('mysql2')->table('observaciones_tareas')->where('id', $id)->first();
        $usuario = DB::connection('mysql2')->table('users')->where('id', $observacion->creador)->first();
        $receptor = DB::connection('mysql')->table('users')->where('email', $usuario->email)->first();

        return response()->json(['idReceptor' => $receptor->id]);
    }
}
