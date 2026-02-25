import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from '../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, Sidebar],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
}
