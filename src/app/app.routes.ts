import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { Chat } from './features/page/chat/chat';
import { Transaction } from './features/page/transaction/transaction';
import { Investment } from './features/page/investment/investment';
import { Tools } from './features/page/tools/tools';
import { ToolsCalculator } from './features/page/tools/calculator/calculator';
import { Education } from './features/page/education/education';
import { ToolsSimulation } from './features/page/tools/simulation/simulation';
import { EducationContent } from './features/page/education/education-content/education-content';


export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: Login,
  },
  {
    path: 'forgot-password',
    component: Login,
  },
  {
    path: 'register',
    component: Register,
  },
  {
    path: 'home',
    component: Home,
  },
  {
    path: 'chat',
    component: Chat,
  },
  {
    path: 'transactions',
    component: Transaction,
  },
  {
    path: 'investment',
    component: Investment,
  },
  {
    path: 'tools',
    component: Tools,
  },
  {
    path: 'tools/calculator',
    component: ToolsCalculator,
  },
  {
    path: 'tools/simulation',
    component: ToolsSimulation,
  },
  {
    path: 'education',
    component: Education,
  },
  {
    path: 'education/content',
    component: EducationContent,
  },
];
