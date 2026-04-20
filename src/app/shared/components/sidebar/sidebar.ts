import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { USERS_API_URL } from '../../../core/config/app-api.config';

interface ProfileUpdatePayload {
  name: string;
  email: string;
  profileImage: string;
}

interface StoredUser {
  id?: string | number;
  name?: string;
  email?: string;
  profileImage?: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit, OnChanges {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  @ViewChild('profileImageInput')
  private readonly profileImageInput?: ElementRef<HTMLInputElement>;

  @ViewChild('cropPreviewCanvas')
  private readonly cropPreviewCanvas?: ElementRef<HTMLCanvasElement>;

  @Input() showRollingBudgetPanel = false;
  @Input() rollingTotalBudget = 0;
  @Input() rollingUsedBudget = 0;
  @Input() rollingBudgetRemaining = 0;
  @Input() rollingDaysRemaining = 0;
  @Input() rollingBudgetToday = 0;
  @Input() profileName = '';
  @Input() profileEmail = '';
  @Input() profileImage = '';

  @Output() profileUpdated = new EventEmitter<ProfileUpdatePayload>();
  @Input() formatRupiahFn: (amount: number) => string = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  protected readonly defaultProfileName = 'User';
  protected readonly defaultProfileEmail = 'user@example.com';
  protected readonly defaultProfileImage = 'assets/user.svg';
  protected readonly acceptedImageTypes = ['image/png', 'image/jpeg'];

  protected activeProfileName = this.defaultProfileName;
  protected activeProfileEmail = this.defaultProfileEmail;
  protected activeProfileImage = this.defaultProfileImage;

  protected showProfileModal = false;
  protected editProfileName = '';
  protected editProfileEmail = '';
  protected profileFormError = '';
  protected selectedImageName = '';
  protected hasPendingImageCrop = false;
  protected cropZoom = 1;
  protected cropOffsetX = 50;
  protected cropOffsetY = 50;

  private cropSourceImage: HTMLImageElement | null = null;

  protected navItems = [
    { path: '/home', label: 'Home', icon: 'assets/material-symbols_home.svg' },
    {
      path: '/transactions',
      label: 'Transaction',
      icon: 'assets/material-symbols_transaction.svg',
    },
    {
      path: '/investment',
      label: 'Investment',
      icon: 'assets/material-symbols_investation.svg',
    },
    {
      path: '/tools',
      label: 'Tools',
      icon: 'assets/material-symbols_tools.svg',
    },
    {
      path: '/education',
      label: 'Education',
      icon: 'assets/material-symbols_education.svg',
    },
  ];

  ngOnInit(): void {
    this.refreshProfileIdentity();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['profileName'] ||
      changes['profileEmail'] ||
      changes['profileImage']
    ) {
      this.refreshProfileIdentity();
    }
  }

  protected openProfileModal(): void {
    this.editProfileName = this.activeProfileName;
    this.editProfileEmail = this.activeProfileEmail;
    this.profileFormError = '';
    this.selectedImageName = '';
    this.hasPendingImageCrop = false;
    this.cropZoom = 1;
    this.cropOffsetX = 50;
    this.cropOffsetY = 50;
    this.cropSourceImage = null;
    this.showProfileModal = true;
  }

  protected closeProfileModal(): void {
    this.showProfileModal = false;
    this.profileFormError = '';
  }

  protected triggerImagePicker(): void {
    const input = this.profileImageInput?.nativeElement;
    if (!input) {
      return;
    }
    input.value = '';
    input.click();
  }

  protected async onProfileImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!this.acceptedImageTypes.includes(file.type)) {
      this.profileFormError = 'Format gambar harus PNG, JPG, atau JPEG.';
      return;
    }

    const dataUrl = await this.readFileAsDataUrl(file);
    if (!dataUrl) {
      this.profileFormError = 'Gagal membaca gambar. Coba ulangi lagi.';
      return;
    }

    const image = await this.loadImage(dataUrl);
    if (!image) {
      this.profileFormError = 'Gambar tidak valid. Pilih file lain.';
      return;
    }

    this.cropSourceImage = image;
    this.cropZoom = 1;
    this.cropOffsetX = 50;
    this.cropOffsetY = 50;
    this.selectedImageName = file.name;
    this.hasPendingImageCrop = true;
    this.profileFormError = '';

    queueMicrotask(() => {
      this.renderCropPreview();
    });
  }

  protected onCropChanged(): void {
    this.renderCropPreview();
  }

  protected async saveProfile(): Promise<void> {
    const name = this.editProfileName.trim();
    const email = this.editProfileEmail.trim().toLowerCase();

    if (!name) {
      this.profileFormError = 'Nama wajib diisi.';
      return;
    }

    if (!this.isEmailValid(email)) {
      this.profileFormError = 'Email tidak valid.';
      return;
    }

    let profileImage = this.activeProfileImage || this.defaultProfileImage;
    if (this.hasPendingImageCrop && this.cropSourceImage) {
      profileImage = this.exportCroppedImage();
    }

    this.activeProfileName = name;
    this.activeProfileEmail = email;
    this.activeProfileImage = profileImage;

    const user = this.getCurrentUser();
    const updatedUser: StoredUser = {
      ...user,
      name,
      email,
      profileImage,
    };

    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));

    if (updatedUser.id) {
      try {
        await firstValueFrom(
          this.http.put(`${USERS_API_URL}/${updatedUser.id}`, {
            ...updatedUser,
            id: updatedUser.id,
          }),
        );
      } catch {
        // keep local changes even when server update fails
      }
    }

    this.profileUpdated.emit({
      name,
      email,
      profileImage,
    });
    this.closeProfileModal();
  }

  protected onLogoutClick(event: Event): void {
    event.stopPropagation();
    this.logout();
  }

  private refreshProfileIdentity(): void {
    const user = this.getCurrentUser();
    this.activeProfileName =
      this.profileName.trim() || user.name?.trim() || this.defaultProfileName;
    this.activeProfileEmail =
      this.profileEmail.trim() ||
      user.email?.trim() ||
      this.defaultProfileEmail;
    this.activeProfileImage =
      this.profileImage.trim() ||
      user.profileImage?.trim() ||
      this.defaultProfileImage;
  }

  private getCurrentUser(): StoredUser {
    try {
      return JSON.parse(
        localStorage.getItem('currentUser') || '{}',
      ) as StoredUser;
    } catch {
      return {};
    }
  }

  private isEmailValid(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private async readFileAsDataUrl(file: File): Promise<string | null> {
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  private async loadImage(src: string): Promise<HTMLImageElement | null> {
    return await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  private renderCropPreview(): void {
    if (!this.cropSourceImage) {
      return;
    }

    const canvas = this.cropPreviewCanvas?.nativeElement;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const { sourceX, sourceY, sourceSize } = this.getCropBox();
    const size = canvas.width;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.beginPath();
    context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    context.clip();
    context.drawImage(
      this.cropSourceImage,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    context.restore();
  }

  private exportCroppedImage(): string {
    if (!this.cropSourceImage) {
      return this.activeProfileImage || this.defaultProfileImage;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 512;
    exportCanvas.height = 512;
    const context = exportCanvas.getContext('2d');
    if (!context) {
      return this.activeProfileImage || this.defaultProfileImage;
    }

    const { sourceX, sourceY, sourceSize } = this.getCropBox();
    context.drawImage(
      this.cropSourceImage,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      exportCanvas.width,
      exportCanvas.height,
    );
    return exportCanvas.toDataURL('image/png');
  }

  private getCropBox(): {
    sourceX: number;
    sourceY: number;
    sourceSize: number;
  } {
    const image = this.cropSourceImage;
    if (!image) {
      return {
        sourceX: 0,
        sourceY: 0,
        sourceSize: 1,
      };
    }

    const minSide = Math.min(image.naturalWidth, image.naturalHeight);
    const zoom = Math.max(1, Math.min(3, this.cropZoom));
    const sourceSize = minSide / zoom;
    const maxX = Math.max(0, image.naturalWidth - sourceSize);
    const maxY = Math.max(0, image.naturalHeight - sourceSize);
    const sourceX = (this.cropOffsetX / 100) * maxX;
    const sourceY = (this.cropOffsetY / 100) * maxY;

    return {
      sourceX,
      sourceY,
      sourceSize,
    };
  }

  protected logout(): void {
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    void this.router.navigate(['/login']);
  }
}
