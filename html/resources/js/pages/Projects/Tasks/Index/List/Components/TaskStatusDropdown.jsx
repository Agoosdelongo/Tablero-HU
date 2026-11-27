import { Select } from '@mantine/core';
import { usePage } from '@inertiajs/react';
import { getGroupSelectColorName } from '@/utils/taskGroupColors';

import useTaskGroupsStore from '@/hooks/store/useTaskGroupsStore';
import useTasksStore from '@/hooks/store/useTasksStore';

// Selector de estado de la tarea en la vista Lista (habilitado para admin y developer).
export default function TaskStatusDropdown({ task }) {
  const { auth: { user } } = usePage().props;
  const isAdmin = Boolean(user?.is_admin || user?.is_super_admin);
  const isDev = Boolean(user?.roles?.includes('developer') || user?.roles?.includes('manager'));
  const canChangeStatus = isAdmin || isDev || can('edit task');
  const { groups } = useTaskGroupsStore();
  const { updateTaskProperty } = useTasksStore();

  const currentGroup = groups.find(g => Number(g.id) === Number(task.group_id));
  const currentColor = getGroupSelectColorName(currentGroup);

  if (!canChangeStatus) {
    return (
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: `var(--mantine-color-${currentColor}-1)`,
          color: `var(--mantine-color-${currentColor}-8)`,
          fontWeight: 600,
          fontSize: '12px',
          padding: '5px 10px',
          borderRadius: '4px',
          textTransform: 'uppercase',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {currentGroup?.name ?? 'Sin estado'}
      </div>
    );
  }

  return (
    <div onClick={e => e.stopPropagation()}>
      <Select
        value={String(task.group_id)}
        data={groups.map(group => ({
          value: String(group.id),
          label: group.name,
        }))}
        allowDeselect={false}
        searchable={false}
        disabled={!canChangeStatus}
        size="xs"
        radius="sm"
        variant="filled"
        onChange={value => {
          if (!canChangeStatus) return;
          const group = groups.find(g => g.id === Number(value));
          if (!group) return;

          updateTaskProperty(task, 'group_id', group.id, group);
        }}
        styles={{
          input: {
            backgroundColor: `var(--mantine-color-${currentColor}-1)`,
            color: `var(--mantine-color-${currentColor}-8)`,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            textTransform: 'uppercase',
          },
        }}
      />
    </div>
  );
}