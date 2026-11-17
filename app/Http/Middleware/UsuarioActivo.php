<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Cierra la sesión de un usuario desactivado en su siguiente petición.
 *
 * El login ya niega la entrada a un inactivo, pero quien tenía la sesión
 * abierta cuando lo desactivaron seguía trabajando hasta salir por su cuenta.
 * El 401 hace que la pantalla borre la sesión local y vuelva al login.
 *
 * Si el correo de la sesión no tiene fila en users (mysql2) se deja pasar:
 * de eso se encargan los controladores, que ya lo tratan como «sin usuario».
 */
class UsuarioActivo
{
    public function handle(Request $request, Closure $next): Response
    {
        $email = $request->user()?->email;
        if ($email) {
            $estado = DB::connection('mysql2')->table('users')->where('email', $email)->value('estado');
            if ($estado !== null && strcasecmp(trim($estado), 'Activo') !== 0) {
                Auth::guard('web')->logout();
                if ($request->hasSession()) {
                    $request->session()->invalidate();
                }

                return response()->json(['message' => 'Este usuario está inactivo. Contacte al administrador.'], 401);
            }
        }

        return $next($request);
    }
}
