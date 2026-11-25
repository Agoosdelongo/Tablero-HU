import { Label } from '@/components/Label';
import useTaskDrawerStore from '@/hooks/store/useTaskDrawerStore';
import { isOverdue, isDueSoon } from '@/utils/task';
import dayjs from 'dayjs';
import { getInitials } from '@/utils/user';
import { Draggable } from '@hello-pangea/dnd';
import { Link, usePage } from '@inertiajs/react';
import { Avatar, Group, Text, Tooltip, rem, useComputedColorScheme } from '@mantine/core';
import TaskActions from '../TaskActions';
import classes from './css/TaskCard.module.css';
import { ActionIcon } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

export default function TaskCard({ task, index }) {
  const { openEditTask, openCreateTask } = useTaskDrawerStore();
  const { auth: { user } } = usePage().props;
  const isAdmin = Boolean(user?.is_admin || user?.is_super_admin);
  const computedColorScheme = useComputedColorScheme();
  console.log(task);
  return (
    <Draggable
      draggableId={'task-' + task.id}
      index={index}
      isDragDisabled={!isAdmin}
    >
      {(provided, snapshot) => (
        <div
          {...provided.draggableProps}
          ref={provided.innerRef}
           className={`${classes.task} ${snapshot.isDragging && classes.itemDragging}`}
        >
          {task.priority && (
            <Tooltip
              label={task.priority.label + ' priority'}
              withArrow
              openDelay={300}
            >
              <div
                className={classes.priorityIndicator}
                style={{ backgroundColor: task.priority.color }}
              />
            </Tooltip>
          )}
          <div {...(isAdmin && can('reorder task') ? provided.dragHandleProps : {})}>
            <Group
              wrap='nowrap'
              justify='start'
              align='start'
              gap='xs'
            >
              <Text
                className={classes.name}
                size='xs'
                fw={500}
                c={
                  task.completed_at === null
                    ? isOverdue(task)
                      ? 'red.7'
                      : isDueSoon(task)
                      ? 'yellow.7'
                      : ''
                    : ''
                }
                onClick={() => openEditTask(task)}
              >
                #{task.number + ': ' + task.name}
              </Text>
            </Group>

            <Group
              wrap='nowrap'
              justify='space-between'
            >
              <Group
                wrap='wrap'
                style={{ rowGap: rem(3), columnGap: rem(12) }}
                mt={5}
              >
                {task.labels.map(label => (
                  <Label
                    key={label.id}
                    name={label.name}
                    color={label.color}
                    size={9}
                    dot={false}
                  />
                ))}
              </Group>
              {(() => {
                const assignedUsers =
                  Array.isArray(task.assignees) && task.assignees.length > 0
                    ? task.assignees
                    : task.assigned_to_user
                      ? [task.assigned_to_user]
                      : [];

                if (!assignedUsers.length) return null;

                return (
                  <Avatar.Group spacing='xs'>
                    {assignedUsers.slice(0, 3).map(assigned => (
                      <Tooltip
                        key={assigned.id}
                        label={assigned.name}
                        openDelay={400}
                        withArrow
                      >
                        <Avatar
                          src={assigned.avatar}
                          radius='xl'
                          size={20}
                          color={computedColorScheme === 'light' ? 'white' : 'blue'}
                        >
                          {getInitials(assigned.name)}
                        </Avatar>
                      </Tooltip>
                    ))}
                    {assignedUsers.length > 3 && (
                      <Tooltip
                        label={assignedUsers.slice(3).map(u => u.name).join(', ')}
                        openDelay={400}
                        withArrow
                      >
                        <Avatar radius='xl' size={20}>
                          +{assignedUsers.length - 3}
                        </Avatar>
                      </Tooltip>
                    )}
                  </Avatar.Group>
                );
              })()}
              {isAdmin && task.issue_type !== 'Subtarea' && (
                <ActionIcon
                  variant='subtle'
                  size='sm'
                  onClick={event => {
                    event.stopPropagation();

                    openCreateTask({
                      group_id: task.group_id,
                      parent_task_id: task.id,
                      parent_issue_type: task.issue_type,
                    });
                  }}
                >
                  <IconPlus size={16} />
                </ActionIcon>
              )}{' '}
              {isAdmin && (can('archive task') || can('restore task')) && (
                <TaskActions
                  task={task}
                  className={classes.actions}
                />
              )}
            </Group>
          </div>
        </div>
      )}
    </Draggable>
  );
}