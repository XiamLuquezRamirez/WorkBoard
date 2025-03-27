<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\empleadosController;
use App\Http\Controllers\EvidenciasController;

use App\Http\Controllers\Auth\LoginController;
Route::get('/', function () {
    return view('welcome');
});

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

Route::post('/loginUser', [LoginController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/logout', [LoginController::class, 'logout']);
    // Aquí irán otras rutas protegidas
}); 
