# Dashboard y Reportes — Plan de Mejoras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar el Dashboard administrativo y el módulo de Reportes con: panel de KPIs globales, filtro por departamento, tarjetas de empleados rediseñadas, nuevo informe ejecutivo, informe por departamento y exportación a Excel.

**Architecture:** El Dashboard recibe un bloque `<DashboardStats>` en la parte superior con métricas globales calculadas del array `empleados` ya existente, más un selector de departamento que filtra `filteredEmpleados`. En Reportes se agrega un informe ejecutivo y uno por departamento usando los mismos datos del endpoint `/informes/tareas` ya disponible; la exportación Excel usa la librería `xlsx` (SheetJS) sin backend nuevo.

**Tech Stack:** React 18, Recharts (ya instalado), xlsx / SheetJS (nueva dependencia), CSS modules inline con variables existentes de `app.css`, react-icons (ya instalado).

---

## Mapa de Archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `resources/js/components/Dashboard.jsx` | Modificar | Añadir `DashboardStats`, filtro departamento, rediseño tarjeta |
| `resources/js/components/Reportes.jsx` | Modificar | Informe ejecutivo, informe departamento, exportación Excel |
| `resources/css/app.css` | Modificar | Estilos nuevos: stats-panel, dept-filter, executive-report |

---

## Tarea 1: Panel de KPIs Globales en el Dashboard

**Archivos:**
- Modificar: `resources/js/components/Dashboard.jsx:558-700`

### Qué construir
Un bloque visual en la parte superior del dashboard que muestre 4 métricas calculadas desde el array `empleados` ya cargado:
- Total empleados activos
- Tareas activas (Pendiente + En Proceso) en todo el sistema
- Tareas atrasadas (fecha_pactada < hoy y estado != Completada)
- Eficiencia promedio del equipo

- [ ] **Paso 1: Agregar función de cálculo de stats globales en Dashboard.jsx**

Agregar esta función dentro del componente `Dashboard`, después de `calcularEficiencia` (línea ~655):

```jsx
const calcularStatsGlobales = (listaEmpleados) => {
    let tareasActivas = 0;
    let tareasAtrasadas = 0;
    let sumaEficiencia = 0;
    const hoy = new Date().toISOString().split('T')[0];

    listaEmpleados.forEach(emp => {
        const tareas = emp.tareas || [];
        tareasActivas += tareas.filter(t => t.estado === 'Pendiente' || t.estado === 'En Proceso').length;
        tareasAtrasadas += tareas.filter(t =>
            t.fecha_pactada && t.fecha_pactada < hoy &&
            t.estado !== 'Completada' && t.pausada !== 1
        ).length;
        sumaEficiencia += emp.rendimiento?.eficienciaOperativa || 0;
    });

    return {
        totalEmpleados: listaEmpleados.length,
        tareasActivas,
        tareasAtrasadas,
        eficienciaPromedio: listaEmpleados.length > 0
            ? Math.round(sumaEficiencia / listaEmpleados.length)
            : 0,
    };
};
```

- [ ] **Paso 2: Agregar el componente visual DashboardStats antes de las tarjetas**

Dentro de `renderContent()`, justo después de `<div className="dashboard-header">` (antes del `<div className="cards-grid">`), agregar:

```jsx
const stats = calcularStatsGlobales(filteredEmpleados);

// Bloque a insertar antes de cards-grid:
<div className="dashboard-stats-panel">
    <div className="stat-kpi">
        <span className="stat-kpi-number">{stats.totalEmpleados}</span>
        <span className="stat-kpi-label">Empleados activos</span>
    </div>
    <div className="stat-kpi">
        <span className="stat-kpi-number">{stats.tareasActivas}</span>
        <span className="stat-kpi-label">Tareas en curso</span>
    </div>
    <div className={`stat-kpi ${stats.tareasAtrasadas > 0 ? 'stat-kpi--alert' : ''}`}>
        <span className="stat-kpi-number">{stats.tareasAtrasadas}</span>
        <span className="stat-kpi-label">Tareas atrasadas</span>
    </div>
    <div className="stat-kpi">
        <span className="stat-kpi-number">{stats.eficienciaPromedio}%</span>
        <span className="stat-kpi-label">Eficiencia promedio</span>
    </div>
</div>
```

- [ ] **Paso 3: Agregar estilos del panel KPI en app.css**

Al final de `resources/css/app.css`, agregar:

```css
/* ===== DASHBOARD STATS PANEL ===== */
.dashboard-stats-panel {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.stat-kpi {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    transition: box-shadow 0.2s;
}

.stat-kpi:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.stat-kpi--alert {
    border-color: #f87171;
    background: #fff5f5;
}

.stat-kpi--alert .stat-kpi-number {
    color: #dc2626;
}

.stat-kpi-number {
    font-size: 2rem;
    font-weight: 700;
    color: #1e40af;
    line-height: 1;
}

.stat-kpi-label {
    font-size: 0.8rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: center;
}

@media (max-width: 768px) {
    .dashboard-stats-panel {
        grid-template-columns: repeat(2, 1fr);
    }
}
```

- [ ] **Paso 4: Verificar visualmente en el navegador**

Abrir `http://localhost/work-board/public/dashboard` e iniciar sesión como Administrador.
Confirmar que aparece el panel con 4 KPIs sobre las tarjetas de empleados.
Si `filteredEmpleados` está vacío al renderizar (antes de la carga), los valores mostrarán 0 — es correcto.

- [ ] **Paso 5: Commit**

```bash
git add resources/js/components/Dashboard.jsx resources/css/app.css
git commit -m "feat: add global KPI stats panel to admin dashboard"
```

---

## Tarea 2: Filtro por Departamento en el Dashboard

**Archivos:**
- Modificar: `resources/js/components/Dashboard.jsx:558-620` (estado y renderContent)

- [ ] **Paso 1: Agregar estado para filtro de departamento**

Dentro del componente `Dashboard`, en el bloque de `useState` (línea ~565), agregar:

```jsx
const [filterDepartamento, setFilterDepartamento] = useState('');
```

- [ ] **Paso 2: Calcular lista de departamentos únicos desde empleados**

Dentro de `renderContent()`, antes de `const filteredEmpleados`, agregar:

```jsx
const departamentosUnicos = [...new Set(empleados.map(e => e.departamento).filter(Boolean))].sort();
```

- [ ] **Paso 3: Actualizar filteredEmpleados para incluir filtro de departamento**

Reemplazar la definición actual de `filteredEmpleados` (línea ~805):

```jsx
// ANTES:
const filteredEmpleados = empleados.filter(
    (empleado) =>
        empleado.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        empleado.departamento.toLowerCase().includes(searchTerm.toLowerCase()) ||
        empleado.empresa.toLowerCase().includes(searchTerm.toLowerCase())
);

// DESPUÉS:
const filteredEmpleados = empleados.filter((empleado) => {
    const matchSearch =
        empleado.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        empleado.departamento.toLowerCase().includes(searchTerm.toLowerCase()) ||
        empleado.empresa.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = !filterDepartamento || empleado.departamento === filterDepartamento;
    return matchSearch && matchDept;
});
```

- [ ] **Paso 4: Agregar el selector de departamento en el dashboard-header**

Dentro de `renderContent()`, en `<div className="search-container">`, agregar el selector después del input de búsqueda:

```jsx
<div className="dept-filter-container">
    <select
        value={filterDepartamento}
        onChange={(e) => setFilterDepartamento(e.target.value)}
        className="dept-filter-select"
    >
        <option value="">Todos los departamentos</option>
        {departamentosUnicos.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
        ))}
    </select>
</div>
```

- [ ] **Paso 5: Agregar estilos del filtro en app.css**

```css
/* ===== FILTRO DEPARTAMENTO DASHBOARD ===== */
.dept-filter-container {
    margin-left: 0.75rem;
}

.dept-filter-select {
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    background: #fff;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
}

.dept-filter-select:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37,99,235,0.15);
}
```

- [ ] **Paso 6: Verificar en el navegador**

Confirmar que:
1. El selector de departamento aparece junto a la búsqueda
2. Seleccionar "Desarrollo" filtra y muestra solo empleados de ese departamento
3. El panel KPI de la Tarea 1 también se actualiza con los datos filtrados
4. Seleccionar "Todos" vuelve a mostrar todo

- [ ] **Paso 7: Commit**

```bash
git add resources/js/components/Dashboard.jsx resources/css/app.css
git commit -m "feat: add department filter to admin dashboard"
```

---

## Tarea 3: Indicador Visual de Tareas Atrasadas en Tarjeta de Empleado

**Archivos:**
- Modificar: `resources/js/components/Dashboard.jsx:848-985` (tarjeta de empleado)

- [ ] **Paso 1: Agregar función para contar tareas atrasadas de un empleado**

Dentro del componente `Dashboard`, después de `calcularEficiencia` (línea ~655):

```jsx
const contarTareasAtrasadas = (empleado) => {
    const hoy = new Date().toISOString().split('T')[0];
    return (empleado.tareas || []).filter(t =>
        t.fecha_pactada && t.fecha_pactada < hoy &&
        t.estado !== 'Completada' && t.pausada !== 1
    ).length;
};
```

- [ ] **Paso 2: Agregar badge de tareas atrasadas en la tarjeta del empleado**

Dentro del `renderContent()`, en el `.map((empleado) => ...)` de las tarjetas, agregar el badge después de `<div className="employee-main-info">`:

```jsx
{(() => {
    const atrasadas = contarTareasAtrasadas(empleado);
    return atrasadas > 0 ? (
        <div className="employee-card-alert-banner">
            <span className="alert-icon">⚠</span>
            <span>{atrasadas} tarea{atrasadas > 1 ? 's' : ''} atrasada{atrasadas > 1 ? 's' : ''}</span>
        </div>
    ) : null;
})()}
```

- [ ] **Paso 3: Agregar estilos del badge de alerta en app.css**

```css
/* ===== BADGE TAREAS ATRASADAS EN TARJETA ===== */
.employee-card-alert-banner {
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    padding: 0.35rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: #b91c1c;
    font-weight: 600;
    margin-bottom: 0.5rem;
}

.alert-icon {
    font-size: 0.85rem;
}
```

- [ ] **Paso 4: Verificar en el navegador**

Confirmar que las tarjetas de empleados con tareas cuya `fecha_pactada` ya venció muestran el banner rojo. Empleados al día no deben mostrar nada.

- [ ] **Paso 5: Commit**

```bash
git add resources/js/components/Dashboard.jsx resources/css/app.css
git commit -m "feat: show overdue task alert badge on employee dashboard cards"
```

---

## Tarea 4: Informe Ejecutivo en Reportes (resumen visual con gráficas)

**Archivos:**
- Modificar: `resources/js/components/Reportes.jsx:59-112` (reportCards y lógica)

El informe ejecutivo usa los datos de `tareas` ya cargados (endpoint `/informes/tareas`) y muestra:
- Totales globales (completadas, en proceso, pendientes, atrasadas)
- Gráfica de barras: tareas completadas por departamento
- Gráfica de línea: eficiencia por empleado (completadas a tiempo / total completadas)

- [ ] **Paso 1: Agregar la tarjeta del informe ejecutivo en reportCards**

En `Reportes.jsx`, en el array `reportCards` (línea ~59), agregar como primer elemento:

```jsx
{
    id: 0,
    title: "Informe Ejecutivo",
    icon: <FaChartLine size={25} />,
    description: "Resumen global y por departamento",
    color: "#0f766e",
    onClick: () => {
        setSelectedReport("ejecutivo");
        setShowReportModal(true);
        consultarTareas();
    },
},
```

- [ ] **Paso 2: Agregar lógica de datos del informe ejecutivo**

En `Reportes.jsx`, después de la función `consultarTareas` (línea ~246), agregar:

```jsx
const calcularInformeEjecutivo = () => {
    const hoy = new Date().toISOString().split('T')[0];

    const totalCompletadas = tareas.filter(t => t.estado === 'Completada').length;
    const totalEnProceso = tareas.filter(t => t.estado === 'En Proceso').length;
    const totalPendientes = tareas.filter(t => t.estado === 'Pendiente').length;
    const totalAtrasadas = tareas.filter(t =>
        t.fecha_pactada && t.fecha_pactada < hoy && t.estado !== 'Completada'
    ).length;

    // Completadas por departamento
    const porDept = tareas.reduce((acc, t) => {
        if (!t.departamento) return acc;
        if (!acc[t.departamento]) acc[t.departamento] = { departamento: t.departamento, completadas: 0, total: 0 };
        acc[t.departamento].total += 1;
        if (t.estado === 'Completada') acc[t.departamento].completadas += 1;
        return acc;
    }, {});

    const deptData = Object.values(porDept).map(d => ({
        ...d,
        porcentaje: d.total > 0 ? Math.round((d.completadas / d.total) * 100) : 0,
    }));

    // Eficiencia por empleado (completadas a tiempo / total completadas)
    const porEmpleado = tareas.reduce((acc, t) => {
        if (!t.empleado) return acc;
        if (!acc[t.empleado]) acc[t.empleado] = { empleado: t.empleado, completadasATiempo: 0, totalCompletadas: 0 };
        if (t.estado === 'Completada') {
            acc[t.empleado].totalCompletadas += 1;
            if (t.fecha_entregada && t.fecha_pactada && t.fecha_entregada <= t.fecha_pactada) {
                acc[t.empleado].completadasATiempo += 1;
            }
        }
        return acc;
    }, {});

    const eficienciaData = Object.values(porEmpleado).map(e => ({
        empleado: e.empleado,
        eficiencia: e.totalCompletadas > 0
            ? Math.round((e.completadasATiempo / e.totalCompletadas) * 100)
            : 0,
    })).sort((a, b) => b.eficiencia - a.eficiencia);

    return { totalCompletadas, totalEnProceso, totalPendientes, totalAtrasadas, deptData, eficienciaData };
};
```

- [ ] **Paso 3: Agregar el modal del informe ejecutivo en el JSX**

En `Reportes.jsx`, antes del cierre del `<>` final (línea ~1222), agregar:

```jsx
{showReportModal && selectedReport === "ejecutivo" && (() => {
    const { totalCompletadas, totalEnProceso, totalPendientes, totalAtrasadas, deptData, eficienciaData } = calcularInformeEjecutivo();
    return (
        <div className="modal-overlay">
            <div className="modal-report">
                <div className="modal-header">
                    <h2>Informe Ejecutivo</h2>
                    <button className="close-button" onClick={() => setShowReportModal(false)}>
                        <FaTimes />
                    </button>
                </div>
                <div className="tab-content">
                    <div className="executive-kpis">
                        <div className="exec-kpi exec-kpi--green">
                            <span className="exec-kpi-number">{totalCompletadas}</span>
                            <span className="exec-kpi-label">Completadas</span>
                        </div>
                        <div className="exec-kpi exec-kpi--blue">
                            <span className="exec-kpi-number">{totalEnProceso}</span>
                            <span className="exec-kpi-label">En Proceso</span>
                        </div>
                        <div className="exec-kpi exec-kpi--orange">
                            <span className="exec-kpi-number">{totalPendientes}</span>
                            <span className="exec-kpi-label">Pendientes</span>
                        </div>
                        <div className="exec-kpi exec-kpi--red">
                            <span className="exec-kpi-number">{totalAtrasadas}</span>
                            <span className="exec-kpi-label">Atrasadas</span>
                        </div>
                    </div>

                    <h3 style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', color: '#374151' }}>
                        Avance por Departamento
                    </h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={deptData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="departamento" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 12 }} />
                            <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                            <Tooltip formatter={(value) => `${value}%`} />
                            <Bar dataKey="porcentaje" fill="#0891b2" name="% Completado" radius={[4,4,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>

                    <h3 style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', color: '#374151' }}>
                        Eficiencia por Empleado (% entregado a tiempo)
                    </h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={eficienciaData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="empleado" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                            <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                            <Tooltip formatter={(value) => `${value}%`} />
                            <Bar dataKey="eficiencia" fill="#0f766e" name="Eficiencia" radius={[4,4,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
})()}
```

- [ ] **Paso 4: Agregar estilos del informe ejecutivo en app.css**

```css
/* ===== INFORME EJECUTIVO ===== */
.executive-kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
}

.exec-kpi {
    border-radius: 10px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
}

.exec-kpi--green  { background: #f0fdf4; border: 1px solid #86efac; }
.exec-kpi--blue   { background: #eff6ff; border: 1px solid #93c5fd; }
.exec-kpi--orange { background: #fff7ed; border: 1px solid #fdba74; }
.exec-kpi--red    { background: #fef2f2; border: 1px solid #fca5a5; }

.exec-kpi-number {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
}

.exec-kpi--green  .exec-kpi-number { color: #16a34a; }
.exec-kpi--blue   .exec-kpi-number { color: #2563eb; }
.exec-kpi--orange .exec-kpi-number { color: #ea580c; }
.exec-kpi--red    .exec-kpi-number { color: #dc2626; }

.exec-kpi-label {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #6b7280;
}

@media (max-width: 768px) {
    .executive-kpis {
        grid-template-columns: repeat(2, 1fr);
    }
}
```

- [ ] **Paso 5: Verificar en el navegador**

Abrir Reportes y hacer clic en "Informe Ejecutivo". Confirmar:
1. Los 4 KPIs muestran números (pueden ser 0 si no hay tareas en el período seleccionado por defecto)
2. Las dos gráficas de barras renderizan correctamente
3. El modal se cierra con el botón X

- [ ] **Paso 6: Commit**

```bash
git add resources/js/components/Reportes.jsx resources/css/app.css
git commit -m "feat: add executive report with department and efficiency charts"
```

---

## Tarea 5: Informe por Departamento (comparativa inter-departamental)

**Archivos:**
- Modificar: `resources/js/components/Reportes.jsx`

- [ ] **Paso 1: Agregar la tarjeta del informe por departamento en reportCards**

En `reportCards`, agregar después del informe ejecutivo (posición id: 0):

```jsx
{
    id: 6,
    title: "Informe por Departamento",
    icon: <FaChartBar size={25} />,
    description: "Comparativa entre áreas de la empresa",
    color: "#7c3aed",
    onClick: () => {
        setSelectedReport("departamentos");
        setShowReportModal(true);
        consultarTareas();
    },
},
```

- [ ] **Paso 2: Agregar función de datos por departamento**

En `Reportes.jsx`, después de `calcularInformeEjecutivo`, agregar:

```jsx
const calcularInformeDepartamentos = () => {
    const hoy = new Date().toISOString().split('T')[0];

    const porDept = tareas.reduce((acc, t) => {
        const dept = t.departamento || 'Sin departamento';
        if (!acc[dept]) {
            acc[dept] = {
                departamento: dept,
                total: 0, completadas: 0, enProceso: 0,
                pendientes: 0, atrasadas: 0,
                sumaEficiencia: 0, countEficiencia: 0,
            };
        }
        acc[dept].total += 1;
        if (t.estado === 'Completada') acc[dept].completadas += 1;
        if (t.estado === 'En Proceso') acc[dept].enProceso += 1;
        if (t.estado === 'Pendiente') acc[dept].pendientes += 1;
        if (t.fecha_pactada && t.fecha_pactada < hoy && t.estado !== 'Completada') {
            acc[dept].atrasadas += 1;
        }
        if (t.estado === 'Completada' && t.fecha_entregada && t.fecha_pactada) {
            acc[dept].countEficiencia += 1;
            if (t.fecha_entregada <= t.fecha_pactada) acc[dept].sumaEficiencia += 1;
        }
        return acc;
    }, {});

    return Object.values(porDept).map(d => ({
        ...d,
        porcentajeCompletado: d.total > 0 ? Math.round((d.completadas / d.total) * 100) : 0,
        eficiencia: d.countEficiencia > 0 ? Math.round((d.sumaEficiencia / d.countEficiencia) * 100) : 0,
    })).sort((a, b) => b.porcentajeCompletado - a.porcentajeCompletado);
};
```

- [ ] **Paso 3: Agregar el modal del informe por departamento**

En `Reportes.jsx`, antes del cierre del `<>`, agregar después del modal ejecutivo:

```jsx
{showReportModal && selectedReport === "departamentos" && (() => {
    const deptData = calcularInformeDepartamentos();
    return (
        <div className="modal-overlay">
            <div className="modal-report">
                <div className="modal-header">
                    <h2>Informe por Departamento</h2>
                    <button className="close-button" onClick={() => setShowReportModal(false)}>
                        <FaTimes />
                    </button>
                </div>
                <div className="tab-content">
                    <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#374151' }}>
                        Comparativa entre departamentos
                    </h3>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={deptData} margin={{ top: 5, right: 20, left: 0, bottom: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="departamento" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="completadas" fill="#16a34a" name="Completadas" radius={[3,3,0,0]} />
                            <Bar dataKey="enProceso" fill="#2563eb" name="En Proceso" radius={[3,3,0,0]} />
                            <Bar dataKey="pendientes" fill="#f97316" name="Pendientes" radius={[3,3,0,0]} />
                            <Bar dataKey="atrasadas" fill="#dc2626" name="Atrasadas" radius={[3,3,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>

                    <table className="table-productivity" style={{ marginTop: '1.5rem' }}>
                        <thead className="table-productivity-thead">
                            <tr>
                                <th>Departamento</th>
                                <th>Total</th>
                                <th>Completadas</th>
                                <th>En Proceso</th>
                                <th>Pendientes</th>
                                <th>Atrasadas</th>
                                <th>% Avance</th>
                                <th>Eficiencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {deptData.map((d, i) => (
                                <tr key={i}>
                                    <td>{d.departamento}</td>
                                    <td>{d.total}</td>
                                    <td style={{ color: '#16a34a', fontWeight: 600 }}>{d.completadas}</td>
                                    <td style={{ color: '#2563eb' }}>{d.enProceso}</td>
                                    <td style={{ color: '#f97316' }}>{d.pendientes}</td>
                                    <td style={{ color: d.atrasadas > 0 ? '#dc2626' : 'inherit', fontWeight: d.atrasadas > 0 ? 600 : 400 }}>
                                        {d.atrasadas}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ flex: 1, background: '#e5e7eb', borderRadius: 4, height: 8 }}>
                                                <div style={{ width: `${d.porcentajeCompletado}%`, background: '#0891b2', borderRadius: 4, height: 8 }} />
                                            </div>
                                            <span style={{ fontSize: '0.8rem', minWidth: 32 }}>{d.porcentajeCompletado}%</span>
                                        </div>
                                    </td>
                                    <td style={{ color: d.eficiencia >= 70 ? '#16a34a' : d.eficiencia >= 50 ? '#f97316' : '#dc2626', fontWeight: 600 }}>
                                        {d.eficiencia}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
})()}
```

- [ ] **Paso 4: Verificar en el navegador**

Abrir Reportes → "Informe por Departamento". Confirmar:
1. La gráfica de barras agrupadas muestra los 4 estados por departamento
2. La tabla muestra las métricas incluyendo la barra de progreso inline
3. La columna "Eficiencia" se colorea en verde/naranja/rojo según el valor

- [ ] **Paso 5: Commit**

```bash
git add resources/js/components/Reportes.jsx
git commit -m "feat: add department comparison report with grouped bar chart"
```

---

## Tarea 6: Exportación a Excel en el Informe de Tareas por Empleado

**Archivos:**
- Modificar: `resources/js/components/Reportes.jsx`
- Requiere: instalar `xlsx` (SheetJS)

- [ ] **Paso 1: Instalar la librería xlsx**

```bash
npm install xlsx
```

Salida esperada: `added 1 package` (o similar). Si hay error de permisos, usar `npm install xlsx --legacy-peer-deps`.

- [ ] **Paso 2: Importar xlsx en Reportes.jsx**

Al inicio de `Reportes.jsx`, después de los imports existentes (línea ~14), agregar:

```jsx
import * as XLSX from 'xlsx';
```

- [ ] **Paso 3: Agregar función exportarExcel**

En `Reportes.jsx`, después de `imprimirPDF` (línea ~449), agregar:

```jsx
const exportarExcel = () => {
    const tareasPorEmpleado = generarTareasPorEmpleado();
    const workbook = XLSX.utils.book_new();

    // Hoja de resumen
    const resumenData = generarResumenTareasPorEmpleado().map(item => ({
        'Empleado': item.empleado,
        'Total': item.total,
        'Completadas': item.completadas,
        'Pendientes': item.pendientes,
        'En Proceso': item.enProceso,
        'Atrasadas': item.atrasadas,
    }));
    const wsResumen = XLSX.utils.json_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(workbook, wsResumen, 'Resumen');

    // Hoja de detalle
    const detalleData = [];
    tareasPorEmpleado.forEach(empData => {
        empData.tareas.forEach(tarea => {
            detalleData.push({
                'Empleado': empData.empleado,
                'Departamento': tarea.departamento || 'N/A',
                'Título': tarea.titulo,
                'Estado': tarea.estado,
                'Prioridad': tarea.prioridad || 'N/A',
                'Fecha Pactada': cambiarFormatoFecha(tarea.fecha_pactada),
                'Fecha Entregada': cambiarFormatoFecha(tarea.fecha_entregada),
            });
        });
    });
    const wsDetalle = XLSX.utils.json_to_sheet(detalleData);
    XLSX.utils.book_append_sheet(workbook, wsDetalle, 'Detalle');

    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Tareas_Empleados_${fecha}.xlsx`);
};
```

- [ ] **Paso 4: Agregar botón "Exportar Excel" junto al botón "Imprimir PDF"**

En el modal `tareasPorEmpleado` (línea ~1022), dentro de `<div className="header-actions">`, agregar antes del botón de imprimir:

```jsx
<button className="excel-button" onClick={exportarExcel}>
    <FaChartBar /> Exportar Excel
</button>
```

- [ ] **Paso 5: Agregar estilo del botón Excel en app.css**

```css
/* ===== BOTÓN EXPORTAR EXCEL ===== */
.excel-button {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: #16a34a;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}

.excel-button:hover {
    background: #15803d;
}
```

- [ ] **Paso 6: Recompilar assets**

```bash
npm run dev
```

Esperar que compile sin errores. Si hay error de import, verificar que `node_modules/xlsx` exista.

- [ ] **Paso 7: Verificar en el navegador**

1. Ir a Reportes → "Informe de tareas por empleado"
2. Hacer clic en "Exportar Excel"
3. Confirmar que se descarga un archivo `.xlsx`
4. Abrir en Excel/LibreOffice y verificar que tiene 2 hojas: "Resumen" y "Detalle"

- [ ] **Paso 8: Commit**

```bash
git add resources/js/components/Reportes.jsx resources/css/app.css package.json package-lock.json
git commit -m "feat: add Excel export to employee tasks report using SheetJS"
```

---

## Tarea 7: Recompilar y Verificación Final

**Archivos:**
- Sin cambios de código

- [ ] **Paso 1: Compilar assets de producción**

```bash
npm run prod
```

Esperar que termine. Salida esperada: `Successfully compiled 2 files`.

- [ ] **Paso 2: Verificar el flujo completo en el navegador**

Recorrer cada mejora implementada como Administrador:

1. **Dashboard** → ver panel de 4 KPIs arriba de las tarjetas de empleados
2. **Dashboard** → usar el selector de departamento y confirmar que filtra y que los KPIs se actualizan
3. **Dashboard** → si hay empleados con tareas atrasadas, ver el banner rojo en sus tarjetas
4. **Reportes** → abrir "Informe Ejecutivo" y ver los 4 KPIs + 2 gráficas
5. **Reportes** → abrir "Informe por Departamento" y ver la tabla con barra de progreso inline
6. **Reportes** → abrir "Informe de tareas por empleado" y hacer clic en "Exportar Excel", verificar descarga

- [ ] **Paso 3: Commit final de los assets compilados**

```bash
git add public/js/app.js public/js/app.js.map public/css/app.css public/mix-manifest.json
git commit -m "build: recompile assets with dashboard and reports improvements"
```

---

## Auto-Revisión del Plan

### Cobertura de requisitos del análisis

| Requisito del análisis | Tarea que lo cubre |
|------------------------|-------------------|
| No hay vista por departamento | Tarea 2 (filtro departamento dashboard) |
| No hay dashboard ejecutivo | Tarea 4 (informe ejecutivo en reportes) |
| No hay benchmarking entre departamentos | Tarea 5 (informe por departamento) |
| No hay exportación a Excel | Tarea 6 (xlsx export) |
| Métricas de rendimiento poco visibles | Tarea 1 (panel KPIs globales) + Tarea 3 (badge atrasadas) |

### Fuera de alcance (diferido)

Los siguientes ítems del análisis están fuera del scope de este plan para mantenerlo enfocado y entregable:

- Comparativa temporal mes vs mes anterior → complejidad alta, requiere endpoint nuevo
- Vista de calendario → componente complejo independiente
- Reportes programados → requiere sistema de cron/backend
- Sistema de proyectos → plan separado ya en progreso

### Verificación de tipos y consistencia

- `calcularStatsGlobales` retorna `{ totalEmpleados, tareasActivas, tareasAtrasadas, eficienciaPromedio }` — usado exactamente con esos nombres en la Tarea 1
- `calcularInformeEjecutivo` retorna `{ totalCompletadas, totalEnProceso, totalPendientes, totalAtrasadas, deptData, eficienciaData }` — destructurado exactamente así en el modal de la Tarea 4
- `calcularInformeDepartamentos` retorna array con campos `{ departamento, total, completadas, enProceso, pendientes, atrasadas, porcentajeCompletado, eficiencia }` — todos usados en la tabla de la Tarea 5
- `exportarExcel` usa `generarTareasPorEmpleado()` y `generarResumenTareasPorEmpleado()` — ambas ya existen en `Reportes.jsx` líneas ~249 y ~306
- `cambiarFormatoFecha` ya existe en `Reportes.jsx` línea ~115 — usada en `exportarExcel` sin redefinir

### Escaneo de placeholders

Sin TBD, TODO, "implement later", ni "similar a tarea N" en ningún paso.
