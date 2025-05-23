<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Support\Facades\DB;

class AuthenticatedSessionController extends Controller
{
    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request)
    {
        try {
            $request->authenticate();
            $request->session()->regenerate();

            $user = Auth::user();
            
            // Obtener empleados asignados
            $empleadosAsignados = DB::table('lideres_empleados')
                ->join('empleados', 'lideres_empleados.empleado', 'empleados.id')
                ->select('empleados.id', 
                DB::raw('CONCAT(empleados.nombres, " ", empleados.apellidos) as nombre'))
                ->where('lideres_empleados.lider', $user->empleado)
                ->get();

            // Revocar tokens anteriores
            $user->tokens()->delete();

            // Crear nuevo token
            $token = $user->createToken('auth-token')->plainTextToken;

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
                ],
                'token' => $token
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error en el login',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request)
    {
        // Revocar todos los tokens del usuario
        if ($request->user()) {
            $request->user()->tokens()->delete();
        }
        
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logout exitoso']);
    }
}
