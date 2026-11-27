import Dropzone from '@/components/Dropzone';
import RichTextEditor from '@/components/RichTextEditor';
import useTaskDrawerStore from '@/hooks/store/useTaskDrawerStore';
import useTasksStore from '@/hooks/store/useTasksStore';
import useWebSockets from '@/hooks/useWebSockets';
import { date } from '@/utils/datetime';
import { usePage } from '@inertiajs/react';
import {
  Breadcrumbs,
  Checkbox,
  Drawer,
  Group,
  MultiSelect,
  Select,
  Text,
  TextInput,
  rem,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import Comments from './Comments';
import LabelsDropdown from './LabelsDropdown';
import PriorityDropdown from './PriorityDropdown';
import classes from './css/TaskDrawer.module.css';

// Panel lateral para ver y editar una actividad según el rol del usuario.
export function EditTaskDrawer() {
  const editorRef = useRef(null);
  const { edit, openEditTask, closeEditTask } = useTaskDrawerStore();
  const { initTaskWebSocket } = useWebSockets();
  const { findTask, updateTaskProperty, complete, deleteAttachment, uploadAttachments } =
    useTasksStore();
  const {
    usersWithAccessToProject,
    taskGroups,
    labels,
    priorities,
    openedTask,
    auth: { user },
  } = usePage().props;

  useEffect(() => {
    if (openedTask) setTimeout(() => openEditTask(openedTask), 50);
  }, []);

  const task = findTask(edit.task.id);

  const isAdmin = Boolean(user?.is_admin || user?.is_super_admin);
  const canEditNameAndDescription =
    Boolean(task) &&
    isAdmin &&
    (task.created_by_user_id == null || Number(task.created_by_user_id) === Number(user?.id));

  const [data, setData] = useState({
    group_id: '',
    assigned_to_user_id: '',
    assigned_user_ids: [],
    name: '',
    description: '',
    issue_type: '',
    priority_id: '',
    start_on: '',
    due_on: '',
    subscribed_users: [],
    labels: [],
  });

  useEffect(() => {
    if (edit.opened) {
      return initTaskWebSocket(task);
    }
  }, [edit.opened]);

  useEffect(() => {
    if (edit.opened) {
      const assignedIds =
        Array.isArray(task?.assignees) && task.assignees.length > 0
          ? task.assignees.filter(i => i?.id != null).map(i => i.id.toString())
          : task?.assigned_to_user_id
            ? [task.assigned_to_user_id.toString()]
            : [];

      setData({
        group_id: task?.group_id || '',
        assigned_to_user_id: task?.assigned_to_user_id || '',
        assigned_user_ids: assignedIds,
        name: task?.name || '',
        description: task?.description || '',
        issue_type: task?.issue_type || '',
        priority_id: task?.priority_id || '',
        start_on: task?.start_on
          ? dayjs(
              typeof task.start_on === 'string' ? task.start_on.split('T')[0] : task.start_on
            ).toDate()
          : '',
        due_on: task?.due_on
          ? dayjs(
              typeof task.due_on === 'string' ? task.due_on.split('T')[0] : task.due_on
            ).toDate()
          : '',
        subscribed_users: (task?.subscribed_users || [])
          .filter(i => i?.id != null)
          .map(i => i.id.toString()),
        labels: (task?.labels || []).map(i => i.id),
      });
      setTimeout(() => {
        editorRef.current?.setContent(task?.description || '');
      }, 300);
    }
  }, [edit.opened, task]);

  const taskAssignedIds =
    Array.isArray(task?.assignees) && task.assignees.length > 0
      ? task.assignees.filter(i => i?.id != null).map(i => String(i.id))
      : task?.assigned_to_user_id
        ? [String(task.assigned_to_user_id)]
        : [];
  const isCurrentUserAssigned =
    (data.assigned_user_ids || []).includes(String(user?.id)) ||
    taskAssignedIds.includes(String(user?.id));
  const canEditDueDate = isAdmin || isCurrentUserAssigned;
  const canUploadAttachment = isAdmin || isCurrentUserAssigned;
  const canChangeStatus = isAdmin || can('edit task');

  const updateValue = (field, value) => {
    if ((field === 'name' || field === 'description') && !canEditNameAndDescription) {
      return;
    }
    if (field === 'start_on') {
      return;
    }
    if (field === 'due_on' && !canEditDueDate) {
      return;
    }
    if (field === 'group_id' && !canChangeStatus) {
      return;
    }
    if ((field === 'assigned_user_ids' || field === 'assigned_to_user_id' || field === 'subscribed_users' || field === 'priority_id' || field === 'labels' || field === 'issue_type') && !isAdmin) {
      return;
    }

    // Convertir Date objects a string YYYY-MM-DD para fechas
    let valueToStore = value;
    if ((field === 'due_on' || field === 'start_on') && value instanceof Date) {
      valueToStore = dayjs(value).format('YYYY-MM-DD');
    }

    setData({ ...data, [field]: value });

    const dropdowns = ['labels', 'subscribed_users', 'assigned_user_ids'];
    const onBlurInputs = ['name', 'description'];

    if (dropdowns.includes(field)) {
      const options = {
        labels: value.map(id => labels.find(i => i.id === id)).filter(Boolean),
        subscribed_users: value
          .map(id => usersWithAccessToProject.find(i => i.id.toString() === id))
          .filter(Boolean),
        assigned_user_ids: value
          .map(id => usersWithAccessToProject.find(i => i.id.toString() === id))
          .filter(Boolean),
      };
      const payloadValue = field === 'assigned_user_ids' ? value.map(Number) : value;
      updateTaskProperty(task, field, payloadValue, options[field]);
    } else if (field === 'group_id') {
      const groupId = Number(value);
      const group = taskGroups.find(g => Number(g.id) === groupId) ?? null;
      updateTaskProperty(task, field, groupId, group);
    } else if (field === 'priority_id') {
      const priority = value ? priorities.find(p => p.id === value) : null;
      updateTaskProperty(task, field, value, priority);
    } else if (!onBlurInputs.includes(field)) {
      updateTaskProperty(task, field, valueToStore);
    }
  };

  const onBlurUpdate = property => {
    if ((property === 'name' || property === 'description') && !canEditNameAndDescription) {
      return;
    }
    if (data.name.length > 0) {
      updateTaskProperty(task, property, data[property]);
    }
  };

  return (
    <Drawer
      opened={edit.opened}
      onClose={closeEditTask}
      title={
        <Group
          ml={25}
          my='sm'
          wrap='nowrap'
        >
          <Checkbox
            size='ms'
            radius='xl'
            color='green'
            checked={task?.completed_at !== null}
            disabled={!isAdmin}
            onChange={e => isAdmin && complete(task, e.currentTarget.checked)}
            className={isAdmin && can('complete task') ? classes.checkbox : classes.disabledCheckbox}
            style={!isAdmin ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
          />
          <Text
            fz={rem(27)}
            fw={600}
            lh={1.2}
            td={task?.completed_at !== null ? 'line-through' : null}
          >
            #{task?.number}: {data.name}
          </Text>
        </Group>
      }
      position='right'
      size={1000}
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
      transitionProps={{
        transition: 'slide-left',
        duration: 400,
        timingFunction: 'ease',
      }}
    >
      {task ? (
        <>
          <Breadcrumbs
            className={classes.taskInfo}
            c='dark.3'
            ml={24}
            mb='xs'
            separator='I'
            separatorMargin='sm'
            styles={{
              separator: {
                opacity: 0.3,
              },
            }}
          >
            <Text size='xs'>{task.project.name}</Text>

            <Text size='xs'>Task #{task.number}</Text>

            <Text size='xs'>
              Created by {task.created_by_user?.name} on {date(task.created_at)}
            </Text>
          </Breadcrumbs>

          <form className={classes.inner}>
            <div className={classes.content}>
              {/* Nombre */}
              <TextInput
                className={classes.nameField}
                label='Nombre'
                description={!canEditNameAndDescription ? 'Solo el administrador que asignó la tarea puede modificar el nombre.' : undefined}
                placeholder='Nombre de la actividad'
                value={data.name}
                onChange={e => updateValue('name', e.target.value)}
                onBlur={() => onBlurUpdate('name')}
                error={data.name.length === 0}
                readOnly={!canEditNameAndDescription}
                disabled={!canEditNameAndDescription}
                tabIndex={!canEditNameAndDescription ? -1 : undefined}
                styles={!canEditNameAndDescription ? { root: { pointerEvents: 'none' }, input: { cursor: 'not-allowed' } } : undefined}
              />

              {/* Descripción */}
              {!canEditNameAndDescription && (
                <Text size='xs' c='dimmed' mt='md' mb={4}>
                  Descripción (solo editable por el administrador que asignó la tarea)
                </Text>
              )}
              <RichTextEditor
                ref={editorRef}
                mt={canEditNameAndDescription ? 'xl' : 0}
                placeholder='Descripción de la actividad'
                content={data.description}
                height={260}
                onChange={content => updateValue('description', content)}
                onBlur={() => onBlurUpdate('description')}
                readOnly={!canEditNameAndDescription}
              />

              {/* Foto o comprobante de la tarea */}
              {canUploadAttachment && (
                <>
                  <Text size='sm' fw={500} mt='xl' mb={4}>
                    Foto o comprobante de la tarea
                  </Text>
                  <Dropzone
                    className={classes.attachments}
                    selected={task.attachments}
                    onChange={files => uploadAttachments(task, files)}
                    remove={index => deleteAttachment(task, index)}
                  />
                </>
              )}

              {/* Comentarios */}
              {can('view comments') && <Comments key={task.id} task={task} />}
            </div>

            <div className={classes.sidebar}>
              {/* Estado */}
              <Select
                label='Estado'
                placeholder='Selecciona el estado'
                allowDeselect={false}
                value={data.group_id.toString()}
                onChange={value => updateValue('group_id', value)}
                data={taskGroups.map(i => ({
                  value: i.id.toString(),
                  label: i.name,
                }))}
                readOnly={!canChangeStatus}
                disabled={!canChangeStatus}
                tabIndex={!canChangeStatus ? -1 : undefined}
                rightSection={!canChangeStatus ? null : undefined}
                styles={!canChangeStatus ? { root: { pointerEvents: 'none' }, input: { cursor: 'not-allowed' } } : undefined}
                size='sm'
              />

              {/* Tipo */}
              <Select
                label='Tipo'
                placeholder='Selecciona el tipo de actividad'
                mt='ms'
                allowDeselect={false}
                value={data.issue_type}
                onChange={value => updateValue('issue_type', value)}
                data={[
                  { value: 'Epica', label: 'Épica' },
                  { value: 'Historia', label: 'Historia' },
                  { value: 'Tarea', label: 'Tarea' },
                  { value: 'Subtarea', label: 'Subtarea' },
                ]}
                readOnly={!isAdmin}
                disabled={!isAdmin}
                tabIndex={!isAdmin ? -1 : undefined}
                rightSection={!isAdmin ? null : undefined}
                styles={!isAdmin ? { root: { pointerEvents: 'none' }, input: { cursor: 'not-allowed' } } : undefined}
                size='sm'
              />

              {/* Personas asignadas */}
              <MultiSelect
                label='Personas asignadas'
                description={isAdmin
                  ? 'Seleccioná las personas a las que les asignás la tarea.'
                  : 'Solo el administrador puede modificar las personas asignadas.'}
                placeholder={!data.assigned_user_ids.length ? 'Sin personas asignadas' : null}
                searchable={isAdmin}
                mt='ms'
                value={data.assigned_user_ids}
                onChange={values => updateValue('assigned_user_ids', values)}
                data={usersWithAccessToProject.map(i => ({
                  value: i.id.toString(),
                  label: i.name,
                }))}
                readOnly={!isAdmin}
                disabled={!isAdmin}
                tabIndex={!isAdmin ? -1 : undefined}
                rightSection={!isAdmin ? null : undefined}
                styles={!isAdmin ? { root: { pointerEvents: 'none' }, input: { cursor: 'not-allowed' } } : undefined}
                size='sm'
              />

              {/* Fecha de inicio */}
              <DateInput
                valueFormat='DD MMM YYYY'
                mt='ms'
                label='Fecha de inicio'
                description='Se completa automáticamente al crear la tarea.'
                placeholder='Automática'
                value={data.start_on}
                readOnly
                disabled
                tabIndex={-1}
                styles={{ root: { pointerEvents: 'none' }, input: { cursor: 'not-allowed' } }}
                size='sm'
              />

              {/* Fecha de finalización */}
              <DateInput
                clearable={canEditDueDate}
                valueFormat='DD MMM YYYY'
                minDate={data.start_on || new Date()}
                mt='ms'
                label='Fecha de finalización'
                description={!canEditDueDate
                  ? 'Habilitado solo para quien deba cumplir la tarea.'
                  : 'Indicá la fecha de finalización de la tarea.'}
                placeholder={canEditDueDate ? 'Selecciona la fecha de finalización' : 'Solo editable por el asignado'}
                value={data.due_on}
                onChange={value => updateValue('due_on', value)}
                readOnly={!canEditDueDate}
                disabled={!canEditDueDate}
                tabIndex={!canEditDueDate ? -1 : undefined}
                styles={!canEditDueDate ? { root: { pointerEvents: 'none' }, input: { cursor: 'not-allowed' } } : undefined}
                size='sm'
              />

              {/* Etiquetas */}
              <LabelsDropdown
                items={labels}
                selected={data.labels}
                onChange={values => updateValue('labels', values)}
                disabled={!isAdmin}
                mt='ms'
              />

              {/* Prioridad */}
              <PriorityDropdown
                value={data.priority_id}
                onChange={value => {
                  updateValue('priority_id', value || null);
                }}
                disabled={!isAdmin}
                mt='ms'
              />

              {/* Suscriptores */}
              <MultiSelect
                label='Suscriptores'
                placeholder={!data.subscribed_users.length ? 'Selecciona suscriptores' : null}
                mt='lg'
                value={data.subscribed_users}
                onChange={values => updateValue('subscribed_users', values)}
                data={usersWithAccessToProject.map(i => ({
                  value: i.id.toString(),
                  label: i.name,
                }))}
                readOnly={!isAdmin}
                disabled={!isAdmin}
                tabIndex={!isAdmin ? -1 : undefined}
                rightSection={!isAdmin ? null : undefined}
                styles={!isAdmin ? { root: { pointerEvents: 'none' }, input: { cursor: 'not-allowed' } } : undefined}
                size='sm'
              />
            </div>
          </form>
        </>
      ) : (
        <></>
      )}
    </Drawer>
  );
}
