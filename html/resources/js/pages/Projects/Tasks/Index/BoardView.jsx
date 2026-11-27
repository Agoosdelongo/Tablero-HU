import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { usePage } from '@inertiajs/react';
import { Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

import TaskGroup from './TaskGroup';
import CreateTasksGroupModal from './Modals/CreateTasksGroupModal';

import classes from '../css/Index.module.css';

const BoardView = ({ groups, tasks, usingFilters, onDragEnd, tasksView }) => {
  const { auth: { user } } = usePage().props;
  const isAdmin = Boolean(user?.is_admin || user?.is_super_admin);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable
        droppableId='groups'
        direction={tasksView === 'list' ? 'vertical' : 'horizontal'}
        type='group'
      >
        {provided => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
          >
            <div className={classes.viewport}>
              {groups
                .filter(group => !usingFilters || (usingFilters && (tasks[group.id] || []).filter(t => !t.parent_task_id).length > 0))
                .map((group, index) => (
                  <TaskGroup
                    key={group.id}
                    index={index}
                    group={group}
                    tasks={(tasks[group.id] || []).filter(task => !task.parent_task_id)}
                  />
                ))}
              {provided.placeholder}
              {!route().params.archived && isAdmin && can('create task group') && (
                <Button
                  leftSection={<IconPlus size={14} />}
                  variant='transparent'
                  size='sm'
                  mt={14}
                  m={4}
                  radius='xl'
                  onClick={CreateTasksGroupModal}
                  style={{ width: '200px' }}
                >
                  Add {tasksView === 'list' ? 'tasks group' : 'group'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

export default BoardView;
