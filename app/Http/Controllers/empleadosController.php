<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
class empleadosController extends Controller
{
    function guardarEmpleado(Request $request)
    {
        $empleado = $request->all();
        DB::beginTransaction();
        try {
            if($empleado['accion'] == 'guardar'){
         
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
                    'fecha_nacimiento' => $empleado['fechaNacimiento'],
                    'fecha_ingreso' => $empleado['fechaIngreso'],
                    'tipo_contrato' => $empleado['tipoContrato'],
                    'direccion' => $empleado['direccion'],
                    'telefono' => $empleado['telefono'],
                    'foto' => $empleado['foto'],
                    'estado_registro' => 'Activo',
                    'estado' => $empleado['estado']
                ]
            );



            $usuario = DB::table('users')->insert([
                'name' => $empleado['nombres'] . ' ' . $empleado['apellidos'],
                'email' => $empleado['email'],
                'password' => Hash::make($empleado['identificacion']),
                'tipo_usuario' => 'Empleado',
                'estado' => 'Activo',
                'empleado' => $empleadoId
            ]);

            }else{
                $empleado = DB::table('empleados')->where('id', $empleado['id'])->update(
                    [
                        'identificacion' => $empleado['identificacion'],
                        'nombres' => $empleado['nombres'],
                        'apellidos' => $empleado['apellidos'],
                        'email' => $empleado['email'],
                        'departamento' => $empleado['departamento'],
                        'empresa' => $empleado['empresa'],
                        'cargo' => $empleado['cargo'],
                        'telefono' => $empleado['telefono'],
                        'fecha_nacimiento' => $empleado['fechaNacimiento'],
                        'fecha_ingreso' => $empleado['fechaIngreso'],
                        'tipo_contrato' => $empleado['tipoContrato'],
                        'direccion' => $empleado['direccion'],
                        'foto' => $empleado['foto'],
                        'estado' => $empleado['estado']
                    ]
                );
                $usuario = DB::table('users')->where('email', $empleado['email'])->update([
                    'name' => $empleado['nombres'],
                    'email' => $empleado['email'],
                    'password' => Hash::make($empleado['identificacion']),
                    'tipo_usuario' => 'Empleado'

                ]);
            }


            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
           
        }
        return response()->json(['success' => 'Empleado guardado correctamente'], 200);
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
        ->join('empresas', 'empleados.empresa', '=', 'empresas.id')
        ->join('departamentos', 'empleados.departamento', '=', 'departamentos.id')
        ->join('cargos', 'empleados.cargo', '=', 'cargos.id')
        ->select('empleados.*', 'empresas.nombre as nombre_empresa', 'departamentos.nombre as nombre_departamento', 'cargos.nombre as nombre_cargo')
        ->where('empleados.estado_registro', 'Activo')
        ->get();
        return response()->json($empleados);
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

    function guardarTarea(Request $request)
    {
        $tarea = $request->all();
        DB::beginTransaction();
        try {

            $IdTarea = DB::table('tareas_empleados')->insertGetId([
                'empleado' => $tarea['empleado'],
                'descripcion' => $tarea['descripcion'],
                'estado' => 'Activo',
                'estado_reg' => 'Activo'
            ]);

            /// isertar evidencia
            $evidencias = $tarea['evidencias'];
            foreach ($evidencias as $evidencia) {
                $evidencia = DB::table('evidencia_tarea')->insert([
                    'tarea' => $IdTarea,
                    'evidencia' => $evidencia['ruta'],
                    'nombre' => $evidencia['nombre'],
                    'tipo' => $evidencia['tipo']
                ]);
            }


            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
        return response()->json(['success' => 'Tarea guardada correctamente'], 200);
    }

    function actualizarEstadoTarea(Request $request, $id)
    {
        $tarea = $request->all();
    
        DB::beginTransaction();
        try {
            $tareas = DB::table('tareas_empleados')->where('id', $id)->update([
                'estado' => $tarea['estado'],
                'fecha_entregada' => $tarea['fecha_entregada']
            ]);
        
        if($tarea['estado'] == 'Completada'){
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

        DB::commit();
        return response()->json(['success' => 'Estado de la tarea actualizado correctamente'], 200);
        } catch (\Exception $e) {
            DB::rollBack();
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
        ->join('empleados', 'users.empleado', 'empleados.id')
        ->select('users.*', DB::raw('CONCAT(empleados.nombres, " ", empleados.apellidos) as nombre_empleado'))
        ->where('users.tipo_usuario', 'Empleado')
        ->where('users.name', 'like', '%'.$searchTerm.'%')
        ->orWhere('users.email', 'like', '%'.$searchTerm.'%')
        ->orWhere('empleados.nombres', 'like', '%'.$searchTerm.'%')
        ->orWhere('empleados.apellidos', 'like', '%'.$searchTerm.'%')
        ->get();
    }

    function guardarUsuario(Request $request)
    {
        $usuario = $request->all();
        if($usuario['accion'] == 'guardar'){    
            $usuario = DB::table('users')->insert([
                'name' => $usuario['name'],
                'email' => $usuario['email'],
                'password' => Hash::make($usuario['password']),
                'tipo_usuario' => $usuario['role'],
                'empleado' => $usuario['empleado'],
                'estado' => $usuario['estado']
            ]);
        }else{
            if($usuario['cambiar_password']){
                $usuario = DB::table('users')->where('id', $usuario['id'])->update([
                    'name' => $usuario['name'],
                    'email' => $usuario['email'],
                    'password' => Hash::make($usuario['password']),
                    'tipo_usuario' => $usuario['role'],
                    'empleado' => $usuario['empleado'],
                    'estado' => $usuario['estado']
                ]);
            }else{
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
      
        if(!$usuario['cambiar_password']){
            $usuarios = DB::table('users')->where('id', $usuario['id'])->update([
                'name' => $usuario['name'],
                'email' => $usuario['email'],
                'password' => Hash::make($usuario['new_password'])
            ]);
        }else{
           
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
}
