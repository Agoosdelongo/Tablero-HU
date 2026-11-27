# Documentación Técnica y Operativa — TAHU (Tablero HU)

> **Propósito de este documento:** Que cualquier desarrollador o administrador de sistemas que tome este proyecto en el futuro entienda en pocos minutos **qué hace cada módulo, qué se modificó, por qué se tomó cada decisión y cómo desplegar o diagnosticar en producción sin romper nada**.

---

## 1. Visión general (en 2 minutos)

**TAHU** (*Tablero de Actividades del Hospital Universitario*) es un monolito moderno construido con:
- **Backend:** PHP 8.2+, Laravel 11, Laravel Sanctum, Spatie Laravel Permission (roles y permisos), OwenIt Auditing, Inertia Laravel.
- **Frontend:** React 18, Vite 5, Mantine UI v7, Zustand (stores globales), Day.js, Tabler Icons.
- **Base de datos:** MySQL 8 en producción (`https://siprohu.hospital.uncu.edu.ar`) y SQLite aislado para desarrollo local.

Las mejoras y correcciones documentadas aquí cubren **tres grandes bloques**:
1. **Proyectos y Tareas:** Jerarquía estricta de roles (**Admin / Superadmin** vs **Developer**), bloqueo total de clics/ediciones no permitidas (frontend + backend) y asignación múltiple de responsables (`task_assignees`).
2. **Tareas Personales:** Vinculación de correo personal de Google Calendar, recordatorios automáticos con hasta **7 días de anticipación**, adjuntos `.ics` estándar y reuniones compartidas con invitados.
3. **Estabilidad y Producción:** Compatibilidad con proxy inverso HTTPS, WebSockets seguros cuando `BROADCAST_DRIVER=log`, protección de base de datos MySQL, URLs sin doble barra, timeout SMTP y tolerancia a fallos en envíos masivos.

---

## 2. Módulo de Proyectos y Tareas (`admin` vs `developer`)

### 2.1 Cómo funciona el flujo de trabajo
1. **Asignación (solo Admin / Superadmin):**
   - El administrador crea la actividad desde `+ Agregar actividad` o `+` en una columna/tarea.
   - La **Fecha de inicio (`start_on`)** se completa **automáticamente** con la fecha del día (`now()->toDateString()`) y no puede modificarse después.
   - Puede asignar **una o varias personas** (`assigned_user_ids` → tabla pivote `task_assignees`). Por retrocompatibilidad con vistas heredadas, el primer asignado también se guarda en `tasks.assigned_to_user_id`.
   - Cada persona recién asignada recibe una notificación (`TaskAssignedNotification`).
2. **Ejecución (rol `developer` u otros roles no-admin):**
   - El desarrollador abre la tarea y **todos los campos administrativos están bloqueados sin siquiera responder al clic** (`disabled`, `readOnly`, `tabIndex={-1}`, `pointerEvents: 'none'`, sin desplegables, sin drag & drop, sin check de completar ni archivar).
   - Si está asignado a la tarea, **únicamente puede**:
     1. Cargar/modificar la **Fecha de finalización (`due_on`)**.
     2. Subir **Fotos o comprobantes** (`Dropzone` → `AttachmentController`).
     3. Escribir en **Comentarios / Discusión** (`Comments.jsx`).
3. **Protección de autoría (Nombre y Descripción):**
   - Una vez creada la tarea, únicamente el `admin` o `superadmin` que la creó (`created_by_user_id === user.id`) puede editar el **Nombre** y la **Descripción** (`Task::canEditNameAndDescription()`).

### 2.2 Matriz de permisos efectiva (UI + Backend `HTTP 403`)

| Acción / Campo | Admin / Superadmin | Developer (asignado) | Developer (no asignado) |
| :--- | :---: | :---: | :---: |
| Crear tareas / subtareas / columnas | ✅ | ❌ Oculto + `403` | ❌ Oculto + `403` |
| Editar **Nombre** y **Descripción** | ✅ Solo el creador | 🔒 Sin clic + `403` | 🔒 Sin clic + `403` |
| **Fecha de inicio (`start_on`)** | 🔒 Automática + `403` | 🔒 Automática + `403` | 🔒 Automática + `403` |
| **Fecha de finalización (`due_on`)** | ✅ | ✅ **Habilitado** | 🔒 Sin clic + `403` |
| **Foto / Comprobante (Adjuntos)** | ✅ | ✅ **Habilitado** | 🔒 Oculto + `403` |
| **Comentarios / Discusión** | ✅ | ✅ **Habilitado** | ✅ Solo lectura / comentarios |
| Estado, Tipo, Prioridad, Etiquetas | ✅ | 🔒 Sin clic + `403` | 🔒 Sin clic + `403` |
| Asignados y Suscriptores | ✅ | 🔒 Sin clic + `403` | 🔒 Sin clic + `403` |
| Drag & Drop (mover / reordenar) | ✅ | ❌ Deshabilitado + `403` | ❌ Deshabilitado + `403` |
| Completar / Archivar / Restaurar | ✅ | ❌ Deshabilitado + `403` | ❌ Deshabilitado + `403` |

### 2.3 Mapa de archivos del módulo (qué toca cada uno)

#### Backend (`html/app/`)
- **`Http/Middleware/HandleInertiaRequests.php`**: expone en todas las páginas Inertia `auth.user.is_admin`, `auth.user.is_super_admin`, `roles` y `permissions`.
- **`Models/User.php`**: define `isSuperAdmin()` (`hasRole('superadmin')`), `isAdmin()` (`hasRole('admin')`) e `isNotAdmin()`.
- **`Models/Task.php`**:
  - Relación `assignees()` (`belongsToMany` sobre `task_assignees`).
  - `canEditNameAndDescription(User $user)`: verifica que sea admin/superadmin y creador de la tarea.
  - `isAssignedTo(User $user)`: valida pertenencia en `assigned_to_user_id` o `task_assignees`.
- **`Actions/Task/CreateTask.php`**: fija `start_on` automáticamente, sincroniza `assignees` y dispara notificaciones.
- **`Actions/Task/UpdateTask.php`**: actualiza campos y sincroniza `assigned_user_ids` notificando solo a los nuevos agregados.
- **`Http/Controllers/TaskController.php`**: aplica doble blindaje en el servidor (`HTTP 403`) en `store`, `update`, `move`, `reorder`, `reparent`, `complete`, `destroy`, `restore` y `bulkArchive`.
- **`Http/Controllers/Task/AttachmentController.php`**: permite subir adjuntos únicamente a `admin`/`superadmin` o usuarios asignados a la tarea.

#### Frontend (`html/resources/js/`)
- **`components/RichTextEditor.jsx`**: editor TipTap con `readOnly` reactivo (`editor.setEditable(!readOnly)`), oculta la barra de herramientas y aplica `pointerEvents: 'none'` + `onMouseDown(preventDefault)` cuando es solo lectura.
- **`pages/Projects/Tasks/Drawers/EditTaskDrawer.jsx`**: panel lateral de detalle. Bloquea sin clic el check de completar, Nombre, Descripción, Estado, Tipo, Personas asignadas, Fecha de inicio, Etiquetas, Prioridad y Suscriptores para no-admin; mantiene habilitados Fecha de finalización, Fotos/comprobantes (si asignado) y Comentarios.
- **`pages/Projects/Tasks/Drawers/LabelsDropdown.jsx` y `PriorityDropdown.jsx`**: en modo `disabled` ocultan botones de quitar/desplegar y bloquean clics (`pointerEvents: 'none'`).
- **`pages/Projects/Tasks/Index/List/Components/TaskStatusDropdown.jsx` y `TaskPriorityDropdown.jsx`**: para no-admin renderizan etiquetas estáticas fijas en lugar de `<Select>` clicables.
- **`pages/Projects/Tasks/Index/List/Components/TaskDueDateDropdown.jsx`**: habilita el selector de fecha solo si `isAdmin || isAssignedTo`; si no, lo bloquea sin clic con tooltip informativo.
- **`pages/Projects/Tasks/Index/List/Components/TaskAssigneeDropdown.jsx`**: selector múltiple para admin; vista compacta de avatares de solo lectura para no-admin.
- **`pages/Projects/Tasks/Index/List/Components/EditableTaskName.jsx`**: muestra el ícono de edición rápida (lápiz) únicamente al admin creador.
- **`pages/Projects/Tasks/Index/List/TaskRow.jsx` y `HeaderRow.jsx`**: deshabilitan `useDraggable`, ocultan ícono de arrastre, checkboxes de selección masiva, botón `+` de subtarea y menú de archivar para no-admin.
- **`pages/Projects/Tasks/Index/Task/TaskCard.jsx`, `Task/TaskRow.jsx`, `TaskGroup.jsx` y `BoardView.jsx`**: deshabilitan `Draggable` (`isDragDisabled={!isAdmin}`), ocultan acciones de grupo/tarea, botón de crear columnas y bloquean el checkbox de completado para no-admin.

---

## 3. Módulo de Tareas Personales + Google Calendar + Recordatorios

### 3.1 Cómo funciona de punta a punta
```text
1. Usuario guarda su Gmail personal una sola vez (PUT /personal-tasks/google-email)
        │
        ▼
2. Crea o edita una Tarea Personal (POST/PUT /personal-tasks)
   ├── Si activó "Impactar en Google Calendar al guardar" → abre la plantilla web de Google Calendar
   └── Envía invitación por correo (SMTP) con archivo adjunto .ics (RFC 5545) al dueño e invitados
        │
        ▼
3. Cron del servidor ejecuta cada minuto: php artisan schedule:run
        │
        ▼
4. Comando personal-task:send-reminders (SendPersonalTaskReminders)
   ├── Reclama atómicamente cada tarea vencida para enviarla una sola vez (reminder_notified_at)
   ├── Notifica en campanita (database) + correo (mail) con .ics al dueño (google_calendar_email)
   └── Envía correo con .ics a cada invitado en shared_emails (aislado en try/catch individual)
```

> **Dato clave para futuros desarrolladores:** Este módulo **NO requiere credenciales OAuth (`GOOGLE_CLIENT_ID` / `GOOGLE_REDIRECT_URI`)**. Esas variables solo existen para el login opcional con Socialite en `routes/auth.php`. La sincronización de Tareas Personales funciona con **SMTP + invitación estándar `.ics` (`METHOD:REQUEST`) + URL directa de Google Calendar**.

### 3.2 Reglas internas destacadas
- **Anticipaciones permitidas (`PersonalTask::REMINDER_OPTIONS`):** `5, 15, 30, 60, 1440 (1 día), 4320 (3 días), 10080 (7 días)` minutos.
- **Tareas solo con fecha (sin horario):** `PersonalTask::reminderReferenceTime()` toma las **09:00 AM** (`America/Argentina/Buenos_Aires`) como referencia para calcular recordatorios con días de anticipación.
- **Enrutamiento de correos (`User::routeNotificationForMail`):** redirige automáticamente las notificaciones de tareas personales a `users.google_calendar_email` si está cargado, sin mezclar con el correo institucional de login.
- **Archivo `.ics` (`PersonalTask::buildIcsContent`):** genera un evento RFC 5545 con `UID` basado en el dominio real de `APP_URL` (`personal-task-{id}@siprohu.hospital.uncu.edu.ar`), `ORGANIZER` desde `MAIL_FROM_ADDRESS`, todos los `ATTENDEE` (dueño + `shared_emails`) y dos alarmas `VALARM` (`-P7D` y `-PT1H`).

### 3.3 Endpoints de Tareas Personales (`html/routes/web.php`)

| Método | Ruta | Nombre | Función |
| :--- | :--- | :--- | :--- |
| `GET` | `/personal-tasks` | `personal-tasks.index` | Lista agenda del día, vencidas, completadas y correo Google vinculado |
| `POST` | `/personal-tasks` | `personal-tasks.store` | Crea tarea y envía invitación `.ics` |
| `PUT` | `/personal-tasks/{personalTask}` | `personal-tasks.update` | Edita tarea y reenvía actualización `.ics` |
| `PUT` | `/personal-tasks/google-email` | `personal-tasks.google-email` | Guarda/desvincula `users.google_calendar_email` |
| `POST` | `/personal-tasks/{personalTask}/send-reminder` | `personal-tasks.send-reminder` | Envío manual inmediato de correo + `.ics` (avisa si SMTP falla) |
| `GET` | `/personal-tasks/{personalTask}/ics` | `personal-tasks.ics` | Descarga directa del archivo `.ics` |

---

## 4. Arreglos de Infraestructura y Producción (por qué se hizo cada uno)

| Problema detectado | Archivo modificado | Solución aplicada | Beneficio |
| :--- | :--- | :--- | :--- |
| Proxy inverso HTTPS no confiado por Laravel | `app/Http/Middleware/TrustProxies.php` | `protected $proxies = '*';` | Laravel reconoce `X-Forwarded-Proto/Host/For`, evitando fallos de `isSecure()`, cookies `Secure` y redirecciones HTTPS. |
| `window.Echo` fallaba o intentaba conectar sin Pusher | `resources/js/bootstrap.js` y `hooks/useWebSockets.js` | Solo instancia `Echo` si existe `VITE_PUSHER_APP_KEY`; si no, queda `null` y `useWebSockets` no opera. | Cero errores en consola y cero bloqueos *mixed content* cuando `BROADCAST_DRIVER=log`. |
| Posible cambio accidental a SQLite en producción | `config/database.php` | Solo usa SQLite si `APP_ENV !== 'production'` y existe `database.sqlite`. | En producción siempre respeta `DB_CONNECTION=mysql`. |
| URLs con doble barra (`//imagenes`) si `APP_URL` termina en `/` | `config/filesystems.php` | `rtrim((string) env('APP_URL'), '/')` en discos `invoices`, `public` y `external`. | Genera siempre URLs limpias y soporta fallback local (`public/imagenes`) vs servidor (`/tablerohu/imagenes`). |
| Peticiones web colgadas si SMTP no responde | `config/mail.php` | `'timeout' => (int) env('MAIL_TIMEOUT', 15)` | Con `QUEUE_CONNECTION=sync`, un SMTP bloqueado falla en 15s en lugar de colgar el trabajador PHP. |
| Un correo fallido cortaba todos los recordatorios | `app/Console/Commands/SendPersonalTaskReminders.php` | Bloques `try/catch` independientes por dueño y por invitado. | Un error puntual se loguea en `laravel.log` y el resto de usuarios siguen recibiendo sus avisos. |
| Falso positivo al fallar envío manual | `PersonalTaskController.php` (`sendReminder`) | Si `$sentTo` queda vacío, devuelve mensaje de error claro (`back()->error(...)`). | El usuario sabe inmediatamente si falló el correo en lugar de creer que se envió. |
| `UID` genérico en `.ics` | `app/Models/PersonalTask.php` | Usa `parse_url(config('app.url'), PHP_URL_HOST)` en el `UID`. | Mejor compatibilidad y entregabilidad en Gmail / Google Calendar. |

---

## 5. Migraciones de Base de Datos (100% aditivas)

> **Importante:** Las migraciones crean columnas/tablas **de forma permanente en MySQL**. No dependen de caché ni memoria temporal, y no borran ni alteran datos existentes.

1. **`2026_11_18_000000_add_google_calendar_and_extended_reminders.php`**
   - Agrega `users.google_calendar_email` (`string`, nullable).
   - Amplía `personal_tasks.reminder_minutes` a `unsignedInteger` (soporta recordatorios en días).
   - Agrega `personal_tasks.shared_emails` (`text`/JSON, nullable).
2. **`2026_11_20_000000_create_task_assignees_table.php`**
   - Crea la tabla pivote `task_assignees (id, task_id, user_id, created_at, updated_at)` con índice único `(task_id, user_id)`.
   - Copia automáticamente las asignaciones existentes desde `tasks.assigned_to_user_id` usando `insertOrIgnore`.

---

## 6. Guía Operativa de Producción (Runbook seguro)

### 6.1 Entorno del servidor
- **URL:** `https://siprohu.hospital.uncu.edu.ar`
- **Ruta del proyecto en el host Linux:** `/datos/tableroHU/html`
- **Contenedor Docker PHP/Apache:** `tablerohu-ap-1`
- **Remotos Git en `/datos/tableroHU/html`:**
  - `origin`: repositorio institucional (`developershu/tableroHU.git`, raíz directa de Laravel).
  - `mi-repo`: repositorio de desarrollo actualizado (`https://github.com/Agoosdelongo/Tablero-HU.git`, contiene la app dentro de la subcarpeta `html/`).

> **Por qué se usa `git archive mi-repo/main:html ... | tar -x`:** porque en `mi-repo` el proyecto vive en `html/` y en el servidor ya estamos parados dentro de `/datos/tableroHU/html`. Usar `git archive` extrae **solo los archivos de código** en su ruta exacta, sin crear un `html/html/` ni tocar `.env`, `storage/`, `public/imagenes/`, `vendor/` o `node_modules/`.

### 6.2 Procedimiento seguro de actualización (sin comandos destructivos)
```bash
cd /datos/tableroHU/html

# 1. Descargar últimos commits de mi-repo (no modifica archivos aún)
git fetch mi-repo main

# 2. Extraer únicamente código actualizado (no toca .env, storage ni imágenes)
git archive mi-repo/main:html app config/database.php config/filesystems.php config/mail.php database/migrations resources routes | tar -x

# 3. Compilar assets frontend (si da EACCES en public/build, ver sección 7)
npm run build

# 4. Verificar si hay migraciones nuevas (solo lectura)
docker exec tablerohu-ap-1 php artisan migrate:status | tail -n 10

# 5. Si hay alguna migración "Pending", simular primero y luego aplicar interactivamente
docker exec tablerohu-ap-1 php artisan migrate --pretend
docker exec -it tablerohu-ap-1 php artisan migrate
# (escribir "yes" y Enter)

# 6. Refrescar cachés compiladas y asegurar permisos del servidor web
docker exec tablerohu-ap-1 php artisan optimize:clear
docker exec tablerohu-ap-1 php artisan config:cache
docker exec tablerohu-ap-1 php artisan route:cache
docker exec tablerohu-ap-1 php artisan view:cache
docker exec tablerohu-ap-1 chown -R www-data:www-data storage bootstrap/cache
```

### 6.3 Variables clave del `.env` en producción (sin contraseñas reales)
```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://siprohu.hospital.uncu.edu.ar

SESSION_SECURE_COOKIE=true
SANCTUM_STATEFUL_DOMAINS=siprohu.hospital.uncu.edu.ar

BROADCAST_DRIVER=log
QUEUE_CONNECTION=sync

# Para envío real de correos/recordatorios (no dejar en "log")
MAIL_MAILER=smtp
MAIL_HOST=smtp.tu-servidor.com
MAIL_PORT=587
MAIL_USERNAME=correo-remitente@dominio.com
MAIL_PASSWORD="clave-o-app-password"
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="correo-remitente@dominio.com"
MAIL_FROM_NAME="SiproHU - Tablero HU"
```
*(Cada vez que se edite `.env` en producción, volver a correr los 4 comandos de caché del paso 6).*

### 6.4 Crontab del host Linux (recordatorios automáticos)
El contenedor Docker no corre el Scheduler solo. En el host Linux (`crontab -e`) se agrega:
```cron
* * * * * /usr/bin/docker exec -u www-data tablerohu-ap-1 php /var/www/html/artisan schedule:run >> /dev/null 2>&1
```
Verificación de solo lectura:
```bash
docker exec -u www-data tablerohu-ap-1 php artisan schedule:list
docker exec -u www-data tablerohu-ap-1 php artisan personal-task:send-reminders
```

### 6.5 Verificación y asignación de roles en producción
- **Listar usuarios y roles actuales (solo lectura):**
  ```bash
  docker exec -u www-data tablerohu-ap-1 php artisan tinker --execute="App\Models\User::with('roles:id,name')->get(['id','name','email'])->each(fn(\$u)=>dump(\$u->id.' | '.\$u->name.' | '.\$u->email.' | '.\$u->getRoleNames()->implode(', ')));"
  ```
- **Asignar rol `admin` a un usuario existente:** desde la web iniciando sesión como `superadmin` → menú **Usuarios** → editar usuario → asignar rol `admin`.

---

## 7. Solución rápida de problemas frecuentes

| Síntoma | Causa probable | Cómo verificar / resolver (sin borrar datos) |
| :--- | :--- | :--- |
| Pantalla `500 Server Error` tras actualizar código | Quedó una migración en estado `Pending` o un error PHP registrado | Ver error exacto: `tail -n 60 /datos/tableroHU/html/storage/logs/laravel.log` y `docker exec tablerohu-ap-1 php artisan migrate:status \| tail -n 10`. |
| `EACCES: permission denied, unlink .../public/build/...` al correr `npm run build` | Un build anterior dejó archivos en `public/build/` con dueño `root` o `www-data` | Corregir dueño solo en `public/build`: `sudo chown -R hospital:hospital /datos/tableroHU/html/public/build` y volver a ejecutar `npm run build`. |
| No llegan los correos de recordatorio | `.env` sigue con `MAIL_MAILER=log`, falta recargar caché, o falta `crontab` | Revisar `config('mail.default')`, verificar `crontab -l` y revisar `storage/logs/laravel.log`. |
| `Permission denied` al escribir en `storage/logs` o sesiones | Se ejecutó `artisan` como `root` dentro del contenedor | `docker exec tablerohu-ap-1 chown -R www-data:www-data storage bootstrap/cache`. |
| "Los cambios de caché, ¿se pueden borrar mañana?" | Confusión habitual entre base de datos y caché de Laravel | **No se pierden.** Las tablas y datos viven en MySQL en disco. `config:cache`/`route:cache`/`view:cache` solo aceleran la lectura de archivos `.php` y se regeneran sin pérdida alguna. |

---

## 8. Principios de ética y buenas prácticas adoptados

1. **Nunca exponer secretos:** `.env`, claves SMTP, bases locales (`database.sqlite`) y respaldos (`backups/`, `*.zip`) están excluidos en `.gitignore` y nunca se suben al repositorio.
2. **Doble validación (Frontend + Backend):** Nunca se confía únicamente en ocultar un botón en React; todas las reglas de rol se validan también en el controlador PHP con `HTTP 403`.
3. **Despliegues aditivos y reversibles:** No se utilizan comandos destructivos en producción (`migrate:fresh`, `migrate:reset`, `db:wipe`, `git reset --hard`, `rm -rf`). Se inspecciona antes con `--pretend`, `migrate:status` y respaldos puntuales de `.env`.
4. **Aislamiento de fallos:** Un correo inválido o un servidor SMTP caído no interrumpe la operación del resto de usuarios ni cuelga indefinidamente el servidor web.
