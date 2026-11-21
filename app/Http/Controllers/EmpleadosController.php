<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Carbon;
use App\Mail\NotificacionMailable;
use App\Support\AccesoTareas;
use App\Support\IndiceDesempeno;

class EmpleadosController extends Controller
{
    /**
     * Estado intermedio del método de la Escuela de Líderes.
     *
     * Entre "yo terminé" y "está cumplido" debe haber alguien que verifique el
     * criterio pactado. Antes ese paso ocurría sin dejar rastro: el responsable
     * movía la tarjeta a Completada y nadie comprobaba nada.
     */
    private const EN_REVISION = 'En Revisión';

    /**
     * Estados en los que una tarea ya no está pendiente de trabajo activo.
     *
     * Se usa donde antes se escribía ['Completada', 'En Proceso'] a mano: una
     * tarea en revisión tampoco debe pintarse como pausada ni caer en la
     * columna de pausa, porque el trabajo ya se entregó.
     */
    private const ESTADOS_NO_PAUSABLES = ['Completada', 'En Proceso', self::EN_REVISION];

    /** Estados en que puede estar una tarea. */
    private const ESTADOS_TAREA = ['Pendiente', 'En Proceso', self::EN_REVISION, 'Completada', 'Cancelada'];

    /** Zona de la oficina: «hoy» es el de aquí, no el de UTC. */
    private const ZONA_OFICINA = 'America/Bogota';

    function cargarNotificaciones(Request $request)
    {
        // El receptor es siempre quien tiene la sesión. Antes salía del
        // parámetro «id» y bastaba cambiarlo para leer la campana de otro.
        $yo = AccesoTareas::usuario();
        if (!$yo) {
            return response()->json([]);
        }
        $id = $yo->id;
        $tipo = $request->input('tipo');

        // Se devuelven las no leídas completas más un tramo reciente de leídas,
        // para que la pestaña "Leídas" del modal conserve el historial en lugar
        // de vaciarse en el siguiente sondeo. El histórico completo puede tener
        // miles de filas por receptor, de ahí el tope en las leídas.
        $limiteLeidas = 50;

        $receptorId = $id;
        $tipoReceptor = 'usuario';

        if ($tipo === 'empleado') {
            $empleado = DB::connection('mysql2')->table('empleados')
                ->join('users', 'empleados.id', 'users.empleado')
                ->select('users.id as id_usuario', 'empleados.*')
                ->where('users.id', $id)->first();
            if (!$empleado) {
                return response()->json([]);
            }
            $receptorId = $empleado->id_usuario;
            $tipoReceptor = 'empleado';
        }

        $base = fn () => DB::connection('mysql2')->table('notif_generales')
            ->where('id_receptor', $receptorId)
            ->where('tipo_receptor', $tipoReceptor);

        $noLeidas = $base()->where('leido', 0)
            ->orderBy('notif_generales.id', 'desc')
            ->get();

        $leidas = $base()->where('leido', 1)
            ->orderBy('notif_generales.id', 'desc')
            ->limit($limiteLeidas)
            ->get();

        // 'leida' se expone además de 'leido' porque el frontend filtra por ese
        // nombre; se mantiene 'leido' para no romper otros consumidores.
        $notificaciones = $noLeidas->concat($leidas)->map(function ($n) {
            $n->leida = (int) $n->leido === 1;
            return $n;
        })->values();

        return response()->json($notificaciones);
    }

    /**
     * Mi perfil: nombre, correo, foto y contraseña de quien tiene la sesión.
     *
     * El usuario sale siempre de la sesión. Antes se tomaba el `id` del cuerpo
     * de la petición, y bastaba cambiarlo para reescribir el correo y la
     * contraseña de otra persona, administradores incluidos.
     */
    function actualizarUsuario(Request $request)
    {
        $yo = $this->usuarioAutenticado();
        if (!$yo) {
            return response()->json(['error' => 'No se encontró tu usuario. Vuelve a iniciar sesión.'], 403);
        }

        $datos = $request->validate([
            'name'             => 'required|string|max:255',
            'email'            => ['required', 'email', 'max:255', Rule::unique('mysql2.users', 'email')->ignore($yo->id)],
            'cambiar_password' => 'nullable',
            'new_password'     => 'nullable|string',
        ], [
            'name.required'  => 'Escribe tu nombre.',
            'email.required' => 'Escribe tu correo.',
            'email.email'    => 'El correo no es válido.',
            'email.unique'   => 'Ese correo ya lo usa otro usuario.',
        ]);

        $cambiarPassword = filter_var($request->input('cambiar_password', false), FILTER_VALIDATE_BOOLEAN);
        if ($cambiarPassword) {
            $nueva = (string) $request->input('new_password', '');
            if (mb_strlen($nueva) < 6) {
                return response()->json(['errors' => ['new_password' => ['La contraseña debe tener al menos 6 caracteres.']]], 422);
            }
            if ($request->has('new_password_confirmation') && $nueva !== (string) $request->input('new_password_confirmation')) {
                return response()->json(['errors' => ['new_password' => ['Las contraseñas no coinciden.']]], 422);
            }
        }

        // FormData manda «null» como texto cuando no hay foto nueva: en ese
        // caso se conserva la que ya tenía en lugar de borrarla.
        $foto = $request->input('foto');
        $foto = in_array($foto, [null, '', 'null', 'undefined'], true) ? $yo->foto : $this->procesarFoto($foto);

        $cambios = ['name' => $datos['name'], 'email' => $datos['email'], 'foto' => $foto];
        $cambiosChat = ['name' => $datos['name'], 'email' => $datos['email']];
        if ($cambiarPassword) {
            $hash = Hash::make($request->input('new_password'));
            $cambios['password'] = $hash;
            $cambiosChat['password'] = $hash;
        }

        // El chat corporativo guarda su propia copia del usuario y es contra la
        // que se inicia sesión: si no se puede actualizar, no se toca nada.
        $base = DB::connection('mysql2');
        $base->beginTransaction();
        try {
            $base->table('users')->where('id', $yo->id)->update($cambios);
            DB::connection('mysql')->table('users')->where('id_usuario_tarea', $yo->id)->update($cambiosChat);
            $base->commit();
        } catch (\Throwable $e) {
            $base->rollBack();
            Log::error('Perfil: no se pudo actualizar el usuario ' . $yo->id . '. ' . $e->getMessage());

            return response()->json(['error' => 'No se pudo guardar tu perfil. Inténtalo de nuevo.'], 500);
        }

        $u = $base->table('users')->where('id', $yo->id)->first();

        // Solo lo que la sesión del navegador necesita: nunca el hash ni el token.
        return response()->json([
            'success' => 'Usuario actualizado correctamente',
            'user' => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'foto' => $u->foto,
                'tipo_usuario' => $u->tipo_usuario,
                'empleado' => $u->empleado,
                'lider' => $u->lider,
                'independencia' => $u->independencia ?? 'No',
            ],
            'status' => 'success',
        ], 200);
    }

    private function registrarActividad(int $tareaId, string $tipo, string $mensaje): void
    {
        DB::connection('mysql2')->table('notif_generales')->insert([
            'id_emisor'     => 0,
            'tipo_emisor'   => 'sistema',
            'id_receptor'   => 0,
            'tipo_receptor' => 'sistema',
            'mensaje'       => $mensaje,
            'tarea_id'      => $tareaId,
            'leido'         => 1,
            'fecha'         => now(),
            'tipo'          => $tipo,
        ]);
    }

    /** Nombre del usuario autenticado, para los mensajes del historial. */
    private function nombreActor(): string
    {
        $email = Auth::user()->email ?? null;
        if (!$email) {
            return 'Usuario';
        }
        return DB::connection('mysql2')->table('users')
            ->where('email', $email)->value('name') ?? 'Usuario';
    }

    function guardarObservacionesEmpleado(Request $request, $id)
    {
        $tarea = AccesoTareas::exigir($id, 'modificar');
        if (AccesoTareas::esRespuesta($tarea)) {
            return $tarea;
        }

        // El campo debe venir (puede ir vacío para borrarla): sin él se leía
        // una clave inexistente y respondía 500.
        $observaciones = $request->validate(['observacion_entrega' => 'present|nullable|string|max:5000'], [
            'observacion_entrega.present' => 'Falta la observación de entrega.',
        ]);
        DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
            'observacion_entrega' => $observaciones['observacion_entrega']
        ]);
        return response()->json(['success' => 'Observaciones guardadas correctamente'], 200);
    }

    function archivarTarea($id)
    {
        $tarea = AccesoTareas::exigir($id, 'modificar');
        if (AccesoTareas::esRespuesta($tarea)) {
            return $tarea;
        }

        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
            'archivar' => 1,
            'fecha_archivada' => date('Y-m-d H:i:s')
        ]);
        return response()->json(['success' => 'Tarea archivada correctamente'], 200);
    }

    function desarchivarTarea($id)
    {
        $tarea = AccesoTareas::exigir($id, 'modificar');
        if (AccesoTareas::esRespuesta($tarea)) {
            return $tarea;
        }

        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
            'archivar' => 0
        ]);
        return response()->json(['success' => 'Tarea desarchivada correctamente'], 200);
    }

    function eliminarTarea($id)
    {
        $tarea = AccesoTareas::exigir($id, 'modificar');
        if (AccesoTareas::esRespuesta($tarea)) {
            return $tarea;
        }

        if ($error = $this->bloqueadaPorAprobacion($tarea)) {
            return $error;
        }

        // Todo lo que cuelga de la tarea se va con ella, en una transacción.
        // Antes quedaban subtareas, comentarios y solicitudes huérfanas. Los
        // criterios, sus evidencias y las aceptaciones caen por cascada.
        $conn = DB::connection('mysql2');
        $conn->transaction(function () use ($conn, $id) {
            $conn->table('subtareas')->where('tarea_id', $id)->delete();
            $conn->table('observaciones_tareas')->where('id_tarea', $id)->delete();
            $conn->table('pausas_solicitadas')->where('tarea_id', $id)->delete();
            $conn->table('reprogramaciones_tareas')->where('tarea_id', $id)->delete();
            $conn->table('tarea_criterio_historial')->where('tarea_id', $id)->delete();
            $conn->table('evidencia_tarea')->where('tarea', $id)->delete();
            $conn->table('notif_generales')->where('tarea_id', $id)->delete();
            $conn->table('tareas_empleados')->where('id', $id)->delete();
        });
        return response()->json(['success' => 'Tarea eliminada correctamente'], 200);
    }


    function cargarEmpleados()
    {
        $empleados = DB::connection('mysql2')->table('empleados')
            ->join('empresas', 'empleados.empresa', 'empresas.id')
            ->join('departamentos', 'empleados.departamento', '=', 'departamentos.id')
            ->join('cargos', 'empleados.cargo', '=', 'cargos.id')
            ->select([
                ...$this->columnasEmpleado(),
                'empresas.nombre as nombre_empresa',
                'departamentos.nombre as nombre_departamento',
                'cargos.nombre as nombre_cargo',
                DB::raw(self::SQL_DEPARTAMENTOS_LIDERADOS . ' as departamentos_liderados'),
            ])
            ->where('empleados.estado_registro', 'Activo')
            ->get();
        return response()->json($empleados);
    }

    /** Nombres de los departamentos vigentes que lidera el empleado de la fila. */
    private const SQL_DEPARTAMENTOS_LIDERADOS =
        "(SELECT GROUP_CONCAT(d.nombre SEPARATOR ', ') FROM departamentos d
           WHERE d.lider_id = empleados.id AND (d.estado IS NULL OR d.estado <> 'Eliminado'))";

    /** Los estados que puede tener un departamento visible en la gestión. */
    private const DEPARTAMENTO_VISIBLE = "(departamentos.estado IS NULL OR departamentos.estado <> 'Eliminado')";

    /** Columnas de users que nunca salen al navegador. */
    private const COLUMNAS_PRIVADAS_USUARIO = ['password', 'remember_token'];

    /** Columnas de empleados que nunca salen al navegador. */
    private const COLUMNAS_PRIVADAS_EMPLEADO = ['pw_temporal'];

    /**
     * Todas las columnas de la tabla, calificadas, menos las privadas. Los
     * listados usaban tabla.* y devolvían el hash de la contraseña y el token
     * de sesión de cada usuario.
     */
    private function columnasPublicas(string $tabla, array $privadas): array
    {
        static $cache = [];

        return $cache[$tabla] ??= array_map(
            fn ($c) => "{$tabla}.{$c}",
            array_values(array_diff(Schema::connection('mysql2')->getColumnListing($tabla), $privadas))
        );
    }

    private function columnasEmpleado(): array
    {
        return $this->columnasPublicas('empleados', self::COLUMNAS_PRIVADAS_EMPLEADO);
    }

    private function columnasUsuario(): array
    {
        return $this->columnasPublicas('users', self::COLUMNAS_PRIVADAS_USUARIO);
    }

    /** Administradores y supervisores: quienes ven el menú de parámetros. */
    private function puedeAdministrar(): bool
    {
        $u = $this->usuarioAutenticado();
        return $u && in_array($u->tipo_usuario, ['Administrador', 'Supervisor'], true);
    }

    function buscarEmpleados()
    {

        $searchTerm = request('params.search');

        $empleados = DB::connection('mysql2')->table('empleados')
            ->join('empresas', 'empleados.empresa', 'empresas.id')
            ->join('cargos', 'empleados.cargo', 'cargos.id')
            ->select([
                ...$this->columnasEmpleado(),
                'empresas.nombre as nombre_empresa',
                'cargos.nombre as nombre_cargo',
                DB::raw(self::SQL_DEPARTAMENTOS_LIDERADOS . ' as departamentos_liderados'),
            ])
            ->where('empleados.estado_registro', 'Activo')
            ->where(function ($query) use ($searchTerm) {
                $query->where('empleados.nombres', 'like', '%' . $searchTerm . '%')
                    ->orWhere('empleados.apellidos', 'like', '%' . $searchTerm . '%')
                    ->orWhere('empleados.identificacion', 'like', '%' . $searchTerm . '%');
            })
            ->get();

        return response()->json($empleados);
    }


    function cargarEmpresas()
    {
        $empresas = DB::connection('mysql2')->table('empresas')
            ->where('estado', 'ACTIVO')
            ->get();
        return response()->json($empresas);
    }

    function cargarDepartamentos()
    {
        // Para elegir departamento sólo sirven los activos. El estado admite
        // NULL en los registros anteriores a esta columna, y esos cuentan como
        // activos; los inactivos y los eliminados quedan fuera.
        $departamentos = DB::connection('mysql2')->table('departamentos')
            ->where(function ($q) {
                $q->whereNull('estado')->orWhere('estado', 'Activo');
            })
            ->get();
        return response()->json($departamentos);
    }

    private function procesarFoto(?string $foto): ?string
    {
        return $foto;
    }

    /**
     * Valida y, si falla, responde 422 con el primer mensaje en «error», que
     * es lo que muestran los modales de Parámetros (además de «errors»).
     * Devuelve los datos validados o la respuesta lista para devolver.
     */
    private function validarParametro(Request $request, array $reglas, array $mensajes = [])
    {
        $v = \Illuminate\Support\Facades\Validator::make($request->all(), $reglas, $mensajes);
        if ($v->fails()) {
            $primero = $v->errors()->first();
            return response()->json(['error' => $primero, 'message' => $primero, 'errors' => $v->errors()], 422);
        }

        return $v->validated();
    }

    /**
     * Una sola fila de users por empleado (su nombre), para respaldar el
     * nombre de quien ya no está en empleados. Con un LEFT JOIN directo a
     * users, una persona con dos cuentas duplicaba cada una de sus tareas en
     * los informes y en los avisos de atraso.
     */
    private function usuarioPorEmpleado()
    {
        return DB::connection('mysql2')->table('users')
            ->whereNotNull('empleado')
            ->groupBy('empleado')
            ->selectRaw('empleado, MIN(name) as name');
    }

    /** Error inesperado al guardar: se anota y al cliente sólo va un texto genérico. */
    private function errorAlGuardar(\Throwable $e, string $que)
    {
        Log::error("Error al guardar {$que}", ['error' => $e->getMessage()]);

        return response()->json(['error' => "No fue posible guardar {$que}. Inténtalo de nuevo."], 500);
    }

    function guardarEmpleado(Request $request)
    {
        $editar = $request->input('accion') === 'editar';
        $id = $editar ? (int) $request->input('id') : null;
        if ($editar && !DB::connection('mysql2')->table('empleados')->where('id', $id)->exists()) {
            return response()->json(['error' => 'Empleado no encontrado.'], 404);
        }
        // El usuario del propio empleado no cuenta como «correo de otro».
        $suUsuario = $editar ? DB::connection('mysql2')->table('users')->where('empleado', $id)->value('id') : null;

        $validos = $this->validarParametro($request, [
            'accion'           => 'required|in:guardar,editar',
            'identificacion'   => ['required', 'string', 'max:15',
                Rule::unique('mysql2.empleados', 'identificacion')->ignore($id)
                    ->where(fn ($q) => $q->where('estado_registro', '<>', 'Eliminado'))],
            'nombres'          => 'required|string|max:100',
            'apellidos'        => 'required|string|max:100',
            'email'            => ['required', 'email', 'max:150',
                Rule::unique('mysql2.empleados', 'email')->ignore($id)
                    ->where(fn ($q) => $q->where('estado_registro', '<>', 'Eliminado')),
                Rule::unique('mysql2.users', 'email')->ignore($suUsuario)],
            'departamento'     => 'required|integer|exists:mysql2.departamentos,id',
            'empresa'          => 'required|integer|exists:mysql2.empresas,id',
            'cargo'            => 'required|integer|exists:mysql2.cargos,id',
            'telefono'         => 'nullable|string|max:30',
            'fecha_nacimiento' => 'nullable|date',
            'fecha_ingreso'    => 'nullable|date',
            'tipo_contrato'    => 'nullable|string|max:50',
            'direccion'        => 'nullable|string|max:200',
            'estado'           => 'required|in:Activo,Inactivo',
        ], [
            'identificacion.required' => 'La identificación es obligatoria.',
            'identificacion.unique'   => 'Ya hay un empleado con esa identificación.',
            'nombres.required'        => 'Los nombres son obligatorios.',
            'apellidos.required'      => 'Los apellidos son obligatorios.',
            'email.required'          => 'El correo es obligatorio.',
            'email.email'             => 'El correo no es válido.',
            'email.unique'            => 'Ese correo ya lo usa otra persona.',
            'departamento.required'   => 'Elige el departamento.',
            'departamento.exists'     => 'El departamento no existe.',
            'empresa.required'        => 'Elige la empresa.',
            'empresa.exists'          => 'La empresa no existe.',
            'cargo.required'          => 'Elige el cargo.',
            'cargo.exists'            => 'El cargo no existe.',
            'estado.in'               => 'El estado debe ser Activo o Inactivo.',
        ]);
        if ($validos instanceof \Illuminate\Http\JsonResponse) {
            return $validos;
        }

        $empleado = $request->all();

        // «Es líder» se decide en la ficha del empleado, pero el líder de un
        // departamento lo es por esa asignación: desmarcarlo aquí lo dejaría
        // como líder del área sin acceso a su equipo.
        $empleado['lider'] = ($empleado['lider'] ?? 'No') === 'Si' ? 'Si' : 'No';
        if ($empleado['lider'] === 'No' && ($empleado['accion'] ?? '') !== 'guardar' && !empty($empleado['id'])) {
            $lidera = DB::connection('mysql2')->table('departamentos')
                ->where('lider_id', $empleado['id'])
                ->whereRaw("(estado IS NULL OR estado <> 'Eliminado')")
                ->pluck('nombre');
            if ($lidera->isNotEmpty()) {
                return response()->json([
                    'error' => 'Es líder de ' . $lidera->implode(', ') . '. Quítale ese liderazgo en Departamentos antes de desmarcarlo como líder.',
                ], 422);
            }
        }

        DB::connection('mysql2')->beginTransaction();
        try {
            if ($empleado['accion'] == 'guardar') {
                $fotoUrl = $this->procesarFoto($empleado['foto'] ?? null);

                $empleadoId = DB::connection('mysql2')->table('empleados')->insertGetId(
                    [
                        'identificacion' => $empleado['identificacion'],
                        'nombres' => $empleado['nombres'],
                        'apellidos' => $empleado['apellidos'],
                        'email' => $empleado['email'],
                        'departamento' => $empleado['departamento'],
                        'empresa' => $empleado['empresa'],
                        'cargo' => $empleado['cargo'],
                        'telefono' => $empleado['telefono'],
                        'fecha_nacimiento' => $empleado['fecha_nacimiento'],
                        'fecha_ingreso' => $empleado['fecha_ingreso'],
                        'tipo_contrato' => $empleado['tipo_contrato'],
                        'direccion' => $empleado['direccion'],
                        'foto' => $fotoUrl,
                        'estado_registro' => 'Activo',
                        'estado' => $empleado['estado'],
                        'lider' => $empleado['lider']
                    ]
                );

                $usuario = DB::connection('mysql2')->table('users')->insertGetId([
                    'name' => $empleado['nombres'] . ' ' . $empleado['apellidos'],
                    'email' => $empleado['email'],
                    'password' => Hash::make($empleado['identificacion']),
                    'tipo_usuario' => 'Empleado',
                    'estado' => 'Activo',
                    'empleado' => $empleadoId,
                    'lider' => $empleado['lider'],
                    'foto' => $fotoUrl
                ]);
                //insertra en la tabla de usuario de chat empresarial
                DB::connection('mysql')->table('users')->insert([
                    'name' => $empleado['nombres'] . ' ' . $empleado['apellidos'],
                    'email' => $empleado['email'],
                    'password' => Hash::make($empleado['identificacion']),
                    'avatar' => 'otro.png',
                    'id_usuario_tarea' => $usuario
                ]);
            } else {
                $empleadoData = $empleado;
                $fotoUrl = $this->procesarFoto($empleadoData['foto'] ?? null);

                $updateResult = DB::connection('mysql2')->table('empleados')->where('id', $empleadoData['id'])->update([
                    'identificacion' => $empleadoData['identificacion'],
                    'nombres' => $empleadoData['nombres'],
                    'apellidos' => $empleadoData['apellidos'],
                    'email' => $empleadoData['email'],
                    'departamento' => $empleadoData['departamento'],
                    'empresa' => $empleadoData['empresa'],
                    'cargo' => $empleadoData['cargo'],
                    'telefono' => $empleadoData['telefono'],
                    'fecha_nacimiento' => $empleadoData['fecha_nacimiento'],
                    'fecha_ingreso' => $empleadoData['fecha_ingreso'],
                    'tipo_contrato' => $empleadoData['tipo_contrato'],
                    'direccion' => $empleadoData['direccion'],
                    'foto' => $fotoUrl,
                    'estado' => $empleadoData['estado'],
                    'lider' => $empleadoData['lider']
                ]);

                $usuario = DB::connection('mysql2')->table('users')->where('email', $empleadoData['email'])->update([
                    'name' => $empleadoData['nombres'] . ' ' . $empleadoData['apellidos'],
                    'email' => $empleadoData['email'],
                    'tipo_usuario' => 'Empleado',
                    'empleado' => $empleadoData['id'],
                    'lider' => $empleadoData['lider'],
                    'foto' => $fotoUrl
                ]);

                //insertra en la tabla de usuario de chat empresarial
                DB::connection('mysql')->table('users')->where('email', $empleadoData['email'])->update([
                    'name' => $empleadoData['nombres'] . ' ' . $empleadoData['apellidos'],
                    'email' => $empleadoData['email']
                ]);
            }


            // Auto-asignar al líder del departamento
            $deptId = ($empleado['accion'] == 'guardar') ? $empleado['departamento'] : $empleadoData['departamento'];
            $empId  = ($empleado['accion'] == 'guardar') ? $empleadoId : $empleadoData['id'];

            $dept = DB::connection('mysql2')->table('departamentos')
                ->where('id', $deptId)
                ->select('lider_id')
                ->first();

            if ($dept && $dept->lider_id && $dept->lider_id != $empId) {
                // Eliminar asignación anterior (cambio de departamento / reasignación)
                DB::connection('mysql2')->table('lideres_empleados')
                    ->where('empleado', $empId)
                    ->delete();

                DB::connection('mysql2')->table('lideres_empleados')->insert([
                    'lider'    => $dept->lider_id,
                    'empleado' => $empId,
                ]);
            }

            DB::connection('mysql2')->commit();

        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            // Antes se devolvía $e->getMessage(): la consulta completa, con el
            // hash de la contraseña inicial y los datos personales.
            return $this->errorAlGuardar($e, 'el empleado');
        }

        return response()->json(['success' => 'Empleado guardado correctamente'], 200);
    }

    function eliminarEmpleado($id)
    {
        if (!DB::connection('mysql2')->table('empleados')->where('id', $id)->where('estado_registro', '<>', 'Eliminado')->exists()) {
            return response()->json(['error' => 'Empleado no encontrado.'], 404);
        }
        $empleado = DB::connection('mysql2')->table('empleados')
            ->where('id', $id)
            ->update([
                'estado_registro' => 'Eliminado'
            ]);
        return response()->json(['success' => 'Empleado eliminado correctamente'], 200);
    }

    function cargarFunciones($id)
    {
        $funciones = DB::connection('mysql2')->table('funciones_empleado')
            ->join('empleados', 'funciones_empleado.empleado', '=', 'empleados.id')
            ->select('funciones_empleado.*', 'empleados.nombres', 'empleados.apellidos')
            ->where('funciones_empleado.empleado', $id)
            ->where('funciones_empleado.estado', 'Activo')
            ->get();
        return response()->json($funciones);
    }

    function guardarFuncion(Request $request)
    {
        $validos = $this->validarParametro($request, [
            'empleado' => ['required', 'integer', Rule::exists('mysql2.empleados', 'id')->where('estado_registro', 'Activo')],
            'funcion'  => 'required|string|max:1000',
        ], [
            'empleado.required' => 'Falta el empleado.',
            'empleado.exists'   => 'El empleado no existe.',
            'funcion.required'  => 'Escribe la función.',
        ]);
        if ($validos instanceof \Illuminate\Http\JsonResponse) {
            return $validos;
        }
        $funcionEmpleado = $request->all();
        DB::connection('mysql2')->beginTransaction();
        try {

            $funcion = DB::connection('mysql2')->table('funciones_empleado')->insert([
                'empleado' => $funcionEmpleado['empleado'],
                'descripcion' => $funcionEmpleado['funcion'],
                'estado' => 'Activo'
            ]);

            DB::connection('mysql2')->commit();
        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            return $this->errorAlGuardar($e, 'la función');
        }
        //obtener la ultima funcion insertada
        $funcion = DB::connection('mysql2')->table('funciones_empleado')
            ->where('empleado', $funcionEmpleado['empleado'])
            ->where('estado', 'Activo')
            ->orderBy('id', 'desc')
            ->first();
        return response()->json([
            'success' => 'Función guardada correctamente',
            'funcion' => $funcion
        ], 200);
    }

    function actualizarFuncion(Request $request, $id)
    {
        if (!DB::connection('mysql2')->table('funciones_empleado')->where('id', $id)->exists()) {
            return response()->json(['error' => 'Función no encontrada.'], 404);
        }
        $validos = $this->validarParametro($request, ['descripcion' => 'required|string|max:1000'], [
            'descripcion.required' => 'Escribe la función.',
        ]);
        if ($validos instanceof \Illuminate\Http\JsonResponse) {
            return $validos;
        }
        $funcionEmpleado = $request->all();
        $funcion = DB::connection('mysql2')->table('funciones_empleado')->where('id', $id)->update([
            'descripcion' => $funcionEmpleado['descripcion']
        ]);
        return response()->json(['success' => 'Función actualizada correctamente'], 200);
    }

    function cargarTareas($id)
    {
        if (!AccesoTareas::alcanza((int) $id)) {
            return AccesoTareas::denegada();
        }

        $tareas = DB::connection('mysql2')->table('tareas_empleados')
            ->leftJoin('proyectos', 'tareas_empleados.proyecto_id', '=', 'proyectos.id')
            ->select('tareas_empleados.*', 'proyectos.nombre as proyecto_nombre')
            ->where('empleado', $id)
            ->where('estado_reg', 'Activo')
            ->orderByRaw("FIELD(prioridad, 'Alta', 'Media', 'Baja')")
            ->orderBy('tareas_empleados.id', 'desc')
            ->get();

        //obtener observaciones de las tareas
        $observaciones = DB::connection('mysql2')->table('observaciones_tareas')
            ->join('users', 'observaciones_tareas.creador', 'users.id')
            ->select('observaciones_tareas.*', 'users.name as creador')
            ->whereIn('id_tarea', $tareas->pluck('id'))
            ->orderBy('observaciones_tareas.fecha', 'desc')
            ->get();


        // Agregar observaciones a las tareas
        $tareas = $tareas->map(function ($tarea) use ($observaciones) {
            $tarea->observaciones = $observaciones->where('id_tarea', $tarea->id)->values();
            return $tarea;
        });



        // Obtener los IDs de las tareas
        $tareasIds = $tareas->pluck('id');

        // Obtener las evidencias relacionadas a esas tareas
        $evidencias = DB::connection('mysql2')->table('evidencia_tarea')
            ->whereIn('tarea', $tareasIds)
            ->get();

        // Agregar evidencias a las tareas
        $tareas = $tareas->map(function ($tarea) use ($evidencias) {
            $tarea->evidencias = $evidencias->where('tarea', $tarea->id)->values();
            return $tarea;
        });

        // Agregar conteos de subtareas
        $subtareasCounts = DB::connection('mysql2')->table('subtareas')
            ->whereIn('tarea_id', $tareasIds)
            ->select('tarea_id', DB::raw('COUNT(*) as subtareas_total'), DB::raw('SUM(completada) as subtareas_completadas'))
            ->groupBy('tarea_id')
            ->get()
            ->keyBy('tarea_id');

        $tareas = $tareas->map(function ($tarea) use ($subtareasCounts) {
            $counts = $subtareasCounts->get($tarea->id);
            $tarea->subtareas_total = $counts ? (int)$counts->subtareas_total : 0;
            $tarea->subtareas_completadas = $counts ? (int)$counts->subtareas_completadas : 0;
            return $tarea;
        });

        //obtener notificaciones de las tareas atrasadas
        self::obtenerNotificacionesTareasAtrasadas();


        return response()->json([
            'tareas' => $tareas
        ]);
    }

    function obtenerNotificacionesTareasAtrasadas()
    {
        // El join con empleados es LEFT: con INNER quedaban sin avisar las tareas
        // vencidas cuyo empleado ya no figura en 'empleados' (personas dadas de
        // baja cuyo registro se eliminó), pese a seguir siendo trabajo pendiente
        // y a que el destinatario del aviso es el líder, no el propio empleado.
        // El nombre se recupera de 'users' para que el mensaje siga identificando
        // a quién corresponde la tarea.
        $tareasAtrasadas = DB::connection('mysql2')->table('tareas_empleados')
            ->leftJoin('empleados', 'tareas_empleados.empleado', '=', 'empleados.id')
            ->leftJoinSub($this->usuarioPorEmpleado(), 'users', 'tareas_empleados.empleado', '=', 'users.empleado')
            ->whereRaw('DATE(fecha_pactada) < CURDATE()')
            // Cerradas o canceladas no tienen plazo que cumplir. En revisión
            // ya está entregada: lo que falta es la revisión.
            ->whereNotIn('tareas_empleados.estado', ['Completada', 'Cancelada', self::EN_REVISION])
            ->where('tareas_empleados.estado_reg', 'Activo')
            ->where('tareas_empleados.pausada', 0)
            ->where('tareas_empleados.aprobada', 1)
            ->select(
                DB::connection('mysql2')->raw(
                    'COALESCE(NULLIF(TRIM(CONCAT(COALESCE(empleados.nombres, ""), " ", COALESCE(empleados.apellidos, ""))), ""), users.name, "Sin responsable") as nombre_empleado'
                ),
                'tareas_empleados.*'
            )
            ->get();

        foreach ($tareasAtrasadas as $tarea) {
            // Una sola notificación por tarea por día, independientemente de si fue leída
            $notificacionExistente = DB::connection('mysql2')->table('notif_generales')
                ->where('tarea_id', $tarea->id)
                ->where('tipo', 'TareaAtrasada')
                ->whereDate('fecha', now()->toDateString())
                ->exists();
            if ($notificacionExistente) {
                continue;
            }

            $fechaPactada = date('d/m/Y', strtotime($tarea->fecha_pactada));
            $mensaje = 'El empleado ' . $tarea->nombre_empleado . ' tiene una tarea atrasada: ' . $tarea->titulo . ' (Fecha pactada: ' . $fechaPactada . ')';

            // Todos sus líderes activos; sin ninguno, la administración de
            // seguimiento. Antes sólo el primer líder, aunque estuviera inactivo.
            $lideres = \App\Support\Avisos::lideresActivos((int) $tarea->empleado, [(int) $tarea->empleado]);
            if ($lideres !== []) {
                \App\Support\Avisos::campana($lideres, (int) $tarea->empleado, $mensaje, (int) $tarea->id, 'TareaAtrasada');
            } else {
                \App\Support\Avisos::campanaUsuarios(\App\Support\Avisos::administracionDeSeguimiento(), (int) $tarea->empleado, $mensaje, (int) $tarea->id, 'TareaAtrasada');
            }
        }
    }

    function guardarTarea(Request $request)
    {
        $accion = $request->input('accion', 'guardar');

        // Validación unificada en el servidor. Antes cada pantalla aplicaba sus
        // propias reglas en el cliente y ninguna se comprobaba aquí: Dashboard y
        // EmployeeModal exigían descripción >= 10 caracteres pero no fecha futura,
        // mientras EmployeeInterface exigía fecha futura pero no longitud mínima.
        //
        // Las reglas estrictas (longitud mínima y fecha no pasada) sólo se aplican
        // al crear. Al editar se relajan a propósito: existen tareas antiguas con
        // descripciones de pocos caracteres y con fecha pactada ya vencida, y
        // exigirles el formato nuevo impediría guardar cambios en campos ajenos.
        $reglas = [
            'titulo'        => 'required|string|max:255',
            'descripcion'   => 'required|string',
            'fecha_pactada' => 'required|date',
            'empleado'      => 'required|integer|exists:mysql2.empleados,id',
            // El orden y los filtros usan FIELD(prioridad, 'Alta','Media','Baja'):
            // cualquier otro texto quedaba fuera de ambos.
            'prioridad'     => 'required|in:Alta,Media,Baja',
            'estado'        => ['required', Rule::in(self::ESTADOS_TAREA)],
            'proyecto_id'   => 'nullable|integer|exists:mysql2.proyectos,id',
            'accion'        => 'nullable|in:guardar,editar',
            // Campos del método de la Escuela de Líderes.
            'proposito'     => 'nullable|string|max:500',
            'criterio'      => 'nullable|string',
        ];
        if ($accion === 'guardar') {
            $reglas['descripcion']   = 'required|string|min:10';
            $reglas['fecha_pactada'] = 'required|date|after_or_equal:today';
            // Obligatorios sólo al crear: una tarea nace con un para qué y con
            // la forma de saber que el resultado está bien. Al editar se relajan
            // porque las tareas vivas nacieron sin ellos.
            $reglas['proposito'] = 'required|string|min:10|max:500';

            // Una tarea nueva no puede nacer cerrada ni en revisión: tendría
            // criterios sin verificar y se saltaría la aceptación.
            $reglas['estado'] = 'required|in:Pendiente,En Proceso';
            // Una tarea nueva no se asigna a quien ya no está activo.
            $reglas['empleado'] = ['required', 'integer', Rule::exists('mysql2.empleados', 'id')
                ->where('estado', 'Activo')->where('estado_registro', 'Activo')];

            // El texto único de criterio se sustituyó por una lista de criterios
            // de aceptación. Si una pantalla aún sin recargar manda el texto, se
            // convierte en el primer criterio en vez de rechazar la tarea.
            if (!$request->has('criterios') && trim((string) $request->input('criterio')) !== '') {
                $request->merge(['criterios' => [['descripcion' => $request->input('criterio')]]]);
            }
            $reglas += CriteriosAceptacionController::reglasAlCrear();
        } else {
            $reglas['id'] = 'required|integer';
        }

        $request->validate($reglas, [
            'descripcion.min'                => 'La descripción debe tener al menos 10 caracteres.',
            'fecha_pactada.after_or_equal'   => 'La fecha pactada no puede ser anterior a hoy.',
            'proposito.required'             => 'Indica para qué sirve esta tarea.',
            'proposito.min'                  => 'El propósito debe explicarse en al menos 10 caracteres.',
            'estado.in'                      => 'Una tarea nueva empieza Pendiente o En Proceso.',
            'prioridad.in'                   => 'La prioridad debe ser Alta, Media o Baja.',
            'proyecto_id.exists'             => 'El proyecto no existe.',
            'empleado.exists'                => 'El responsable no existe o ya no está activo.',
            'criterio.required'              => 'Indica cómo sabremos que la tarea se cumplió.',
            'criterio.min'                   => 'El criterio debe explicarse en al menos 10 caracteres.',
        ] + CriteriosAceptacionController::mensajesAlCrear());

        // Editar no es otra puerta para mover la tarea: rigen las mismas
        // reglas que al arrastrarla. Enviar a revisión tampoco se hace desde
        // aquí, porque deja fecha de entrega y avisa al líder.
        // Se asigna a uno mismo, a alguien del propio equipo o, desde
        // administración, a cualquiera. Antes cualquiera asignaba a cualquiera.
        if ($accion === 'guardar' && !AccesoTareas::alcanza((int) $request->input('empleado'))) {
            return response()->json([
                'error' => 'Solo puedes asignarte tareas a ti o a alguien de tu equipo.',
            ], 403);
        }

        $actualEdit = null;
        if ($accion === 'editar') {
            $actualEdit = DB::connection('mysql2')->table('tareas_empleados')->where('id', $request->input('id'))->first();
            if (!$actualEdit) {
                return response()->json(['error' => 'Tarea no encontrada'], 404);
            }
            if (!AccesoTareas::alcanza((int) $actualEdit->empleado)) {
                return AccesoTareas::denegada('modificar');
            }
            if ($error = $this->bloqueadaPorAprobacion($actualEdit)) {
                return $error;
            }
            if ($request->input('estado') !== $actualEdit->estado) {
                if ($request->input('estado') === self::EN_REVISION) {
                    return response()->json([
                        'error' => 'Para enviar la tarea a revisión usa «Enviar a revisión» en el detalle de la tarea.',
                    ], 409);
                }
                if ($error = $this->reglaDeEstado($actualEdit, (string) $request->input('estado'))) {
                    return $error;
                }
            }
        }

        $tarea = $request->all();
        DB::connection('mysql2')->beginTransaction();
        try {
            if ($accion == 'guardar') {
                $IdTarea = DB::connection('mysql2')->table('tareas_empleados')->insertGetId([
                    'titulo' => $tarea['titulo'],
                    'empleado' => $tarea['empleado'],
                    'descripcion' => $tarea['descripcion'],
                    'fecha_pactada' => $tarea['fecha_pactada'],
                    'prioridad' => $tarea['prioridad'],
                    'estado' => $tarea['estado'],
                    'estado_reg' => 'Activo',
                    'fecha_creacion' => now(),
                    'pausada' => 0,
                    'editable' => 1,
                    'proyecto_id' => $tarea['proyecto_id'] ?? null,
                    'proposito' => trim($tarea['proposito']),
                ]);

                // Los criterios de aceptación nacen con la tarea, dentro de la
                // misma transacción: o se guarda todo o nada.
                app(CriteriosAceptacionController::class)
                    ->crearIniciales($IdTarea, $request->input('criterios', []));
            } else {
                $cambios = [
                    'titulo' => $tarea['titulo'],
                    'descripcion' => $tarea['descripcion'],
                    'fecha_pactada' => $tarea['fecha_pactada'],
                    'prioridad' => $tarea['prioridad'],
                    'estado' => $tarea['estado'],
                    'proyecto_id' => $tarea['proyecto_id'] ?? null,
                ];

                // Sólo se tocan si vienen en la petición: las pantallas que aún
                // no envían estos campos no deben borrar lo que ya se pactó.
                foreach (['proposito', 'criterio'] as $campo) {
                    if (array_key_exists($campo, $tarea)) {
                        $cambios[$campo] = trim((string) $tarea[$campo]) ?: null;
                    }
                }

                DB::connection('mysql2')->table('tareas_empleados')->where('id', $tarea['id'])->update($cambios);
                $IdTarea = $tarea['id'];
            }

            /// isertar evidencia
            if (isset($tarea['evidencias']) && count($tarea['evidencias']) > 0) {
                $evidencias = $tarea['evidencias'];
                foreach ($evidencias as $evidencia) {
                    $evidencia = DB::connection('mysql2')->table('evidencia_tarea')->insert([
                        'tarea' => $IdTarea,
                        'evidencia' => $evidencia['ruta'],
                        'nombre' => $evidencia['nombre'],
                        'tipo' => $evidencia['tipo']
                    ]);
                }
            }

            //guardar notificacion solo al crear
            if ($accion == 'guardar') {
                self::guardarNotificacion($IdTarea, 'Tarea');
            }

            //consultar tareas del empleado
            DB::connection('mysql2')->commit();
        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }


        $tareas = DB::connection('mysql2')->table('tareas_empleados')
            ->leftJoin('proyectos', 'tareas_empleados.proyecto_id', '=', 'proyectos.id')
            ->select('tareas_empleados.*', 'proyectos.nombre as proyecto_nombre')
            ->where('empleado', $actualEdit ? $actualEdit->empleado : $tarea['empleado'])
            ->orderBy('tareas_empleados.id', 'desc')
            ->get();

        return response()->json([
            'success' => 'Tarea guardada correctamente',
            'tarea_id' => $IdTarea,
            'tareas' => $tareas
        ], 200);
    }



    function buscarTareas($id, Request $request)
    {
        if (!AccesoTareas::alcanza((int) $id)) {
            return AccesoTareas::denegada();
        }

        $searchTerm = $request->input('search');
        $tareas = DB::connection('mysql2')->table('tareas_empleados')
            ->leftJoin('proyectos', 'tareas_empleados.proyecto_id', '=', 'proyectos.id')
            ->select('tareas_empleados.*', 'proyectos.nombre as proyecto_nombre')
            ->where('empleado', $id)
            ->where('estado_reg', 'Activo')
            ->orderBy('tareas_empleados.id', 'desc')
            ->where(function ($query) use ($searchTerm) {
                $query->where('tareas_empleados.titulo', 'like', '%' . $searchTerm . '%')
                    ->orWhere('tareas_empleados.descripcion', 'like', '%' . $searchTerm . '%')
                    ->orWhere('tareas_empleados.estado', 'like', '%' . $searchTerm . '%')
                    ->orWhere('tareas_empleados.prioridad', 'like', '%' . $searchTerm . '%');
            })
            ->get();

        $tareasIds = $tareas->pluck('id');

        // Obtener las evidencias relacionadas a esas tareas
        $evidencias = DB::connection('mysql2')->table('evidencia_tarea')
            ->whereIn('tarea', $tareasIds)
            ->get();

        // Agregar evidencias a las tareas
        $tareas = $tareas->map(function ($tarea) use ($evidencias) {
            $tarea->evidencias = $evidencias->where('tarea', $tarea->id)->values();
            return $tarea;
        });

        // Agregar conteos de subtareas
        $subtareasCountsBuscar = DB::connection('mysql2')->table('subtareas')
            ->whereIn('tarea_id', $tareasIds)
            ->select('tarea_id', DB::raw('COUNT(*) as subtareas_total'), DB::raw('SUM(completada) as subtareas_completadas'))
            ->groupBy('tarea_id')
            ->get()
            ->keyBy('tarea_id');

        $tareas = $tareas->map(function ($tarea) use ($subtareasCountsBuscar) {
            $counts = $subtareasCountsBuscar->get($tarea->id);
            $tarea->subtareas_total = $counts ? (int)$counts->subtareas_total : 0;
            $tarea->subtareas_completadas = $counts ? (int)$counts->subtareas_completadas : 0;
            return $tarea;
        });

        return response()->json([
            'tareas' => $tareas
        ]);
    }

    function actualizarTarea(Request $request, $id)
    {
        $tarea = $request->validate([
            'titulo'        => 'required|string|max:255',
            'descripcion'   => 'required|string',
            'fecha_pactada' => 'required|date',
            'prioridad'     => 'required|in:Alta,Media,Baja',
            'proyecto_id'   => 'nullable|integer|exists:mysql2.proyectos,id',
            'proposito'     => 'nullable|string|max:500',
            'criterio'      => 'nullable|string',
        ], [
            'prioridad.in'       => 'La prioridad debe ser Alta, Media o Baja.',
            'proyecto_id.exists' => 'El proyecto no existe.',
        ]);

        $actual = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->first();
        if (!$actual) {
            return response()->json(['error' => 'Tarea no encontrada'], 404);
        }
        if (!AccesoTareas::alcanza((int) $actual->empleado)) {
            return AccesoTareas::denegada('modificar');
        }
        if ($error = $this->bloqueadaPorAprobacion($actual)) {
            return $error;
        }

        $cambios = [
            'titulo'      => $tarea['titulo'],
            'descripcion' => $tarea['descripcion'],
            'fecha_pactada' => $tarea['fecha_pactada'],
            'prioridad'   => $tarea['prioridad'],
            'proyecto_id' => $tarea['proyecto_id'] ?? null,
        ];

        // Sólo se tocan si vienen: las pantallas que no los envían no deben
        // borrar lo ya pactado.
        foreach (['proposito', 'criterio'] as $campo) {
            if (!array_key_exists($campo, $tarea)) {
                continue;
            }

            $valor = trim((string) $tarea[$campo]);

            // Un criterio ya pactado no se vacía. Permitirlo abriría la puerta
            // a esquivar la verificación: bastaría con borrarlo para que la
            // tarea volviera a cerrarse de un arrastre.
            if ($valor === '' && !empty($actual->{$campo})) {
                return response()->json([
                    'error' => $campo === 'criterio'
                        ? 'El criterio de cumplimiento no puede quedar vacío. Puedes redactarlo de otra forma, pero no eliminarlo.'
                        : 'El propósito no puede quedar vacío.',
                ], 422);
            }

            if ($valor !== '' && mb_strlen($valor) < 10) {
                return response()->json([
                    'error' => $campo === 'criterio'
                        ? 'El criterio debe explicarse en al menos 10 caracteres.'
                        : 'El propósito debe explicarse en al menos 10 caracteres.',
                ], 422);
            }

            $cambios[$campo] = $valor ?: null;
        }

        // Registrar cuándo una tarea heredada adopta el método, para poder
        // seguir cuántas del fondo antiguo ya tienen criterio pactado.
        if (empty($actual->criterio) && !empty($cambios['criterio'] ?? null)) {
            $this->registrarActividad(
                (int) $id,
                'Criterio',
                "{$this->nombreActor()} pactó el criterio de cumplimiento de esta tarea."
            );
        }

        DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update($cambios);
        // devolver proyecto_nombre para que el frontend actualice la vista
        $proyecto = null;
        if (!empty($tarea['proyecto_id'])) {
            $proyecto = DB::connection('mysql2')->table('proyectos')
                ->where('id', $tarea['proyecto_id'])
                ->value('nombre');
        }
        return response()->json([
            'success' => 'Tarea actualizada correctamente',
            'proyecto_nombre' => $proyecto,
        ], 200);
    }


    function actualizarEstadoTarea(Request $request, $id)
    {
        $tarea = $request->all();

        // Una tarea pausada no se mueve arrastrándola: primero debe reanudarse
        // por su flujo propio (pausarTarea con pausada=false), que además deja
        // constancia en el historial de actividad. Sin esta comprobación, mover
        // la tarjeta saltaba la reanudación y dejaba la tarea en un estado
        // contradictorio: activa según 'estado' pero marcada como pausada.
        $actual = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->first();
        if (!$actual) {
            return response()->json(['error' => 'Tarea no encontrada'], 404);
        }
        if ((int) ($actual->pausada ?? 0) === 1) {
            return response()->json([
                'error' => 'La tarea está en pausa. Debe reanudarse antes de cambiar su estado.',
                'pausada' => true,
            ], 409);
        }

        $nuevo = (string) ($tarea['estado'] ?? '');
        if (!in_array($nuevo, self::ESTADOS_TAREA, true)) {
            return response()->json(['error' => 'Estado no válido.'], 422);
        }

        // Quién puede moverla y hacia dónde: toda tarea pasa por revisión y
        // sólo sale de ella aceptándola o devolviéndola.
        if ($error = $this->reglaDeEstado($actual, $nuevo)) {
            return $error;
        }

        // Un responsable con independencia no espera revisión: al enviarla a
        // revisión (o llevarla a Completada) se acepta sola si cumple.
        $completaSola = $nuevo !== $actual->estado
            && in_array($nuevo, [self::EN_REVISION, 'Completada'], true)
            && app(CriteriosAceptacionController::class)->completaSola($actual);
        if ($completaSola && $nuevo === 'Completada') {
            if ($actual->estado === self::EN_REVISION) {
                return $this->respuestaCompletaSola((int) $id, false);
            }
            // Pasa primero por revisión, como cualquier entrega: queda la
            // fecha de entrega y el hito en el historial.
            $nuevo = self::EN_REVISION;
            $tarea['estado'] = $nuevo;
        }

        $usuario = $this->usuarioAutenticado();
        $aRevision = $nuevo === self::EN_REVISION && $actual->estado !== self::EN_REVISION;
        $reabre = $actual->estado === 'Completada' && $nuevo !== 'Completada';

        DB::connection('mysql2')->beginTransaction();
        try {
            $cambios = ['estado' => $nuevo];

            // La entrega es el día en que se envía a revisión, no el día en que
            // el líder la acepta: la espera de la revisión no es retraso de
            // quien entregó. La puntualidad se mide con esta fecha.
            if ($aRevision) {
                $cambios['fecha_entregada'] = Carbon::today(self::ZONA_OFICINA)->toDateString();
            }
            // Reabierta deja de estar entregada; la próxima entrega fija la fecha.
            if ($reabre) {
                $cambios['fecha_entregada'] = null;
                $cambios['criterio_cumplido'] = 0;
            }

            DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update($cambios);

            // El envío a revisión y la reapertura son hitos del flujo de
            // aceptación: quedan en el historial, junto a lo que se verifique.
            if ($aRevision || $reabre) {
                DB::connection('mysql2')->table('tarea_criterio_historial')->insert([
                    'tarea_id'    => $id,
                    'evento'      => $aRevision ? 'enviada_revision' : 'tarea_reabierta',
                    'antes'       => json_encode(['estado' => $actual->estado], JSON_UNESCAPED_UNICODE),
                    'despues'     => json_encode(['estado' => $nuevo], JSON_UNESCAPED_UNICODE),
                    'usuario_id'  => $usuario->id ?? null,
                    'created_at'  => now(),
                ]);
                $actor = $this->nombreActor();
                $this->registrarActividad(
                    (int) $id,
                    $aRevision ? 'Enviada a revisión' : 'Reabierta',
                    $aRevision ? "{$actor} envió la tarea a revisión." : "{$actor} reabrió la tarea, que estaba cerrada."
                );
            }

            //insertar evidencias
            if (isset($tarea['evidencias'])) {
                foreach ($tarea['evidencias'] as $evidencia) {
                if($evidencia['tipo'] !== 'application/link'){
                        DB::connection('mysql2')->table('evidencia_tarea')->insert([
                            'tarea' => $id,
                            'evidencia' => $evidencia['ruta'],
                            'nombre' => $evidencia['nombre'],
                            'tipo' => $evidencia['tipo']
                        ]);
                    }
                }
            }

            //consultar evidencias de la tarea
            $evidencias = DB::connection('mysql2')->table('evidencia_tarea')->where('tarea', $id)->get();

            //consuktar tarea

            // Revisión y reapertura llevan su propio aviso (a todos los líderes
            // y con copia por correo); el resto de cambios, el de siempre.
            if (!$aRevision && !$reabre) {
                self::guardarNotificacion($id, 'Estado');
            }
            DB::connection('mysql2')->commit();

            $despues = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->first();
            if ($aRevision && $completaSola) {
                // Nadie más la revisa: no se avisa a líderes ni a administración.
                return $this->respuestaCompletaSola((int) $id, true, $evidencias);
            }
            if ($aRevision) {
                \App\Support\Avisos::enviadaARevision($despues, $usuario->empleado ?? null);
            } elseif ($reabre) {
                \App\Support\Avisos::tareaReabierta($despues, $usuario);
            }
            return response()->json([
                'success' => 'Estado de la tarea actualizado correctamente',
                'evidencias' => $evidencias
            ], 200);
        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Aviso en la campana de lo que pasó con una tarea.
     *
     *  - Si actúa el responsable (crea su tarea, cambia el estado, comenta):
     *    se enteran TODOS sus líderes activos; sin líder, la administración
     *    de seguimiento.
     *  - Si actúa otra persona (líder, supervisor, administración): se entera
     *    el responsable.
     *
     * Antes se decidía por el rol del que actuaba y sólo se miraba el primer
     * líder: un supervisor que asignaba una tarea no avisaba a nadie, con dos
     * líderes uno no se enteraba, y el comentario de un responsable llegaba
     * como «El empleado X (tarea)» sin decir qué había hecho.
     */
    function guardarNotificacion($idTarea, $tipo)
    {
        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $idTarea)->first();
        if (!$tarea) {
            return;
        }
        $actor = DB::connection('mysql2')->table('users')->where('email', Auth::user()->email ?? '')->first();
        if (!$actor) {
            return;
        }

        $actorEmpleado = $actor->empleado ? (int) $actor->empleado : null;
        $responsable = (int) $tarea->empleado;
        $nombreActor = ($actorEmpleado ? \App\Support\Avisos::nombreEmpleado($actorEmpleado) : '') ?: ($actor->name ?? 'Alguien');
        $titulo = $tarea->titulo;

        if ($actorEmpleado !== null && $actorEmpleado === $responsable) {
            $accion = match ($tipo) {
                'Tarea'       => 'creó la tarea',
                'Estado'      => "pasó a «{$tarea->estado}» la tarea",
                'Observacion' => 'escribió una observación en la tarea',
                default       => 'actualizó la tarea',
            };
            $mensaje = "{$nombreActor} {$accion} «{$titulo}».";

            $lideres = \App\Support\Avisos::lideresActivos($responsable, [$responsable]);
            if ($lideres !== []) {
                \App\Support\Avisos::campana($lideres, $actorEmpleado, $mensaje, (int) $idTarea, $tipo);
            } else {
                \App\Support\Avisos::campanaUsuarios(
                    \App\Support\Avisos::administracionDeSeguimiento()->reject(fn ($u) => (int) $u->id === (int) $actor->id),
                    $actorEmpleado, $mensaje, (int) $idTarea, $tipo
                );
            }
            return;
        }

        $accion = match ($tipo) {
            'Tarea'        => 'te asignó la tarea',
            'Estado'       => "pasó a «{$tarea->estado}» tu tarea",
            'Aprobada'     => (int) $tarea->aprobada === 1 ? 'aprobó la tarea' : 'marcó como no aprobada la tarea',
            'Rechazada'    => 'rechazó la tarea',
            'VistoBueno'   => 'dio el visto bueno a la tarea',
            'Observacion'  => 'dejó observaciones en tu tarea',
            'Reprogramada' => 'reprogramó tu tarea',
            default        => 'actualizó tu tarea',
        };
        \App\Support\Avisos::campana([$responsable], $actorEmpleado, "{$nombreActor} {$accion} «{$titulo}».", (int) $idTarea, $tipo);
    }

    function enviarNotificacion($notif)
    {
        $notificacion = DB::connection('mysql2')->table('notif_generales')->where('id', $notif)->first();
        $usuario = DB::connection('mysql2')->table('users')->where('id', $notificacion->id_receptor)->first();
        $usuarioReceptor = DB::connection('mysql2')->table('users')->where('id', $notificacion->id_receptor)->first();

        $notificacion = [
            'name' => $usuarioReceptor->name,
            'message' => $notificacion->mensaje,
            'tipo' => $notificacion->tipo,
            'emisor' => 'Lider'
        ];

        $email = $usuario->email;

        Mail::to($email)->send(new NotificacionMailable($notificacion));
        return response()->json(['success' => 'Notificación enviada correctamente'], 200);
    }

    /**
     * Tendencia semanal del dashboard (ver TendenciaSemanal), con el mismo
     * alcance que las tarjetas: administración ve toda la organización y los
     * demás, su equipo. Se puede acotar a un área por su nombre, que es lo
     * que el filtro del dashboard conoce.
     */
    function tendenciaDashboard(Request $request)
    {
        $datos = $request->validate([
            'departamento' => 'nullable|string|max:200',
            'semanas'      => 'nullable|integer|in:12,26,52',
        ]);
        $alcance = AccesoTareas::empleadosAlcanzables();

        if (!empty($datos['departamento'])) {
            $delArea = DB::connection('mysql2')->table('empleados as e')
                ->join('departamentos as d', 'e.departamento', '=', 'd.id')
                ->where('d.nombre', $datos['departamento'])
                ->pluck('e.id')->map(fn ($i) => (int) $i)->all();
            $alcance = $alcance === null ? $delArea : array_values(array_intersect($alcance, $delArea));
        }

        return response()->json(\App\Support\TendenciaSemanal::calcular($alcance, null, (int) ($datos['semanas'] ?? 26)));
    }

    /**
     * Personas del dashboard con sus indicadores.
     *
     *  - ?ligero=1: lo que necesitan las tarjetas, sin el detalle de cada
     *    tarea (evidencias, observaciones, subtareas) ni las fotos en base64.
     *    Antes el dashboard bajaba todo el historial de toda la organización y
     *    lo volvía a bajar entero tras cada cambio.
     *  - ?empleado=ID: una sola persona con todo el detalle, al abrir sus tareas.
     *  - sin parámetros: todo, como antes (lo usan otras pantallas y pruebas).
     */
    function cargarEmpleadosTareas(Request $request)
    {
        // Administración ve a toda la organización; los demás, a su equipo.
        $alcance = AccesoTareas::empleadosAlcanzables();
        $ligero = $request->boolean('ligero');
        $soloUno = $request->filled('empleado') ? (int) $request->query('empleado') : null;
        if ($soloUno !== null && $alcance !== null && !in_array($soloUno, $alcance, true)) {
            return response()->json(['error' => 'No puedes ver las tareas de esta persona.'], 403);
        }

        $empleados = DB::connection('mysql2')->table('empleados')
            ->where('estado_registro', 'Activo')
            ->where('empleados.estado', 'Activo')
            ->when($alcance !== null, fn ($q) => $q->whereIn('empleados.id', $alcance ?: [0]))
            ->when($soloUno !== null, fn ($q) => $q->where('empleados.id', $soloUno))
            ->leftJoin("cargos", "empleados.cargo", "cargos.id")
            ->leftJoin("departamentos", "empleados.departamento", "departamentos.id")
            ->leftJoin("empresas", "empleados.empresa", "empresas.id")
            ->select("empleados.*", "cargos.nombre as cargo", "departamentos.nombre as departamento", "empresas.nombre as empresa")
            ->get()
            ->unique('id')
            ->values();

        $empleadosData = [];
        // Un solo «hoy», en hora de Bogotá, para todas las personas.
        $hoyIndice = \App\Support\IndiceDesempeno::hoy();

        // Último movimiento en el historial de las tareas de cada persona
        // (cambios de estado, comentarios, aprobaciones…), en una consulta.
        // Los recordatorios automáticos de atraso no cuentan: llegan solos
        // aunque nadie toque nada.
        $ultimosEventos = DB::connection('mysql2')->table('notif_generales as n')
            ->join('tareas_empleados as te', 'n.tarea_id', '=', 'te.id')
            ->whereIn('te.empleado', $empleados->pluck('id'))
            ->where(fn ($q) => $q->whereNull('n.tipo')->orWhereNotIn('n.tipo', \App\Support\IndiceDesempeno::EVENTOS_SIN_ACTIVIDAD))
            ->groupBy('te.empleado')
            ->selectRaw('te.empleado, MAX(n.fecha_creacion) as ultimo')
            ->pluck('ultimo', 'empleado');

        // En modo ligero, tareas y funciones de todos en dos consultas en vez
        // de dos por persona.
        if ($ligero) {
            $tareasDeTodos = DB::connection('mysql2')->table('tareas_empleados')
                ->whereIn('empleado', $empleados->pluck('id'))
                ->where('estado_reg', 'Activo')
                ->select('id', 'empleado', 'titulo', 'estado', 'fecha_creacion', 'fecha_pactada', 'fecha_entregada',
                    'fecha_aprobacion', 'fecha_reprogramacion', 'fecha_verificacion', 'archivar', 'pausada', 'rechazada')
                ->selectRaw(CriteriosAceptacionController::sqlConteo('tareas_empleados') . ' as n_criterios')
                ->get()->groupBy('empleado');
            $funcionesDeTodos = DB::connection('mysql2')->table('funciones_empleado')
                ->whereIn('empleado', $empleados->pluck('id'))
                ->where('estado', 'Activo')
                ->get()->groupBy('empleado');
        }

        foreach ($empleados as $empleado) {
            // Obtener las tareas asignadas al empleado
            $tareas = $ligero ? collect($tareasDeTodos[$empleado->id] ?? []) : DB::connection('mysql2')->table('tareas_empleados')
                ->leftJoin('proyectos', 'tareas_empleados.proyecto_id', '=', 'proyectos.id')
                ->select('tareas_empleados.*', 'proyectos.nombre as proyecto_nombre')
                ->selectRaw(CriteriosAceptacionController::sqlConteo('tareas_empleados') . ' as n_criterios')
                ->where('empleado', $empleado->id)
                ->where('estado_reg', 'Activo')
                ->get();

            // Obtener las funciones del empleado
            $funciones = $ligero ? collect($funcionesDeTodos[$empleado->id] ?? [])->values() : DB::connection('mysql2')->table('funciones_empleado')
                ->where('empleado', $empleado->id)
                ->where('estado', 'Activo')
                ->get();

            // Contar las tareas según su estado
            $tareasCompletadas = $tareas->where('estado', 'Completada')->count();
            $tareasPendientes = $tareas->where('estado', 'Pendiente')->count();
            $tareasEnProceso = $tareas->where('estado', 'En Proceso')->count();

            // Índice, vencidas y última actividad: calculados aquí, con el mismo
            // criterio que el tablero de equipo (ver IndiceDesempeno).
            $indicadores = \App\Support\IndiceDesempeno::calcular($tareas, $hoyIndice, $ultimosEventos[$empleado->id] ?? null);
            $tareasAtrasadas = $indicadores['vencidas'];

            // El detalle de cada tarea sólo hace falta al abrir a la persona.
            if (!$ligero) {
                //agregar evidencias a las tareas
                $evidencias = DB::connection('mysql2')->table('evidencia_tarea')->whereIn('tarea', $tareas->pluck('id'))->get();
                $tareas = $tareas->map(function ($tarea) use ($evidencias) {
                    $tarea->evidencias = $evidencias->where('tarea', $tarea->id)->values();
                    return $tarea;
                });

                //cargar observaciones de las tareas
                $observaciones = DB::connection('mysql2')->table('observaciones_tareas')
                    ->join('users', 'observaciones_tareas.creador', 'users.id')
                    ->select('observaciones_tareas.*', 'users.name as creador')
                    ->whereIn('id_tarea', $tareas->pluck('id'))
                    ->orderBy('observaciones_tareas.fecha', 'desc')
                    ->get();

                //agregar observaciones a las tareas
                $tareas = $tareas->map(function ($tarea) use ($observaciones) {
                    $tarea->observaciones = $observaciones->where('id_tarea', $tarea->id)->values();
                    return $tarea;
                });

                // Agregar conteos de subtareas
                $subtareasCountsEmp = DB::connection('mysql2')->table('subtareas')
                    ->whereIn('tarea_id', $tareas->pluck('id'))
                    ->select('tarea_id', DB::raw('COUNT(*) as subtareas_total'), DB::raw('SUM(completada) as subtareas_completadas'))
                    ->groupBy('tarea_id')
                    ->get()
                    ->keyBy('tarea_id');

                $tareas = $tareas->map(function ($tarea) use ($subtareasCountsEmp) {
                    $counts = $subtareasCountsEmp->get($tarea->id);
                    $tarea->subtareas_total = $counts ? (int)$counts->subtareas_total : 0;
                    $tarea->subtareas_completadas = $counts ? (int)$counts->subtareas_completadas : 0;
                    return $tarea;
                });

            }

            // Calcular eficiencia y avance
            $totalTareas = $tareas->count();
            $eficiencia = $totalTareas > 0 ? round(($tareasCompletadas / $totalTareas) * 100, 2) : 0;
            $avance = $totalTareas > 0 ? round(($tareasCompletadas / $totalTareas) * 100, 2) : 0;

            //eficiencia operativa
            $inicioMes = date('Y-m-01'); // Primer día del mes actual
            $finMes = date('Y-m-t');     // Último día del mes actual


            $eficienciaOperativa = $ligero ? (object) ['eficiencia' => 0] : DB::connection('mysql2')->table('tareas_empleados')
                ->selectRaw('
                    COUNT(*) as total_completadas,
                    SUM(CASE WHEN fecha_entregada <= fecha_pactada THEN 1 ELSE 0 END) as completadas_a_tiempo,
                    ROUND(SUM(CASE WHEN fecha_entregada <= fecha_pactada THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as eficiencia
                ')
                ->where('estado', 'Completada')
                ->where('estado_reg', 'Activo')
                ->where('empleado', $empleado->id)
                ->whereBetween('fecha_entregada', [$inicioMes, $finMes])
                ->first();

            if ($eficienciaOperativa->eficiencia > 0) {
                $eficienciaOperativa = $eficienciaOperativa->eficiencia ?? 0;
            } else {
                $eficienciaOperativa = 0;
            }


            // Obtener últimas 3 tareas
            // Con su fecha: sin ella, tres tareas de hace medio año parecían
            // actividad de esta semana.
            $tareasRecientes = $tareas->sortByDesc(fn ($t) => [$t->fecha_creacion, $t->id])->take(3)->map(function ($tarea) {
                return [
                    'id' => $tarea->id,
                    'titulo' => $tarea->titulo,
                    'estado' => $tarea->estado,
                    'fecha_creacion' => $tarea->fecha_creacion,
                ];
            })->values();

            // Construir estructura
            $empleadosData[] = [
                'id' => $empleado->id,
                'nombre' => $empleado->nombres . ' ' . $empleado->apellidos,
                'cargo' => $empleado->cargo,
                'departamento' => $empleado->departamento,
                'empresa' => $empleado->empresa,
                'contacto' => [
                    'email' => $empleado->email,
                    'telefono' => $empleado->telefono
                ],
                // En ligero las fotos llegan aparte (AvataresProvider): son base64.
                'foto' => $ligero ? null : $empleado->foto,
                'tareas' => $ligero ? [] : $tareas,
                'detalle' => !$ligero,
                'funciones' => $funciones,
                'rendimiento' => [
                    'tareasAsignadas' => $totalTareas,
                    'tareas' => [
                        'completadas' => $tareasCompletadas,
                        'pendientes' => $tareasPendientes,
                        'enProceso' => $tareasEnProceso,
                        'atrasadas' => $tareasAtrasadas
                    ],
                    'tiempoPromedioTarea' => '2.5 días', // Esto podrías calcularlo según la BD
                    'eficiencia' => $eficiencia,
                    'eficienciaOperativa' => $eficienciaOperativa,
                    'ultimaActividad' => $indicadores['ultima_actividad'],
                ],
                'indicadores' => $indicadores,
                'avance' => $avance,
                'tareasRecientes' => $tareasRecientes
            ];
        }

        return response()->json($empleadosData);
    }

    function eliminarEvidencia($id)
    {
        $evidencia = DB::connection('mysql2')->table('evidencia_tarea')->where('id', $id)->first();
        if (!$evidencia) {
            return response()->json(['error' => 'Evidencia no encontrada'], 404);
        }
        $tarea = AccesoTareas::exigir($evidencia->tarea, 'modificar');
        if (AccesoTareas::esRespuesta($tarea)) {
            return $tarea;
        }
        // Lo entregado y aceptado queda como constancia.
        if ($tarea->estado === 'Completada') {
            return response()->json(['error' => 'La tarea ya fue aceptada: sus evidencias no se pueden eliminar.'], 409);
        }

        DB::connection('mysql2')->table('evidencia_tarea')->where('id', $id)->delete();
        return response()->json(['success' => 'Evidencia eliminada correctamente'], 200);
    }

    function cargarTareaSeleccionada($id)
    {
        $tarea = AccesoTareas::exigir($id);
        if (AccesoTareas::esRespuesta($tarea)) {
            return $tarea;
        }

        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->first();

        //obtener observaciones de las tareas
        $observaciones = DB::connection('mysql2')->table('observaciones_tareas')
            ->join('users', 'observaciones_tareas.creador', 'users.id')
            ->select('observaciones_tareas.*', 'users.name as creador')
            ->where('id_tarea', $tarea->id)
            ->orderBy('observaciones_tareas.fecha', 'desc')
            ->get();

        // Agregar observaciones a las tareas
        $tarea->observaciones = $observaciones;



        $evidencias = DB::connection('mysql2')->table('evidencia_tarea')->where('tarea', $id)->get();

        $tarea->evidencias = $evidencias;

        return response()->json($tarea);
    }

    function cambiarEstadoNotificacion(Request $request, $id)
    {
        // Solo las propias: antes cualquiera marcaba como leída la de otro.
        $yo = AccesoTareas::usuario();
        $propia = $yo && DB::connection('mysql2')->table('notif_generales')
            ->where('id', $id)->where('id_receptor', $yo->id)->exists();
        if (!$propia) {
            return response()->json(['error' => 'Notificación no encontrada'], 404);
        }

        DB::connection('mysql2')->table('notif_generales')->where('id', $id)->update(['leido' => 1]);
        return response()->json(['success' => 'Notificación actualizada correctamente'], 200);
    }

    function realizarObservaciones(Request $request, $id)
    {
        $tarea = AccesoTareas::exigir($id, 'modificar');
        if (AccesoTareas::esRespuesta($tarea)) {
            return $tarea;
        }

        $data = $request->validate(['observaciones' => 'required|string|max:5000'], [
            'observaciones.required' => 'Escribe el comentario.',
        ]);
        // Sólo espacios tampoco es un comentario.
        if (trim($data['observaciones']) === '') {
            return response()->json(['message' => 'Escribe el comentario.', 'errors' => ['observaciones' => ['Escribe el comentario.']]], 422);
        }
        $usuarioActual = DB::connection('mysql2')->table('users')->where('email', Auth::user()->email)->first();
        $observaciones = DB::connection('mysql2')->table('observaciones_tareas')->insert([
            'id_tarea' => $id,
            'observaciones' => trim($data['observaciones']),
            'fecha' => now(),
            'creador' => $usuarioActual->id
        ]);

        self::guardarNotificacion($id, 'Observacion');

        return response()->json(['success' => 'Observaciones realizadas correctamente'], 200);
    }




    function cargarUsuarios()
    {
        // Se listan activos e inactivos: un usuario desactivado tiene que
        // seguir a la vista para poder reactivarlo. El login ya le niega el
        // acceso por su estado.
        $usuarios = DB::connection('mysql2')->table('users')
            ->leftJoin('empleados', 'users.empleado', '=', 'empleados.id') // 🔹 LEFT JOIN para incluir admins
            ->select([
                ...$this->columnasUsuario(),
                DB::connection('mysql2')->raw('IFNULL(CONCAT(empleados.nombres, " ", empleados.apellidos), "---") as nombre_empleado'),
            ])
            ->orderByRaw("users.estado = 'Inactivo'")
            ->orderBy('users.name')
            ->get();

        return response()->json($usuarios);
    }

    function buscarUsuarios(Request $request)
    {
        $searchTerm = $request->input('search');
        $usuarios = DB::connection('mysql2')->table('users')
            ->leftJoin('empleados', 'users.empleado', 'empleados.id')
            ->select([
                ...$this->columnasUsuario(),
                DB::connection('mysql2')->raw('IFNULL(CONCAT(empleados.nombres, " ", empleados.apellidos), "---") as nombre_empleado'),
            ])
            ->where(function ($query) use ($searchTerm) {
                $query->where('users.name', 'like', '%' . $searchTerm . '%')
                    ->orWhere('users.email', 'like', '%' . $searchTerm . '%')
                    ->orWhere('empleados.nombres', 'like', '%' . $searchTerm . '%')
                    ->orWhere('empleados.apellidos', 'like', '%' . $searchTerm . '%');
            })
            ->get();
        return response()->json($usuarios);
    }

    function listaEmpleados()
    {
        $empleados = DB::connection('mysql2')->table('empleados')
            ->where('estado_registro', 'Activo')
            ->select(
                'id',
                DB::connection('mysql2')->raw('CONCAT(nombres, " ", apellidos) as nombre')
            )
            ->get();
        return response()->json($empleados);
    }



    /** Roles que existen. Cualquier otro valor se rechaza. */
    private const ROLES_USUARIO = ['Administrador', 'Supervisor', 'Empleado'];

    /**
     * Crear o editar un usuario desde Parámetros › Usuarios.
     *
     * Solo administración. Además, solo un Administrador crea administradores
     * o toca la cuenta de uno: si no, un Supervisor podría ascenderse.
     */
    function guardarUsuario(Request $request)
    {
        $yo = $this->usuarioAutenticado();
        if (!$this->puedeAdministrar()) {
            return response()->json(['error' => 'No tienes permiso para gestionar usuarios.'], 403);
        }
        $soyAdmin = $yo->tipo_usuario === 'Administrador';

        $accion = $request->input('accion');
        if (!in_array($accion, ['guardar', 'editar'], true)) {
            return response()->json(['errors' => ['accion' => ['Acción no válida.']]], 422);
        }

        $actual = null;
        if ($accion === 'editar') {
            $actual = DB::connection('mysql2')->table('users')->where('id', $request->input('id'))->first();
            if (!$actual) {
                return response()->json(['error' => 'Usuario no encontrado'], 404);
            }
        }

        $datos = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => ['required', 'email', 'max:255', Rule::unique('mysql2.users', 'email')->ignore($actual->id ?? null)],
            'role'     => ['required', Rule::in(self::ROLES_USUARIO)],
            'estado'   => ['nullable', Rule::in(['Activo', 'Inactivo'])],
            // Una ficha, una cuenta: el chat, la presencia del plano y los
            // avisos van por la ficha, y con dos cuentas no se sabría a cuál.
            // También vale para administración, que la vincula para chatear y
            // convocar reuniones con su nombre.
            'empleado' => ['nullable', 'integer', 'exists:mysql2.empleados,id',
                Rule::unique('mysql2.users', 'empleado')->ignore($actual->id ?? null)],
        ], [
            'name.required'   => 'Escribe el nombre del usuario.',
            'email.required'  => 'Escribe el correo del usuario.',
            'email.email'     => 'El correo no es válido.',
            'email.unique'    => 'Ese correo ya lo usa otro usuario.',
            'role.required'   => 'Elige el rol del usuario.',
            'role.in'         => 'El rol no es válido.',
            'estado.in'       => 'El estado no es válido.',
            'empleado.exists' => 'El empleado elegido no existe.',
            'empleado.unique' => 'Esa ficha de empleado ya está vinculada a otro usuario. Si es la misma persona, cambia el rol de esa cuenta en vez de crear otra.',
        ]);

        if (!$soyAdmin && ($datos['role'] === 'Administrador' || ($actual && $actual->tipo_usuario === 'Administrador'))) {
            return response()->json(['error' => 'Solo un administrador puede crear administradores o modificar su cuenta.'], 403);
        }

        $estado = $datos['estado'] ?? 'Activo';
        if ($actual && $actual->tipo_usuario === 'Administrador'
            && ($datos['role'] !== 'Administrador' || $estado !== 'Activo')
            && $this->otrosAdministradoresActivos($actual->id) === 0) {
            return response()->json(['error' => 'Es el único administrador activo. Crea o activa otro antes de cambiarle el rol o desactivarlo.'], 422);
        }

        $cambiarPassword = $accion === 'guardar' || filter_var($request->input('cambiar_password', false), FILTER_VALIDATE_BOOLEAN);
        if ($cambiarPassword) {
            if (mb_strlen((string) $request->input('password', '')) < 6) {
                return response()->json(['error' => 'La contraseña debe tener al menos 6 caracteres.'], 422);
            }
            if ((string) $request->input('password') !== (string) $request->input('password_confirmation')) {
                return response()->json(['error' => 'Las contraseñas no coinciden.'], 422);
            }
        }

        // «Líder de seguimiento» elige a qué administrador le llegan los avisos
        // de los líderes; en otros roles no se usa. Que alguien sea líder se
        // decide en su ficha de empleado y en Departamentos, no aquí.
        $liderSeguimiento = $datos['role'] === 'Administrador' && $request->input('lider_seguimiento') === 'Si' ? 'Si' : 'No';

        $fila = [
            'name' => $datos['name'],
            'email' => $datos['email'],
            'tipo_usuario' => $datos['role'],
            'empleado' => $datos['empleado'] ?? null,
            'estado' => $estado,
            'foto' => $this->procesarFoto($request->input('foto')),
            'lider_seguimiento' => $liderSeguimiento,
        ];
        $filaChat = ['name' => $datos['name'], 'email' => $datos['email']];
        if ($cambiarPassword) {
            $hash = Hash::make($request->input('password'));
            $fila['password'] = $hash;
            $filaChat['password'] = $hash;
        }

        // El chat corporativo tiene su propia copia del usuario y es contra la
        // que se inicia sesión: si no se puede escribir allí, no se guarda nada.
        $base = DB::connection('mysql2');
        $base->beginTransaction();
        try {
            if ($accion === 'guardar') {
                $usuarioId = $base->table('users')->insertGetId($fila);
                DB::connection('mysql')->table('users')->insert($filaChat + [
                    'avatar' => 'otro.png',
                    'id_usuario_tarea' => $usuarioId,
                ]);
            } else {
                $base->table('users')->where('id', $actual->id)->update($fila);
                DB::connection('mysql')->table('users')->where('id_usuario_tarea', $actual->id)->update($filaChat);
            }
            $base->commit();
        } catch (\Throwable $e) {
            $base->rollBack();
            Log::error('Usuarios: no se pudo guardar el usuario. ' . $e->getMessage());

            return response()->json(['error' => 'No se pudo guardar el usuario. Inténtalo de nuevo.'], 500);
        }

        return response()->json(['success' => 'Usuario guardado correctamente'], 200);
    }

    /**
     * Reglas para tocar la cuenta de un Administrador: solo otro Administrador
     * lo hace (un Supervisor no puede dejar fuera a quien está por encima) y
     * nunca se deja el sistema sin un Administrador activo.
     */
    private function proteccionAdministrador(object $usuario, bool $loDejaFuera): ?\Illuminate\Http\JsonResponse
    {
        if ($usuario->tipo_usuario !== 'Administrador') {
            return null;
        }
        if (($this->usuarioAutenticado()->tipo_usuario ?? null) !== 'Administrador') {
            return response()->json(['error' => 'Solo un administrador puede modificar la cuenta de otro administrador.'], 403);
        }
        if ($loDejaFuera && $this->otrosAdministradoresActivos($usuario->id) === 0) {
            return response()->json(['error' => 'Es el único administrador activo. Crea o activa otro antes de desactivarlo.'], 422);
        }

        return null;
    }

    /** Administradores activos distintos del usuario dado. */
    private function otrosAdministradoresActivos(int $excepto): int
    {
        return DB::connection('mysql2')->table('users')
            ->where('tipo_usuario', 'Administrador')
            ->where('estado', 'Activo')
            ->where('id', '<>', $excepto)
            ->count();
    }

    /** Activa o desactiva un usuario. Desactivado no entra, pero sigue en la lista. */
    function cambiarEstadoUsuario(Request $request, $id)
    {
        if (!$this->puedeAdministrar()) {
            return response()->json(['error' => 'No tienes permiso para gestionar usuarios.'], 403);
        }
        $datos = $request->validate(['estado' => 'required|in:Activo,Inactivo']);

        $usuario = DB::connection('mysql2')->table('users')->where('id', $id)->first();
        if (!$usuario) {
            return response()->json(['error' => 'Usuario no encontrado'], 404);
        }
        if ($datos['estado'] === 'Inactivo' && (int) $usuario->id === (int) ($this->usuarioAutenticado()->id ?? 0)) {
            return response()->json(['error' => 'No puedes desactivar tu propio usuario.'], 422);
        }
        if ($error = $this->proteccionAdministrador($usuario, $datos['estado'] === 'Inactivo')) {
            return $error;
        }

        DB::connection('mysql2')->table('users')->where('id', $id)->update(['estado' => $datos['estado']]);
        return response()->json(['estado' => $datos['estado']]);
    }

    function eliminarUsuario($id)
    {
        // Baja lógica en lugar de borrado físico. Un usuario eliminado deja
        // referencias vivas en tareas, asignaciones de líder y notificaciones:
        // al desaparecer la fila, esas referencias quedaban huérfanas y las
        // consultas que unen por INNER JOIN dejaban de ver el trabajo asociado.
        // Marcarlo inactivo conserva la trazabilidad y permite seguir mostrando
        // el nombre de quien realizó cada tarea.
        $usuario = DB::connection('mysql2')->table('users')->where('id', $id)->first();
        if (!$usuario) {
            return response()->json(['error' => 'Usuario no encontrado'], 404);
        }
        if ((int) $usuario->id === (int) ($this->usuarioAutenticado()->id ?? 0)) {
            return response()->json(['error' => 'No puedes darte de baja a ti mismo.'], 422);
        }
        if ($error = $this->proteccionAdministrador($usuario, true)) {
            return $error;
        }

        DB::connection('mysql2')->table('users')->where('id', $id)->update([
            'estado' => 'Inactivo',
        ]);

        // La tabla del chat corporativo (conexión mysql) no tiene columna de
        // estado, así que no admite baja lógica. Su registro se conserva: el
        // acceso a Work-Board lo decide 'users.estado' de mysql2, que es la
        // tabla contra la que se autentica.

        return response()->json(['success' => 'Usuario inactivado correctamente'], 200);
    }

    function buscarEmpresas(Request $request)
    {
        // El modal envía «term»; se acepta también «search» por compatibilidad.
        // Antes sólo se leía «search» y la búsqueda devolvía todas.
        $searchTerm = $request->input('term', $request->input('search'));
        $empresas = DB::connection('mysql2')->table('empresas')
            ->where('nombre', 'like', '%' . $searchTerm . '%')
            ->where('estado', 'Activo')
            ->get();
        return response()->json($empresas);
    }

    function guardarEmpresa(Request $request)
    {
        if ($request->input('accion') === 'editar'
            && !DB::connection('mysql2')->table('empresas')->where('id', (int) $request->input('id'))->exists()) {
            return response()->json(['error' => 'Empresa no encontrada.'], 404);
        }
        $validos = $this->validarParametro($request, [
            'accion'        => 'required|in:guardar,editar',
            'nombre'        => 'required|string|max:150',
            'direccion'     => 'nullable|string|max:200',
            'telefono'      => 'nullable|string|max:30',
            'representante' => 'nullable|string|max:150',
            'nit'           => 'nullable|string|max:30',
        ], [
            'nombre.required' => 'El nombre de la empresa es obligatorio.',
        ]);
        if ($validos instanceof \Illuminate\Http\JsonResponse) {
            return $validos;
        }
        $compania = $request->all();
        foreach (['direccion', 'telefono', 'representante', 'nit', 'logo'] as $campo) {
            $compania[$campo] = $compania[$campo] ?? null;
        }

        DB::connection('mysql2')->beginTransaction();
        try {
            if ($compania['accion'] == 'guardar') {
                $empresa = DB::connection('mysql2')->table('empresas')->insert([
                    'nombre' => $compania['nombre'],
                    'direccion' => $compania['direccion'],
                    'telefono' => $compania['telefono'],
                    'representante' => $compania['representante'],
                    'nit' => $compania['nit'],
                    'logo' => $compania['logo'],
                    'estado' => 'ACTIVO'
                ]);

                if (!$empresa) {
                    throw new \Exception('Error al guardar la empresa');
                }
            } else {
                $empresa = DB::connection('mysql2')->table('empresas')->where('id', $compania['id'])->update([
                    'nombre' => $compania['nombre'],
                    'direccion' => $compania['direccion'],
                    'telefono' => $compania['telefono'],
                    'representante' => $compania['representante'],
                    'nit' => $compania['nit'],
                    'logo' => $compania['logo']
                ]);

                if ($empresa === false) {
                    throw new \Exception('Error al actualizar la empresa');
                }
            }

            DB::connection('mysql2')->commit();
            return response()->json(['success' => 'Empresa guardada correctamente'], 200);
        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            return $this->errorAlGuardar($e, 'la empresa');
        }
    }

    function eliminarEmpresa($id)
    {
        if (!DB::connection('mysql2')->table('empresas')->where('id', $id)->where('estado', '<>', 'ELIMINADO')->exists()) {
            return response()->json(['error' => 'Empresa no encontrada.'], 404);
        }
        $empresa = DB::connection('mysql2')->table('empresas')->where('id', $id)->update([
            'estado' => 'ELIMINADO'
        ]);
        return response()->json(['success' => 'Empresa eliminada correctamente'], 200);
    }

    function cargarLideres()
    {
        $lideres = DB::connection('mysql2')->table('empleados')
            ->join('empresas', 'empleados.empresa', '=', 'empresas.id')
            ->join('departamentos as dept_propio', 'empleados.departamento', '=', 'dept_propio.id')
            ->join('cargos', 'empleados.cargo', '=', 'cargos.id')
            // solo empleados que son lider_id de algún departamento
            ->whereExists(function ($q) {
                $q->select(DB::raw(1))
                  ->from('departamentos')
                  ->whereColumn('departamentos.lider_id', 'empleados.id');
            })
            ->select([
                ...$this->columnasEmpleado(),
                'empresas.nombre as nombre_empresa',
                'dept_propio.nombre as nombre_departamento',
                'cargos.nombre as nombre_cargo',
                DB::connection('mysql2')->raw('(SELECT COUNT(*) FROM lideres_empleados WHERE lider = empleados.id) as empleados_asignados'),
            ])
            ->where('empleados.estado_registro', 'Activo')
            ->get();
        return response()->json($lideres);
    }

    function cargarEmpleadosLider($id)
    {
        $empleados = DB::connection('mysql2')->table('lideres_empleados')
            ->join('empleados', 'lideres_empleados.empleado', '=', 'empleados.id')
            ->select([...$this->columnasEmpleado(), 'lideres_empleados.lider'])
            ->where('lideres_empleados.lider', $id)
            ->where('empleados.estado_registro', 'Activo')
            ->get();
        return response()->json($empleados);
    }

    function guardarAsignacionesLider(Request $request)
    {
        $empleadoActivo = Rule::exists('mysql2.empleados', 'id')->where('estado_registro', 'Activo');
        $datos = $request->validate([
            'lider_id'       => ['required', 'integer', $empleadoActivo],
            'empleados'      => 'present|array',
            'empleados.*.id' => ['required', 'integer', 'distinct', $empleadoActivo, 'different:lider_id'],
        ], [
            'lider_id.required'        => 'Elige el líder.',
            'lider_id.exists'          => 'El líder elegido no existe o ya no está activo.',
            'empleados.present'        => 'Falta la lista de empleados.',
            'empleados.*.id.exists'    => 'Uno de los empleados no existe o ya no está activo.',
            'empleados.*.id.distinct'  => 'Hay un empleado repetido en la lista.',
            'empleados.*.id.different' => 'Un líder no puede ser su propio líder.',
        ]);

        // Se borra el equipo anterior y se guarda el nuevo de una vez: si algo
        // falla a mitad, el líder no se queda sin equipo.
        DB::connection('mysql2')->transaction(function () use ($datos) {
            $base = DB::connection('mysql2')->table('lideres_empleados');
            $base->where('lider', $datos['lider_id'])->delete();
            foreach ($datos['empleados'] as $empleado) {
                DB::connection('mysql2')->table('lideres_empleados')->insert([
                    'lider' => $datos['lider_id'],
                    'empleado' => $empleado['id'],
                ]);
            }
        });

        return response()->json(['success' => 'Asignaciones guardadas correctamente'], 200);
    }

    /**
     * Base común de los informes de tareas: tareas vivas (estado_reg Activo)
     * sin archivar, dentro del alcance de quien consulta, con la ficha del
     * responsable aunque esté inactivo, su cargo y su departamento.
     */
    private function baseInformeTareas(?array $alcance)
    {
        return DB::connection('mysql2')->table('tareas_empleados')
            ->leftJoin('empleados', 'tareas_empleados.empleado', '=', 'empleados.id')
            ->leftJoinSub($this->usuarioPorEmpleado(), 'users', 'tareas_empleados.empleado', '=', 'users.empleado')
            ->leftJoin('departamentos', 'empleados.departamento', '=', 'departamentos.id')
            ->leftJoin('cargos', 'empleados.cargo', '=', 'cargos.id')
            ->where('tareas_empleados.estado_reg', 'Activo')
            ->whereRaw('COALESCE(tareas_empleados.archivar, 0) <> 1')
            ->when($alcance !== null, function ($q) use ($alcance) {
                $q->whereIn('tareas_empleados.empleado', $alcance);
            });
    }

    /** Nombre del responsable: su ficha, si no su usuario, si no «Sin responsable». */
    private function sqlNombreResponsable(): string
    {
        return 'COALESCE(NULLIF(TRIM(CONCAT(COALESCE(empleados.nombres, ""), " ", COALESCE(empleados.apellidos, ""))), ""), users.name, "Sin responsable")';
    }

    private function sqlResponsableActivo(): string
    {
        return '(CASE WHEN empleados.estado = "Activo" AND empleados.estado_registro = "Activo" THEN 1 ELSE 0 END)';
    }

    /** Marca cada fila con vencida, en_pausa, a_tiempo y fechas válidas. */
    private function marcarFilasInforme($filas)
    {
        $hoy = IndiceDesempeno::hoy();

        return $filas->map(function ($t) use ($hoy) {
            $t = IndiceDesempeno::marcarParaInforme($t, $hoy);
            if (property_exists($t, 'empleado_id')) {
                $t->empleado_id = $t->empleado_id ? (int) $t->empleado_id : null;
            }
            if (property_exists($t, 'empleado_activo')) {
                $t->empleado_activo = (int) $t->empleado_activo === 1;
            }
            return $t;
        })->values();
    }

    function informeTareas()
    {
        $alcance = $this->alcanceEmpleadosInformes();

        // Los joins con empleados y sus tablas asociadas son LEFT: hay tareas
        // activas cuyo empleado ya no figura en 'empleados' —personas dadas de
        // baja cuyo registro se eliminó— y con INNER JOIN quedaban fuera del
        // informe sin dejar rastro. El trabajo realizado sigue contando aunque
        // su responsable haya salido; el nombre se recupera de 'users'.
        //
        // Reglas comunes de los informes (baseInformeTareas):
        //  - Todas las tareas vivas, tengan o no visto bueno: antes sólo las
        //    aprobadas, y una tarea vencida sin visto bueno no salía en ninguno.
        //  - Sin archivadas: ya no son trabajo pendiente ni entregado.
        //  - La ficha se une aunque la persona esté inactiva: su trabajo sigue
        //    siendo de su área (antes caía en «Sin departamento» o se perdía).
        //  - empleado_id viaja aparte: agrupar por nombre sumaba homónimos.
        //  - vencida, en_pausa, a_tiempo y las fechas salen de IndiceDesempeno,
        //    la misma regla que el dashboard, en hora de Bogotá.
        $tareas = $this->baseInformeTareas($alcance)
            ->leftJoin('empresas', 'empleados.empresa', '=', 'empresas.id')
            ->select(
                'tareas_empleados.*',
                'tareas_empleados.empleado as empleado_id',
                DB::connection('mysql2')->raw($this->sqlNombreResponsable() . ' as empleado'),
                DB::connection('mysql2')->raw($this->sqlResponsableActivo() . ' as empleado_activo'),
                'empresas.nombre as empresa',
                'departamentos.nombre as departamento',
                'cargos.nombre as cargo'
            )
            ->get();

        return response()->json($this->marcarFilasInforme($tareas));
    }

    function informeEficiencia()
    {
        $alcance = $this->alcanceEmpleadosInformes();

        // Mismo criterio que informeTareas: con INNER JOIN se perdían las tareas
        // de empleados ya eliminados, lo que falseaba el cálculo de eficiencia al
        // dejar fuera trabajo realmente entregado.
        // Mismas reglas comunes que informeTareas (baseInformeTareas).
        $tareas = $this->baseInformeTareas($alcance)
            ->select(
                'tareas_empleados.id',
                'tareas_empleados.empleado as empleado_id',
                'tareas_empleados.estado',
                'tareas_empleados.archivar',
                'tareas_empleados.fecha_creacion',
                'tareas_empleados.fecha_pactada',
                'tareas_empleados.fecha_entregada',
                'tareas_empleados.rechazada',
                'tareas_empleados.pausada',
                DB::connection('mysql2')->raw($this->sqlNombreResponsable() . ' as nombre_empleado'),
                'cargos.nombre as cargo',
                'departamentos.nombre as departamento'
            )
            // Se ordena por la columna de la tarea y no por empleados.id, que con
            // el LEFT JOIN puede ser NULL y dispersaría las filas de un mismo
            // responsable eliminado.
            ->orderBy('tareas_empleados.empleado')
            ->get();

        return response()->json($this->marcarFilasInforme($tareas));
    }

    function informeProyectos()
    {
        $alcance = $this->alcanceEmpleadosInformes();

        // Proyectos con sus tareas activas.
        // El alcance se aplica dentro del leftJoin (no en el where) para que un
        // proyecto siga apareciendo aunque ninguna de sus tareas sea visible
        // para el usuario; de lo contrario el filtro convertiría el leftJoin en
        // un inner join y descartaría proyectos completos.
        $rows = DB::connection('mysql2')->table('proyectos')
            ->leftJoin('tareas_empleados', function ($join) use ($alcance) {
                $join->on('tareas_empleados.proyecto_id', '=', 'proyectos.id')
                     ->where('tareas_empleados.estado_reg', 'Activo')
                     // Sin archivadas, como el resto de informes.
                     ->whereRaw('COALESCE(tareas_empleados.archivar, 0) <> 1');
                if ($alcance !== null) {
                    $join->whereIn('tareas_empleados.empleado', $alcance);
                }
            })
            // La ficha aunque la persona esté inactiva: su trabajo sigue siendo
            // de su área y con su nombre (antes salía «—»).
            ->leftJoin('empleados', 'tareas_empleados.empleado', '=', 'empleados.id')
            ->leftJoinSub($this->usuarioPorEmpleado(), 'users', 'tareas_empleados.empleado', '=', 'users.empleado')
            ->leftJoin('departamentos', 'empleados.departamento', '=', 'departamentos.id')
            ->select(
                'proyectos.id as proyecto_id',
                'proyectos.nombre as proyecto_nombre',
                'proyectos.estado as proyecto_estado',
                'proyectos.fecha_inicio',
                'proyectos.fecha_fin_estimada',
                'tareas_empleados.id as tarea_id',
                'tareas_empleados.titulo',
                'tareas_empleados.estado',
                'tareas_empleados.fecha_pactada',
                'tareas_empleados.fecha_entregada',
                'tareas_empleados.rechazada',
                'tareas_empleados.pausada',
                'tareas_empleados.empleado as empleado_id',
                DB::connection('mysql2')->raw($this->sqlNombreResponsable() . ' AS nombre_empleado'),
                'departamentos.nombre as departamento'
            )
            ->orderBy('proyectos.nombre')
            ->orderBy('tareas_empleados.id')
            ->get();

        // Agrupar por proyecto
        $hoyInforme = IndiceDesempeno::hoy();
        $proyectos = [];
        foreach ($rows as $row) {
            $pid = $row->proyecto_id;
            if (!isset($proyectos[$pid])) {
                $proyectos[$pid] = [
                    'id'                 => $pid,
                    'nombre'             => $row->proyecto_nombre,
                    'estado'             => $row->proyecto_estado,
                    'fecha_inicio'       => $row->fecha_inicio,
                    'fecha_fin_estimada' => $row->fecha_fin_estimada,
                    'tareas'             => [],
                ];
            }
            if ($row->tarea_id) {
                $t = IndiceDesempeno::marcarParaInforme((object) [
                    'estado'          => $row->estado,
                    'archivar'        => 0,
                    'fecha_pactada'   => $row->fecha_pactada,
                    'fecha_entregada' => $row->fecha_entregada,
                    'pausada'         => $row->pausada,
                ], $hoyInforme);
                $proyectos[$pid]['tareas'][] = [
                    'id'              => $row->tarea_id,
                    'titulo'          => $row->titulo,
                    'estado'          => $row->estado,
                    'fecha_pactada'   => $t->fecha_pactada,
                    'fecha_entregada' => $t->fecha_entregada,
                    'rechazada'       => $row->rechazada,
                    'pausada'         => $row->pausada,
                    'en_pausa'        => $t->en_pausa,
                    'vencida'         => $t->vencida,
                    'dias_vencida'    => $t->dias_vencida,
                    'a_tiempo'        => $t->a_tiempo,
                    'empleado_id'     => $row->empleado_id ? (int) $row->empleado_id : null,
                    'empleado'        => $row->nombre_empleado,
                    'departamento'    => $row->departamento,
                ];
            }
        }

        return response()->json(array_values($proyectos));
    }

    function verificarEmpleadoLider($id)
    {
        $empleado = DB::connection('mysql2')->table('lideres_empleados')->where('empleado', $id)->first();
        if ($empleado) {
            return response()->json(['existe' => true]);
        } else {
            return response()->json(['existe' => false]);
        }
    }

    function eliminarFuncion($id)
    {
        if (!DB::connection('mysql2')->table('funciones_empleado')->where('id', $id)->exists()) {
            return response()->json(['error' => 'Función no encontrada.'], 404);
        }
        $funcion = DB::connection('mysql2')->table('funciones_empleado')->where('id', $id)->delete();
        return response()->json(['success' => 'Funcion eliminada correctamente'], 200);
    }

    function cargarActividades($id)
    {
        $actividades = DB::connection('mysql2')->table('actividades_empleado')->where('empleado', $id)->get();
        return response()->json($actividades);
    }

    function guardarActividad(Request $request)
    {
        $request->validate([
            'empleado'  => 'required|integer|exists:mysql2.empleados,id',
            'actividad' => 'required|string|max:1000',
        ], [
            'actividad.required' => 'Escribe la actividad.',
            'empleado.exists'    => 'El empleado no existe.',
        ]);
        $actividadActual = $request->all();
        $actividad = DB::connection('mysql2')->table('actividades_empleado')->insert([
            'empleado' => $actividadActual['empleado'],
            'descripcion' => $actividadActual['actividad']
        ]);

        $actividad = DB::connection('mysql2')->table('actividades_empleado')
            ->where('empleado', $actividadActual['empleado'])
            ->orderBy('id', 'desc')
            ->first();

        return response()->json(['success' => 'Actividad guardada correctamente', 'actividad' => $actividad], 200);
    }

    function eliminarActividad($id)
    {
        $actividad = DB::connection('mysql2')->table('actividades_empleado')->where('id', $id)->delete();
        return response()->json(['success' => 'Actividad eliminada correctamente'], 200);
    }

    function actualizarActividad($id, Request $request)
    {
        if (!DB::connection('mysql2')->table('actividades_empleado')->where('id', $id)->exists()) {
            return response()->json(['error' => 'Actividad no encontrada.'], 404);
        }
        $request->validate(['descripcion' => 'required|string|max:1000'], [
            'descripcion.required' => 'Escribe la actividad.',
        ]);
        $actividadActual = $request->all();
        $actividad = DB::connection('mysql2')->table('actividades_empleado')->where('id', $id)->update([
            'descripcion' => $actividadActual['descripcion']
        ]);

        return response()->json(['success' => 'Actividad actualizada correctamente'], 200);
    }

    function vistoBueno(Request $request, $id)
    {
        $data = $request->validate(['visto_bueno' => 'required|boolean']);

        $tarea = $this->exigirSupervisor($id);
        if ($tarea instanceof \Illuminate\Http\JsonResponse) {
            return $tarea;
        }

        try {
            DB::connection('mysql2')->table('tareas_empleados')
                ->where('id', $id)
                ->update([
                    'visto_bueno' => (int) $data['visto_bueno'],
                    'rechazada' => '0'
                ]);

            self::guardarNotificacion($id, 'VistoBueno');

            return response()->json(['success' => 'Visto bueno actualizado correctamente'], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    function rechazarTarea($id, Request $request)
    {
        $data = $request->validate(['rechazada' => 'required|boolean']);

        $tarea = $this->exigirSupervisor($id);
        if ($tarea instanceof \Illuminate\Http\JsonResponse) {
            return $tarea;
        }

        $rechazada = (bool) $data['rechazada'];

        // De «En Revisión» sólo se sale aceptando la entrega o devolviéndola
        // (devolver exige decir qué corregir y deja constancia). Rechazar era
        // una tercera salida sin observación ni registro.
        if ($rechazada && $tarea->estado === self::EN_REVISION) {
            return response()->json([
                'error' => 'La tarea está en revisión: acéptala o devuélvela indicando qué corregir.',
            ], 409);
        }

        // Retirar un rechazo devuelve la tarea a Completada. Eso saltaría la
        // revisión: si la tarea no estaba ya cerrada, sólo se cierra
        // aceptando la entrega. Vale para todas, tengan criterios o no.
        if (!$rechazada && $tarea->estado !== 'Completada') {
            return response()->json([
                'error' => 'La tarea se cierra aceptando la entrega en revisión, no retirando el rechazo.',
                'requiere_verificacion' => true,
            ], 409);
        }

        DB::connection('mysql2')->beginTransaction();
        try {
            DB::connection('mysql2')->table('tareas_empleados')
                ->where('id', $id)
                ->update([
                    'rechazada' => (int) $rechazada,
                    'visto_bueno' => '0',
                    'estado' => $rechazada ? 'En Proceso' : 'Completada',
                ] + ($rechazada ? ['fecha_entregada' => null, 'criterio_cumplido' => 0] : []));

            // Rechazar una tarea ya aceptada la reabre: queda constancia junto
            // a la aceptación, que no se borra.
            if ($rechazada && $tarea->estado === 'Completada') {
                DB::connection('mysql2')->table('tarea_criterio_historial')->insert([
                    'tarea_id'   => $id,
                    'evento'     => 'tarea_reabierta',
                    'antes'      => json_encode(['estado' => 'Completada'], JSON_UNESCAPED_UNICODE),
                    'despues'    => json_encode(['estado' => 'En Proceso'], JSON_UNESCAPED_UNICODE),
                    'usuario_id' => $this->usuarioAutenticado()->id ?? null,
                    'created_at' => now(),
                ]);
            }

            self::guardarNotificacion($id, 'Rechazada');

            DB::connection('mysql2')->commit();
            return response()->json(['success' => 'Tarea rechazada correctamente'], 200);
        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    function aprobarTarea($id, Request $request)
    {
        // Antes se leía $data['aprobada'] sin validar: un «false» en texto
        // contaba como verdadero y aprobaba la tarea.
        $data = $request->validate(['aprobada' => 'required|boolean']);

        $tarea = $this->exigirSupervisor($id);
        if ($tarea instanceof \Illuminate\Http\JsonResponse) {
            return $tarea;
        }

        $aprobada = (bool) $data['aprobada'];

        DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
            'aprobada' => (int) $aprobada,
            'fecha_aprobacion' => $aprobada ? now() : null,
            'editable' => $aprobada ? 0 : 1,
        ]);

        if ($aprobada) {
            self::guardarNotificacion($id, 'Aprobada');
        }

        return response()->json(['success' => 'Tarea aprobada correctamente'], 200);
    }
    function habilitarEdicion($id, Request $request)
    {
        $data = $request->validate(['editable' => 'required|boolean']);

        $tarea = $this->exigirSupervisor($id);
        if ($tarea instanceof \Illuminate\Http\JsonResponse) {
            return $tarea;
        }

        DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
            'editable' => (int) $data['editable'],
        ]);

        return response()->json(['success' => 'Tarea habilitada correctamente'], 200);
    }



    /**
     * Declara o levanta un impedimento sobre una tarea.
     *
     * Distinto de pausar: la pausa requiere aprobación del líder y detiene el
     * plazo, mientras que el bloqueo sólo deja constancia de qué impide avanzar
     * y el reloj sigue corriendo. Por eso lo declara el propio responsable, sin
     * pedir permiso: esconder un impedimento es justo lo que el método busca
     * evitar, y exigir un trámite para reconocerlo desalienta reportarlo.
     *
     * El motivo es obligatorio al bloquear: "bloqueada" sin explicación no le
     * sirve de nada a quien tiene que destrabarla.
     */
    function bloquearTarea($id, Request $request)
    {
        $data = $request->validate([
            'bloqueada' => 'required|boolean',
            'motivo'    => 'nullable|string|max:1000',
        ]);

        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->first();
        if (!$tarea) {
            return response()->json(['error' => 'Tarea no encontrada'], 404);
        }
        if (!AccesoTareas::alcanza((int) $tarea->empleado)) {
            return AccesoTareas::denegada('modificar');
        }

        $bloquear = (bool) $data['bloqueada'];
        $motivo   = trim((string) ($data['motivo'] ?? ''));

        if ($bloquear && mb_strlen($motivo) < 10) {
            return response()->json([
                'error' => 'Explica qué impide avanzar (al menos 10 caracteres). '
                         . 'Quien deba destrabarla necesita saberlo.',
            ], 422);
        }

        DB::connection('mysql2')->beginTransaction();
        try {
            DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
                'bloqueada'      => $bloquear ? 1 : 0,
                'motivo_bloqueo' => $bloquear ? $motivo : null,
            ]);

            $actor = $this->nombreActor();
            $this->registrarActividad(
                (int) $id,
                $bloquear ? 'Bloqueada' : 'Desbloqueada',
                $bloquear
                    ? "{$actor} declaró un impedimento: {$motivo}"
                    : "{$actor} levantó el impedimento de esta tarea."
            );

            DB::connection('mysql2')->commit();
        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }

        return response()->json([
            'success' => $bloquear
                ? 'Impedimento registrado. Aparecerá en el tablero de tu líder.'
                : 'Impedimento levantado.',
        ], 200);
    }

    function pausarTarea($id, Request $request)
    {
        $tarea = AccesoTareas::exigir($id, 'modificar');
        if (AccesoTareas::esRespuesta($tarea)) {
            return $tarea;
        }

        // Obligatorio. Se admite también 'true'/'false' como texto, que es lo
        // que envía el botón «Reanudar» (la regla boolean no lo acepta).
        $pausar = filter_var($request->input('pausada'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if (!$request->has('pausada') || $pausar === null) {
            return response()->json([
                'message' => 'Indica si se pausa o se reanuda.',
                'errors'  => ['pausada' => ['Indica si se pausa o se reanuda.']],
            ], 422);
        }
        if ($pausar && in_array($tarea->estado, ['Completada', self::EN_REVISION], true)) {
            return response()->json(['error' => 'La tarea ya fue entregada: no se puede pausar.'], 409);
        }

        if (filter_var($request->input('pausada'), FILTER_VALIDATE_BOOLEAN)) {
            $yo = AccesoTareas::usuario();
            $empleado = (int) $tarea->empleado;
            $independiente = AccesoTareas::esPropio($yo, $empleado)
                && strcasecmp(trim((string) ($yo->independencia ?? '')), 'Si') === 0;
            if (!AccesoTareas::esAdministracion($yo) && !AccesoTareas::lidera($yo, $empleado) && !$independiente) {
                return response()->json([
                    'error' => 'Para pausar tu tarea, solicita la pausa: tu líder la aprueba.',
                ], 403);
            }
        }

        $data = $request->all();
        try {
            $pausada = (int) filter_var($data['pausada'], FILTER_VALIDATE_BOOLEAN);
            $update = ['pausada' => $pausada];
            if (!$pausada) {
                $row = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->first();
                $cols = array_column(
                    DB::connection('mysql2')->select("SHOW COLUMNS FROM tareas_empleados"),
                    'Field'
                );
                if (in_array('fecha_reprogramacion', $cols)) {
                    $update['fecha_reprogramacion'] = null;
                }
                if (in_array('motivo_reprogramacion', $cols) && $row && !(int)($row->reprogramada ?? 0)) {
                    $update['motivo_reprogramacion'] = null;
                }
            }
            DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update($update);
            $actor = DB::connection('mysql2')->table('users')->where('email', Auth::user()->email)->value('name') ?? 'Usuario';
            $motivo = trim($data['motivo'] ?? '');
            $motivoStr = $motivo ? " Motivo: {$motivo}." : '';
            if ($pausada) {
                $this->registrarActividad($id, 'Pausada', "Tarea pausada por {$actor}.{$motivoStr}");
            } else {
                $this->registrarActividad($id, 'Reanudada', "Tarea reanudada por {$actor}.{$motivoStr}");
            }
            return response()->json(['success' => 'Estado de pausa actualizado correctamente'], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Solicitud de pausa con motivo y fecha de reanudación esperada.
     * Envía correo: empleado → su líder; líder → administrador de seguimiento.
     */
    public function solicitarPausa(Request $request)
    {
        // Si tarea_id no es un número, la validación de abajo responde 422.
        if (filter_var($request->input('tarea_id'), FILTER_VALIDATE_INT) !== false) {
            $tareaPadre = AccesoTareas::exigir($request->input('tarea_id'), 'modificar');
            if (AccesoTareas::esRespuesta($tareaPadre)) {
                return $tareaPadre;
            }
        }

        $data = $request->validate([
            'tarea_id' => 'required|integer',
            'motivo' => 'required|string|min:3|max:5000',
            // Reanudar en el pasado no tiene sentido (día de Bogotá).
            'fecha_reanudacion' => 'required|date|after_or_equal:' . \App\Support\IndiceDesempeno::hoy()->toDateString(),
        ], [
            'fecha_reanudacion.after_or_equal' => 'La fecha de reanudación no puede ser anterior a hoy.',
        ]);

        $usuarioActual = DB::connection('mysql2')->table('users')->where('email', Auth::user()->email)->first();
        if (!$usuarioActual) {
            return response()->json(['ok' => false, 'mensaje' => 'Usuario no encontrado'], 403);
        }

        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $data['tarea_id'])->first();
        if (!$tarea) {
            return response()->json(['ok' => false, 'mensaje' => 'Tarea no encontrada'], 404);
        }
        // Entregada (en revisión) o aceptada ya no tiene trabajo que pausar.
        if (in_array($tarea->estado, ['Completada', self::EN_REVISION], true)) {
            return response()->json(['ok' => false, 'mensaje' => 'La tarea ya fue entregada: no se puede pausar.'], 409);
        }

        $esDueño = $usuarioActual->empleado && (int) $usuarioActual->empleado === (int) $tarea->empleado;
        $esAdmin = strcasecmp($usuarioActual->tipo_usuario ?? '', 'Administrador') === 0;
        $esLiderDeAsignado = false;
        if (!$esDueño && !$esAdmin && $usuarioActual->empleado) {
            $esLiderDeAsignado = DB::connection('mysql2')->table('lideres_empleados')
                ->where('lider', $usuarioActual->empleado)
                ->where('empleado', $tarea->empleado)
                ->exists();
        }
        if (!$esDueño && !$esAdmin && !$esLiderDeAsignado) {
            return response()->json(['ok' => false, 'mensaje' => 'No autorizado para solicitar pausa en esta tarea'], 403);
        }

        $usuarioEsLider = $this->usuarioEsLiderParaNotificaciones($usuarioActual) || $esLiderDeAsignado;

        // Verificar que no haya solicitud pendiente
        $pendiente = DB::connection('mysql2')->table('pausas_solicitadas')
            ->where('tarea_id', $data['tarea_id'])
            ->where('estado', 'Pendiente')
            ->exists();
        if ($pendiente) {
            return response()->json(['ok' => false, 'mensaje' => 'Ya existe una solicitud de pausa pendiente para esta tarea.'], 422);
        }

        $tipoAprobador = $usuarioEsLider ? 'admin' : 'lider';

        DB::connection('mysql2')->table('pausas_solicitadas')->insert([
            'tarea_id'            => $data['tarea_id'],
            'solicitado_por'      => $usuarioActual->empleado ?? null,
            'solicitado_por_user' => $usuarioActual->id,
            'motivo'              => $data['motivo'],
            'fecha_reanudacion'   => Carbon::parse($data['fecha_reanudacion'])->toDateString(),
            'estado'              => 'Pendiente',
            'tipo_aprobador'      => $tipoAprobador,
            'fecha_solicitud'     => now(),
        ]);

        $fechaFmt = Carbon::parse($data['fecha_reanudacion'])->format('d/m/Y');
        $this->registrarActividad(
            $data['tarea_id'],
            'Pausa solicitada',
            "Pausa solicitada por {$usuarioActual->name}. Motivo: {$data['motivo']} — Reanudación estimada: {$fechaFmt}."
        );

        $this->notificarSolicitudPausa($tarea, $usuarioActual, $data['motivo'], $data['fecha_reanudacion']);

        return response()->json(['ok' => true, 'mensaje' => 'Solicitud de pausa enviada correctamente'], 201);
    }

    function resolverSolicitudPausa(Request $request, $id)
    {
        // aprobado_por se acepta por compatibilidad con el frontend pero NO se usa:
        // el resolutor se deriva del usuario autenticado.
        $data = $request->validate([
            'accion'               => 'required|in:aprobar,rechazar',
            'aprobado_por'         => 'nullable|integer',
            'observacion_rechazo'  => 'nullable|string',
        ]);

        $solicitud = DB::connection('mysql2')->table('pausas_solicitadas')->where('id', $id)->first();
        if (!$solicitud) {
            return response()->json(['message' => 'Solicitud no encontrada'], 404);
        }
        if ($solicitud->estado !== 'Pendiente') {
            return response()->json(['message' => 'La solicitud ya fue resuelta'], 422);
        }

        $tareaPausa = DB::connection('mysql2')->table('tareas_empleados')->where('id', $solicitud->tarea_id)->first();
        $resolutor = $this->resolutorAutorizado($tareaPausa);
        if (!$resolutor) {
            return response()->json(['message' => 'No autorizado para resolver esta solicitud'], 403);
        }

        $estado = $data['accion'] === 'aprobar' ? 'Aprobada' : 'Rechazada';

        DB::connection('mysql2')->table('pausas_solicitadas')->where('id', $id)->update([
            'estado'              => $estado,
            'aprobado_por'        => $resolutor->id,
            'observacion_rechazo' => $data['observacion_rechazo'] ?? null,
            'fecha_resolucion'    => now(),
        ]);

        $aprobadorNombre = $resolutor->name ?? 'Usuario';

        if ($data['accion'] === 'aprobar') {
            $update = ['pausada' => 1];
            $cols = array_column(
                DB::connection('mysql2')->select("SHOW COLUMNS FROM tareas_empleados"),
                'Field'
            );
            if (in_array('motivo_reprogramacion', $cols)) {
                $update['motivo_reprogramacion'] = $solicitud->motivo;
            }
            if (in_array('fecha_reprogramacion', $cols)) {
                $update['fecha_reprogramacion'] = Carbon::parse($solicitud->fecha_reanudacion)->startOfDay();
            }
            DB::connection('mysql2')->table('tareas_empleados')->where('id', $solicitud->tarea_id)->update($update);

            $fechaFmt = Carbon::parse($solicitud->fecha_reanudacion)->format('d/m/Y');
            $this->registrarActividad(
                $solicitud->tarea_id,
                'Pausa aprobada',
                "Pausa aprobada por {$aprobadorNombre}. Reanudación estimada: {$fechaFmt}."
            );
        } else {
            // Opcional: sin ella se leía un índice inexistente y la respuesta
            // era 500 cuando el rechazo ya estaba guardado.
            $obs = !empty($data['observacion_rechazo']) ? " Observación: {$data['observacion_rechazo']}." : '';
            $this->registrarActividad(
                $solicitud->tarea_id,
                'Pausa rechazada',
                "Solicitud de pausa rechazada por {$aprobadorNombre}.{$obs}"
            );
        }

        return response()->json(['message' => ucfirst($estado) . ' correctamente']);
    }

    function historialPausas($tareaId)
    {
        $tareaPadre = AccesoTareas::exigir($tareaId);
        if (AccesoTareas::esRespuesta($tareaPadre)) {
            return $tareaPadre;
        }

        $rows = DB::connection('mysql2')->table('pausas_solicitadas as p')
            ->leftJoin('empleados as e', 'p.solicitado_por', '=', 'e.id')
            ->leftJoin('users as ua', 'p.aprobado_por', '=', 'ua.id')
            ->leftJoin('empleados as ea', 'ua.empleado', '=', 'ea.id')
            ->select(
                'p.*',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre_solicitante'),
                DB::connection('mysql2')->raw('CONCAT(ea.nombres, " ", ea.apellidos) as nombre_aprobador')
            )
            ->where('p.tarea_id', $tareaId)
            ->orderBy('p.fecha_solicitud', 'desc')
            ->get();

        return response()->json($rows);
    }

    /**
     * Estado completo del Tablero de Seguimiento.
     *
     * Devuelve en una sola respuesta las columnas del kanban, los KPIs, la carga
     * del equipo, las alertas de vencimiento y las próximas entregas, todo
     * restringido al alcance del usuario autenticado (ver alcanceEmpleadosInformes).
     *
     * El frontend consulta este endpoint periódicamente y deriva las animaciones
     * comparando la respuesta con la anterior, por lo que aquí no se emite ningún
     * evento: la respuesta describe el estado actual completo, no un delta.
     */
    /**
     * Agenda de entregas del equipo, día por día.
     *
     * Se sirve aparte de tableroEstado porque no cabe en un sondeo de 5
     * segundos: recorre un rango largo y se consulta al abrir la vista.
     *
     * El rango no arranca en hoy, como haría un calendario convencional. Hoy
     * las 106 tareas abiertas del sistema están vencidas y ninguna vence de hoy
     * en adelante: mirar sólo hacia delante daría una agenda vacía. Va desde la
     * entrega más antigua pendiente hasta la más lejana, con hoy en medio, de
     * modo que muestra el atraso acumulado y seguirá sirviendo cuando empiecen
     * a pactarse fechas futuras.
     */
    function tableroAgenda(Request $request)
    {
        // Mismo filtro que el tablero: la agenda acompaña a lo que se mira.
        $alcance = $this->filtrarAlcanceTablero($request, $this->alcanceEmpleadosInformes());
        if ($alcance !== null && $alcance === []) {
            return response()->json(['dias' => [], 'hoy' => now()->toDateString()]);
        }

        $base = function () use ($alcance) {
            $q = DB::connection('mysql2')->table('tareas_empleados as t')
                ->leftJoin('empleados as e', 't.empleado', '=', 'e.id')
                ->leftJoin('users as u', 'u.empleado', '=', 't.empleado')
                ->leftJoin('proyectos as p', 't.proyecto_id', '=', 'p.id')
                ->whereNotIn('t.estado', ['Completada'])
                ->where('t.estado_reg', 'Activo')
                ->where(fn ($w) => $w->where('t.archivar', '<>', 1)->orWhereNull('t.archivar'))
                ->whereNotNull('t.fecha_pactada');

            if ($alcance !== null) {
                $q->whereIn('t.empleado', $alcance);
            }

            return $q;
        };

        $tareas = $base()
            ->select([
                't.id', 't.titulo', 't.estado', 't.prioridad', 't.fecha_pactada',
                't.pausada', 't.bloqueada', DB::connection('mysql2')->raw(CriteriosAceptacionController::sqlConteo('t') . ' as n_criterios'),
                't.empleado as empleado_id',
                'p.nombre as proyecto_nombre',
                'u.name as empleado_usuario',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as empleado'),
            ])
            ->orderBy('t.fecha_pactada')
            ->orderByDesc('t.prioridad')
            ->get();

        $hoy = Carbon::today();

        $porDia = $tareas->groupBy(fn ($t) => substr((string) $t->fecha_pactada, 0, 10));

        // El rango abarca hoy aunque no haya nada ese día: sin ese anclaje, una
        // agenda enteramente vencida no dejaría ver dónde está el presente.
        $fechas = $porDia->keys()->map(fn ($f) => Carbon::parse($f));
        $inicio = $fechas->min() ?: $hoy->copy();
        $fin    = $fechas->max() ?: $hoy->copy();
        $inicio = $inicio->lt($hoy) ? $inicio : $hoy->copy();
        $fin    = $fin->gt($hoy) ? $fin : $hoy->copy();

        // Un recorrido día a día de varios meses son cientos de filas casi
        // todas vacías. Se devuelven sólo los días con entregas más el de hoy,
        // y el frontend indica los huecos entre uno y otro.
        $dias = collect();

        foreach ($porDia as $fecha => $items) {
            $dias->push($this->filaAgenda($fecha, $items, $hoy));
        }

        if (!$porDia->has($hoy->toDateString())) {
            $dias->push($this->filaAgenda($hoy->toDateString(), collect(), $hoy));
        }

        return response()->json([
            'hoy'   => $hoy->toDateString(),
            'desde' => $inicio->toDateString(),
            'hasta' => $fin->toDateString(),
            'dias'  => $dias->sortBy('fecha')->values(),
        ]);
    }

    /** Arma un día de la agenda con sus entregas. */
    private function filaAgenda(string $fecha, $items, Carbon $hoy): array
    {
        $dia = Carbon::parse($fecha);

        return [
            'fecha'     => $fecha,
            'dia_semana' => (int) $dia->dayOfWeek,
            'es_hoy'    => $dia->isSameDay($hoy),
            'dias'      => (int) $hoy->diffInDays($dia, false),
            'tareas'    => collect($items)->map(fn ($t) => [
                'id'          => (int) $t->id,
                'titulo'      => $t->titulo,
                'estado'      => $t->estado,
                'prioridad'   => $t->prioridad,
                'empleado'    => $t->empleado ?: ($t->empleado_usuario ?: 'Sin responsable'),
                'empleado_id' => (int) $t->empleado_id,
                'proyecto'    => $t->proyecto_nombre,
                'pausada'     => (int) ($t->pausada ?? 0) === 1
                                  && !in_array($t->estado, self::ESTADOS_NO_PAUSABLES, true),
                'bloqueada'   => (int) ($t->bloqueada ?? 0) === 1,
                'sin_criterio' => (int) $t->n_criterios === 0,
            ])->values(),
        ];
    }

    /**
     * Plano de la oficina: la organización vista como zonas y puestos.
     *
     * El tablero ordena el trabajo por estado; aquí se ordena por lugar. Cada
     * departamento es una zona y cada persona un puesto, de modo que una zona
     * entera en rojo se reconoce de lejos: eso es lo que las columnas no
     * muestran.
     *
     * Devuelve siempre la organización completa y marca cuáles puestos son del
     * equipo del líder. El alcance de lectura es deliberadamente amplio —un
     * plano de tres puestos no dice nada—, pero el plano NO autoriza nada: sólo
     * expone el pulso del trabajo. Abrir una tarea y actuar sobre ella sigue
     * pasando por sus propios permisos, verificados en cada endpoint. Por eso
     * aquí no viaja descripción, motivo de bloqueo ni observación: el detalle de
     * un puesto ajeno se pide aparte, y allí manda resolutorAutorizado().
     */
    function tableroPlano(Request $request)
    {
        $conn = DB::connection('mysql2');
        $hoy = Carbon::today();

        $miEquipo = $this->equipoDelLiderActual();

        // Cualquiera ve el plano, pero el título de lo que otro tiene entre
        // manos sólo lo ve quien sigue el trabajo (administración, supervisión
        // y líderes). Un colaborador ve a sus compañeros, no sus tareas.
        $usuarioPlano = $this->usuarioAutenticado();
        $tipoPlano = strtolower(trim((string) ($usuarioPlano->tipo_usuario ?? '')));
        $veTrabajoAjeno = in_array($tipoPlano, ['administrador', 'supervisor'], true)
            || strtolower(trim((string) ($usuarioPlano->lider ?? ''))) === 'si';

        // Empleados activos. Es la planta de la oficina, no el alcance del
        // tablero: el plano se mira completo.
        $empleados = $conn->table('empleados as e')
            ->leftJoin('cargos as c', 'e.cargo', '=', 'c.id')
            ->leftJoin('departamentos as d', 'e.departamento', '=', 'd.id')
            ->leftJoin('empresas as em', 'e.empresa', '=', 'em.id')
            ->where('e.estado_registro', 'Activo')
            ->where('e.estado', 'Activo')
            // La foto no viaja aquí: en esta instalación se guarda como base64
            // en la propia tabla y sumaba 1,4 MB sobre un plano de 20 KB. El
            // diccionario de avatares ya se carga una sola vez por separado
            // (AvataresContext), así que el plano sólo envía el id.
            ->select(
                'e.id',
                'e.departamento as departamento_id',
                'c.nombre as cargo',
                'd.nombre as departamento',
                'em.nombre as empresa',
                'e.nombres',
                'e.apellidos',
                $conn->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre')
            )
            ->get();

        // Rótulo corto de cada puesto. Basta el primer nombre salvo cuando se
        // repite: con dos «FABIAN» en la misma sala se llamaba a quien no era.
        // Entonces se añade el primer apellido, que sí los distingue.
        $primero = fn ($txt) => mb_strtoupper(strtok(trim((string) $txt), ' ') ?: '');
        $repetidos = $empleados->countBy(fn ($e) => $primero($e->nombres))
            ->filter(fn ($n) => $n > 1);
        $etiqueta = function ($e) use ($primero, $repetidos) {
            $nombre = strtok(trim((string) $e->nombres), ' ') ?: '';
            if (!$repetidos->has($primero($e->nombres))) {
                return $nombre;
            }
            $apellido = strtok(trim((string) $e->apellidos), ' ') ?: '';
            return trim($nombre.' '.$apellido);
        };

        if ($empleados->isEmpty()) {
            return response()->json(['zonas' => [], 'hoy' => $hoy->toDateString()]);
        }

        // Tareas vivas de toda la planta, en una sola consulta. No se une con
        // empleados a propósito: aquí sólo se agrupa por empleado, y las tareas
        // de gente que ya no existe se descartan al no encontrar su puesto.
        $tareas = $conn->table('tareas_empleados as t')
            ->whereIn('t.empleado', $empleados->pluck('id'))
            ->where('t.estado_reg', 'Activo')
            ->where(fn ($w) => $w->whereNull('t.archivar')->orWhere('t.archivar', '<>', 1))
            ->whereNotIn('t.estado', ['Completada'])
            ->select(
                't.id',
                't.titulo',
                't.estado',
                't.prioridad',
                't.fecha_pactada',
                't.pausada',
                't.bloqueada',
                DB::connection('mysql2')->raw(CriteriosAceptacionController::sqlConteo('t') . ' as n_criterios'),
                't.empleado'
            )
            ->get()
            ->groupBy('empleado');

        // Presencia: el estado que cada quien eligió y lo que está haciendo.
        // La tarea en curso sólo anima al personaje; su título sigue sin
        // enseñarse a quien no sigue ese trabajo.
        $conTareaEnCurso = $tareas->filter(fn ($ts) => collect($ts)->contains(
            fn ($t) => $t->estado === 'En Proceso' && (int) ($t->pausada ?? 0) !== 1 && (int) ($t->bloqueada ?? 0) !== 1
        ))->keys()->map(fn ($i) => (int) $i)->all();
        $presencia = \App\Support\Presencia::delPlano(
            $empleados->pluck('id')->map(fn ($i) => (int) $i)->all(),
            $conTareaEnCurso
        );

        $puestos = $empleados->map(function ($e) use ($tareas, $hoy, $miEquipo, $etiqueta, $veTrabajoAjeno, $presencia) {
            $mias = collect($tareas[$e->id] ?? []);

            $pausadas = $mias->filter(fn ($t) => (int) ($t->pausada ?? 0) === 1
                && !in_array($t->estado, self::ESTADOS_NO_PAUSABLES, true));
            $bloqueadas = $mias->filter(fn ($t) => (int) ($t->bloqueada ?? 0) === 1);
            $revision = $mias->filter(fn ($t) => $t->estado === self::EN_REVISION);
            // En revisión ya se entregó: no va tarde, espera al líder. En
            // pausa tampoco: su plazo está detenido.
            $atrasadas = $mias->filter(fn ($t) => $t->fecha_pactada
                && $t->estado !== self::EN_REVISION
                && !\App\Support\IndiceDesempeno::estaPausada($t)
                && Carbon::parse($t->fecha_pactada)->startOfDay()->lt($hoy));
            $sinCriterio = $mias->filter(fn ($t) => (int) $t->n_criterios === 0);

            // En qué está ahora: la tarea En Proceso más urgente. Si no hay
            // ninguna el puesto se ve libre aunque tenga pendientes, que es la
            // lectura honesta: nadie está trabajando en ellas.
            $enCurso = $mias->filter(fn ($t) => $t->estado === 'En Proceso')
                ->sortBy(fn ($t) => $t->fecha_pactada ?: '9999-12-31')
                ->first();

            // La señal más grave manda el color del puesto. El orden es el del
            // método: lo que impide avanzar pesa más que lo que sólo va tarde.
            $senal = 'libre';
            if ($mias->isNotEmpty()) {
                $senal = 'trabajando';
            }
            if ($sinCriterio->isNotEmpty()) {
                $senal = 'sin_criterio';
            }
            if ($atrasadas->isNotEmpty()) {
                $senal = 'atrasado';
            }
            if ($pausadas->isNotEmpty()) {
                $senal = 'pausa';
            }
            if ($bloqueadas->isNotEmpty()) {
                $senal = 'bloqueado';
            }

            return [
                'id'              => (int) $e->id,
                'nombre'          => $e->nombre,
                'etiqueta'        => $etiqueta($e),
                'cargo'           => $e->cargo,
                'empresa'         => $e->empresa,
                'departamento_id' => (int) ($e->departamento_id ?: 0),
                'mi_equipo'       => in_array((int) $e->id, $miEquipo, true),
                'senal'           => $senal,
                'presencia'       => $presencia[(int) $e->id] ?? null,
                'en_curso'        => $enCurso && ($veTrabajoAjeno || in_array((int) $e->id, $miEquipo, true)) ? [
                    'id'     => (int) $enCurso->id,
                    'titulo' => $enCurso->titulo,
                ] : null,
                'conteos'         => [
                    'vivas'        => $mias->count(),
                    'atrasadas'    => $atrasadas->count(),
                    'bloqueadas'   => $bloqueadas->count(),
                    'pausadas'     => $pausadas->count(),
                    'revision'     => $revision->count(),
                    'sin_criterio' => $sinCriterio->count(),
                ],
            ];
        });

        // Zonas = departamentos, ordenadas por tamaño para que el plano se
        // dibuje estable entre recargas y las salas grandes queden primero.
        $zonas = $puestos->groupBy('departamento_id')
            ->map(function ($gente, $idDepto) use ($empleados) {
                $ref = $empleados->firstWhere('departamento_id', (int) $idDepto);
                $g = collect($gente);

                return [
                    'id'      => (int) $idDepto,
                    'nombre'  => $ref->departamento ?? 'Sin departamento',
                    'puestos' => $g->sortBy('nombre')->values(),
                    'resumen' => [
                        'personas'   => $g->count(),
                        'mi_equipo'  => $g->where('mi_equipo', true)->count(),
                        'bloqueadas' => $g->sum(fn ($p) => $p['conteos']['bloqueadas']),
                        'atrasadas'  => $g->sum(fn ($p) => $p['conteos']['atrasadas']),
                        'revision'   => $g->sum(fn ($p) => $p['conteos']['revision']),
                    ],
                ];
            })
            ->sortByDesc(fn ($z) => $z['resumen']['personas'])
            ->values();

        return response()->json([
            'hoy'             => $hoy->toDateString(),
            'zonas'           => $zonas,
            'mi_equipo_total' => count($miEquipo),
            // Para reconocer al propio personaje y dejarle cambiar su estado.
            'yo'              => $usuarioPlano && $usuarioPlano->empleado ? (int) $usuarioPlano->empleado : null,
        ]);
    }

    /**
     * Ids de empleados a cargo del usuario actual, incluido él mismo.
     *
     * Sirve para resaltar en el plano, no para autorizar. Devuelve [] cuando el
     * usuario no tiene empleado asociado; un administrador tampoco recibe la
     * organización entera marcada como «su equipo», porque eso vaciaría de
     * sentido el resalte.
     */
    private function equipoDelLiderActual(): array
    {
        $usuario = $this->usuarioAutenticado();
        if (!$usuario || !($usuario->empleado ?? null)) {
            return [];
        }

        $yo = (int) $usuario->empleado;

        // El join descarta las referencias huérfanas de lideres_empleados: hay
        // filas que apuntan a empleados que ya no existen.
        //
        // Los dos filtros de estado son necesarios y deben coincidir con los de
        // la consulta de puestos: hay empleados con estado_registro «Activo»
        // pero estado «Inactivo». Filtrando sólo por el primero, el contador
        // del equipo incluía a gente que luego no aparecía en ningún puesto.
        $asignados = DB::connection('mysql2')->table('lideres_empleados as le')
            ->join('empleados as e', 'le.empleado', '=', 'e.id')
            ->where('le.lider', $yo)
            ->where('e.estado_registro', 'Activo')
            ->where('e.estado', 'Activo')
            ->pluck('e.id')
            ->map(fn ($id) => (int) $id)
            ->all();

        return array_values(array_unique(array_merge([$yo], $asignados)));
    }

    function tableroEstado(Request $request)
    {
        $conn = DB::connection('mysql2');
        // Lo que puede ver (todo, su equipo o lo suyo) y, dentro de eso, lo que
        // pidió ver: un departamento o una persona.
        $alcanceBase = $this->alcanceEmpleadosInformes();
        $alcance = $this->filtrarAlcanceTablero($request, $alcanceBase);
        $dias = max(1, min(365, (int) $request->query('dias', 7)));
        $hoy = Carbon::today();

        // Base común: tareas vivas y no archivadas dentro del alcance.
        // archivar admite NULL en la mayoría de filas históricas, por lo que la
        // comparación debe contemplarlo explícitamente: 'archivar <> 1' por sí
        // solo descarta los NULL y vaciaría el tablero.
        // El join con empleados es LEFT y su filtro de actividad va dentro de la
        // condición: hay 150 tareas activas cuyo empleado ya no existe en la
        // tabla, y un INNER JOIN las descartaba del tablero sin dejar rastro.
        // Una tarea sigue siendo trabajo pendiente aunque su responsable haya
        // salido; se muestra con el responsable sin resolver.
        $base = function () use ($conn, $alcance) {
            $q = $conn->table('tareas_empleados as t')
                ->leftJoin('empleados as e', function ($join) {
                    $join->on('t.empleado', '=', 'e.id')
                         ->where('e.estado_registro', 'Activo')
                         ->where('e.estado', 'Activo');
                })
                // Respaldo del nombre: si el empleado ya no está en 'empleados'
                // pero conserva su usuario, se recupera de ahí en lugar de dejar
                // la tarjeta sin responsable.
                ->leftJoin('users as u', 't.empleado', '=', 'u.empleado')
                ->leftJoin('cargos as c', 'e.cargo', '=', 'c.id')
                ->leftJoin('proyectos as p', 't.proyecto_id', '=', 'p.id')
                ->where('t.estado_reg', 'Activo')
                ->where(function ($w) {
                    $w->whereNull('t.archivar')->orWhere('t.archivar', '<>', 1);
                });
            if ($alcance !== null) {
                $q->whereIn('t.empleado', $alcance);
            }
            return $q->select(
                't.id',
                't.titulo',
                't.descripcion',
                't.estado',
                't.prioridad',
                't.fecha_pactada',
                't.fecha_entregada',
                't.pausada',
                DB::connection('mysql2')->raw(CriteriosAceptacionController::sqlConteo('t') . ' as n_criterios'),
                't.bloqueada',
                't.motivo_bloqueo',
                't.rechazada',
                't.visto_bueno',
                't.motivo_reprogramacion',
                't.empleado as empleado_id',
                'p.nombre as proyecto_nombre',
                'u.name as empleado_usuario',
                'c.nombre as empleado_cargo',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as empleado')
            );
        };

        // Una tarea sólo cuenta como pausada si además sigue sin resolverse. El
        // sistema no limpia la bandera 'pausada' al cambiar de estado
        // (actualizarEstadoTarea escribe únicamente 'estado'), así que una tarea
        // reanudada o cerrada puede arrastrarla indefinidamente. Sin esta
        // condición la tarjeta se quedaría atrapada en "En Pausa" pese a haber
        // vuelto a "En Proceso": el estado explícito manda sobre la bandera.
        $estaPausada = function ($q) {
            return $q->where('t.pausada', 1)
                ->whereNotIn('t.estado', self::ESTADOS_NO_PAUSABLES);
        };

        $noPausada = function ($q) {
            return $q->where(function ($w) {
                $w->whereNull('t.pausada')
                  ->orWhere('t.pausada', '<>', 1)
                  ->orWhereIn('t.estado', self::ESTADOS_NO_PAUSABLES);
            });
        };

        // Avance por checklist, en una única consulta agregada para no repetir un
        // conteo por tarjeta. Sólo unas pocas tareas tienen subtareas, así que el
        // mapa resultante es pequeño; las que no aparecen simplemente no muestran
        // porcentaje.
        $avances = $conn->table('subtareas')
            ->select('tarea_id',
                DB::connection('mysql2')->raw('COUNT(*) as total'),
                DB::connection('mysql2')->raw('SUM(CASE WHEN completada = 1 THEN 1 ELSE 0 END) as hechas'))
            ->groupBy('tarea_id')
            ->get()
            ->keyBy('tarea_id');

        // $conDetalle activa los campos que sólo usa la vista destacada del
        // carrusel (descripción y cargo). Se limita a "En Proceso" para no
        // arrastrarlos en cada sondeo por todas las columnas.
        $mapear = function ($rows, $conDetalle = false) use ($hoy, $avances) {
            return collect($rows)->map(function ($t) use ($hoy, $avances, $conDetalle) {
                $dias = null;
                if ($t->fecha_pactada) {
                    // Entero: con Carbon 3 diffInDays() devuelve float, y
                    // «dias_restantes === 0» no se cumplía nunca, así que
                    // «vencen hoy» marcaba siempre cero.
                    $dias = (int) round($hoy->diffInDays(Carbon::parse($t->fecha_pactada)->startOfDay(), false));
                }

                // Avance sólo cuando la tarea tiene checklist; el resto queda en null
                // y la tarjeta no dibuja barra alguna.
                $checklist = null;
                $a = $avances[$t->id] ?? null;
                if ($a && (int) $a->total > 0) {
                    $checklist = [
                        'total'  => (int) $a->total,
                        'hechas' => (int) $a->hechas,
                        'pct'    => (int) round($a->hechas / $a->total * 100),
                    ];
                }

                return [
                    'id'              => (int) $t->id,
                    'titulo'          => $t->titulo,
                    // La descripción sólo se usa en la vista destacada del
                    // carrusel; se recorta para no inflar la respuesta del sondeo.
                    'descripcion'     => $conDetalle && $t->descripcion
                        ? mb_substr(trim($t->descripcion), 0, 260)
                        : null,
                    'estado'          => $t->estado,
                    'prioridad'       => $t->prioridad,
                    'fecha_pactada'   => $t->fecha_pactada,
                    'fecha_entregada' => $t->fecha_entregada,
                    'empleado_id'     => (int) $t->empleado_id,
                    // Con el LEFT JOIN el nombre llega nulo si el empleado ya no
                    // está en 'empleados': se recurre al de su usuario y, sólo si
                    // tampoco existe, se indica que no tiene responsable.
                    'empleado'        => $t->empleado ?: ($t->empleado_usuario ?: 'Sin responsable'),
                    'proyecto'        => $t->proyecto_nombre,
                    'cargo'           => $conDetalle ? $t->empleado_cargo : null,
                    // Coherente con el criterio de la columna "En Pausa": una tarea
                    // reanudada o cerrada no se pinta como pausada aunque conserve
                    // la bandera de una pausa anterior.
                    'pausada'         => (int) ($t->pausada ?? 0) === 1
                                          && !in_array($t->estado, self::ESTADOS_NO_PAUSABLES, true),
                    'motivo'          => $t->motivo_reprogramacion,
                    'dias_restantes'  => $dias,
                    'checklist'       => $checklist,
                    // Bandera, no el texto: el criterio es largo y el sondeo
                    // corre cada 5 segundos. El texto se pide al abrir la tarea.
                    'sin_criterio'    => (int) $t->n_criterios === 0,
                    'bloqueada'       => (int) ($t->bloqueada ?? 0) === 1,
                    'motivo_bloqueo'  => $conDetalle ? $t->motivo_bloqueo : null,
                ];
            })->values();
        };

        $pendiente = $mapear($noPausada($base())->where('t.estado', 'Pendiente')->orderBy('t.fecha_pactada')->get());
        $proceso   = $mapear($noPausada($base())->where('t.estado', 'En Proceso')->orderBy('t.fecha_pactada')->get(), true);
        // Entregadas y a la espera de que el líder verifique el criterio. Van
        // con detalle porque es la columna sobre la que él tiene que actuar.
        $revision = $mapear(
            $noPausada($base())->where('t.estado', self::EN_REVISION)
                ->orderBy('t.fecha_pactada')->get(),
            true
        );
        $pausa = $mapear($estaPausada($base())->orderBy('t.fecha_pactada')->get());

        // Completadas dentro de la ventana; si no hay ninguna (histórico inactivo)
        // se degrada a las últimas completadas para no dejar la columna vacía.
        $desde = $hoy->copy()->subDays($dias)->toDateString();
        $completadas = $mapear(
            $base()->where('t.estado', 'Completada')
                ->whereNotNull('t.fecha_entregada')
                ->whereDate('t.fecha_entregada', '>=', $desde)
                ->orderByDesc('t.fecha_entregada')->get()
        );
        $modoCompletadas = 'ventana';
        if ($completadas->isEmpty()) {
            $completadas = $mapear(
                $base()->where('t.estado', 'Completada')
                    ->whereNotNull('t.fecha_entregada')
                    ->orderByDesc('t.fecha_entregada')->limit(8)->get()
            );
            $modoCompletadas = $completadas->isEmpty() ? 'vacio' : 'fallback';
        }

        $activas = $pendiente->count() + $proceso->count() + $pausa->count();
        $totalCiclo = $activas + $completadas->count();

        // Carga por integrante: tareas activas (no completadas) de cada empleado.
        $porEmpleado = $pendiente->concat($proceso)->concat($pausa)->groupBy('empleado_id');
        $maxCarga = $porEmpleado->map->count()->max() ?: 1;

        // Las fotos NO se incluyen aquí: en esta instalación se almacenan como
        // base64 dentro de la columna (hasta ~55 KB cada una) y esta respuesta se
        // consulta cada pocos segundos durante toda la jornada. El frontend las
        // pide una sola vez a /tablero/avatares y las cachea.
        $equipoQuery = $conn->table('empleados as e')
            ->leftJoin('cargos as c', 'e.cargo', '=', 'c.id')
            ->where('e.estado_registro', 'Activo')
            ->where('e.estado', 'Activo')
            ->select('e.id', 'c.nombre as cargo',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre'));
        if ($alcance !== null) {
            $equipoQuery->whereIn('e.id', $alcance);
        }
        $equipo = collect($equipoQuery->orderBy('e.nombres')->get())
            ->map(function ($e) use ($porEmpleado, $maxCarga) {
                $n = isset($porEmpleado[$e->id]) ? $porEmpleado[$e->id]->count() : 0;
                return [
                    'id'        => (int) $e->id,
                    'nombre'    => $e->nombre,
                    'cargo'     => $e->cargo,
                    'activas'   => $n,
                    'carga_pct' => (int) round($n / $maxCarga * 100),
                ];
            })
            ->sortByDesc('activas')->values();

        // Alertas y próximas entregas sobre tareas aún no entregadas. Las que
        // están en revisión ya se entregaron (su fecha de entrega es la del
        // envío): no vencen ni están por entregar, esperan al líder, y ya
        // tienen su propia columna «Por verificar».
        $sinCompletar = $pendiente->concat($proceso)->concat($pausa);
        // Las pausadas no corren el plazo: la pausa la aprueba el líder y al
        // reanudar se fija fecha nueva. No vencen, ni vencen hoy, ni pronto.
        $conPlazo = $sinCompletar->reject(fn ($t) => $t['pausada']);
        $alertas = [
            'vencidas'   => $conPlazo->filter(fn ($t) => $t['dias_restantes'] !== null && $t['dias_restantes'] < 0)->count(),
            'vencen_hoy' => $conPlazo->filter(fn ($t) => $t['dias_restantes'] === 0)->count(),
            'proximas'   => $conPlazo->filter(fn ($t) => $t['dias_restantes'] !== null && $t['dias_restantes'] > 0 && $t['dias_restantes'] <= 7)->count(),
            'pausadas'   => $pausa->count(),
            'bloqueadas' => $sinCompletar->filter(fn ($t) => $t['bloqueada'])->count(),
            // Cuántas del fondo heredado siguen sin criterio pactado: es la
            // medida de cuánto falta para que el método cubra todo el equipo.
            'sin_criterio' => $sinCompletar->filter(fn ($t) => $t['sin_criterio'])->count(),
        ];

        // El panel priorizaba la fecha más antigua, de modo que bajo el título
        // "Próximas entregas" aparecían siempre las más atrasadas. Se separan
        // los dos casos: primero lo que aún está en plazo, ordenado por
        // proximidad, y sólo si no hay nada por vencer se recurre a lo vencido,
        // empezando por lo más reciente. 'modo' indica cuál de los dos se
        // devuelve para que el tablero pueda titularlo con propiedad.
        $conFecha = $conPlazo->filter(fn ($t) => $t['fecha_pactada'] !== null);

        $porVencer = $conFecha
            ->filter(fn ($t) => $t['dias_restantes'] !== null && $t['dias_restantes'] >= 0)
            ->sortBy('dias_restantes');

        $modoEntregas = $porVencer->isNotEmpty() ? 'proximas' : 'vencidas';

        $seleccion = $porVencer->isNotEmpty()
            ? $porVencer
            : $conFecha->sortByDesc('fecha_pactada');

        $entregas = $seleccion
            ->take(6)
            ->map(fn ($t) => [
                'id'            => $t['id'],
                'titulo'        => $t['titulo'],
                'fecha_pactada' => $t['fecha_pactada'],
                'empleado'      => $t['empleado'],
                'dias_restantes' => $t['dias_restantes'],
            ])->values();

        $usuario = $conn->table('users')->where('email', Auth::user()->email ?? '')->first();
        $departamento = null;
        if ($usuario && $usuario->empleado) {
            $departamento = $conn->table('empleados as e')
                ->leftJoin('departamentos as d', 'e.departamento', '=', 'd.id')
                ->where('e.id', $usuario->empleado)->value('d.nombre');
        }

        return response()->json([
            'servidor_ts' => now()->toIso8601String(),
            'alcance' => [
                'tipo'         => $alcanceBase === null ? 'global' : 'equipo',
                'departamento' => $departamento,
                'empleados'    => $alcance === null ? null : count($alcance),
                'dias_ventana' => $dias,
            ],
            // Opciones del filtro (dentro de lo que puede ver) y el aplicado.
            'filtros' => $this->opcionesFiltroTablero($alcanceBase),
            'filtro'  => [
                'departamento' => $request->integer('departamento') ?: null,
                'empleado'     => $request->integer('empleado') ?: null,
            ],
            'kpis' => [
                'total'      => $totalCiclo,
                'pendiente'  => $pendiente->count(),
                'proceso'    => $proceso->count(),
                'revision'   => $revision->count(),
                'pausa'      => $pausa->count(),
                'completadas' => $completadas->count(),
                'avance_pct' => $totalCiclo > 0 ? (int) round($completadas->count() / $totalCiclo * 100) : 0,
            ],
            'columnas' => [
                'pendiente'   => $pendiente,
                'proceso'     => $proceso,
                'revision'    => $revision,
                'pausa'       => $pausa,
                'completadas' => ['modo' => $modoCompletadas, 'items' => $completadas],
            ],
            'equipo'   => $equipo,
            'alertas'  => $alertas,
            'entregas' => $entregas,
            'entregas_modo' => $modoEntregas,
        ]);
    }

    /**
     * Extrae el id de vídeo de un enlace de YouTube.
     *
     * Se valida en el servidor además de en el cliente: la lista se administra
     * desde Parámetros y no debe aceptar una URL arbitraria que después acabe
     * incrustada en el tablero.
     */
    private function idYoutube(?string $entrada): ?string
    {
        $v = trim((string) $entrada);
        if ($v === '') {
            return null;
        }
        if (preg_match('/^[\w-]{11}$/', $v)) {
            return $v;
        }

        $url = parse_url(str_starts_with($v, 'http') ? $v : "https://{$v}");
        if (!$url || empty($url['host'])) {
            return null;
        }

        $host = preg_replace('/^www\./', '', strtolower($url['host']));
        $ruta = trim($url['path'] ?? '', '/');

        if ($host === 'youtu.be') {
            $id = explode('/', $ruta)[0] ?? '';
            return preg_match('/^[\w-]{11}$/', $id) ? $id : null;
        }

        if ($host === 'youtube.com' || $host === 'youtube-nocookie.com'
            || str_ends_with($host, '.youtube.com')) {
            parse_str($url['query'] ?? '', $q);
            if (!empty($q['v']) && preg_match('/^[\w-]{11}$/', $q['v'])) {
                return $q['v'];
            }
            $partes = array_values(array_filter(explode('/', $ruta)));
            foreach ($partes as $i => $p) {
                if (in_array($p, ['embed', 'live', 'shorts', 'v'], true)
                    && isset($partes[$i + 1])
                    && preg_match('/^[\w-]{11}$/', $partes[$i + 1])) {
                    return $partes[$i + 1];
                }
            }
        }

        return null;
    }

    /** Lista de vídeos del tablero. Con ?todos=1 incluye los inactivos (gestión). */
    /**
     * Cierra una tarea verificando su criterio de cumplimiento.
     *
     * Es el único camino a "Completada" para una tarea que tiene criterio. Lo
     * resuelve el líder del responsable —nunca el propio responsable, regla que
     * hereda de resolutorAutorizado()—, de modo que quien hizo el trabajo no
     * firma su propia verificación.
     *
     * Verificar y rechazar son la misma operación con distinto desenlace: si el
     * criterio no se cumple, la tarea vuelve a "En Proceso" con la observación,
     * en lugar de quedarse en revisión indefinidamente.
     */
    function tableroVideos(Request $request)
    {
        $todos = filter_var($request->query('todos', false), FILTER_VALIDATE_BOOLEAN);
        $usuario = $this->usuarioAutenticado();
        if (!$usuario) {
            return response()->json([]);
        }

        $videos = DB::connection('mysql2')->table('tablero_videos')
            ->when(!$todos, fn ($q) => $q->where('estado', 'Activo'))
            ->where(fn ($q) => $q
                ->where('usuario', $usuario->id)
                // Los vídeos anteriores a que existiera el dueño no tienen
                // ninguno: se muestran a todos para no dejar en blanco un
                // tablero que ya venía funcionando.
                ->orWhereNull('usuario'))
            ->orderBy('orden')
            ->orderBy('id')
            ->get();

        return response()->json($videos);
    }

    function guardarTableroVideo(Request $request)
    {
        $data = $request->validate([
            'id'     => 'nullable|integer',
            'titulo' => 'required|string|max:200',
            'url'    => 'required|string|max:500',
            'orden'  => 'nullable|integer',
            'estado' => 'nullable|in:Activo,Inactivo',
        ]);

        $usuario = $this->usuarioAutenticado();
        if (!$usuario) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $videoId = $this->idYoutube($data['url']);
        if (!$videoId) {
            return response()->json([
                'message' => 'El enlace no corresponde a un vídeo de YouTube válido.',
            ], 422);
        }

        $fila = [
            'titulo'     => trim($data['titulo']),
            'video_id'   => $videoId,
            'orden'      => $data['orden'] ?? 0,
            'estado'     => $data['estado'] ?? 'Activo',
            'updated_at' => now(),
        ];

        if (!empty($data['id'])) {
            // El dueño se comprueba en el update: filtrar sólo en el listado
            // dejaría que un líder editara el vídeo de otro llamando al
            // endpoint con un id ajeno.
            $afectadas = DB::connection('mysql2')->table('tablero_videos')
                ->where('id', $data['id'])
                ->where(fn ($q) => $this->condicionDuenoVideo($q, $usuario))
                ->update($fila);

            if ($afectadas === 0) {
                return response()->json([
                    'message' => 'No tienes permiso para modificar este vídeo.',
                ], 403);
            }

            return response()->json(['id' => (int) $data['id'], 'message' => 'Vídeo actualizado']);
        }

        $fila['usuario']    = $usuario->id;
        $fila['created_at'] = now();
        $id = DB::connection('mysql2')->table('tablero_videos')->insertGetId($fila);

        return response()->json(['id' => $id, 'message' => 'Vídeo agregado']);
    }

    function eliminarTableroVideo($id)
    {
        $usuario = $this->usuarioAutenticado();
        if (!$usuario) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $borradas = DB::connection('mysql2')->table('tablero_videos')
            ->where('id', $id)
            ->where(fn ($q) => $this->condicionDuenoVideo($q, $usuario))
            ->delete();

        if ($borradas === 0) {
            return response()->json([
                'message' => 'No tienes permiso para eliminar este vídeo.',
            ], 403);
        }

        return response()->json(['success' => true, 'message' => 'Vídeo eliminado']);
    }

    /**
     * Restringe una consulta de tablero_videos a los que el usuario puede tocar.
     *
     * Cada líder gestiona únicamente los suyos. Los vídeos heredados —sin dueño,
     * cargados antes de que la columna existiera— sólo los administra un
     * Administrador, para que nadie retire el fondo que ya usaban otros.
     */
    private function condicionDuenoVideo($q, $usuario)
    {
        $q->where('usuario', $usuario->id);

        if (strcasecmp($usuario->tipo_usuario ?? '', 'Administrador') === 0) {
            $q->orWhereNull('usuario');
        }

        return $q;
    }

    /** Fila de users (mysql2) del usuario autenticado, o null si no hay sesión. */
    private function usuarioAutenticado(): ?object
    {
        $email = Auth::user()->email ?? null;
        if (!$email) {
            return null;
        }

        return DB::connection('mysql2')->table('users')->where('email', $email)->first();
    }

    /**
     * Avatares de los empleados dentro del alcance del usuario, indexados por id.
     *
     * Se sirve aparte de tableroEstado porque las fotos se guardan como base64 en
     * la propia columna y cambian muy rara vez: el tablero las pide una vez al
     * montar y las reutiliza, en lugar de arrastrarlas en cada sondeo.
     */
    function tableroAvatares(Request $request)
    {
        // El plano dibuja la organización entera, así que necesita todas las
        // fotos; el alcance de informes dejaría a la mayoría con iniciales. Se
        // pide de forma explícita con ?plano=1 en vez de ampliar el alcance
        // por defecto, que seguiría rigiendo para los informes.
        $paraPlano = $request->boolean('plano');
        $alcance = $paraPlano ? null : $this->alcanceEmpleadosInformes();

        $q = DB::connection('mysql2')->table('empleados')
            ->where('estado_registro', 'Activo')
            ->where('estado', 'Activo')
            ->whereNotNull('foto')
            ->select('id', 'foto');
        if ($alcance !== null) {
            $q->whereIn('id', $alcance);
        }

        return response()->json($q->get()->pluck('foto', 'id'));
    }

    /**
     * Devuelve los ids de empleados que el usuario autenticado puede ver en los informes.
     *
     * - Administrador y Supervisor: null (sin restricción, ven toda la organización).
     * - Líder: sus empleados asignados en lideres_empleados, más él mismo.
     * - Empleado: únicamente él mismo.
     * - Sin usuario o sin empleado asociado: array vacío (no ve nada).
     *
     * La relación replica la misma consulta que construye 'empleados_asignados'
     * en el login (Auth\LoginController), de modo que el alcance del servidor
     * coincide con el que el frontend ya venía aplicando en el cliente.
     */
    /**
     * Acota el alcance del tablero a un departamento o a una persona.
     *
     * Nunca lo amplía: un líder que pide otro departamento o a alguien que no
     * es de su equipo recibe un tablero vacío. null sigue significando «sin
     * restricción» (administración sin filtro).
     */
    private function filtrarAlcanceTablero(Request $request, ?array $alcance): ?array
    {
        $departamento = $request->integer('departamento');
        $empleado = $request->integer('empleado');

        if ($departamento > 0) {
            $delDepartamento = DB::connection('mysql2')->table('empleados')
                ->where('departamento', $departamento)
                ->pluck('id')->map(fn ($id) => (int) $id)->all();
            $alcance = $alcance === null
                ? $delDepartamento
                : array_values(array_intersect($alcance, $delDepartamento));
        }

        if ($empleado > 0) {
            $alcance = ($alcance === null || in_array($empleado, $alcance, true)) ? [$empleado] : [];
        }

        return $alcance;
    }

    /**
     * Departamentos y personas activas que el usuario puede elegir en el
     * filtro del tablero: sólo los de su alcance.
     */
    private function opcionesFiltroTablero(?array $alcance): array
    {
        $conn = DB::connection('mysql2');
        if ($alcance === []) {
            return ['departamentos' => [], 'empleados' => []];
        }

        $empleados = $conn->table('empleados as e')
            ->leftJoin('departamentos as d', 'e.departamento', '=', 'd.id')
            ->where('e.estado', 'Activo')->where('e.estado_registro', 'Activo')
            ->when($alcance !== null, fn ($q) => $q->whereIn('e.id', $alcance))
            ->orderBy('e.nombres')->orderBy('e.apellidos')
            ->get(['e.id', 'e.nombres', 'e.apellidos', 'd.id as departamento_id', 'd.nombre as departamento']);

        return [
            'departamentos' => $empleados->whereNotNull('departamento_id')
                ->unique('departamento_id')->sortBy('departamento')
                ->map(fn ($e) => ['id' => (int) $e->departamento_id, 'nombre' => $e->departamento])
                ->values(),
            'empleados' => $empleados->map(fn ($e) => [
                'id'              => (int) $e->id,
                'nombre'          => trim($e->nombres . ' ' . $e->apellidos),
                'departamento_id' => $e->departamento_id ? (int) $e->departamento_id : null,
            ])->values(),
        ];
    }

    private function alcanceEmpleadosInformes(): ?array
    {
        $email = Auth::user()->email ?? null;
        if (!$email) {
            return [];
        }

        $usuarioActual = DB::connection('mysql2')->table('users')->where('email', $email)->first();
        if (!$usuarioActual) {
            return [];
        }

        $tipo = strtolower(trim($usuarioActual->tipo_usuario ?? ''));
        if ($tipo === 'administrador' || $tipo === 'supervisor') {
            return null;
        }

        $empleadoId = $usuarioActual->empleado ?? null;
        if (!$empleadoId) {
            return [];
        }

        $ids = [(int) $empleadoId];

        if ($this->usuarioEsLiderParaNotificaciones($usuarioActual)) {
            $asignados = DB::connection('mysql2')->table('lideres_empleados')
                ->join('empleados', 'lideres_empleados.empleado', 'empleados.id')
                ->where('lideres_empleados.lider', $empleadoId)
                ->where('empleados.estado_registro', 'Activo')
                ->pluck('empleados.id')
                ->all();

            $ids = array_merge($ids, array_map('intval', $asignados));
        }

        return array_values(array_unique($ids));
    }

    /**
     * Verifica que el usuario autenticado pueda resolver (aprobar/rechazar) una
     * solicitud de pausa o reprogramación sobre una tarea.
     *
     * Puede resolver un Administrador, o el líder del empleado dueño de la tarea.
     * El dueño de la tarea nunca puede resolver su propia solicitud.
     *
     * Devuelve el registro de users del resolutor, o null si no está autorizado.
     * El id devuelto es el que debe persistirse en aprobado_por: confiar en el
     * valor enviado por el cliente permitía atribuir la aprobación a un tercero.
     */
    /**
     * Quién supervisa una tarea: aprobarla, darle visto bueno, rechazarla o
     * habilitar su edición. Son los mismos que resuelven sus solicitudes
     * (administrador o líder directo del responsable) y, además, el propio
     * responsable si tiene independencia: es la autorización expresa con la
     * que el panel de supervisión ya se le mostraba en sus propias tareas.
     *
     * Antes estos endpoints no comprobaban nada: cualquier usuario con sesión
     * podía aprobar o rechazar cualquier tarea.
     */
    private function supervisorAutorizado($tarea): ?object
    {
        if ($u = $this->resolutorAutorizado($tarea)) {
            return $u;
        }

        $u = $this->usuarioAutenticado();
        $esSuya = $u && $u->empleado && (int) $u->empleado === (int) $tarea->empleado;

        return $esSuya && strcasecmp(trim((string) ($u->independencia ?? '')), 'Si') === 0 ? $u : null;
    }

    /**
     * Reglas para cambiar el estado de una tarea, iguales para arrastrar la
     * tarjeta, usar los botones del detalle o editarla. Devuelve la respuesta
     * de error, o null si el cambio está permitido.
     *
     *  - Sólo la mueve su responsable, el líder del responsable, administración
     *    o supervisión. Antes cualquier sesión podía mover cualquier tarea.
     *  - Ninguna se cierra moviéndola: toda tarea, tenga criterios o no, pasa
     *    por revisión y la cierra quien acepta la entrega.
     *  - De «En Revisión» sólo se sale aceptando o devolviendo la entrega:
     *    el responsable no puede retirarla mientras la revisan.
     *  - Una tarea cerrada sólo la reabre quien puede aceptarla (líder,
     *    administración o el propio responsable con independencia).
     */
    /**
     * Intenta la aceptación del independiente y responde qué pasó: cerrada,
     * o en revisión con lo que falta para cerrarla.
     */
    private function respuestaCompletaSola(int $id, bool $enviada, $evidencias = null)
    {
        $r = app(CriteriosAceptacionController::class)->aceptarPorIndependencia($id);
        if ($evidencias === null) {
            $evidencias = DB::connection('mysql2')->table('evidencia_tarea')->where('tarea', $id)->get();
        }

        return response()->json([
            'success'       => $r['aceptada']
                ? 'Tarea completada: se aceptó sola porque tienes independencia.'
                : 'La tarea quedó en revisión: falta lo siguiente para cerrarla.',
            'estado_final'  => $r['aceptada'] ? 'Completada' : self::EN_REVISION,
            'auto_aceptada' => $r['aceptada'],
            'bloqueos'      => $r['bloqueos'],
            'evidencias'    => $evidencias,
        ], 200);
    }

    private function reglaDeEstado(object $actual, string $nuevo): ?\Illuminate\Http\JsonResponse
    {
        if ($nuevo === $actual->estado) {
            return null;
        }

        $u = $this->usuarioAutenticado();
        $tipo = strtolower(trim((string) ($u->tipo_usuario ?? '')));
        $esResponsable = $u && $u->empleado && (int) $u->empleado === (int) $actual->empleado;
        $esLider = $u && $u->empleado && DB::connection('mysql2')->table('lideres_empleados')
            ->where('lider', $u->empleado)->where('empleado', $actual->empleado)->exists();

        if (!$esResponsable && !$esLider && !in_array($tipo, ['administrador', 'supervisor'], true)) {
            return response()->json([
                'error' => 'No puedes cambiar el estado de esta tarea: no es tuya ni de alguien de tu equipo.',
            ], 403);
        }

        // Responsable con independencia: completarla es entregarla y aceptarla
        // (ver actualizarEstadoTarea). También desde «En Revisión».
        if ($nuevo === 'Completada' && $actual->estado !== 'Completada'
            && app(CriteriosAceptacionController::class)->completaSola($actual)) {
            return null;
        }

        if ($nuevo === 'Completada') {
            return response()->json([
                'error' => 'Las tareas se cierran aceptando la entrega. Pásala a «' . self::EN_REVISION
                         . '» para que tu líder la revise.',
                'requiere_verificacion' => true,
            ], 409);
        }

        if ($actual->estado === self::EN_REVISION) {
            return response()->json([
                'error' => 'La tarea está en revisión: sale de ahí cuando se acepta la entrega o se devuelve con observaciones.',
                'en_revision' => true,
            ], 409);
        }

        if ($actual->estado === 'Completada' && !$this->supervisorAutorizado($actual)) {
            return response()->json([
                'error' => 'La tarea ya fue aceptada: sólo tu líder puede reabrirla.',
                'cerrada' => true,
            ], 403);
        }

        return null;
    }

    /**
     * Una tarea aprobada queda cerrada a la edición de su responsable hasta que
     * el líder la habilite (habilitarEdicion). Antes solo lo aplicaba la
     * pantalla. El líder y administración sí pueden editarla, y también su
     * responsable si tiene independencia: no depende de nadie que la habilite
     * (igual que la pantalla y que supervisorAutorizado).
     */
    private function bloqueadaPorAprobacion(object $tarea): ?\Illuminate\Http\JsonResponse
    {
        if ((int) ($tarea->aprobada ?? 0) !== 1 || (int) ($tarea->editable ?? 1) !== 0) {
            return null;
        }
        $yo = AccesoTareas::usuario();
        $empleado = (int) $tarea->empleado;
        if (AccesoTareas::esAdministracion($yo) || AccesoTareas::lidera($yo, $empleado)) {
            return null;
        }
        if (AccesoTareas::esPropio($yo, $empleado)
            && strcasecmp(trim((string) ($yo->independencia ?? '')), 'Si') === 0) {
            return null;
        }

        return response()->json([
            'error' => 'La tarea está aprobada: pide a tu líder que habilite la edición.',
        ], 403);
    }

    /**
     * Carga la tarea y exige supervisor. Devuelve la tarea, o la respuesta de
     * error lista para devolver (404 si no existe, 403 si no está autorizado).
     */
    private function exigirSupervisor($id)
    {
        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', (int) $id)->first();
        if (!$tarea) {
            return response()->json(['error' => 'Tarea no encontrada'], 404);
        }

        if (!$this->supervisorAutorizado($tarea)) {
            return response()->json([
                'error' => 'No tienes permiso para supervisar esta tarea. Lo hace el líder del responsable.',
            ], 403);
        }

        return $tarea;
    }

    private function resolutorAutorizado($tarea): ?object
    {
        $email = Auth::user()->email ?? null;
        if (!$email) {
            return null;
        }

        $usuarioActual = DB::connection('mysql2')->table('users')->where('email', $email)->first();
        if (!$usuarioActual || !$tarea) {
            return null;
        }

        if (strcasecmp($usuarioActual->tipo_usuario ?? '', 'Administrador') === 0) {
            return $usuarioActual;
        }

        if (!$usuarioActual->empleado) {
            return null;
        }

        // El dueño de la tarea no resuelve su propia solicitud.
        if ((int) $usuarioActual->empleado === (int) $tarea->empleado) {
            return null;
        }

        $esLiderDeAsignado = DB::connection('mysql2')->table('lideres_empleados')
            ->where('lider', $usuarioActual->empleado)
            ->where('empleado', $tarea->empleado)
            ->exists();

        return $esLiderDeAsignado ? $usuarioActual : null;
    }

    private function usuarioEsLiderParaNotificaciones($u): bool
    {
        if (!$u || strcasecmp($u->tipo_usuario ?? '', 'Administrador') === 0) {
            return false;
        }
        if (strcasecmp(trim($u->tipo_usuario ?? ''), 'Lider') === 0) {
            return true;
        }
        $tipo = strtolower($u->tipo_usuario ?? '');
        if ($tipo !== '' && str_contains($tipo, 'lider')) {
            return true;
        }
        $lid = strtolower(trim((string) ($u->lider ?? '')));

        return $lid === 'si' || $lid === 'sí';
    }

    /**
     * Inserta notificación in-app y envía correo al líder (empleado) o al administrador (líder).
     */
    private function notificarSolicitudPausa($tarea, $usuarioActual, string $motivo, string $fechaReanudacion): void
    {
        $titulo = $tarea->titulo ?? 'Tarea';
        $actorNombre = $usuarioActual->name ?? 'Usuario';

        $empleadoAsignado = DB::connection('mysql2')->table('empleados')->where('id', $tarea->empleado)->first();
        $nombreAsignado = $empleadoAsignado
            ? trim(($empleadoAsignado->nombres ?? '') . ' ' . ($empleadoAsignado->apellidos ?? ''))
            : 'Asignado';

        $mensajeBase = $actorNombre . ' ha solicitado pausa para la tarea «' . $titulo . '» (asignada a ' . $nombreAsignado . '). '
            . 'Motivo: ' . $motivo . '. Fecha de reanudación prevista: ' . $fechaReanudacion . '.';

        if (strcasecmp($usuarioActual->tipo_usuario ?? '', 'Administrador') === 0) {
            return;
        }

        // Quien pide la pausa es líder: la aprueba administración. Si no, la
        // aprueban sus líderes: todos los activos, no sólo el primero (que
        // podía estar inactivo y quedarse con el aviso).
        $actorEmpleado = $usuarioActual->empleado ? (int) $usuarioActual->empleado : null;
        $lideres = $this->usuarioEsLiderParaNotificaciones($usuarioActual)
            ? []
            : \App\Support\Avisos::lideresActivos((int) $tarea->empleado, [(int) $tarea->empleado, $actorEmpleado]);

        if ($lideres !== []) {
            $receptores = DB::connection('mysql2')->table('users')
                ->whereIn('empleado', $lideres)
                ->where(fn ($q) => $q->whereNull('estado')->orWhere('estado', '<>', 'Inactivo'))
                ->get(['id', 'tipo_usuario', 'email', 'name']);
        } else {
            $receptores = \App\Support\Avisos::administracionDeSeguimiento();
        }

        try {
            \App\Support\Avisos::campanaUsuarios($receptores, $actorEmpleado, $mensajeBase, (int) $tarea->id, 'PausaSolicitada');
        } catch (\Exception $e) {
            // Sin aviso en la campana se intenta igual el correo.
        }

        foreach ($receptores as $receptor) {
            if (!filter_var(trim((string) $receptor->email), FILTER_VALIDATE_EMAIL)) {
                continue;
            }
            try {
                Mail::to(trim($receptor->email))->send(new NotificacionMailable([
                    'name' => $receptor->name ?? 'Usuario',
                    'message' => $mensajeBase,
                ]));
            } catch (\Exception $e) {
                // No bloquear la solicitud de pausa si el correo falla
            }
        }
    }

    function reprogramarTarea($id, Request $request)
    {
        $tarea = AccesoTareas::exigir($id, 'modificar');
        if (AccesoTareas::esRespuesta($tarea)) {
            return $tarea;
        }

        // Antes sin validar: sin fecha o con texto daba 500, y se podía
        // reprogramar al pasado.
        $data = $request->validate([
            'fecha_pactada'         => 'required|date|after_or_equal:' . \App\Support\IndiceDesempeno::hoy()->toDateString(),
            'motivo_reprogramacion' => 'required|string|min:3|max:1000',
        ], [
            'fecha_pactada.required'         => 'Indica la nueva fecha.',
            'fecha_pactada.date'             => 'La nueva fecha no es válida.',
            'fecha_pactada.after_or_equal'   => 'La nueva fecha no puede ser anterior a hoy.',
            'motivo_reprogramacion.required' => 'Explica el motivo de la reprogramación.',
        ]);
        
        try {
            $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $id)->update([
                'fecha_pactada' => $data['fecha_pactada'],
                'motivo_reprogramacion' => $data['motivo_reprogramacion'],
                'reprogramada' => 1
            ]);

            $fechaFmt = Carbon::parse($data['fecha_pactada'])->format('d/m/Y');
            $actor = DB::connection('mysql2')->table('users')->where('email', Auth::user()->email)->value('name') ?? 'Usuario';
            $motivo = trim($data['motivo_reprogramacion'] ?? '');
            $motivoStr = $motivo ? " Motivo: {$motivo}." : '';
            $this->registrarActividad($id, 'Reprogramada', "Tarea reprogramada por {$actor}. Nueva fecha: {$fechaFmt}.{$motivoStr}");

            return response()->json(['success' => 'Tarea reprogramada correctamente'], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    function obtenerObservacion($id)
    {
        $observacion = DB::connection('mysql2')->table('observaciones_tareas')->where('id', $id)->first();
        if (!$observacion) {
            return response()->json(['error' => 'Observación no encontrada.'], 404);
        }
        $usuario = DB::connection('mysql2')->table('users')->where('id', $observacion->creador)->first();
        $receptor = $usuario ? DB::connection('mysql')->table('users')->where('email', $usuario->email)->first() : null;
        if (!$receptor) {
            return response()->json(['error' => 'Quien escribió la observación ya no está disponible.'], 404);
        }

        return response()->json(['idReceptor' => $receptor->id]);
    }

    // ─── Proyectos ──────────────────────────────────────────────────────────────

    function cargarProyectos(Request $request)
    {
        // Los proyectos cancelados se ocultan por defecto: no deben ofrecerse al
        // asignar tareas nuevas. La pantalla de gestión los pide con
        // ?incluir_cancelados=1 para poder consultarlos y reactivarlos.
        $incluirCancelados = filter_var(
            $request->query('incluir_cancelados', false),
            FILTER_VALIDATE_BOOLEAN
        );

        $proyectos = DB::connection('mysql2')->table('proyectos')
            ->leftJoin('empresas', 'proyectos.empresa', 'empresas.id')
            ->select('proyectos.*', 'empresas.nombre as empresa_nombre', 'empresas.id as empresa_id')
            ->when(!$incluirCancelados, function ($q) {
                $q->where(function ($w) {
                    $w->whereNull('proyectos.estado')
                      ->orWhere('proyectos.estado', '<>', 'Cancelado');
                });
            })
            ->orderBy('proyectos.nombre')
            ->get();

        return response()->json($proyectos);
    }

    function guardarProyecto(Request $request)
    {
        if ($request->input('accion') === 'editar'
            && !DB::connection('mysql2')->table('proyectos')->where('id', (int) $request->input('id'))->exists()) {
            return response()->json(['error' => 'Proyecto no encontrado.'], 404);
        }
        $validos = $this->validarParametro($request, [
            'accion'      => 'required|in:guardar,editar',
            'nombre'      => 'required|string|max:200',
            'municipio'   => 'nullable|string|max:150',
            'empresa'     => 'nullable|integer|exists:mysql2.empresas,id',
            'fechaInicio' => 'nullable|date',
            'fechaFin'    => 'nullable|date',
        ], [
            'nombre.required' => 'El nombre del proyecto es obligatorio.',
            'empresa.exists'  => 'La empresa no existe.',
        ]);
        if ($validos instanceof \Illuminate\Http\JsonResponse) {
            return $validos;
        }
        $proyecto = $request->all();

        DB::connection('mysql2')->beginTransaction();
        try {
            $datos = [
                'nombre'           => $proyecto['nombre'],
                'municipio'        => $proyecto['municipio'] ?? null,
                'empresa'          => $proyecto['empresa'] ?? null,
                'fecha_inicio'     => $proyecto['fechaInicio'] ?? null,
                'fecha_fin_estimada' => $proyecto['fechaFin'] ?? null,
                'estado'           => 'Activo',
            ];

            if ($proyecto['accion'] == 'guardar') {
                DB::connection('mysql2')->table('proyectos')->insert($datos);
            } else {
                $resultado = DB::connection('mysql2')->table('proyectos')
                    ->where('id', $proyecto['id'])
                    ->update($datos);

                if ($resultado === false) {
                    throw new \Exception('Error al actualizar el proyecto');
                }
            }

            DB::connection('mysql2')->commit();
            return response()->json(['success' => 'Proyecto guardado correctamente'], 200);
        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            return $this->errorAlGuardar($e, 'el proyecto');
        }
    }

    function eliminarProyecto($id)
    {
        $proyecto = DB::connection('mysql2')->table('proyectos')->where('id', $id)->first();
        if (!$proyecto) {
            return response()->json(['message' => 'Proyecto no encontrado'], 404);
        }

        // Baja lógica marcando el proyecto como Cancelado, un valor que el ENUM
        // de estado ya contempla. Antes se borraba la fila y, además, se ponía
        // proyecto_id a NULL en sus tareas: esa desvinculación era irreversible
        // —no quedaba constancia de a qué proyecto pertenecía cada tarea— y el
        // informe de proyectos perdía ese historial. Ahora el vínculo se
        // conserva y el proyecto deja de ofrecerse para nuevas asignaciones.
        DB::connection('mysql2')->table('proyectos')->where('id', $id)
            ->update(['estado' => 'Cancelado']);

        $tareas = DB::connection('mysql2')->table('tareas_empleados')
            ->where('proyecto_id', $id)->count();

        return response()->json([
            'success' => true,
            'message' => 'Proyecto cancelado',
            'tareas_conservadas' => $tareas,
        ]);
    }

    function importarProyectosIniciales()
    {
        $proyectos = [
            ['municipio' => 'RIOHACHA',        'nombre' => 'IMPLEMENTACIÓN DE AMBIENTES EDUCATIVOS TECNOLÓGICOS PARA EL FORTALECIMIENTO DEL APRENDIZAJE INTEGRAL EN SEDES EDUCATIVAS OFICIALES DE RIOHACHA Y FONSECA, LA GUAJIRA'],
            ['municipio' => 'DISTRACCIÓN',     'nombre' => 'IMPLEMENTACIÓN DE AMBIENTES TECNOLÓGICOS DE APRENDIZAJE EN SEDES EDUCATIVAS OFICIALES DE LOS MUNICIPIOS DE DISTRACCIÓN Y FONSECA EN EL DEPARTAMENTO DE LA GUAJIRA'],
            ['municipio' => 'BECERRIL',        'nombre' => 'MEJORAMIENTO INTEGRAL DE LA INFRAESTRUCTURA EDUCATIVA Y DOTACIÓN DE AMBIENTES ACADÉMICOS ESPECIALIZADOS EN EL MUNICIPIO DE BECERRIL, CESAR'],
            ['municipio' => 'BECERRIL',        'nombre' => 'MEJORAMIENTO DE INFRAESTRUCTURA EDUCATIVA PARA LA IMPLEMENTACIÓN DE AMBIENTES PEDAGÓGICOS INNOVADORES EN LA INSTITUCIÓN EDUCATIVA TRUJILLO SEDE (1) DEL MUNICIPIO DE BECERRIL, CESAR'],
            ['municipio' => 'SAN JUAN DEL CESAR', 'nombre' => 'IMPLEMENTACIÓN DE AMBIENTES TECNOLÓGICOS DE APRENDIZAJE EN LAS SEDES EDUCATIVAS PÚBLICAS DEL MUNICIPIO DE SAN JUAN DEL CESAR, LA GUAJIRA'],
            ['municipio' => 'VALLEDUPAR',      'nombre' => 'FORTALECIMIENTO DE LA CALIDAD EDUCATIVA MEDIANTE LA IMPLEMENTACIÓN DE AMBIENTES TECNOLÓGICOS Y EL MEJORAMIENTO DE LA INFRAESTRUCTURA EDUCATIVA EN LAS SEDES EDUCATIVAS OFICIALES RURALES DEL MUNICIPIO DE VALLEDUPAR, CESAR'],
            ['municipio' => 'URUMITA',         'nombre' => 'FORTALECIMIENTO DE LA CALIDAD EDUCATIVA MEDIANTE EL MEJORAMIENTO DE AMBIENTES TECNOLÓGICOS PARA LA EDUCACIÓN INTEGRAL EN LAS SEDES EDUCATIVAS PÚBLICAS DEL MUNICIPIO DE URUMITA, LA GUAJIRA'],
            ['municipio' => 'NOROSÍ',          'nombre' => 'SUMINISTRO DE HERRAMIENTAS TECNOLOGICAS PARA EL FORTALECIMIENTO DE LA EDUCACIÓN EN LAS SEDES EDUCATIVAS OFICIALES DEL MUNICIPIO DE NOROSÍ, BOLIVAR'],
            ['municipio' => 'YONDÓ',           'nombre' => 'SUMINISTRO DE HERRAMIENTAS TECNOLÓGICAS PARA EL FORTALECIMIENTO DE LA EDUCACIÓN EN LAS SEDES EDUCATIVAS OFICIALES DEL MUNICIPIO DE YONDO, ANTIOQUIA'],
            ['municipio' => 'EL PASO',         'nombre' => 'FORTALECIMIENTO DE LA CALIDAD EDUCATIVA MEDIANTE LA CREACIÓN DE AMBIENTES TECNOLÓGICOS PARA LA EDUCACIÓN INTEGRAL EN EL MUNICIPIO DE EL PASO CESAR'],
            ['municipio' => 'FONSECA',         'nombre' => 'FORTALECIMIENTO DE LA CALIDAD EDUCATIVA MEDIANTE EL MEJORAMIENTO DE AMBIENTES TECNOLÓGICOS PARA LA EDUCACIÓN INTEGRAL EN LAS SEDES EDUCATIVAS PÚBLICAS DEL MUNICIPIO DE FONSECA, LA GUAJIRA'],
        ];

        $insertados = 0;
        foreach ($proyectos as $p) {
            $existe = DB::connection('mysql2')->table('proyectos')
                ->where('nombre', $p['nombre'])
                ->exists();

            if (!$existe) {
                DB::connection('mysql2')->table('proyectos')->insert([
                    'nombre'    => $p['nombre'],
                    'municipio' => $p['municipio'],
                    'estado'    => 'Activo',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $insertados++;
            }
        }

        return response()->json(['success' => true, 'insertados' => $insertados]);
    }

    // ─── Subtareas ───────────────────────────────────────────────────────────────

    function cargarSubtareas($tarea_id)
    {
        $tareaPadre = AccesoTareas::exigir($tarea_id);
        if (AccesoTareas::esRespuesta($tareaPadre)) {
            return $tareaPadre;
        }

        $subtareas = DB::connection('mysql2')->table('subtareas')
            ->where('tarea_id', $tarea_id)
            ->orderBy('orden')
            ->orderBy('id')
            ->get();

        return response()->json($subtareas);
    }

    function guardarSubtarea(Request $request)
    {
        $tareaPadre = AccesoTareas::exigir($request->input('tarea_id'), 'modificar');
        if (AccesoTareas::esRespuesta($tareaPadre)) {
            return $tareaPadre;
        }

        // La columna es NOT NULL: sin título respondía 500.
        $request->validate([
            'titulo'            => 'required|string|max:255',
            'fecha_vencimiento' => 'nullable|date',
        ], [
            'titulo.required' => 'Escribe el punto del checklist.',
        ]);

        $id = DB::connection('mysql2')->table('subtareas')->insertGetId([
            'tarea_id'          => $request->tarea_id,
            'titulo'            => $request->titulo,
            'completada'        => 0,
            'fecha_vencimiento' => $request->fecha_vencimiento ?: null,
            'orden'             => $request->orden ?? 0,
            'checklist_titulo'  => $request->checklist_titulo ?? null,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        $subtarea = DB::connection('mysql2')->table('subtareas')->where('id', $id)->first();

        // Las subtareas se borran físicamente al quitarlas del checklist, así que
        // el historial de la tarea es el único lugar donde queda constancia de
        // quién añadió, completó o eliminó cada punto.
        $this->registrarActividad(
            (int) $request->tarea_id,
            'Checklist',
            "{$this->nombreActor()} agregó el punto \"{$request->titulo}\" al checklist."
        );

        return response()->json(['success' => true, 'subtarea' => $subtarea]);
    }

    function actualizarSubtarea(Request $request, $id)
    {
        $punto = DB::connection('mysql2')->table('subtareas')->where('id', $id)->first();
        if (!$punto) {
            return response()->json(['error' => 'Punto del checklist no encontrado'], 404);
        }
        $tareaPadre = AccesoTareas::exigir($punto->tarea_id, 'modificar');
        if (AccesoTareas::esRespuesta($tareaPadre)) {
            return $tareaPadre;
        }

        $previa = DB::connection('mysql2')->table('subtareas')->where('id', $id)->first();
        $data = ['updated_at' => now()];

        if ($request->has('completada')) {
            $data['completada'] = $request->completada ? 1 : 0;
        }
        if ($request->has('titulo')) {
            $data['titulo'] = $request->titulo;
        }
        if ($request->has('fecha_vencimiento')) {
            $data['fecha_vencimiento'] = $request->fecha_vencimiento ?: null;
        }
        if ($request->has('checklist_titulo')) {
            $data['checklist_titulo'] = $request->checklist_titulo ?: null;
        }

        DB::connection('mysql2')->table('subtareas')->where('id', $id)->update($data);

        $subtarea = DB::connection('mysql2')->table('subtareas')->where('id', $id)->first();

        if ($previa && $subtarea) {
            $actor = $this->nombreActor();
            $titulo = $subtarea->titulo;

            // Sólo se registra el marcado y desmarcado, que es lo que refleja el
            // avance real. Un cambio de texto o de fecha no altera el progreso y
            // llenaría el historial de ruido.
            if (array_key_exists('completada', $data)
                && (int) $previa->completada !== (int) $data['completada']) {
                $this->registrarActividad(
                    (int) $subtarea->tarea_id,
                    'Checklist',
                    $data['completada']
                        ? "{$actor} completó el punto \"{$titulo}\" del checklist."
                        : "{$actor} reabrió el punto \"{$titulo}\" del checklist."
                );
            } elseif (array_key_exists('titulo', $data) && $previa->titulo !== $subtarea->titulo) {
                $this->registrarActividad(
                    (int) $subtarea->tarea_id,
                    'Checklist',
                    "{$actor} renombró un punto del checklist: \"{$previa->titulo}\" → \"{$titulo}\"."
                );
            }
        }

        return response()->json(['success' => true, 'subtarea' => $subtarea]);
    }

    function eliminarSubtarea($id)
    {
        $punto = DB::connection('mysql2')->table('subtareas')->where('id', $id)->first();
        if (!$punto) {
            return response()->json(['error' => 'Punto del checklist no encontrado'], 404);
        }
        $tareaPadre = AccesoTareas::exigir($punto->tarea_id, 'modificar');
        if (AccesoTareas::esRespuesta($tareaPadre)) {
            return $tareaPadre;
        }

        // Se lee antes de borrar: la fila desaparece y el historial es el único
        // registro que queda del punto eliminado.
        $subtarea = DB::connection('mysql2')->table('subtareas')->where('id', $id)->first();

        DB::connection('mysql2')->table('subtareas')->where('id', $id)->delete();

        if ($subtarea) {
            $this->registrarActividad(
                (int) $subtarea->tarea_id,
                'Checklist',
                "{$this->nombreActor()} eliminó el punto \"{$subtarea->titulo}\" del checklist."
            );
        }

        return response()->json(['success' => true]);
    }

    function checklistsEmpleado($empleado_id)
    {
        if (!AccesoTareas::alcanza((int) $empleado_id)) {
            return AccesoTareas::denegada();
        }

        $tareas = DB::connection('mysql2')->table('tareas_empleados')
            ->whereIn('id', function($q) {
                $q->select('tarea_id')->from('subtareas');
            })
            ->where('empleado', $empleado_id)
            ->select('id', 'titulo')
            ->orderBy('id', 'desc')
            ->get();

        $result = [];
        foreach ($tareas as $tarea) {
            $items = DB::connection('mysql2')->table('subtareas')
                ->where('tarea_id', $tarea->id)
                ->select('titulo', 'fecha_vencimiento', 'checklist_titulo')
                ->orderBy('orden')->orderBy('id')
                ->get();
            if ($items->isNotEmpty()) {
                $result[] = [
                    'tarea_id'        => $tarea->id,
                    'tarea_titulo'    => $tarea->titulo,
                    'checklist_titulo'=> $items->first()->checklist_titulo ?? null,
                    'items'           => $items->map(fn($s) => [
                        'titulo'           => $s->titulo,
                        'fecha_vencimiento'=> $s->fecha_vencimiento,
                    ])->values()
                ];
            }
        }

        return response()->json($result);
    }

    // ── Gestión de Departamentos ──────────────────────────────────────────────

    function cargarDepartamentosDetalle()
    {
        // Activos e inactivos: desactivar un departamento no lo saca de la
        // gestión, para poder reactivarlo. Sólo se ocultan los eliminados.
        // El usuario del líder va en subconsultas: un JOIN con users repetía
        // el departamento si el líder tenía más de un usuario.
        $departamentos = DB::connection('mysql2')->table('departamentos')
            ->leftJoin('empleados as e', 'departamentos.lider_id', '=', 'e.id')
            ->select(
                'departamentos.id',
                'departamentos.nombre',
                DB::raw("COALESCE(departamentos.estado, 'Activo') as estado"),
                'departamentos.lider_id',
                DB::raw("CONCAT(e.nombres, ' ', e.apellidos) as lider_nombre"),
                'e.id as lider_emp_id',
                DB::raw('(SELECT u.id FROM users u WHERE u.empleado = e.id ORDER BY u.id LIMIT 1) as lider_user_id'),
                DB::raw('(SELECT u.independencia FROM users u WHERE u.empleado = e.id ORDER BY u.id LIMIT 1) as lider_independencia'),
                DB::raw("(SELECT COUNT(*) FROM empleados WHERE departamento = departamentos.id AND estado_registro = 'Activo' AND estado = 'Activo') as total_empleados")
            )
            ->whereRaw(self::DEPARTAMENTO_VISIBLE)
            ->orderByRaw("COALESCE(departamentos.estado, 'Activo') = 'Inactivo'")
            ->orderBy('departamentos.nombre')
            ->get();
        return response()->json($departamentos);
    }

    function crearDepartamento(Request $request)
    {
        if (!$this->puedeAdministrar()) {
            return response()->json(['message' => 'No tienes permiso para gestionar departamentos.'], 403);
        }
        $datos = $request->validate([
            'nombre'   => 'required|string|max:200',
            'lider_id' => 'nullable|integer',
        ]);

        $id = DB::connection('mysql2')->table('departamentos')->insertGetId([
            'nombre' => trim($datos['nombre']),
            'estado' => 'Activo',
        ]);
        if (!empty($datos['lider_id'])) {
            $error = $this->fijarLiderDepartamento($id, (int) $datos['lider_id']);
            if ($error) return $error;
        }
        return response()->json(['id' => $id, 'message' => 'Departamento creado']);
    }

    function editarDepartamento(Request $request, $id)
    {
        if (!$this->puedeAdministrar()) {
            return response()->json(['message' => 'No tienes permiso para gestionar departamentos.'], 403);
        }
        $datos = $request->validate([
            'nombre'   => 'required|string|max:200',
            'estado'   => 'nullable|in:Activo,Inactivo',
            'lider_id' => 'nullable|integer',
        ]);

        DB::connection('mysql2')->table('departamentos')->where('id', $id)->update([
            'nombre' => trim($datos['nombre']),
            'estado' => $datos['estado'] ?? 'Activo',
        ]);
        // El líder sólo se toca si el formulario lo envía: el botón de
        // activar y desactivar manda nombre y estado, y no debe quitarlo.
        if ($request->has('lider_id')) {
            $error = $this->fijarLiderDepartamento((int) $id, $datos['lider_id'] ? (int) $datos['lider_id'] : null);
            if ($error) return $error;
        }
        return response()->json(['message' => 'Departamento actualizado']);
    }

    function eliminarDepartamento($id)
    {
        if (!$this->puedeAdministrar()) {
            return response()->json(['message' => 'No tienes permiso para gestionar departamentos.'], 403);
        }
        $count = DB::connection('mysql2')->table('empleados')
            ->where('departamento', $id)
            ->where('estado_registro', 'Activo')
            ->count();
        if ($count > 0) {
            return response()->json(['message' => 'No se puede eliminar: tiene empleados activos asignados'], 422);
        }

        // Baja lógica en vez de borrado físico. La guarda anterior sólo cuenta
        // empleados activos, de modo que un departamento con empleados dados de
        // baja seguía siendo borrable: al desaparecer la fila, sus fichas y el
        // historial de tareas se quedaban apuntando a un departamento inexistente
        // y los informes perdían esa trazabilidad. Los ocho departamentos tienen
        // tareas asociadas, así que conservarlos importa.
        //
        // «Eliminado» y no «Inactivo»: inactivo es un estado reversible que se
        // sigue viendo en la gestión; eliminado sale de ella.
        DB::connection('mysql2')->table('departamentos')->where('id', $id)
            ->update(['estado' => 'Eliminado']);

        return response()->json(['message' => 'Departamento eliminado']);
    }

    function asignarLiderDepartamento(Request $request, $id)
    {
        if (!$this->puedeAdministrar()) {
            return response()->json(['message' => 'No tienes permiso para asignar líderes.'], 403);
        }
        $request->validate(['lider_id' => 'nullable|integer']);

        $error = $this->fijarLiderDepartamento((int) $id, $request->lider_id ? (int) $request->lider_id : null);
        if ($error) return $error;

        return response()->json(['message' => $request->lider_id ? 'Líder asignado correctamente' : 'El departamento quedó sin líder']);
    }

    /**
     * Pone o quita el líder de un departamento y deja coherente lo que
     * depende de ello: la marca de líder del empleado y de su usuario, y a
     * quién reporta cada empleado del área (lideres_empleados).
     *
     * Antes sólo cambiaba departamentos.lider_id: el líder nuevo no veía a
     * su equipo hasta que se volvía a guardar la ficha de cada empleado.
     *
     * Devuelve una respuesta de error, o null si todo fue bien.
     */
    private function fijarLiderDepartamento(int $deptId, ?int $nuevoLiderId)
    {
        $conn = DB::connection('mysql2');

        if ($nuevoLiderId) {
            $valido = $conn->table('empleados')->where('id', $nuevoLiderId)
                ->where('estado_registro', 'Activo')->where('estado', 'Activo')->exists();
            if (!$valido) {
                return response()->json(['message' => 'El líder debe ser un empleado activo.'], 422);
            }
        }

        $anterior = $conn->table('departamentos')->where('id', $deptId)->value('lider_id');

        $conn->transaction(function () use ($conn, $deptId, $nuevoLiderId, $anterior) {
            $conn->table('departamentos')->where('id', $deptId)->update(['lider_id' => $nuevoLiderId]);

            if ($nuevoLiderId) {
                $conn->table('empleados')->where('id', $nuevoLiderId)->update(['lider' => 'Si']);
                $conn->table('users')->where('empleado', $nuevoLiderId)->update(['lider' => 'Si']);
            }

            $delArea = $conn->table('empleados')->where('departamento', $deptId)
                ->where('estado_registro', 'Activo')->pluck('id');

            // El equipo deja de reportar al líder saliente…
            if ($anterior && (int) $anterior !== (int) $nuevoLiderId) {
                $conn->table('lideres_empleados')->where('lider', $anterior)
                    ->whereIn('empleado', $delArea)->delete();

                // …y si ya no lidera ningún departamento, deja de ser líder.
                $sigueComoLider = $conn->table('departamentos')->where('lider_id', $anterior)
                    ->whereRaw("(estado IS NULL OR estado <> 'Eliminado')")->exists();
                if (!$sigueComoLider) {
                    $conn->table('empleados')->where('id', $anterior)->update(['lider' => 'No']);
                    $conn->table('users')->where('empleado', $anterior)->update(['lider' => 'No']);
                }
            }

            // …y pasa a reportar al nuevo, igual que hace guardarEmpleado.
            if ($nuevoLiderId) {
                foreach ($delArea as $empId) {
                    if ((int) $empId === $nuevoLiderId) continue;
                    $conn->table('lideres_empleados')->updateOrInsert(
                        ['lider' => $nuevoLiderId, 'empleado' => $empId]
                    );
                }
            }
        });

        return null;
    }

    // ── Gestión de Cargos ─────────────────────────────────────────────────────

    function cargarCargos()
    {
        // Se excluyen los inactivos; NULL cuenta como activo por compatibilidad
        // con los registros anteriores a esta columna.
        $cargos = DB::connection('mysql2')->table('cargos')
            ->select('cargos.*',
                DB::raw("(SELECT COUNT(*) FROM empleados WHERE empleados.cargo = cargos.id AND empleados.estado_registro = 'Activo') as total_empleados")
            )
            ->where(function ($q) {
                $q->whereNull('estado')->orWhere('estado', '<>', 'Inactivo');
            })
            ->orderBy('nombre')
            ->get();
        return response()->json($cargos);
    }

    function crearCargo(Request $request)
    {
        $nombre = trim($request->nombre ?? '');
        if (!$nombre) return response()->json(['message' => 'El nombre es obligatorio'], 422);

        // Con la baja lógica un nombre puede seguir ocupado por un cargo
        // inactivo. En ese caso se reactiva en lugar de rechazar la creación:
        // de otro modo el nombre quedaría bloqueado para siempre sin que el
        // usuario vea el registro que lo retiene.
        $existe = DB::connection('mysql2')->table('cargos')
            ->whereRaw('LOWER(nombre) = ?', [mb_strtolower($nombre, 'UTF-8')])->first();

        if ($existe) {
            if (strcasecmp(trim($existe->estado ?? 'Activo'), 'Inactivo') === 0) {
                DB::connection('mysql2')->table('cargos')->where('id', $existe->id)
                    ->update(['estado' => 'Activo']);
                return response()->json(['id' => $existe->id, 'message' => 'Cargo reactivado']);
            }
            return response()->json(['message' => 'Ya existe un cargo con ese nombre'], 422);
        }

        $id = DB::connection('mysql2')->table('cargos')->insertGetId([
            // mb_: strtoupper no es multibyte y «Diseñador» quedaba «DISEñADOR».
            'nombre' => mb_strtoupper($nombre, 'UTF-8'),
            'estado' => 'Activo',
        ]);
        return response()->json(['id' => $id, 'message' => 'Cargo creado']);
    }

    function actualizarCargo(Request $request, $id)
    {
        $cargo = DB::connection('mysql2')->table('cargos')->where('id', $id)->first();
        if (!$cargo) {
            return response()->json(['message' => 'Cargo no encontrado', 'error' => 'Cargo no encontrado'], 404);
        }

        $nombre = trim($request->nombre ?? '');
        if (!$nombre) return response()->json(['message' => 'El nombre es obligatorio'], 422);

        $estado = $request->estado ?? ($cargo->estado ?: 'Activo');
        if (!in_array($estado, ['Activo', 'Inactivo'], true)) {
            return response()->json(['message' => 'El estado debe ser Activo o Inactivo'], 422);
        }

        // Inactivarlo editándolo pasa por la misma guarda que eliminarlo.
        if ($estado === 'Inactivo' && strcasecmp(trim($cargo->estado ?? 'Activo'), 'Inactivo') !== 0) {
            $count = DB::connection('mysql2')->table('empleados')
                ->where('cargo', $id)->where('estado_registro', 'Activo')->count();
            if ($count > 0) {
                return response()->json(['message' => "No se puede inactivar: tiene $count empleado(s) activo(s) asignado(s)"], 422);
            }
        }

        $existe = DB::connection('mysql2')->table('cargos')
            ->whereRaw('LOWER(nombre) = ?', [mb_strtolower($nombre, 'UTF-8')])
            ->where('id', '!=', $id)->exists();
        if ($existe) return response()->json(['message' => 'Ya existe un cargo con ese nombre'], 422);

        DB::connection('mysql2')->table('cargos')->where('id', $id)->update([
            'nombre' => mb_strtoupper($nombre, 'UTF-8'),
            'estado' => $estado,
        ]);
        return response()->json(['message' => 'Cargo actualizado']);
    }

    function eliminarCargo($id)
    {
        if (!DB::connection('mysql2')->table('cargos')->where('id', $id)->exists()) {
            return response()->json(['message' => 'Cargo no encontrado', 'error' => 'Cargo no encontrado'], 404);
        }
        $count = DB::connection('mysql2')->table('empleados')
            ->where('cargo', $id)->where('estado_registro', 'Activo')->count();
        if ($count > 0) {
            return response()->json(['message' => "No se puede eliminar: tiene $count empleado(s) activo(s) asignado(s)"], 422);
        }

        // Baja lógica, por el mismo motivo que en departamentos: la guarda sólo
        // mira empleados activos y el cargo aparece en fichas e informes de
        // personas ya dadas de baja.
        DB::connection('mysql2')->table('cargos')->where('id', $id)
            ->update(['estado' => 'Inactivo']);

        return response()->json(['message' => 'Cargo inactivado']);
    }

    function empleadosDepartamento($id)
    {
        $empleados = DB::connection('mysql2')->table('empleados')
            ->leftJoin('users as u', 'empleados.id', '=', 'u.empleado')
            ->leftJoin('cargos', 'empleados.cargo', '=', 'cargos.id')
            ->select(
                'empleados.id',
                'empleados.nombres',
                'empleados.apellidos',
                'empleados.email',
                'empleados.foto',
                'empleados.lider',
                'cargos.nombre as nombre_cargo',
                'u.id as user_id',
                'u.lider as user_lider',
                'u.independencia'
            )
            ->where('empleados.departamento', $id)
            ->where('empleados.estado_registro', 'Activo')
            ->where('empleados.estado', 'Activo')
            ->orderBy('empleados.nombres')
            ->get();
        return response()->json($empleados);
    }

    function toggleIndependencia(Request $request, $id)
    {
        $user = DB::connection('mysql2')->table('users')->where('id', $id)->first();
        if (!$user) {
            return response()->json(['message' => 'Usuario no encontrado'], 404);
        }
        $nuevo = ($user->independencia === 'Si') ? 'No' : 'Si';
        DB::connection('mysql2')->table('users')->where('id', $id)->update(['independencia' => $nuevo]);
        return response()->json(['independencia' => $nuevo]);
    }

    // ── Actividades y Comentarios de Tarea ────────────────────────────────────

    function actividadesComentariosTarea($id)
    {
        $tarea = AccesoTareas::exigir($id);
        if (AccesoTareas::esRespuesta($tarea)) {
            return $tarea;
        }

        $actividades = DB::connection('mysql2')->table('notif_generales')
            ->where('tarea_id', $id)
            ->orderByDesc('id')
            ->get()
            ->map(fn($n) => [
                'tipo_entrada' => 'actividad',
                'id'           => 'a_' . $n->id,
                'texto'        => $n->mensaje,
                'tipo'         => $n->tipo,
                'autor'        => null,
                'fecha'        => $n->fecha_creacion,
            ])
            ->groupBy(fn($n) => $n['tipo'] . '||' . $n['texto'])
            ->map(function ($grupo) {
                $primero = $grupo->first();
                $count   = $grupo->count();
                if ($count > 1) {
                    $primero['texto'] .= ' (×' . $count . ')';
                }
                return $primero;
            })
            ->values();

        $comentarios = DB::connection('mysql2')->table('observaciones_tareas')
            ->join('users', 'observaciones_tareas.creador', '=', 'users.id')
            ->select('observaciones_tareas.*', 'users.name as nombre_autor')
            ->where('id_tarea', $id)
            ->get()
            ->map(fn($c) => [
                'tipo_entrada' => 'comentario',
                'id'           => 'c_' . $c->id,
                'texto'        => $c->observaciones,
                'tipo'         => 'Comentario',
                'autor'        => $c->nombre_autor,
                'fecha'        => $c->fecha . ' 00:00:00',
            ]);

        $merged = $actividades->concat($comentarios)
            ->sortByDesc('fecha')
            ->values();

        return response()->json($merged);
    }

    // ── Reprogramaciones ─────────────────────────────────────────────────────

    function solicitarReprogramacion(Request $request)
    {
        // Si tarea_id no es un número, la validación de abajo responde 422.
        if (filter_var($request->input('tarea_id'), FILTER_VALIDATE_INT) !== false) {
            $tareaPadre = AccesoTareas::exigir($request->input('tarea_id'), 'modificar');
            if (AccesoTareas::esRespuesta($tareaPadre)) {
                return $tareaPadre;
            }
        }

        // solicitado_por, solicitado_por_user y tipo_aprobador se aceptan por
        // compatibilidad con el frontend actual pero NO se usan: el solicitante y
        // el tipo de aprobador se derivan del usuario autenticado, igual que en
        // solicitarPausa. Confiar en esos campos permitía que quien solicita
        // eligiera a su propio aprobador.
        $data = $request->validate([
            'tarea_id'             => 'required|integer',
            'solicitado_por'       => 'nullable|integer',
            'solicitado_por_user'  => 'nullable|integer',
            'fecha_actual'         => 'nullable|date',
            // La nueva fecha no puede estar en el pasado (día de Bogotá).
            'fecha_nueva'          => 'required|date|after_or_equal:' . \App\Support\IndiceDesempeno::hoy()->toDateString(),
            'motivo'               => 'required|string|min:5',
            'tipo_aprobador'       => 'nullable|in:lider,admin',
        ], [
            'fecha_nueva.after_or_equal' => 'La nueva fecha no puede ser anterior a hoy.',
        ]);

        $usuarioActual = DB::connection('mysql2')->table('users')->where('email', Auth::user()->email)->first();
        if (!$usuarioActual) {
            return response()->json(['message' => 'Usuario no encontrado'], 403);
        }

        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $data['tarea_id'])->first();
        if (!$tarea) {
            return response()->json(['message' => 'Tarea no encontrada'], 404);
        }
        // Aceptada ya está cerrada: no hay plazo que mover.
        if ($tarea->estado === 'Completada') {
            return response()->json(['message' => 'La tarea ya fue aceptada: no se puede reprogramar.'], 409);
        }

        $esDueño = $usuarioActual->empleado && (int) $usuarioActual->empleado === (int) $tarea->empleado;
        $esAdmin = strcasecmp($usuarioActual->tipo_usuario ?? '', 'Administrador') === 0;
        $esLiderDeAsignado = false;
        if (!$esDueño && !$esAdmin && $usuarioActual->empleado) {
            $esLiderDeAsignado = DB::connection('mysql2')->table('lideres_empleados')
                ->where('lider', $usuarioActual->empleado)
                ->where('empleado', $tarea->empleado)
                ->exists();
        }
        if (!$esDueño && !$esAdmin && !$esLiderDeAsignado) {
            return response()->json(['message' => 'No autorizado para solicitar reprogramación en esta tarea'], 403);
        }

        $usuarioEsLider = $this->usuarioEsLiderParaNotificaciones($usuarioActual) || $esLiderDeAsignado;
        $tipoAprobador  = $usuarioEsLider ? 'admin' : 'lider';

        // Sólo puede existir una solicitud pendiente por tarea
        $pendiente = DB::connection('mysql2')->table('reprogramaciones_tareas')
            ->where('tarea_id', $data['tarea_id'])
            ->where('estado', 'Pendiente')
            ->exists();
        if ($pendiente) {
            return response()->json(['message' => 'Ya existe una solicitud de reprogramación pendiente para esta tarea.'], 422);
        }

        $id = DB::connection('mysql2')->table('reprogramaciones_tareas')->insertGetId([
            'tarea_id'            => $data['tarea_id'],
            // La columna no admite nulos: un administrador sin ficha de empleado
            // queda como 0 (el usuario sigue en solicitado_por_user).
            'solicitado_por'      => (int) ($usuarioActual->empleado ?? 0),
            'solicitado_por_user' => $usuarioActual->id,
            'fecha_actual'        => $data['fecha_actual'] ?? $tarea->fecha_pactada,
            'fecha_nueva'         => $data['fecha_nueva'],
            'motivo'              => $data['motivo'],
            'estado'              => 'Pendiente',
            'tipo_aprobador'      => $tipoAprobador,
            'fecha_solicitud'     => now(),
        ]);

        $solicitante = $usuarioActual->name ?? 'Usuario';
        $fechaNuevaFmt = Carbon::parse($data['fecha_nueva'])->format('d/m/Y');
        // fecha_actual es opcional: sin ella se toma la pactada de la tarea
        // (antes daba error 500 al formatearla).
        $fechaActual = $data['fecha_actual'] ?? $tarea->fecha_pactada;
        $fechaActualFmt = $fechaActual ? Carbon::parse($fechaActual)->format('d/m/Y') : 'N/A';
        $this->registrarActividad(
            $data['tarea_id'],
            'Reprogramación solicitada',
            "Reprogramación solicitada por {$solicitante}. Nueva fecha: {$fechaNuevaFmt} (antes: {$fechaActualFmt}). Motivo: {$data['motivo']}."
        );

        return response()->json(['id' => $id, 'message' => 'Solicitud enviada correctamente'], 201);
    }

    function resolverReprogramacion(Request $request, $id)
    {
        // aprobado_por se acepta por compatibilidad con el frontend pero NO se usa:
        // el resolutor se deriva del usuario autenticado.
        $data = $request->validate([
            'accion'                => 'required|in:aprobar,rechazar',
            'aprobado_por'          => 'nullable|integer',
            'observacion_rechazo'   => 'nullable|string',
        ]);

        $reprg = DB::connection('mysql2')->table('reprogramaciones_tareas')->where('id', $id)->first();
        if (!$reprg) {
            return response()->json(['message' => 'Solicitud no encontrada'], 404);
        }
        if ($reprg->estado !== 'Pendiente') {
            return response()->json(['message' => 'La solicitud ya fue resuelta'], 422);
        }

        $tarea = DB::connection('mysql2')->table('tareas_empleados')->where('id', $reprg->tarea_id)->first();
        $resolutor = $this->resolutorAutorizado($tarea);
        if (!$resolutor) {
            return response()->json(['message' => 'No autorizado para resolver esta solicitud'], 403);
        }

        $estado = $data['accion'] === 'aprobar' ? 'Aprobada' : 'Rechazada';

        DB::connection('mysql2')->table('reprogramaciones_tareas')->where('id', $id)->update([
            'estado'               => $estado,
            'aprobado_por'         => $resolutor->id,
            'observacion_rechazo'  => $data['observacion_rechazo'] ?? null,
            'fecha_resolucion'     => now(),
        ]);

        $aprobadorNombre = $resolutor->name ?? 'Usuario';

        if ($data['accion'] === 'aprobar') {
            DB::connection('mysql2')->table('tareas_empleados')->where('id', $reprg->tarea_id)->update([
                'fecha_pactada'          => $reprg->fecha_nueva,
                'motivo_reprogramacion'  => $reprg->motivo,
                'reprogramada'           => 1,
            ]);
            $fechaNuevaFmt = Carbon::parse($reprg->fecha_nueva)->format('d/m/Y');
            $this->registrarActividad(
                $reprg->tarea_id,
                'Reprogramación aprobada',
                "Reprogramación aprobada por {$aprobadorNombre}. Nueva fecha pactada: {$fechaNuevaFmt}."
            );
        } else {
            // Opcional: sin ella se leía un índice inexistente y la respuesta
            // era 500 cuando el rechazo ya estaba guardado.
            $obsRechazo = !empty($data['observacion_rechazo']) ? " Observación: {$data['observacion_rechazo']}." : '';
            $this->registrarActividad(
                $reprg->tarea_id,
                'Reprogramación rechazada',
                "Reprogramación rechazada por {$aprobadorNombre}.{$obsRechazo}"
            );
        }

        return response()->json(['message' => ucfirst($estado) . ' correctamente']);
    }

    function historialReprogramaciones($tareaId)
    {
        $tareaPadre = AccesoTareas::exigir($tareaId);
        if (AccesoTareas::esRespuesta($tareaPadre)) {
            return $tareaPadre;
        }

        $rows = DB::connection('mysql2')->table('reprogramaciones_tareas as r')
            ->leftJoin('empleados as e', 'r.solicitado_por', '=', 'e.id')
            ->leftJoin('users as ua', 'r.aprobado_por', '=', 'ua.id')
            ->leftJoin('empleados as ea', 'ua.empleado', '=', 'ea.id')
            ->select(
                'r.*',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre_solicitante'),
                DB::connection('mysql2')->raw('CONCAT(ea.nombres, " ", ea.apellidos) as nombre_aprobador')
            )
            ->where('r.tarea_id', $tareaId)
            ->orderBy('r.fecha_solicitud', 'desc')
            ->get();

        return response()->json($rows);
    }

    function reprogramacionesPendientes(Request $request)
    {
        // El rol sale de la sesión, no de ?user_id: con ese parámetro
        // cualquiera se hacía pasar por el administrador.
        $yo = AccesoTareas::usuario();
        $isAdmin = AccesoTareas::esAdministracion($yo);
        $alcance = AccesoTareas::empleadosAlcanzables($yo);

        $query = DB::connection('mysql2')->table('reprogramaciones_tareas as r')
            ->join('tareas_empleados as t', 'r.tarea_id', '=', 't.id')
            ->join('empleados as e', 'r.solicitado_por', '=', 'e.id')
            ->select(
                'r.*',
                't.titulo as tarea_titulo',
                't.fecha_pactada as fecha_pactada_actual',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre_solicitante')
            )
            ->where('r.estado', 'Pendiente');

        if (!$isAdmin) {
            // Un líder ve las de su equipo, nunca las suyas propias: no las aprueba él.
            $equipo = array_values(array_diff($alcance, [(int) ($yo->empleado ?? 0)]));
            $query->where('r.tipo_aprobador', 'lider')->whereIn('t.empleado', $equipo ?: [0]);
        }

        return response()->json($query->orderBy('r.fecha_solicitud', 'desc')->get());
    }

    function informeReprogramaciones(Request $request)
    {
        $request->validate([
            'inicio' => 'nullable|date_format:Y-m-d',
            'fin'    => 'nullable|date_format:Y-m-d|after_or_equal:inicio',
        ], [
            'inicio.date_format'  => 'La fecha de inicio no es válida (AAAA-MM-DD).',
            'fin.date_format'     => 'La fecha de fin no es válida (AAAA-MM-DD).',
            'fin.after_or_equal'  => 'La fecha de fin no puede ser anterior a la de inicio.',
        ]);
        $inicio = $request->query('inicio');
        $fin    = $request->query('fin');
        $alcance = $this->alcanceEmpleadosInformes();

        $query = DB::connection('mysql2')->table('reprogramaciones_tareas as r')
            ->join('tareas_empleados as t', 'r.tarea_id', '=', 't.id')
            // LEFT y sin filtrar por estado: si quien la pidió salió de la
            // empresa, la solicitud sigue siendo parte del histórico.
            ->leftJoin('empleados as e', 'r.solicitado_por', '=', 'e.id')
            ->leftJoin('departamentos as d', 'e.departamento', '=', 'd.id')
            ->leftJoin('users as ua', 'r.aprobado_por', '=', 'ua.id')
            ->leftJoin('empleados as ea', 'ua.empleado', '=', 'ea.id')
            ->select(
                'r.*',
                't.titulo as tarea_titulo',
                DB::connection('mysql2')->raw('CONCAT(e.nombres, " ", e.apellidos) as nombre_solicitante'),
                'd.nombre as departamento',
                DB::connection('mysql2')->raw('CONCAT(ea.nombres, " ", ea.apellidos) as nombre_aprobador')
            )
            ->orderBy('r.fecha_solicitud', 'desc');

        // Alcance por rol: se incluye la solicitud si el solicitante está dentro
        // del alcance o si lo está el empleado dueño de la tarea reprogramada,
        // de modo que un líder siga viendo las reprogramaciones de las tareas de
        // su equipo aunque las haya solicitado un tercero.
        if ($alcance !== null) {
            $query->where(function ($q) use ($alcance) {
                $q->whereIn('r.solicitado_por', $alcance)
                  ->orWhereIn('t.empleado', $alcance);
            });
        }

        if ($inicio) $query->where('r.fecha_solicitud', '>=', $inicio . ' 00:00:00');
        if ($fin)    $query->where('r.fecha_solicitud', '<=', $fin . ' 23:59:59');

        return response()->json($query->get());
    }

    function migrarFotos()
    {
        $migrados = 0;

        $empleados = DB::connection('mysql2')->table('empleados')
            ->whereNotNull('foto')
            ->where('foto', 'like', 'data:image%')
            ->get(['id', 'foto']);

        foreach ($empleados as $emp) {
            $url = $this->procesarFoto($emp->foto);
            DB::connection('mysql2')->table('empleados')->where('id', $emp->id)->update(['foto' => $url]);
            DB::connection('mysql2')->table('users')->where('empleado', $emp->id)->update(['foto' => $url]);
            $migrados++;
        }

        // Usuarios sin empleado vinculado (administradores)
        $users = DB::connection('mysql2')->table('users')
            ->whereNotNull('foto')
            ->where('foto', 'like', 'data:image%')
            ->whereNull('empleado')
            ->get(['id', 'foto']);

        foreach ($users as $user) {
            $url = $this->procesarFoto($user->foto);
            DB::connection('mysql2')->table('users')->where('id', $user->id)->update(['foto' => $url]);
            $migrados++;
        }

        return response()->json(['success' => true, 'migrados' => $migrados]);
    }
}
