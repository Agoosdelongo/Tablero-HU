<?php

namespace App\Http\Controllers\Task;

use App\Actions\Task\CreateTask;
use App\Events\Task\AttachmentDeleted;
use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

// Gestiona la subida y eliminación de fotos y comprobantes de tareas.
class AttachmentController extends Controller
{
    // Sube fotos o comprobantes a una tarea (admin o usuario asignado).
    public function store(Request $request, Project $project, Task $task): JsonResponse
    {
        $this->authorize('viewAny', [Attachment::class, $project]);

        $user = auth()->user();
        if (! ($user->isAdmin() || $user->isSuperAdmin()) && ! $task->isAssignedTo($user)) {
            return response()->json([
                'message' => 'Solo el administrador o la persona asignada a la tarea puede subir fotos o comprobantes.',
            ], 403);
        }

        $request->validate([
            'attachments' => ['required', 'array', 'max:10'],
            'attachments.*' => ['file', 'max:5120'], // 5 MB por archivo
        ]);

        $files = (new CreateTask)->uploadAttachments($task, $request->attachments);

        return response()->json(['files' => $files]);
    }

    public function destroy(Project $project, Task $task, Attachment $attachment): JsonResponse
    {
        $this->authorize('delete', [$attachment, $project]);

        Storage::disk('external')->delete(ltrim(str_replace('/imagenes/', '', $attachment->path), '/'));
        Storage::disk('external')->delete(ltrim(str_replace('/imagenes/', '', $attachment->thumb), '/'));

        $attachment->delete();

        AttachmentDeleted::dispatch($task, $attachment->id);

        return response()->json();
    }
}
