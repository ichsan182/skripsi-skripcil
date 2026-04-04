import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LevelEvaluation } from '../../../core/utils/level';

@Component({
  selector: 'app-level-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './level-card.html',
  styleUrl: './level-card.css',
})
export class LevelCardComponent {
  @Input({ required: true }) level!: LevelEvaluation;

  readonly levelImages = [
    'assets/level/level_1.svg',
    'assets/level/level_2.svg',
    'assets/level/level_3.svg',
    'assets/level/level_4.svg',
    'assets/level/level_5.svg',
    'assets/level/level-6.svg',
    'assets/level/level_7.svg',
  ];

  get currentLevelImage(): string {
    return (
      this.levelImages[Math.max(0, this.level.level - 1)] ?? this.levelImages[0]
    );
  }

  get nextLevelImage(): string | null {
    if (this.level.level >= 7) {
      return null;
    }

    return this.levelImages[this.level.level] ?? null;
  }

  get statusLabel(): string {
    if (this.level.status === 'stable') {
      return 'Stabil';
    }

    if (this.level.status === 'warning') {
      return 'Perlu Perhatian';
    }

    return 'In Progress';
  }
}
