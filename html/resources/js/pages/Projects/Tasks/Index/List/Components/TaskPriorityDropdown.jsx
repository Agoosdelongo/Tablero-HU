import { Select } from '@mantine/core';
import { usePage } from '@inertiajs/react';

import useTasksStore from '@/hooks/store/useTasksStore';

// Selector de prioridad de la tarea en la vista Lista (solo editable por admin).
export default function TaskPriorityDropdown({ task }) {
  const { priorities, auth: { user } } = usePage().props;
  const isAdmin = Boolean(user?.is_admin || user?.is_super_admin);
  const { updateTaskProperty } = useTasksStore();

  const currentPriority = priorities.find(
    p => p.id === task.priority_id
  );

  const currentColor =
    currentPriority?.label === 'Alta'
      ? 'red'
      : currentPriority?.label === 'Media'
        ? 'yellow'
        : currentPriority?.label === 'Baja'
          ? 'green'
          : 'gray';

  return (
    <div onClick={e => e.stopPropagation()}>
      <Select
        value={task.priority_id ? String(task.priority_id) : ''}
        data={[
          {
            value: '',
            label: 'Sin prioridad',
          },
          ...priorities.map(priority => ({
            value: String(priority.id),
            label: priority.label,
          })),
        ]}
        allowDeselect={isAdmin}
        searchable={false}
        disabled={!isAdmin}
        size="xs"
        radius="sm"
        variant="filled"
        onChange={value => {
          if (!isAdmin) return;
          const priority =
            priorities.find(p => p.id === Number(value)) ?? null;

          updateTaskProperty(
            task,
            'priority_id',
            priority?.id ?? null,
            priority
          );
        }}
        styles={{
          input: {
            backgroundColor: `var(--mantine-color-${currentColor}-1)`,
            color: `var(--mantine-color-${currentColor}-8)`,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          },
        }}
      />
    </div>
  );
}