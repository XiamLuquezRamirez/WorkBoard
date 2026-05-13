# Informe de Eficiencia Operativa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una nueva tarjeta "Eficiencia Operativa" en Reportes.jsx con modal completo: ranking por empleado con fórmula ponderada, análisis por departamento con gráfico, alertas automáticas e impresión en tres vistas (general, por empleado, por área) más exportación Excel.

**Architecture:** Nuevo endpoint Laravel `/api/informes/eficiencia` devuelve tareas crudas con `cargo` y `nombre_empleado`. El frontend carga la data una vez, filtra por `fecha_pactada` en el rango activo (`startDate`/`endDate`), agrupa por empleado y calcula el score `(completadas/total)*0.4 + (aTiempo/total)*0.3 + (sinReprocesos/total)*0.3`. El modal sigue el mismo patrón visual existente en Reportes.jsx.

**Tech Stack:** Laravel 8 (PHP), React 18 (JSX), Recharts (BarChart + Cell), xlsx/SheetJS (ya instalado), MySQL via Eloquent DB facade.

---

## File Structure

| Archivo | Cambio |
|---------|--------|
| `app/Http/Controllers/EmpleadosController.php` | Agregar método `informeEficiencia()` después de `informeTareas()` (línea ~1256) |
| `routes/web.php` | Agregar ruta después de la ruta `/informes/tareas` (línea ~148) |
| `resources/js/components/Reportes.jsx` | Agregar import `Cell`, estado, funciones de cálculo, tarjeta, modal, funciones de impresión |
| `resources/css/app.css` | Agregar clases `.eficiencia-*` al final del archivo (línea ~7691) |

---

## Task 1: Backend — Endpoint `/api/informes/eficiencia`

**Files:**
- Modify: `app/Http/Controllers/EmpleadosController.php` (insertar después de la función `informeTareas()`, línea 1256)
- Modify: `routes/web.php` (insertar después de la ruta `/informes/tareas`, línea 148)

- [ ] **Step 1: Agregar el método `informeEficiencia()` en el controller**

Busca el bloque `function informeTareas()` en `app/Http/Controllers/EmpleadosController.php`. Después de su llave de cierre (línea ~1256, después de `return response()->json($tareas);` y `}`), agrega:

```php
    function informeEficiencia()
    {
        $tareas = DB::connection('mysql2')->table('tareas_empleados')
            ->join('empleados', 'tareas_empleados.empleado', 'empleados.id')
            ->join('cargos', 'empleados.cargo', 'cargos.id')
            ->join('departamentos', 'empleados.departamento', 'departamentos.id')
            ->select(
                'tareas_empleados.id',
                'tareas_empleados.estado',
                'tareas_empleados.fecha_pactada',
                'tareas_empleados.fecha_entregada',
                'tareas_empleados.rechazada',
                DB::connection('mysql2')->raw('concat(empleados.nombres, " ", empleados.apellidos) as nombre_empleado'),
                'cargos.nombre as cargo',
                'departamentos.nombre as departamento'
            )
            ->where('tareas_empleados.estado_reg', 'Activo')
            ->orderBy('empleados.id')
            ->get();

        return response()->json($tareas);
    }
```

- [ ] **Step 2: Agregar la ruta en `routes/web.php`**

Busca la línea `Route::get('/informes/tareas', [empleadosController::class, 'informeTareas']);` y agrega inmediatamente debajo:

```php
        // informe de eficiencia operativa
        Route::get('/informes/eficiencia', [empleadosController::class, 'informeEficiencia']);
```

- [ ] **Step 3: Verificar el endpoint en el navegador**

Con XAMPP corriendo, abre una sesión autenticada en el sistema y en la consola del navegador ejecuta:

```js
fetch('/api/informes/eficiencia', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
  .then(r => r.json()).then(d => console.log(d.length, 'tareas', d[0]))
```

Resultado esperado: número > 0 y el primer objeto tiene campos `{ id, estado, fecha_pactada, fecha_entregada, rechazada, nombre_empleado, cargo, departamento }`.

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/EmpleadosController.php routes/web.php
git commit -m "feat: add informeEficiencia endpoint returning raw tasks with cargo"
```

---

## Task 2: Frontend — Estado, funciones de cálculo y tarjeta

**Files:**
- Modify: `resources/js/components/Reportes.jsx`

- [ ] **Step 1: Agregar import de `Cell` de Recharts**

Busca el bloque de imports de Recharts al inicio del archivo (líneas ~15-26):
```js
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    LineChart,
    Line,
    ResponsiveContainer,
} from "recharts";
```

Reemplázalo por:
```js
import {
    BarChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    LineChart,
    Line,
    ResponsiveContainer,
} from "recharts";
```

- [ ] **Step 2: Agregar variables de estado**

Busca la línea:
```js
    const [departamentos, setDepartamentos] = useState([]);
```

Agrega justo debajo:
```js
    const [datosEficiencia, setDatosEficiencia] = useState([]);
    const [loadingEficiencia, setLoadingEficiencia] = useState(false);
```

- [ ] **Step 3: Agregar función de carga `consultarEficiencia`**

Busca el bloque `const consultarTareas = () => {` y su llave de cierre `}`. Agrega inmediatamente después:

```js
    const consultarEficiencia = () => {
        setLoadingEficiencia(true);
        axiosInstance.get('/informes/eficiencia')
            .then(res => setDatosEficiencia(res.data))
            .catch(err => console.error('Error cargando eficiencia:', err))
            .finally(() => setLoadingEficiencia(false));
    };
```

- [ ] **Step 4: Agregar función `calcularEficienciaOperativa`**

Busca el bloque `const calcularInformeDepartamentos = () => {` y su `return` final (`}).sort(...)`). Agrega después de esa función:

```js
    const calcularEficienciaOperativa = () => {
        const filtradas = datosEficiencia.filter(t =>
            (!startDate || t.fecha_pactada >= startDate) &&
            (!endDate   || t.fecha_pactada <= endDate)
        );

        const porEmpleado = filtradas.reduce((acc, t) => {
            const key = t.nombre_empleado;
            if (!acc[key]) acc[key] = {
                nombre: t.nombre_empleado,
                cargo: t.cargo,
                departamento: t.departamento,
                total: 0, completadas: 0, aTiempo: 0, reprocesos: 0
            };
            acc[key].total++;
            if (t.estado === 'Completada') acc[key].completadas++;
            if (t.estado === 'Completada' && t.fecha_entregada && t.fecha_entregada <= t.fecha_pactada)
                acc[key].aTiempo++;
            if (t.rechazada == 1) acc[key].reprocesos++;
            return acc;
        }, {});

        return Object.values(porEmpleado).map(emp => {
            const score = emp.total > 0
                ? (emp.completadas / emp.total) * 0.4
                  + (emp.aTiempo / emp.total) * 0.3
                  + ((emp.total - emp.reprocesos) / emp.total) * 0.3
                : 0;
            const scoreRound = Math.round(score * 100) / 100;
            const nivel = scoreRound >= 0.75 ? '🟢 Alto' : scoreRound >= 0.50 ? '🟡 Medio' : '🔴 Crítico';
            return { ...emp, score: scoreRound, nivel };
        }).sort((a, b) => b.score - a.score);
    };

    const calcularDeptEficiencia = (empleados) => {
        const porDept = empleados.reduce((acc, emp) => {
            const d = emp.departamento || 'Sin área';
            if (!acc[d]) acc[d] = { departamento: d, count: 0, sumaScore: 0, empleadosList: [] };
            acc[d].count++;
            acc[d].sumaScore += emp.score;
            acc[d].empleadosList.push(emp);
            return acc;
        }, {});
        return Object.values(porDept).map(d => {
            const avg = Math.round((d.sumaScore / d.count) * 100) / 100;
            return {
                ...d,
                scorePromedio: avg,
                nivel: avg >= 0.75 ? '🟢 Alto' : avg >= 0.50 ? '🟡 Medio' : '🔴 Crítico'
            };
        }).sort((a, b) => b.scorePromedio - a.scorePromedio);
    };
```

- [ ] **Step 5: Agregar la tarjeta id:7 en el array `reportCards`**

Busca la línea `];` que cierra el array `reportCards` (después de la última tarjeta con `abrirModalInformeTareasPorEmpleado()`). Inserta justo antes de ese `];`:

```js
        {
            id: 7,
            title: "Eficiencia Operativa",
            icon: <FaChartArea size={25} />,
            description: "Ranking de eficiencia por empleado y área",
            color: "#1d4ed8",
            onClick: () => {
                setSelectedReport("eficiencia");
                setShowReportModal(true);
                consultarEficiencia();
            },
        },
```

- [ ] **Step 6: Verificar en el navegador**

Corre `npm run dev` para compilar y abre Reportes en el navegador. Verifica que:
- La nueva tarjeta "Eficiencia Operativa" aparece en la lista de tarjetas.
- Al hacer clic, la consola del navegador no muestra errores.
- En Network aparece la petición a `/api/informes/eficiencia` con status 200.

- [ ] **Step 7: Commit**

```bash
git add resources/js/components/Reportes.jsx
git commit -m "feat: add efficiency state, calc functions, and report card"
```

---

## Task 3: Modal — 4 secciones (KPIs, ranking, departamentos, alertas)

**Files:**
- Modify: `resources/js/components/Reportes.jsx`

- [ ] **Step 1: Insertar el bloque del modal**

Busca la línea `        </>` que cierra el return del componente (penúltima línea del `return`, antes de `};`). Inserta el siguiente bloque **justo antes** de esa línea `</>`:

```jsx
            {showReportModal && selectedReport === "eficiencia" && (() => {
                const empleados = calcularEficienciaOperativa();
                const deptos = calcularDeptEficiencia(empleados);
                const alto = empleados.filter(e => e.score >= 0.75).length;
                const medio = empleados.filter(e => e.score >= 0.50 && e.score < 0.75).length;
                const critico = empleados.filter(e => e.score < 0.50).length;
                const promedioGlobal = empleados.length > 0
                    ? Math.round((empleados.reduce((s, e) => s + e.score, 0) / empleados.length) * 100)
                    : 0;
                const pctATiempo = empleados.reduce((s, e) => s + e.total, 0) > 0
                    ? Math.round(empleados.reduce((s, e) => s + e.aTiempo, 0) /
                                 empleados.reduce((s, e) => s + e.total, 0) * 100)
                    : 0;
                const pctReprocesos = empleados.reduce((s, e) => s + e.total, 0) > 0
                    ? Math.round(empleados.reduce((s, e) => s + e.reprocesos, 0) /
                                 empleados.reduce((s, e) => s + e.total, 0) * 100)
                    : 0;

                return (
                    <div className="modal-overlay">
                        <div className="modal-report">
                            <div className="modal-header">
                                <h2>Informe de Eficiencia Operativa</h2>
                                <div className="header-actions">
                                    <button className="eficiencia-print-btn" onClick={() => imprimirEficienciaGeneral(empleados, deptos)}>
                                        <FaPrint /> General
                                    </button>
                                    <button className="eficiencia-print-btn" onClick={() => imprimirEficienciaPorEmpleado(empleados)}>
                                        <FaPrint /> Por Empleado
                                    </button>
                                    <button className="eficiencia-print-btn" onClick={() => imprimirEficienciaPorArea(deptos)}>
                                        <FaPrint /> Por Área
                                    </button>
                                    <button className="excel-button" onClick={() => exportarEficienciaExcel(empleados, deptos)}>
                                        <FaChartBar /> Excel
                                    </button>
                                    <button className="close-button" onClick={() => setShowReportModal(false)}>
                                        <FaTimes />
                                    </button>
                                </div>
                            </div>

                            <div className="tab-content">
                                {/* Período */}
                                <p className="eficiencia-periodo">
                                    Período: <strong>{cambiarFormatoFecha(startDate)}</strong> — <strong>{cambiarFormatoFecha(endDate)}</strong>
                                    {loadingEficiencia && <span style={{ marginLeft: '1rem', color: '#6b7280' }}>Cargando...</span>}
                                </p>

                                {/* Sección 1: KPIs Globales */}
                                <div className="executive-kpis" style={{ marginBottom: '1.5rem' }}>
                                    <div className="exec-kpi exec-kpi--green">
                                        <span className="exec-kpi-number">{alto}</span>
                                        <span className="exec-kpi-label">🟢 Alto</span>
                                    </div>
                                    <div className="exec-kpi exec-kpi--orange">
                                        <span className="exec-kpi-number">{medio}</span>
                                        <span className="exec-kpi-label">🟡 Medio</span>
                                    </div>
                                    <div className="exec-kpi exec-kpi--red">
                                        <span className="exec-kpi-number">{critico}</span>
                                        <span className="exec-kpi-label">🔴 Crítico</span>
                                    </div>
                                    <div className="exec-kpi exec-kpi--blue">
                                        <span className="exec-kpi-number">{promedioGlobal}%</span>
                                        <span className="exec-kpi-label">Eficiencia promedio</span>
                                    </div>
                                    <div className="exec-kpi" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                        <span className="exec-kpi-number" style={{ color: '#16a34a' }}>{pctATiempo}%</span>
                                        <span className="exec-kpi-label">A tiempo</span>
                                    </div>
                                    <div className="exec-kpi" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                                        <span className="exec-kpi-number" style={{ color: '#dc2626' }}>{pctReprocesos}%</span>
                                        <span className="exec-kpi-label">Reprocesos</span>
                                    </div>
                                </div>

                                {/* Sección 2: Ranking por empleado */}
                                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#374151' }}>
                                    Ranking por Empleado
                                </h3>
                                <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                                    <table className="eficiencia-ranking-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Nombre</th>
                                                <th>Cargo</th>
                                                <th>Área</th>
                                                <th>Nivel</th>
                                                <th>Score</th>
                                                <th>Completadas</th>
                                                <th>A tiempo</th>
                                                <th>Reprocesos</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {empleados.map((emp, idx) => (
                                                <tr key={emp.nombre} className={emp.score < 0.50 ? 'eficiencia-row-critico' : ''}>
                                                    <td style={{ fontWeight: 700, color: '#6b7280' }}>{idx + 1}</td>
                                                    <td style={{ fontWeight: 600 }}>{emp.nombre}</td>
                                                    <td style={{ color: '#6b7280', fontSize: '0.85rem' }}>{emp.cargo}</td>
                                                    <td style={{ color: '#6b7280', fontSize: '0.85rem' }}>{emp.departamento}</td>
                                                    <td>
                                                        <span className={`eficiencia-nivel-badge ${emp.score >= 0.75 ? 'badge-alto' : emp.score >= 0.50 ? 'badge-medio' : 'badge-critico'}`}>
                                                            {emp.nivel}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="eficiencia-score-bar-wrap">
                                                            <div
                                                                className="eficiencia-score-bar"
                                                                style={{
                                                                    width: `${emp.score * 100}%`,
                                                                    background: emp.score >= 0.75 ? '#16a34a' : emp.score >= 0.50 ? '#f97316' : '#dc2626'
                                                                }}
                                                            />
                                                            <span className="eficiencia-score-num">{emp.score.toFixed(2)}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>{emp.completadas}/{emp.total}</td>
                                                    <td style={{ textAlign: 'center' }}>{emp.aTiempo}</td>
                                                    <td style={{ textAlign: 'center', color: emp.reprocesos > 0 ? '#dc2626' : '#16a34a' }}>
                                                        {emp.reprocesos}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Sección 3: Análisis por área */}
                                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#374151' }}>
                                    Análisis por Área
                                </h3>
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={deptos} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="departamento" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 12 }} />
                                        <YAxis domain={[0, 1]} tickFormatter={v => v.toFixed(1)} />
                                        <Tooltip formatter={(v) => v.toFixed(2)} />
                                        <Bar dataKey="scorePromedio" name="Score" radius={[4, 4, 0, 0]}>
                                            {deptos.map((d) => (
                                                <Cell
                                                    key={d.departamento}
                                                    fill={d.scorePromedio >= 0.75 ? '#16a34a' : d.scorePromedio >= 0.50 ? '#f97316' : '#dc2626'}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                                    <table className="eficiencia-ranking-table">
                                        <thead>
                                            <tr>
                                                <th>Área</th>
                                                <th>Empleados</th>
                                                <th>Score Promedio</th>
                                                <th>Nivel</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {deptos.map(d => (
                                                <tr key={d.departamento}>
                                                    <td style={{ fontWeight: 600 }}>{d.departamento}</td>
                                                    <td style={{ textAlign: 'center' }}>{d.count}</td>
                                                    <td>
                                                        <div className="eficiencia-score-bar-wrap">
                                                            <div
                                                                className="eficiencia-score-bar"
                                                                style={{
                                                                    width: `${d.scorePromedio * 100}%`,
                                                                    background: d.scorePromedio >= 0.75 ? '#16a34a' : d.scorePromedio >= 0.50 ? '#f97316' : '#dc2626'
                                                                }}
                                                            />
                                                            <span className="eficiencia-score-num">{d.scorePromedio.toFixed(2)}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`eficiencia-nivel-badge ${d.scorePromedio >= 0.75 ? 'badge-alto' : d.scorePromedio >= 0.50 ? 'badge-medio' : 'badge-critico'}`}>
                                                            {d.nivel}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Sección 4: Alertas e insights */}
                                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#374151' }}>
                                    Alertas e Insights
                                </h3>
                                <div className="eficiencia-insights">
                                    {critico > 0 && (
                                        <div className="insight-card insight-card--alert">
                                            <strong>⚠ {critico} empleado{critico > 1 ? 's' : ''} en zona crítica:</strong>{' '}
                                            {empleados.filter(e => e.score < 0.50).map(e => e.nombre).join(', ')}
                                        </div>
                                    )}
                                    {deptos.filter(d => d.scorePromedio < 0.60).map(d => (
                                        <div key={d.departamento} className="insight-card insight-card--alert">
                                            ⚠ Área <strong>{d.departamento}</strong> con score promedio {d.scorePromedio.toFixed(2)} — requiere atención
                                        </div>
                                    ))}
                                    {deptos.length > 0 && (
                                        <div className="insight-card insight-card--ok">
                                            ✅ Área con mejor desempeño: <strong>{deptos[0].departamento}</strong> (score {deptos[0].scorePromedio.toFixed(2)})
                                        </div>
                                    )}
                                    <div className="insight-card insight-card--info">
                                        📊 {pctATiempo}% de tareas entregadas a tiempo en el período
                                    </div>
                                    <div className="insight-card insight-card--info">
                                        📊 Índice de reprocesos global: {pctReprocesos}%
                                    </div>
                                    {critico === 0 && deptos.filter(d => d.scorePromedio < 0.60).length === 0 && (
                                        <div className="insight-card insight-card--ok">
                                            ✅ Todos los empleados y áreas están en niveles aceptables o superiores
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
```

- [ ] **Step 2: Verificar en el navegador**

Con `npm run dev` corrido, abre el modal "Eficiencia Operativa". Verifica:
- Las 6 KPI cards aparecen con valores calculados.
- La tabla de ranking aparece ordenada de mayor a menor score.
- El BarChart muestra una barra por departamento con el color correcto (verde/naranja/rojo).
- La tabla de áreas muestra departamentos con score y nivel.
- La sección de alertas muestra al menos el porcentaje a tiempo.

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/Reportes.jsx
git commit -m "feat: add efficiency report modal with KPIs, ranking, dept chart and alerts"
```

---

## Task 4: Funciones de impresión + exportación Excel

**Files:**
- Modify: `resources/js/components/Reportes.jsx`

- [ ] **Step 1: Agregar las 4 funciones de impresión/export**

Busca la función `const imprimirPDF = () => {` y su bloque de cierre `};`. Agrega inmediatamente después las siguientes 4 funciones:

```js
    const imprimirEficienciaGeneral = (empleados, deptos) => {
        const hoy = new Date().toLocaleDateString();
        let html = `<html><head><style>
            body{font-family:Arial,sans-serif;margin:20px;font-size:13px}
            h1{color:#1d4ed8;text-align:center}
            h2{color:#374151;margin-top:24px;font-size:15px}
            table{width:100%;border-collapse:collapse;margin-top:8px}
            th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left}
            th{background:#f3f4f6;font-weight:600}
            .kpis{display:flex;gap:12px;margin:12px 0;flex-wrap:wrap}
            .kpi{border:1px solid #e5e7eb;border-radius:6px;padding:8px 14px;min-width:100px}
            .kpi strong{display:block;font-size:20px}
            .alert{background:#fef2f2;border:1px solid #fecaca;padding:6px 10px;border-radius:4px;margin:4px 0}
            .ok{background:#f0fdf4;border:1px solid #bbf7d0;padding:6px 10px;border-radius:4px;margin:4px 0}
            .info{background:#eff6ff;border:1px solid #bfdbfe;padding:6px 10px;border-radius:4px;margin:4px 0}
        </style></head><body>
        <h1>Informe de Eficiencia Operativa</h1>
        <p style="text-align:center;color:#6b7280">Período: ${startDate} — ${endDate} | Generado: ${hoy}</p>`;

        const alto = empleados.filter(e => e.score >= 0.75).length;
        const medio = empleados.filter(e => e.score >= 0.50 && e.score < 0.75).length;
        const critico = empleados.filter(e => e.score < 0.50).length;
        const promedio = empleados.length > 0
            ? Math.round(empleados.reduce((s, e) => s + e.score, 0) / empleados.length * 100) : 0;

        html += `<h2>KPIs Globales</h2>
        <div class="kpis">
            <div class="kpi"><strong>${alto}</strong>🟢 Alto</div>
            <div class="kpi"><strong>${medio}</strong>🟡 Medio</div>
            <div class="kpi"><strong>${critico}</strong>🔴 Crítico</div>
            <div class="kpi"><strong>${promedio}%</strong>Promedio global</div>
        </div>
        <h2>Ranking por Empleado</h2>
        <table><thead><tr><th>#</th><th>Nombre</th><th>Cargo</th><th>Área</th><th>Nivel</th><th>Score</th><th>Completadas</th><th>A tiempo</th><th>Reprocesos</th></tr></thead><tbody>`;
        empleados.forEach((emp, i) => {
            html += `<tr><td>${i+1}</td><td>${emp.nombre}</td><td>${emp.cargo}</td><td>${emp.departamento}</td>
                <td>${emp.nivel}</td><td>${emp.score.toFixed(2)}</td>
                <td>${emp.completadas}/${emp.total}</td><td>${emp.aTiempo}</td><td>${emp.reprocesos}</td></tr>`;
        });
        html += `</tbody></table>
        <h2>Resumen por Área</h2>
        <table><thead><tr><th>Área</th><th>Empleados</th><th>Score Promedio</th><th>Nivel</th></tr></thead><tbody>`;
        deptos.forEach(d => {
            html += `<tr><td>${d.departamento}</td><td>${d.count}</td><td>${d.scorePromedio.toFixed(2)}</td><td>${d.nivel}</td></tr>`;
        });
        html += `</tbody></table><h2>Alertas</h2>`;
        if (critico > 0) html += `<p class="alert">⚠ ${critico} empleado(s) en zona crítica: ${empleados.filter(e=>e.score<0.50).map(e=>e.nombre).join(', ')}</p>`;
        deptos.filter(d=>d.scorePromedio<0.60).forEach(d => {
            html += `<p class="alert">⚠ Área ${d.departamento} con score ${d.scorePromedio.toFixed(2)}</p>`;
        });
        if (deptos.length > 0) html += `<p class="ok">✅ Mejor área: ${deptos[0].departamento} (${deptos[0].scorePromedio.toFixed(2)})</p>`;
        html += `</body></html>`;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        win.print();
    };

    const imprimirEficienciaPorEmpleado = (empleados) => {
        const hoy = new Date().toLocaleDateString();
        let html = `<html><head><style>
            body{font-family:Arial,sans-serif;margin:20px;font-size:13px}
            h1{color:#1d4ed8;text-align:center}
            .emp-block{border:1px solid #e5e7eb;border-radius:6px;padding:14px;margin-bottom:16px;page-break-inside:avoid}
            .emp-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
            .emp-name{font-size:15px;font-weight:700;color:#111827}
            .emp-meta{color:#6b7280;font-size:12px}
            .badge{padding:3px 8px;border-radius:99px;font-size:12px;font-weight:600}
            .badge-alto{background:#dcfce7;color:#15803d}
            .badge-medio{background:#ffedd5;color:#c2410c}
            .badge-critico{background:#fee2e2;color:#b91c1c}
            table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
            th,td{border:1px solid #e5e7eb;padding:4px 8px}
            th{background:#f9fafb}
        </style></head><body>
        <h1>Eficiencia Operativa — Por Empleado</h1>
        <p style="text-align:center;color:#6b7280">Período: ${startDate} — ${endDate} | Generado: ${hoy}</p>`;

        empleados.forEach((emp, i) => {
            const pctCompleto = emp.total > 0 ? Math.round(emp.completadas/emp.total*100) : 0;
            const badgeClass = emp.score >= 0.75 ? 'badge-alto' : emp.score >= 0.50 ? 'badge-medio' : 'badge-critico';
            html += `<div class="emp-block">
                <div class="emp-header">
                    <div>
                        <div class="emp-name">${i+1}. ${emp.nombre}</div>
                        <div class="emp-meta">${emp.cargo} · ${emp.departamento}</div>
                    </div>
                    <span class="badge ${badgeClass}">${emp.nivel} · Score ${emp.score.toFixed(2)}</span>
                </div>
                <table><thead><tr><th>Total tareas</th><th>Completadas</th><th>A tiempo</th><th>Reprocesos</th><th>% Completado</th></tr></thead>
                <tbody><tr><td>${emp.total}</td><td>${emp.completadas}</td><td>${emp.aTiempo}</td><td>${emp.reprocesos}</td><td>${pctCompleto}%</td></tr></tbody>
                </table>
            </div>`;
        });

        html += `</body></html>`;
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        win.print();
    };

    const imprimirEficienciaPorArea = (deptos) => {
        const hoy = new Date().toLocaleDateString();
        let html = `<html><head><style>
            body{font-family:Arial,sans-serif;margin:20px;font-size:13px}
            h1{color:#1d4ed8;text-align:center}
            .area-block{border:1px solid #e5e7eb;border-radius:6px;padding:14px;margin-bottom:20px;page-break-inside:avoid}
            .area-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
            .area-name{font-size:16px;font-weight:700;color:#111827}
            .badge{padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600}
            .badge-alto{background:#dcfce7;color:#15803d}
            .badge-medio{background:#ffedd5;color:#c2410c}
            .badge-critico{background:#fee2e2;color:#b91c1c}
            table{width:100%;border-collapse:collapse;font-size:12px}
            th,td{border:1px solid #e5e7eb;padding:4px 8px}
            th{background:#f9fafb}
        </style></head><body>
        <h1>Eficiencia Operativa — Por Área</h1>
        <p style="text-align:center;color:#6b7280">Período: ${startDate} — ${endDate} | Generado: ${hoy}</p>`;

        deptos.forEach(dept => {
            const badgeClass = dept.scorePromedio >= 0.75 ? 'badge-alto' : dept.scorePromedio >= 0.50 ? 'badge-medio' : 'badge-critico';
            html += `<div class="area-block">
                <div class="area-header">
                    <div class="area-name">${dept.departamento} (${dept.count} empleados)</div>
                    <span class="badge ${badgeClass}">${dept.nivel} · Score ${dept.scorePromedio.toFixed(2)}</span>
                </div>
                <table><thead><tr><th>#</th><th>Empleado</th><th>Cargo</th><th>Nivel</th><th>Score</th><th>Completadas</th><th>A tiempo</th><th>Reprocesos</th></tr></thead>
                <tbody>`;
            dept.empleadosList.forEach((emp, i) => {
                const bc = emp.score >= 0.75 ? 'badge-alto' : emp.score >= 0.50 ? 'badge-medio' : 'badge-critico';
                html += `<tr><td>${i+1}</td><td>${emp.nombre}</td><td>${emp.cargo}</td>
                    <td><span class="badge ${bc}">${emp.nivel}</span></td>
                    <td>${emp.score.toFixed(2)}</td>
                    <td>${emp.completadas}/${emp.total}</td>
                    <td>${emp.aTiempo}</td><td>${emp.reprocesos}</td></tr>`;
            });
            html += `</tbody></table></div>`;
        });

        html += `</body></html>`;
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        win.print();
    };

    const exportarEficienciaExcel = (empleados, deptos) => {
        const wb = XLSX.utils.book_new();

        // Hoja 1: Por Empleado
        const wsEmpleados = XLSX.utils.json_to_sheet(empleados.map((emp, i) => ({
            '#': i + 1,
            'Nombre': emp.nombre,
            'Cargo': emp.cargo,
            'Área': emp.departamento,
            'Nivel': emp.nivel,
            'Score': emp.score,
            'Total tareas': emp.total,
            'Completadas': emp.completadas,
            'A tiempo': emp.aTiempo,
            'Reprocesos': emp.reprocesos,
            '% Completado': emp.total > 0 ? Math.round(emp.completadas/emp.total*100) + '%' : '0%'
        })));
        XLSX.utils.book_append_sheet(wb, wsEmpleados, 'Por Empleado');

        // Hoja 2: Por Área
        const wsAreas = XLSX.utils.json_to_sheet(deptos.map(d => ({
            'Área': d.departamento,
            'Empleados': d.count,
            'Score Promedio': d.scorePromedio,
            'Nivel': d.nivel
        })));
        XLSX.utils.book_append_sheet(wb, wsAreas, 'Por Área');

        XLSX.writeFile(wb, `eficiencia-operativa-${startDate}-${endDate}.xlsx`);
    };
```

- [ ] **Step 2: Verificar cada botón en el navegador**

Abre el modal "Eficiencia Operativa" y prueba:
1. **Imprimir General** → se abre ventana nueva con tabla de ranking completa + resumen por área + alertas → ventana de impresión aparece.
2. **Imprimir por Empleado** → ventana con una ficha por empleado (nombre, cargo, score, desglose).
3. **Imprimir por Área** → ventana con una sección por departamento con la lista de empleados del área.
4. **Excel** → se descarga el archivo `.xlsx` con 2 hojas ("Por Empleado" y "Por Área").

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/Reportes.jsx
git commit -m "feat: add print (general, by employee, by area) and Excel export for efficiency report"
```

---

## Task 5: CSS + build final

**Files:**
- Modify: `resources/css/app.css` (al final del archivo, después de `.excel-button:hover`)

- [ ] **Step 1: Agregar las clases CSS al final de `resources/css/app.css`**

Busca el final del archivo (las últimas líneas con `.excel-button:hover { background: #15803d; }`) y agrega a continuación:

```css
/* ===== INFORME DE EFICIENCIA OPERATIVA ===== */
.eficiencia-periodo {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0 0 1rem;
}

.eficiencia-ranking-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
}

.eficiencia-ranking-table th {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    padding: 0.5rem 0.75rem;
    font-weight: 600;
    color: #374151;
    text-align: left;
    white-space: nowrap;
}

.eficiencia-ranking-table td {
    border: 1px solid #e5e7eb;
    padding: 0.45rem 0.75rem;
    vertical-align: middle;
}

.eficiencia-row-critico {
    background: #fff5f5;
}

.eficiencia-nivel-badge {
    display: inline-block;
    padding: 0.2rem 0.55rem;
    border-radius: 99px;
    font-size: 0.78rem;
    font-weight: 600;
    white-space: nowrap;
}

.eficiencia-nivel-badge.badge-alto {
    background: #dcfce7;
    color: #15803d;
}

.eficiencia-nivel-badge.badge-medio {
    background: #ffedd5;
    color: #c2410c;
}

.eficiencia-nivel-badge.badge-critico {
    background: #fee2e2;
    color: #b91c1c;
}

.eficiencia-score-bar-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 120px;
}

.eficiencia-score-bar {
    height: 8px;
    border-radius: 4px;
    flex-shrink: 0;
    max-width: 80px;
    transition: width 0.3s;
}

.eficiencia-score-num {
    font-size: 0.82rem;
    font-weight: 600;
    color: #374151;
    white-space: nowrap;
}

.eficiencia-insights {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.insight-card {
    padding: 0.6rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
}

.insight-card--alert {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
}

.insight-card--ok {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #15803d;
}

.insight-card--info {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #1e40af;
}

.eficiencia-print-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.85rem;
    background: #1d4ed8;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}

.eficiencia-print-btn:hover {
    background: #1e40af;
}
```

- [ ] **Step 2: Compilar con npm run dev**

```bash
npm run dev
```

Resultado esperado: compilación exitosa sin errores. Si hay warning de módulo faltante, verifica que `Cell` esté importado de `recharts` en Reportes.jsx (Task 2, Step 1).

- [ ] **Step 3: Prueba final completa en el navegador**

1. Abre Reportes en el navegador.
2. Verifica que la tarjeta "Eficiencia Operativa" tiene el color azul (#1d4ed8).
3. Haz clic → modal abre sin errores.
4. KPIs muestran conteos 🟢🟡🔴.
5. Tabla de ranking ordenada de mayor a menor score, con barras de progreso de color correcto.
6. BarChart de áreas con barras coloreadas según nivel.
7. Alertas muestran al menos las 2 métricas de porcentaje.
8. Los 3 botones de impresión abren la ventana de impresión del navegador con el formato correcto.
9. Excel descarga un archivo con 2 hojas.

- [ ] **Step 4: Commit final**

```bash
git add resources/css/app.css
git commit -m "feat: add efficiency report CSS styles and verify full build"
```
