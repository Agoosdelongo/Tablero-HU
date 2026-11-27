import Dropzone from '@/components/Dropzone';
import RichTextEditor from '@/components/RichTextEditor';
import useTaskDrawerStore from '@/hooks/store/useTaskDrawerStore';
import useTasksStore from '@/hooks/store/useTasksStore';
import useWebSockets from '@/hooks/useWebSockets';
import { date } from '@/utils/datetime';
import { usePage } from '@inertiajs/react';
import {
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Checkbox,
  Drawer,
  Group,
  MultiSelect,
  Select,
  Stack,
  Text,
  TextInput,
  rem,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { IconChevronRight, IconPlus } from '@tabler/icons-react';
import Comments from './Comments';
import LabelsDropdown from './LabelsDropdown';
import PriorityDropdown from './PriorityDropdown';
import classes from './css/TaskDrawer.module.css';

// Panel lateral para ver y editar una actividad según el rol del usuario.
export function EditTaskDrawer() {
  const editorRef = useRef(null);
  const { edit, openEditTask, openCreateTask, closeEditTask } = useTaskDrawerStore();
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

  const storeTask = findTask(edit.task?.id);
  const task = storeTask || (edit.task?.id ? edit.task : null);

  const isAdmin = Boolean(user?.is_admin || user?.is_super_admin);
  const isDev = Boolean(user?.roles?.includes('developer') || user?.roles?.includes('manager'));
  const canEditCreatedDate = isAdmin || isDev;
  const canEditStartDate = isAdmin;
  const canEditDueDate = isAdmin;
  const canEditCompletedDate = isAdmin || isDev;

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
    created_at: '',
    start_on: '',
    due_on: '',
    completed_at: '',
    subscribed_users: [],
    labels: [],
  });

  useEffect(() => {
    if (edit.opened) {
      return initTaskWebSocket(task);
    }
  }, [edit.opened]);

  useEffect(() => {
    if (edit.opened && task) {
      const assignedIds =
        Array.isArray(task.assignees) && task.assignees.length > 0
          ? task.assignees.filter(i => i?.id != null).map(i => i.id.toString())
          : task.assigned_to_user_id
            ? [task.assigned_to_user_id.toString()]
            : [];

      setData({
        group_id: task.group_id != null ? task.group_id : '',
        assigned_to_user_id: task.assigned_to_user_id != null ? task.assigned_to_user_id : '',
        assigned_user_ids: assignedIds,
        name: task.name || '',
        description: task.description || '',
        issue_type: task.issue_type || '',
        priority_id: task.priority_id || '',
        created_at: task.created_at
          ? dayjs(
              typeof task.created_at === 'string' ? task.created_at.split('T')[0] : task.created_at
            ).toDate()
          : '',
        start_on: task.start_on
          ? dayjs(
              typeof task.start_on === 'string' ? task.start_on.split('T')[0] : task.start_on
            ).toDate()
          : '',
        due_on: task.due_on
          ? dayjs(
              typeof task.due_on === 'string' ? task.due_on.split('T')[0] : task.due_on
            ).toDate()
          : '',
        completed_at: task.completed_at
          ? dayjs(
              typeof task.completed_at === 'string' ? task.completed_at.split('T')[0] : task.completed_at
            ).toDate()
          : '',
        subscribed_users: (task.subscribed_users || [])
          .filter(i => i?.id != null)
          .map(i => i.id.toString()),
        labels: (task.labels || []).map(i => i.id),
      });

      setTimeout(() => {
        editorRef.current?.setContent(task.description || '');
      }, 50);
    }
  }, [edit.opened, task?.id]);

  const taskAssignedIds =
    Array.isArray(task?.assignees) && task.assignees.length > 0
      ? task.assignees.filter(i => i?.id != null).map(i => String(i.id))
      : task?.assigned_to_user_id
        ? [String(task.assigned_to_user_id)]
        : [];
  const isCurrentUserAssigned =
    (data.assigned_user_ids || []).includes(String(user?.id)) ||
    taskAssignedIds.includes(String(user?.id));
  const canUploadAttachment = isAdmin || isCurrentUserAssigned;

  const updateValue = (field, value) => {
    if ((field === 'name' || field === 'description') && !canEditNameAndDescription) {
      return;
    }
    if (field === 'created_at' && !canEditCreatedDate) {
      return;
    }
    if (field === 'start_on' && !canEditStartDate) {
      return;
    }
    if (field === 'due_on' && !canEditDueDate) {
      return;
    }
    if (field === 'completed_at' && !canEditCompletedDate) {
      return;
    }
    if (field === 'group_id') {
      if (!isAdmin && !isDev) {
        return;
      }
    } else if (
      (field === 'assigned_user_ids' ||
        field === 'assigned_to_user_id' ||
        field === 'subscribed_users' ||
        field === 'priority_id' ||
        field === 'labels' ||
        field === 'issue_type') &&
      !isAdmin
    ) {
      return;
    }

    // Convertir Date objects a string YYYY-MM-DD para fechas
    let valueToStore = value;
    if (['due_on', 'start_on', 'created_at', 'completed_at'].includes(field)) {
      if (value instanceof Date) {
        valueToStore = dayjs(value).format('YYYY-MM-DD');
      } else if (!value) {
        valueToStore = null;
      }
    }

    setData(prev => ({ ...prev, [field]: value }));

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
    setData(currentData => {
      if (currentData.name.length > 0) {
        updateTaskProperty(task, property, currentData[property]);
      }
      return currentData;
    });
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
            disabled={!canEditCompletedDate}
            onChange={e => canEditCompletedDate && complete(task, e.currentTarget.checked)}
            className={canEditCompletedDate && can('complete task') ? classes.checkbox : classes.disabledCheckbox}
            style={!canEditCompletedDate ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
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

              {/* Subtareas */}
              {task.issue_type !== 'Subtarea' && (
                <Box mt='xl'>
                  <Group justify='space-between' mb='xs'>
                    <Group gap='xs'>
                      <Text fw={600} size='sm'>
                        Subtareas
                      </Text>
                      <Badge size='sm' variant='light' color='blue'>
                        {(task.children || []).filter(c => (findTask(c.id) || c).completed_at !== null).length}/
                        {(task.children || []).length}
                      </Badge>
                    </Group>
                    {can('create task') && (
                      <Button
                        variant='subtle'
                        size='xs'
                        leftSection={<IconPlus size={14} />}
                        onClick={() =>
                          openCreateTask({
                            group_id: task.group_id,
                            parent_task_id: task.id,
                            parent_issue_type: task.issue_type,
                          })
                        }
                      >
                        Agregar subtarea
                      </Button>
                    )}
                  </Group>

                  {(task.children || []).length > 0 ? (
                    <Stack gap='xs'>
                      {(task.children || []).map(rawChild => {
                        const child = findTask(rawChild.id) || rawChild;
                        return (
                          <Group
                            key={child.id}
                            justify='space-between'
                            p='xs'
                            style={{
                              borderRadius: 6,
                              backgroundColor: 'var(--mantine-color-default-hover)',
                              cursor: 'pointer',
                            }}
                            onClick={() => openEditTask(child)}
                          >
                            <Group gap='xs'>
                              <Checkbox
                                size='xs'
                                radius='xl'
                                color='green'
                                checked={child.completed_at !== null}
                                onChange={e => {
                                  e.stopPropagation();
                                  complete(child, e.currentTarget.checked);
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                              <Text
                                size='sm'
                                style={{
                                  textDecoration: child.completed_at ? 'line-through' : 'none',
                                  opacity: child.completed_at ? 0.6 : 1,
                                }}
                              >
                                #{child.number}: {child.name}
                              </Text>
                            </Group>
                            <IconChevronRight size={14} color='var(--mantine-color-gray-6)' />
                          </Group>
                        );
                      })}
                    </Stack>
                  ) : (
                    <Text size='xs' c='dimmed'>
                      No hay subtareas asociadas.
                    </Text>
                  )}
                </Box>
              )}

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
                readOnly={!(isAdmin || isDev)}
                disabled={!(isAdmin || isDev)}
                tabIndex={!(isAdmin || isDev) ? -1 : undefined}
                rightSection={!(isAdmin || isDev) ? null : undefined}
                styles={!(isAdmin || isDev) ? { root: { pointerEvents: 'none' }, input: { cursor: 'not-allowed' } } : undefined}
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

              {/* Fecha de creación */}
              <DateInput
                clearable={canEditCreatedDate}
                valueFormat='DD MMM YYYY'
                mt='ms'
                label='Fecha de creación'
                description={canEditCreatedDate ? 'Fecha en la que fue creada la tarea.' : 'Fecha automática de creación.'}
                placeholder={canEditCreatedDate ? 'Selecciona la fecha' : 'Fecha de creación'}
                value={data.created_at}
                onChange={value => updateValue('created_at', value)}
                readOnly={!canEditCreatedDate}
                disabled={!canEditCreatedDate}
                tabIndex={!canEditCreatedDate ? -1 : undefined}
                styles={!canEditCreatedDate ? { root: { pointerEvents: 'none' }, input: { cursor: 'not-allowed' } } : undefined}
                size='sm'
              />

              {/* Fecha de inicio */}
              <DateInput
                clearable={canEditStartDate}
                valueFormat='DD MMM YYYY'
                mt='ms'
                label='Fecha de inicio'
                description={canEditStartDate ? 'Cuándo tiene que comenzar a realizarse la tarea.' : 'Solo modificable por el administrador.'}
                placeholder={canEditStartDate ? 'Selecciona la fecha de inicio' : 'Solo administrador'}
                value={data.start_on}
                onChange={value => updateValue('start_on', value)}
                readOnly={!canEditStartDate}
                disabled={!canEditStartDate}
                tabIndex={!canEditStartDate ? -1 : undefined}
                styles={!canEditStartDate ? { root: { pointerEvents: 'none' }, input: { cursor: 'not-allowed' } } : undefined}
                size='sm'
              />

              {/* Fecha de vencimiento */}
              <DateInput
                clearable={canEditDueDate}
                valueFormat='DD MMM YYYY'
                minDate={data.start_on || undefined}
                mt='ms'
                label='Fecha de vencimiento'
                description={canEditDueDate
                  ? 'Plazo límite para realizar la tarea.'
                  : 'Solo modificable por el administrador.'}
                placeholder={canEditDueDate ? 'Selecciona la fecha de vencimiento' : 'Solo editable por el administrador'}
                value={data.due_on}
                onChange={value => updateValue('due_on', value)}
                readOnly={!canEditDueDate}
                disabled={!canEditDueDate}
                tabIndex={!canEditDueDate ? -1 : undefined}
                styles={!canEditDueDate ? { root: { pointerEvents: 'none' }, input: { cursor: 'not-allowed' } } : undefined}
                size='sm'
              />

              {/* Fecha de fin */}
              <DateInput
                clearable={canEditCompletedDate}
                valueFormat='DD MMM YYYY'
                mt='ms'
                label='Fecha de fin'
                description={canEditCompletedDate ? 'Fecha de finalización de la tarea.' : 'Sin finalizar.'}
                placeholder={canEditCompletedDate ? 'Selecciona fecha o finaliza la tarea' : 'Sin finalizar'}
                value={data.completed_at}
                onChange={value => updateValue('completed_at', value)}
                readOnly={!canEditCompletedDate}
                disabled={!canEditCompletedDate}
                tabIndex={!canEditCompletedDate ? -1 : undefined}
                styles={!canEditCompletedDate ? { root: { pointerEvents: 'none' }, input: { cursor: 'not-allowed' } } : undefined}
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
