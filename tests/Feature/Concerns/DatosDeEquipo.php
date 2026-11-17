<?php

namespace Tests\Feature\Concerns;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Un equipo mínimo para probar permisos sobre tareas.
 *
 * Laura lidera a Carlos y a Inés; Inés tiene independencia. Ana no tiene
 * relación con ellos y Víctor sirve de responsable de verificación.
 *
 * Escribe en mysql2, que en las pruebas apunta a workboard_test. Las clases
 * que lo usen deben deshacer cada prueba con DatabaseTransactions y
 * $connectionsToTransact = ['mysql2'].
 */
trait DatosDeEquipo
{
    protected int $lider;
    protected int $colaborador;
    protected int $ajeno;
    protected int $verificador;
    protected int $independiente;

    private array $usuarios = [];

    protected function prepararEquipo(): void
    {
        // Salvaguarda: si la configuración estuviera en caché y apuntara a
        // workboard, se detiene aquí antes de tocar un solo dato real.
        $base = DB::connection('mysql2')->getDatabaseName();
        if (!preg_match('/^workboard_test(_\d+)?$/', $base)) {
            $this->fail("Las pruebas deben correr contra workboard_test, no contra «{$base}». Ejecuta php artisan config:clear.");
        }

        $this->lider         = $this->empleado('Laura', 'Líder');
        $this->colaborador   = $this->empleado('Carlos', 'Colaborador');
        $this->ajeno         = $this->empleado('Ana', 'Ajena');
        $this->verificador   = $this->empleado('Víctor', 'Verificador');
        $this->independiente = $this->empleado('Inés', 'Independiente');

        DB::connection('mysql2')->table('lideres_empleados')->insert([
            ['lider' => $this->lider, 'empleado' => $this->colaborador],
            ['lider' => $this->lider, 'empleado' => $this->independiente],
        ]);

        $this->usuario($this->lider, 'lider@prueba.test', 'Si');
        $this->usuario($this->colaborador, 'colaborador@prueba.test');
        $this->usuario($this->ajeno, 'ajeno@prueba.test');
        $this->usuario($this->verificador, 'verificador@prueba.test');
        $this->usuario($this->independiente, 'independiente@prueba.test', 'Si', 'Si');
    }

    protected function empleado(string $nombre, string $apellido): int
    {
        return DB::connection('mysql2')->table('empleados')->insertGetId([
            'nombres' => $nombre, 'apellidos' => $apellido,
            'estado_registro' => 'Activo', 'estado' => 'Activo',
        ]);
    }

    protected function usuario(int $empleado, string $email, string $lider = 'No', string $independencia = 'No', string $tipo = 'Empleado'): void
    {
        DB::connection('mysql2')->table('users')->insert([
            'name' => $email, 'email' => $email, 'password' => 'x',
            'tipo_usuario' => $tipo, 'empleado' => $empleado,
            'lider' => $lider, 'independencia' => $independencia, 'estado' => 'Activo',
        ]);
        $this->usuarios[$empleado] = $email;
    }

    /** Actúa como el usuario del empleado dado. */
    protected function como(int $empleado): static
    {
        $u = new User();
        $u->id = $empleado;
        $u->email = $this->usuarios[$empleado];
        return $this->actingAs($u, 'sanctum');
    }

    protected function datosTarea(array $extra = []): array
    {
        return array_merge([
            'accion'        => 'guardar',
            'titulo'        => 'Desarrollar módulo de registro de solicitudes',
            'descripcion'   => 'Formulario y almacenamiento de solicitudes',
            'fecha_pactada' => now()->addDays(5)->toDateString(),
            'empleado'      => $this->colaborador,
            'prioridad'     => 'Media',
            'estado'        => 'Pendiente',
            'proposito'     => 'Que las solicitudes dejen de llegar por correo',
            'criterios'     => [
                ['descripcion' => 'El formulario valida los campos obligatorios'],
                ['descripcion' => 'El sistema genera un identificador único', 'requiere_evidencia' => true],
                ['descripcion' => 'Se ve bien en el móvil', 'obligatorio' => false],
            ],
        ], $extra);
    }

    protected function crearTarea(?array $criterios = null, ?int $responsable = null): int
    {
        $extra = ['empleado' => $responsable ?? $this->colaborador];
        if ($criterios !== null) {
            $extra['criterios'] = $criterios;
        }
        return (int) $this->como($this->lider)->postJson('/api/guardarTarea', $this->datosTarea($extra))
            ->assertOk()->json('tarea_id');
    }

    /**
     * Una tarea antigua, sin criterios, insertada directamente: así nacieron
     * las tareas anteriores a los criterios de aceptación.
     */
    protected function tareaSinCriterios(string $estado = 'Pendiente', ?int $responsable = null): int
    {
        return DB::connection('mysql2')->table('tareas_empleados')->insertGetId([
            'titulo' => 'Tarea heredada', 'descripcion' => 'Sin criterios de aceptación',
            'empleado' => $responsable ?? $this->colaborador, 'estado' => $estado,
            'prioridad' => 'Media', 'estado_reg' => 'Activo', 'fecha_creacion' => now(),
            'pausada' => 0, 'editable' => 1, 'aprobada' => 0, 'visto_bueno' => 0, 'rechazada' => 0,
        ]);
    }

    protected function enviarARevision(int $tarea, ?int $quien = null): void
    {
        $this->como($quien ?? $this->colaborador)
            ->putJson("/api/actualizarEstadoTarea/{$tarea}", ['estado' => 'En Revisión'])
            ->assertOk();
    }

    protected function criterios(int $tarea): array
    {
        return DB::connection('mysql2')->table('tarea_criterios')
            ->where('tarea_id', $tarea)->whereNull('eliminado_at')
            ->orderBy('orden')->orderBy('id')->pluck('id')->map(fn ($i) => (int) $i)->all();
    }

    protected function estadoCriterio(int $id): string
    {
        return DB::connection('mysql2')->table('tarea_criterios')->where('id', $id)->value('estado');
    }

    protected function estadoTarea(int $id): string
    {
        return DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->value('estado');
    }

    protected function campoTarea(int $id, string $campo)
    {
        return DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->value($campo);
    }
}
