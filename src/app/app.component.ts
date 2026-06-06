import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { IonApp, Platform, ToastController } from '@ionic/angular/standalone';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { App } from '@capacitor/app';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, IonApp],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'DoseGuard';
  private swUpdate = inject(SwUpdate);
  private platform = inject(Platform);
  private router = inject(Router);
  private location = inject(Location);
  private toastCtrl = inject(ToastController);

  private backButtonSub?: Subscription;
  private lastTimeBackPress = 0;
  private timePeriodToExit = 2000;

  ngOnInit() {
    // Apply saved theme preference on app load
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme === 'true') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Handle PWA Updates securely to prevent stale builds
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      ).subscribe(() => {
        if (confirm('A new version of DoseGuard is available. Load new version?')) {
          window.location.reload();
        }
      });
    }

    // Initialize hardware back button handler
    this.initializeBackButtonCustomHandler();
  }

  private initializeBackButtonCustomHandler() {
    this.platform.ready().then(() => {
      // Priority 10 ensures we catch it before standard routing
      this.backButtonSub = this.platform.backButton.subscribeWithPriority(10, async (processNextHandler) => {
        const currentUrl = this.router.url;
        
        // Root routes where double-tap to exit applies
        const rootRoutes = ['/', '/login', '/dashboard', '/admin', '/admin-login', '/admin/dashboard'];
        
        // Clean URL from query params or fragments
        const cleanUrl = currentUrl.split('?')[0].split('#')[0];

        if (rootRoutes.includes(cleanUrl) || cleanUrl === '') {
          // Double-tap to exit logic
          if (new Date().getTime() - this.lastTimeBackPress < this.timePeriodToExit) {
            App.exitApp();
          } else {
            // Show toast and update time
            const toast = await this.toastCtrl.create({
              message: 'Press back again to exit DoseGuard',
              duration: 2000,
              position: 'bottom',
              color: 'dark'
            });
            await toast.present();
            this.lastTimeBackPress = new Date().getTime();
          }
        } else {
          // Internal page: Navigate back safely
          if (window.history.length > 1) {
            this.location.back();
          } else {
            this.router.navigate(['/']);
          }
        }
      });
    });
  }

  ngOnDestroy() {
    // Prevent memory leaks
    if (this.backButtonSub) {
      this.backButtonSub.unsubscribe();
    }
  }
}
