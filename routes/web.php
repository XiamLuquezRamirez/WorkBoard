<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\LoginController;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\EmpleadosController;
use App\Http\Controllers\EvidenciasController;
use App\Http\Controllers\EspacioEquipoController;
use App\Http\Controllers\CriteriosAceptacionController;
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
// «activo» cierra la sesión de quien fue desactivado con la sesión abierta.
Route::middleware(['auth:sanctum', 'activo'])->group(function () {
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
        Route::post('/cargarEmpleados', [EmpleadosController::class, 'cargarEmpleados'])->middleware('administracion');

        //buscar empleados
        Route::post('/buscarEmpleados', [EmpleadosController::class, 'buscarEmpleados'])->middleware('administracion');

        //cargar empresas
        Route::get('/parametros/cargarEmpresas', [EmpleadosController::class, 'cargarEmpresas'])->middleware('administracion');

        //cargar departamentos
        Route::get('/parametros/cargarDepartamentos', [EmpleadosController::class, 'cargarDepartamentos'])->middleware('administracion');

        // Gestión completa de departamentos
        Route::get('/parametros/departamentos', [EmpleadosController::class, 'cargarDepartamentosDetalle']);
        Route::post('/parametros/departamentos', [EmpleadosController::class, 'crearDepartamento']);
        Route::put('/parametros/departamentos/{id}', [EmpleadosController::class, 'editarDepartamento']);
        Route::delete('/parametros/departamentos/{id}', [EmpleadosController::class, 'eliminarDepartamento']);
        Route::post('/parametros/departamentos/{id}/lider', [EmpleadosController::class, 'asignarLiderDepartamento']);
        Route::get('/parametros/departamentos/{id}/empleados', [EmpleadosController::class, 'empleadosDepartamento']);
        Route::post('/parametros/usuarios/{id}/independencia', [EmpleadosController::class, 'toggleIndependencia'])->middleware('administracion');

        //cargar cargos
        Route::get('/parametros/cargarCargos', [EmpleadosController::class, 'cargarCargos'])->middleware('administracion');

        //guardar empleado
        Route::post('/guardarEmpleados', [EmpleadosController::class, 'guardarEmpleado'])->middleware('administracion');

        //eliminar empleado
        Route::delete('/eliminarEmpleado/{id}', [empleadosController::class, 'eliminarEmpleado'])->middleware('administracion');

        //cargar funciones
        Route::get('/cargarFunciones/{id}', [EmpleadosController::class, 'cargarFunciones'])->middleware('administracion');

        //guardar funcion
        Route::post('/guardarFuncion', [EmpleadosController::class, 'guardarFuncion'])->middleware('administracion');

        //actualizar funcion
        Route::put('/actualizarFuncion/{id}', [EmpleadosController::class, 'actualizarFuncion'])->middleware('administracion');

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
        // Cierre verificado: único camino a Completada para una tarea con
        // criterios. Ahora lo resuelve la aceptación, con sus mismas reglas.
        Route::put('/verificarTarea/{id}', [CriteriosAceptacionController::class, 'verificarLegado']);

        // Criterios de aceptación: independientes del checklist (subtareas).
        Route::get('/tareas/{id}/criterios', [CriteriosAceptacionController::class, 'index']);
        Route::post('/tareas/{id}/criterios', [CriteriosAceptacionController::class, 'store']);
        Route::put('/tareas/{id}/criterios/orden', [CriteriosAceptacionController::class, 'ordenar']);
        Route::get('/tareas/{id}/criterios/historial', [CriteriosAceptacionController::class, 'historial']);
        Route::put('/criterios/{id}', [CriteriosAceptacionController::class, 'update']);
        Route::delete('/criterios/{id}', [CriteriosAceptacionController::class, 'destroy']);
        Route::put('/criterios/{id}/declarar', [CriteriosAceptacionController::class, 'declarar']);
        Route::put('/criterios/{id}/verificar', [CriteriosAceptacionController::class, 'verificar']);
        Route::post('/criterios/{id}/evidencias', [CriteriosAceptacionController::class, 'agregarEvidencia']);
        Route::delete('/criterios/evidencias/{id}', [CriteriosAceptacionController::class, 'quitarEvidencia']);
        // Aceptación final: una decisión aparte, nunca automática.
        Route::put('/tareas/{id}/aceptar', [CriteriosAceptacionController::class, 'aceptar']);
        Route::put('/tareas/{id}/devolver', [CriteriosAceptacionController::class, 'devolver']);

        //cargar empleados y tareas
        Route::get('/dashboard/cargarEmpleadosTareas', [EmpleadosController::class, 'cargarEmpleadosTareas']);
        Route::get('/dashboard/tendencia', [EmpleadosController::class, 'tendenciaDashboard']);
        // Resolver lo vencido desde el dashboard (administración o el líder).
        Route::get('/dashboard/vencidas', [\App\Http\Controllers\DashboardController::class, 'vencidas']);
        Route::post('/dashboard/vencidas/resolver', [\App\Http\Controllers\DashboardController::class, 'resolver']);
        // Bandeja «Necesita tu decisión»: las vencidas propias sin decidir.
        Route::get('/mis-decisiones', [\App\Http\Controllers\BandejaDecisionController::class, 'index']);
        Route::post('/mis-decisiones/{id}/ya-no-aplica', [\App\Http\Controllers\BandejaDecisionController::class, 'yaNoAplica'])->whereNumber('id');

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
        Route::get('/cargarUsuarios', [EmpleadosController::class, 'cargarUsuarios'])->middleware('administracion');

        //buscar usuarios
        Route::get('/buscarUsuarios', [EmpleadosController::class, 'buscarUsuarios'])->middleware('administracion');

        //lista de empleados
        Route::get('/listaEmpleados', [EmpleadosController::class, 'listaEmpleados'])->middleware('administracion');

        //guardar usuario
        Route::post('/guardarUsuario', [EmpleadosController::class, 'guardarUsuario'])->middleware('administracion');

        //eliminar usuario
        Route::delete('/eliminarUsuario/{id}', [EmpleadosController::class, 'eliminarUsuario'])->middleware('administracion');
        Route::post('/usuarios/{id}/estado', [EmpleadosController::class, 'cambiarEstadoUsuario'])->middleware('administracion');

        //cargar empresas
        Route::get('/cargarEmpresas', [EmpleadosController::class, 'cargarEmpresas'])->middleware('administracion');

        //buscar empresas
        Route::get('/buscarEmpresas', [EmpleadosController::class, 'buscarEmpresas'])->middleware('administracion');

        //guardar empresa
        Route::post('/guardarEmpresa', [EmpleadosController::class, 'guardarEmpresa'])->middleware('administracion');

        //eliminar empresa
        Route::delete('/eliminarEmpresa/{id}', [EmpleadosController::class, 'eliminarEmpresa'])->middleware('administracion');

        //cargar lideres
        Route::get('/cargarLideres', [EmpleadosController::class, 'cargarLideres'])->middleware('administracion');

        //cargar empleados lider
        Route::get('/cargarEmpleadosLider/{id}', [EmpleadosController::class, 'cargarEmpleadosLider'])->middleware('administracion');

        //guardar asignaciones lider
        Route::post('/guardarAsignacionesLider', [EmpleadosController::class, 'guardarAsignacionesLider'])->middleware('administracion');

        // informe de tareas
        Route::get('/informes/tareas', [empleadosController::class, 'informeTareas']);

        // informe de eficiencia operativa
        Route::get('/informes/eficiencia', [empleadosController::class, 'informeEficiencia']);

        // informe de proyectos
        Route::get('/informes/proyectos', [empleadosController::class, 'informeProyectos']);

        // estado del tablero de seguimiento (kanban en vivo)
        Route::get('/tablero/estado', [EmpleadosController::class, 'tableroEstado']);
        Route::get('/tablero/avatares', [EmpleadosController::class, 'tableroAvatares']);
        // Agenda de entregas: fuera del sondeo, se pide al abrir la vista.
        Route::get('/tablero/agenda', [EmpleadosController::class, 'tableroAgenda']);
        // Plano de la oficina: el equipo visto por lugar en vez de por estado.
        Route::get('/tablero/plano', [EmpleadosController::class, 'tableroPlano']);

        // Espacio de equipo: lo que ha pasado y lo que viene.
        Route::get('/equipo/actividad', [EspacioEquipoController::class, 'actividad']);
        Route::get('/equipo/reuniones', [EspacioEquipoController::class, 'reuniones']);
        Route::post('/equipo/reuniones', [EspacioEquipoController::class, 'crearReunion']);
        Route::put('/equipo/reuniones/{id}/respuesta', [EspacioEquipoController::class, 'responderReunion']);
        Route::delete('/equipo/reuniones/{id}', [EspacioEquipoController::class, 'cancelarReunion']);
        Route::get('/equipo/convocables', [EspacioEquipoController::class, 'convocables']);
        Route::get('/equipo/puesto/{empleado}', [EspacioEquipoController::class, 'puesto']);
        // Llamadas: el aviso suena en la pantalla del receptor.
        Route::post('/equipo/llamar', [EspacioEquipoController::class, 'llamar']);
        Route::get('/equipo/llamada-entrante', [EspacioEquipoController::class, 'llamadaEntrante']);
        Route::get('/equipo/llamada/{id}', [EspacioEquipoController::class, 'estadoLlamada']);
        Route::put('/equipo/llamada/{id}', [EspacioEquipoController::class, 'responderLlamada']);
        Route::get('/equipo/chat/canales', [EspacioEquipoController::class, 'chatCanales']);
        Route::get('/equipo/chat/mensajes', [EspacioEquipoController::class, 'chatMensajes']);
        Route::post('/equipo/chat/mensajes', [EspacioEquipoController::class, 'chatEnviar']);
        Route::get('/equipo/chat/avisos', [EspacioEquipoController::class, 'chatAvisos']);
        // Presencia en el plano: el estado propio y los saludos.
        Route::post('/equipo/presencia', [EspacioEquipoController::class, 'guardarPresencia']);
        Route::post('/equipo/presencia/uso', [EspacioEquipoController::class, 'usoEquipo']);
        Route::post('/equipo/saludar/{empleado}', [EspacioEquipoController::class, 'saludar'])->whereNumber('empleado');

        // videos ambientales del tablero (se administran desde Parámetros)
        Route::get('/tablero/videos', [EmpleadosController::class, 'tableroVideos']);
        Route::post('/tablero/videos', [EmpleadosController::class, 'guardarTableroVideo']);
        Route::delete('/tablero/videos/{id}', [EmpleadosController::class, 'eliminarTableroVideo']);

        //verificar empleado lider
        Route::get('/verificarEmpleadoLider/{id}', [empleadosController::class, 'verificarEmpleadoLider'])->middleware('administracion');
        //eliminar funcion
        Route::delete('/eliminarFuncion/{id}', [empleadosController::class, 'eliminarFuncion'])->middleware('administracion');

        //cargar actividades
        Route::get('/cargarActividades/{id}', [empleadosController::class, 'cargarActividades'])->middleware('administracion');

        //guardar actividad
        Route::post('/guardarActividad', [empleadosController::class, 'guardarActividad'])->middleware('administracion');

        //eliminar actividad
        Route::delete('/eliminarActividad/{id}', [empleadosController::class, 'eliminarActividad'])->middleware('administracion');

        //actualizar actividad
        Route::put('/actualizarActividad/{id}', [empleadosController::class, 'actualizarActividad'])->middleware('administracion');

        //rechazar tarea
        Route::put('/rechazarTarea/{id}', [empleadosController::class, 'rechazarTarea']);

        //aprobar tarea
        Route::put('/aprobarTarea/{id}', [empleadosController::class, 'aprobarTarea']);

        //pausar tarea
        Route::put('/pausarTarea/{id}', [empleadosController::class, 'pausarTarea']);
        // Impedimento declarado: no detiene el plazo, sólo lo hace visible.
        Route::put('/bloquearTarea/{id}', [EmpleadosController::class, 'bloquearTarea']);

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
        Route::post('/guardarProyecto', [EmpleadosController::class, 'guardarProyecto'])->middleware('administracion');
        Route::delete('/eliminarProyecto/{id}', [EmpleadosController::class, 'eliminarProyecto'])->middleware('administracion');
        Route::post('/proyectos/guardarProyecto', [EmpleadosController::class, 'guardarProyecto'])->middleware('administracion');
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
        Route::get('/parametros/cargos', [EmpleadosController::class, 'cargarCargos'])->middleware('administracion');
        Route::post('/parametros/cargos', [EmpleadosController::class, 'crearCargo'])->middleware('administracion');
        Route::put('/parametros/cargos/{id}', [EmpleadosController::class, 'actualizarCargo'])->middleware('administracion');
        Route::delete('/parametros/cargos/{id}', [EmpleadosController::class, 'eliminarCargo'])->middleware('administracion');

        // migración one-time: convierte fotos base64 almacenadas en BD a archivos en disco
        Route::post('/admin/migrar-fotos', [EmpleadosController::class, 'migrarFotos'])->middleware('administracion:Administrador');

        // importación one-time de proyectos iniciales
        Route::post('/admin/importar-proyectos', [EmpleadosController::class, 'importarProyectosIniciales'])->middleware('administracion:Administrador');


    });
});

// Ruta catch-all para el SPA
Route::get('/{any}', function () {
    return view('app');
})->where('any', '.*');
