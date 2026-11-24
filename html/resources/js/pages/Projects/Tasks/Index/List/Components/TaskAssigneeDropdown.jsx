import { useMemo } from 'react';
import { Avatar, Group, MultiSelect, Text, Tooltip } from '@mantine/core';
import { usePage } from '@inertiajs/react';

import useTasksStore from '@/hooks/store/useTasksStore';

// Muestra o permite asignar múltiples personas a una tarea en la vista Lista.
export default function TaskAssigneeDropdown({ task, users }) {
  const { updateTaskProperty } = useTasksStore();
  const { auth: { user } } = usePage().props;
  const isAdmin = Boolean(user?.is_admin || user?.is_super_admin);

  const assignedUsers = useMemo(() => {
    if (Array.isArray(task.assignees) && task.assignees.length > 0) {
      return task.assignees;
    }
    return task.assigned_to_user ? [task.assigned_to_user] : [];
  }, [task.assignees, task.assigned_to_user]);

  const selectedValues = useMemo(
    () => assignedUsers.map(u => String(u.id)),
    [assignedUsers]
  );

  const options = useMemo(
    () =>
      users.map(u => ({
        value: String(u.id),
        label: u.name,
        user: u,
      })),
    [users]
  );

  if (!isAdmin) {
    if (assignedUsers.length === 0) {
      return (
        <Text size="xs" c="dimmed">
          Sin asignar
        </Text>
      );
    }

    return (
      <Tooltip label={assignedUsers.map(u => u.name).join(', ')} withArrow>
        <Group gap={6} wrap="nowrap">
          <Avatar.Group spacing="xs">
            {assignedUsers.slice(0, 3).map(u => (
              <Avatar key={u.id} src={u.avatar} size={22} radius="xl">
                {u.name?.[0]}
              </Avatar>
            ))}
            {assignedUsers.length > 3 && (
              <Avatar size={22} radius="xl">
                +{assignedUsers.length - 3}
              </Avatar>
            )}
          </Avatar.Group>
          <Text size="xs" lineClamp={1}>
            {assignedUsers.map(u => u.name).join(', ')}
          </Text>
        </Group>
      </Tooltip>
    );
  }

  return (
    <div onClick={e => e.stopPropagation()}>
      <MultiSelect
        value={selectedValues}
        data={options}
        searchable
        placeholder="Asignar personas..."
        size="xs"
        variant="filled"
        maxDropdownHeight={220}
        onChange={values => {
          const selected = values
            .map(val => users.find(u => u.id === Number(val)))
            .filter(Boolean);

          updateTaskProperty(
            task,
            'assigned_user_ids',
            selected.map(u => u.id),
            selected
          );
        }}
      />
    </div>
  );
}
