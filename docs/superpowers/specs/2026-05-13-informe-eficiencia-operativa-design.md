# Informe de Eficiencia Operativa — Diseño

## Objetivo

Agregar una nueva tarjeta de reporte en `Reportes.jsx` que abra un modal con el **Informe de Eficiencia Operativa**: ranking por empleado con la fórmula de eficiencia, análisis por departamento, alertas automáticas e impresión en tres vistas (general, por empleado, por área).

---

## Fórmula de Eficiencia

```
score = (Completadas/Total)*0.4 + (ATiempo/Total)*0.3 + (SinReprocesos/Total)*0.3
```

- **SinReprocesos** = `Total - reprocesos` (donde reproceso = tarea con `rechazada = 1`)
- **ATiempo** = tareas completadas con `fecha_entregada <= fecha_pactada`
- **Total** = todas las tareas activas del empleado en el período

Niveles:
- 🟢 **Alto** — score ≥ 0.75
- 🟡 **Medio** — score 0.50–0.74
- 🔴 **Crítico** — score < 0.50

---

## Arquitectura

```
Frontend (Reportes.jsx)
  └─ Tarjeta nueva "Eficiencia Operativa"
       └─ onClick → GET /api/informes/eficiencia?start_date=&end_date=
            └─ Modal con 4 secciones
                 ├─ KPIs globales
                 ├─ Ranking por empleado
                 ├─ Análisis por área (BarChart Recharts)
                 └─ Alertas e insights

Backend (EmpleadosController.php)
  └─ informeEficiencia(Request $request)
       └─ GROUP BY empleado → devuelve stats agregadas (sin evidencias/observaciones)
```

---

## Backend

### Endpoint

`GET /api/informes/eficiencia`

**Sin query params** — el endpoint devuelve todas las tareas activas. El filtro de fechas se aplica client-side sobre `fecha_pactada` (igual que el patrón existente en Reportes.jsx).

**Response:** array de tareas individuales:

```json
[
  {
    "id": 42,
    "estado": "Completada",
    "fecha_pactada": "2026-05-10",
    "fecha_entregada": "2026-05-09",
    "rechazada": 0,
    "nombre_empleado": "Juan Pérez",
    "cargo": "Desarrollador Senior",
    "departamento": "Tecnología"
  }
]
```

### Consulta SQL

```sql
SELECT
  te.*,
  CONCAT(e.nombres, ' ', e.apellidos) AS nombre_empleado,
  c.nombre AS cargo,
  d.nombre AS departamento
FROM tareas_empleados te
JOIN empleados e ON te.empleado = e.id
JOIN cargos c ON e.cargo = c.id
JOIN departamentos d ON e.departamento = d.id
WHERE te.estado_reg = 'Activo'
ORDER BY e.id
```

---

## Frontend

### Estado nuevo en Reportes.jsx

```js
const [datosEficiencia, setDatosEficiencia] = useState([]);
const [loadingEficiencia, setLoadingEficiencia] = useState(false);
```

### Función de agrupación y cálculo (client-side)

```js
const calcularEficienciaOperativa = () => {
  // Filtrar por rango de fechas (sobre fecha_pactada, igual que otros reportes)
  const filtradas = datosEficiencia.filter(t =>
    (!startDate || t.fecha_pactada >= startDate) &&
    (!endDate   || t.fecha_pactada <= endDate)
  );

  // Agrupar por empleado
  const porEmpleado = filtradas.reduce((acc, t) => {
    const key = t.nombre_empleado;
    if (!acc[key]) acc[key] = { nombre: t.nombre_empleado, cargo: t.cargo, departamento: t.departamento, total: 0, completadas: 0, aTiempo: 0, reprocesos: 0 };
    acc[key].total++;
    if (t.estado === 'Completada') acc[key].completadas++;
    if (t.estado === 'Completada' && t.fecha_entregada && t.fecha_entregada <= t.fecha_pactada) acc[key].aTiempo++;
    if (t.rechazada == 1) acc[key].reprocesos++;
    return acc;
  }, {});

  // Calcular score y nivel
  return Object.values(porEmpleado).map(emp => {
    const score = emp.total > 0
      ? (emp.completadas / emp.total) * 0.4
        + (emp.aTiempo / emp.total) * 0.3
        + ((emp.total - emp.reprocesos) / emp.total) * 0.3
      : 0;
    const nivel = score >= 0.75 ? '🟢 Alto' : score >= 0.50 ? '🟡 Medio' : '🔴 Crítico';
    return { ...emp, score: Math.round(score * 100) / 100, nivel };
  }).sort((a, b) => b.score - a.score);
};
```

### Tarjeta nueva (id: 7)

```jsx
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
  }
}
```

### Función de carga

```js
const consultarEficiencia = () => {
  setLoadingEficiencia(true);
  axiosInstance.get('/informes/eficiencia')
    .then(res => setDatosEficiencia(res.data))
    .finally(() => setLoadingEficiencia(false));
};
```

---

## Modal — 4 secciones

### Encabezado con acciones

```
Período: [startDate] — [endDate]
[Imprimir General] [Imprimir por Empleado] [Imprimir por Área] [Exportar Excel] [X]
```

### Sección 1: KPIs Globales

Muestra 4 tarjetas:
- 🟢 Empleados en nivel Alto (score ≥ 0.75)
- 🟡 Empleados en nivel Medio (0.50–0.74)
- 🔴 Empleados en nivel Crítico (< 0.50)
- Eficiencia promedio global (promedio de scores × 100 %)

### Sección 2: Ranking por Empleado

Tabla ordenada de mayor a menor score:

| # | Nombre | Cargo | Área | Nivel | Score | Completadas | A tiempo | Reprocesos |
|---|--------|-------|------|-------|-------|-------------|----------|------------|

El score se muestra como barra de progreso coloreada + valor numérico (0.00–1.00).

### Sección 3: Análisis por Área

Agrupa empleados por departamento, calcula score promedio.

- **BarChart** (Recharts): un bar por departamento, eje Y 0–1, color del bar determinado por el score promedio del área: `fill="#16a34a"` (verde, ≥0.75), `fill="#f97316"` (naranja, 0.50–0.74), `fill="#dc2626"` (rojo, <0.50)
- **Tabla resumen**: departamento, nº empleados, score promedio, nivel

### Sección 4: Alertas e Insights

Generadas automáticamente desde los datos calculados:

- ⚠ Lista de empleados en zona 🔴 (nombre + score)
- ⚠ Departamentos con score promedio < 0.60
- ✅ Departamento con mejor desempeño
- 📊 Porcentaje de tareas entregadas a tiempo en el período
- 📊 Índice de reprocesos global

---

## Impresión

Tres funciones, mismo patrón que `imprimirPDF()` existente (HTML con estilos inline → `window.open()` → `window.print()`):

### `imprimirEficienciaGeneral(empleados, deptos)`
Contenido: KPIs globales + tabla ranking completa + tabla resumen por área + sección alertas.

### `imprimirEficienciaPorEmpleado(empleados)`
Una sección por empleado con: nombre, cargo, área, nivel, score, desglose (total/completadas/a tiempo/reprocesos).

### `imprimirEficienciaPorArea(deptos)`
Una sección por departamento con: nombre área, score promedio, nivel, listado de empleados del área con sus scores individuales.

---

## Export Excel

Función `exportarEficienciaExcel(empleados, deptos)`:
- Hoja 1 **"Por Empleado"**: todas las columnas de la tabla ranking
- Hoja 2 **"Por Área"**: departamento, nº empleados, score promedio, nivel
- Usa la librería `xlsx` ya instalada (misma que los demás exports del módulo)

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `app/Http/Controllers/EmpleadosController.php` | Agregar método `informeEficiencia(Request $request)` |
| `routes/api.php` | Agregar `Route::get('/informes/eficiencia', ...)` |
| `resources/js/components/Reportes.jsx` | Nuevo estado, función de carga, función de cálculo, tarjeta id:7, modal completo con 4 secciones + 3 funciones de impresión + export Excel |
| `resources/css/app.css` | Clases: `.eficiencia-kpi`, `.eficiencia-ranking-table`, `.score-bar`, `.nivel-badge`, `.insight-card` |

---

## Criterios de aceptación

1. La tarjeta "Eficiencia Operativa" aparece en la lista de reportes
2. Al abrirla, llama a `/api/informes/eficiencia` con el rango de fechas activo
3. Los scores se calculan correctamente con la fórmula definida
4. La tabla de ranking se ordena de mayor a menor score
5. Los niveles 🟢🟡🔴 aparecen según los umbrales definidos
6. El BarChart por área renderiza correctamente con Recharts
7. Las 3 funciones de impresión abren ventana nueva con HTML bien formateado
8. La exportación Excel genera 2 hojas (Por Empleado, Por Área)
9. El build `npm run dev` compila sin errores
