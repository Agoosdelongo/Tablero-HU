<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Crea la tabla pivote para asignar múltiples personas a una tarea.
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('task_assignees')) {
            Schema::create('task_assignees', function (Blueprint $table) {
                $table->id();
                $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['task_id', 'user_id']);
            });

            // Migrar asignaciones existentes de tasks.assigned_to_user_id a task_assignees
            $existing = DB::table('tasks')
                ->whereNotNull('assigned_to_user_id')
                ->select('id', 'assigned_to_user_id')
                ->get();

            $now = now();
            foreach ($existing as $row) {
                DB::table('task_assignees')->insertOrIgnore([
                    'task_id' => $row->id,
                    'user_id' => $row->assigned_to_user_id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('task_assignees');
    }
};
