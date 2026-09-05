<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\LoginController;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\EmpleadosController;
use App\Http\Controllers\EvidenciasController;
// Ruta para el CSRF cookie de Sanctum

// Rutas de Sanctum para CSRF
Route::get('api/sanctum/csrf-cookie', function () {
    return response()->json(['message' => 'CSRF cookie set']);
});

// Rutas de autenticación
Route::post('/login', [LoginController::class, 'login'])
    ->name('login');

// Compatibilidad SPA: axios baseURL = /api → /api/login y /api/logout deben correr con middleware "web"
Route::prefix('api')->group(function () {
    Route::post('/login', [LoginController::class, 'login']);
    Route::post('/logout', [LoginController::class, 'logout'])->middleware('auth:sanctum');
});

// Rutas protegidas
Route::middleware(['auth:sanctum'])->group(function () {
    Route::prefix('api')->group(function () {
        Route::get('/user', function () {
            return response()->json([
                'user' => Auth::user()
            ]);
        });
        
        Route::post('/logout', [LoginController::class, 'logout'])
        ->name('logout');

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

        // Gestión completa de departamentos
        Route::get('/parametros/departamentos', [EmpleadosController::class, 'cargarDepartamentosDetalle']);
        Route::post('/parametros/departamentos', [EmpleadosController::class, 'crearDepartamento']);
        Route::put('/parametros/departamentos/{id}', [EmpleadosController::class, 'editarDepartamento']);
        Route::delete('/parametros/departamentos/{id}', [EmpleadosController::class, 'eliminarDepartamento']);
        Route::post('/parametros/departamentos/{id}/lider', [EmpleadosController::class, 'asignarLiderDepartamento']);
        Route::get('/parametros/departamentos/{id}/empleados', [EmpleadosController::class, 'empleadosDepartamento']);
        Route::post('/parametros/usuarios/{id}/independencia', [EmpleadosController::class, 'toggleIndependencia']);

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

        // informe de eficiencia operativa
        Route::get('/informes/eficiencia', [empleadosController::class, 'informeEficiencia']);

        // informe de proyectos
        Route::get('/informes/proyectos', [empleadosController::class, 'informeProyectos']);

        // estado del tablero de seguimiento (kanban en vivo)
        Route::get('/tablero/estado', [EmpleadosController::class, 'tableroEstado']);
        Route::get('/tablero/avatares', [EmpleadosController::class, 'tableroAvatares']);

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

        // solicitud formal de pausa (motivo + fecha reanudación + correo a líder o administrador)
        Route::post('/solicitarPausa', [EmpleadosController::class, 'solicitarPausa']);
        Route::put('/pausas/{id}/resolver', [EmpleadosController::class, 'resolverSolicitudPausa']);
        Route::get('/pausas/tarea/{tareaId}', [EmpleadosController::class, 'historialPausas']);

        //reprogramar tarea
        Route::put('/reprogramarTarea/{id}', [empleadosController::class, 'reprogramarTarea']);

        //obtener observacion
        Route::get('/obtenerObservacion/{id}', [empleadosController::class, 'obtenerObservacion']);

        //eliminar tarea
        Route::delete('/eliminarTarea/{id}', [empleadosController::class, 'eliminarTarea']);

        //habilitar edicion
        Route::put('/habilitarEdicion/{id}', [empleadosController::class, 'habilitarEdicion']);

        //archivar tarea
        Route::put('/archivarTarea/{id}', [empleadosController::class, 'archivarTarea']);

        //desarchivar tarea
        Route::put('/desarchivarTarea/{id}', [empleadosController::class, 'desarchivarTarea']);

        //guardar observaciones
        Route::put('/guardarObservacionesEmpleado/{id}', [empleadosController::class, 'guardarObservacionesEmpleado']);

        // proyectos
        Route::get('/cargarProyectos', [EmpleadosController::class, 'cargarProyectos']);
        Route::post('/guardarProyecto', [EmpleadosController::class, 'guardarProyecto']);
        Route::delete('/eliminarProyecto/{id}', [EmpleadosController::class, 'eliminarProyecto']);
        Route::post('/proyectos/guardarProyecto', [EmpleadosController::class, 'guardarProyecto']);
        // subtareas
        Route::get('/subtareas/{tarea_id}', [EmpleadosController::class, 'cargarSubtareas']);
        Route::post('/subtareas', [EmpleadosController::class, 'guardarSubtarea']);
        Route::put('/subtareas/{id}', [EmpleadosController::class, 'actualizarSubtarea']);
        Route::delete('/subtareas/{id}', [EmpleadosController::class, 'eliminarSubtarea']);
        Route::get('/checklists-empleado/{empleado_id}', [EmpleadosController::class, 'checklistsEmpleado']);

        // actividades y comentarios de tarea
        Route::get('/tarea/{id}/actividades-comentarios', [EmpleadosController::class, 'actividadesComentariosTarea']);

        // reprogramaciones
        Route::post('/reprogramaciones/solicitar', [EmpleadosController::class, 'solicitarReprogramacion']);
        Route::put('/reprogramaciones/{id}/resolver', [EmpleadosController::class, 'resolverReprogramacion']);
        Route::get('/reprogramaciones/tarea/{tarea_id}', [EmpleadosController::class, 'historialReprogramaciones']);
        Route::get('/reprogramaciones/pendientes', [EmpleadosController::class, 'reprogramacionesPendientes']);
        Route::get('/informes/reprogramaciones', [EmpleadosController::class, 'informeReprogramaciones']);

        // cargos
        Route::get('/parametros/cargos', [EmpleadosController::class, 'cargarCargos']);
        Route::post('/parametros/cargos', [EmpleadosController::class, 'crearCargo']);
        Route::put('/parametros/cargos/{id}', [EmpleadosController::class, 'actualizarCargo']);
        Route::delete('/parametros/cargos/{id}', [EmpleadosController::class, 'eliminarCargo']);

        // migración one-time: convierte fotos base64 almacenadas en BD a archivos en disco
        Route::post('/admin/migrar-fotos', [EmpleadosController::class, 'migrarFotos']);

        // importación one-time de proyectos iniciales
        Route::post('/admin/importar-proyectos', [EmpleadosController::class, 'importarProyectosIniciales']);


    });
});

// Ruta catch-all para el SPA
Route::get('/{any}', function () {
    return view('app');
})->where('any', '.*');
