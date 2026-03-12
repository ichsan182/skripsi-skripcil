import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, Sidebar],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class Chat {}
