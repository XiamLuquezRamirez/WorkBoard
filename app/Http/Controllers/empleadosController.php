<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
class empleadosController extends Controller
{
    function guardarEmpleado(Request $request)
    {
        $empleado = $request->all();
        DB::beginTransaction();
        try {
            if($empleado['accion'] == 'guardar'){
            $empleado = DB::table('empleados')->insert(
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
        dd($tarea);
        DB::beginTransaction();
        try {
            $IdTarea = DB::table('tareas_empleados')->insertGetId([
                'empleado' => $tarea['empleado'],
                'descripcion' => $tarea['descripcion'],
                'estado' => 'Activo',
                'estado_reg' => 'Activo'
            ]);
           

            /// isertar evidencia
            $evidencia = DB::table('evidencia_tarea')->insert([
                'tarea' => $IdTarea,
                'evidencia' => $tarea['evidencia'],
                'estado' => 'Activo',
                'estado_reg' => 'Activo'
            ]);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
        return response()->json(['success' => 'Tarea guardada correctamente'], 200);
    }
}
