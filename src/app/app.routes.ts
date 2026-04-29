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
    path: 'welcome',
    component: Welcome,
  },
  {
    path: 'questionnaire',
    component: Questionnaire,
  },
  {
    path: 'result',
    component: Result,
  },
  {
    path: 'home',
    component: Home,
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
    path: 'debt',
    component: Debt,
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
    path: 'education/content/:id',
    component: EducationContent,
  },
];
