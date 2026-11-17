<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Exception;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Support\AccesoTareas;

class EvidenciasController extends Controller
{
    /**
     * Extensiones que se aceptan como evidencia. Es una lista blanca a
     * propósito: la carpeta está dentro de public/, así que cualquier cosa que
     * el servidor sepa ejecutar o interpretar (php, html, svg, js…) no entra.
     */
    private const EXTENSIONES_PERMITIDAS = [
        // Imágenes
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'tif', 'tiff',
        // Documentos
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'txt', 'csv',
        // Diseño y planos
        'psd', 'ai', 'eps', 'dwg', 'dxf', 'fig', 'xd', 'sketch',
        // Comprimidos
        'zip', 'rar', '7z',
        // Audio y video
        'mp3', 'wav', 'm4a', 'ogg', 'mp4', 'mov', 'avi', 'mkv', 'webm',
    ];

    /** Tamaño máximo por archivo, en kilobytes (64 MB, igual que el .htaccess). */
    private const TAMANO_MAXIMO_KB = 65536;

    private const CARPETA = 'evidencias_tareas';

    /**
     * Respaldo por si algún día se colara un archivo peligroso: Apache no
     * ejecuta ni sirve scripts desde la carpeta de evidencias. public/storage
     * no se versiona, por eso se crea desde aquí en lugar de vivir en el repo.
     */
    private const HTACCESS = <<<'HTACCESS'
# Creado por WorkBoard (EvidenciasController). No borrar.
# En esta carpeta solo se guardan evidencias: nada se ejecuta ni se interpreta.
<FilesMatch "(?i)\.(php[0-9]?|phtml|phar|pht|phps|cgi|pl|py|rb|sh|asp|aspx|jsp|exe|bat|cmd|com|ps1|html?|xhtml|shtml|svg|svgz|js|mjs|htaccess)$">
    Order allow,deny
    Deny from all
</FilesMatch>
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
</IfModule>

HTACCESS;

    public function subirEvidencias(Request $request)
    {
        $request->validate([
            'evidencias'   => 'required|array|min:1',
            'evidencias.*' => 'required|file|max:' . self::TAMANO_MAXIMO_KB,
        ], [
            'evidencias.required'   => 'No se han enviado archivos.',
            'evidencias.array'      => 'No se han enviado archivos.',
            'evidencias.min'        => 'No se han enviado archivos.',
            'evidencias.*.required' => 'Uno de los archivos no llegó completo. Intenta subirlo de nuevo.',
            'evidencias.*.file'     => 'Uno de los archivos no llegó completo. Intenta subirlo de nuevo.',
            'evidencias.*.uploaded' => 'Uno de los archivos no llegó completo. Intenta subirlo de nuevo.',
            'evidencias.*.max'      => 'Cada archivo puede pesar como máximo 64 MB.',
        ]);

        // Se revisan todos antes de guardar ninguno: o entran todos o ninguno.
        $rechazados = [];
        foreach ($request->file('evidencias') as $file) {
            if (!in_array($this->extension($file), self::EXTENSIONES_PERMITIDAS, true)) {
                $rechazados[] = $file->getClientOriginalName();
            }
        }
        if ($rechazados) {
            $mensaje = 'Este tipo de archivo no se acepta como evidencia: ' . implode(', ', $rechazados)
                . '. Sube imágenes, PDF, documentos de Office, comprimidos o video; para otros formatos usa un enlace de Drive.';

            return response()->json([
                'message'  => $mensaje,
                'mensajes' => [$mensaje],
                'errors'   => ['evidencias' => [$mensaje]],
            ], 422);
        }

        $carpeta = public_path('storage' . DIRECTORY_SEPARATOR . self::CARPETA);
        try {
            $this->prepararCarpeta($carpeta);
        } catch (Exception $e) {
            Log::error('Evidencias: no se pudo preparar la carpeta. ' . $e->getMessage());
            $mensaje = 'No se pudo guardar la evidencia en el servidor. Avisa al administrador.';

            return response()->json(['error' => true, 'message' => $mensaje, 'mensajes' => [$mensaje]], 500);
        }

        $evidencias = [];
        $errores = [];
        foreach ($request->file('evidencias') as $file) {
            $nombreArchivo = $this->nombreSeguro($file);
            try {
                if (!$file->isValid()) {
                    throw new Exception($file->getErrorMessage());
                }
                if (!copy($file->getPathname(), $carpeta . DIRECTORY_SEPARATOR . $nombreArchivo)) {
                    throw new Exception(error_get_last()['message'] ?? 'copy() falló');
                }
                $evidencias[] = [
                    'nombre_original' => $file->getClientOriginalName(),
                    'ruta' => self::CARPETA . '/' . $nombreArchivo,
                    'tipo' => $file->getMimeType(),
                ];
            } catch (Exception $e) {
                Log::error("Evidencias: no se pudo guardar {$file->getClientOriginalName()}. " . $e->getMessage());
                $errores[] = "No se pudo guardar {$file->getClientOriginalName()}.";
            }
        }

        if (empty($evidencias)) {
            return response()->json([
                'error' => true,
                'message' => $errores[0] ?? 'No se pudo guardar la evidencia.',
                'mensajes' => $errores,
            ], 500);
        }

        return response()->json([
            'success' => true,
            'evidencias' => $evidencias,
            'errores' => $errores,
        ]);
    }

    /** Extensión en minúsculas tal como la trae el nombre del archivo. */
    private function extension($file): string
    {
        return strtolower((string) $file->getClientOriginalExtension());
    }

    /**
     * Nombre con el que se guarda: un prefijo único, el nombre original
     * reducido a letras, números y guiones bajos (sin puntos, para que no haya
     * dobles extensiones como «foto.php.jpg») y la extensión ya validada.
     */
    private function nombreSeguro($file): string
    {
        $base = pathinfo((string) $file->getClientOriginalName(), PATHINFO_FILENAME);
        $base = Str::limit(Str::slug($base, '_'), 80, '');
        if ($base === '') {
            $base = 'evidencia';
        }

        return uniqid() . '_' . $base . '.' . $this->extension($file);
    }

    /** Crea la carpeta si falta y se asegura de que tenga su .htaccess. */
    private function prepararCarpeta(string $carpeta): void
    {
        if (!is_dir(public_path('storage'))) {
            throw new Exception("No existe public/storage. Ejecuta 'php artisan storage:link'.");
        }
        if (!is_dir($carpeta) && !@mkdir($carpeta, 0755, true)) {
            throw new Exception('No se pudo crear la carpeta ' . $carpeta);
        }

        $htaccess = $carpeta . DIRECTORY_SEPARATOR . '.htaccess';
        if (!is_file($htaccess) || file_get_contents($htaccess) !== self::HTACCESS) {
            if (file_put_contents($htaccess, self::HTACCESS) === false) {
                throw new Exception('No se pudo escribir ' . $htaccess);
            }
        }
    }

    public function guardarEvidenciaLink(Request $request)
    {
        // Fuera del try: la ValidationException debe llegar como 422 y no
        // quedar atrapada como un error 500.
        $request->validate([
            'tarea_id' => 'required|integer',
            'evidencia' => 'required|url:https',
            'nombre' => 'required|string|max:255',
            'tipo' => 'required|string|max:50'
        ], [
            'evidencia.required' => 'Pega el enlace de Drive.',
            'evidencia.url' => 'El enlace no es válido: debe empezar por https://.',
            'nombre.required' => 'Ponle un nombre a la evidencia.',
        ]);

        $tarea = AccesoTareas::exigir($request->input('tarea_id'), 'modificar');
        if (AccesoTareas::esRespuesta($tarea)) {
            return $tarea;
        }

        try {

            // Validar que sea un link de Google Drive
            $drivePatterns = [
                '/^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/',
                '/^https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/',
                '/^https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/',
                '/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/',
                '/^https:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/',
                '/^https:\/\/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/'
            ];

            $isValidDriveLink = false;
            foreach ($drivePatterns as $pattern) {
                if (preg_match($pattern, $request->evidencia)) {
                    $isValidDriveLink = true;
                    break;
                }
            }

            if (!$isValidDriveLink) {
                return response()->json([
                    'error' => true,
                    'mensaje' => 'El link proporcionado no es un link válido de Google Drive'
                ], 400);
            }

            // Guardar en la base de datos
            $evidenciaId = DB::connection('mysql2')->table('evidencia_tarea')->insertGetId([
                'tarea' => $request->tarea_id,
                'evidencia' => $request->evidencia,
                'nombre' => $request->nombre,
                'tipo' => $request->tipo
            ]);

            return response()->json([
                'success' => true,
                'evidencia_id' => $evidenciaId,
                'mensaje' => 'Link de Drive guardado correctamente'
            ]);

        } catch (Exception $e) {
            Log::error("Error al guardar link de Drive: " . $e->getMessage());
            return response()->json([
                'error' => true,
                'mensaje' => 'Error al guardar el link de Drive: ' . $e->getMessage()
            ], 500);
        }
    }
}
