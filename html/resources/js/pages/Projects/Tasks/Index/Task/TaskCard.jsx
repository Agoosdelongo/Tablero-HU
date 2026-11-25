import { Label } from '@/components/Label';
import useTaskDrawerStore from '@/hooks/store/useTaskDrawerStore';
import useTasksStore from '@/hooks/store/useTasksStore';
import { isOverdue, isDueSoon } from '@/utils/task';
import dayjs from 'dayjs';
import { getInitials } from '@/utils/user';
import { Draggable } from '@hello-pangea/dnd';
import { Link } from '@inertiajs/react';
import {
  ActionIcon,
  Avatar,
  Button,
  Checkbox,
  Group,
  Menu,
  Text,
  Tooltip,
  rem,
  useComputedColorScheme,
} from '@mantine/core';
import TaskActions from '../TaskActions';
import classes from './css/TaskCard.module.css';
import { IconChevronDown, IconCornerDownRight, IconPlus } from '@tabler/icons-react';

export default function TaskCard({ task, index }) {
  const { openEditTask, openCreateTask } = useTaskDrawerStore();
  const { findTask, complete } = useTasksStore();
  const computedColorScheme = useComputedColorScheme();

  const subtasks = (task.children || []).map(c => findTask(c.id) || c);
  const subtasksCount = subtasks.length;
  const completedCount = subtasks.filter(c => c.completed_at !== null).length;
  return (
    <Draggable
      draggableId={'task-' + task.id}
      index={index}
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
          <div {...(can('reorder task') && provided.dragHandleProps)}>
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

            {subtasksCount > 0 && (
              <Group
                mt={5}
                mb={2}
                onClick={e => e.stopPropagation()}
              >
                <Menu
                  shadow='md'
                  width={280}
                  position='bottom-start'
                  withinPortal
                >
                  <Menu.Target>
                    <Button
                      variant='subtle'
                      color='gray'
                      size='compact-xs'
                      leftSection={<IconCornerDownRight size={13} stroke={2} />}
                      rightSection={<IconChevronDown size={11} />}
                      onClick={e => e.stopPropagation()}
                      styles={{
                        root: {
                          paddingLeft: 6,
                          paddingRight: 6,
                          height: 22,
                          fontWeight: 600,
                          fontSize: 11,
                          backgroundColor:
                            computedColorScheme === 'dark'
                              ? 'var(--mantine-color-dark-5)'
                              : 'var(--mantine-color-gray-1)',
                          borderRadius: 4,
                        },
                      }}
                    >
                      {completedCount > 0 ? `${completedCount}/${subtasksCount}` : subtasksCount}{' '}
                      {subtasksCount === 1 ? 'subtarea' : 'subtareas'}
                    </Button>
                  </Menu.Target>

                  <Menu.Dropdown onClick={e => e.stopPropagation()}>
                    <Menu.Label>
                      Subtareas ({completedCount}/{subtasksCount} completadas)
                    </Menu.Label>
                    {subtasks.map(subtask => (
                      <Menu.Item
                        key={subtask.id}
                        onClick={() => openEditTask(subtask)}
                        leftSection={
                          <Checkbox
                            size='xs'
                            radius='xl'
                            color='green'
                            checked={subtask.completed_at !== null}
                            onChange={e => {
                              e.stopPropagation();
                              complete(subtask, e.currentTarget.checked);
                            }}
                            onClick={e => e.stopPropagation()}
                          />
                        }
                      >
                        <Text
                          size='xs'
                          truncate='end'
                          style={{
                            textDecoration: subtask.completed_at ? 'line-through' : 'none',
                            opacity: subtask.completed_at ? 0.6 : 1,
                          }}
                        >
                          #{subtask.number}: {subtask.name}
                        </Text>
                      </Menu.Item>
                    ))}
                    <Menu.Divider />
                    {task.issue_type !== 'Subtarea' && (
                      <Menu.Item
                        leftSection={<IconPlus size={14} />}
                        onClick={() =>
                          openCreateTask({
                            group_id: task.group_id,
                            parent_task_id: task.id,
                            parent_issue_type: task.issue_type,
                          })
                        }
                      >
                        <Text size='xs' fw={500}>
                          Nueva subtarea
                        </Text>
                      </Menu.Item>
                    )}
                  </Menu.Dropdown>
                </Menu>
              </Group>
            )}

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
              {task.assigned_to_user && (
                <Tooltip
                  label={task.assigned_to_user.name}
                  openDelay={1000}
                  withArrow
                >
                  <Link
                    href={route('users.edit', task.assigned_to_user.id)}
                    style={{ textDecoration: 'none' }}
                  >
                    <Avatar
                      src={task.assigned_to_user.avatar}
                      radius='xl'
                      size={20}
                      color={computedColorScheme === 'light' ? 'white' : 'blue'}
                    >
                      {getInitials(task.assigned_to_user.name)}
                    </Avatar>
                  </Link>
                </Tooltip>
              )}
              {task.issue_type !== 'Subtarea' && (
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
              {(can('archive task') || can('restore task')) && (
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