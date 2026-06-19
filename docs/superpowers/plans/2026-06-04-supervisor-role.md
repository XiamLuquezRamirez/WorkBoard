# Perfil Supervisor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un tercer perfil `"Supervisor"` que accede al Tablero de seguimiento (cards + estadísticas) y Reportes, pero no puede crear/editar tareas ni acceder a Parámetros.

**Architecture:** Se agrega `"Supervisor"` como valor válido de `tipo_usuario` sin migración de BD. El acceso se controla con guards `["Administrador","Supervisor"].includes(tipo_usuario)` en Dashboard, Sidebar, Header y App. El botón "Nueva Tarea" se oculta para Supervisor mediante un prop `esSupervisor` pasado al componente `TasksModal`.

**Tech Stack:** React 17, Laravel 10, Sanctum, MySQL, Laravel Mix / Webpack

---

## Archivos que cambian

| Archivo | Qué cambia |
|---|---|
| `resources/js/components/UserModal.jsx` | Agregar 'Supervisor' al array de roles |
| `resources/js/components/Dashboard.jsx` | Guard línea 816; prop esSupervisor a TasksModal; ocultar botón Nueva Tarea |
| `resources/js/components/Sidebar.jsx` | Ocultar ítem Parámetros para Supervisor usando useUser() |
| `resources/js/components/Header.jsx` | Incluir Supervisor en rama admin de notificaciones |
| `resources/js/components/App.jsx` | Proteger ruta /parameters contra Supervisor |

---

## Task 1: Agregar "Supervisor" al dropdown de roles en UserModal

**Files:**
- Modify: `resources/js/components/UserModal.jsx:135`

- [ ] **Step 1: Editar el array de roles**

Cambiar línea 135 de `UserModal.jsx`:

```js
// Antes
const rolesAvtivos = ['Administrador', 'Empleado'];

// Después
const rolesAvtivos = ['Administrador', 'Supervisor', 'Empleado'];
```

- [ ] **Step 2: Verificar visualmente**

Abrir Gestión de Usuarios → Nuevo Usuario → confirmar que el select de "Tipo de usuario" muestra las tres opciones: Administrador, Supervisor, Empleado.

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/UserModal.jsx
git commit -m "feat: add Supervisor option to user role dropdown"
```

---

## Task 2: Permitir que Supervisor acceda al Tablero (Dashboard.jsx línea 816)

**Files:**
- Modify: `resources/js/components/Dashboard.jsx:816`

- [ ] **Step 1: Cambiar la condición de early return**

Línea 816 de `Dashboard.jsx`:

```jsx
// Antes
if (user.tipo_usuario !== "Administrador") {
    return (
        <div className="dashboard-container">
            <Header
                currentUser={user}
                showUserMenu={showUserMenu}
                setShowUserMenu={setShowUserMenu}
                setIsSidebarOpen={setIsSidebarOpen}
            />
            <EmployeeInterface user={user} />
        </div>
    );
}

// Después
if (!["Administrador", "Supervisor"].includes(user.tipo_usuario)) {
    return (
        <div className="dashboard-container">
            <Header
                currentUser={user}
                showUserMenu={showUserMenu}
                setShowUserMenu={setShowUserMenu}
                setIsSidebarOpen={setIsSidebarOpen}
            />
            <EmployeeInterface user={user} />
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/Dashboard.jsx
git commit -m "feat: allow Supervisor to access the tracking dashboard"
```

---

## Task 3: Ocultar botón "Nueva Tarea" para Supervisor en TasksModal

**Files:**
- Modify: `resources/js/components/Dashboard.jsx:145-165` (props de TasksModal) y `resources/js/components/Dashboard.jsx:225-229` (botón Nueva Tarea) y `resources/js/components/Dashboard.jsx:1645-1686` (uso de TasksModal)

- [ ] **Step 1: Agregar prop `esSupervisor` a la destructuración de props de TasksModal**

En la función `TasksModal` (alrededor de línea 145), agregar `esSupervisor` a los props:

```jsx
// Antes (línea ~145)
const TasksModal = ({
    employee,
    onClose,
    proyectos,
    mostrarFormTarea,
    setMostrarFormTarea,
    ...

// Después — agregar esSupervisor al final de la lista de props
const TasksModal = ({
    employee,
    onClose,
    proyectos,
    mostrarFormTarea,
    setMostrarFormTarea,
    nuevaTarea,
    setNuevaTarea,
    showChecklist,
    setShowChecklist,
    checklistTitulo,
    setChecklistTitulo,
    checklistsExistentes,
    selectedChecklistId,
    subtareasForm,
    setSubtareasForm,
    nuevaSubtareaTexto,
    setNuevaSubtareaTexto,
    nuevaSubtareaFecha,
    setNuevaSubtareaFecha,
    isSavingTarea,
    handleGuardarTareaDesdeBoard,
    loadChecklistsExistentes,
    handleCopyChecklist,
    setChecklistsExistentes,
    setSelectedChecklistId,
    selectedEstado,
    setSelectedEstado,
    tareasFiltradas,
    setTareasFiltradas,
    setSelectedTask,
    setShowTaskDetails,
    showTaskDetails,
    selectedTask,
    selectedEmployee,
    setSelectedEmployee,
    setEmpleados,
    getStatusClass,
    getStatusIcon,
    esSupervisor,   // <-- agregar aquí
}) => {
```

- [ ] **Step 2: Ocultar botón "Nueva Tarea" con la guardia**

Alrededor de línea 225:

```jsx
// Antes
{!mostrarFormTarea && (
    <button className="add-button" onClick={() => setMostrarFormTarea(true)}>
        <FaPlus /> Nueva Tarea
    </button>
)}

// Después
{!mostrarFormTarea && !esSupervisor && (
    <button className="add-button" onClick={() => setMostrarFormTarea(true)}>
        <FaPlus /> Nueva Tarea
    </button>
)}
```

- [ ] **Step 3: Pasar el prop al usar TasksModal (línea ~1645)**

En el bloque `{showTasksModal && selectedEmployee && (<TasksModal .../>)}` agregar la prop:

```jsx
<TasksModal
    employee={selectedEmployee}
    onClose={() => setShowTasksModal(false)}
    proyectos={proyectos}
    mostrarFormTarea={mostrarFormTarea}
    setMostrarFormTarea={setMostrarFormTarea}
    nuevaTarea={nuevaTarea}
    setNuevaTarea={setNuevaTarea}
    showChecklist={showChecklist}
    setShowChecklist={setShowChecklist}
    checklistTitulo={checklistTitulo}
    setChecklistTitulo={setChecklistTitulo}
    checklistsExistentes={checklistsExistentes}
    selectedChecklistId={selectedChecklistId}
    subtareasForm={subtareasForm}
    setSubtareasForm={setSubtareasForm}
    nuevaSubtareaTexto={nuevaSubtareaTexto}
    setNuevaSubtareaTexto={setNuevaSubtareaTexto}
    nuevaSubtareaFecha={nuevaSubtareaFecha}
    setNuevaSubtareaFecha={setNuevaSubtareaFecha}
    isSavingTarea={isSavingTarea}
    handleGuardarTareaDesdeBoard={handleGuardarTareaDesdeBoard}
    loadChecklistsExistentes={loadChecklistsExistentes}
    handleCopyChecklist={handleCopyChecklist}
    setChecklistsExistentes={setChecklistsExistentes}
    setSelectedChecklistId={setSelectedChecklistId}
    selectedEstado={selectedEstado}
    setSelectedEstado={setSelectedEstado}
    tareasFiltradas={tareasFiltradas}
    setTareasFiltradas={setTareasFiltradas}
    setSelectedTask={setSelectedTask}
    setShowTaskDetails={setShowTaskDetails}
    showTaskDetails={showTaskDetails}
    selectedTask={selectedTask}
    selectedEmployee={selectedEmployee}
    setSelectedEmployee={setSelectedEmployee}
    setEmpleados={setEmpleados}
    getStatusClass={getStatusClass}
    getStatusIcon={getStatusIcon}
    esSupervisor={user?.tipo_usuario === "Supervisor"}
/>
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/components/Dashboard.jsx
git commit -m "feat: hide Nueva Tarea button for Supervisor role"
```

---

## Task 4: Ocultar ítem Parámetros en Sidebar para Supervisor

**Files:**
- Modify: `resources/js/components/Sidebar.jsx`

- [ ] **Step 1: Reemplazar el contenido completo de Sidebar.jsx**

```jsx
import React from 'react';
import { FaHome, FaChartBar, FaCog } from 'react-icons/fa';
import { Link, useLocation } from 'react-router-dom';
import { useUser } from './UserContext';

const Sidebar = () => {
    const location = useLocation();
    const { user } = useUser();
    const esSupervisor = user?.tipo_usuario === "Supervisor";

    return (
        <nav className="sidebar">
            <Link
                to="/dashboard"
                className={`sidebar-icon ${location.pathname === '/dashboard' ? 'active' : ''}`}
            >
                <FaHome size={24} />
            </Link>

            <Link
                to="/reports"
                className={`sidebar-icon ${location.pathname === '/reports' ? 'active' : ''}`}
            >
                <FaChartBar size={24} />
            </Link>

            {!esSupervisor && (
                <Link
                    to="/parameters"
                    className={`sidebar-icon ${location.pathname === '/parameters' ? 'active' : ''}`}
                >
                    <FaCog size={24} />
                </Link>
            )}
        </nav>
    );
};

export default Sidebar;
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/Sidebar.jsx
git commit -m "feat: hide Parameters nav item for Supervisor"
```

---

## Task 5: Proteger ruta /parameters en App.jsx contra acceso directo de Supervisor

**Files:**
- Modify: `resources/js/components/App.jsx:33-37`

- [ ] **Step 1: Agregar guardia en la ruta /parameters**

```jsx
// Antes
<Route
    path="/parameters"
    element={user ? <Parameters /> : <Navigate to="/login" />}
/>

// Después
<Route
    path="/parameters"
    element={
        !user
            ? <Navigate to="/login" />
            : user.tipo_usuario === "Supervisor"
                ? <Navigate to="/dashboard" />
                : <Parameters />
    }
/>
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/App.jsx
git commit -m "feat: block /parameters route for Supervisor, redirect to dashboard"
```

---

## Task 6: Incluir Supervisor en rama admin de notificaciones (Header.jsx)

**Files:**
- Modify: `resources/js/components/Header.jsx:22-38`

- [ ] **Step 1: Actualizar ambas ramas de notificaciones**

```jsx
// Antes
useEffect(() => {
    if (!user) return;

    const intervalo = setInterval(() => {
        if (user.tipo_usuario === "Administrador") {
            cargarNotificaciones('admin');
        } else if (user.lider === "Si") {
            cargarNotificaciones('lider');
        } else {
            cargarNotificaciones('empleado');
        }
    }, 10000);

    if (user.tipo_usuario === "Administrador") {
        cargarNotificaciones('admin');
    } else if (user.lider === "Si") {
        cargarNotificaciones('lider');
    } else {
        cargarNotificaciones('empleado');
    }

    return () => clearInterval(intervalo);
}, [user]);

// Después
useEffect(() => {
    if (!user) return;

    const esAdmin = user.tipo_usuario === "Administrador" || user.tipo_usuario === "Supervisor";

    const intervalo = setInterval(() => {
        if (esAdmin) {
            cargarNotificaciones('admin');
        } else if (user.lider === "Si") {
            cargarNotificaciones('lider');
        } else {
            cargarNotificaciones('empleado');
        }
    }, 10000);

    if (esAdmin) {
        cargarNotificaciones('admin');
    } else if (user.lider === "Si") {
        cargarNotificaciones('lider');
    } else {
        cargarNotificaciones('empleado');
    }

    return () => clearInterval(intervalo);
}, [user]);
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/Header.jsx
git commit -m "feat: route Supervisor notifications through admin channel"
```

---

## Task 7: Compilar y verificar

- [ ] **Step 1: Compilar assets**

```bash
npm run dev
```

Resultado esperado: `webpack compiled successfully`

- [ ] **Step 2: Crear un usuario Supervisor de prueba**

En Gestión de Usuarios → Nuevo Usuario:
- Nombre: cualquiera
- Tipo de usuario: **Supervisor**
- Guardar

- [ ] **Step 3: Verificar acceso Supervisor**

Iniciar sesión con el usuario Supervisor:
- ✅ Redirige al Tablero (cards + estadísticas visibles)
- ✅ Sidebar muestra: Tablero + Reportes (sin Parámetros)
- ✅ Al abrir tareas de un empleado: NO aparece botón "Nueva Tarea"
- ✅ Navegar a `/#/parameters` → redirige a `/dashboard`
- ✅ Reportes accesibles

- [ ] **Step 4: Verificar que Admin sigue igual**

Iniciar sesión con un Administrador:
- ✅ Sidebar muestra: Tablero + Reportes + Parámetros
- ✅ Botón "Nueva Tarea" visible en tareas de empleado

- [ ] **Step 5: Commit final**

```bash
git add public/js/app.js public/js/app.js.map public/css/app.css public/mix-manifest.json
git commit -m "build: compile assets for Supervisor role feature"
```
