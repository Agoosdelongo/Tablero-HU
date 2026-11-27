import { Tooltip } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { usePage } from '@inertiajs/react';
import dayjs from 'dayjs';

import useTasksStore from '@/hooks/store/useTasksStore';

// Selector de fecha de finalización habilitado para el admin o el usuario asignado.
export default function TaskDueDateDropdown({ task }) {
    const { updateTaskProperty } = useTasksStore();
    const { auth: { user } } = usePage().props;

    const assignedIds =
        Array.isArray(task.assignees) && task.assignees.length > 0
            ? task.assignees.map((u) => Number(u.id))
            : task.assigned_to_user_id
                ? [Number(task.assigned_to_user_id)]
                : [];

    const isAdmin = Boolean(user?.is_admin || user?.is_super_admin);
    const canEditDueDate = isAdmin;

    const parseDate = (date) => {
        if (!date) return null;

        const onlyDate = String(date).split('T')[0];

        if (!onlyDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return null;
        }

        const parsed = new Date(`${onlyDate}T12:00:00`);

        return isNaN(parsed.getTime()) ? null : parsed;
    };

    const input = (
        <DateInput
            value={parseDate(task.due_on)}
            valueFormat="DD/MM/YYYY"
            clearable={canEditDueDate}
            readOnly={!canEditDueDate}
            disabled={!canEditDueDate}
            tabIndex={!canEditDueDate ? -1 : undefined}
            styles={!canEditDueDate ? { root: { pointerEvents: 'none' }, input: { cursor: 'not-allowed' } } : undefined}
            size="xs"
            radius="sm"
            variant="filled"
            placeholder="Sin fecha"
            minDate={parseDate(task.start_on) || undefined}
            onChange={(value) => {
                if (!canEditDueDate) return;
                updateTaskProperty(
                    task,
                    'due_on',
                    value ? dayjs(value).format('YYYY-MM-DD') : null
                );
            }}
        />
    );

    return (
        <div onClick={(e) => e.stopPropagation()}>
            {canEditDueDate ? (
                input
            ) : (
                <Tooltip label="Solo el administrador puede modificar la fecha de vencimiento" withArrow>
                    <div>{input}</div>
                </Tooltip>
            )}
        </div>
    );
}
