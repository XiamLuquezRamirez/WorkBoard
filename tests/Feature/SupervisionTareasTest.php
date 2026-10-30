<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * Permisos de los endpoints de supervisión: aprobar, dar visto bueno,
 * rechazar y habilitar la edición de una tarea.
 *
 * Antes no comprobaban nada: cualquier usuario con sesión podía aprobar o
 * rechazar cualquier tarea, y retirar un rechazo cerraba la tarea saltándose
 * la aceptación por criterios.
 */
class SupervisionTareasTest extends TestCase
{
    use DatabaseTransactions;
    use DatosDeEquipo;

    protected $connectionsToTransact = ['mysql2'];

    private int $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararEquipo();

        $this->admin = $this->empleado('Adela', 'Administradora');
        $this->usuario($this->admin, 'admin@prueba.test', 'No', 'No', 'Administrador');
    }

    /** [ruta, campo enviado, columna que cambia, valor enviado, valor esperado] */
    public static function endpoints(): array
    {
        return [
            'visto bueno'       => ['vistoBueno',       'visto_bueno', 'visto_bueno', true,  1],
            'aprobar'           => ['aprobarTarea',     'aprobada',    'aprobada',    true,  1],
            'habilitar edición' => ['habilitarEdicion', 'editable',    'editable',    false, 0],
            'rechazar'          => ['rechazarTarea',    'rechazada',   'rechazada',   true,  1],
        ];
    }

    #[DataProvider('endpoints')]
    public function test_un_ajeno_no_supervisa_y_nada_cambia(string $ruta, string $campo, string $columna, $valor, int $esperado): void
    {
        $tarea = $this->tareaSinCriterios('Completada');
        $antes = (array) DB::connection('mysql2')->table('tareas_empleados')->where('id', $tarea)->first();

        $this->como($this->ajeno)->putJson("/api/{$ruta}/{$tarea}", [$campo => $valor])->assertStatus(403);

        $despues = (array) DB::connection('mysql2')->table('tareas_empleados')->where('id', $tarea)->first();
        $this->assertSame($antes, $despues, 'Un 403 no debe dejar ningún cambio.');
    }

    #[DataProvider('endpoints')]
    public function test_el_responsable_sin_independencia_no_supervisa_su_tarea(string $ruta, string $campo, string $columna, $valor, int $esperado): void
    {
        $tarea = $this->tareaSinCriterios('Completada');

        $this->como($this->colaborador)->putJson("/api/{$ruta}/{$tarea}", [$campo => $valor])->assertStatus(403);
    }

    #[DataProvider('endpoints')]
    public function test_el_lider_supervisa(string $ruta, string $campo, string $columna, $valor, int $esperado): void
    {
        $tarea = $this->tareaSinCriterios('Completada');

        $this->como($this->lider)->putJson("/api/{$ruta}/{$tarea}", [$campo => $valor])->assertOk();
        $this->assertSame($esperado, (int) $this->campoTarea($tarea, $columna));
    }

    #[DataProvider('endpoints')]
    public function test_el_administrador_supervisa(string $ruta, string $campo, string $columna, $valor, int $esperado): void
    {
        $tarea = $this->tareaSinCriterios('Completada');

        $this->como($this->admin)->putJson("/api/{$ruta}/{$tarea}", [$campo => $valor])->assertOk();
        $this->assertSame($esperado, (int) $this->campoTarea($tarea, $columna));
    }

    #[DataProvider('endpoints')]
    public function test_con_independencia_supervisa_su_propia_tarea(string $ruta, string $campo, string $columna, $valor, int $esperado): void
    {
        $tarea = $this->tareaSinCriterios('Completada', $this->independiente);

        $this->como($this->independiente)->putJson("/api/{$ruta}/{$tarea}", [$campo => $valor])->assertOk();
    }

    #[DataProvider('endpoints')]
    public function test_sin_el_campo_responde_422_y_no_500(string $ruta, string $campo, string $columna, $valor, int $esperado): void
    {
        $tarea = $this->tareaSinCriterios('Completada');

        $this->como($this->lider)->putJson("/api/{$ruta}/{$tarea}", [])->assertStatus(422);
    }

    #[DataProvider('endpoints')]
    public function test_una_tarea_inexistente_responde_404(string $ruta, string $campo, string $columna, $valor, int $esperado): void
    {
        $this->como($this->lider)->putJson("/api/{$ruta}/999999999", [$campo => $valor])->assertStatus(404);
    }

    public function test_aprobar_con_false_en_texto_ya_no_aprueba(): void
    {
        $tarea = $this->tareaSinCriterios();

        // Antes «"false"» contaba como verdadero y aprobaba la tarea.
        $this->como($this->lider)->putJson("/api/aprobarTarea/{$tarea}", ['aprobada' => 'false'])->assertStatus(422);
        $this->assertSame(0, (int) $this->campoTarea($tarea, 'aprobada'));
    }

    // ─── rechazarTarea y los criterios de aceptación ────────────────────────

    public function test_retirar_el_rechazo_no_salta_la_aceptacion(): void
    {
        $tarea = $this->crearTarea();
        $this->enviarARevision($tarea);

        $this->como($this->lider)
            ->putJson("/api/rechazarTarea/{$tarea}", ['rechazada' => false])
            ->assertStatus(409)
            ->assertJson(['requiere_verificacion' => true]);

        $this->assertSame('En Revisión', $this->estadoTarea($tarea));
    }

    public function test_retirar_el_rechazo_de_una_tarea_heredada_sigue_cerrandola(): void
    {
        // Sin criterios, el comportamiento anterior se conserva.
        $tarea = $this->tareaSinCriterios('En Proceso');

        $this->como($this->lider)->putJson("/api/rechazarTarea/{$tarea}", ['rechazada' => false])->assertOk();
        $this->assertSame('Completada', $this->estadoTarea($tarea));
    }

    public function test_rechazar_una_tarea_aceptada_la_reabre_y_queda_constancia(): void
    {
        $tarea = $this->crearTarea([['descripcion' => 'Único criterio obligatorio']]);
        [$c] = $this->criterios($tarea);
        $this->enviarARevision($tarea);
        $this->como($this->lider)->putJson("/api/criterios/{$c}/verificar", ['estado' => 'Cumplido'])->assertOk();
        $this->como($this->lider)->putJson("/api/tareas/{$tarea}/aceptar")->assertOk();

        $this->como($this->lider)->putJson("/api/rechazarTarea/{$tarea}", ['rechazada' => true])->assertOk();

        $this->assertSame('En Proceso', $this->estadoTarea($tarea));
        $this->assertSame(1, DB::connection('mysql2')->table('tarea_criterio_historial')
            ->where('tarea_id', $tarea)->where('evento', 'tarea_reabierta')->count());
        // La aceptación anterior no se borra.
        $this->assertSame(1, DB::connection('mysql2')->table('tarea_aceptaciones')
            ->where('tarea_id', $tarea)->where('resultado', 'Aceptada')->count());
    }
}
