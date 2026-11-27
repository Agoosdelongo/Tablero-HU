<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\Task;
use Inertia\Inertia;
use Inertia\Response;

class ProjectCalendarController extends Controller
{
    public function index(Project $project): Response
    {
        $this->authorize('viewAny', [Task::class, $project]);

        $tasks = $project
            ->tasks()
            ->whereNull('parent_task_id')
            ->with([
                'assignedToUser:id,name,avatar',
                'priority:id,label,color,order',
                'taskGroup:id,name,color',
                'children' => fn ($query) => $query->select([
                    'id',
                    'project_id',
                    'group_id',
                    'parent_task_id',
                    'name',
                    'number',
                    'issue_type',
                    'start_on',
                    'due_on',
                    'completed_at',
                    'created_at',
                ])->with(['taskGroup:id,name,color']),
            ])
            ->get()
            ->map(fn (Task $task) => [
                'id' => $task->id,
                'number' => $task->number,
                'name' => $task->name,
                'issue_type' => $task->issue_type,
                'start_on' => $task->start_on?->toDateString() ?? $task->created_at?->toDateString(),
                'due_on' => $task->due_on?->toDateString(),
                'completed_at' => $task->completed_at?->toDateString(),
                'group' => $task->taskGroup ? [
                    'id' => $task->taskGroup->id,
                    'name' => $task->taskGroup->name,
                    'color' => $task->taskGroup->color,
                ] : null,
                'assigned_to_user' => $task->assignedToUser,
                'priority' => $task->priority,
                'subtasks' => $task->children->map(fn (Task $child) => [
                    'id' => $child->id,
                    'number' => $child->number,
                    'name' => $child->name,
                    'issue_type' => $child->issue_type,
                    'start_on' => $child->start_on?->toDateString() ?? $child->created_at?->toDateString(),
                    'due_on' => $child->due_on?->toDateString(),
                    'completed_at' => $child->completed_at?->toDateString(),
                    'group' => $child->taskGroup ? [
                        'id' => $child->taskGroup->id,
                        'name' => $child->taskGroup->name,
                        'color' => $child->taskGroup->color,
                    ] : null,
                ])->values(),
            ]);

        return Inertia::render('Projects/Calendar/Index', [
            'project' => $project,
            'tasks' => $tasks,
        ]);
    }
}
