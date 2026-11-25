<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Agrega correo de Google Calendar, invitados compartidos y recordatorios en días.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'google_calendar_email')) {
                $table->string('google_calendar_email')->nullable()->after('google_id');
            }
        });

        Schema::table('personal_tasks', function (Blueprint $table) {
            $table->unsignedInteger('reminder_minutes')->nullable()->change();
            if (! Schema::hasColumn('personal_tasks', 'shared_emails')) {
                $table->text('shared_emails')->nullable()->after('reminder_notified_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('personal_tasks', function (Blueprint $table) {
            if (Schema::hasColumn('personal_tasks', 'shared_emails')) {
                $table->dropColumn('shared_emails');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'google_calendar_email')) {
                $table->dropColumn('google_calendar_email');
            }
        });
    }
};
