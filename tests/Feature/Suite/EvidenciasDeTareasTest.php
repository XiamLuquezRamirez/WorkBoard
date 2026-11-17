<?php

namespace Tests\Feature\Suite;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * Evidencias: la carga de archivos, los enlaces de Drive y su borrado (tabla
 * evidencia_tarea, el mecanismo antiguo) y las evidencias de cada criterio de
 * aceptación (tarea_criterio_evidencias).
 *
 * subirEvidencias copia los archivos a public/storage/evidencias_tareas, fuera
 * del alcance de Storage::fake. Todos los archivos de esta clase llevan la
 * marca MARCA en el nombre y se borran al terminar cada prueba.
 */
class EvidenciasDeTareasTest extends TestCase
{
    use DatabaseTransactions;
    use DatosDeEquipo;

    protected $connectionsToTransact = ['mysql2'];

    private const MARCA = 'suitepr2evid';
    private const DRIVE = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view';

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararEquipo();
        Mail::fake();
        Log::spy();
        $this->withoutDefer();
    }

    protected function tearDown(): void
    {
        // Sólo los archivos que crearon estas pruebas.
        foreach (glob(public_path('storage/evidencias_tareas/*' . self::MARCA . '*')) ?: [] as $archivo) {
            @unlink($archivo);
        }
        parent::tearDown();
    }

    // ─── Ayudas ─────────────────────────────────────────────────────────────

    private function db()
    {
        return DB::connection('mysql2');
    }

    private function nombre(string $extension): string
    {
        return self::MARCA . '_informe.' . $extension;
    }

    private function subir(int $quien, array $archivos)
    {
        return $this->como($quien)->post('/api/subirEvidencias', ['evidencias' => $archivos], ['Accept' => 'application/json']);
    }

    private function guardarLink(int $quien, int $tarea, array $extra = [])
    {
        return $this->como($quien)->postJson('/api/guardarEvidenciaLink', array_merge([
            'tarea_id' => $tarea, 'evidencia' => self::DRIVE, 'nombre' => 'Acta firmada', 'tipo' => 'link',
        ], $extra));
    }

    private function evidenciaAntigua(int $tarea): int
    {
        return (int) $this->db()->table('evidencia_tarea')->insertGetId([
            'tarea' => $tarea, 'evidencia' => self::DRIVE, 'nombre' => 'Acta', 'tipo' => 'link',
        ]);
    }

    /** Tarea con criterios; devuelve [tarea, primer criterio]. */
    private function tareaConCriterio(): array
    {
        $tarea = $this->crearTarea();
        return [$tarea, $this->criterios($tarea)[0]];
    }

    private function agregarEnlace(int $quien, int $criterio, string $ruta = 'https://ejemplo.test/acta')
    {
        return $this->como($quien)->postJson("/api/criterios/{$criterio}/evidencias", [
            'tipo' => 'enlace', 'ruta' => $ruta, 'nombre' => 'Acta',
        ]);
    }

    private function evidenciasVivas(int $criterio): int
    {
        return $this->db()->table('tarea_criterio_evidencias')
            ->where('criterio_id', $criterio)->whereNull('eliminado_at')->count();
    }

    // ─── Sin sesión ─────────────────────────────────────────────────────────

    public static function rutasProtegidas(): array
    {
        return [
            'subir evidencias'     => ['post',   '/api/subirEvidencias'],
            'guardar link'         => ['post',   '/api/guardarEvidenciaLink'],
            'eliminar evidencia'   => ['delete', '/api/eliminarEvidencia/1'],
            'evidencia criterio'   => ['post',   '/api/criterios/1/evidencias'],
            'quitar de criterio'   => ['delete', '/api/criterios/evidencias/1'],
        ];
    }

    #[DataProvider('rutasProtegidas')]
    public function test_sin_sesion_responde_401(string $metodo, string $ruta): void
    {
        $this->{$metodo . 'Json'}($ruta, [])->assertStatus(401);
    }

    // ─── subirEvidencias ────────────────────────────────────────────────────

    public function test_subir_un_pdf_lo_guarda_en_la_carpeta_de_evidencias(): void
    {
        $respuesta = $this->subir($this->colaborador, [
            UploadedFile::fake()->createWithContent($this->nombre('pdf'), '%PDF-1.4 contenido de prueba'),
        ])->assertOk()->assertJsonPath('success', true);

        $ruta = $respuesta->json('evidencias.0.ruta');
        $this->assertMatchesRegularExpression('#^evidencias_tareas/[^/]+' . self::MARCA . '_informe\.pdf$#', $ruta);
        $this->assertFileExists(public_path('storage/' . $ruta));
        $this->assertSame($this->nombre('pdf'), $respuesta->json('evidencias.0.nombre_original'));
    }

    public function test_el_nombre_del_archivo_no_sale_de_la_carpeta_de_evidencias(): void
    {
        $respuesta = $this->subir($this->colaborador, [
            UploadedFile::fake()->createWithContent('../../' . $this->nombre('pdf'), '%PDF-1.4'),
        ])->assertOk();

        $this->assertStringNotContainsString('..', (string) $respuesta->json('evidencias.0.ruta'));
    }

    public static function archivosPeligrosos(): array
    {
        return [
            'script php'     => ['php',   '<?php echo "prueba";'],
            'script phtml'   => ['phtml', '<?php echo "prueba";'],
            'ejecutable exe' => ['exe',   "MZ\x90\x00prueba"],
        ];
    }

    #[DataProvider('archivosPeligrosos')]
    public function test_no_se_aceptan_archivos_ejecutables(string $extension, string $contenido): void
    {
        // La carpeta es public/storage: un .php ahí lo ejecuta el servidor web.
        $respuesta = $this->subir($this->colaborador, [
            UploadedFile::fake()->createWithContent($this->nombre($extension), $contenido),
        ]);

        $creados = glob(public_path('storage/evidencias_tareas/*' . self::MARCA . '*.' . $extension)) ?: [];
        $this->assertSame([], $creados, "Un .{$extension} no debe quedar en una carpeta pública.");
        $respuesta->assertStatus(422);
    }

    public function test_subir_sin_archivos_responde_422_y_no_500(): void
    {
        $this->subir($this->colaborador, [])->assertStatus(422);
    }

    // ─── guardarEvidenciaLink ───────────────────────────────────────────────

    public function test_el_responsable_guarda_un_enlace_de_drive(): void
    {
        $tarea = $this->tareaSinCriterios('En Proceso');

        $id = $this->guardarLink($this->colaborador, $tarea)->assertOk()->json('evidencia_id');

        $fila = $this->db()->table('evidencia_tarea')->where('id', $id)->first();
        $this->assertSame($tarea, (int) $fila->tarea);
        $this->assertSame(self::DRIVE, $fila->evidencia);
    }

    public function test_un_enlace_que_no_es_de_drive_se_rechaza(): void
    {
        $tarea = $this->tareaSinCriterios('En Proceso');

        $respuesta = $this->guardarLink($this->colaborador, $tarea, ['evidencia' => 'https://drive.google.com.atacante.test/file/d/x']);

        $this->assertContains($respuesta->status(), [400, 422]);
        $this->assertFalse($this->db()->table('evidencia_tarea')->where('tarea', $tarea)->exists());
    }

    public static function enlacesInvalidos(): array
    {
        return [
            'sin campos'        => [[], true],
            'sin nombre'        => [['nombre' => null], false],
            'esquema javascript'=> [['evidencia' => 'javascript:alert(document.cookie)'], false],
            'no es una URL'     => [['evidencia' => 'mi carpeta de drive'], false],
            'tarea no numérica' => [['tarea_id' => 'abc'], false],
        ];
    }

    #[DataProvider('enlacesInvalidos')]
    public function test_guardar_un_enlace_invalido_responde_422_y_no_500(array $extra, bool $vacio): void
    {
        $tarea = $this->tareaSinCriterios('En Proceso');

        $respuesta = $vacio
            ? $this->como($this->colaborador)->postJson('/api/guardarEvidenciaLink', [])
            : $this->guardarLink($this->colaborador, $tarea, $extra);

        $respuesta->assertStatus(422);
        $this->assertFalse($this->db()->table('evidencia_tarea')->where('tarea', $tarea)->exists());
    }

    public function test_un_ajeno_no_agrega_evidencias_a_una_tarea_ajena(): void
    {
        $tarea = $this->tareaSinCriterios('En Proceso');

        $this->guardarLink($this->ajeno, $tarea)->assertStatus(403);
        $this->assertFalse($this->db()->table('evidencia_tarea')->where('tarea', $tarea)->exists());
    }

    public function test_un_enlace_para_una_tarea_inexistente_responde_404(): void
    {
        $this->guardarLink($this->colaborador, 999999)->assertStatus(404);
        $this->assertFalse($this->db()->table('evidencia_tarea')->where('tarea', 999999)->exists());
    }

    // ─── eliminarEvidencia ──────────────────────────────────────────────────

    public function test_el_responsable_elimina_una_evidencia_de_su_tarea(): void
    {
        $tarea = $this->tareaSinCriterios('En Proceso');
        $id = $this->evidenciaAntigua($tarea);

        $this->como($this->colaborador)->deleteJson("/api/eliminarEvidencia/{$id}")->assertOk();
        $this->assertFalse($this->db()->table('evidencia_tarea')->where('id', $id)->exists());
    }

    public function test_un_ajeno_no_elimina_evidencias_de_una_tarea_ajena(): void
    {
        $tarea = $this->tareaSinCriterios('En Proceso');
        $id = $this->evidenciaAntigua($tarea);

        $this->como($this->ajeno)->deleteJson("/api/eliminarEvidencia/{$id}")->assertStatus(403);
        $this->assertTrue($this->db()->table('evidencia_tarea')->where('id', $id)->exists());
    }

    public function test_eliminar_una_evidencia_inexistente_responde_404(): void
    {
        $this->como($this->colaborador)->deleteJson('/api/eliminarEvidencia/999999')->assertStatus(404);
    }

    public function test_la_evidencia_de_una_tarea_aceptada_no_se_elimina(): void
    {
        // Igual que con las evidencias de criterios: lo que sostuvo una
        // aceptación no debe desaparecer.
        $tarea = $this->tareaSinCriterios('Completada');
        $id = $this->evidenciaAntigua($tarea);

        $this->como($this->colaborador)->deleteJson("/api/eliminarEvidencia/{$id}")->assertStatus(409);
        $this->assertTrue($this->db()->table('evidencia_tarea')->where('id', $id)->exists());
    }

    // ─── Evidencias de un criterio ──────────────────────────────────────────

    public function test_el_responsable_aporta_un_enlace_a_su_criterio(): void
    {
        [, $criterio] = $this->tareaConCriterio();

        $id = $this->agregarEnlace($this->colaborador, $criterio)->assertStatus(201)->json('id');

        $fila = $this->db()->table('tarea_criterio_evidencias')->where('id', $id)->first();
        $this->assertSame('enlace', $fila->tipo);
        $this->assertSame($criterio, (int) $fila->criterio_id);
        $this->assertSame((int) $this->db()->table('users')->where('empleado', $this->colaborador)->value('id'), (int) $fila->subido_por);
    }

    public static function enlacesNoHttp(): array
    {
        return [
            'javascript' => ['javascript:alert(1)'],
            'ftp'        => ['ftp://ejemplo.test/acta.pdf'],
            'file'       => ['file:///etc/passwd'],
            'texto'      => ['el acta está en mi escritorio'],
        ];
    }

    #[DataProvider('enlacesNoHttp')]
    public function test_un_enlace_que_no_es_http_se_rechaza(string $ruta): void
    {
        [, $criterio] = $this->tareaConCriterio();

        $this->agregarEnlace($this->colaborador, $criterio, $ruta)->assertStatus(422);
        $this->assertSame(0, $this->evidenciasVivas($criterio));
    }

    public function test_datos_invalidos_de_evidencia_de_criterio_responden_422(): void
    {
        [, $criterio] = $this->tareaConCriterio();

        $this->como($this->colaborador)->postJson("/api/criterios/{$criterio}/evidencias", [])->assertStatus(422);
        $this->como($this->colaborador)->postJson("/api/criterios/{$criterio}/evidencias", ['tipo' => 'video', 'ruta' => 'x'])->assertStatus(422);
        $this->como($this->colaborador)->postJson("/api/criterios/{$criterio}/evidencias", [
            'tipo' => 'enlace', 'ruta' => 'https://ejemplo.test/' . str_repeat('a', 1000),
        ])->assertStatus(422);
        $this->assertSame(0, $this->evidenciasVivas($criterio));
    }

    #[Group('hallazgo')]
    public function test_el_responsable_aporta_un_archivo_subido_a_su_criterio(): void
    {
        // Es lo que hace CriteriosAceptacion.jsx: subirEvidencias y luego esta ruta.
        [, $criterio] = $this->tareaConCriterio();

        $this->como($this->colaborador)->postJson("/api/criterios/{$criterio}/evidencias", [
            'tipo' => 'archivo', 'ruta' => 'evidencias_tareas/6650a1b2c3d4_' . self::MARCA . '_informe.pdf',
            'nombre' => 'informe.pdf', 'mime' => 'application/pdf',
        ])->assertStatus(201);

        $this->assertSame(1, $this->evidenciasVivas($criterio));
    }

    public static function rutasDeArchivoAjenas(): array
    {
        return [
            'sube de carpeta'     => ['evidencias_tareas/../.env'],
            'ruta absoluta'       => ['/etc/passwd'],
            'otra carpeta'        => ['facturas/2026.pdf'],
            'subcarpeta'          => ['evidencias_tareas/otra/x.pdf'],
            'barra invertida'     => ['evidencias_tareas\\..\\..\\.env'],
        ];
    }

    #[DataProvider('rutasDeArchivoAjenas')]
    #[Group('hallazgo')]
    public function test_un_archivo_fuera_de_la_carpeta_de_evidencias_responde_422_y_no_500(string $ruta): void
    {
        [, $criterio] = $this->tareaConCriterio();

        $this->como($this->colaborador)->postJson("/api/criterios/{$criterio}/evidencias", [
            'tipo' => 'archivo', 'ruta' => $ruta,
        ])->assertStatus(422);
        $this->assertSame(0, $this->evidenciasVivas($criterio));
    }

    public function test_un_ajeno_no_aporta_evidencias_a_un_criterio(): void
    {
        [, $criterio] = $this->tareaConCriterio();

        $this->agregarEnlace($this->ajeno, $criterio)->assertStatus(403);
        $this->assertSame(0, $this->evidenciasVivas($criterio));
    }

    public function test_evidencia_para_un_criterio_inexistente_o_eliminado_responde_404(): void
    {
        $this->agregarEnlace($this->colaborador, 999999)->assertStatus(404);

        [$tarea, $criterio] = $this->tareaConCriterio();
        $this->db()->table('tarea_criterios')->where('id', $criterio)->update(['eliminado_at' => now()]);
        $this->agregarEnlace($this->colaborador, $criterio)->assertStatus(404);
    }

    public function test_no_se_aportan_evidencias_a_una_tarea_aceptada(): void
    {
        [$tarea, $criterio] = $this->tareaConCriterio();
        $this->db()->table('tareas_empleados')->where('id', $tarea)->update(['estado' => 'Completada']);

        $this->agregarEnlace($this->colaborador, $criterio)->assertStatus(409);
        $this->assertSame(0, $this->evidenciasVivas($criterio));
    }

    // ─── Quitar evidencia de un criterio ────────────────────────────────────

    public function test_quien_la_subio_la_quita_y_queda_la_traza(): void
    {
        [, $criterio] = $this->tareaConCriterio();
        $id = $this->agregarEnlace($this->colaborador, $criterio)->json('id');

        $this->como($this->colaborador)->deleteJson("/api/criterios/evidencias/{$id}")->assertOk();

        // Borrado lógico: la fila sigue, marcada.
        $fila = $this->db()->table('tarea_criterio_evidencias')->where('id', $id)->first();
        $this->assertNotNull($fila->eliminado_at);
        $this->assertSame(0, $this->evidenciasVivas($criterio));

        // Quitarla otra vez ya no la encuentra.
        $this->como($this->colaborador)->deleteJson("/api/criterios/evidencias/{$id}")->assertStatus(404);
    }

    public function test_el_lider_quita_la_evidencia_del_colaborador(): void
    {
        [, $criterio] = $this->tareaConCriterio();
        $id = $this->agregarEnlace($this->colaborador, $criterio)->json('id');

        $this->como($this->lider)->deleteJson("/api/criterios/evidencias/{$id}")->assertOk();
        $this->assertSame(0, $this->evidenciasVivas($criterio));
    }

    public function test_un_ajeno_no_quita_evidencias_de_un_criterio(): void
    {
        [, $criterio] = $this->tareaConCriterio();
        $id = $this->agregarEnlace($this->colaborador, $criterio)->json('id');

        $this->como($this->ajeno)->deleteJson("/api/criterios/evidencias/{$id}")->assertStatus(403);
        $this->assertSame(1, $this->evidenciasVivas($criterio));
    }

    public function test_quitar_una_evidencia_inexistente_responde_404(): void
    {
        $this->como($this->lider)->deleteJson('/api/criterios/evidencias/999999')->assertStatus(404);
    }

    public function test_la_evidencia_de_una_tarea_aceptada_no_se_quita(): void
    {
        [$tarea, $criterio] = $this->tareaConCriterio();
        $id = $this->agregarEnlace($this->colaborador, $criterio)->json('id');
        $this->db()->table('tareas_empleados')->where('id', $tarea)->update(['estado' => 'Completada']);

        $this->como($this->lider)->deleteJson("/api/criterios/evidencias/{$id}")->assertStatus(409);
        $this->assertSame(1, $this->evidenciasVivas($criterio));
    }
}
