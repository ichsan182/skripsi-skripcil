import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-education',
  standalone: true,
  imports: [CommonModule, Sidebar],
  templateUrl: './education.html',
  styleUrl: './education.css',
})
export class Education {}
