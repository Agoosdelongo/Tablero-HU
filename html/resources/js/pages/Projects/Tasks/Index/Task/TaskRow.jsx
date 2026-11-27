import { Label } from "@/components/Label";
import useTaskDrawerStore from "@/hooks/store/useTaskDrawerStore";
import useTasksStore from "@/hooks/store/useTasksStore";
import { isOverdue } from "@/utils/task";
import { shortName } from "@/utils/user";
import { createPortal } from "react-dom";
import { Draggable } from "@hello-pangea/dnd";
import { Link, usePage } from "@inertiajs/react";
import { Checkbox, Flex, Group, Pill, Text, Tooltip, rem } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import TaskActions from "../TaskActions";
import classes from "./css/TaskRow.module.css";

export default function TaskRow({ task, index }) {
  const { auth: { user } } = usePage().props;
  const isAdmin = Boolean(user?.is_admin || user?.is_super_admin);
  const isDev = Boolean(user?.roles?.includes('developer') || user?.roles?.includes('manager'));
  const canDrag = (isAdmin || isDev) && can("reorder task");
  const canDragStatus = canDrag || can("reorder task");
  const { complete } = useTasksStore();
  const { openEditTask } = useTaskDrawerStore();
  return (
    <Draggable draggableId={"task-" + task.id} index={index} isDragDisabled={!canDragStatus}>
      {(provided, snapshot) => {
        const rowNode = (
          <Flex
            {...provided.draggableProps}
            ref={provided.innerRef}
            className={`${classes.task} ${snapshot.isDragging ? classes.itemDragging : ''} ${
              task.completed_at !== null && classes.completed
            }`}
            wrap="nowrap"
            style={provided.draggableProps.style}
          >
            {task.priority && (
              <Tooltip label={task.priority.label + " priority"} withArrow openDelay={300}>
                <div
                  className={classes.priorityIndicator}
                  style={{ backgroundColor: task.priority.color }}
                />
              </Tooltip>
            )}

            <Group gap="sm" wrap="nowrap" w="100%">
              <div {...(canDragStatus ? provided.dragHandleProps : {})}>
                <IconGripVertical
                  style={{
                    width: rem(18),
                    height: rem(18),
                    display: canDragStatus && !route().params.archived ? "inline" : "none",
                  }}
                  stroke={1.5}
                  className={classes.dragHandle}
                />
              </div>

              <Checkbox
                size="sm"
                radius="xl"
                color="green"
                checked={task.completed_at !== null}
                disabled={!isAdmin}
                onChange={(e) => isAdmin && complete(task, e.currentTarget.checked)}
                className={isAdmin && can("complete task") ? classes.checkbox : classes.disabledCheckbox}
                style={!isAdmin ? { pointerEvents: "none", opacity: 0.6 } : undefined}
              />

              {task.assigned_to_user && (
                isAdmin ? (
                  <Link href={route("users.edit", task.assigned_to_user.id)}>
                    <Tooltip label={task.assigned_to_user.name} openDelay={1000} withArrow>
                      <Pill size="sm" className={classes.user}>
                        {shortName(task.assigned_to_user.name)}
                      </Pill>
                    </Tooltip>
                  </Link>
                ) : (
                  <Tooltip label={task.assigned_to_user.name} openDelay={1000} withArrow>
                    <Pill size="sm" className={classes.user}>
                      {shortName(task.assigned_to_user.name)}
                    </Pill>
                  </Tooltip>
                )
              )}

              <Text
                className={classes.name}
                size="sm"
                fw={500}
                truncate="end"
                c={isOverdue(task) && task.completed_at === null ? "red.7" : ""}
                onClick={() => openEditTask(task)}
              >
                #{task.number + ": " + task.name}
              </Text>

              <Group wrap="nowrap" style={{ rowGap: rem(3), columnGap: rem(12) }}>
                {task.labels.map((label) => (
                  <Label key={label.id} name={label.name} color={label.color} />
                ))}
              </Group>

              {isAdmin && (can("archive task") || can("restore task")) && (
                <TaskActions task={task} className={classes.actions} />
              )}
            </Group>
          </Flex>
        );

        return snapshot.isDragging ? createPortal(rowNode, document.body) : rowNode;
      }}
    </Draggable>
  );
}
