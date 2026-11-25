# Documentación Técnica — TAHU (Tablero HU)

Este documento detalla la arquitectura, reglas de negocio, migraciones, rutas, servicios y componentes implementados en **TAHU**.

---

## 1. Arquitectura General

El proyecto sigue el patrón **Monolito Moderno (Laravel + Inertia.js + React)**:
- **Routing y Seguridad:** Laravel (`routes/web.php`, Policies en `app/Policies/`, Middleware `HandleInertiaRequests`).
- **Lógica de Negocio:** Encapsulada en **Actions** (`app/Actions/Task/`), **Models** (`app/Models/`), **Observers** (`app/Observers/`) y **Commands** (`app/Console/Commands/`).
- **Estado y UI en Frontend:** React 18 + Zustand (`resources/js/hooks/store/`) + Mantine UI v7 (`postcss-preset-mantine` configurado en `postcss.config.cjs`).

---

## 2. Reglas de Negocio — Módulo de Proyectos y Tareas

### 2.1 Roles e Identificación de Usuario
En `App\Http\Middleware\HandleInertiaRequests::share()`, cada respuesta Inertia expone en `auth.user`:
- `is_admin`: `bool` (`$user->isAdmin()`)
- `is_super_admin`: `bool` (`$user->isSuperAdmin()`)
- `roles`: colección de nombres de roles Spatie (`superadmin`, `admin`, `manager`, `developer`, `qa engineer`, `designer`).
- `permissions`: lista de permisos activos del usuario.

En frontend, el privilegio administrativo se evalúa como:
```js
const isAdmin = Boolean(user?.is_admin || user?.is_super_admin);
```

### 2.2 Reglas de Seguridad por Campo (Backend + Frontend)
Todas las restricciones están duplicadas por seguridad: la UI bloquea los controles y `TaskController::update()`, `TaskController::move()` y `AttachmentController::store()` rechazan con `HTTP 403` cualquier petición que viole estas reglas.

1. **Creación de Actividades (`CreateTask` / `CreateTaskDrawer`):**
   - Solo visible para administradores (`Header.jsx`, `TaskGroup.jsx`, `TaskCard.jsx`, `TaskRow.jsx`).
   - `start_on` (Fecha de inicio) se establece **automáticamente** con `now()->toDateString()` en `CreateTask::create()`, ignorando manipulaciones del cliente.
   - `assigned_user_ids` acepta un array de IDs de usuarios, los sincroniza en `task_assignees`, guarda el primero en `tasks.assigned_to_user_id` por retrocompatibilidad y notifica con `TaskAssignedNotification` a todos los asignados (excepto al creador).
   - `due_on` (Fecha de finalización) solo se guarda si el creador es admin o figura dentro de `assigned_user_ids`.

2. **Edición de Nombre y Descripción (`Task::canEditNameAndDescription`):**
   - Una vez creada la actividad, únicamente el **admin/superadmin que la creó** (`created_by_user_id === user.id`) puede editar `name` y `description`.
   - En frontend:
     - `EditTaskDrawer.jsx` coloca `TextInput` en `readOnly + disabled` y `RichTextEditor` en `readOnly`.
     - `RichTextEditor.jsx` sincroniza dinámicamente `editor.setEditable(!readOnly)` mediante `useEffect` y oculta `<Editor.Toolbar>` en modo lectura.
     - `EditableTaskName.jsx` oculta el botón de edición inline (lápiz) en la vista Lista.

3. **Fecha de Inicio (`start_on`):**
   - Inmutable tras la creación (`HTTP 403` en `TaskController::update()` si se intenta modificar).

4. **Fecha de Finalización (`due_on`):**
   - Habilitada para **quien deba cumplir la tarea** (`Task::isAssignedTo(User $user)` verifica `assigned_to_user_id` y la tabla pivote `task_assignees`) y para administradores.
   - Aplicado en `EditTaskDrawer.jsx`, `TaskDueDateDropdown.jsx` y `TaskController::update()`.

5. **Estado, Tipo, Prioridad, Etiquetas e Integrantes:**
   - Campos `group_id`, `issue_type`, `priority_id`, `labels`, `assigned_user_ids`, `assigned_to_user_id` y `subscribed_users` están **restringidos exclusivamente a Administradores**.
   - `TaskController::move()` también impide que un usuario no-admin arrastre tarjetas entre columnas de estado en el tablero Kanban.

6. **Fotos / Comprobantes (`AttachmentController` + `Dropzone`):**
   - Habilitado para Administradores y para cualquier usuario asignado a la tarea (`isAdmin || isAssignedTo`).
   - `config/filesystems.php` define el disco `external` con fallback automático: usa `/tablerohu/imagenes` si existe el directorio del servidor Linux, o `public_path('imagenes')` en desarrollo local.

7. **Comentarios / Discusión (`CommentController` + `Comments.jsx`):**
   - Habilitado para que el desarrollador comunique avances o cierre de la tarea al administrador.
   - `Comments.jsx` escucha cambios en `task?.id` (y recibe `key={task.id}` desde `EditTaskDrawer.jsx`) para recargar los comentarios correctamente al cambiar entre tareas.

---

## 3. Reglas de Negocio — Módulo de Tareas Personales y Google Calendar

### 3.1 Campos de Base de Datos Agregados
- **`users.google_calendar_email`** (`string`, nullable): almacena el correo personal de Google vinculado una sola vez desde la pantalla de Tareas Personales.
- **`personal_tasks.reminder_minutes`** (`unsignedInteger`, nullable): ampliado desde `unsignedTinyInteger` para permitir anticipaciones de hasta varios días (`5, 15, 30, 60, 1440, 4320, 10080` minutos = hasta 7 días antes).
- **`personal_tasks.shared_emails`** (`text`/JSON, nullable): lista opcional de correos invitados cuando la actividad corresponde a una reunión o tarea compartida.

### 3.2 Enrutamiento de Correos (`User::routeNotificationForMail`)
Cuando se envía `PersonalTaskReminderNotification` a un `User`, Laravel redirige el correo automáticamente a `users.google_calendar_email` (si fue configurado), sin mezclar ni reenviar copias al correo institucional de inicio de sesión.

### 3.3 Generación de Eventos iCalendar (`.ics`) y Google Calendar
En `App\Models\PersonalTask`:
- `reminderReferenceTime()`: si la tarea tiene hora (`scheduled_time`), usa `fecha + hora`; si solo tiene fecha, toma las `09:00` de esa fecha para poder calcular recordatorios de 7 días antes.
- `buildIcsContent('REQUEST')`: construye un evento RFC 5545 con:
  - `ORGANIZER`: dirección SMTP configurada en `mail.from.address`.
  - `ATTENDEE`: correo de Google del dueño + todos los correos en `shared_emails`.
  - `VALARM`: dos alarmas automáticas (`-P7D` para 7 días antes y `-PT1H` para 1 hora antes).
- `googleCalendarUrl()`: genera el enlace `https://calendar.google.com/calendar/render?action=TEMPLATE&...` con título, fechas UTC, detalles y parámetro `add` para invitados.

### 3.4 Endpoints de Tareas Personales (`routes/web.php`)

| Método | Ruta | Nombre | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/personal-tasks` | `personal-tasks.index` | Agenda diaria, tareas vencidas, completadas, correo Google y usuarios disponibles |
| `POST` | `/personal-tasks` | `personal-tasks.store` | Crea la tarea personal y dispara invitación de calendario por correo |
| `PUT` | `/personal-tasks/{personalTask}` | `personal-tasks.update` | Edita la tarea y reenvía actualización de invitación |
| `PUT` | `/personal-tasks/google-email` | `personal-tasks.google-email` | Guarda una sola vez `users.google_calendar_email` |
| `POST` | `/personal-tasks/{personalTask}/send-reminder` | `personal-tasks.send-reminder` | Envía inmediatamente el recordatorio + `.ics` al correo vinculado e invitados |
| `GET` | `/personal-tasks/{personalTask}/ics` | `personal-tasks.ics` | Descarga el archivo `.ics` RFC 5545 de la tarea |

### 3.5 Automatización en Segundo Plano (`app/Console/Kernel.php`)
- `personal-task:send-reminders` corre cada minuto (`everyMinute()->withoutOverlapping()`).
- Busca tareas con `scopeReminderDue()` (no completadas, no notificadas, dentro de la ventana de tolerancia) y envía `PersonalTaskReminderNotification` al dueño y a todos los correos en `shared_emails`.

---

## 4. Migraciones Incorporadas

1. `database/migrations/2026_11_18_000000_add_google_calendar_and_extended_reminders.php`
   - Agrega `users.google_calendar_email`.
   - Amplía `personal_tasks.reminder_minutes` a `unsignedInteger`.
   - Agrega `personal_tasks.shared_emails`.
2. `database/migrations/2026_11_20_000000_create_task_assignees_table.php`
   - Crea tabla pivote `task_assignees (task_id, user_id)` con clave única compuesta.
   - Migra automáticamente cualquier asignación previa existente en `tasks.assigned_to_user_id`.

---

## 5. Buenas Prácticas y Seguridad del Repositorio

- `html/.gitignore` excluye archivos sensibles y artefactos pesados: `.env`, `.env.*`, `/vendor/`, `/node_modules/`, `/database/database.sqlite`, `/storage/logs/*.log`, `/public/hot`, `/public/storage`, `/public/imagenes/`.
- `html/config/mail.php` lee toda configuración SMTP exclusivamente desde variables de entorno (`env(...)`), sin credenciales en el código fuente.
- `html/postcss.config.cjs` configura `postcss-preset-mantine` y `postcss-simple-vars` para garantizar el compilado correcto de estilos Mantine (`light-dark()`, `rem()`, `@mixin hover`).
