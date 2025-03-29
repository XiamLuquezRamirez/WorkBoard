<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\empleadosController;
use App\Http\Controllers\EvidenciasController;
use App\Http\Controllers\Auth\LoginController;

// Ruta para la vista principal de login
Route::get('/', function () {
    return view('welcome');
})->name('login');

// Rutas de API y autenticación
Route::post('/loginUser', [LoginController::class, 'login']);
Route::post('/logout', [LoginController::class, 'logout'])->middleware('auth:sanctum');

// Rutas protegidas de la API
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/parametros/guardarEmpleados', [empleadosController::class, 'guardarEmpleado']);
    Route::get('/parametros/cargarEmpresas', [empleadosController::class, 'cargarEmpresas']);
    Route::get('/parametros/cargarDepartamentos', [empleadosController::class, 'cargarDepartamentos']);
    Route::get('/parametros/cargarCargos', [empleadosController::class, 'cargarCargos']);
    Route::get('/parametros/cargarEmpleados', [empleadosController::class, 'cargarEmpleados']);
    Route::delete('/parametros/eliminarEmpleado/{id}', [empleadosController::class, 'eliminarEmpleado']);
    Route::get('/parametros/cargarFunciones/{id}', [empleadosController::class, 'cargarFunciones']);
    Route::post('/parametros/guardarFuncion', [empleadosController::class, 'guardarFuncion']);
    Route::put('/parametros/actualizarFuncion/{id}', [empleadosController::class, 'actualizarFuncion']);
    Route::delete('/parametros/eliminarFuncion/{id}', [empleadosController::class, 'eliminarFuncion']);
    Route::get('/parametros/cargarTareas/{id}', [empleadosController::class, 'cargarTareas']);
    Route::post('/parametros/guardarTarea', [empleadosController::class, 'guardarTarea']);
    Route::post('/parametros/subirEvidencias', [EvidenciasController::class, 'subirEvidencias']);
    Route::put('/parametros/actualizarEstadoTarea/{id}', [empleadosController::class, 'actualizarEstadoTarea']);
    Route::get('/parametros/cargarUsuarios', [empleadosController::class, 'cargarUsuarios']);
    Route::get('/parametros/buscarUsuarios', [empleadosController::class, 'buscarUsuarios']);

    //guardar usuario
    Route::post('/parametros/guardarUsuario', [empleadosController::class, 'guardarUsuario']);
    Route::delete('/parametros/eliminarUsuario/{id}', [empleadosController::class, 'eliminarUsuario']);

    //actualizar usuario
    Route::post('/profile/update', [empleadosController::class, 'actualizarUsuario']);

    //cargar tareas de un empleado
    Route::get('/parametros/cargarTareasEmpleado/{id}', [empleadosController::class, 'cargarTareas']);

    // completar tarea con evidencias
    Route::post('/parametros/completarTareaConEvidencias', [empleadosController::class, 'completarTareaConEvidencias']);

    // eliminar evidencia de una tarea
    Route::delete('/parametros/eliminarEvidencia/{id}', [empleadosController::class, 'eliminarEvidencia']);

});

// Esta ruta debe manejar todas las rutas de la aplicación React
Route::get('/{any}', function () {
    return view('welcome');
})->where('any', '.*');
