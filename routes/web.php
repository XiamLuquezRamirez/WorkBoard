<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\empleadosController;
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