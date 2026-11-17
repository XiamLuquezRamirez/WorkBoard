<?php

namespace Tests\Feature\Suite;

use App\Models\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * Base común de las pruebas del ciclo de vida de las tareas.
 *
 * Además del equipo de DatosDeEquipo (Laura líder de Carlos e Inés, Inés con
 * independencia, Ana ajena, Víctor verificador) añade una administradora con
 * empleado y ayudas para insertar tareas, subtareas y leer avisos.
 *
 * No es una clase de prueba: el nombre no termina en «Test» y es abstracta.
 */
abstract class CicloTareasCaso extends TestCase
{
    use DatabaseTransactions;
    use DatosDeEquipo;

    protected $connectionsToTransact = ['mysql2'];

    /** Empleado de la administradora. */
    protected int $admin;

    /** Id que no existe en ninguna tabla de la base de pruebas. */
    protected const INEXISTENTE = 987654321;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararEquipo();
        Mail::fake();
        $this->withoutDefer();

        $this->admin = $this->empleado('Adela', 'Administradora');
        $this->usuario($this->admin, 'admin@prueba.test', 'No', 'No', 'Administrador');
    }

    protected function db(): ConnectionInterface
    {
        return DB::connection('mysql2');
    }

    /** Tarea heredada (sin criterios) con campos extra ya aplicados. */
    protected function tarea(array $campos = [], ?int $responsable = null, string $estado = 'Pendiente'): int
    {
        $id = $this->tareaSinCriterios($estado, $responsable);
        if ($campos !== []) {
            $this->db()->table('tareas_empleados')->where('id', $id)->update($campos);
        }
        return $id;
    }

    protected function fila(int $tarea): ?array
    {
        $f = $this->db()->table('tareas_empleados')->where('id', $tarea)->first();
        return $f ? (array) $f : null;
    }

    protected function existeTarea(int $tarea): bool
    {
        return $this->db()->table('tareas_empleados')->where('id', $tarea)->exists();
    }

    protected function subtarea(int $tarea, string $titulo, array $extra = []): int
    {
        return $this->db()->table('subtareas')->insertGetId($extra + [
            'tarea_id' => $tarea, 'titulo' => $titulo, 'completada' => 0, 'orden' => 0,
        ]);
    }

    /** users.id del empleado dado. */
    protected function idUsuario(int $empleado): int
    {
        return (int) $this->db()->table('users')->where('empleado', $empleado)->value('id');
    }

    protected function avisos(int $empleado, string $tipo)
    {
        return $this->db()->table('notif_generales')
            ->where('id_receptor', $this->idUsuario($empleado))->where('tipo', $tipo)->get();
    }

    /** Entradas del historial de la tarea (avisos de sistema) de un tipo. */
    protected function historial(int $tarea, string $tipo)
    {
        return $this->db()->table('notif_generales')
            ->where('tarea_id', $tarea)->where('tipo_receptor', 'sistema')->where('tipo', $tipo)
            ->orderBy('id')->pluck('mensaje');
    }

    /**
     * Administrador sin empleado asociado, como existen en producción. Se
     * autentica con un App\Models\User cuyo email está en mysql2.users.
     */
    protected function comoAdminSinEmpleado(): static
    {
        $this->db()->table('users')->insertOrIgnore([
            'name' => 'Admin sin empleado', 'email' => 'adminsolo@prueba.test', 'password' => 'x',
            'tipo_usuario' => 'Administrador', 'empleado' => null,
            'lider' => 'No', 'independencia' => 'No', 'estado' => 'Activo',
        ]);
        $u = new User();
        $u->id = self::INEXISTENTE;
        $u->email = 'adminsolo@prueba.test';
        return $this->actingAs($u, 'sanctum');
    }

    /** Empleado con usuario de tipo Supervisor (sin ser líder). */
    protected function supervisor(): int
    {
        $emp = $this->empleado('Sofía', 'Supervisora');
        $this->usuario($emp, 'supervisor@prueba.test', 'No', 'No', 'Supervisor');
        return $emp;
    }
}
