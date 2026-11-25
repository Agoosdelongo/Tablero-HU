import { router } from '@inertiajs/react';
import NProgress from 'nprogress';

NProgress.configure({
  showSpinner: false,
  minimum: 0.1,
});

let timeout = null;

router.on('start', (event) => {
    if (event.detail.visit.headers?.['X-Silent']) return;
    timeout = setTimeout(() => NProgress.start(), 250);
});

router.on('progress', (event) => {
  if (NProgress.isStarted() && event.detail.progress.percentage) {
    NProgress.set((event.detail.progress.percentage / 100) * 0.9);
  }
});

router.on('finish', (event) => {
  clearTimeout(timeout);
  if (!NProgress.isStarted()) {
    return;
  } else if (event.detail.visit.completed) {
    NProgress.done();
  } else if (event.detail.visit.interrupted) {
    NProgress.set(0);
  } else if (event.detail.visit.cancelled) {
    NProgress.done();
    NProgress.remove();
  }
});

/**
 * We'll load the axios HTTP library which allows us to easily issue requests
 * to our Laravel back-end. This library automatically handles sending the
 * CSRF token as a header based on the value of the "XSRF" token cookie.
 */

import axios from "axios";
window.axios = axios;

window.axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";

window.axios.pendingRequests = 0;

window.axios.interceptors.request.use(function (config) {
  config.progress === true && NProgress.start();
  window.axios.pendingRequests++;
  return config;
}, function (error) {
  NProgress.done();
  window.axios.pendingRequests--;
  console.error(error)
  return Promise.reject(error);
});

window.axios.interceptors.response.use(function (response) {
  NProgress.done();
  window.axios.pendingRequests--;
  return response;
}, function (error) {
  NProgress.done();
  window.axios.pendingRequests--;
  console.error(error)
  return Promise.reject(error);
});

window.addEventListener("beforeunload", (event) => {
  if (window.axios.pendingRequests > 0) {
    event.preventDefault();
    return (event.returnValue = 'There are pending requests, press "Cancel" to prevent any loss of changes.');
  }
});

/**
 * Echo exposes an expressive API for subscribing to channels and listening
 * for events that are broadcast by Laravel. Echo and event broadcasting
 * allows your team to easily build robust real-time web applications.
 */

import Echo from 'laravel-echo';

import dayjs from 'dayjs';
import Pusher from 'pusher-js';
window.Pusher = Pusher;

const pusherKey = import.meta.env.VITE_PUSHER_APP_KEY;
const pusherCluster = import.meta.env.VITE_PUSHER_APP_CLUSTER ?? 'mt1';

// Solo inicializa Laravel Echo si hay una clave Pusher configurada; evita errores en consola con BROADCAST_DRIVER=log.
window.Echo = pusherKey
  ? new Echo({
      broadcaster: 'pusher',
      key: pusherKey,
      cluster: pusherCluster,
      wsHost: import.meta.env.VITE_PUSHER_HOST
        ? import.meta.env.VITE_PUSHER_HOST
        : `ws-${pusherCluster}.pusher.com`,
      wsPort: import.meta.env.VITE_PUSHER_PORT ?? 80,
      wssPort: import.meta.env.VITE_PUSHER_PORT ?? 443,
      forceTLS: (import.meta.env.VITE_PUSHER_SCHEME ?? 'https') === 'https',
      enabledTransports: ['ws', 'wss'],
    })
  : null;

// dayjs
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/es';
dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('es');
dayjs.tz.setDefault('America/Argentina/Buenos_Aires');