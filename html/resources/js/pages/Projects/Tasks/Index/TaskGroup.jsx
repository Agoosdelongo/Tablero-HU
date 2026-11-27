import useTaskDrawerStore from "@/hooks/store/useTaskDrawerStore";
import { usePage } from "@inertiajs/react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { ActionIcon, Flex, Group, Text, Tooltip, rem } from "@mantine/core";
import { IconGripVertical, IconPlus } from "@tabler/icons-react";
import Task from "./Task";
import TaskGroupActions from "./TaskGroupActions";
import classes from "./css/TaskGroup.module.css";
import translateGroupName from "@/utils/translateGroupName";

export default function TaskGroup({ group, tasks, ...props }) {
  const { openCreateTask } = useTaskDrawerStore();
  const { auth: { user } } = usePage().props;
  const isAdmin = Boolean(user?.is_admin || user?.is_super_admin);
  const isDev = Boolean(user?.roles?.includes('developer') || user?.roles?.includes('manager'));
  const canCreateTask = (isAdmin || isDev) && can("create task");

  return (
    <Draggable draggableId={group.id.toString()} isDragDisabled={!isAdmin} {...props}>
      {(provided, snapshot) => (
        <div
          className={`${classes.row} ${snapshot.isDragging && classes.itemDragging}`}
          ref={provided.innerRef}
          {...provided.draggableProps}
        >
          <div className={classes.group}
           style={group.color ? { backgroundColor: group.color } : undefined}>
            <Group>
              <div {...(isAdmin ? provided.dragHandleProps : {})} className={classes.dragHandle}>
                <IconGripVertical
                  style={{
                    width: rem(18),
                    height: rem(18),
                    display:
                      isAdmin && can("reorder task group") && !route().params.archived ? "inline" : "none",
                  }}
                  stroke={1.5}
                />
              </div>
              <Text size="xl" fw={700}>
                {translateGroupName(group.name)}
              </Text>
              {isAdmin && <TaskGroupActions group={group} className={classes.actions} />}
            </Group>
            {!route().params.archived && canCreateTask && (
              <Tooltip label="Add task" openDelay={1000} withArrow>
                <ActionIcon
                  variant="filled"
                  size="md"
                  radius="xl"
                  onClick={() => openCreateTask(group.id)}
                >
                  <IconPlus style={{ width: rem(18), height: rem(18) }} stroke={2} />
                </ActionIcon>
              </Tooltip>
            )}
          </div>
          <Droppable droppableId={`group-${group.id}-tasks`} type="task">
            {(provided, snapshot) => (
              <Flex
                direction="column"
                gap="3px"
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={snapshot.isDraggingOver ? "isDraggingOver" : ""}
              >
                {tasks.map((task, index) => (
                  <Task key={task.id} task={task} index={index} />
                ))}
                <div className={classes.placeholder}>{provided.placeholder}</div>
              </Flex>
            )}
          </Droppable>
        </div>
      )}
    </Draggable>
  );
}
