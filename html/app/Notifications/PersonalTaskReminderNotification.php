<?php

namespace App\Notifications;

use App\Models\PersonalTask;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

// Envía recordatorios e invitaciones de Google Calendar (.ics) para tareas personales.
class PersonalTaskReminderNotification extends Notification
{
    use Queueable;

    public function __construct(
        public PersonalTask $task,
        public bool $isInitialInvite = false,
        public bool $mailOnly = false,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if ($this->mailOnly || $notifiable instanceof AnonymousNotifiable) {
            return ['mail'];
        }

        if ($this->isInitialInvite) {
            return ['mail'];
        }

        return ['database', 'broadcast', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $task = $this->task;
        $dateLabel = $task->formattedDateLabel();
        $timeLabel = $task->formattedTimeLabel();
        $priorityLabel = $task->priority ? $task->priority->label : 'Normal';
        $leadLabel = $task->reminder_minutes ? $task->reminderLeadLabel() : '7 días';

        $subject = $this->isInitialInvite
            ? "📅 Actividad agendada: {$task->description} ({$task->scheduled_for?->format('d/m/Y')})"
            : "⏰ Recordatorio ({$leadLabel} antes): {$task->description} ({$task->scheduled_for?->format('d/m/Y')})";

        $greetingName = $notifiable instanceof User ? $notifiable->getFirstName() : 'Hola';

        $mail = (new MailMessage)
            ->subject($subject)
            ->greeting("¡Hola, {$greetingName}!")
            ->line(
                $this->isInitialInvite
                    ? 'Se ha agendado una actividad en Tareas Personales y se adjunta la invitación para tu Google Calendar:'
                    : "Te recordamos con **{$leadLabel} de anticipación** la siguiente actividad pendiente de realizar/entregar:"
            )
            ->line("📌 **Actividad / Tarea:** {$task->description}")
            ->line("📅 **Día y Fecha:** {$dateLabel}")
            ->line("🕒 **Horario:** {$timeLabel}")
            ->line("⚡ **Prioridad:** {$priorityLabel}");

        if (! empty($task->notes)) {
            $mail->line("📝 **Detalles / Notas:** {$task->notes}");
        }

        if (! empty($task->shared_emails)) {
            $guests = implode(', ', (array) $task->shared_emails);
            $mail->line("👥 **Compartido / Reunión con:** {$guests}");
        }

        $mail->action('➕ Abrir / Guardar en Google Calendar', $task->googleCalendarUrl())
            ->line('También adjuntamos el archivo de calendario (.ics) en este correo para que quede sincronizado con sus alarmas automáticas en tu celular y Google Calendar.')
            ->salutation('Equipo TAHU');

        $icsContent = $task->buildIcsContent('REQUEST');
        $mail->attachData($icsContent, 'evento-google-calendar.ics', [
            'mime' => 'text/calendar; charset=UTF-8; method=REQUEST',
        ]);

        return $mail;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $task = $this->task;

        $lead = $task->reminder_minutes ? $task->reminderLeadLabel() : '7 días';
        $time = $task->formattedTimeLabel();
        $priority = $task->priority ? "Prioridad {$task->priority->label}" : 'Sin prioridad';

        return [
            'personal_task_id' => $task->id,
            'title' => "En {$lead}: ".Str::limit($task->description, 80),
            'subtitle' => "Recordatorio · {$task->formattedDateLabel()} · {$time} · {$priority}",
            'link' => route('personal-tasks.index', ['date' => $task->scheduled_for->toDateString()]),
        ];
    }
}
