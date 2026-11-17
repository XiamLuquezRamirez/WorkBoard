<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Deja pasar solo a administración: las rutas de Parámetros (empleados,
 * usuarios, empresas, cargos, proyectos, líderes…) y las de mantenimiento.
 *
 * La pantalla ya escondía esas opciones, pero el servidor no comprobaba nada:
 * cualquier sesión podía llamarlas directamente.
 *
 * Uso: ->middleware('administracion') admite Administrador y Supervisor (lo
 * mismo que puedeAdministrar() en EmpleadosController);
 * ->middleware('administracion:Administrador') solo al Administrador.
 *
 * El rol sale de users en mysql2, por el correo de la sesión: es la misma
 * fuente que usan los controladores para autorizar.
 */
class SoloAdministracion
{
    public const ROLES_POR_DEFECTO = ['Administrador', 'Supervisor'];

    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $roles = $roles ?: self::ROLES_POR_DEFECTO;

        $email = $request->user()?->email;
        $usuario = $email
            ? DB::connection('mysql2')->table('users')->where('email', $email)->first(['tipo_usuario', 'estado'])
            : null;

        $activo = $usuario && strcasecmp(trim($usuario->estado ?? 'Activo'), 'Activo') === 0;
        if (!$activo || !in_array($usuario->tipo_usuario, $roles, true)) {
            return response()->json(['error' => 'Esta opción es solo para administración.'], 403);
        }

        return $next($request);
    }
}
