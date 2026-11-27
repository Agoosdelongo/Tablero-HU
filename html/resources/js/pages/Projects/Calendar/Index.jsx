import { useState } from 'react';
import ProjectTabs from '@/components/ProjectTabs';
import Layout from '@/layouts/MainLayout';
import { router, usePage } from '@inertiajs/react';
import { Title, Modal, Text, Group, Badge, Stack, ScrollArea } from '@mantine/core';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import './css/calendar.css';

let currentProject = null;

const CalendarIndex = () => {
  const { project, tasks } = usePage().props;

  currentProject = project;

  const [modalState, setModalState] = useState({
    opened: false,
    dateStr: '',
    tasks: [],
  });

  const [activeMonth, setActiveMonth] = useState(dayjs().format('YYYY-MM'));

  const todayStr = dayjs().format('YYYY-MM-DD');
  const monthStart = dayjs(`${activeMonth}-01`).startOf('month').format('YYYY-MM-DD');
  const monthEnd = dayjs(`${activeMonth}-01`).endOf('month').format('YYYY-MM-DD');

  const events = tasks
    .flatMap(task => {
      const subtasks = task.subtasks || [];
      const allStartDates = [
        task.start_on ? task.start_on.split('T')[0] : null,
        ...subtasks.map(s => (s.start_on ? s.start_on.split('T')[0] : null)),
      ].filter(Boolean);

      if (allStartDates.length === 0) return [];

      allStartDates.sort();
      const startStr = allStartDates[0];

      const calculateEndDate = item => {
        const itemStart = item.start_on ? item.start_on.split('T')[0] : startStr;
        let end;
        if (item.completed_at) {
          end = item.completed_at.split('T')[0];
        } else if (item.due_on) {
          end = item.due_on.split('T')[0];
        } else {
          end = dayjs(todayStr).isAfter(dayjs(itemStart)) ? todayStr : itemStart;
        }
        if (dayjs(end).isBefore(dayjs(itemStart))) {
          end = itemStart;
        }
        return end;
      };

      const allEndDates = [
        calculateEndDate(task),
        ...subtasks.map(s => calculateEndDate(s)),
      ].filter(Boolean);

      allEndDates.sort();
      let endStr = allEndDates[allEndDates.length - 1];

      if (dayjs(endStr).isBefore(dayjs(startStr))) {
        endStr = startStr;
      }

      // Filtrar y limitar estrictamente al mes activo en pantalla
      // No mostrar en días colgados de meses anteriores o posteriores
      if (dayjs(endStr).isBefore(dayjs(monthStart)) || dayjs(startStr).isAfter(dayjs(monthEnd))) {
        return [];
      }

      const visibleStart = dayjs(startStr).isBefore(dayjs(monthStart)) ? monthStart : startStr;
      const visibleEnd = dayjs(endStr).isAfter(dayjs(monthEnd)) ? monthEnd : endStr;

      // Fragmentar el marcador día por día
      const fragments = [];
      let cur = dayjs(visibleStart);
      const last = dayjs(visibleEnd);

      while (cur.isBefore(last) || cur.isSame(last, 'day')) {
        const dateStr = cur.format('YYYY-MM-DD');
        fragments.push({
          id: `${task.id}-${dateStr}`,
          title: `#${task.number}: ${task.name}`,
          start: dateStr,
          allDay: true,
          backgroundColor: '#003764',
          borderColor: '#003764',
          extendedProps: {
            task,
            rawStart: startStr,
            rawEnd: endStr,
            currentDate: dateStr,
          },
        });
        cur = cur.add(1, 'day');
      }

      return fragments;
    });

  const renderEventContent = (eventInfo) => {
    const task = eventInfo.event.extendedProps?.task;
    const subtasks = task?.subtasks || [];

    return (
      <div className="fc-custom-event-content">
        <div className="fc-custom-event-title">
          {eventInfo.event.title}
        </div>
        {subtasks.length > 0 && (
          <div className="fc-custom-subtasks-list">
            {subtasks.map(subtask => {
              const isDone = Boolean(subtask.completed_at);
              return (
                <div
                  key={subtask.id}
                  className="fc-custom-subtask-item"
                  title={`Subtarea #${subtask.number}: ${subtask.name} (${isDone ? 'Completada' : 'Pendiente'})\nHaz clic para ver detalles`}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.get(
                      route('projects.tasks.open', {
                        project: currentProject.id,
                        task: subtask.id,
                      })
                    );
                  }}
                >
                  <span className="fc-custom-subtask-icon">
                    {isDone ? '✓' : '↳'}
                  </span>
                  <span
                    className="fc-custom-subtask-name"
                    style={{
                      textDecoration: isDone ? 'line-through' : 'none',
                      opacity: isDone ? 0.75 : 1,
                    }}
                  >
                    #{subtask.number}: {subtask.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Title
        order={1}
        mb='md'
        mt="md"
      >
        {project.name}
      </Title>

      <ProjectTabs />

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        locale={esLocale}
        initialView='dayGridMonth'
        fixedWeekCount={false}
        datesSet={(dateInfo) => {
          const viewMonth = dayjs(dateInfo.view.currentStart).format('YYYY-MM');
          setActiveMonth(prev => (prev !== viewMonth ? viewMonth : prev));
        }}
        events={events}
        height='auto'
        dayMaxEvents={2}
        moreLinkContent={(args) => `+${args.num} más`}
        moreLinkClick={(info) => {
          const formattedDate = dayjs(info.date).locale('es').format('dddd, D [de] MMMM');
          const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

          const seenIds = new Set();
          const dayTasks = [];
          (info.allSegs || []).forEach(seg => {
            const task = seg.event.extendedProps?.task;
            if (task && !seenIds.has(task.id)) {
              seenIds.add(task.id);
              dayTasks.push(task);
            }
          });

          setModalState({
            opened: true,
            dateStr: capitalizedDate,
            tasks: dayTasks,
          });

          return 'dayGridMonth';
        }}
        eventContent={renderEventContent}
        eventDidMount={info => {
          const rawStart = info.event.extendedProps?.rawStart;
          const rawEnd = info.event.extendedProps?.rawEnd;
          const task = info.event.extendedProps?.task;
          if (task) {
            let tooltip = `#${task.number}: ${task.name}`;
            if (rawStart && rawEnd) {
              tooltip += `\n${rawStart === rawEnd ? rawStart : `${rawStart} → ${rawEnd}`}`;
            }
            if (task.subtasks && task.subtasks.length > 0) {
              const doneCount = task.subtasks.filter(s => s.completed_at).length;
              tooltip += `\n\nSubtareas (${doneCount}/${task.subtasks.length}):`;
              task.subtasks.forEach(s => {
                tooltip += `\n  ${s.completed_at ? '[✓]' : '[ ]'} #${s.number}: ${s.name}`;
              });
            }
            info.el.setAttribute('title', tooltip);
          }
        }}
        eventClick={(info) => {
          if (info.jsEvent.target.closest('.fc-custom-subtask-item')) {
            return;
          }
          const taskId = info.event.extendedProps?.task?.id || Number(info.event.id);
          router.get(
            route('projects.tasks.open', {
              project: project.id,
              task: taskId,
            })
          );
        }}
      />

      {/* Modal para ver todas las tareas del día */}
      <Modal
        opened={modalState.opened}
        onClose={() => setModalState(prev => ({ ...prev, opened: false }))}
        title={
          <Group gap="xs">
            <Text fw={700} size="md">
              Actividades del {modalState.dateStr}
            </Text>
            <Badge variant="filled" color="hospitalPrimary" radius="xl">
              {modalState.tasks.length}
            </Badge>
          </Group>
        }
        size="md"
        centered
        overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
      >
        <ScrollArea.Autosize mah={450} type="auto">
          <Stack gap="xs" p={4}>
            {modalState.tasks.map(task => (
              <div
                key={task.id}
                className="calendar-modal-task-item"
                onClick={() => {
                  setModalState(prev => ({ ...prev, opened: false }));
                  router.get(
                    route('projects.tasks.open', {
                      project: project.id,
                      task: task.id,
                    })
                  );
                }}
              >
                <Group justify="space-between" wrap="nowrap" align="center">
                  <Text fw={600} size="sm" c="white">
                    #{task.number}: {task.name}
                  </Text>
                  {task.group && (
                    <Badge
                      size="xs"
                      variant="outline"
                      style={{ borderColor: 'rgba(255,255,255,0.4)', color: 'white', flexShrink: 0 }}
                    >
                      {task.group.name}
                    </Badge>
                  )}
                </Group>

                {task.subtasks && task.subtasks.length > 0 && (
                  <div className="fc-custom-subtasks-list" style={{ marginTop: '6px' }}>
                    {task.subtasks.map(subtask => {
                      const isDone = Boolean(subtask.completed_at);
                      return (
                        <div
                          key={subtask.id}
                          className="fc-custom-subtask-item"
                          title={`Subtarea #${subtask.number}: ${subtask.name} (${isDone ? 'Completada' : 'Pendiente'})\nHaz clic para ver detalles`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalState(prev => ({ ...prev, opened: false }));
                            router.get(
                              route('projects.tasks.open', {
                                project: project.id,
                                task: subtask.id,
                              })
                            );
                          }}
                        >
                          <span className="fc-custom-subtask-icon">
                            {isDone ? '✓' : '↳'}
                          </span>
                          <span
                            className="fc-custom-subtask-name"
                            style={{
                              textDecoration: isDone ? 'line-through' : 'none',
                              opacity: isDone ? 0.75 : 1,
                            }}
                          >
                            #{subtask.number}: {subtask.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </Stack>
        </ScrollArea.Autosize>
      </Modal>
    </>
  );
};

CalendarIndex.layout = (page) => <Layout title={currentProject?.name}>{page}</Layout>;

export default CalendarIndex;
