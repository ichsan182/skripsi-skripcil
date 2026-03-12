import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-transaction',
  standalone: true,
  imports: [CommonModule, Sidebar],
  templateUrl: './transaction.html',
  styleUrl: './transaction.css',
})
export class Transaction {}
