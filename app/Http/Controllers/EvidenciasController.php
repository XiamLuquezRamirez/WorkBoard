<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Exception;

class EvidenciasController extends Controller
{
    public function subirEvidencias(Request $request)
    {
        $evidencias = [];
        $errores = [];
        
        try {
            if ($request->hasFile('evidencias')) {
                foreach ($request->file('evidencias') as $file) {
                    try {
                        // Verificar si el archivo es válido
                        if (!$file->isValid()) {
                            throw new Exception("Archivo no válido: " . $file->getErrorMessage());
                        }

                        // Generar nombre único para el archivo
                        $nombreArchivo = uniqid() . '_' . $file->getClientOriginalName();
                        
                        // Verificar si el directorio existe
                        $directorio = 'evidencias_tareas';
                        $rutaBase = public_path('storage');
                        $rutaCompleta = $rutaBase . '/' . $directorio;
                        
                        Log::info("Intentando crear directorio en: " . $rutaCompleta);
                        
                        // Verificar si el directorio base existe
                        if (!file_exists($rutaBase)) {
                            Log::error("El directorio base no existe: " . $rutaBase);
                            throw new Exception("El directorio base no existe. Por favor, ejecute 'php artisan storage:link'");
                        }
                        
                        // Verificar permisos del directorio base
                        if (!is_writable($rutaBase)) {
                            Log::error("El directorio base no tiene permisos de escritura: " . $rutaBase);
                            throw new Exception("El directorio base no tiene permisos de escritura");
                        }
                        
                        if (!file_exists($rutaCompleta)) {
                            // Intentar crear el directorio con permisos más permisivos
                            if (!@mkdir($rutaCompleta, 0777, true)) {
                                $error = error_get_last();
                                Log::error("Error al crear directorio: " . $error['message']);
                                Log::error("Ruta completa: " . $rutaCompleta);
                                Log::error("Permisos del directorio base: " . substr(sprintf('%o', fileperms($rutaBase)), -4));
                                throw new Exception("No se pudo crear el directorio: " . $rutaCompleta . ". Error: " . $error['message']);
                            }
                            // Asegurar que el directorio tenga los permisos correctos
                            chmod($rutaCompleta, 0777);
                        }

                        // Obtener la ruta temporal del archivo
                        $rutaTemporal = $file->getPathname();
                        
                        // Verificar si el archivo temporal existe y es readable
                        if (!file_exists($rutaTemporal) || !is_readable($rutaTemporal)) {
                            Log::error("Archivo temporal no existe o no es readable: " . $rutaTemporal);
                            throw new Exception("Error al acceder al archivo temporal");
                        }

                        // Intentar guardar el archivo directamente
                        $rutaDestino = $rutaCompleta . '/' . $nombreArchivo;
                        
                        // Intentar copiarjhkjghgfh el archivo en lugar de moverlo
                        if (!copy($rutaTemporal, $rutaDestino)) {
                            $error = error_get_last();
                            Log::error("Error al copiar archivo: " . $error['message']);
                            Log::error("Ruta origen: " . $rutaTemporal);
                            Log::error("Ruta destino: " . $rutaDestino);
                            throw new Exception("Error al guardar el archivo: " . ($error ? $error['message'] : 'Error desconocido'));
                        }
                        
                        $evidencias[] = [
                            'nombre_original' => $file->getClientOriginalName(),
                            'ruta' => $directorio . '/' . $nombreArchivo,
                            'tipo' => $file->getMimeType()
                        ];
                    } catch (Exception $e) {
                        $errores[] = "Error con archivo {$file->getClientOriginalName()}: " . $e->getMessage();
                        Log::error("Error al subir archivo: " . $e->getMessage());
                    }
                }
            } else {
                $errores[] = "No se han enviado archivos";
            }
            
            if (empty($evidencias) && !empty($errores)) {
                return response()->json([
                    'error' => true,
                    'mensajes' => $errores
                ], 500);
            }
            
            return response()->json([
                'success' => true,
                'evidencias' => $evidencias,
                'errores' => $errores
            ]);
            
        } catch (Exception $e) {
            Log::error("Error general: " . $e->getMessage());
            return response()->json([
                'error' => true,
                'mensaje' => "Error general: " . $e->getMessage()
            ], 500);
        }
    }
}
