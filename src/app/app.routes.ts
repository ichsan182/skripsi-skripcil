import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { Chat } from './features/page/chat/chat';
import { Transaction } from './features/page/transaction/transaction';
import { Investment } from './features/page/investment/investment';
import { Tools } from './features/page/tools/tools';
import { Education } from './features/page/education/education';

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
    path: 'education',
    component: Education,
  },
];
