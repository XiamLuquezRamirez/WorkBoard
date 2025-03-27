<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class EvidenciasController extends Controller
{
    public function subirEvidencias(Request $request)
    {
        $evidencias = [];
        
        if ($request->hasFile('evidencias')) {
            foreach ($request->file('evidencias') as $file) {
                // Generar nombre único para el archivo
                $nombreArchivo = uniqid() . '_' . $file->getClientOriginalName();
                
                // Guardar archivo en storage/app/public/evidencias
                $ruta = $file->storeAs('evidencias', $nombreArchivo, 'public');
                
                $evidencias[] = [
                    'nombre_original' => $file->getClientOriginalName(),
                    'ruta' => $ruta,
                    'tipo' => $file->getMimeType()
                ];
            }
        }
        
        return response()->json($evidencias);
    }
} 