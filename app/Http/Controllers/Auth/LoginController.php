<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
class LoginController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required'
        ]);

        if (Auth::attempt($credentials, $request->remember)) {
            $user = Auth::user();

            $empleadosAsignados = DB::table('lideres_empleados')
            ->join('empleados', 'lideres_empleados.empleado', 'empleados.id')
            ->select('empleados.id', 
            DB::raw('CONCAT(empleados.nombres, " ", empleados.apellidos) as nombre'))
            ->where('lideres_empleados.lider', $user->empleado)
            ->get();
            $token = $user->createToken('auth-token')->plainTextToken;
            
            return response()->json([
                'status' => 'success',
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'tipo_usuario' => $user->tipo_usuario,
                    'empleado' => $user->empleado,
                    'lider' => $user->lider,
                    'foto' => $user->foto,
                    'empleados_asignados' => $empleadosAsignados
                ]
            ]);
        }

        return response()->json([
            'status' => 'error',
            'message' => 'Credenciales inválidas'
        ], 401);
    }

    public function logout(Request $request)
    {
        try {
            // Revocar el token actual
            $request->user()->currentAccessToken()->delete();
            
            return response()->json([
                'status' => 'success',
                'message' => 'Sesión cerrada correctamente'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error al cerrar sesión'
            ], 500);
        }
    }
} 