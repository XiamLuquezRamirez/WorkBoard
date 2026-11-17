<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Quién puede ver y tocar las tareas de un empleado.
 *
 * La regla es una sola y es la misma que ya regía para mover una tarea
 * (EmpleadosController::reglaDeEstado):
 *
 *  - el propio empleado,
 *  - cualquiera de sus líderes (lideres_empleados),
 *  - administración (Administrador o Supervisor).
 *
 * Nadie más: ni un compañero del mismo equipo ni alguien de otro equipo. El
 * espacio de equipo enseña el puesto de un compañero, pero sin sus tareas.
 *
 * Antes cada endpoint decidía por su cuenta y la mayoría no comprobaba nada:
 * con la sesión de cualquier empleado se podían leer, editar, eliminar, pausar
 * o reprogramar las tareas de cualquiera.
 */
final class AccesoTareas
{
    /** Fila de users (mysql2) de quien tiene la sesión, o null. */
    public static function usuario(): ?object
    {
        $email = Auth::user()->email ?? null;

        return $email ? DB::connection('mysql2')->table('users')->where('email', $email)->first() : null;
    }

    public static function esAdministracion(?object $u): bool
    {
        return $u && in_array($u->tipo_usuario, ['Administrador', 'Supervisor'], true);
    }

    /** ¿$u es uno de los líderes del empleado? */
    public static function lidera(?object $u, int $empleado): bool
    {
        return $u && $u->empleado && DB::connection('mysql2')->table('lideres_empleados')
            ->where('lider', $u->empleado)->where('empleado', $empleado)->exists();
    }

    public static function esPropio(?object $u, int $empleado): bool
    {
        return $u && $u->empleado && (int) $u->empleado === $empleado;
    }

    /** ¿Quien tiene la sesión alcanza el trabajo de este empleado? */
    public static function alcanza(?int $empleado, ?object $u = null): bool
    {
        $u ??= self::usuario();
        if (self::esAdministracion($u)) {
            return true;
        }
        if (!$empleado) {
            return false;
        }

        return self::esPropio($u, $empleado) || self::lidera($u, $empleado);
    }

    /** Ids de empleados cuyo trabajo alcanza; null = todos (administración). */
    public static function empleadosAlcanzables(?object $u = null): ?array
    {
        $u ??= self::usuario();
        if (self::esAdministracion($u)) {
            return null;
        }
        if (!$u || !$u->empleado) {
            return [];
        }

        return DB::connection('mysql2')->table('lideres_empleados')
            ->where('lider', $u->empleado)->pluck('empleado')
            ->map(fn ($id) => (int) $id)
            ->push((int) $u->empleado)->unique()->values()->all();
    }

    public static function tarea($id): ?object
    {
        return DB::connection('mysql2')->table('tareas_empleados')->where('id', (int) $id)->first();
    }

    /**
     * Carga la tarea y comprueba el acceso. Devuelve la tarea, o la respuesta
     * de error lista para devolver: 404 si no existe, 403 si no la alcanza.
     */
    public static function exigir($id, string $accion = 'ver'): object
    {
        $tarea = self::tarea($id);
        if (!$tarea) {
            return response()->json(['error' => 'Tarea no encontrada'], 404);
        }
        if (!self::alcanza((int) $tarea->empleado)) {
            return self::denegada($accion);
        }

        return $tarea;
    }

    public static function denegada(string $accion = 'ver'): JsonResponse
    {
        $verbo = $accion === 'ver' ? 'ver' : 'modificar';

        return response()->json([
            'error' => "No puedes {$verbo} esta tarea: no es tuya ni de alguien de tu equipo.",
        ], 403);
    }

    public static function esRespuesta($valor): bool
    {
        return $valor instanceof JsonResponse;
    }
}
