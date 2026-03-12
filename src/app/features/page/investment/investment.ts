import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-investment',
  standalone: true,
  imports: [CommonModule, Sidebar],
  templateUrl: './investment.html',
  styleUrl: './investment.css',
})
export class Investment {}
