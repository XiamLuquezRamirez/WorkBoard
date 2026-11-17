<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Tests\Feature\Concerns\DatosDeEquipo;
use Tests\TestCase;

/**
 * Los tres agujeros críticos: subir scripts como evidencia, reescribir la
 * cuenta de otro desde «Mi perfil» y darse el rol de administrador.
 *
 * El chat corporativo (conexión mysql) guarda su propia copia de cada usuario.
 * Aquí se sustituye por una SQLite en memoria: así se comprueba que la copia
 * se mantiene al día sin acercarse a la base real del chat.
 */
class SeguridadCriticaTest extends TestCase
{
    use DatabaseTransactions;
    use DatosDeEquipo;

    protected $connectionsToTransact = ['mysql2'];

    private const MARCA = 'seguridadcritica';

    private int $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararEquipo();
        Mail::fake();
        Log::spy();
        $this->withoutDefer();

        $this->admin = $this->empleado('Adela', 'Administradora');
        $this->usuario($this->admin, 'admin@prueba.test', 'No', 'No', 'Administrador');
    }

    protected function tearDown(): void
    {
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

    /** Un chat de mentira en memoria, con un usuario por cada uno de mysql2. */
    private function chatDePrueba(): void
    {
        config(['database.connections.mysql' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
        DB::purge('mysql');
        Schema::connection('mysql')->create('users', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('email');
            $t->string('password')->nullable();
            $t->string('avatar')->nullable();
            $t->unsignedBigInteger('id_usuario_tarea')->nullable();
        });
        foreach ($this->db()->table('users')->get() as $u) {
            DB::connection('mysql')->table('users')->insert([
                'name' => $u->name, 'email' => $u->email, 'password' => $u->password, 'id_usuario_tarea' => $u->id,
            ]);
        }
    }

    private function chat(int $usuarioId): ?object
    {
        return DB::connection('mysql')->table('users')->where('id_usuario_tarea', $usuarioId)->first();
    }

    private function usuarioDe(int $empleado): object
    {
        return $this->db()->table('users')->where('empleado', $empleado)->first();
    }

    private function supervisor(): int
    {
        $sup = $this->empleado('Sofía', 'Supervisora');
        $this->usuario($sup, 'supervisor@prueba.test', 'No', 'No', 'Supervisor');

        return $sup;
    }

    private function subir(int $quien, array $archivos)
    {
        return $this->como($quien)->post('/api/subirEvidencias', ['evidencias' => $archivos], ['Accept' => 'application/json']);
    }

    private function archivo(string $nombre, string $contenido = 'contenido'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent(self::MARCA . '_' . $nombre, $contenido);
    }

    private function nuevoUsuario(array $extra = []): array
    {
        return array_merge([
            'accion' => 'guardar', 'name' => 'Nuevo Usuario', 'email' => 'nuevo@prueba.test',
            'password' => 'secreto1', 'password_confirmation' => 'secreto1',
            'role' => 'Empleado', 'estado' => 'Activo', 'empleado' => null, 'foto' => null,
        ], $extra);
    }

    private function edicion(object $u, array $extra = []): array
    {
        return array_merge([
            'accion' => 'editar', 'id' => $u->id, 'name' => $u->name, 'email' => $u->email,
            'role' => $u->tipo_usuario, 'estado' => $u->estado, 'empleado' => $u->empleado, 'foto' => $u->foto,
        ], $extra);
    }

    // ─── 1. Evidencias: nada ejecutable en la carpeta pública ───────────────

    public function test_una_doble_extension_se_guarda_con_la_extension_real_y_sin_puntos(): void
    {
        $ruta = $this->subir($this->colaborador, [$this->archivo('foto.php.jpg')])
            ->assertOk()->json('evidencias.0.ruta');

        $this->assertMatchesRegularExpression('#^evidencias_tareas/[a-z0-9]+_[a-z0-9_]+\.jpg$#', $ruta);
        $this->assertStringNotContainsString('.php', $ruta);
        $this->assertFileExists(public_path('storage/' . $ruta));
    }

    public function test_no_se_aceptan_html_svg_ni_javascript(): void
    {
        foreach (['pagina.html', 'dibujo.svg', 'codigo.js', 'reglas.htaccess', 'sin_extension'] as $nombre) {
            $this->subir($this->colaborador, [$this->archivo($nombre)])->assertStatus(422);
        }
        $this->assertSame([], glob(public_path('storage/evidencias_tareas/*' . self::MARCA . '*')) ?: []);
    }

    public function test_un_lote_con_un_archivo_peligroso_no_guarda_ninguno(): void
    {
        $this->subir($this->colaborador, [$this->archivo('acta.pdf'), $this->archivo('puerta.php', '<?php echo 1;')])
            ->assertStatus(422)
            ->assertJsonFragment(['mensajes' => [
                'Este tipo de archivo no se acepta como evidencia: ' . self::MARCA . '_puerta.php. Sube imágenes, PDF, documentos de Office, comprimidos o video; para otros formatos usa un enlace de Drive.',
            ]]);

        $this->assertSame([], glob(public_path('storage/evidencias_tareas/*' . self::MARCA . '*')) ?: []);
    }

    public function test_la_extension_en_mayusculas_se_acepta_y_se_guarda_en_minusculas(): void
    {
        $ruta = $this->subir($this->colaborador, [$this->archivo('Informe Final.PDF')])->assertOk()->json('evidencias.0.ruta');

        $this->assertStringEndsWith('_informe_final.pdf', $ruta);
    }

    public function test_la_carpeta_de_evidencias_queda_protegida_con_htaccess(): void
    {
        $this->subir($this->colaborador, [$this->archivo('acta.pdf')])->assertOk();

        $htaccess = (string) @file_get_contents(public_path('storage/evidencias_tareas/.htaccess'));
        $this->assertStringContainsString('Deny from all', $htaccess);
        $this->assertMatchesRegularExpression('/php\[0-9\]\?\|phtml\|phar/', $htaccess);
    }

    // ─── 2. Mi perfil: siempre el usuario de la sesión ──────────────────────

    public function test_el_perfil_ignora_el_id_del_cuerpo_y_cambia_solo_el_propio(): void
    {
        $this->chatDePrueba();
        $admin = $this->usuarioDe($this->admin);
        $yo = $this->usuarioDe($this->colaborador);

        $this->como($this->colaborador)->postJson('/api/profile/update', [
            'id' => $admin->id, 'name' => 'Carlos Nuevo', 'email' => 'carlos.nuevo@prueba.test',
            'cambiar_password' => true, 'new_password' => 'nueva123', 'new_password_confirmation' => 'nueva123',
        ])->assertOk();

        $adminDespues = $this->usuarioDe($this->admin);
        $this->assertSame($admin->email, $adminDespues->email);
        $this->assertSame($admin->password, $adminDespues->password);

        $yoDespues = $this->db()->table('users')->where('id', $yo->id)->first();
        $this->assertSame('Carlos Nuevo', $yoDespues->name);
        $this->assertSame('carlos.nuevo@prueba.test', $yoDespues->email);
        $this->assertTrue(Hash::check('nueva123', $yoDespues->password));

        // Su copia en el chat (contra la que inicia sesión) también cambió.
        $chat = $this->chat($yo->id);
        $this->assertSame('carlos.nuevo@prueba.test', $chat->email);
        $this->assertTrue(Hash::check('nueva123', $chat->password));
        $this->assertSame($admin->email, $this->chat($admin->id)->email);
    }

    public function test_el_perfil_no_devuelve_el_hash_ni_el_token(): void
    {
        $this->chatDePrueba();

        $usuario = $this->como($this->colaborador)->postJson('/api/profile/update', [
            'name' => 'Carlos', 'email' => 'colaborador@prueba.test',
        ])->assertOk()->json('user');

        $this->assertArrayNotHasKey('password', $usuario);
        $this->assertArrayNotHasKey('remember_token', $usuario);
        $this->assertSame('colaborador@prueba.test', $usuario['email']);
        $this->assertSame('Empleado', $usuario['tipo_usuario']);
    }

    public function test_el_perfil_no_toma_el_correo_de_otro(): void
    {
        $this->chatDePrueba();

        $this->como($this->colaborador)->postJson('/api/profile/update', [
            'name' => 'Carlos', 'email' => 'admin@prueba.test',
        ])->assertStatus(422)->assertJsonValidationErrors('email');

        $this->assertSame('colaborador@prueba.test', $this->usuarioDe($this->colaborador)->email);
    }

    public function test_el_perfil_valida_nombre_correo_y_contrasena(): void
    {
        $this->chatDePrueba();

        $this->como($this->colaborador)->postJson('/api/profile/update', [])->assertStatus(422);
        $this->como($this->colaborador)->postJson('/api/profile/update', [
            'name' => 'Carlos', 'email' => 'colaborador@prueba.test', 'cambiar_password' => 'true', 'new_password' => '123',
        ])->assertStatus(422);
    }

    public function test_sin_foto_nueva_el_perfil_conserva_la_que_tenia(): void
    {
        $this->chatDePrueba();
        $this->db()->table('users')->where('empleado', $this->colaborador)->update(['foto' => 'data:image/png;base64,AAAA']);

        $this->como($this->colaborador)->post('/api/profile/update', [
            'name' => 'Carlos', 'email' => 'colaborador@prueba.test', 'foto' => 'null',
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertSame('data:image/png;base64,AAAA', $this->usuarioDe($this->colaborador)->foto);
    }

    public function test_si_el_chat_falla_el_perfil_no_queda_a_medias(): void
    {
        // Sin chatDePrueba(): la conexión del chat no existe en las pruebas.
        $this->como($this->colaborador)->postJson('/api/profile/update', [
            'name' => 'Carlos Nuevo', 'email' => 'carlos.nuevo@prueba.test',
        ])->assertStatus(500)->assertJsonMissing(['message' => 'SQLSTATE']);

        $this->assertSame('colaborador@prueba.test', $this->usuarioDe($this->colaborador)->email);
    }

    // ─── 3. Usuarios: solo administración, y el rol de admin solo un admin ──

    public function test_un_empleado_no_crea_usuarios_ni_administradores(): void
    {
        $this->chatDePrueba();

        foreach (['Administrador', 'Empleado'] as $rol) {
            $this->como($this->colaborador)->postJson('/api/guardarUsuario', $this->nuevoUsuario(['role' => $rol]))
                ->assertStatus(403);
        }
        $this->assertFalse($this->db()->table('users')->where('email', 'nuevo@prueba.test')->exists());
    }

    public function test_un_empleado_no_se_asciende_editando_su_usuario(): void
    {
        $this->chatDePrueba();
        $yo = $this->usuarioDe($this->colaborador);

        $this->como($this->colaborador)->postJson('/api/guardarUsuario', $this->edicion($yo, ['role' => 'Administrador']))
            ->assertStatus(403);
        // Un líder tampoco: ser líder no es administrar.
        $this->como($this->lider)->postJson('/api/guardarUsuario', $this->edicion($this->usuarioDe($this->lider), ['role' => 'Administrador']))
            ->assertStatus(403);

        $this->assertSame('Empleado', $this->usuarioDe($this->colaborador)->tipo_usuario);
        $this->assertSame('Empleado', $this->usuarioDe($this->lider)->tipo_usuario);
    }

    public function test_el_administrador_crea_un_usuario_y_su_copia_en_el_chat(): void
    {
        $this->chatDePrueba();

        $this->como($this->admin)->postJson('/api/guardarUsuario', $this->nuevoUsuario(['role' => 'Supervisor']))->assertOk();

        $nuevo = $this->db()->table('users')->where('email', 'nuevo@prueba.test')->first();
        $this->assertSame('Supervisor', $nuevo->tipo_usuario);
        $this->assertTrue(Hash::check('secreto1', $nuevo->password));
        $this->assertSame('nuevo@prueba.test', $this->chat($nuevo->id)->email);
    }

    public function test_el_supervisor_gestiona_usuarios_pero_no_crea_administradores(): void
    {
        $this->chatDePrueba();
        $sup = $this->supervisor();
        $this->chat($this->usuarioDe($sup)->id) ?: DB::connection('mysql')->table('users')->insert([
            'name' => 'Sofía', 'email' => 'supervisor@prueba.test', 'id_usuario_tarea' => $this->usuarioDe($sup)->id,
        ]);

        $this->como($sup)->postJson('/api/guardarUsuario', $this->nuevoUsuario())->assertOk();
        $this->como($sup)->postJson('/api/guardarUsuario', $this->nuevoUsuario(['email' => 'otro@prueba.test', 'role' => 'Administrador']))
            ->assertStatus(403);
        $this->como($sup)->postJson('/api/guardarUsuario', $this->edicion($this->usuarioDe($sup), ['role' => 'Administrador']))
            ->assertStatus(403);

        $this->assertSame('Supervisor', $this->usuarioDe($sup)->tipo_usuario);
        $this->assertFalse($this->db()->table('users')->where('email', 'otro@prueba.test')->exists());
    }

    public function test_el_supervisor_no_modifica_la_cuenta_de_un_administrador(): void
    {
        $this->chatDePrueba();
        $sup = $this->supervisor();
        $admin = $this->usuarioDe($this->admin);

        $this->como($sup)->postJson('/api/guardarUsuario', $this->edicion($admin, [
            'email' => 'pirata@prueba.test', 'cambiar_password' => true, 'password' => 'tomada1', 'password_confirmation' => 'tomada1',
        ]))->assertStatus(403);

        $this->assertSame($admin->password, $this->usuarioDe($this->admin)->password);
        $this->assertSame('admin@prueba.test', $this->usuarioDe($this->admin)->email);
    }

    public function test_guardar_usuario_valida_rol_correo_y_empleado(): void
    {
        $this->chatDePrueba();

        $this->como($this->admin)->postJson('/api/guardarUsuario', $this->nuevoUsuario(['role' => 'SuperAdmin']))
            ->assertStatus(422)->assertJsonValidationErrors('role');
        $this->como($this->admin)->postJson('/api/guardarUsuario', $this->nuevoUsuario(['email' => 'colaborador@prueba.test']))
            ->assertStatus(422)->assertJsonValidationErrors('email');
        $this->como($this->admin)->postJson('/api/guardarUsuario', $this->nuevoUsuario(['empleado' => 99999999]))
            ->assertStatus(422)->assertJsonValidationErrors('empleado');
        $this->como($this->admin)->postJson('/api/guardarUsuario', [])->assertStatus(422);
        $this->como($this->admin)->postJson('/api/guardarUsuario', $this->edicion($this->usuarioDe($this->colaborador), ['id' => 99999999]))
            ->assertStatus(404);
    }

    public function test_no_se_le_quita_el_rol_ni_se_desactiva_al_ultimo_administrador(): void
    {
        $this->chatDePrueba();
        $admin = $this->usuarioDe($this->admin);

        $this->como($this->admin)->postJson('/api/guardarUsuario', $this->edicion($admin, ['role' => 'Empleado']))->assertStatus(422);
        $this->como($this->admin)->postJson('/api/guardarUsuario', $this->edicion($admin, ['estado' => 'Inactivo']))->assertStatus(422);
        $this->assertSame('Administrador', $this->usuarioDe($this->admin)->tipo_usuario);

        // Con otro administrador activo, sí.
        $otro = $this->empleado('Óscar', 'Admin');
        $this->usuario($otro, 'otroadmin@prueba.test', 'No', 'No', 'Administrador');
        $this->como($this->admin)->postJson('/api/guardarUsuario', $this->edicion($admin, ['role' => 'Supervisor']))->assertOk();
        $this->assertSame('Supervisor', $this->usuarioDe($this->admin)->tipo_usuario);
    }

    public function test_si_el_chat_falla_no_se_crea_el_usuario_a_medias(): void
    {
        $this->como($this->admin)->postJson('/api/guardarUsuario', $this->nuevoUsuario())->assertStatus(500);

        $this->assertFalse($this->db()->table('users')->where('email', 'nuevo@prueba.test')->exists());
    }
}
