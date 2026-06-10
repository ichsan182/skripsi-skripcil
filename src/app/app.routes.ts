import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { Welcome } from './features/onboarding/welcome/welcome';
import { Questionnaire } from './features/onboarding/questionnaire/questionnaire';
import { Result } from './features/onboarding/result/result';
import { Transaction } from './features/page/transaction/transaction';
import { Investment } from './features/page/investment/investment';
import { Tools } from './features/page/tools/tools';
import { ToolsCalculator } from './features/page/tools/calculator/calculator';
import { Education } from './features/page/education/education';
import { ToolsSimulation } from './features/page/tools/simulation/simulation';
import { EducationContent } from './features/page/education/education-content/education-content';
import { Debt } from './features/page/debt/debt';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },

  // Guest-only routes (redirect to /home if already logged in)
  {
    path: 'login',
    component: Login,
    canActivate: [guestGuard],
  },
  {
    path: 'forgot-password',
    component: Login,
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    component: Register,
    canActivate: [guestGuard],
  },

  // Protected routes (redirect to /login if not authenticated)
  {
    path: 'welcome',
    component: Welcome,
    canActivate: [authGuard],
  },
  {
    path: 'questionnaire',
    component: Questionnaire,
    canActivate: [authGuard],
  },
  {
    path: 'result',
    component: Result,
    canActivate: [authGuard],
  },
  {
    path: 'home',
    component: Home,
    canActivate: [authGuard],
  },
  {
    path: 'transactions',
    component: Transaction,
    canActivate: [authGuard],
  },
  {
    path: 'investment',
    component: Investment,
    canActivate: [authGuard],
  },
  {
    path: 'debt',
    component: Debt,
    canActivate: [authGuard],
  },
  {
    path: 'tools',
    component: Tools,
    canActivate: [authGuard],
  },
  {
    path: 'tools/calculator',
    component: ToolsCalculator,
    canActivate: [authGuard],
  },
  {
    path: 'tools/simulation',
    component: ToolsSimulation,
    canActivate: [authGuard],
  },
  {
    path: 'education',
    component: Education,
    canActivate: [authGuard],
  },
  {
    path: 'education/content/:id',
    component: EducationContent,
    canActivate: [authGuard],
  },
];
