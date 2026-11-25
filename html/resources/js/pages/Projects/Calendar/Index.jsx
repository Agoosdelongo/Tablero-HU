import ProjectTabs from '@/components/ProjectTabs';
import Layout from '@/layouts/MainLayout';
import { router, usePage } from '@inertiajs/react';
import { Title } from '@mantine/core';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import dayjs from 'dayjs';
import { getGroupBarColor } from '@/utils/taskGroupColors';
import './css/calendar.css';

let currentProject = null;

const CalendarIndex = () => {
  const { project, tasks } = usePage().props;

  currentProject = project;

  const todayStr = dayjs().format('YYYY-MM-DD');

  const events = tasks
    .map(task => {
      const startStr = task.start_on ? task.start_on.split('T')[0] : null;
      if (!startStr) return null;

      let endStr;
      if (task.completed_at) {
        endStr = task.completed_at.split('T')[0];
      } else if (task.due_on) {
        endStr = task.due_on.split('T')[0];
      } else {
        // En curso sin fecha límite fija: se extiende hasta hoy o hasta el inicio si es posterior
        endStr = dayjs(todayStr).isAfter(dayjs(startStr)) ? todayStr : startStr;
      }

      if (dayjs(endStr).isBefore(dayjs(startStr))) {
        endStr = startStr;
      }

      // En FullCalendar para eventos allDay, end es exclusivo
      const fcEnd = dayjs(endStr).add(1, 'day').format('YYYY-MM-DD');
      const color = task.priority?.color || getGroupBarColor(task.group);

      return {
        id: task.id.toString(),
        title: `#${task.number}: ${task.name}`,
        start: startStr,
        end: fcEnd,
        allDay: true,
        backgroundColor: color,
        borderColor: color,
        extendedProps: {
          task,
          rawStart: startStr,
          rawEnd: endStr,
        },
      };
    })
    .filter(Boolean);

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
        events={events}
        height='auto'
        eventDidMount={info => {
          const rawStart = info.event.extendedProps?.rawStart;
          const rawEnd = info.event.extendedProps?.rawEnd;
          if (rawStart && rawEnd) {
            info.el.setAttribute(
              'title',
              `${info.event.title}\n${rawStart === rawEnd ? rawStart : `${rawStart} → ${rawEnd}`}`
            );
          }
        }}
        eventClick={(info) => {
          router.get(
            route('projects.tasks.open', {
              project: project.id,
              task: Number(info.event.id),
            })
          );
        }}
      />
    </>
  );
};

CalendarIndex.layout = (page) => <Layout title={currentProject?.name}>{page}</Layout>;

export default CalendarIndex;
