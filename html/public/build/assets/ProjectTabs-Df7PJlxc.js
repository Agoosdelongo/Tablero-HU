import{X as k,j as e,A as b}from"./app-D7TQ5vDX.js";import{u as j}from"./usePreferences-DqgY4VBE.js";import{a as n}from"./route-UKIJmP9U.js";import{T as s}from"./Tabs-DMoO_S4W.js";import{c as i}from"./createReactComponent-7Is_eoY4.js";import{I as g}from"./IconArchive-Cvftzokb.js";/**
 * @license @tabler/icons-react v3.46.0 - MIT
 *
 * This source code is licensed under the MIT license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=[["path",{d:"M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12",key:"svg-0"}],["path",{d:"M16 3v4",key:"svg-1"}],["path",{d:"M8 3v4",key:"svg-2"}],["path",{d:"M4 11h16",key:"svg-3"}],["path",{d:"M11 15h1",key:"svg-4"}],["path",{d:"M12 15v3",key:"svg-5"}]],u=i("outline","calendar","Calendar",y);/**
 * @license @tabler/icons-react v3.46.0 - MIT
 *
 * This source code is licensed under the MIT license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=[["path",{d:"M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6",key:"svg-0"}],["path",{d:"M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -10",key:"svg-1"}],["path",{d:"M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -14",key:"svg-2"}],["path",{d:"M4 20h14",key:"svg-3"}]],m=i("outline","chart-bar","ChartBar",f);/**
 * @license @tabler/icons-react v3.46.0 - MIT
 *
 * This source code is licensed under the MIT license.
 * See the LICENSE file in the root directory of this source tree.
 */const M=[["path",{d:"M4 4l6 0",key:"svg-0"}],["path",{d:"M14 4l6 0",key:"svg-1"}],["path",{d:"M4 10a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2l0 -8",key:"svg-2"}],["path",{d:"M14 10a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2l0 -2",key:"svg-3"}]],_=i("outline","layout-kanban","LayoutKanban",M);/**
 * @license @tabler/icons-react v3.46.0 - MIT
 *
 * This source code is licensed under the MIT license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=[["path",{d:"M9 6l11 0",key:"svg-0"}],["path",{d:"M9 12l11 0",key:"svg-1"}],["path",{d:"M9 18l11 0",key:"svg-2"}],["path",{d:"M5 6l0 .01",key:"svg-3"}],["path",{d:"M5 12l0 .01",key:"svg-4"}],["path",{d:"M5 18l0 .01",key:"svg-5"}]],T=i("outline","list","List",x);/**
 * @license @tabler/icons-react v3.46.0 - MIT
 *
 * This source code is licensed under the MIT license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=[["path",{d:"M13 20l7 -7",key:"svg-0"}],["path",{d:"M13 20v-6a1 1 0 0 1 1 -1h6v-7a2 2 0 0 0 -2 -2h-12a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7",key:"svg-1"}]],N=i("outline","note","Note",C),I="_root_1apbh_1",z="_list_1apbh_5",L="_tab_1apbh_23",h={root:I,list:z,tab:L};function K(){const{project:o}=k().props,{tasksView:v,setTasksView:r}=j(),c=!!route().params.archived,t=route().current(),l=t==="projects.tasks"||t==="projects.tasks.open";let a;c?a="archived":l?a=v==="kanban"?"kanban":"list":t==="projects.calendar"?a="calendar":t==="projects.timeline"?a="timeline":t!=null&&t.startsWith("projects.notes")?a="notes":a="list";const p=d=>{if(d!==a)switch(d){case"list":l&&!c?r("list"):(r("list"),n("projects.tasks",o.id));break;case"kanban":l&&!c?r("kanban"):(r("kanban"),n("projects.tasks",o.id));break;case"calendar":n("projects.calendar",o.id);break;case"timeline":n("projects.timeline",o.id);break;case"notes":n("projects.notes",o.id);break;case"archived":b.get(route("projects.tasks",o.id),{archived:1});break}};return e.jsx(s,{value:a,onChange:p,classNames:{root:h.root,list:h.list,tab:h.tab},children:e.jsxs(s.List,{children:[e.jsx(s.Tab,{value:"list",leftSection:e.jsx(T,{size:15,stroke:1.8}),children:"Lista"}),e.jsx(s.Tab,{value:"kanban",leftSection:e.jsx(_,{size:15,stroke:1.8}),children:"Tablero"}),e.jsx(s.Tab,{value:"calendar",leftSection:e.jsx(u,{size:15,stroke:1.8}),children:"Calendario"}),e.jsx(s.Tab,{value:"timeline",leftSection:e.jsx(m,{size:15,stroke:1.8}),children:"Cronograma"}),can("view notes")&&e.jsx(s.Tab,{value:"notes",leftSection:e.jsx(N,{size:15,stroke:1.8}),children:"Notas"}),e.jsx(s.Tab,{value:"archived",leftSection:e.jsx(g,{size:15,stroke:1.8}),color:"red",children:"Archivados"})]})})}export{N as I,K as P};
