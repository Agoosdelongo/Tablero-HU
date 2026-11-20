<?php

namespace App\Http\Controllers\PersonalTasks;

use App\Http\Controllers\Controller;
use App\Models\PersonalTask;
use App\Models\TaskPriority;
use App\Models\User;
use App\Notifications\PersonalTaskReminderNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Controlador de la agenda personal del usuario autenticado.
 */
class PersonalTaskController extends Controller
{
    public function index(Request $request): Response
    {
        /** @var User $user */
        $user = auth()->user();

        $viewingDate = $request->input('date')
            ? Carbon::createFromFormat('Y-m-d', $request->input('date'))->startOfDay()
            : now()->startOfDay();

        $today = now()->startOfDay();
        $isToday = $viewingDate->isSameDay($today);
        $prioritySort = $request->input('sort_priority');

        $withOrder = function ($query) use ($prioritySort) {
            $query->with('priority');

            if ($prioritySort) {
                $direction = $prioritySort === 'asc' ? 'asc' : 'desc';
                $query
                    ->leftJoin('task_priorities', 'personal_tasks.priority_id', '=', 'task_priorities.id')
                    ->orderByRaw('personal_tasks.priority_id IS NULL')
                    ->orderBy('task_priorities.order', $direction)
                    ->orderBy('personal_tasks.order_column', 'asc')
                    ->select('personal_tasks.*');
            } else {
                $query->orderByRaw('personal_tasks.scheduled_time IS NULL')
                    ->orderBy('personal_tasks.scheduled_time', 'asc')
                    ->orderBy('personal_tasks.order_column', 'asc');
            }
        };

        $dateTasks = PersonalTask::where('user_id', $user->id)
            ->pendingForDate($viewingDate)
            ->tap($withOrder)
            ->get();

        $overdueTasks = $isToday
            ? PersonalTask::where('user_id', $user->id)
                ->overdueAsOf($today)
                ->tap($withOrder)
                ->get()
            : collect();

        $completedTasks = PersonalTask::where('user_id', $user->id)
            ->completedOn($viewingDate)
            ->with('priority')
            ->orderBy('completed_at', 'desc')
            ->get();

        $availableUsers = User::where('id', '!=', $user->id)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'google_calendar_email']);

        return Inertia::render('PersonalTasks/Index', [
            'dateTasks' => $dateTasks,
            'overdueTasks' => $overdueTasks,
            'completedTasks' => $completedTasks,
            'priorities' => TaskPriority::orderBy('order')->get(),
            'viewingDate' => $viewingDate->toDateString(),
            'today' => $today->toDateString(),
            'isToday' => $isToday,
            'googleCalendarEmail' => $user->google_calendar_email,
            'availableUsers' => $availableUsers,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'description' => ['required', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'priority_id' => ['nullable', 'exists:task_priorities,id'],
            'scheduled_for' => ['required', 'date'],
            'scheduled_time' => ['nullable', 'date_format:H:i'],
            'scheduled_end_time' => ['nullable', 'date_format:H:i'],
            'reminder_minutes' => ['nullable', Rule::in(PersonalTask::REMINDER_OPTIONS)],
            'shared_emails' => ['nullable', 'array'],
            'shared_emails.*' => ['email', 'max:255'],
        ]);

        $validated = $this->normalizeTimes($validated);
        $validated['shared_emails'] = $this->normalizeSharedEmails($validated['shared_emails'] ?? []);

        $task = PersonalTask::create([
            ...$validated,
            'user_id' => auth()->id(),
            'order_column' => PersonalTask::where('user_id', auth()->id())
                ->whereDate('scheduled_for', $validated['scheduled_for'])
                ->max('order_column') + 1,
        ]);

        $task->load(['user', 'priority']);
        $this->dispatchCalendarInvite($task, true);

        return back()->success(
            'Tarea creada',
            $task->user?->google_calendar_email || ! empty($task->shared_emails)
                ? 'La tarea se guardó y se envió la invitación a Google Calendar.'
                : 'La tarea se guardó correctamente.'
        );
    }

    public function update(Request $request, PersonalTask $personalTask): RedirectResponse
    {
        Gate::allowIf(fn () => $personalTask->user_id === auth()->id());

        $validated = $request->validate([
            'description' => ['sometimes', 'required', 'string', 'max:500'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'priority_id' => ['sometimes', 'nullable', 'exists:task_priorities,id'],
            'scheduled_for' => ['sometimes', 'required', 'date'],
            'scheduled_time' => ['sometimes', 'nullable', 'date_format:H:i'],
            'scheduled_end_time' => ['sometimes', 'nullable', 'date_format:H:i'],
            'reminder_minutes' => ['sometimes', 'nullable', Rule::in(PersonalTask::REMINDER_OPTIONS)],
            'shared_emails' => ['sometimes', 'nullable', 'array'],
            'shared_emails.*' => ['email', 'max:255'],
        ]);

        $validated = $this->normalizeTimes($validated, $personalTask);
        if (array_key_exists('shared_emails', $validated)) {
            $validated['shared_emails'] = $this->normalizeSharedEmails($validated['shared_emails'] ?? []);
        }

        $personalTask->update($validated);
        $personalTask->load(['user', 'priority']);
        $this->dispatchCalendarInvite($personalTask, true);

        return back()->success('Tarea actualizada', 'Los cambios fueron guardados.');
    }

    /**
     * Guarda una única vez el correo de Google Calendar del usuario autenticado.
     */
    public function updateGoogleEmail(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'google_calendar_email' => ['nullable', 'email', 'max:255'],
        ]);

        /** @var User $user */
        $user = auth()->user();
        $user->update([
            'google_calendar_email' => $validated['google_calendar_email']
                ? strtolower(trim($validated['google_calendar_email']))
                : null,
        ]);

        return back()->success(
            'Google Calendar actualizado',
            $user->google_calendar_email
                ? "Tus tareas personales se enviarán automáticamente a {$user->google_calendar_email}."
                : 'Se desvinculó el correo de Google Calendar.'
        );
    }

    /**
     * Envía inmediatamente el recordatorio por correo (+ invitación .ics) al correo de Google y a los invitados.
     */
    public function sendReminder(PersonalTask $personalTask): RedirectResponse
    {
        Gate::allowIf(fn () => $personalTask->user_id === auth()->id());

        $personalTask->load(['user', 'priority']);
        $sentTo = $this->dispatchCalendarInvite($personalTask, false, true);

        return back()->success(
            'Recordatorio enviado',
            'Se envió el recordatorio y evento de calendario a: '.implode(', ', $sentTo)
        );
    }

    /**
     * Descarga el archivo .ics de la tarea personal para agendar en cualquier calendario.
     */
    public function downloadIcs(PersonalTask $personalTask): HttpResponse
    {
        Gate::allowIf(fn () => $personalTask->user_id === auth()->id());

        $personalTask->load(['user', 'priority']);
        $ics = $personalTask->buildIcsContent('REQUEST');

        return response($ics, 200, [
            'Content-Type' => 'text/calendar; charset=UTF-8; method=REQUEST',
            'Content-Disposition' => "attachment; filename=\"tarea-{$personalTask->id}.ics\"",
        ]);
    }

    /**
     * @param  array<int, string|null>  $emails
     * @return array<int, string>
     */
    private function normalizeSharedEmails(array $emails): array
    {
        $clean = [];
        foreach ($emails as $email) {
            $e = strtolower(trim((string) $email));
            if ($e && filter_var($e, FILTER_VALIDATE_EMAIL)) {
                $clean[] = $e;
            }
        }

        return array_values(array_unique($clean));
    }

    /**
     * Envía la invitación/recordatorio al correo de Google del usuario y a los correos invitados.
     *
     * @return array<int, string>
     */
    private function dispatchCalendarInvite(PersonalTask $task, bool $isInitialInvite = true, bool $forceOwnerSend = false): array
    {
        $sentTo = [];
        $user = $task->user;

        try {
            if ($user && ($user->google_calendar_email || $forceOwnerSend)) {
                $ownerTarget = $user->google_calendar_email ?: $user->email;
                $user->notify(new PersonalTaskReminderNotification($task, $isInitialInvite));
                $sentTo[] = $ownerTarget;
            }

            $ownerEmail = strtolower(trim((string) ($user?->google_calendar_email ?: $user?->email)));

            foreach ((array) ($task->shared_emails ?? []) as $guestEmail) {
                $guestEmail = strtolower(trim((string) $guestEmail));
                if ($guestEmail && $guestEmail !== $ownerEmail && filter_var($guestEmail, FILTER_VALIDATE_EMAIL)) {
                    Notification::route('mail', $guestEmail)->notify(
                        new PersonalTaskReminderNotification($task, $isInitialInvite, true)
                    );
                    $sentTo[] = $guestEmail;
                }
            }
        } catch (\Throwable $e) {
            report($e);
        }

        return $sentTo;
    }

    private function normalizeTimes(array $validated, ?PersonalTask $existing = null): array
    {
        $start = array_key_exists('scheduled_time', $validated)
            ? $validated['scheduled_time']
            : $existing?->scheduled_time;
        $end = array_key_exists('scheduled_end_time', $validated)
            ? $validated['scheduled_end_time']
            : $existing?->scheduled_end_time;

        $start = $start ? substr($start, 0, 5) : null;
        $end = $end ? substr($end, 0, 5) : null;

        if ($end !== null && $start === null) {
            if (! empty($validated['scheduled_end_time'])) {
                throw ValidationException::withMessages([
                    'scheduled_time' => 'La hora de comienzo es obligatoria cuando hay hora de fin.',
                ]);
            }

            $validated['scheduled_end_time'] = null;

            return $validated;
        }

        if ($end !== null && $end <= $start) {
            throw ValidationException::withMessages([
                'scheduled_end_time' => 'La hora de fin debe ser posterior a la hora de comienzo.',
            ]);
        }

        return $validated;
    }

    public function toggle(PersonalTask $personalTask): RedirectResponse
    {
        Gate::allowIf(fn () => $personalTask->user_id === auth()->id());

        $personalTask->update([
            'completed_at' => $personalTask->completed_at ? null : now(),
        ]);

        return back();
    }

    public function destroy(PersonalTask $personalTask): RedirectResponse
    {
        Gate::allowIf(fn () => $personalTask->user_id === auth()->id());

        $personalTask->delete();

        return back();
    }

    public function clearCompleted(Request $request): RedirectResponse
    {
        $viewingDate = $request->input('date')
            ? Carbon::createFromFormat('Y-m-d', $request->input('date'))->startOfDay()
            : now()->startOfDay();

        PersonalTask::where('user_id', auth()->id())
            ->completedOn($viewingDate)
            ->delete();

        return back();
    }
}
