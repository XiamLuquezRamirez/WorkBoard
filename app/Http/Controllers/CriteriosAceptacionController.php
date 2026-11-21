<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Criterios de aceptación de una tarea.
 *
 * Tres cosas distintas conviven en una tarea y no deben mezclarse:
 *
 *  - El checklist (subtareas) mide la EJECUCIÓN y es lo que da el avance.
 *  - Los criterios de aceptación miden el RESULTADO y tienen su propio
 *    indicador de cumplimiento.
 *  - La aceptación es una DECISIÓN explícita de alguien autorizado. Ni
 *    completar el checklist ni marcar todos los criterios la provocan.
 *
 * Este controlador no lee ni escribe subtareas, y lo único que toca de
 * tareas_empleados es el estado al aceptar o devolver la entrega.
 *
 * Roles, sobre el sistema de permisos existente:
 *  - Líder del responsable (lideres_empleados) o administrador: define los
 *    criterios, verifica, acepta y devuelve.
 *  - Responsable de la tarea: declara el cumplimiento y aporta evidencias.
 *    Mientras la tarea no esté en revisión también añade criterios y edita o
 *    elimina los que escribió él (creado_por); los que puso su líder quedan
 *    fijos, y no los reordena ni designa quién los verifica.
 *    Sólo acepta su propia tarea si tiene independencia (users.independencia),
 *    que es la autorización expresa que ya existía para supervisarse.
 *  - Responsable de verificación de un criterio: verifica ESE criterio, pero
 *    no acepta la tarea.
 */
class CriteriosAceptacionController extends Controller
{
    private const EN_REVISION = 'En Revisión';

    /** Estados en los que ya no se cambia lo que se pactó. */
    private const ESTADOS_CERRADOS = [self::EN_REVISION, 'Completada'];

    // ─── Consulta ───────────────────────────────────────────────────────────

    /** Criterios de una tarea, con su indicador y lo que el usuario puede hacer. */
    public function index($tareaId)
    {
        $tarea = $this->tarea($tareaId);
        if (!$tarea) {
            return response()->json(['error' => 'Tarea no encontrada.'], 404);
        }

        $u = $this->usuario();
        if (!$this->puedeVer($u, $tarea)) {
            return response()->json(['error' => 'No tienes acceso a esta tarea.'], 403);
        }

        $criterios = $this->criteriosDe($tarea->id);

        return response()->json([
            // Estado vigente de la tarea: tras aceptar o devolver, la pantalla
            // lo toma de aquí y no del que tenía al abrir el detalle (con el
            // viejo seguía ofreciendo «Aceptar entrega» en una ya Completada).
            'estado_tarea' => $tarea->estado,
            'criterios'   => $criterios,
            'resumen'     => $this->resumen($criterios, $tarea),
            'aceptaciones' => $this->aceptacionesDe($tarea->id),
            'permisos'    => [
                // Para que el frontend sepa qué evidencias son propias.
                'yo'        => $u ? (int) $u->id : null,
                'gestionar' => $this->puedeGestionar($u, $tarea) && $this->estructuraAbierta($tarea),
                // El responsable añade criterios y edita sólo los suyos.
                'proponer'  => $this->puedeProponer($u, $tarea) && $this->estructuraAbierta($tarea),
                'editar'    => $this->estructuraAbierta($tarea)
                    ? $criterios->filter(fn ($c) => $this->puedeEditarCriterio($u, $tarea, $c))->pluck('id')->values()
                    : [],
                'declarar'  => $this->puedeDeclarar($u, $tarea),
                'aceptar'   => $this->puedeAceptar($u, $tarea),
                // Por criterio: el responsable de verificación sólo verifica
                // los suyos, así que el frontend necesita saberlo uno a uno.
                'verificar' => $criterios
                    ->filter(fn ($c) => $this->puedeVerificar($u, $tarea, $c))
                    ->pluck('id')->values(),
            ],
        ]);
    }

    /** Historial de los criterios de una tarea, del más reciente al más antiguo. */
    public function historial($tareaId)
    {
        $tarea = $this->tarea($tareaId);
        if (!$tarea || !$this->puedeVer($this->usuario(), $tarea)) {
            return response()->json(['error' => 'No tienes acceso a esta tarea.'], 403);
        }

        $conn = DB::connection('mysql2');

        $filas = $conn->table('tarea_criterio_historial as h')
            ->leftJoin('users as u', 'h.usuario_id', '=', 'u.id')
            ->where('h.tarea_id', $tarea->id)
            ->orderByDesc('h.id')
            ->limit(200)
            ->get(['h.*', 'u.name as usuario']);

        return response()->json($filas->map(fn ($h) => [
            'id'          => (int) $h->id,
            'criterio_id' => $h->criterio_id ? (int) $h->criterio_id : null,
            'evento'      => $h->evento,
            'antes'       => $h->antes ? json_decode($h->antes, true) : null,
            'despues'     => $h->despues ? json_decode($h->despues, true) : null,
            'observacion' => $h->observacion,
            'usuario'     => $h->usuario,
            'cuando'      => $h->created_at,
        ]));
    }

    // ─── Gestión (líder) ────────────────────────────────────────────────────

    public function store(Request $request, $tareaId)
    {
        $datos = $request->validate($this->reglasCriterio(), $this->mensajes());

        $tarea = $this->tarea($tareaId);
        if (!$tarea) {
            return response()->json(['error' => 'Tarea no encontrada.'], 404);
        }

        $u = $this->usuario();
        if ($this->puedeGestionar($u, $tarea)) {
            if ($r = $this->exigirGestion($u, $tarea)) {
                return $r;
            }
        } elseif ($this->puedeProponer($u, $tarea)) {
            if ($r = $this->exigirAbierta($tarea)) {
                return $r;
            }
            // Quién verifica lo decide el líder, no el responsable.
            $datos['responsable_verificacion'] = null;
        } else {
            return $this->exigirGestion($u, $tarea);
        }

        $id = $this->crear($tarea->id, $datos, $u);

        return response()->json(['success' => 'Criterio añadido.', 'id' => $id], 201);
    }

    public function update(Request $request, $id)
    {
        $datos = $request->validate($this->reglasCriterio(), $this->mensajes());

        [$criterio, $tarea] = $this->criterioYTarea($id);
        if (!$criterio) {
            return response()->json(['error' => 'Criterio no encontrado.'], 404);
        }

        $u = $this->usuario();
        if ($r = $this->exigirEdicion($u, $tarea, $criterio)) {
            return $r;
        }

        $cambios = $this->normalizar($datos);
        if (!$this->puedeGestionar($u, $tarea)) {
            // El responsable no cambia quién verifica su criterio.
            unset($cambios['responsable_verificacion']);
        }
        $antes = array_intersect_key((array) $criterio, $cambios);

        // Si cambia la condición, el veredicto anterior ya no aplica a lo que
        // se pide ahora: vuelve a Pendiente. El historial conserva el anterior.
        if (trim($criterio->descripcion) !== $cambios['descripcion'] && $criterio->estado !== 'Pendiente') {
            $cambios['estado'] = 'Pendiente';
            $cambios['verificado_por'] = null;
            $cambios['fecha_verificacion'] = null;
            $antes['estado'] = $criterio->estado;
        }

        DB::connection('mysql2')->table('tarea_criterios')->where('id', $id)->update($cambios + [
            'actualizado_por' => $u->id,
            'updated_at'      => now(),
        ]);

        $this->anotar($tarea->id, $criterio->id, 'editado', $antes, $cambios, null, $u);

        return response()->json(['success' => 'Criterio actualizado.']);
    }

    /**
     * Elimina un criterio sin borrarlo: queda marcado y fuera de las cuentas,
     * pero su historial y sus evidencias siguen consultables.
     */
    public function destroy($id)
    {
        [$criterio, $tarea] = $this->criterioYTarea($id);
        if (!$criterio) {
            return response()->json(['error' => 'Criterio no encontrado.'], 404);
        }

        $u = $this->usuario();
        if ($r = $this->exigirEdicion($u, $tarea, $criterio)) {
            return $r;
        }

        DB::connection('mysql2')->table('tarea_criterios')->where('id', $id)->update([
            'eliminado_por' => $u->id,
            'eliminado_at'  => now(),
        ]);

        $this->anotar($tarea->id, $criterio->id, 'eliminado', ['descripcion' => $criterio->descripcion, 'estado' => $criterio->estado], null, null, $u);

        return response()->json(['success' => 'Criterio eliminado.']);
    }

    /** Recibe los ids en el orden deseado. */
    public function ordenar(Request $request, $tareaId)
    {
        $datos = $request->validate([
            'orden'   => 'required|array|min:1',
            'orden.*' => 'integer',
        ]);

        $tarea = $this->tarea($tareaId);
        if (!$tarea) {
            return response()->json(['error' => 'Tarea no encontrada.'], 404);
        }

        $u = $this->usuario();
        if ($r = $this->exigirGestion($u, $tarea)) {
            return $r;
        }

        $propios = $this->criteriosDe($tarea->id)->pluck('id')->all();
        $pedido = array_map('intval', $datos['orden']);

        // Debe ser exactamente el mismo conjunto: ni ids de otra tarea ni
        // criterios olvidados que quedarían con un orden duplicado.
        $a = $pedido; $b = $propios;
        sort($a); sort($b);
        if ($a !== $b) {
            return response()->json(['error' => 'El orden no corresponde a los criterios de esta tarea.'], 422);
        }

        DB::connection('mysql2')->transaction(function () use ($pedido) {
            foreach ($pedido as $i => $cid) {
                DB::connection('mysql2')->table('tarea_criterios')->where('id', $cid)->update(['orden' => $i + 1]);
            }
        });

        $this->anotar($tarea->id, null, 'reordenado', ['orden' => $propios], ['orden' => $pedido], null, $u);

        return response()->json(['success' => 'Orden actualizado.']);
    }

    // ─── Colaborador ────────────────────────────────────────────────────────

    /**
     * El responsable declara que cumplió (o retira la declaración). Es su
     * palabra, no el veredicto: el estado del criterio no cambia.
     */
    public function declarar(Request $request, $id)
    {
        $datos = $request->validate([
            'cumplido'    => 'required|boolean',
            'observacion' => 'nullable|string|max:2000',
        ]);

        [$criterio, $tarea] = $this->criterioYTarea($id);
        if (!$criterio) {
            return response()->json(['error' => 'Criterio no encontrado.'], 404);
        }

        $u = $this->usuario();
        if (!$this->puedeDeclarar($u, $tarea)) {
            return response()->json(['error' => 'Sólo el responsable de la tarea declara su cumplimiento.'], 403);
        }

        if (in_array($tarea->estado, self::ESTADOS_CERRADOS, true)) {
            return response()->json(['error' => 'La tarea ya se entregó: espera la verificación o una devolución.'], 409);
        }

        $cumplido = (bool) $datos['cumplido'];
        $obs = trim((string) ($datos['observacion'] ?? '')) ?: null;

        DB::connection('mysql2')->table('tarea_criterios')->where('id', $id)->update([
            'declarado_por' => $cumplido ? $u->empleado : null,
            'declarado_at'  => $cumplido ? now() : null,
            'updated_at'    => now(),
        ]);

        $this->anotar(
            $tarea->id,
            $criterio->id,
            $cumplido ? 'declarado' : 'declaracion_retirada',
            ['declarado' => $criterio->declarado_at !== null],
            ['declarado' => $cumplido],
            $obs,
            $u
        );

        return response()->json(['success' => $cumplido ? 'Cumplimiento declarado.' : 'Declaración retirada.']);
    }

    public function agregarEvidencia(Request $request, $id)
    {
        $datos = $request->validate([
            'tipo'   => 'required|in:archivo,enlace',
            'ruta'   => 'required|string|max:1000',
            'nombre' => 'nullable|string|max:255',
            'mime'   => 'nullable|string|max:120',
        ]);

        // Un enlace debe ser una URL; un archivo, una ruta de las que
        // devuelve subirEvidencias. Así no se cuela un «javascript:» ni una
        // ruta arbitraria del servidor.
        if ($datos['tipo'] === 'enlace' && !filter_var($datos['ruta'], FILTER_VALIDATE_URL)) {
            return response()->json(['error' => 'El enlace no es una dirección válida.'], 422);
        }
        if ($datos['tipo'] === 'enlace' && !preg_match('#^https?://#i', $datos['ruta'])) {
            return response()->json(['error' => 'El enlace debe empezar por http:// o https://.'], 422);
        }
        // Un solo nombre de archivo dentro de la carpeta de evidencias: con
        // str_starts_with a secas, «evidencias_tareas/../.env» pasaba.
        // Ojo con el escape: en comillas simples '\\\\' llega al patrón como \\
        // (barra invertida literal). Con '\\' quedaba \] y la clase de
        // caracteres no se cerraba: preg_match fallaba y todo daba 500.
        // Tampoco valen «.» ni «..» como nombre.
        $archivo = $datos['tipo'] === 'archivo' ? substr($datos['ruta'], strlen('evidencias_tareas/')) : '';
        if ($datos['tipo'] === 'archivo' && (!preg_match('#^evidencias_tareas/[^/\\\\]+$#', $datos['ruta']) || in_array($archivo, ['.', '..'], true))) {
            return response()->json(['error' => 'El archivo no procede de la carga de evidencias.'], 422);
        }

        [$criterio, $tarea] = $this->criterioYTarea($id);
        if (!$criterio) {
            return response()->json(['error' => 'Criterio no encontrado.'], 404);
        }

        $u = $this->usuario();
        if (!$this->puedeDeclarar($u, $tarea) && !$this->puedeVerificar($u, $tarea, $criterio)) {
            return response()->json(['error' => 'No puedes aportar evidencias a este criterio.'], 403);
        }

        if ($tarea->estado === 'Completada') {
            return response()->json(['error' => 'La tarea ya fue aceptada.'], 409);
        }

        $eid = DB::connection('mysql2')->table('tarea_criterio_evidencias')->insertGetId([
            'criterio_id' => $criterio->id,
            'tipo'        => $datos['tipo'],
            'ruta'        => $datos['ruta'],
            'nombre'      => $datos['nombre'] ?? null,
            'mime'        => $datos['mime'] ?? null,
            'subido_por'  => $u->id,
            'created_at'  => now(),
        ]);

        $this->anotar($tarea->id, $criterio->id, 'evidencia_agregada', null, [
            'evidencia_id' => $eid, 'tipo' => $datos['tipo'], 'nombre' => $datos['nombre'] ?? $datos['ruta'],
        ], null, $u);

        return response()->json(['success' => 'Evidencia añadida.', 'id' => $eid], 201);
    }

    public function quitarEvidencia($evidenciaId)
    {
        $conn = DB::connection('mysql2');
        $ev = $conn->table('tarea_criterio_evidencias')->where('id', $evidenciaId)->whereNull('eliminado_at')->first();
        if (!$ev) {
            return response()->json(['error' => 'Evidencia no encontrada.'], 404);
        }

        [$criterio, $tarea] = $this->criterioYTarea($ev->criterio_id);
        $u = $this->usuario();

        // La quita quien la subió o quien gestiona la tarea, y nunca una vez
        // aceptada: la evidencia de una aceptación no debe desaparecer.
        $propia = (int) $ev->subido_por === (int) $u?->id;
        if (!$propia && !$this->puedeGestionar($u, $tarea)) {
            return response()->json(['error' => 'No puedes quitar esta evidencia.'], 403);
        }
        if ($tarea->estado === 'Completada') {
            return response()->json(['error' => 'La tarea ya fue aceptada.'], 409);
        }

        $conn->table('tarea_criterio_evidencias')->where('id', $evidenciaId)->update([
            'eliminado_por' => $u->id,
            'eliminado_at'  => now(),
        ]);

        $this->anotar($tarea->id, $criterio->id, 'evidencia_eliminada', ['evidencia_id' => (int) $ev->id, 'nombre' => $ev->nombre ?? $ev->ruta], null, null, $u);

        return response()->json(['success' => 'Evidencia quitada.']);
    }

    // ─── Verificación ───────────────────────────────────────────────────────

    /**
     * Marca un criterio como Cumplido o No cumplido. No acepta la tarea:
     * eso es aceptar(), y es una acción aparte a propósito.
     */
    public function verificar(Request $request, $id)
    {
        $datos = $request->validate([
            'estado'      => 'required|in:Cumplido,No cumplido,Pendiente',
            'observacion' => 'nullable|string|max:2000',
        ]);

        [$criterio, $tarea] = $this->criterioYTarea($id);
        if (!$criterio) {
            return response()->json(['error' => 'Criterio no encontrado.'], 404);
        }

        $u = $this->usuario();
        if (!$this->puedeVerificar($u, $tarea, $criterio)) {
            return response()->json(['error' => 'No tienes permiso para verificar este criterio.'], 403);
        }

        if ($tarea->estado !== self::EN_REVISION) {
            return response()->json(['error' => 'Los criterios se verifican cuando la tarea está en revisión.'], 409);
        }

        $obs = trim((string) ($datos['observacion'] ?? '')) ?: null;

        // Un «No cumplido» sin explicación deja al responsable adivinando.
        if ($datos['estado'] === 'No cumplido' && !$obs) {
            return response()->json(['error' => 'Indica qué falta para cumplir el criterio.'], 422);
        }

        if ($datos['estado'] === 'Cumplido' && (int) $criterio->requiere_evidencia === 1
            && $this->evidenciasActivas($criterio->id) === 0) {
            return response()->json(['error' => 'Este criterio exige evidencia y todavía no tiene ninguna.'], 422);
        }

        $pendiente = $datos['estado'] === 'Pendiente';

        DB::connection('mysql2')->table('tarea_criterios')->where('id', $id)->update([
            'estado'             => $datos['estado'],
            'verificado_por'     => $pendiente ? null : $u->id,
            'fecha_verificacion' => $pendiente ? null : now(),
            'observacion'        => $obs ?? $criterio->observacion,
            'updated_at'         => now(),
        ]);

        $this->anotar($tarea->id, $criterio->id, 'verificado',
            ['estado' => $criterio->estado],
            ['estado' => $datos['estado']],
            $obs,
            $u
        );

        return response()->json(['success' => 'Criterio marcado como ' . mb_strtolower($datos['estado']) . '.']);
    }

    // ─── Aceptación final ───────────────────────────────────────────────────

    /**
     * El responsable con independencia completa su propia tarea: se acepta
     * sola, sin quedarse esperando en revisión (decisión de la empresa).
     *
     * Las comprobaciones son las de siempre: los criterios obligatorios que
     * siguen pendientes los da por verificados quien tiene independencia —es
     * el único que podía verificarlos—, salvo los que exigen evidencia y no
     * la tienen, y los que él mismo marcó «No cumplido». Si alguno bloquea,
     * la tarea se queda en revisión y se devuelve qué falta.
     *
     * @return array{aceptada: bool, bloqueos: string[]}
     */
    public function aceptarPorIndependencia(int $tareaId): array
    {
        $tarea = $this->tarea($tareaId);
        $u = $this->usuario();
        if (!$tarea || $tarea->estado !== self::EN_REVISION
            || !$this->esResponsable($u, $tarea) || !$this->esIndependiente($u)) {
            return ['aceptada' => false, 'bloqueos' => []];
        }

        $conn = DB::connection('mysql2');
        $conn->beginTransaction();
        try {
            $bloqueos = [];
            foreach ($this->criteriosDe($tarea->id) as $c) {
                if (!(int) $c->obligatorio) {
                    continue;
                }
                if ($c->estado === 'No cumplido') {
                    $bloqueos[] = "«{$this->corto($c->descripcion)}» está marcado como no cumplido.";
                    continue;
                }
                if ((int) $c->requiere_evidencia === 1 && count($c->evidencias) === 0) {
                    $bloqueos[] = "«{$this->corto($c->descripcion)}» exige evidencia.";
                    continue;
                }
                if ($c->estado === 'Pendiente') {
                    $conn->table('tarea_criterios')->where('id', $c->id)->update([
                        'estado'             => 'Cumplido',
                        'verificado_por'     => $u->id,
                        'fecha_verificacion' => now(),
                        'updated_at'         => now(),
                    ]);
                    $this->anotar($tarea->id, $c->id, 'verificado', ['estado' => 'Pendiente'], ['estado' => 'Cumplido'],
                        'Verificado al completar la tarea: el responsable tiene independencia.', $u);
                }
            }

            if ($bloqueos !== []) {
                $conn->rollBack();
                return ['aceptada' => false, 'bloqueos' => $bloqueos];
            }

            $r = $this->resolver($tarea->id, 'Aceptada', 'Aceptada al completarla: el responsable tiene independencia.');
            if ($r->getStatusCode() !== 200) {
                $conn->rollBack();
                return ['aceptada' => false, 'bloqueos' => (array) ($r->getData(true)['bloqueos'] ?? [$r->getData(true)['error'] ?? 'No se pudo aceptar.'])];
            }

            $conn->commit();
            return ['aceptada' => true, 'bloqueos' => []];
        } catch (\Throwable $e) {
            $conn->rollBack();
            \Illuminate\Support\Facades\Log::error('Aceptación por independencia', ['tarea' => $tareaId, 'error' => $e->getMessage()]);
            return ['aceptada' => false, 'bloqueos' => ['No fue posible cerrarla automáticamente; acéptala desde la tarea.']];
        }
    }

    /** ¿Quien tiene la sesión completa sola sus tareas? (responsable con independencia) */
    public function completaSola(object $tarea): bool
    {
        $u = $this->usuario();
        return $this->esResponsable($u, $tarea) && $this->esIndependiente($u);
    }

    /** Acepta la entrega: cierra la tarea. Exige todos los obligatorios cumplidos. */
    public function aceptar(Request $request, $tareaId)
    {
        $datos = $request->validate(['observacion' => 'nullable|string|max:2000']);

        return $this->resolver($tareaId, 'Aceptada', trim((string) ($datos['observacion'] ?? '')) ?: null);
    }

    /** Devuelve la entrega con observaciones: la tarea vuelve a En Proceso. */
    public function devolver(Request $request, $tareaId)
    {
        $datos = $request->validate([
            'observacion' => 'required|string|min:5|max:2000',
        ], [
            'observacion.required' => 'Indica qué hay que corregir: el responsable necesita saberlo.',
            'observacion.min'      => 'Explica la corrección en al menos 5 caracteres.',
        ]);

        return $this->resolver($tareaId, 'Devuelta', trim($datos['observacion']));
    }

    /**
     * Compatibilidad con PUT /verificarTarea/{id}, que antes verificaba el
     * criterio único y cerraba la tarea en una sola acción. Ahora traduce
     * cumple=true a aceptar y cumple=false a devolver, con las mismas reglas.
     */
    public function verificarLegado(Request $request, $tareaId)
    {
        $datos = $request->validate([
            'cumple'      => 'required|boolean',
            'observacion' => 'nullable|string',
        ]);

        if ($datos['cumple']) {
            return $this->resolver($tareaId, 'Aceptada', null);
        }

        $obs = trim((string) ($datos['observacion'] ?? ''));
        if (mb_strlen($obs) < 5) {
            return response()->json(['error' => 'Indica qué hay que corregir: el responsable necesita saberlo.'], 422);
        }

        return $this->resolver($tareaId, 'Devuelta', $obs);
    }

    private function resolver($tareaId, string $resultado, ?string $observacion)
    {
        $tarea = $this->tarea($tareaId);
        if (!$tarea) {
            return response()->json(['error' => 'Tarea no encontrada.'], 404);
        }

        $u = $this->usuario();
        if (!$this->puedeAceptar($u, $tarea)) {
            return response()->json([
                'error' => 'No tienes permiso para aceptar o devolver esta tarea. Lo hace el líder del responsable.',
            ], 403);
        }

        if ($tarea->estado !== self::EN_REVISION) {
            return response()->json(['error' => 'Sólo se aceptan o devuelven las tareas que están en revisión.'], 409);
        }

        $criterios = $this->criteriosDe($tarea->id);

        if ($resultado === 'Aceptada') {
            $bloqueos = $this->bloqueosDeAceptacion($criterios);
            if ($bloqueos !== []) {
                return response()->json([
                    'error'    => 'No se puede aceptar todavía.',
                    'bloqueos' => $bloqueos,
                ], 422);
            }
        }

        $conn = DB::connection('mysql2');
        $conn->beginTransaction();
        try {
            if ($resultado === 'Aceptada') {
                $cambios = [
                    'estado'             => 'Completada',
                    // Se siguen escribiendo para las pantallas que aún los leen.
                    'criterio_cumplido'  => 1,
                    'verificada_por'     => $u->id,
                    'fecha_verificacion' => now(),
                ];
                if (empty($tarea->fecha_entregada)) {
                    $cambios['fecha_entregada'] = now()->toDateString();
                }
            } else {
                $cambios = [
                    'estado'              => 'En Proceso',
                    'criterio_cumplido'   => 0,
                    'observacion_entrega' => $observacion,
                    // Devuelta no está entregada: la fecha de entrega será la
                    // del próximo envío a revisión.
                    'fecha_entregada'     => null,
                ];
            }

            $conn->table('tareas_empleados')->where('id', $tarea->id)->update($cambios);

            $conn->table('tarea_aceptaciones')->insert([
                'tarea_id'    => $tarea->id,
                'resultado'   => $resultado,
                'observacion' => $observacion,
                'criterios'   => json_encode($criterios->map(fn ($c) => [
                    'id' => $c->id, 'descripcion' => $c->descripcion, 'estado' => $c->estado,
                    'obligatorio' => $c->obligatorio, 'evidencias' => count($c->evidencias),
                ])->values(), JSON_UNESCAPED_UNICODE),
                'usuario_id'  => $u->id,
                'created_at'  => now(),
            ]);

            $this->anotar($tarea->id, null, $resultado === 'Aceptada' ? 'tarea_aceptada' : 'tarea_devuelta', null, null, $observacion, $u);

            $actor = $u->name ?? 'Usuario';
            $this->registrarActividad(
                $tarea->id,
                $resultado === 'Aceptada' ? 'Aceptada' : 'Devuelta',
                $resultado === 'Aceptada'
                    ? "{$actor} aceptó la entrega. La tarea quedó cerrada."
                    : "{$actor} devolvió la entrega para corregir: {$observacion}"
            );

            $conn->commit();
        } catch (\Throwable $e) {
            $conn->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }

        // Aviso al responsable con lo que pasó y, si se devolvió, qué corregir.
        // Antes decía «rechazó» o «aprobó», que se confundían con la
        // supervisión y no traían la observación.
        \App\Support\Avisos::entregaResuelta(
            $conn->table('tareas_empleados')->where('id', $tarea->id)->first(),
            $resultado,
            $observacion,
            $u
        );

        return response()->json([
            'success' => $resultado === 'Aceptada'
                ? 'Entrega aceptada. La tarea quedó cerrada.'
                : 'Entrega devuelta. La tarea volvió a En Proceso con tus observaciones.',
            'estado'  => $resultado === 'Aceptada' ? 'Completada' : 'En Proceso',
        ]);
    }

    /**
     * Motivos por los que todavía no se puede aceptar. Vacío = se puede.
     * Pública para que las pruebas comprueben la misma regla que aplica el
     * servidor, sin duplicarla.
     */
    public function bloqueosDeAceptacion($criterios): array
    {
        $bloqueos = [];
        foreach ($criterios as $c) {
            if (!(int) $c->obligatorio) {
                continue;
            }
            if ($c->estado !== 'Cumplido') {
                $bloqueos[] = "«{$this->corto($c->descripcion)}» está " . mb_strtolower($c->estado) . '.';
            } elseif ((int) $c->requiere_evidencia === 1 && count($c->evidencias) === 0) {
                $bloqueos[] = "«{$this->corto($c->descripcion)}» exige evidencia.";
            }
        }
        return $bloqueos;
    }

    // ─── Creación junto con la tarea ────────────────────────────────────────

    /**
     * Inserta los criterios con que nace una tarea. La llama guardarTarea
     * dentro de su propia transacción.
     */
    public function crearIniciales(int $tareaId, array $criterios): void
    {
        $u = $this->usuario();
        foreach (array_values($criterios) as $c) {
            $this->crear($tareaId, $c, $u);
        }
    }

    /** Reglas de validación para la lista de criterios al crear una tarea. */
    public static function reglasAlCrear(): array
    {
        return [
            'criterios'                       => 'required|array|min:1|max:30',
            'criterios.*.descripcion'         => 'required|string|min:5|max:1000',
            'criterios.*.obligatorio'         => 'nullable|boolean',
            'criterios.*.requiere_evidencia'  => 'nullable|boolean',
            // Igual que al añadir un criterio a una tarea existente.
            'criterios.*.responsable_verificacion' => 'nullable|integer|exists:mysql2.empleados,id',
        ];
    }

    public static function mensajesAlCrear(): array
    {
        return [
            'criterios.required'               => 'Define al menos un criterio de aceptación: cómo sabremos que el resultado está bien.',
            'criterios.min'                    => 'Define al menos un criterio de aceptación.',
            'criterios.*.descripcion.required' => 'Cada criterio necesita una descripción.',
            'criterios.*.descripcion.min'      => 'Cada criterio debe explicarse en al menos 5 caracteres.',
            'criterios.*.responsable_verificacion.exists' => 'Quien verifica el criterio no existe.',
        ];
    }

    /**
     * Subconsulta que cuenta los criterios vivos de la tarea con alias «t».
     * La usan el tablero, el plano, la agenda y el puesto para la señal
     * «sin criterio», que antes leía el texto único de tareas_empleados.
     */
    public static function sqlConteo(string $alias = 't'): string
    {
        return "(SELECT COUNT(*) FROM tarea_criterios tc WHERE tc.tarea_id = {$alias}.id AND tc.eliminado_at IS NULL)";
    }

    // ─── Permisos ───────────────────────────────────────────────────────────

    private function usuario(): ?object
    {
        $email = Auth::user()->email ?? null;
        return $email ? DB::connection('mysql2')->table('users')->where('email', $email)->first() : null;
    }

    private function esAdmin(?object $u): bool
    {
        return $u && strcasecmp(trim($u->tipo_usuario ?? ''), 'Administrador') === 0;
    }

    private function esSupervisor(?object $u): bool
    {
        return $u && strcasecmp(trim($u->tipo_usuario ?? ''), 'Supervisor') === 0;
    }

    private function esResponsable(?object $u, object $tarea): bool
    {
        return $u && $u->empleado && (int) $u->empleado === (int) $tarea->empleado;
    }

    private function esLiderDe(?object $u, object $tarea): bool
    {
        if (!$u || !$u->empleado) {
            return false;
        }
        return DB::connection('mysql2')->table('lideres_empleados')
            ->where('lider', $u->empleado)
            ->where('empleado', $tarea->empleado)
            ->exists();
    }

    private function esIndependiente(?object $u): bool
    {
        return $u && strcasecmp(trim((string) ($u->independencia ?? '')), 'Si') === 0;
    }

    /** Definir y cambiar los criterios. */
    private function puedeGestionar(?object $u, object $tarea): bool
    {
        return $this->esAdmin($u)
            || $this->esLiderDe($u, $tarea)
            || ($this->esResponsable($u, $tarea) && $this->esIndependiente($u));
    }

    /** El responsable añade criterios a su propia tarea. */
    private function puedeProponer(?object $u, object $tarea): bool
    {
        return $this->puedeGestionar($u, $tarea) || $this->esResponsable($u, $tarea);
    }

    /**
     * Editar o eliminar un criterio: quien gestiona, cualquiera; el
     * responsable, sólo los que escribió él (al crear la tarea o después).
     */
    private function puedeEditarCriterio(?object $u, object $tarea, object $criterio): bool
    {
        return $this->puedeGestionar($u, $tarea)
            || ($this->esResponsable($u, $tarea) && $u->id && (int) ($criterio->creado_por ?? 0) === (int) $u->id);
    }

    /** Aceptar o devolver la entrega. El responsable, sólo con independencia. */
    private function puedeAceptar(?object $u, object $tarea): bool
    {
        if ($this->esResponsable($u, $tarea)) {
            return $this->esIndependiente($u);
        }
        return $this->esAdmin($u) || $this->esLiderDe($u, $tarea);
    }

    /** Verificar un criterio concreto. */
    private function puedeVerificar(?object $u, object $tarea, object $criterio): bool
    {
        if ($this->puedeAceptar($u, $tarea)) {
            return true;
        }
        // El responsable de verificación designado verifica ese criterio,
        // salvo que sea el propio responsable de la tarea.
        return $u && $u->empleado
            && (int) $criterio->responsable_verificacion === (int) $u->empleado
            && !$this->esResponsable($u, $tarea);
    }

    private function puedeDeclarar(?object $u, object $tarea): bool
    {
        return $this->esResponsable($u, $tarea) || $this->esAdmin($u);
    }

    private function puedeVer(?object $u, object $tarea): bool
    {
        if (!$u) {
            return false;
        }
        if ($this->esAdmin($u) || $this->esSupervisor($u) || $this->esResponsable($u, $tarea) || $this->esLiderDe($u, $tarea)) {
            return true;
        }
        return $u->empleado && DB::connection('mysql2')->table('tarea_criterios')
            ->where('tarea_id', $tarea->id)
            ->whereNull('eliminado_at')
            ->where('responsable_verificacion', $u->empleado)
            ->exists();
    }

    /** Lo pactado no se cambia con la tarea entregada o cerrada. */
    private function estructuraAbierta(object $tarea): bool
    {
        return !in_array($tarea->estado, self::ESTADOS_CERRADOS, true)
            && (int) ($tarea->archivar ?? 0) !== 1;
    }

    private function exigirEdicion(?object $u, object $tarea, object $criterio)
    {
        if (!$this->puedeEditarCriterio($u, $tarea, $criterio)) {
            return response()->json([
                'error' => $this->esResponsable($u, $tarea)
                    ? 'Sólo puedes cambiar los criterios que escribiste tú: los demás los define tu líder.'
                    : 'Sólo el líder del responsable define los criterios de aceptación.',
            ], 403);
        }
        return $this->exigirAbierta($tarea);
    }

    private function exigirAbierta(object $tarea)
    {
        if (!$this->estructuraAbierta($tarea)) {
            return response()->json([
                'error' => 'La tarea está en revisión o cerrada: sus criterios ya no se modifican. Devuélvela para cambiarlos.',
            ], 409);
        }
        return null;
    }

    private function exigirGestion(?object $u, object $tarea)
    {
        if (!$this->puedeGestionar($u, $tarea)) {
            return response()->json(['error' => 'Sólo el líder del responsable define los criterios de aceptación.'], 403);
        }
        if (!$this->estructuraAbierta($tarea)) {
            return response()->json([
                'error' => 'La tarea está en revisión o cerrada: sus criterios ya no se modifican. Devuélvela para cambiarlos.',
            ], 409);
        }
        return null;
    }

    // ─── Datos ──────────────────────────────────────────────────────────────

    private function tarea($id): ?object
    {
        return DB::connection('mysql2')->table('tareas_empleados')->where('id', (int) $id)->first();
    }

    private function criterioYTarea($id): array
    {
        $c = DB::connection('mysql2')->table('tarea_criterios')
            ->where('id', (int) $id)->whereNull('eliminado_at')->first();
        return $c ? [$c, $this->tarea($c->tarea_id)] : [null, null];
    }

    private function criteriosDe(int $tareaId)
    {
        $conn = DB::connection('mysql2');

        $criterios = $conn->table('tarea_criterios as c')
            ->leftJoin('empleados as r', 'c.responsable_verificacion', '=', 'r.id')
            ->leftJoin('empleados as d', 'c.declarado_por', '=', 'd.id')
            ->leftJoin('users as v', 'c.verificado_por', '=', 'v.id')
            ->where('c.tarea_id', $tareaId)
            ->whereNull('c.eliminado_at')
            ->orderBy('c.orden')
            ->orderBy('c.id')
            ->get([
                'c.*',
                $conn->raw('CONCAT(r.nombres, " ", r.apellidos) as responsable_nombre'),
                $conn->raw('CONCAT(d.nombres, " ", d.apellidos) as declarado_nombre'),
                'v.name as verificado_nombre',
            ]);

        $evidencias = $criterios->isEmpty() ? collect() : $conn->table('tarea_criterio_evidencias as e')
            ->leftJoin('users as u', 'e.subido_por', '=', 'u.id')
            ->whereIn('e.criterio_id', $criterios->pluck('id'))
            ->whereNull('e.eliminado_at')
            ->orderBy('e.id')
            ->get(['e.*', 'u.name as subido_nombre'])
            ->groupBy('criterio_id');

        return $criterios->map(function ($c) use ($evidencias) {
            $c->id = (int) $c->id;
            $c->obligatorio = (int) $c->obligatorio;
            $c->requiere_evidencia = (int) $c->requiere_evidencia;
            $c->evidencias = collect($evidencias[$c->id] ?? [])->map(fn ($e) => [
                'id'         => (int) $e->id,
                'tipo'       => $e->tipo,
                'ruta'       => $e->ruta,
                'nombre'     => $e->nombre,
                'mime'       => $e->mime,
                'subido_por' => $e->subido_nombre,
                'subido_id'  => $e->subido_por ? (int) $e->subido_por : null,
                'cuando'     => $e->created_at,
            ])->values()->all();
            return $c;
        })->values();
    }

    private function aceptacionesDe(int $tareaId)
    {
        return DB::connection('mysql2')->table('tarea_aceptaciones as a')
            ->leftJoin('users as u', 'a.usuario_id', '=', 'u.id')
            ->where('a.tarea_id', $tareaId)
            ->orderByDesc('a.id')
            ->get(['a.id', 'a.resultado', 'a.observacion', 'a.created_at as cuando', 'u.name as usuario']);
    }

    /**
     * Indicador propio de los criterios. Deliberadamente no mira subtareas:
     * el avance del checklist y el cumplimiento de criterios son cifras
     * distintas que responden a preguntas distintas.
     */
    private function resumen($criterios, object $tarea): array
    {
        $total = $criterios->count();
        $cumplidos = $criterios->where('estado', 'Cumplido')->count();
        $noCumplidos = $criterios->where('estado', 'No cumplido')->count();
        $bloqueos = $this->bloqueosDeAceptacion($criterios);

        if ($tarea->estado === 'Completada') {
            $general = $total === 0 ? 'Sin criterios' : 'Aceptada';
        } elseif ($total === 0) {
            $general = 'Sin criterios';
        } elseif ($noCumplidos > 0) {
            $general = 'Con incumplimientos';
        } elseif ($bloqueos === []) {
            $general = 'Lista para aceptar';
        } else {
            $general = 'Pendiente de verificación';
        }

        return [
            'total'                  => $total,
            'pendientes'             => $criterios->where('estado', 'Pendiente')->count(),
            'cumplidos'              => $cumplidos,
            'no_cumplidos'           => $noCumplidos,
            'obligatorios'           => $criterios->where('obligatorio', 1)->count(),
            'declarados'             => $criterios->whereNotNull('declarado_at')->count(),
            'porcentaje'             => $total ? (int) round($cumplidos * 100 / $total) : 0,
            'estado_general'         => $general,
            'bloqueos'               => $bloqueos,
        ];
    }

    private function evidenciasActivas(int $criterioId): int
    {
        return DB::connection('mysql2')->table('tarea_criterio_evidencias')
            ->where('criterio_id', $criterioId)->whereNull('eliminado_at')->count();
    }

    private function crear(int $tareaId, array $datos, ?object $u): int
    {
        $conn = DB::connection('mysql2');
        $limpio = $this->normalizar($datos);

        $orden = (int) $conn->table('tarea_criterios')->where('tarea_id', $tareaId)->max('orden') + 1;

        $id = $conn->table('tarea_criterios')->insertGetId($limpio + [
            'tarea_id'   => $tareaId,
            'orden'      => $orden,
            'estado'     => 'Pendiente',
            'creado_por' => $u?->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->anotar($tareaId, $id, 'creado', null, $limpio, null, $u);

        return $id;
    }

    private function normalizar(array $datos): array
    {
        $resp = $datos['responsable_verificacion'] ?? null;

        return [
            'descripcion'              => trim((string) $datos['descripcion']),
            'obligatorio'              => array_key_exists('obligatorio', $datos) ? (int) (bool) $datos['obligatorio'] : 1,
            'requiere_evidencia'       => (int) (bool) ($datos['requiere_evidencia'] ?? false),
            'responsable_verificacion' => $resp ? (int) $resp : null,
        ];
    }

    private function reglasCriterio(): array
    {
        return [
            'descripcion'              => 'required|string|min:5|max:1000',
            'obligatorio'              => 'nullable|boolean',
            'requiere_evidencia'       => 'nullable|boolean',
            'responsable_verificacion' => 'nullable|integer|exists:mysql2.empleados,id',
        ];
    }

    private function mensajes(): array
    {
        return [
            'descripcion.required' => 'Describe la condición que debe cumplir el resultado.',
            'descripcion.min'      => 'El criterio debe explicarse en al menos 5 caracteres.',
            'responsable_verificacion.exists' => 'El responsable de verificación no existe.',
        ];
    }

    /** Añade una fila al historial. Nunca actualiza ni borra filas anteriores. */
    private function anotar(int $tareaId, ?int $criterioId, string $evento, ?array $antes, ?array $despues, ?string $obs, ?object $u): void
    {
        DB::connection('mysql2')->table('tarea_criterio_historial')->insert([
            'tarea_id'    => $tareaId,
            'criterio_id' => $criterioId,
            'evento'      => $evento,
            'antes'       => $antes !== null ? json_encode($antes, JSON_UNESCAPED_UNICODE) : null,
            'despues'     => $despues !== null ? json_encode($despues, JSON_UNESCAPED_UNICODE) : null,
            'observacion' => $obs,
            'usuario_id'  => $u?->id,
            'created_at'  => now(),
        ]);
    }

    /**
     * Mismo registro que EmpleadosController::registrarActividad (privado
     * allí), para que la aceptación aparezca en el panel de Actividad.
     */
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

    private function corto(string $txt): string
    {
        $txt = trim($txt);
        return mb_strlen($txt) > 60 ? mb_substr($txt, 0, 57) . '…' : $txt;
    }
}
