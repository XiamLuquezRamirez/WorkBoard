<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\LoginController;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\EmpleadosController;
use App\Http\Controllers\EvidenciasController;
// Ruta para el CSRF cookie de Sanctum
Route::get('/sanctum/csrf-cookie', function () {
    return response()->json(['message' => 'CSRF cookie set']);
});

// Rutas de autenticación
Route::post('/login', [LoginController::class, 'login'])
    ->name('login');

Route::post('/logout', [LoginController::class, 'logout'])
    ->middleware('auth')
    ->name('logout');

// Rutas protegidas
Route::middleware(['auth:sanctum'])->group(function () {
    Route::prefix('api')->group(function () {
      
        Route::get('/user', function () {
            return response()->json([
                'user' => Auth::user()
            ]);
        });
        Route::get('/notificaciones', [EmpleadosController::class, 'cargarNotificaciones']);

         //actualizar usuario
        Route::post('/profile/update', [EmpleadosController::class, 'actualizarUsuario']);

        //cargar empleados
        Route::post('/cargarEmpleados', [EmpleadosController::class, 'cargarEmpleados']);

        //buscar empleados
        Route::post('/buscarEmpleados', [EmpleadosController::class, 'buscarEmpleados']);

        //cargar empresas
        Route::get('/parametros/cargarEmpresas', [EmpleadosController::class, 'cargarEmpresas']);

        //cargar departamentos
        Route::get('/parametros/cargarDepartamentos', [EmpleadosController::class, 'cargarDepartamentos']);

        //cargar cargos
        Route::get('/parametros/cargarCargos', [EmpleadosController::class, 'cargarCargos']);

        //guardar empleado
        Route::post('/guardarEmpleados', [EmpleadosController::class, 'guardarEmpleado']);

        //eliminar empleado
        Route::delete('/eliminarEmpleado/{id}', [empleadosController::class, 'eliminarEmpleado']);

        //cargar funciones
        Route::get('/cargarFunciones/{id}', [EmpleadosController::class, 'cargarFunciones']);

        //guardar funcion
        Route::post('/guardarFuncion', [EmpleadosController::class, 'guardarFuncion']);

        //actualizar funcion
        Route::put('/actualizarFuncion/{id}', [EmpleadosController::class, 'actualizarFuncion']);

        //cargar tareas
        Route::get('/cargarTareas/{id}', [EmpleadosController::class, 'cargarTareas']);

        //subir evidencias
        Route::post('/subirEvidencias', [EvidenciasController::class, 'subirEvidencias']);

        //guardar tarea
        Route::post('/guardarTarea', [EmpleadosController::class, 'guardarTarea']);

        //buscar tareas
        Route::get('/buscarTareas/{id}', [EmpleadosController::class, 'buscarTareas']);

        //actualizar tarea
        Route::put('/actualizarTarea/{id}', [EmpleadosController::class, 'actualizarTarea']);

        //actualizar estado tarea
        Route::put('/actualizarEstadoTarea/{id}', [EmpleadosController::class, 'actualizarEstadoTarea']);

        //cargar empleados y tareas
        Route::get('/dashboard/cargarEmpleadosTareas', [EmpleadosController::class, 'cargarEmpleadosTareas']);

        //eliminar evidencia
        Route::delete('/eliminarEvidencia/{id}', [EmpleadosController::class, 'eliminarEvidencia']);

        //cambiar estado de notificacion
        Route::get('/cambioEstadoNotificaciones/{id}', [EmpleadosController::class, 'cambiarEstadoNotificacion']);

        //cargar tarea seleccionada
        Route::get('/cargarTareaSeleccionada/{id}', [EmpleadosController::class, 'cargarTareaSeleccionada']);

        //realizar observaciones
        Route::put('/realizarObservaciones/{id}', [EmpleadosController::class, 'realizarObservaciones']);

        //visto bueno
        Route::put('/vistoBueno/{id}', [EmpleadosController::class, 'vistoBueno']);
    });
});

// Ruta catch-all para el SPA
Route::get('/{any}', function () {
    return view('app');
})->where('any', '.*');