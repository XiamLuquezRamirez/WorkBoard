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
}
