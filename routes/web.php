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

        //guardar link de Drive como evidencia
        Route::post('/guardarEvidenciaLink', [EvidenciasController::class, 'guardarEvidenciaLink']);

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

        //cargar usuarios
        Route::get('/cargarUsuarios', [EmpleadosController::class, 'cargarUsuarios']);

        //buscar usuarios
        Route::get('/buscarUsuarios', [EmpleadosController::class, 'buscarUsuarios']);

        //lista de empleados
        Route::get('/listaEmpleados', [EmpleadosController::class, 'listaEmpleados']);
        
        //guardar usuario
        Route::post('/guardarUsuario', [EmpleadosController::class, 'guardarUsuario']);

        //eliminar usuario
        Route::delete('/eliminarUsuario/{id}', [EmpleadosController::class, 'eliminarUsuario']);

        //cargar empresas
        Route::get('/cargarEmpresas', [EmpleadosController::class, 'cargarEmpresas']);

        //buscar empresas
        Route::get('/buscarEmpresas', [EmpleadosController::class, 'buscarEmpresas']);

        //guardar empresa
        Route::post('/guardarEmpresa', [EmpleadosController::class, 'guardarEmpresa']);

        //eliminar empresa
        Route::delete('/eliminarEmpresa/{id}', [EmpleadosController::class, 'eliminarEmpresa']);

        //cargar lideres
        Route::get('/cargarLideres', [EmpleadosController::class, 'cargarLideres']);

        //cargar empleados lider
        Route::get('/cargarEmpleadosLider/{id}', [EmpleadosController::class, 'cargarEmpleadosLider']);

        //guardar asignaciones lider
        Route::post('/guardarAsignacionesLider', [EmpleadosController::class, 'guardarAsignacionesLider']); 

           // informe de tareas
    Route::get('/informes/tareas', [empleadosController::class, 'informeTareas']);

    //verificar empleado lider
    Route::get('/verificarEmpleadoLider/{id}', [empleadosController::class, 'verificarEmpleadoLider']);
        //eliminar funcion
    Route::delete('/eliminarFuncion/{id}', [empleadosController::class, 'eliminarFuncion']);
    
    //cargar actividades
    Route::get('/cargarActividades/{id}', [empleadosController::class, 'cargarActividades']);

    //guardar actividad
    Route::post('/guardarActividad', [empleadosController::class, 'guardarActividad']);

    //eliminar actividad
    Route::delete('/eliminarActividad/{id}', [empleadosController::class, 'eliminarActividad']);

    //actualizar actividad
    Route::put('/actualizarActividad/{id}', [empleadosController::class, 'actualizarActividad']);

    //rechazar tarea
    Route::put('/rechazarTarea/{id}', [empleadosController::class, 'rechazarTarea']);

    //aprobar tarea
    Route::put('/aprobarTarea/{id}', [empleadosController::class, 'aprobarTarea']);

    //pausar tarea
    Route::put('/pausarTarea/{id}', [empleadosController::class, 'pausarTarea']);

    //obtener observacion
    Route::get('/obtenerObservacion/{id}', [empleadosController::class, 'obtenerObservacion']);

    //eliminar tarea
    Route::delete('/eliminarTarea/{id}', [empleadosController::class, 'eliminarTarea']);

    //habilitar edicion
    Route::put('/habilitarEdicion/{id}', [empleadosController::class, 'habilitarEdicion']);

});


});

// Ruta catch-all para el SPA
Route::get('/{any}', function () {
    return view('app');
})->where('any', '.*');