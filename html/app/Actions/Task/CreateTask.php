<?php

namespace App\Actions\Task;

use App\Events\Task\AttachmentsUploaded;
use App\Events\Task\TaskCreated;
use App\Models\Project;
use App\Models\Task;
use App\Notifications\TaskAssignedNotification;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Facades\Image;
use Throwable;

// Crea tareas de proyecto y sube sus archivos adjuntos.
class CreateTask
{
    // Crea una tarea con fecha de inicio automática y asigna los responsables.
    public function create(Project $project, array $data): Task
    {
        return DB::transaction(function () use ($project, $data) {
            $assigneeIds = collect($data['assigned_user_ids'] ?? [])
                ->when(
                    empty($data['assigned_user_ids']) && ! empty($data['assigned_to_user_id']),
                    fn ($c) => $c->push($data['assigned_to_user_id'])
                )
                ->map(fn ($id) => (int) $id)
                ->filter()
                ->unique()
                ->values()
                ->all();

            // Fecha de inicio automática (hoy).
            // Fecha de finalización permitida para el admin o si el creador es asignado.
            $user = auth()->user();
            $canSetDueOn = ($user && ($user->isAdmin() || $user->isSuperAdmin()))
                || in_array((int) auth()->id(), $assigneeIds, true);

            $task = $project->tasks()->create([
                'group_id' => $data['group_id'],
                'created_by_user_id' => auth()->id(),
                'assigned_to_user_id' => $assigneeIds[0] ?? null,
                'name' => $data['name'],
                'number' => $project->tasks()->withArchived()->count() + 1,
                'issue_type' => $data['issue_type'],
                'parent_task_id' => $data['parent_task_id'] ?? null,
                'description' => $data['description'],
                'start_on' => ! empty($data['start_on']) ? $data['start_on'] : now()->toDateString(),
                'due_on' => $canSetDueOn ? ($data['due_on'] ?? null) : null,
                'priority_id' => $data['priority_id'] ?? null,
                'completed_at' => null,
            ]);

            if (! empty($assigneeIds)) {
                $task->assignees()->sync($assigneeIds);
            }

            $task->subscribedUsers()->attach($data['subscribed_users'] ?? []);

            $task->labels()->attach($data['labels'] ?? []);

            if (! empty($data['attachments'])) {
                $this->uploadAttachments($task, $data['attachments'], false);
            }

            foreach ($task->assignees()->get() as $assignee) {
                if ((int) $assignee->id !== (int) auth()->id()) {
                    $assignee->notify(new TaskAssignedNotification($task));
                }
            }

            TaskCreated::dispatch($task);

            return $task;
        });
    }

    public function uploadAttachments(Task $task, array $items, $dispatchEvent = true): Collection
    {
        $rows = collect($items)
            ->map(function (UploadedFile $item) use ($task) {
                $filename = strtolower(Str::ulid()).'.'.$item->getClientOriginalExtension();
                $filepath = "tasks/{$task->id}/{$filename}";

                $item->storeAs('', $filepath, 'external');

                $thumbFilepath = $this->generateThumb($item, $task, $filename);

                return [
                    'user_id' => auth()->id(),
                    'name' => $item->getClientOriginalName(),
                    'path' => "/imagenes/$filepath",
                    'thumb' => $thumbFilepath ? "/imagenes/$thumbFilepath" : null,
                    'type' => $item->getClientMimeType(),
                    'size' => $item->getSize(),
                ];
            });

        $attachments = $task->attachments()->createMany($rows);

        $task->activities()->create([
            'project_id' => $task->project_id,
            'user_id' => auth()->id(),
            'title' => ($attachments->count() > 1 ? 'Attachments where' : 'Attachment was').' uploaded',
            'subtitle' => "to \"{$task->name}\" by ".auth()->user()->name,
        ]);

        if ($dispatchEvent) {
            AttachmentsUploaded::dispatch($task, $attachments);
        }

        return $attachments;
    }

    protected function generateThumb(UploadedFile $file, Task $task, string $filename)
    {
        if (in_array($file->getClientOriginalExtension(), ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'])) {
            try {
                $thumbFilepath = "tasks/{$task->id}/thumbs/{$filename}";

                $image = Image::make($file->get())
                    ->fit(100, 100)
                    ->encode(null, 75);

                Storage::disk('external')->put($thumbFilepath, $image);

                return $thumbFilepath;
            } catch (Throwable $e) {
                return null;
            }
        }

        return null;
    }
}
