<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Tarea personal de un usuario (agenda personal).
 *
 * Independiente de proyectos. Solo visible para el usuario dueño.
 *
 * Nomenclatura de campos:
 *   - description    → título de la tarea (nombre heredado, no se renombra)
 *   - notes          → descripción/detalle opcional
 *   - scheduled_for  → fecha programada (date)
 *   - scheduled_time → hora opcional (time|null). Si es null, la tarea es solo de fecha.
 *   - scheduled_end_time → hora de fin opcional (time|null). Solo tiene sentido con scheduled_time:
 *       sin fin = horario puntual; con fin = rango horario.
 *
 * Recordatorio (opcional, interno):
 *   - reminder_minutes → anticipación elegida (ver REMINDER_OPTIONS). null = sin recordatorio.
 *   - remind_at → momento en que corresponde notificar; lo recalcula PersonalTaskObserver.
 *   - reminder_notified_at → cuándo se envió (una sola vez por programación).
 *   Siempre se calcula sobre la hora de comienzo (scheduled_time), también en rangos.
 *
 * Navegación de fechas:
 *   Los scopes reciben una $date Carbon para poder usarse con cualquier fecha,
 *   no solo con now(). Esto permite la navegación entre días en el frontend.
 *
 * Arrastre lazy (solo aplica al ver el día de HOY):
 *   Las tareas pendientes con scheduled_for < hoy siguen apareciendo como
 *   "Pendientes anteriores" hasta que se completen. No se reprograman.
 *   Al navegar a otro día se ven solo las tareas de ese día.
 */
class PersonalTask extends Model
{
    /** Anticipaciones permitidas para el recordatorio, en minutos (incluye 1, 3 y 7 días). */
    public const REMINDER_OPTIONS = [5, 15, 30, 60, 1440, 4320, 10080];

    /**
     * Tolerancia (minutos) para enviar un recordatorio ya vencido.
     */
    public const REMINDER_TOLERANCE_MINUTES = 1440;

    protected $fillable = [
        'user_id',
        'priority_id',
        'description',
        'notes',
        'scheduled_for',
        'scheduled_time',
        'scheduled_end_time',
        'reminder_minutes',
        'remind_at',
        'reminder_notified_at',
        'shared_emails',
        'completed_at',
        'order_column',
    ];

    protected $casts = [
        'scheduled_for' => 'date',
        'completed_at' => 'datetime',
        'remind_at' => 'datetime',
        'reminder_notified_at' => 'datetime',
        'shared_emails' => 'array',
    ];

    // ─── Relaciones ────────────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function priority(): BelongsTo
    {
        return $this->belongsTo(TaskPriority::class, 'priority_id');
    }

    // ─── Recordatorio ──────────────────────────────────────────────

    /**
     * Momento de comienzo de la tarea (fecha + hora de comienzo), o null si no tiene hora.
     * Para rangos horarios es siempre la hora de comienzo, nunca la de fin.
     */
    public function startsAt(): ?Carbon
    {
        if (! $this->scheduled_time || ! $this->scheduled_for) {
            return null;
        }

        return Carbon::parse(
            $this->scheduled_for->toDateString().' '.substr($this->scheduled_time, 0, 5),
            config('app.timezone')
        );
    }

    /**
     * Momento base para calcular recordatorios: si tiene hora, usa fecha+hora;
     * si solo tiene fecha, toma las 09:00 AM de esa fecha.
     */
    public function reminderReferenceTime(): ?Carbon
    {
        if (! $this->scheduled_for) {
            return null;
        }

        $time = $this->scheduled_time ? substr($this->scheduled_time, 0, 5) : '09:00';

        return Carbon::parse(
            $this->scheduled_for->toDateString().' '.$time,
            config('app.timezone')
        );
    }

    /**
     * Recalcula remind_at según fecha, hora de comienzo (o 09:00) y anticipación.
     * Lo invoca PersonalTaskObserver al guardar.
     */
    public function syncReminder(): void
    {
        $reference = $this->reminderReferenceTime();

        if (! $this->reminder_minutes || ! $reference) {
            $this->reminder_minutes = null;
            $this->remind_at = null;
            $this->reminder_notified_at = null;

            return;
        }

        $remindAt = $reference->copy()->subMinutes((int) $this->reminder_minutes);

        $this->remind_at = $remindAt->isFuture() ? $remindAt : null;
        $this->reminder_notified_at = null;
    }

    public function formattedDateLabel(): string
    {
        if (! $this->scheduled_for) {
            return '';
        }

        return ucfirst($this->scheduled_for->copy()->locale('es')->translatedFormat('l, j \d\e F \d\e Y'));
    }

    public function formattedTimeLabel(): string
    {
        if (! $this->scheduled_time) {
            return 'Durante el día (sin horario fijo)';
        }

        $start = substr($this->scheduled_time, 0, 5);

        return $this->scheduled_end_time
            ? $start.' a '.substr($this->scheduled_end_time, 0, 5).' hs'
            : $start.' hs';
    }

    public function reminderLeadLabel(): string
    {
        $min = (int) $this->reminder_minutes;

        return match ($min) {
            10080 => '7 días',
            4320 => '3 días',
            1440 => '1 día',
            60 => '1 hora',
            default => "{$min} minutos",
        };
    }

    /**
     * Correos destinatarios para Google Calendar y recordatorios (dueño + invitados de reunión).
     *
     * @return array<int, string>
     */
    public function recipientEmails(): array
    {
        $emails = [];

        if ($this->user) {
            $ownerEmail = $this->user->google_calendar_email ?: $this->user->email;
            if ($ownerEmail) {
                $emails[] = strtolower(trim($ownerEmail));
            }
        }

        foreach ((array) ($this->shared_emails ?? []) as $guest) {
            $clean = strtolower(trim((string) $guest));
            if (filter_var($clean, FILTER_VALIDATE_EMAIL)) {
                $emails[] = $clean;
            }
        }

        return array_values(array_unique($emails));
    }

    /**
     * URL directa para abrir y agendar el evento en Google Calendar (incluyendo invitados).
     */
    public function googleCalendarUrl(): string
    {
        $date = $this->scheduled_for ? $this->scheduled_for->format('Ymd') : now()->format('Ymd');

        if ($this->scheduled_time) {
            $start = Carbon::parse($this->scheduled_for->toDateString().' '.substr($this->scheduled_time, 0, 5), config('app.timezone'));
            $end = $this->scheduled_end_time
                ? Carbon::parse($this->scheduled_for->toDateString().' '.substr($this->scheduled_end_time, 0, 5), config('app.timezone'))
                : $start->copy()->addHour();
            $dates = $start->copy()->utc()->format('Ymd\THis\Z').'/'.$end->copy()->utc()->format('Ymd\THis\Z');
        } else {
            $nextDay = $this->scheduled_for ? $this->scheduled_for->copy()->addDay()->format('Ymd') : now()->addDay()->format('Ymd');
            $dates = "{$date}/{$nextDay}";
        }

        $details = "Actividad: {$this->description}\n"
            ."Fecha: {$this->formattedDateLabel()}\n"
            ."Horario: {$this->formattedTimeLabel()}"
            .($this->priority ? "\nPrioridad: {$this->priority->label}" : '')
            .($this->notes ? "\n\nNotas:\n{$this->notes}" : '');

        $params = [
            'action' => 'TEMPLATE',
            'text' => $this->description,
            'dates' => $dates,
            'details' => $details,
        ];

        $guests = $this->recipientEmails();
        if (! empty($guests)) {
            $params['add'] = implode(',', $guests);
        }

        return 'https://calendar.google.com/calendar/render?'.http_build_query($params);
    }

    /**
     * Genera el contenido iCalendar (.ics) RFC 5545 con METHOD:REQUEST y alarmas 7 días y 1 hora antes.
     */
    public function buildIcsContent(string $method = 'REQUEST'): string
    {
        $host = parse_url((string) config('app.url'), PHP_URL_HOST) ?: 'tahu.local';
        $uid = "personal-task-{$this->id}@{$host}";
        $nowUtc = now()->utc()->format('Ymd\THis\Z');

        if ($this->scheduled_time && $this->scheduled_for) {
            $start = Carbon::parse($this->scheduled_for->toDateString().' '.substr($this->scheduled_time, 0, 5), config('app.timezone'));
            $end = $this->scheduled_end_time
                ? Carbon::parse($this->scheduled_for->toDateString().' '.substr($this->scheduled_end_time, 0, 5), config('app.timezone'))
                : $start->copy()->addHour();
            $dtStart = 'DTSTART:'.$start->copy()->utc()->format('Ymd\THis\Z');
            $dtEnd = 'DTEND:'.$end->copy()->utc()->format('Ymd\THis\Z');
        } else {
            $dStart = $this->scheduled_for ? $this->scheduled_for->format('Ymd') : now()->format('Ymd');
            $dEnd = $this->scheduled_for ? $this->scheduled_for->copy()->addDay()->format('Ymd') : now()->addDay()->format('Ymd');
            $dtStart = "DTSTART;VALUE=DATE:{$dStart}";
            $dtEnd = "DTEND;VALUE=DATE:{$dEnd}";
        }

        $summary = str_replace(["\r", "\n", ',', ';'], [' ', ' ', '\,', '\;'], (string) $this->description);
        $rawDesc = "Tarea: {$this->description}\nFecha: {$this->formattedDateLabel()}\nHora: {$this->formattedTimeLabel()}"
            .($this->notes ? "\nNotas: {$this->notes}" : '');
        $description = str_replace(["\r\n", "\n", ',', ';'], ['\n', '\n', '\,', '\;'], $rawDesc);

        $organizerEmail = config('mail.from.address') ?: 'noreply@tahu.local';
        $organizerName = str_replace([',', ';'], '', config('mail.from.name', 'TAHU'));

        $lines = [
            'BEGIN:VCALENDAR',
            'PRODID:-//TAHU//Tareas Personales//ES',
            'VERSION:2.0',
            'CALSCALE:GREGORIAN',
            "METHOD:{$method}",
            'BEGIN:VEVENT',
            "UID:{$uid}",
            "DTSTAMP:{$nowUtc}",
            $dtStart,
            $dtEnd,
            "SUMMARY:{$summary}",
            "DESCRIPTION:{$description}",
            "ORGANIZER;CN={$organizerName}:mailto:{$organizerEmail}",
        ];

        foreach ($this->recipientEmails() as $email) {
            $lines[] = "ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN={$email}:mailto:{$email}";
        }

        $lines = array_merge($lines, [
            'STATUS:CONFIRMED',
            'SEQUENCE:0',
            'BEGIN:VALARM',
            'TRIGGER:-P7D',
            'ACTION:DISPLAY',
            "DESCRIPTION:Recordatorio (faltan 7 días): {$summary}",
            'END:VALARM',
            'BEGIN:VALARM',
            'TRIGGER:-PT1H',
            'ACTION:DISPLAY',
            "DESCRIPTION:Recordatorio: {$summary}",
            'END:VALARM',
            'END:VEVENT',
            'END:VCALENDAR',
        ]);

        return implode("\r\n", $lines)."\r\n";
    }

    /**
     * Recordatorios que corresponde enviar ahora: vencidos hace no más de la tolerancia,
     * sin enviar y con la tarea sin completar. Las tareas de días anteriores nunca entran
     * porque remind_at se calcula una sola vez, al guardar.
     */
    public function scopeReminderDue(Builder $query): Builder
    {
        return $query
            ->whereNull('completed_at')
            ->whereNull('reminder_notified_at')
            ->whereNotNull('remind_at')
            ->where('remind_at', '<=', now())
            ->where('remind_at', '>=', now()->subMinutes(self::REMINDER_TOLERANCE_MINUTES));
    }

    /**
     * Recordatorios pendientes cuyo momento ya pasó más allá de la tolerancia.
     */
    public function scopeReminderExpired(Builder $query): Builder
    {
        return $query
            ->whereNotNull('remind_at')
            ->whereNull('reminder_notified_at')
            ->where('remind_at', '<', now()->subMinutes(self::REMINDER_TOLERANCE_MINUTES));
    }

    // ─── Scopes parametrizados por fecha ───────────────────────────

    /**
     * Tareas pendientes programadas exactamente para $date.
     */
    public function scopePendingForDate(Builder $query, Carbon $date): Builder
    {
        return $query
            ->whereNull('completed_at')
            ->whereDate('scheduled_for', $date);
    }

    /**
     * Tareas pendientes de días anteriores a $date (arrastre lazy).
     * Solo se usa al ver el día de hoy; al navegar a otro día no aplica.
     */
    public function scopeOverdueAsOf(Builder $query, Carbon $date): Builder
    {
        return $query
            ->whereNull('completed_at')
            ->whereDate('scheduled_for', '<', $date);
    }

    /**
     * Tareas completadas en $date (usa completed_at, no scheduled_for).
     */
    public function scopeCompletedOn(Builder $query, Carbon $date): Builder
    {
        return $query
            ->whereNotNull('completed_at')
            ->whereDate('completed_at', $date);
    }

    // ─── Scopes legacy (mantienen compatibilidad si se usan en otro lado) ──

    public function scopePending(Builder $query): Builder
    {
        return $this->scopePendingForDate($query, now());
    }

    public function scopePendingToday(Builder $query): Builder
    {
        return $this->scopePendingForDate($query, now());
    }

    public function scopeOverdue(Builder $query): Builder
    {
        return $this->scopeOverdueAsOf($query, now());
    }

    public function scopeCompletedToday(Builder $query): Builder
    {
        return $this->scopeCompletedOn($query, now());
    }
}
