<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class LoginController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (Auth::attempt($credentials)) {
            $request->session()->regenerate();
            
            //conevtar a otra  base de datos para obtener usuario

            $user = Auth::user();
            
            // Obtener empleados asignados
            $empleadosAsignados = DB::table('lideres_empleados')
                ->join('empleados', 'lideres_empleados.empleado', 'empleados.id')
                ->select('empleados.id', 
                DB::raw('CONCAT(empleados.nombres, " ", empleados.apellidos) as nombre'))
                ->where('lideres_empleados.lider', $user->empleado)
                ->get();

            return response()->json([
                'message' => 'Login exitoso',
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
            'message' => 'Las credenciales proporcionadas son incorrectas.'
        ]);
    }

    public function logout(Request $request)
    {
        if ($request->user()) {
            $request->user()->tokens()->delete();
        }
        
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logout exitoso']);
    }
} 