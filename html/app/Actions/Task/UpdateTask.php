<?php

namespace App\Actions\Task;

use App\Events\Task\TaskUpdated;
use App\Models\Task;
use App\Models\TaskGroup;
use App\Models\User;
use App\Notifications\TaskAssignedNotification;

// Actualiza campos de una tarea y sincroniza asignados, etiquetas y suscriptores.
class UpdateTask
{
    // Guarda el cambio de un campo de la tarea y notifica a nuevos asignados.
    public function update(Task $task, array $data): void
    {
        $updateField = key($data);

        if (! in_array($updateField, ['subscribed_users', 'labels', 'assigned_user_ids'])) {
            if ($updateField === 'group_id') {
                $toGroup = TaskGroup::find($data['group_id']);

                $data['completed_at'] = ($toGroup && $toGroup->name === 'Finalizado')
                    ? now()
                    : null;
            }

            $task->update($data);

            if ($updateField === 'assigned_to_user_id') {
                $id = $data['assigned_to_user_id'] ? (int) $data['assigned_to_user_id'] : null;
                $task->assignees()->sync($id ? [$id] : []);
            }

            if ($updateField === 'group_id') {
                $task->update(['order_column' => 0]);
            }
        }

        if ($updateField === 'assigned_user_ids') {
            $previousIds = $task->assignees()->pluck('users.id')->map(fn ($id) => (int) $id)->all();
            $newIds = collect($data['assigned_user_ids'] ?? [])
                ->map(fn ($id) => (int) $id)
                ->filter()
                ->unique()
                ->values()
                ->all();

            $task->assignees()->sync($newIds);
            $task->update(['assigned_to_user_id' => $newIds[0] ?? null]);

            $addedIds = array_diff($newIds, $previousIds);
            if (! empty($addedIds)) {
                foreach (User::whereIn('id', $addedIds)->get() as $user) {
                    if ((int) $user->id !== (int) auth()->id()) {
                        try {
                            $user->notify(new TaskAssignedNotification($task));
                        } catch (\Throwable $e) {
                            \Illuminate\Support\Facades\Log::warning('No se pudo enviar notificación de tarea asignada: '.$e->getMessage());
                        }
                    }
                }
            }
        }

        if ($updateField === 'subscribed_users') {
            $task->subscribedUsers()->sync($data['subscribed_users']);
        }

        if ($updateField === 'labels') {
            $task->labels()->sync($data['labels']);
        }

        TaskUpdated::dispatch($task, $updateField);
    }
}
