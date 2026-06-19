# RECOMENDACIONES E IMPLEMENTACIÓN
## Sistema Work-Board - Plan de Mejora Multi-Área

**Fecha:** Abril 2026
**Versión:** 1.0
**Autor:** Análisis Técnico Claude Code

---

## ÍNDICE

1. [Roadmap de Implementación](#1-roadmap-de-implementación)
2. [Nivel 1: Mejoras Críticas](#2-nivel-1-mejoras-críticas)
3. [Nivel 2: Mejoras Importantes](#3-nivel-2-mejoras-importantes)
4. [Nivel 3: Mejoras Complementarias](#4-nivel-3-mejoras-complementarias)
5. [Mejoras Específicas por Área](#5-mejoras-específicas-por-área)
6. [Optimizaciones Técnicas](#6-optimizaciones-técnicas)
7. [Plan de Migración y Rollout](#7-plan-de-migración-y-rollout)
8. [Estimaciones y Recursos](#8-estimaciones-y-recursos)

---

## 1. ROADMAP DE IMPLEMENTACIÓN

### Visión General

```
MES 1-2: Fundamentos Multi-Área
├─ Sistema de Proyectos
├─ Dashboard por Departamento
└─ Timetracking Básico

MES 3-4: Mejoras Core
├─ Sistema de Dependencias
├─ Etiquetas y Categorización
├─ Plantillas de Tareas
└─ Mejoras en Reportes

MES 5-6: Features Avanzadas
├─ Calendario Integrado
├─ Dashboard Ejecutivo
├─ Subtareas y Checklist
├─ Análisis Predictivo
└─ Optimizaciones Técnicas
```

### Cronograma Detallado

| Sprint | Duración | Funcionalidad Principal | Prioridad |
|--------|----------|------------------------|-----------|
| Sprint 1 | 2 semanas | Sistema de Proyectos - Backend | CRÍTICA |
| Sprint 2 | 2 semanas | Sistema de Proyectos - Frontend | CRÍTICA |
| Sprint 3 | 2 semanas | Dashboard por Departamento | CRÍTICA |
| Sprint 4 | 2 semanas | Timetracking | CRÍTICA |
| Sprint 5 | 2 semanas | Sistema de Dependencias | ALTA |
| Sprint 6 | 2 semanas | Etiquetas y Plantillas | ALTA |
| Sprint 7 | 2 semanas | Calendario y Vistas | MEDIA |
| Sprint 8 | 2 semanas | Dashboard Ejecutivo | MEDIA |
| Sprint 9 | 2 semanas | Subtareas y Análisis | MEDIA |
| Sprint 10 | 2 semanas | Optimizaciones y Testing | ALTA |

---
usuariopw
## 2. NIVEL 1: MEJORAS CRÍTICAS

### 2.1 Sistema de Proyectos Multi-Área

#### 2.1.1 Diseño de Base de Datos

```sql
-- ============================================
-- TABLA: proyectos
-- ============================================
CREATE TABLE proyectos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(50) UNIQUE NOT NULL COMMENT 'Código único del proyecto (ej: PROJ-2026-001)',
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,

    -- Organización
    departamento_id INT NOT NULL COMMENT 'Departamento responsable principal',
    empresa_id INT NOT NULL,
    cliente VARCHAR(255) NULL COMMENT 'Cliente externo si aplica',

    -- Gestión
    lider_proyecto INT NOT NULL COMMENT 'Empleado líder del proyecto',
    prioridad ENUM('Alta', 'Media', 'Baja') DEFAULT 'Media',
    estado ENUM('Planificación', 'En Progreso', 'Pausado', 'Completado', 'Cancelado') DEFAULT 'Planificación',

    -- Fechas
    fecha_inicio DATE NOT NULL,
    fecha_fin_estimada DATE NOT NULL,
    fecha_fin_real DATE NULL,

    -- Presupuesto
    presupuesto_estimado DECIMAL(12,2) NULL COMMENT 'Presupuesto en moneda local',
    presupuesto_real DECIMAL(12,2) NULL,
    moneda VARCHAR(10) DEFAULT 'USD',

    -- Métricas
    progreso_porcentaje DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Calculado automáticamente',
    horas_estimadas INT NULL,
    horas_reales INT NULL COMMENT 'Suma de timetracking',

    -- Metadatos
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT NOT NULL,
    updated_by INT NULL,

    -- Foreign Keys
    FOREIGN KEY (departamento_id) REFERENCES departamentos(id),
    FOREIGN KEY (empresa_id) REFERENCES empresas(id),
    FOREIGN KEY (lider_proyecto) REFERENCES empleados(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id),

    -- Índices
    INDEX idx_estado (estado),
    INDEX idx_departamento (departamento_id),
    INDEX idx_lider (lider_proyecto),
    INDEX idx_fecha_inicio (fecha_inicio),
    INDEX idx_fecha_fin (fecha_fin_estimada)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: proyecto_colaboradores
-- Equipos multi-departamento
-- ============================================
CREATE TABLE proyecto_colaboradores (
    id INT PRIMARY KEY AUTO_INCREMENT,
    proyecto_id INT NOT NULL,
    empleado_id INT NOT NULL,
    rol VARCHAR(100) NULL COMMENT 'Desarrollador, Diseñador, QA, etc.',
    fecha_asignacion DATE DEFAULT (CURRENT_DATE),
    fecha_desasignacion DATE NULL,
    activo TINYINT(1) DEFAULT 1,

    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id),

    UNIQUE KEY unique_proyecto_empleado (proyecto_id, empleado_id),
    INDEX idx_proyecto (proyecto_id),
    INDEX idx_empleado (empleado_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- TABLA: proyecto_hitos (Milestones)
-- ============================================
CREATE TABLE proyecto_hitos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    proyecto_id INT NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    fecha_objetivo DATE NOT NULL,
    fecha_completado DATE NULL,
    porcentaje_proyecto DECIMAL(5,2) NOT NULL COMMENT '% del proyecto que representa',
    completado TINYINT(1) DEFAULT 0,
    orden INT NOT NULL DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
    INDEX idx_proyecto_orden (proyecto_id, orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- MODIFICACIÓN: Vincular tareas con proyectos
-- ============================================
ALTER TABLE tareas_empleados
    ADD COLUMN proyecto_id INT NULL AFTER empleado,
    ADD COLUMN es_hito TINYINT(1) DEFAULT 0 COMMENT 'Si es una tarea de hito',
    ADD COLUMN hito_id INT NULL,
    ADD FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE SET NULL,
    ADD FOREIGN KEY (hito_id) REFERENCES proyecto_hitos(id) ON DELETE SET NULL,
    ADD INDEX idx_proyecto (proyecto_id);

-- ============================================
-- TABLA: proyecto_documentos
-- ============================================
CREATE TABLE proyecto_documentos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    proyecto_id INT NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT NULL,
    tipo ENUM('Contrato', 'Especificación', 'Diseño', 'Reporte', 'Otro') DEFAULT 'Otro',
    ruta VARCHAR(500) NOT NULL COMMENT 'Path o URL del documento',
    tipo_archivo VARCHAR(50) NULL,
    subido_por INT NOT NULL,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
    FOREIGN KEY (subido_por) REFERENCES users(id),
    INDEX idx_proyecto (proyecto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### 2.1.2 Backend - ProyectosController

**Archivo:** `app/Http/Controllers/ProyectosController.php`

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class ProyectosController extends Controller
{
    /**
     * Listar todos los proyectos con filtros
     */
    public function index(Request $request)
    {
        $query = DB::connection('mysql2')->table('proyectos')
            ->join('departamentos', 'proyectos.departamento_id', '=', 'departamentos.id')
            ->join('empresas', 'proyectos.empresa_id', '=', 'empresas.id')
            ->join('empleados', 'proyectos.lider_proyecto', '=', 'empleados.id')
            ->select(
                'proyectos.*',
                'departamentos.nombre as departamento_nombre',
                'empresas.nombre as empresa_nombre',
                DB::raw('CONCAT(empleados.nombres, " ", empleados.apellidos) as lider_nombre')
            );

        // Filtros opcionales
        if ($request->has('departamento_id')) {
            $query->where('proyectos.departamento_id', $request->departamento_id);
        }

        if ($request->has('estado')) {
            $query->where('proyectos.estado', $request->estado);
        }

        if ($request->has('prioridad')) {
            $query->where('proyectos.prioridad', $request->prioridad);
        }

        $proyectos = $query->orderBy('proyectos.fecha_inicio', 'desc')->get();

        // Agregar métricas a cada proyecto
        foreach ($proyectos as $proyecto) {
            $proyecto->metricas = $this->calcularMetricas($proyecto->id);
        }

        return response()->json($proyectos);
    }

    /**
     * Obtener proyecto específico con detalle completo
     */
    public function show($id)
    {
        $proyecto = DB::connection('mysql2')->table('proyectos')
            ->join('departamentos', 'proyectos.departamento_id', '=', 'departamentos.id')
            ->join('empresas', 'proyectos.empresa_id', '=', 'empresas.id')
            ->join('empleados', 'proyectos.lider_proyecto', '=', 'empleados.id')
            ->select(
                'proyectos.*',
                'departamentos.nombre as departamento_nombre',
                'empresas.nombre as empresa_nombre',
                DB::raw('CONCAT(empleados.nombres, " ", empleados.apellidos) as lider_nombre'),
                'empleados.email as lider_email'
            )
            ->where('proyectos.id', $id)
            ->first();

        if (!$proyecto) {
            return response()->json(['error' => 'Proyecto no encontrado'], 404);
        }

        // Colaboradores
        $proyecto->colaboradores = DB::connection('mysql2')->table('proyecto_colaboradores')
            ->join('empleados', 'proyecto_colaboradores.empleado_id', '=', 'empleados.id')
            ->select(
                'proyecto_colaboradores.*',
                DB::raw('CONCAT(empleados.nombres, " ", empleados.apellidos) as nombre'),
                'empleados.email',
                'empleados.foto'
            )
            ->where('proyecto_colaboradores.proyecto_id', $id)
            ->where('proyecto_colaboradores.activo', 1)
            ->get();

        // Hitos
        $proyecto->hitos = DB::connection('mysql2')->table('proyecto_hitos')
            ->where('proyecto_id', $id)
            ->orderBy('orden')
            ->get();

        // Tareas del proyecto
        $proyecto->tareas = DB::connection('mysql2')->table('tareas_empleados')
            ->join('empleados', 'tareas_empleados.empleado', '=', 'empleados.id')
            ->select(
                'tareas_empleados.*',
                DB::raw('CONCAT(empleados.nombres, " ", empleados.apellidos) as empleado_nombre')
            )
            ->where('tareas_empleados.proyecto_id', $id)
            ->where('tareas_empleados.estado_reg', 'Activo')
            ->orderBy('tareas_empleados.fecha_pactada')
            ->get();

        // Documentos
        $proyecto->documentos = DB::connection('mysql2')->table('proyecto_documentos')
            ->join('users', 'proyecto_documentos.subido_por', '=', 'users.id')
            ->select('proyecto_documentos.*', 'users.name as subido_por_nombre')
            ->where('proyecto_documentos.proyecto_id', $id)
            ->get();

        // Métricas calculadas
        $proyecto->metricas = $this->calcularMetricas($id);

        return response()->json($proyecto);
    }

    /**
     * Crear nuevo proyecto
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:255',
            'departamento_id' => 'required|integer|exists:departamentos,id',
            'empresa_id' => 'required|integer|exists:empresas,id',
            'lider_proyecto' => 'required|integer|exists:empleados,id',
            'fecha_inicio' => 'required|date',
            'fecha_fin_estimada' => 'required|date|after:fecha_inicio',
            'prioridad' => 'required|in:Alta,Media,Baja',
        ]);

        DB::connection('mysql2')->beginTransaction();

        try {
            // Generar código único
            $ultimoProyecto = DB::connection('mysql2')->table('proyectos')
                ->whereYear('created_at', date('Y'))
                ->orderBy('id', 'desc')
                ->first();

            $numero = $ultimoProyecto ? intval(substr($ultimoProyecto->codigo, -3)) + 1 : 1;
            $codigo = 'PROJ-' . date('Y') . '-' . str_pad($numero, 3, '0', STR_PAD_LEFT);

            $proyectoId = DB::connection('mysql2')->table('proyectos')->insertGetId([
                'codigo' => $codigo,
                'nombre' => $validated['nombre'],
                'descripcion' => $request->descripcion,
                'departamento_id' => $validated['departamento_id'],
                'empresa_id' => $validated['empresa_id'],
                'lider_proyecto' => $validated['lider_proyecto'],
                'fecha_inicio' => $validated['fecha_inicio'],
                'fecha_fin_estimada' => $validated['fecha_fin_estimada'],
                'prioridad' => $validated['prioridad'],
                'estado' => $request->estado ?? 'Planificación',
                'presupuesto_estimado' => $request->presupuesto_estimado,
                'horas_estimadas' => $request->horas_estimadas,
                'cliente' => $request->cliente,
                'created_by' => Auth::id(),
            ]);

            // Agregar colaboradores si se especificaron
            if ($request->has('colaboradores') && is_array($request->colaboradores)) {
                foreach ($request->colaboradores as $colaborador) {
                    DB::connection('mysql2')->table('proyecto_colaboradores')->insert([
                        'proyecto_id' => $proyectoId,
                        'empleado_id' => $colaborador['empleado_id'],
                        'rol' => $colaborador['rol'] ?? null,
                    ]);
                }
            }

            // Agregar hitos si se especificaron
            if ($request->has('hitos') && is_array($request->hitos)) {
                foreach ($request->hitos as $index => $hito) {
                    DB::connection('mysql2')->table('proyecto_hitos')->insert([
                        'proyecto_id' => $proyectoId,
                        'nombre' => $hito['nombre'],
                        'descripcion' => $hito['descripcion'] ?? null,
                        'fecha_objetivo' => $hito['fecha_objetivo'],
                        'porcentaje_proyecto' => $hito['porcentaje'] ?? 0,
                        'orden' => $index + 1,
                    ]);
                }
            }

            DB::connection('mysql2')->commit();

            return response()->json([
                'success' => true,
                'message' => 'Proyecto creado correctamente',
                'proyecto_id' => $proyectoId,
                'codigo' => $codigo
            ], 201);

        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Actualizar proyecto
     */
    public function update(Request $request, $id)
    {
        DB::connection('mysql2')->beginTransaction();

        try {
            $updateData = $request->only([
                'nombre', 'descripcion', 'departamento_id', 'empresa_id',
                'lider_proyecto', 'fecha_inicio', 'fecha_fin_estimada',
                'prioridad', 'estado', 'presupuesto_estimado', 'cliente'
            ]);

            $updateData['updated_by'] = Auth::id();

            DB::connection('mysql2')->table('proyectos')
                ->where('id', $id)
                ->update($updateData);

            // Actualizar progreso automáticamente
            $this->actualizarProgreso($id);

            DB::connection('mysql2')->commit();

            return response()->json([
                'success' => true,
                'message' => 'Proyecto actualizado correctamente'
            ]);

        } catch (\Exception $e) {
            DB::connection('mysql2')->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Calcular métricas del proyecto
     */
    private function calcularMetricas($proyectoId)
    {
        // Tareas del proyecto
        $tareas = DB::connection('mysql2')->table('tareas_empleados')
            ->where('proyecto_id', $proyectoId)
            ->where('estado_reg', 'Activo')
            ->get();

        $totalTareas = $tareas->count();
        $tareasCompletadas = $tareas->where('estado', 'Completada')->count();
        $tareasPendientes = $tareas->where('estado', 'Pendiente')->count();
        $tareasEnProceso = $tareas->where('estado', 'En Proceso')->count();

        $progreso = $totalTareas > 0 ? round(($tareasCompletadas / $totalTareas) * 100, 2) : 0;

        // Horas trabajadas (si existe timetracking)
        $horasReales = DB::connection('mysql2')->table('registro_tiempo')
            ->join('tareas_empleados', 'registro_tiempo.tarea_id', '=', 'tareas_empleados.id')
            ->where('tareas_empleados.proyecto_id', $proyectoId)
            ->sum(DB::raw('TIME_TO_SEC(tiempo_trabajado) / 3600'));

        return [
            'total_tareas' => $totalTareas,
            'tareas_completadas' => $tareasCompletadas,
            'tareas_pendientes' => $tareasPendientes,
            'tareas_en_proceso' => $tareasEnProceso,
            'progreso_porcentaje' => $progreso,
            'horas_trabajadas' => round($horasReales, 2),
        ];
    }

    /**
     * Actualizar progreso del proyecto
     */
    private function actualizarProgreso($proyectoId)
    {
        $metricas = $this->calcularMetricas($proyectoId);

        DB::connection('mysql2')->table('proyectos')
            ->where('id', $proyectoId)
            ->update([
                'progreso_porcentaje' => $metricas['progreso_porcentaje'],
                'horas_reales' => $metricas['horas_trabajadas'],
            ]);
    }

    /**
     * Agregar colaborador al proyecto
     */
    public function agregarColaborador(Request $request, $proyectoId)
    {
        $validated = $request->validate([
            'empleado_id' => 'required|integer|exists:empleados,id',
            'rol' => 'nullable|string|max:100',
        ]);

        DB::connection('mysql2')->table('proyecto_colaboradores')->insert([
            'proyecto_id' => $proyectoId,
            'empleado_id' => $validated['empleado_id'],
            'rol' => $validated['rol'],
        ]);

        return response()->json(['success' => true, 'message' => 'Colaborador agregado']);
    }

    /**
     * Dashboard de proyectos por departamento
     */
    public function dashboardDepartamento($departamentoId)
    {
        $proyectos = DB::connection('mysql2')->table('proyectos')
            ->where('departamento_id', $departamentoId)
            ->whereIn('estado', ['Planificación', 'En Progreso'])
            ->get();

        $metricas = [
            'total_proyectos' => $proyectos->count(),
            'en_planificacion' => $proyectos->where('estado', 'Planificación')->count(),
            'en_progreso' => $proyectos->where('estado', 'En Progreso')->count(),
            'presupuesto_total' => $proyectos->sum('presupuesto_estimado'),
            'proyectos_criticos' => $proyectos->where('prioridad', 'Alta')->count(),
        ];

        return response()->json([
            'proyectos' => $proyectos,
            'metricas' => $metricas,
        ]);
    }
}
```

#### 2.1.3 Frontend - Componente de Proyectos

**Archivo:** `resources/js/components/ProjectsModule.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import axiosInstance from '../axiosConfig';
import {
    FaPlus, FaEdit, FaTrash, FaEye, FaFolder,
    FaChartLine, FaUsers, FaCalendar, FaCheckCircle
} from 'react-icons/fa';
import Swal from 'sweetalert2';

const ProjectsModule = () => {
    const [proyectos, setProyectos] = useState([]);
    const [filtros, setFiltros] = useState({
        departamento: '',
        estado: '',
        prioridad: ''
    });
    const [showModal, setShowModal] = useState(false);
    const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        cargarProyectos();
    }, [filtros]);

    const cargarProyectos = async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.get('/proyectos', { params: filtros });
            setProyectos(response.data);
        } catch (error) {
            console.error('Error al cargar proyectos:', error);
            Swal.fire('Error', 'No se pudieron cargar los proyectos', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCrearProyecto = () => {
        setProyectoSeleccionado(null);
        setShowModal(true);
    };

    const handleEditarProyecto = (proyecto) => {
        setProyectoSeleccionado(proyecto);
        setShowModal(true);
    };

    const handleVerDetalle = async (proyectoId) => {
        try {
            const response = await axiosInstance.get(`/proyectos/${proyectoId}`);
            setProyectoSeleccionado(response.data);
            setShowModal(true);
        } catch (error) {
            Swal.fire('Error', 'No se pudo cargar el proyecto', 'error');
        }
    };

    const getEstadoColor = (estado) => {
        const colores = {
            'Planificación': '#3b82f6',
            'En Progreso': '#10b981',
            'Pausado': '#f59e0b',
            'Completado': '#6366f1',
            'Cancelado': '#ef4444'
        };
        return colores[estado] || '#6b7280';
    };

    const getPrioridadBadge = (prioridad) => {
        const clases = {
            'Alta': 'badge-alta',
            'Media': 'badge-media',
            'Baja': 'badge-baja'
        };
        return clases[prioridad] || '';
    };

    return (
        <div className="projects-module">
            <div className="projects-header">
                <h1>Gestión de Proyectos</h1>
                <button className="btn-crear-proyecto" onClick={handleCrearProyecto}>
                    <FaPlus /> Nuevo Proyecto
                </button>
            </div>

            {/* Filtros */}
            <div className="filtros-proyectos">
                <select
                    value={filtros.estado}
                    onChange={(e) => setFiltros({...filtros, estado: e.target.value})}
                >
                    <option value="">Todos los estados</option>
                    <option value="Planificación">Planificación</option>
                    <option value="En Progreso">En Progreso</option>
                    <option value="Pausado">Pausado</option>
                    <option value="Completado">Completado</option>
                </select>

                <select
                    value={filtros.prioridad}
                    onChange={(e) => setFiltros({...filtros, prioridad: e.target.value})}
                >
                    <option value="">Todas las prioridades</option>
                    <option value="Alta">Alta</option>
                    <option value="Media">Media</option>
                    <option value="Baja">Baja</option>
                </select>
            </div>

            {/* Grid de Proyectos */}
            {loading ? (
                <div className="loader">Cargando proyectos...</div>
            ) : (
                <div className="projects-grid">
                    {proyectos.map(proyecto => (
                        <div key={proyecto.id} className="project-card">
                            <div className="project-card-header" style={{ borderTopColor: getEstadoColor(proyecto.estado) }}>
                                <div className="project-title">
                                    <FaFolder />
                                    <h3>{proyecto.nombre}</h3>
                                </div>
                                <span className={`prioridad-badge ${getPrioridadBadge(proyecto.prioridad)}`}>
                                    {proyecto.prioridad}
                                </span>
                            </div>

                            <div className="project-card-body">
                                <div className="project-info">
                                    <p><strong>Código:</strong> {proyecto.codigo}</p>
                                    <p><strong>Departamento:</strong> {proyecto.departamento_nombre}</p>
                                    <p><strong>Líder:</strong> {proyecto.lider_nombre}</p>
                                </div>

                                <div className="project-progress">
                                    <div className="progress-header">
                                        <span>Progreso</span>
                                        <span>{proyecto.metricas.progreso_porcentaje}%</span>
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{ width: `${proyecto.metricas.progreso_porcentaje}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="project-stats">
                                    <div className="stat">
                                        <FaCheckCircle />
                                        <span>{proyecto.metricas.tareas_completadas}/{proyecto.metricas.total_tareas} tareas</span>
                                    </div>
                                    <div className="stat">
                                        <FaCalendar />
                                        <span>{new Date(proyecto.fecha_fin_estimada).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="project-card-actions">
                                <button onClick={() => handleVerDetalle(proyecto.id)} className="btn-ver">
                                    <FaEye /> Ver Detalle
                                </button>
                                <button onClick={() => handleEditarProyecto(proyecto)} className="btn-editar">
                                    <FaEdit />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Proyecto */}
            {showModal && (
                <ProjectModal
                    proyecto={proyectoSeleccionado}
                    onClose={() => setShowModal(false)}
                    onUpdate={cargarProyectos}
                />
            )}
        </div>
    );
};

export default ProjectsModule;
```

#### 2.1.4 Rutas del Backend

**Agregar a:** `routes/web.php`

```php
Route::middleware(['auth:sanctum'])->group(function () {
    Route::prefix('api')->group(function () {

        // === PROYECTOS ===
        Route::get('/proyectos', [ProyectosController::class, 'index']);
        Route::get('/proyectos/{id}', [ProyectosController::class, 'show']);
        Route::post('/proyectos', [ProyectosController::class, 'store']);
        Route::put('/proyectos/{id}', [ProyectosController::class, 'update']);
        Route::delete('/proyectos/{id}', [ProyectosController::class, 'destroy']);

        // Colaboradores
        Route::post('/proyectos/{id}/colaboradores', [ProyectosController::class, 'agregarColaborador']);
        Route::delete('/proyectos/{proyectoId}/colaboradores/{empleadoId}', [ProyectosController::class, 'eliminarColaborador']);

        // Hitos
        Route::post('/proyectos/{id}/hitos', [ProyectosController::class, 'crearHito']);
        Route::put('/proyectos/{proyectoId}/hitos/{hitoId}', [ProyectosController::class, 'actualizarHito']);
        Route::delete('/proyectos/{proyectoId}/hitos/{hitoId}', [ProyectosController::class, 'eliminarHito']);

        // Dashboard
        Route::get('/proyectos/dashboard/departamento/{departamentoId}', [ProyectosController::class, 'dashboardDepartamento']);

        // === MODIFICAR TAREAS PARA INCLUIR PROYECTO ===
        // Ya existe POST /guardarTarea, solo agregar campo proyecto_id en el request
    });
});
```

---

### 2.2 Dashboard por Departamento

#### 2.2.1 Diseño de la Vista

```jsx
import React, { useState, useEffect } from 'react';
import axiosInstance from '../axiosConfig';
import {
    FaUsers, FaTasks, FaChartLine, FaClock,
    FaCheckCircle, FaExclamationTriangle
} from 'react-icons/fa';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
         XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DepartmentDashboard = ({ departamentoId, nombreDepartamento }) => {
    const [datos, setDatos] = useState(null);
    const [loading, setLoading] = useState(true);
    const [rangoFechas, setRangoFechas] = useState({
        inicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        fin: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        cargarDatosDepartamento();
    }, [departamentoId, rangoFechas]);

    const cargarDatosDepartamento = async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.get(`/dashboard/departamento/${departamentoId}`, {
                params: rangoFechas
            });
            setDatos(response.data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loader">Cargando...</div>;
    if (!datos) return null;

    const COLORES = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

    return (
        <div className="department-dashboard">
            {/* Header */}
            <div className="dashboard-header">
                <h1>Dashboard - {nombreDepartamento}</h1>
                <div className="date-filters">
                    <input
                        type="date"
                        value={rangoFechas.inicio}
                        onChange={(e) => setRangoFechas({...rangoFechas, inicio: e.target.value})}
                    />
                    <input
                        type="date"
                        value={rangoFechas.fin}
                        onChange={(e) => setRangoFechas({...rangoFechas, fin: e.target.value})}
                    />
                </div>
            </div>

            {/* KPIs Generales */}
            <div className="kpis-grid">
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ backgroundColor: '#10b981' }}>
                        <FaUsers />
                    </div>
                    <div className="kpi-content">
                        <h3>{datos.total_empleados}</h3>
                        <p>Empleados Activos</p>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon" style={{ backgroundColor: '#3b82f6' }}>
                        <FaTasks />
                    </div>
                    <div className="kpi-content">
                        <h3>{datos.total_tareas}</h3>
                        <p>Tareas Totales</p>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon" style={{ backgroundColor: '#f59e0b' }}>
                        <FaClock />
                    </div>
                    <div className="kpi-content">
                        <h3>{datos.tareas_en_proceso}</h3>
                        <p>En Proceso</p>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon" style={{ backgroundColor: '#10b981' }}>
                        <FaCheckCircle />
                    </div>
                    <div className="kpi-content">
                        <h3>{datos.tareas_completadas}</h3>
                        <p>Completadas</p>
                    </div>
                </div>
            </div>

            {/* Gráficas */}
            <div className="graficas-row">
                {/* Distribución de Tareas */}
                <div className="grafica-card">
                    <h3>Distribución de Tareas por Estado</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={datos.tareas_por_estado}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={(entry) => `${entry.name}: ${entry.value}`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {datos.tareas_por_estado.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Rendimiento por Empleado */}
                <div className="grafica-card">
                    <h3>Tareas Completadas por Empleado</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={datos.rendimiento_empleados}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="empleado" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="completadas" fill="#10b981" />
                            <Bar dataKey="en_proceso" fill="#3b82f6" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Proyectos Activos del Departamento */}
            <div className="proyectos-seccion">
                <h3>Proyectos Activos</h3>
                <div className="proyectos-cards">
                    {datos.proyectos_activos.map(proyecto => (
                        <div key={proyecto.id} className="proyecto-mini-card">
                            <h4>{proyecto.nombre}</h4>
                            <div className="proyecto-progress">
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{ width: `${proyecto.progreso}%` }}
                                    />
                                </div>
                                <span>{proyecto.progreso}%</span>
                            </div>
                            <p className="proyecto-tareas">
                                {proyecto.tareas_completadas}/{proyecto.tareas_totales} tareas
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Alertas y Pendientes */}
            <div className="alertas-seccion">
                <h3>Alertas y Pendientes</h3>
                {datos.tareas_atrasadas.length > 0 && (
                    <div className="alerta-card alerta-critica">
                        <FaExclamationTriangle />
                        <div>
                            <h4>Tareas Atrasadas</h4>
                            <p>{datos.tareas_atrasadas.length} tareas requieren atención inmediata</p>
                        </div>
                    </div>
                )}
                {datos.empleados_sobrecargados.length > 0 && (
                    <div className="alerta-card alerta-warning">
                        <FaExclamationTriangle />
                        <div>
                            <h4>Empleados con Sobrecarga</h4>
                            <p>{datos.empleados_sobrecargados.length} empleados tienen más de 10 tareas activas</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DepartmentDashboard;
```

#### 2.2.2 Backend - Dashboard por Departamento

```php
public function dashboardDepartamento(Request $request, $departamentoId)
{
    $inicio = $request->input('inicio', now()->startOfMonth());
    $fin = $request->input('fin', now());

    // Empleados del departamento
    $empleados = DB::connection('mysql2')->table('empleados')
        ->where('departamento', $departamentoId)
        ->where('estado_registro', 'Activo')
        ->get();

    // Tareas del departamento
    $tareas = DB::connection('mysql2')->table('tareas_empleados')
        ->join('empleados', 'tareas_empleados.empleado', '=', 'empleados.id')
        ->where('empleados.departamento', $departamentoId)
        ->where('tareas_empleados.estado_reg', 'Activo')
        ->whereBetween('tareas_empleados.fecha_creacion', [$inicio, $fin])
        ->select('tareas_empleados.*')
        ->get();

    // KPIs
    $data = [
        'total_empleados' => $empleados->count(),
        'total_tareas' => $tareas->count(),
        'tareas_completadas' => $tareas->where('estado', 'Completada')->count(),
        'tareas_en_proceso' => $tareas->where('estado', 'En Proceso')->count(),
        'tareas_pendientes' => $tareas->where('estado', 'Pendiente')->count(),
    ];

    // Distribución por estado
    $data['tareas_por_estado'] = [
        ['name' => 'Completadas', 'value' => $data['tareas_completadas']],
        ['name' => 'En Proceso', 'value' => $data['tareas_en_proceso']],
        ['name' => 'Pendientes', 'value' => $data['tareas_pendientes']],
    ];

    // Rendimiento por empleado
    $rendimiento = [];
    foreach ($empleados as $empleado) {
        $tareasEmpleado = $tareas->where('empleado', $empleado->id);
        $rendimiento[] = [
            'empleado' => $empleado->nombres . ' ' . $empleado->apellidos,
            'completadas' => $tareasEmpleado->where('estado', 'Completada')->count(),
            'en_proceso' => $tareasEmpleado->where('estado', 'En Proceso')->count(),
        ];
    }
    $data['rendimiento_empleados'] = $rendimiento;

    // Proyectos activos
    $proyectos = DB::connection('mysql2')->table('proyectos')
        ->where('departamento_id', $departamentoId)
        ->whereIn('estado', ['Planificación', 'En Progreso'])
        ->get();

    $proyectosData = [];
    foreach ($proyectos as $proyecto) {
        $metricas = $this->calcularMetricas($proyecto->id);
        $proyectosData[] = [
            'id' => $proyecto->id,
            'nombre' => $proyecto->nombre,
            'progreso' => $metricas['progreso_porcentaje'],
            'tareas_completadas' => $metricas['tareas_completadas'],
            'tareas_totales' => $metricas['total_tareas'],
        ];
    }
    $data['proyectos_activos'] = $proyectosData;

    // Alertas
    $data['tareas_atrasadas'] = $tareas->filter(function ($tarea) {
        return $tarea->fecha_pactada < now() && $tarea->estado != 'Completada';
    })->values();

    $data['empleados_sobrecargados'] = $empleados->filter(function ($empleado) use ($tareas) {
        $tareasActivas = $tareas->where('empleado', $empleado->id)
            ->whereIn('estado', ['Pendiente', 'En Proceso'])
            ->count();
        return $tareasActivas > 10;
    })->values();

    return response()->json($data);
}
```

---

### 2.3 Sistema de Timetracking

#### 2.3.1 Base de Datos

```sql
-- ============================================
-- TABLA: registro_tiempo
-- ============================================
CREATE TABLE registro_tiempo (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tarea_id INT NOT NULL,
    empleado_id INT NOT NULL,
    proyecto_id INT NULL COMMENT 'Opcional: hereda de tarea',

    -- Registro de tiempo
    fecha DATE NOT NULL,
    hora_inicio DATETIME NOT NULL,
    hora_fin DATETIME NULL,
    tiempo_trabajado TIME NULL COMMENT 'Calculado: hora_fin - hora_inicio',

    -- Contexto
    descripcion TEXT NULL COMMENT 'Qué se hizo en este tiempo',
    tipo ENUM('Manual', 'Timer', 'Ajuste') DEFAULT 'Manual',

    -- Aprobación
    aprobado TINYINT(1) DEFAULT 0,
    aprobado_por INT NULL,
    fecha_aprobacion DATETIME NULL,

    -- Metadatos
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (tarea_id) REFERENCES tareas_empleados(id) ON DELETE CASCADE,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE SET NULL,
    FOREIGN KEY (aprobado_por) REFERENCES users(id),

    INDEX idx_tarea (tarea_id),
    INDEX idx_empleado_fecha (empleado_id, fecha),
    INDEX idx_proyecto (proyecto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- TABLA: timer_activo
-- Para tracking en tiempo real
-- ============================================
CREATE TABLE timer_activo (
    id INT PRIMARY KEY AUTO_INCREMENT,
    empleado_id INT NOT NULL UNIQUE COMMENT 'Solo un timer activo por empleado',
    tarea_id INT NOT NULL,
    hora_inicio DATETIME NOT NULL,
    descripcion TEXT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
    FOREIGN KEY (tarea_id) REFERENCES tareas_empleados(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### 2.3.2 Backend - TimetrackingController

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class TimetrackingController extends Controller
{
    /**
     * Iniciar timer para una tarea
     */
    public function iniciarTimer(Request $request)
    {
        $empleado = Auth::user()->empleado;

        // Verificar si ya tiene un timer activo
        $timerActivo = DB::connection('mysql2')->table('timer_activo')
            ->where('empleado_id', $empleado)
            ->first();

        if ($timerActivo) {
            return response()->json([
                'error' => 'Ya tienes un timer activo. Deténlo primero.'
            ], 400);
        }

        // Crear nuevo timer
        DB::connection('mysql2')->table('timer_activo')->insert([
            'empleado_id' => $empleado,
            'tarea_id' => $request->tarea_id,
            'hora_inicio' => now(),
            'descripcion' => $request->descripcion,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Timer iniciado',
            'hora_inicio' => now()->toDateTimeString()
        ]);
    }

    /**
     * Detener timer y guardar registro
     */
    public function detenerTimer()
    {
        $empleado = Auth::user()->empleado;

        $timer = DB::connection('mysql2')->table('timer_activo')
            ->where('empleado_id', $empleado)
            ->first();

        if (!$timer) {
            return response()->json(['error' => 'No hay timer activo'], 400);
        }

        $horaInicio = Carbon::parse($timer->hora_inicio);
        $horaFin = now();
        $tiempoTrabajado = $horaFin->diff($horaInicio);

        // Guardar en registro_tiempo
        DB::connection('mysql2')->table('registro_tiempo')->insert([
            'tarea_id' => $timer->tarea_id,
            'empleado_id' => $empleado,
            'fecha' => $horaInicio->toDateString(),
            'hora_inicio' => $horaInicio,
            'hora_fin' => $horaFin,
            'tiempo_trabajado' => $tiempoTrabajado->format('%H:%I:%S'),
            'descripcion' => $timer->descripcion,
            'tipo' => 'Timer',
        ]);

        // Actualizar horas reales del proyecto si aplica
        $tarea = DB::connection('mysql2')->table('tareas_empleados')
            ->where('id', $timer->tarea_id)
            ->first();

        if ($tarea && $tarea->proyecto_id) {
            $this->actualizarHorasProyecto($tarea->proyecto_id);
        }

        // Eliminar timer activo
        DB::connection('mysql2')->table('timer_activo')
            ->where('empleado_id', $empleado)
            ->delete();

        return response()->json([
            'success' => true,
            'message' => 'Timer detenido y tiempo registrado',
            'tiempo_trabajado' => $tiempoTrabajado->format('%H:%I:%S')
        ]);
    }

    /**
     * Obtener timer activo del empleado
     */
    public function obtenerTimerActivo()
    {
        $empleado = Auth::user()->empleado;

        $timer = DB::connection('mysql2')->table('timer_activo')
            ->join('tareas_empleados', 'timer_activo.tarea_id', '=', 'tareas_empleados.id')
            ->where('timer_activo.empleado_id', $empleado)
            ->select('timer_activo.*', 'tareas_empleados.titulo as tarea_titulo')
            ->first();

        if (!$timer) {
            return response()->json(['activo' => false]);
        }

        $horaInicio = Carbon::parse($timer->hora_inicio);
        $tiempoTranscurrido = now()->diff($horaInicio);

        return response()->json([
            'activo' => true,
            'tarea_id' => $timer->tarea_id,
            'tarea_titulo' => $timer->tarea_titulo,
            'hora_inicio' => $timer->hora_inicio,
            'tiempo_transcurrido' => $tiempoTranscurrido->format('%H:%I:%S')
        ]);
    }

    /**
     * Registrar tiempo manualmente
     */
    public function registrarTiempoManual(Request $request)
    {
        $validated = $request->validate([
            'tarea_id' => 'required|integer|exists:tareas_empleados,id',
            'fecha' => 'required|date',
            'hora_inicio' => 'required',
            'hora_fin' => 'required',
            'descripcion' => 'nullable|string',
        ]);

        $empleado = Auth::user()->empleado;

        $horaInicio = Carbon::parse($validated['fecha'] . ' ' . $validated['hora_inicio']);
        $horaFin = Carbon::parse($validated['fecha'] . ' ' . $validated['hora_fin']);

        if ($horaFin->lte($horaInicio)) {
            return response()->json(['error' => 'La hora de fin debe ser posterior a la de inicio'], 400);
        }

        $tiempoTrabajado = $horaFin->diff($horaInicio);

        DB::connection('mysql2')->table('registro_tiempo')->insert([
            'tarea_id' => $validated['tarea_id'],
            'empleado_id' => $empleado,
            'fecha' => $validated['fecha'],
            'hora_inicio' => $horaInicio,
            'hora_fin' => $horaFin,
            'tiempo_trabajado' => $tiempoTrabajado->format('%H:%I:%S'),
            'descripcion' => $validated['descripcion'],
            'tipo' => 'Manual',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tiempo registrado correctamente'
        ]);
    }

    /**
     * Obtener registros de tiempo de un empleado
     */
    public function obtenerRegistros(Request $request)
    {
        $empleado = Auth::user()->empleado;
        $fechaInicio = $request->input('fecha_inicio', now()->startOfMonth());
        $fechaFin = $request->input('fecha_fin', now());

        $registros = DB::connection('mysql2')->table('registro_tiempo')
            ->join('tareas_empleados', 'registro_tiempo.tarea_id', '=', 'tareas_empleados.id')
            ->where('registro_tiempo.empleado_id', $empleado)
            ->whereBetween('registro_tiempo.fecha', [$fechaInicio, $fechaFin])
            ->select('registro_tiempo.*', 'tareas_empleados.titulo as tarea_titulo')
            ->orderBy('registro_tiempo.fecha', 'desc')
            ->get();

        // Calcular totales
        $totalSegundos = 0;
        foreach ($registros as $registro) {
            list($h, $m, $s) = explode(':', $registro->tiempo_trabajado);
            $totalSegundos += ($h * 3600) + ($m * 60) + $s;
        }

        $horas = floor($totalSegundos / 3600);
        $minutos = floor(($totalSegundos % 3600) / 60);

        return response()->json([
            'registros' => $registros,
            'total_horas' => $horas,
            'total_minutos' => $minutos,
            'total_formateado' => sprintf('%02d:%02d', $horas, $minutos)
        ]);
    }

    /**
     * Reporte de horas por proyecto
     */
    public function reporteHorasPorProyecto(Request $request, $proyectoId)
    {
        $registros = DB::connection('mysql2')->table('registro_tiempo')
            ->join('tareas_empleados', 'registro_tiempo.tarea_id', '=', 'tareas_empleados.id')
            ->join('empleados', 'registro_tiempo.empleado_id', '=', 'empleados.id')
            ->where('tareas_empleados.proyecto_id', $proyectoId)
            ->select(
                'registro_tiempo.*',
                'tareas_empleados.titulo as tarea',
                DB::raw('CONCAT(empleados.nombres, " ", empleados.apellidos) as empleado')
            )
            ->get();

        // Agrupar por empleado
        $porEmpleado = [];
        foreach ($registros as $registro) {
            if (!isset($porEmpleado[$registro->empleado])) {
                $porEmpleado[$registro->empleado] = 0;
            }
            list($h, $m, $s) = explode(':', $registro->tiempo_trabajado);
            $porEmpleado[$registro->empleado] += ($h * 3600) + ($m * 60) + $s;
        }

        // Convertir a formato legible
        $resultado = [];
        foreach ($porEmpleado as $empleado => $segundos) {
            $horas = floor($segundos / 3600);
            $minutos = floor(($segundos % 3600) / 60);
            $resultado[] = [
                'empleado' => $empleado,
                'horas' => $horas,
                'minutos' => $minutos,
                'total_formateado' => sprintf('%02d:%02d', $horas, $minutos)
            ];
        }

        return response()->json([
            'registros' => $registros,
            'resumen_por_empleado' => $resultado
        ]);
    }

    /**
     * Actualizar horas reales de proyecto
     */
    private function actualizarHorasProyecto($proyectoId)
    {
        $totalSegundos = DB::connection('mysql2')->table('registro_tiempo')
            ->join('tareas_empleados', 'registro_tiempo.tarea_id', '=', 'tareas_empleados.id')
            ->where('tareas_empleados.proyecto_id', $proyectoId)
            ->sum(DB::raw('TIME_TO_SEC(tiempo_trabajado)'));

        $horasReales = round($totalSegundos / 3600, 2);

        DB::connection('mysql2')->table('proyectos')
            ->where('id', $proyectoId)
            ->update(['horas_reales' => $horasReales]);
    }
}
```

#### 2.3.3 Frontend - TimeTracker Component

```jsx
import React, { useState, useEffect } from 'react';
import axiosInstance from '../axiosConfig';
import { FaPlay, FaStop, FaClock, FaCalendar } from 'react-icons/fa';
import Swal from 'sweetalert2';

const TimeTracker = ({ tareaActual }) => {
    const [timerActivo, setTimerActivo] = useState(null);
    const [tiempoTranscurrido, setTiempoTranscurrido] = useState('00:00:00');
    const [registros, setRegistros] = useState([]);

    useEffect(() => {
        verificarTimerActivo();
        cargarRegistros();
    }, []);

    useEffect(() => {
        let interval;
        if (timerActivo) {
            interval = setInterval(() => {
                actualizarTiempoTranscurrido();
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timerActivo]);

    const verificarTimerActivo = async () => {
        try {
            const response = await axiosInstance.get('/timetracking/timer-activo');
            if (response.data.activo) {
                setTimerActivo(response.data);
            }
        } catch (error) {
            console.error('Error al verificar timer:', error);
        }
    };

    const actualizarTiempoTranscurrido = () => {
        if (!timerActivo) return;

        const inicio = new Date(timerActivo.hora_inicio);
        const ahora = new Date();
        const diff = Math.floor((ahora - inicio) / 1000);

        const horas = Math.floor(diff / 3600);
        const minutos = Math.floor((diff % 3600) / 60);
        const segundos = diff % 60;

        setTiempoTranscurrido(
            `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`
        );
    };

    const iniciarTimer = async () => {
        if (!tareaActual) {
            Swal.fire('Error', 'Selecciona una tarea primero', 'error');
            return;
        }

        const { value: descripcion } = await Swal.fire({
            title: 'Iniciar Timer',
            input: 'textarea',
            inputLabel: '¿En qué vas a trabajar?',
            inputPlaceholder: 'Describe brevemente la actividad...',
            showCancelButton: true,
        });

        if (descripcion) {
            try {
                const response = await axiosInstance.post('/timetracking/iniciar-timer', {
                    tarea_id: tareaActual.id,
                    descripcion
                });

                await verificarTimerActivo();
                Swal.fire('¡Iniciado!', 'Timer en marcha', 'success');
            } catch (error) {
                Swal.fire('Error', error.response?.data?.error || 'Error al iniciar timer', 'error');
            }
        }
    };

    const detenerTimer = async () => {
        try {
            const response = await axiosInstance.post('/timetracking/detener-timer');
            setTimerActivo(null);
            setTiempoTranscurrido('00:00:00');
            await cargarRegistros();
            Swal.fire('Detenido', `Tiempo registrado: ${response.data.tiempo_trabajado}`, 'success');
        } catch (error) {
            Swal.fire('Error', 'Error al detener timer', 'error');
        }
    };

    const cargarRegistros = async () => {
        try {
            const response = await axiosInstance.get('/timetracking/registros');
            setRegistros(response.data.registros);
        } catch (error) {
            console.error('Error al cargar registros:', error);
        }
    };

    const registrarTiempoManual = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Registrar Tiempo Manual',
            html:
                '<input id="fecha" type="date" class="swal2-input" placeholder="Fecha">' +
                '<input id="hora_inicio" type="time" class="swal2-input" placeholder="Hora inicio">' +
                '<input id="hora_fin" type="time" class="swal2-input" placeholder="Hora fin">' +
                '<textarea id="descripcion" class="swal2-textarea" placeholder="Descripción"></textarea>',
            focusConfirm: false,
            preConfirm: () => {
                return {
                    tarea_id: tareaActual.id,
                    fecha: document.getElementById('fecha').value,
                    hora_inicio: document.getElementById('hora_inicio').value,
                    hora_fin: document.getElementById('hora_fin').value,
                    descripcion: document.getElementById('descripcion').value
                };
            }
        });

        if (formValues) {
            try {
                await axiosInstance.post('/timetracking/registrar-manual', formValues);
                await cargarRegistros();
                Swal.fire('Registrado', 'Tiempo registrado correctamente', 'success');
            } catch (error) {
                Swal.fire('Error', error.response?.data?.error || 'Error al registrar', 'error');
            }
        }
    };

    return (
        <div className="time-tracker">
            <div className="timer-controls">
                {!timerActivo ? (
                    <button className="btn-iniciar-timer" onClick={iniciarTimer}>
                        <FaPlay /> Iniciar Timer
                    </button>
                ) : (
                    <div className="timer-activo">
                        <div className="timer-display">
                            <FaClock className="timer-icon pulsing" />
                            <span className="tiempo">{tiempoTranscurrido}</span>
                        </div>
                        <div className="timer-info">
                            <small>Tarea: {timerActivo.tarea_titulo}</small>
                        </div>
                        <button className="btn-detener-timer" onClick={detenerTimer}>
                            <FaStop /> Detener
                        </button>
                    </div>
                )}

                <button className="btn-manual" onClick={registrarTiempoManual}>
                    <FaCalendar /> Registro Manual
                </button>
            </div>

            <div className="registros-tiempo">
                <h4>Registros Recientes</h4>
                {registros.slice(0, 5).map(registro => (
                    <div key={registro.id} className="registro-item">
                        <div className="registro-fecha">{registro.fecha}</div>
                        <div className="registro-tarea">{registro.tarea_titulo}</div>
                        <div className="registro-tiempo">{registro.tiempo_trabajado}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TimeTracker;
```

---

## 3. NIVEL 2: MEJORAS IMPORTANTES

### 3.1 Sistema de Dependencias entre Tareas

#### 3.1.1 Base de Datos

```sql
CREATE TABLE dependencias_tareas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tarea_origen_id INT NOT NULL COMMENT 'Tarea que debe completarse primero',
    tarea_dependiente_id INT NOT NULL COMMENT 'Tarea que depende de la otra',
    tipo_dependencia ENUM(
        'fin_a_inicio',      -- La dependiente inicia cuando la origen termina
        'fin_a_fin',         -- Ambas deben terminar juntas
        'inicio_a_inicio',   -- Ambas deben iniciar juntas
        'inicio_a_fin'       -- La dependiente termina cuando la origen inicia
    ) DEFAULT 'fin_a_inicio',

    retraso_dias INT DEFAULT 0 COMMENT 'Días de delay entre tareas',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,

    FOREIGN KEY (tarea_origen_id) REFERENCES tareas_empleados(id) ON DELETE CASCADE,
    FOREIGN KEY (tarea_dependiente_id) REFERENCES tareas_empleados(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),

    UNIQUE KEY unique_dependencia (tarea_origen_id, tarea_dependiente_id),
    INDEX idx_origen (tarea_origen_id),
    INDEX idx_dependiente (tarea_dependiente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### 3.1.2 Lógica de Alertas

```php
public function verificarDependencias($tareaId)
{
    // Obtener dependencias bloqueantes
    $dependencias = DB::connection('mysql2')->table('dependencias_tareas')
        ->join('tareas_empleados as tarea_origen', 'dependencias_tareas.tarea_origen_id', '=', 'tarea_origen.id')
        ->where('dependencias_tareas.tarea_dependiente_id', $tareaId)
        ->where('dependencias_tareas.tipo_dependencia', 'fin_a_inicio')
        ->select('tarea_origen.*', 'dependencias_tareas.tipo_dependencia')
        ->get();

    $bloqueantes = [];
    foreach ($dependencias as $dep) {
        if ($dep->estado != 'Completada') {
            $bloqueantes[] = [
                'tarea_id' => $dep->id,
                'titulo' => $dep->titulo,
                'estado' => $dep->estado
            ];
        }
    }

    return [
        'puede_iniciar' => empty($bloqueantes),
        'tareas_bloqueantes' => $bloqueantes
    ];
}
```

---

### 3.2 Sistema de Etiquetas y Categorización

#### 3.2.1 Base de Datos

```sql
CREATE TABLE etiquetas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#3b82f6' COMMENT 'Color hex',
    icono VARCHAR(50) NULL COMMENT 'Nombre del ícono FontAwesome',
    departamento_id INT NULL COMMENT 'NULL = global, específico = solo ese depto',
    descripcion VARCHAR(255) NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,

    FOREIGN KEY (departamento_id) REFERENCES departamentos(id),
    FOREIGN KEY (created_by) REFERENCES users(id),

    UNIQUE KEY unique_etiqueta_departamento (nombre, departamento_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tareas_etiquetas (
    tarea_id INT NOT NULL,
    etiqueta_id INT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (tarea_id, etiqueta_id),
    FOREIGN KEY (tarea_id) REFERENCES tareas_empleados(id) ON DELETE CASCADE,
    FOREIGN KEY (etiqueta_id) REFERENCES etiquetas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Etiquetas predefinidas por área
INSERT INTO etiquetas (nombre, color, departamento_id) VALUES
-- Desarrollo
('bug', '#ef4444', (SELECT id FROM departamentos WHERE nombre = 'Desarrollo')),
('feature', '#10b981', (SELECT id FROM departamentos WHERE nombre = 'Desarrollo')),
('refactor', '#f59e0b', (SELECT id FROM departamentos WHERE nombre = 'Desarrollo')),
('testing', '#6366f1', (SELECT id FROM departamentos WHERE nombre = 'Desarrollo')),

-- Diseño
('branding', '#ec4899', (SELECT id FROM departamentos WHERE nombre = 'Diseño Gráfico')),
('ux', '#8b5cf6', (SELECT id FROM departamentos WHERE nombre = 'Diseño Gráfico')),
('ui', '#3b82f6', (SELECT id FROM departamentos WHERE nombre = 'Diseño Gráfico')),

-- Contabilidad
('facturación', '#10b981', (SELECT id FROM departamentos WHERE nombre = 'Contabilidad')),
('conciliación', '#f59e0b', (SELECT id FROM departamentos WHERE nombre = 'Contabilidad')),
('impuestos', '#ef4444', (SELECT id FROM departamentos WHERE nombre = 'Contabilidad'));
```

---

### 3.3 Plantillas de Tareas

#### 3.3.1 Base de Datos

```sql
CREATE TABLE plantillas_tareas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    departamento_id INT NULL COMMENT 'NULL = global',

    -- Valores por defecto
    prioridad_default ENUM('Alta', 'Media', 'Baja') DEFAULT 'Media',
    estimacion_horas INT NULL,

    -- Checklist de subtareas
    checklist JSON NULL COMMENT 'Array de pasos a seguir',

    -- Etiquetas predeterminadas
    etiquetas_default JSON NULL COMMENT 'Array de IDs de etiquetas',

    -- Metadatos
    activa TINYINT(1) DEFAULT 1,
    veces_usada INT DEFAULT 0,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (departamento_id) REFERENCES departamentos(id),
    FOREIGN KEY (created_by) REFERENCES users(id),

    INDEX idx_departamento (departamento_id),
    INDEX idx_activa (activa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ejemplos de plantillas
INSERT INTO plantillas_tareas (nombre, descripcion, departamento_id, checklist, prioridad_default, created_by) VALUES
(
    'Implementar nueva feature',
    'Template para desarrollo de funcionalidad nueva',
    (SELECT id FROM departamentos WHERE nombre = 'Desarrollo'),
    JSON_ARRAY(
        'Analizar requerimientos',
        'Diseñar solución técnica',
        'Implementar código',
        'Escribir tests',
        'Code review',
        'Deploy a staging',
        'Testing QA',
        'Deploy a producción'
    ),
    'Media',
    1
);
```

---

## 4. NIVEL 3: MEJORAS COMPLEMENTARIAS

### 4.1 Vista de Calendario

**Librería recomendada:** FullCalendar React

```jsx
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

const CalendarView = () => {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        cargarTareasCalendario();
    }, []);

    const cargarTareasCalendario = async () => {
        const response = await axiosInstance.get('/tareas/calendario');
        const eventos = response.data.map(tarea => ({
            id: tarea.id,
            title: tarea.titulo,
            start: tarea.fecha_pactada,
            end: tarea.fecha_pactada,
            backgroundColor: getPrioridadColor(tarea.prioridad),
            extendedProps: {
                estado: tarea.estado,
                empleado: tarea.empleado_nombre
            }
        }));
        setEvents(eventos);
    };

    return (
        <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            events={events}
            eventClick={(info) => handleEventClick(info.event)}
            locale="es"
        />
    );
};
```

---

### 4.2 Dashboard Ejecutivo

```jsx
const ExecutiveDashboard = () => {
    return (
        <div className="executive-dashboard">
            {/* Vista 360° de toda la empresa */}

            {/* KPIs Globales */}
            <div className="global-kpis">
                <KPICard
                    title="Proyectos Activos"
                    value={datos.proyectos_activos}
                    trend="+12%"
                    icon={<FaFolder />}
                />
                <KPICard
                    title="Tareas Completadas (mes)"
                    value={datos.tareas_completadas_mes}
                    trend="+8%"
                    icon={<FaCheckCircle />}
                />
                <KPICard
                    title="Eficiencia Global"
                    value={`${datos.eficiencia_global}%`}
                    trend="+3%"
                    icon={<FaChartLine />}
                />
            </div>

            {/* Comparativa por Departamento */}
            <div className="departamentos-comparison">
                <h2>Rendimiento por Departamento</h2>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={datos.por_departamento}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="departamento" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="tareas_completadas" fill="#10b981" />
                        <Bar dataKey="eficiencia" fill="#3b82f6" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Proyectos en Riesgo */}
            <div className="proyectos-riesgo">
                <h2>Proyectos que Requieren Atención</h2>
                {datos.proyectos_en_riesgo.map(proyecto => (
                    <AlertCard
                        key={proyecto.id}
                        proyecto={proyecto}
                        tipo="warning"
                    />
                ))}
            </div>

            {/* Tendencias Temporales */}
            <div className="tendencias">
                <h2>Tendencia de Productividad (6 meses)</h2>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={datos.tendencia_6_meses}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="tareas_completadas" stroke="#10b981" />
                        <Line type="monotone" dataKey="eficiencia" stroke="#3b82f6" />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
```

---

### 4.3 Subtareas y Checklist

```sql
CREATE TABLE subtareas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tarea_padre_id INT NOT NULL,
    descripcion VARCHAR(500) NOT NULL,
    completada TINYINT(1) DEFAULT 0,
    orden INT NOT NULL DEFAULT 1,

    empleado_asignado INT NULL,
    fecha_completada DATETIME NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (tarea_padre_id) REFERENCES tareas_empleados(id) ON DELETE CASCADE,
    FOREIGN KEY (empleado_asignado) REFERENCES empleados(id),

    INDEX idx_tarea (tarea_padre_id),
    INDEX idx_orden (tarea_padre_id, orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

```jsx
const SubtareasChecklist = ({ tareaId }) => {
    const [subtareas, setSubtareas] = useState([]);
    const [nuevaSubtarea, setNuevaSubtarea] = useState('');

    const toggleSubtarea = async (subtareaId, completada) => {
        await axiosInstance.put(`/subtareas/${subtareaId}`, { completada: !completada });
        cargarSubtareas();
    };

    const agregarSubtarea = async () => {
        await axiosInstance.post('/subtareas', {
            tarea_padre_id: tareaId,
            descripcion: nuevaSubtarea
        });
        setNuevaSubtarea('');
        cargarSubtareas();
    };

    const progreso = subtareas.length > 0
        ? (subtareas.filter(s => s.completada).length / subtareas.length) * 100
        : 0;

    return (
        <div className="subtareas-checklist">
            <div className="progreso-subtareas">
                <span>Progreso: {Math.round(progreso)}%</span>
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progreso}%` }} />
                </div>
            </div>

            <div className="lista-subtareas">
                {subtareas.map(subtarea => (
                    <div key={subtarea.id} className="subtarea-item">
                        <input
                            type="checkbox"
                            checked={subtarea.completada}
                            onChange={() => toggleSubtarea(subtarea.id, subtarea.completada)}
                        />
                        <span className={subtarea.completada ? 'completada' : ''}>
                            {subtarea.descripcion}
                        </span>
                    </div>
                ))}
            </div>

            <div className="agregar-subtarea">
                <input
                    type="text"
                    value={nuevaSubtarea}
                    onChange={(e) => setNuevaSubtarea(e.target.value)}
                    placeholder="Nueva subtarea..."
                />
                <button onClick={agregarSubtarea}>Agregar</button>
            </div>
        </div>
    );
};
```

---

### 4.4 Análisis Predictivo

```php
class AnalyticsPredictiveService
{
    /**
     * Predecir si una tarea se retrasará
     */
    public function predecirRetraso($tareaId)
    {
        $tarea = DB::connection('mysql2')->table('tareas_empleados')->find($tareaId);

        // Factores de riesgo
        $diasRestantes = Carbon::parse($tarea->fecha_pactada)->diffInDays(now(), false);
        $progreso = $this->calcularProgresoTarea($tareaId);

        // Histórico del empleado
        $tasksHistoricas = DB::connection('mysql2')->table('tareas_empleados')
            ->where('empleado', $tarea->empleado)
            ->where('estado', 'Completada')
            ->get();

        $retrasosHistoricos = $tasksHistoricas->filter(function($t) {
            return $t->fecha_entregada > $t->fecha_pactada;
        })->count();

        $tasaRetraso = $tasksHistoricas->count() > 0
            ? ($retrasosHistoricos / $tasksHistoricas->count()) * 100
            : 0;

        // Lógica predictiva simple
        $riesgo = 'Bajo';
        if ($diasRestantes < 3 && $progreso < 50) {
            $riesgo = 'Alto';
        } elseif ($diasRestantes < 7 && $progreso < 70) {
            $riesgo = 'Medio';
        } elseif ($tasaRetraso > 40) {
            $riesgo = 'Medio';
        }

        return [
            'riesgo' => $riesgo,
            'progreso_actual' => $progreso,
            'dias_restantes' => $diasRestantes,
            'tasa_retraso_empleado' => round($tasaRetraso, 2),
            'recomendaciones' => $this->generarRecomendaciones($riesgo, $tarea)
        ];
    }

    /**
     * Detectar sobrecarga de empleados
     */
    public function detectarSobrecarga()
    {
        $empleados = DB::connection('mysql2')->table('empleados')
            ->where('estado_registro', 'Activo')
            ->get();

        $sobrecargados = [];

        foreach ($empleados as $empleado) {
            $tareasActivas = DB::connection('mysql2')->table('tareas_empleados')
                ->where('empleado', $empleado->id)
                ->whereIn('estado', ['Pendiente', 'En Proceso'])
                ->where('aprobada', 1)
                ->where('pausada', 0)
                ->count();

            // Umbral: más de 10 tareas activas
            if ($tareasActivas > 10) {
                $sobrecargados[] = [
                    'empleado_id' => $empleado->id,
                    'nombre' => $empleado->nombres . ' ' . $empleado->apellidos,
                    'tareas_activas' => $tareasActivas,
                    'nivel_sobrecarga' => $tareasActivas > 15 ? 'Crítico' : 'Alto',
                    'sugerencia' => 'Redistribuir o priorizar tareas'
                ];
            }
        }

        return $sobrecargados;
    }

    /**
     * Análisis de velocidad de equipo (burn-down chart data)
     */
    public function velocidadEquipo($departamentoId, $semanas = 4)
    {
        $data = [];

        for ($i = 0; $i < $semanas; $i++) {
            $inicioSemana = now()->subWeeks($i + 1)->startOfWeek();
            $finSemana = now()->subWeeks($i + 1)->endOfWeek();

            $tareasCompletadas = DB::connection('mysql2')->table('tareas_empleados')
                ->join('empleados', 'tareas_empleados.empleado', '=', 'empleados.id')
                ->where('empleados.departamento', $departamentoId)
                ->where('tareas_empleados.estado', 'Completada')
                ->whereBetween('tareas_empleados.fecha_entregada', [$inicioSemana, $finSemana])
                ->count();

            $data[] = [
                'semana' => $inicioSemana->format('W'),
                'tareas_completadas' => $tareasCompletadas
            ];
        }

        // Calcular promedio
        $promedio = collect($data)->avg('tareas_completadas');

        return [
            'datos_semanales' => array_reverse($data),
            'promedio_semanal' => round($promedio, 2),
            'tendencia' => $this->calcularTendencia($data)
        ];
    }
}
```

---

## 5. MEJORAS ESPECÍFICAS POR ÁREA

### 5.1 Desarrollo

```sql
-- Integración con repositorios
CREATE TABLE desarrollo_commits (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tarea_id INT NOT NULL,
    repo_url VARCHAR(500),
    commit_hash VARCHAR(100),
    mensaje TEXT,
    autor VARCHAR(100),
    fecha_commit DATETIME,

    FOREIGN KEY (tarea_id) REFERENCES tareas_empleados(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bugs tracking
ALTER TABLE tareas_empleados
    ADD COLUMN bug_severity ENUM('Crítico', 'Alto', 'Medio', 'Bajo') NULL,
    ADD COLUMN bug_reproducible TINYINT(1) DEFAULT 1,
    ADD COLUMN steps_to_reproduce TEXT NULL;
```

### 5.2 Diseño Gráfico

```sql
-- Iteraciones de diseño
CREATE TABLE diseno_iteraciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tarea_id INT NOT NULL,
    version INT NOT NULL,
    archivo_url VARCHAR(500),
    feedback TEXT,
    aprobado_por INT NULL,
    fecha_revision DATETIME,

    FOREIGN KEY (tarea_id) REFERENCES tareas_empleados(id) ON DELETE CASCADE,
    FOREIGN KEY (aprobado_por) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 5.3 Proyectos

```sql
-- Entregables
CREATE TABLE proyecto_entregables (
    id INT PRIMARY KEY AUTO_INCREMENT,
    proyecto_id INT NOT NULL,
    nombre VARCHAR(255),
    descripcion TEXT,
    fecha_compromiso DATE,
    fecha_entrega DATE NULL,
    estado ENUM('Pendiente', 'En Progreso', 'Entregado', 'Aprobado') DEFAULT 'Pendiente',
    archivo_url VARCHAR(500),

    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 5.4 Contabilidad

```sql
-- Checklist de cierre mensual
CREATE TABLE contabilidad_checklist_cierre (
    id INT PRIMARY KEY AUTO_INCREMENT,
    mes INT NOT NULL,
    anio INT NOT NULL,
    item VARCHAR(255) NOT NULL,
    completado TINYINT(1) DEFAULT 0,
    fecha_completado DATETIME NULL,
    responsable INT,

    FOREIGN KEY (responsable) REFERENCES empleados(id),
    UNIQUE KEY unique_mes_item (mes, anio, item)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 5.5 Jurídica

```sql
-- Expedientes legales
CREATE TABLE juridica_expedientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    numero_expediente VARCHAR(100) UNIQUE,
    tipo ENUM('Contrato', 'Litigio', 'Consulta', 'Compliance') NOT NULL,
    cliente VARCHAR(255),
    descripcion TEXT,
    estado ENUM('Abierto', 'En Proceso', 'Cerrado') DEFAULT 'Abierto',
    fecha_apertura DATE,
    fecha_cierre DATE NULL,
    abogado_responsable INT,

    FOREIGN KEY (abogado_responsable) REFERENCES empleados(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 5.6 Recursos Humanos

```sql
-- Pipeline de reclutamiento
CREATE TABLE rrhh_candidatos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre_completo VARCHAR(255),
    email VARCHAR(255),
    telefono VARCHAR(50),
    posicion_aplicada VARCHAR(255),
    etapa ENUM('CV Recibido', 'Entrevista Telefónica', 'Entrevista Técnica',
               'Entrevista Final', 'Oferta Enviada', 'Contratado', 'Rechazado')
           DEFAULT 'CV Recibido',
    cv_url VARCHAR(500),
    notas TEXT,
    reclutador_asignado INT,
    fecha_aplicacion DATE,

    FOREIGN KEY (reclutador_asignado) REFERENCES empleados(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 5.7 Contenido Educativo

```sql
-- Calendario editorial
CREATE TABLE contenido_calendario_editorial (
    id INT PRIMARY KEY AUTO_INCREMENT,
    titulo VARCHAR(255),
    tipo ENUM('Blog', 'Video', 'Infografía', 'Podcast', 'Curso') NOT NULL,
    tema VARCHAR(255),
    fecha_publicacion_planificada DATE,
    fecha_publicacion_real DATE NULL,
    estado ENUM('Idea', 'En Redacción', 'En Revisión', 'Aprobado', 'Publicado')
           DEFAULT 'Idea',
    redactor INT,
    revisor INT,
    url_publicacion VARCHAR(500) NULL,

    FOREIGN KEY (redactor) REFERENCES empleados(id),
    FOREIGN KEY (revisor) REFERENCES empleados(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 6. OPTIMIZACIONES TÉCNICAS

### 6.1 Backend Optimizations

#### 6.1.1 Refactorizar Controllers

**Problema actual:** EmpleadosController tiene 1400+ líneas

**Solución: Dividir en múltiples controllers**

```
app/Http/Controllers/
├─ Empleados/
│  ├─ EmpleadosController.php (CRUD empleados)
│  ├─ FuncionesController.php (Funciones)
│  └─ ActividadesController.php (Actividades)
│
├─ Tareas/
│  ├─ TareasController.php (CRUD tareas)
│  ├─ EstadoTareasController.php (Cambios de estado)
│  ├─ AprobacionesController.php (Aprobaciones/rechazos)
│  └─ EvidenciasController.php (Ya existe)
│
├─ Reportes/
│  └─ ReportesController.php
│
├─ Proyectos/
│  └─ ProyectosController.php
│
└─ Parametros/
   ├─ UsuariosController.php
   ├─ EmpresasController.php
   └─ LideresController.php
```

#### 6.1.2 Implementar Services

```php
// app/Services/NotificationService.php
class NotificationService
{
    public function notificarNuevaTarea(Tarea $tarea)
    {
        $receptor = $this->determinarReceptor($tarea);
        $mensaje = $this->construirMensaje($tarea, 'Tarea');

        $this->guardarNotificacion($receptor, $mensaje, $tarea->id, 'Tarea');
    }

    private function determinarReceptor(Tarea $tarea)
    {
        // Lógica de routing de notificaciones
    }

    private function guardarNotificacion($receptor, $mensaje, $tareaId, $tipo)
    {
        // Guardar en BD
    }
}

// Uso en controller
public function guardarTarea(Request $request)
{
    $tarea = Tarea::create($request->validated());

    app(NotificationService::class)->notificarNuevaTarea($tarea);

    return response()->json(['success' => true]);
}
```

#### 6.1.3 Implementar Eloquent Models

```php
// app/Models/Tarea.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Tarea extends Model
{
    protected $table = 'tareas_empleados';
    protected $connection = 'mysql2';

    protected $fillable = [
        'titulo', 'descripcion', 'empleado', 'proyecto_id',
        'fecha_pactada', 'prioridad', 'estado'
    ];

    protected $casts = [
        'aprobada' => 'boolean',
        'pausada' => 'boolean',
        'visto_bueno' => 'boolean',
        'rechazada' => 'boolean',
        'editable' => 'boolean',
    ];

    public function empleado()
    {
        return $this->belongsTo(Empleado::class, 'empleado');
    }

    public function proyecto()
    {
        return $this->belongsTo(Proyecto::class);
    }

    public function evidencias()
    {
        return $this->hasMany(Evidencia::class, 'tarea');
    }

    public function observaciones()
    {
        return $this->hasMany(Observacion::class, 'id_tarea');
    }

    // Scope para tareas activas
    public function scopeActivas($query)
    {
        return $query->where('estado_reg', 'Activo');
    }

    // Scope para tareas de un proyecto
    public function scopeDeProyecto($query, $proyectoId)
    {
        return $query->where('proyecto_id', $proyectoId);
    }
}

// Uso en controller
public function cargarTareas($empleadoId)
{
    $tareas = Tarea::with(['evidencias', 'observaciones'])
        ->where('empleado', $empleadoId)
        ->activas()
        ->orderBy('fecha_pactada')
        ->get();

    return response()->json($tareas);
}
```

#### 6.1.4 Caché con Redis

```php
// config/database.php
'redis' => [
    'client' => env('REDIS_CLIENT', 'phpredis'),
    'default' => [
        'host' => env('REDIS_HOST', '127.0.0.1'),
        'password' => env('REDIS_PASSWORD', null),
        'port' => env('REDIS_PORT', 6379),
        'database' => 0,
    ],
],

// Uso en controllers
use Illuminate\Support\Facades\Cache;

public function cargarEmpleados()
{
    return Cache::remember('empleados_activos', 3600, function () {
        return Empleado::with(['departamento', 'cargo', 'empresa'])
            ->where('estado_registro', 'Activo')
            ->get();
    });
}

// Invalidar caché cuando se actualiza
public function guardarEmpleado(Request $request)
{
    $empleado = Empleado::create($request->validated());

    Cache::forget('empleados_activos');

    return response()->json(['success' => true]);
}
```

#### 6.1.5 Jobs para Tareas Pesadas

```php
// app/Jobs/EnviarNotificacionesMasivas.php
namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class EnviarNotificacionesMasivas implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $notificaciones;

    public function __construct($notificaciones)
    {
        $this->notificaciones = $notificaciones;
    }

    public function handle()
    {
        foreach ($this->notificaciones as $notif) {
            Mail::to($notif->email)->send(new NotificacionMailable($notif));
        }
    }
}

// Dispatch en controller
EnviarNotificacionesMasivas::dispatch($notificaciones);
```

---

### 6.2 Frontend Optimizations

#### 6.2.1 React Query para Caché

```bash
npm install @tanstack/react-query
```

```jsx
// App.jsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutos
            cacheTime: 10 * 60 * 1000, // 10 minutos
        },
    },
});

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Dashboard />
        </QueryClientProvider>
    );
}

// Uso en componentes
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const Dashboard = () => {
    const queryClient = useQueryClient();

    const { data: tareas, isLoading } = useQuery({
        queryKey: ['tareas', empleadoId],
        queryFn: () => axiosInstance.get(`/cargarTareas/${empleadoId}`).then(res => res.data)
    });

    const actualizarEstadoMutation = useMutation({
        mutationFn: ({ tareaId, estado }) =>
            axiosInstance.put(`/actualizarEstadoTarea/${tareaId}`, { estado }),
        onSuccess: () => {
            queryClient.invalidateQueries(['tareas']); // Recargar tareas
        }
    });

    return (
        // ...
    );
};
```

#### 6.2.2 Lazy Loading de Componentes

```jsx
import React, { lazy, Suspense } from 'react';

// Lazy loading
const Reportes = lazy(() => import('./components/Reportes'));
const Parameters = lazy(() => import('./components/Parameters'));
const ProjectsModule = lazy(() => import('./components/ProjectsModule'));

const App = () => {
    return (
        <Suspense fallback={<div className="loader">Cargando...</div>}>
            <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/reportes" element={<Reportes />} />
                <Route path="/parametros" element={<Parameters />} />
                <Route path="/proyectos" element={<ProjectsModule />} />
            </Routes>
        </Suspense>
    );
};
```

#### 6.2.3 Custom Hooks

```jsx
// hooks/useTareas.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../axiosConfig';

export const useTareas = (empleadoId) => {
    const queryClient = useQueryClient();

    const { data: tareas, isLoading } = useQuery({
        queryKey: ['tareas', empleadoId],
        queryFn: () => axiosInstance.get(`/cargarTareas/${empleadoId}`).then(res => res.data.tareas)
    });

    const crearTarea = useMutation({
        mutationFn: (nuevaTarea) => axiosInstance.post('/guardarTarea', nuevaTarea),
        onSuccess: () => queryClient.invalidateQueries(['tareas'])
    });

    const actualizarEstado = useMutation({
        mutationFn: ({ tareaId, estado }) =>
            axiosInstance.put(`/actualizarEstadoTarea/${tareaId}`, { estado }),
        onSuccess: () => queryClient.invalidateQueries(['tareas'])
    });

    return {
        tareas,
        isLoading,
        crearTarea,
        actualizarEstado
    };
};

// Uso
const EmployeeInterface = ({ user }) => {
    const { tareas, isLoading, actualizarEstado } = useTareas(user.empleado);

    if (isLoading) return <div>Cargando...</div>;

    return (
        // ...
    );
};
```

---

## 7. PLAN DE MIGRACIÓN Y ROLLOUT

### 7.1 Estrategia de Despliegue

**Enfoque: Despliegue Gradual por Módulo**

```
Fase 1: Preparación (Semana 1-2)
├─ Backup completo de BD
├─ Configurar entorno de staging
├─ Documentar estado actual
└─ Plan de rollback

Fase 2: Sistema de Proyectos (Semana 3-6)
├─ Deploy BD en staging
├─ Testing con usuarios piloto
├─ Ajustes y correcciones
├─ Deploy a producción
└─ Capacitación de usuarios

Fase 3: Dashboard Departamental (Semana 7-8)
├─ Deploy en staging
├─ Testing con líderes de área
├─ Deploy a producción
└─ Monitoreo de métricas

Fase 4: Timetracking (Semana 9-10)
├─ Deploy en staging
├─ Piloto con un departamento
├─ Evaluación de adopción
└─ Deploy completo

Fase 5-N: Módulos Adicionales
└─ Repetir ciclo para cada módulo
```

### 7.2 Scripts de Migración

```sql
-- migration_001_proyectos.sql
START TRANSACTION;

-- Crear tablas de proyectos
SOURCE create_proyectos_tables.sql;

-- Agregar campos a tareas existentes
ALTER TABLE tareas_empleados
    ADD COLUMN proyecto_id INT NULL,
    ADD FOREIGN KEY (proyecto_id) REFERENCES proyectos(id);

-- Verificación
SELECT 'Migration completed' AS status;

COMMIT;
```

### 7.3 Plan de Rollback

```sql
-- rollback_001_proyectos.sql
START TRANSACTION;

-- Eliminar foreign key de tareas
ALTER TABLE tareas_empleados DROP FOREIGN KEY tareas_empleados_ibfk_proyecto;
ALTER TABLE tareas_empleados DROP COLUMN proyecto_id;

-- Eliminar tablas
DROP TABLE IF EXISTS proyecto_documentos;
DROP TABLE IF EXISTS proyecto_hitos;
DROP TABLE IF EXISTS proyecto_colaboradores;
DROP TABLE IF EXISTS proyectos;

COMMIT;
```

---

## 8. ESTIMACIONES Y RECURSOS

### 8.1 Tiempo Estimado por Módulo

| Módulo | Complejidad | Backend | Frontend | Testing | Total |
|--------|-------------|---------|----------|---------|-------|
| Sistema de Proyectos | Alta | 40h | 40h | 20h | 100h |
| Dashboard Departamental | Media | 24h | 32h | 16h | 72h |
| Timetracking | Media | 32h | 24h | 16h | 72h |
| Dependencias de Tareas | Media | 24h | 20h | 12h | 56h |
| Etiquetas y Plantillas | Baja | 16h | 16h | 8h | 40h |
| Calendario | Baja | 8h | 24h | 8h | 40h |
| Dashboard Ejecutivo | Media | 16h | 32h | 12h | 60h |
| Subtareas | Baja | 16h | 16h | 8h | 40h |
| Análisis Predictivo | Alta | 40h | 24h | 16h | 80h |
| Optimizaciones | Media | 32h | 32h | 16h | 80h |

**Total Estimado: 640 horas (16 semanas / 4 meses con 1 desarrollador full-time)**

### 8.2 Recursos Necesarios

**Equipo Mínimo:**
- 1 Desarrollador Full-Stack (Laravel + React)
- 1 DBA (para optimizaciones y migraciones)
- 1 QA Tester (medio tiempo)
- 1 Product Owner (coordinación con áreas)

**Infraestructura:**
- Servidor staging adicional
- Redis para caché
- Espacio adicional de almacenamiento (evidencias)
- Monitoreo (opcional: New Relic, Sentry)

**Presupuesto Estimado:**
- Desarrollo: $25,000 - $35,000 USD
- Infraestructura: $500 - $1,000 USD/mes
- Capacitación: $2,000 USD

### 8.3 Métricas de Éxito

**KPIs a Medir:**
1. **Adopción:** % de usuarios activos usando nuevas funcionalidades
2. **Eficiencia:** Reducción en tiempo de gestión de tareas
3. **Productividad:** Incremento en tareas completadas
4. **Satisfacción:** NPS de usuarios
5. **Técnicos:**
   - Tiempo de carga de páginas < 2s
   - Disponibilidad > 99.5%
   - Errores < 0.1%

---

## CONCLUSIÓN

Este plan de implementación proporciona una ruta clara para transformar Work-Board en un sistema robusto de gestión multi-área. Las mejoras propuestas permitirán:

✅ **Visibilidad completa** del trabajo por departamento
✅ **Gestión de proyectos** end-to-end
✅ **Control de tiempo** y costos
✅ **Análisis predictivo** para toma de decisiones
✅ **Escalabilidad** para crecimiento futuro

**Próximos Pasos:**
1. Revisión y aprobación del plan
2. Asignación de recursos
3. Configuración de entorno staging
4. Inicio de Sprint 1: Sistema de Proyectos

---

**FIN DEL DOCUMENTO**

Para consultas o aclaraciones sobre este plan de implementación, contactar al equipo de desarrollo.
