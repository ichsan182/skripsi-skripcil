import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Sidebar } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-tools',
  standalone: true,
  imports: [CommonModule, Sidebar, RouterLink],
  templateUrl: './tools.html',
  styleUrl: './tools.css',
})
export class Tools {}
