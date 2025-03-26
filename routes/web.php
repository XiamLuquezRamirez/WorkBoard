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