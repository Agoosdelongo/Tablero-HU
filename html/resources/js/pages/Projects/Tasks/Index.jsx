import { EmptyResult } from '@/components/EmptyResult';
import useTaskFiltersStore from '@/hooks/store/useTaskFiltersStore';
import useTaskGroupsStore from '@/hooks/store/useTaskGroupsStore';
import useTasksStore from '@/hooks/store/useTasksStore';
import usePreferences from '@/hooks/usePreferences';
import useWebSockets from '@/hooks/useWebSockets';
import Layout from '@/layouts/MainLayout';
import { usePage } from '@inertiajs/react';
import { Grid } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { CreateTaskDrawer } from './Drawers/CreateTaskDrawer';
import { EditTaskDrawer } from './Drawers/EditTaskDrawer';
import ArchivedItems from './Index/Archive/ArchivedItems';
import FiltersDrawer from './Index/FiltersDrawer';
import Header from './Index/Header';
import BoardView from './Index/BoardView';
import ListView from './Index/ListView';
import BulkActionsBar from './Index/BulkActionsBar';

let currentProject = null;

const TASK_STATUS_NOTICE_COPY = {
  missing: {
    title: 'Actividad no encontrada',
    subtitle: 'La actividad a la que intentas acceder ya no existe. Es posible que haya sido eliminada.',
  },
  archived: {
    title: 'Actividad archivada',
    subtitle: 'Esta actividad fue archivada.',
  },
};

const TasksIndex = () => {
  const { project, taskGroups, groupedTasks, openedTask, taskStatusNotice } = usePage().props;
  currentProject = project;

  const { groups, setGroups, reorderGroup } = useTaskGroupsStore();
  const { tasks, setTasks, addTask, reorderTask, moveTask, clearTaskSelection } = useTasksStore();
  const { hasFilters } = useTaskFiltersStore();
  const { initProjectWebSocket } = useWebSockets();
  const { tasksView } = usePreferences();

  const usingFilters = hasFilters();
  const isArchived = !!route().params.archived;
    const boardRef = useRef(null);
  const [boardPinned, setBoardPinned] = useState(false);

  useEffect(() => {
    if (tasksView !== 'kanban' || isArchived) return;

    const check = () => {
      const el = boardRef.current;
      if (!el) return;
      const viewportHeight = document.documentElement.clientHeight;
      // El tablero está "fijado" cuando su borde inferior ya entra en la pantalla
      const pinned = el.getBoundingClientRect().bottom <= viewportHeight + 2;
      setBoardPinned(prev => (prev === pinned ? prev : pinned));
    };

    check();
    // capture: true detecta el scroll aunque lo haga un contenedor del layout y no la ventana
    document.addEventListener('scroll', check, { passive: true, capture: true });
    window.addEventListener('resize', check);

    return () => {
      document.removeEventListener('scroll', check, { capture: true });
      window.removeEventListener('resize', check);
    };
  }, [tasksView, isArchived]);
  useEffect(() => {
    clearTaskSelection();
  }, [isArchived]);

  useEffect(() => {
    // Si la tarea abierta está eliminada o archivada, no hay tablero real para
    // este request (el backend no lo armó): no tocamos los stores y dejamos
    // que se muestre el cartel de abajo en su lugar.
    if (taskStatusNotice) return;

    setGroups(taskGroups);
    setTasks(groupedTasks);
    // ACTUALIZADO: Pasar grupos al store de tareas también
    if (openedTask) addTask(openedTask);
  }, [taskGroups, groupedTasks, taskStatusNotice]);

  useEffect(() => {
    return initProjectWebSocket(project);
  }, []);

  // ACTUALIZADO: Agregar lógica para pasar nombre de grupo al mover
  const onDragEnd = ({ source, destination }) => {
    if (!destination) {
      return;
    }
    if (source.droppableId.includes('tasks') && destination.droppableId.includes('tasks')) {
      if (source.droppableId === destination.droppableId) {
        reorderTask(source, destination);
      } else {
        // Obtener nombre del grupo destino
        const destGroupId = +destination.droppableId.split("-")[1];
        const destGroup = groups.find(g => g.id === destGroupId);
        moveTask(source, destination, destGroup?.name);
      }
    } else {
      reorderGroup(source.index, destination.index);
    }
  };

  if (taskStatusNotice) {
    const notice = TASK_STATUS_NOTICE_COPY[taskStatusNotice];

    return (
      <EmptyResult
        title={notice.title}
        subtitle={notice.subtitle}
      />
    );
  }

  return (
    <>
      <Header />

      {can('create task') && <CreateTaskDrawer />}
      <EditTaskDrawer />

      <BulkActionsBar />

      <Grid
        ref={boardRef}
        columns={12}
        gutter={50}
        mt='xl'
        className={
          !route().params.archived
            ? `${tasksView}-view${boardPinned ? ' board-pinned' : ''}`
            : undefined
      }
      >
        {!route().params.archived ? (
          <Grid.Col span={12}>
            {groups.length ? (
              <>
                {tasksView === 'kanban' ? (
                  <BoardView
                    groups={groups}
                    tasks={tasks}
                    usingFilters={usingFilters}
                    onDragEnd={onDragEnd}
                    tasksView={tasksView}
                  />
                ) : (
                  <ListView
                    groups={groups}
                    tasks={tasks}
                    usingFilters={usingFilters}
                  />
                )}
              </>
            ) : (
              <EmptyResult
                title='No tasks found'
                subtitle='or none match your search criteria'
              />
            )}
          </Grid.Col>
        ) : (
          <Grid.Col span={12}>
            <ArchivedItems
              groups={groups}
              tasks={tasks}
            />
          </Grid.Col>
        )}
        <FiltersDrawer />
      </Grid>
    </>
  );
};

TasksIndex.layout = page => <Layout title={currentProject?.name}>{page}</Layout>;

export default TasksIndex;