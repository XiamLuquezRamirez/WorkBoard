# Diseño: Perfil Supervisor

**Fecha:** 2026-06-04
**Estado:** Aprobado

## Resumen

Agregar un tercer perfil de usuario `"Supervisor"` al sistema WorkBoard. El Supervisor puede acceder al Tablero de seguimiento de empleados (cards + estadísticas) y a Reportes, pero no puede crear ni editar tareas, ni acceder a Parámetros.

## Modelo de datos

No se requiere migración. La columna `tipo_usuario` en `users` es un VARCHAR que ya acepta strings libremente.

| tipo_usuario | Tablero | Detalles de tarea | Crear/editar tareas | Reportes | Parámetros |
|---|---|---|---|---|---|
| Administrador | ✅ | ✅ | ✅ | ✅ | ✅ |
| Supervisor | ✅ | ✅ (solo lectura) | ❌ | ✅ | ❌ |
| Empleado | ❌ (EmployeeInterface) | ✅ propias | ❌ | ❌ | ❌ |

## Cambios por archivo

### 1. `resources/js/components/UserModal.jsx` — línea 135

```js
// Antes
const rolesAvtivos = ['Administrador', 'Empleado'];

// Después
const rolesAvtivos = ['Administrador', 'Supervisor', 'Empleado'];
```

### 2. `resources/js/components/Dashboard.jsx`

**Cambio A — línea ~816:** Condición que desvía a EmployeeInterface.

```js
// Antes
if (user.tipo_usuario !== "Administrador") { return <EmployeeInterface /> }

// Después
if (user.tipo_usuario === "Empleado" || !["Administrador", "Supervisor"].includes(user.tipo_usuario)) {
    return <EmployeeInterface />
}
```

**Cambio B — línea ~1152:** Condición que renderiza el layout del tablero.

```js
// Antes
if (currentUser.tipo_usuario === "Administrador") { ... }

// Después
if (["Administrador", "Supervisor"].includes(currentUser.tipo_usuario)) { ... }
```

**Cambio C — Botones de acción:** Ocultar "Nueva Tarea" y el botón de asignar tarea para Supervisor.

```jsx
// Guardia para acciones de escritura
{currentUser.tipo_usuario !== "Supervisor" && (
    <button ...>Nueva Tarea</button>
)}
```

Se aplica el mismo guardia `currentUser.tipo_usuario !== "Supervisor"` sobre:
- Botón "Nueva Tarea" en la card del empleado
- Botón de asignar tarea
- Formulario de nueva tarea (`mostrarFormTarea`)

### 3. `resources/js/components/Header.jsx` — lógica de notificaciones

```js
// Antes
if (user.tipo_usuario === "Administrador") {
    cargarNotificaciones('admin');
} else if (user.lider === "Si") { ... }

// Después
if (user.tipo_usuario === "Administrador" || user.tipo_usuario === "Supervisor") {
    cargarNotificaciones('admin');
} else if (user.lider === "Si") { ... }
```

### 4. `resources/js/components/Reportes.jsx`

Sin cambios — ya es accesible para cualquier usuario autenticado.

### 5. `resources/js/components/Parameters.jsx`

Sin cambios — el menú lateral del Supervisor no incluirá el ítem de Parámetros (se controla desde el sidebar en Dashboard.jsx).

## Sidebar del Supervisor

El Supervisor ve en el sidebar:
- Tablero (inicio)
- Reportes

No ve: Parámetros

## Flujo de creación de un Supervisor

1. Admin abre Gestión de Usuarios
2. Crea nuevo usuario, selecciona rol `"Supervisor"` en el dropdown
3. El usuario creado puede iniciar sesión y accede directamente al Tablero

## Archivos a compilar y subir

- `resources/js/components/UserModal.jsx`
- `resources/js/components/Dashboard.jsx`
- `resources/js/components/Header.jsx`
- `public/js/app.js` (compilado)
- `public/css/app.css` (compilado)
