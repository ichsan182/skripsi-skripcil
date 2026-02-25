import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';

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
];
