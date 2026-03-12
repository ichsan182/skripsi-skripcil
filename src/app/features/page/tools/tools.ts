import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-tools',
  standalone: true,
  imports: [CommonModule, Sidebar],
  templateUrl: './tools.html',
  styleUrl: './tools.css',
})
export class Tools {}
