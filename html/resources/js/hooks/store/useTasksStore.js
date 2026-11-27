import createTaskAttachmentsSlice from '@/hooks/store/tasks/TaskAttachmentsSlice';
import createTaskCommentsSlice from '@/hooks/store/tasks/TaskCommentsSlice';
import createTaskWebSocketUpdatesSlice from '@/hooks/store/tasks/TaskWebSocketUpdatesSlice';
import { move, reorder } from '@/utils/reorder';
import axios from 'axios';
import { produce } from "immer";
import { create } from 'zustand';

const useTasksStore = create((set, get) => ({
  ...createTaskAttachmentsSlice(set, get),
  ...createTaskCommentsSlice(set, get),
  ...createTaskWebSocketUpdatesSlice(set, get),

  tasks: {},
  selectedTaskIds: [],

  toggleTaskSelection: (taskId) => {
    return set(produce(state => {
      const index = state.selectedTaskIds.indexOf(taskId);

      if (index === -1) {
        state.selectedTaskIds.push(taskId);
      } else {
        state.selectedTaskIds.splice(index, 1);
      }
    }));
  },

  clearTaskSelection: () => {
    return set(produce(state => {
      state.selectedTaskIds = [];
    }));
  },

  isTaskSelected: (taskId) => {
    return get().selectedTaskIds.includes(taskId);
  },

  selectAllTasks: (allTasks = []) => {
    // Si recibe allTasks, usarlos
    if (allTasks.length > 0) {
      const ids = allTasks.map(task => task.id);
      return set({
        selectedTaskIds: ids,
      });
    }

    // Si no recibe allTasks, calcular desde el store (comportamiento antiguo)
    const ids = [];
    Object.values(get().tasks).forEach(group => {
      group.forEach(task => ids.push(task.id));
    });

    return set({
      selectedTaskIds: ids,
    });
  },

  archiveSelectedTasks: async (projectId) => {
    const selectedTaskIds = get().selectedTaskIds;
    
    if (selectedTaskIds.length === 0) {
      return;
    }
  
    try {
      await axios.post(
        route("projects.tasks.bulk-archive", projectId),
        { ids: selectedTaskIds },
        { progress: false }
      );
  
      // Remover las tareas archivadas del store
      return set(produce(state => {
        Object.keys(state.tasks).forEach(groupId => {
          state.tasks[groupId] = state.tasks[groupId].filter(
            task => !selectedTaskIds.includes(task.id)
          );
        });
        state.selectedTaskIds = [];
      }));
    } catch (e) {
      console.error('Archive error:', e);
      console.error('Error response:', e.response?.data);
      
      throw e;
    }
  },
  setTasks: (tasks) => set(() => ({ tasks: { ...tasks } })),
  addTask: (task) => {
    return set(produce(state => {
      const index = state.tasks[task.group_id].findIndex((i) => i.id === task.id);

      if (index === -1) {
        state.tasks[task.group_id] = [...state.tasks[task.group_id], task];
      }
    }));
  },
  findTask: (id) => {
    if (!id) return null;
    const numericId = Number(id);
    for (const groupId in get().tasks) {
      const groupTasks = get().tasks[groupId] || [];
      for (const task of groupTasks) {
        if (Number(task.id) === numericId) {
          return task;
        }
        if (Array.isArray(task.children)) {
          const subtask = task.children.find((c) => Number(c.id) === numericId);
          if (subtask) {
            return subtask;
          }
        }
      }
    }
    return null;
  },
  updateTaskProperty: async (task, property, value, options = null) => {
    try {
      await axios
        .put(
          route("projects.tasks.update", [task.project_id, task.id]),
          { [property]: value },
          { progress: false },
        );

      return set(produce(state => {
        const index = state.tasks[task.group_id].findIndex((i) => i.id === task.id);

        if (property === 'group_id' && Number(task.group_id) !== Number(value)) {
          const targetGroupId = Number(value);
          const isCompletedGroup = options?.name === 'Finalizado';
          const result = move(state.tasks, task.group_id, targetGroupId, index, 0);

          state.tasks[task.group_id] = result[task.group_id];
          state.tasks[targetGroupId] = result[targetGroupId];

          state.tasks[targetGroupId][0][property] = targetGroupId;
          state.tasks[targetGroupId][0].completed_at = isCompletedGroup ? new Date().toISOString() : null;
        } else {
            state.tasks[task.group_id][index][property] = value;

            // Actualizar objeto relacionado si es un _id field
            if (property.endsWith('_id')) {
                const relatedProperty = property.replace('_id', '');
                state.tasks[task.group_id][index][relatedProperty] = options;
            }

            // Mantener lista de personas asignadas sincronizada con assigned_to_user
            if (property === 'assigned_user_ids') {
                const assignedList = options ?? [];
                state.tasks[task.group_id][index].assignees = assignedList;
                state.tasks[task.group_id][index].assigned_to_user_id = assignedList[0]?.id ?? null;
                state.tasks[task.group_id][index].assigned_to_user = assignedList[0] ?? null;
            }

            // Mantener objetos completos para labels y suscriptores
            if (property === 'labels' || property === 'subscribed_users') {
                state.tasks[task.group_id][index][property] = options ?? [];
            }
        }
      }));
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || "Failed to save task property change");
    }
  },

  complete: (task, checked) => {
    const newState = checked ? true : null;
    const index = get().tasks[task.group_id].findIndex((i) => i.id === task.id);

    axios
      .post(route("projects.tasks.complete", [task.project_id, task.id]), { completed: checked })
      .catch(() => alert("Failed to save task completed action"));

    return set(produce(state => {
      state.tasks[task.group_id][index].completed_at = newState
    }));
  },
  reorderTask: (source, destination) => {
    const sourceGroupId = +source.droppableId.split("-")[1];

    const result = reorder(get().tasks[sourceGroupId], source.index, destination.index);

    const data = {
      ids: result.map((i) => i.id),
      group_id: sourceGroupId,
      from_index: source.index,
      to_index: destination.index,
    };

    axios
      .post(route("projects.tasks.reorder", [route().params.project]), data, { progress: false })
      .catch(() => alert("Failed to save task reorder action"));

    return set(produce(state => { state.tasks[sourceGroupId] = result }));
  },
  moveTask: (source, destination, destGroupName = null) => {
    const sourceGroupId = +source.droppableId.split("-")[1];
    const destinationGroupId = +destination.droppableId.split("-")[1];
    const isCompletedGroup = destGroupName === 'Finalizado';

    const result = move(get().tasks, sourceGroupId, destinationGroupId, source.index, destination.index);

    const data = {
      ids: result[destinationGroupId].map((i) => i.id),
      from_group_id: sourceGroupId,
      to_group_id: destinationGroupId,
      from_index: source.index,
      to_index: destination.index,
    };

    axios
      .post(route("projects.tasks.move", [route().params.project]), data, { progress: false })
      .catch((e) => alert(e.response?.data?.message || "Failed to save task move action"));

    return set(produce(state => {
      state.tasks[sourceGroupId] = result[sourceGroupId];
      state.tasks[destinationGroupId] = result[destinationGroupId].map((t, idx) =>
        idx === destination.index
          ? {
              ...t,
              group_id: destinationGroupId,
              completed_at: isCompletedGroup ? (t.completed_at || new Date().toISOString()) : null,
            }
          : t
      );
    }));
  },
  reparentTask: ({ taskId, newParentId, groupId, ids }) => {
    const data = {
      task_id: taskId,
      parent_task_id: newParentId,
      ids,
    };

    axios
      .post(route("projects.tasks.reparent", [route().params.project]), data, { progress: false })
      .catch(() => alert("Failed to save task move action"));

    return set(produce(state => {
      const index = state.tasks[groupId].findIndex((i) => i.id === taskId);

      if (index !== -1) {
        state.tasks[groupId][index].parent_task_id = newParentId;
      }
    }));
  },
}));

export default useTasksStore;