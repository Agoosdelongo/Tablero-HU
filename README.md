# TAHU — Tablero de Actividades del Hospital Universitario

Aplicación web de gestión de proyectos, tareas en equipo y agenda personal desarrollada con **Laravel 11**, **Inertia.js**, **React 18** y **Mantine UI v7**.

---

## 📋 Características principales

### 1. Módulo de Proyectos y Tareas (`Tablero Kanban` y `Vista Lista`)
Control estricto de roles (**Administrador** vs **Desarrollador / Integrante asignado**) validado tanto en la interfaz React como en los controladores del backend (`HTTP 403` ante intentos no autorizados):

| Campo / Acción | Admin / Superadmin | Developer (asignado a la tarea) | Developer (no asignado) |
| :--- | :---: | :---: | :---: |
| **Crear actividad (`+ Agregar actividad`)** | ✅ Sí | ❌ Oculto / Bloqueado | ❌ Oculto / Bloqueado |
| **Nombre y Descripción** | ✅ Solo el admin que creó/asignó la tarea | 🔒 Solo lectura | 🔒 Solo lectura |
| **Estado (columna Kanban / selector)** | ✅ Sí | 🔒 Bloqueado | 🔒 Bloqueado |
| **Tipo (Épica, Historia, Tarea, Subtarea)** | ✅ Sí | 🔒 Bloqueado | 🔒 Bloqueado |
| **Personas asignadas (lista múltiple)** | ✅ Sí (`task_assignees`) | 🔒 Solo lectura | 🔒 Solo lectura |
| **Suscriptores, Prioridad y Etiquetas** | ✅ Sí | 🔒 Bloqueado | 🔒 Bloqueado |
| **Fecha de inicio (`start_on`)** | ⚙️ Automática (fecha de hoy al crear) | ⚙️ Automática (solo lectura) | ⚙️ Automática (solo lectura) |
| **Fecha de finalización (`due_on`)** | ✅ Sí | ✅ **Habilitado** (carga cuándo terminó su tarea) | 🔒 Bloqueado |
| **Foto o comprobante de la tarea (Adjuntos)** | ✅ Sí | ✅ **Habilitado** | 🔒 Bloqueado |
| **Discusión / Comentarios** | ✅ Sí | ✅ **Habilitado** | ✅ Solo lectura / Comentarios del proyecto |

- **Asignación múltiple (`task_assignees`):** El administrador puede asignar una actividad a una o varias personas mediante un selector múltiple con búsqueda. Todos los asignados reciben notificación y quedan habilitados para cargar su fecha de finalización y comprobante.
- **Almacenamiento de comprobantes/fotos:** El disco `external` en `html/config/filesystems.php` utiliza `/tablerohu/imagenes` en producción y cae automáticamente a `html/public/imagenes` en entornos locales Windows.

---

### 2. Módulo de Tareas Personales + Google Calendar + Recordatorios por Correo
Pensado para que el personal pueda recibir avisos fuera de la red institucional (en su teléfono o casa):

- **Vinculación única del correo de Google:** En la cabecera de *Tareas Personales*, el usuario guarda una sola vez su dirección personal (`@gmail.com`) en `users.google_calendar_email`, independientemente del correo institucional con el que inicia sesión.
- **Sincronización en tiempo real con Google Calendar:** Al crear o editar una tarea personal, si está activo *"Impactar en Google Calendar en tiempo real al guardar"*, se abre la plantilla de Google Calendar con título, fecha, horario, prioridad, notas e invitados precargados.
- **Recordatorios automáticos 7 días antes (en segundo plano):**
  - Se amplió `personal_tasks.reminder_minutes` a `unsignedInteger` para soportar anticipaciones en días (**7 días**, **3 días**, **1 día**, además de 60, 30, 15 y 5 minutos), funcionando también en tareas que solo tienen fecha (toma las 09:00 AM como referencia).
  - El comando programado `personal-task:send-reminders` (ejecutado cada minuto por el Scheduler de Laravel) envía automáticamente un correo electrónico con **Día, Fecha, Hora, Nombre de la tarea, Notas**, enlace directo a Google Calendar e invitación iCalendar estándar **`.ics` (`METHOD:REQUEST`)** con alarmas a 7 días (`-P7D`) y 1 hora (`-PT1H`).
- **Compartir tarea / Reuniones (`shared_emails`):** Al activar *"Compartir tarea / Es una reunión"*, se pueden elegir compañeros del sistema o ingresar correos externos para que también reciban la invitación de calendario y los recordatorios.

---

## 🛠️ Stack Tecnológico

- **Backend:** PHP 8.2+, Laravel 11, Laravel Sanctum, Spatie Laravel Permission, OwenIt Auditing, Inertia Laravel.
- **Frontend:** React 18, Vite 5, Mantine UI v7 (`@mantine/core`, `@mantine/dates`, `@mantine/tiptap`, `@mantine/dropzone`), Zustand, Day.js, Tabler Icons.
- **Base de datos:** MySQL 8 (producción) o SQLite (desarrollo local aislado).

---

## 🚀 Instalación y Puesta en Marcha (Local)

### 1. Requisitos previos
- PHP >= 8.2 (con extensiones `pdo_sqlite` / `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`, `gd`)
- Composer
- Node.js >= 18 y npm

### 2. Instalar dependencias
```powershell
cd html
composer install
npm install
npm run build
```

### 3. Configurar el archivo `.env`
Crea el archivo `html/.env` (nunca se sube a GitHub) con la siguiente base:

```env
APP_NAME=TAHU
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000

ADMIN_NAME="Admin"
ADMIN_EMAIL=admin@mail.com
ADMIN_PASSWORD=password

# Opción recomendada para entorno local aislado (SQLite):
DB_CONNECTION=sqlite

# Para envío real de correos externos (Google Calendar / recordatorios):
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=tu-cuenta@gmail.com
MAIL_PASSWORD=tu-clave-de-aplicacion-16-letras
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="tu-cuenta@gmail.com"
MAIL_FROM_NAME="TAHU - Tareas Personales"
```

### 4. Preparar base de datos y clave de aplicación
```powershell
# Si usás SQLite local, crear el archivo vacío:
New-Item -ItemType File -Path database\database.sqlite -Force

php artisan key:generate
php artisan migrate --seed
php artisan storage:link
```

### 5. Levantar el proyecto

- **Solo en tu PC:**
  ```powershell
  php artisan serve
  ```
  Abrir: `http://localhost:8000`

- **Para mostrarlo en red local (LAN) por IP:**
  1. Cambiar `APP_URL=http://<TU_IP>:8000` en `html/.env`.
  2. Ejecutar:
     ```powershell
     php artisan serve --host=0.0.0.0 --port=8000
     ```
  *(También puede servirse con **Laragon** configurando `Root Documentos` en `.../html/public` y `APP_URL=http://<TU_IP>`).*

- **Activar el envío automático de recordatorios programados:**
  ```powershell
  php artisan schedule:work
  ```
  *(En servidor Linux de producción se configura en cron: `* * * * * php /ruta/html/artisan schedule:run >> /dev/null 2>&1`).*

---

## 📁 Estructura relevante del proyecto

```text
html/
├── app/
│   ├── Actions/Task/
│   │   ├── CreateTask.php                  # Creación de tareas, fecha inicio automática, asignación múltiple
│   │   └── UpdateTask.php                  # Actualización de campos y sincronización de assignees
│   ├── Console/Commands/
│   │   └── SendPersonalTaskReminders.php   # Envío automático de recordatorios de tareas personales
│   ├── Http/Controllers/
│   │   ├── TaskController.php              # Controlador de tareas + validación de permisos por rol/campo
│   │   ├── Task/AttachmentController.php   # Subida y borrado de fotos/comprobantes de tareas
│   │   └── PersonalTasks/PersonalTaskController.php  # Agenda personal, correo Google y envío manual
│   ├── Models/
│   │   ├── Task.php                        # Relación assignees(), canEditNameAndDescription(), isAssignedTo()
│   │   ├── PersonalTask.php                # Recordatorios en días, generador .ics y URL Google Calendar
│   │   └── User.php                        # google_calendar_email y enrutamiento de correos personales
│   └── Notifications/
│       └── PersonalTaskReminderNotification.php      # Email con detalle de tarea + adjunto .ics
├── database/migrations/
│   ├── 2026_11_18_000000_add_google_calendar_and_extended_reminders.php
│   └── 2026_11_20_000000_create_task_assignees_table.php
├── resources/js/
│   ├── components/RichTextEditor.jsx       # Editor TipTap con soporte dinámico de solo lectura
│   └── pages/
│       ├── PersonalTasks/Index.jsx         # UI de Tareas Personales, Google Calendar y Reuniones
│       └── Projects/Tasks/                 # Tablero Kanban, Lista, Drawers y controles por rol
└── DOCUMENTACION.md                        # Referencia técnica detallada de arquitectura y reglas
```

Para la referencia técnica completa de endpoints, migraciones, componentes y flujos internos, ver [html/DOCUMENTACION.md](html/DOCUMENTACION.md).
