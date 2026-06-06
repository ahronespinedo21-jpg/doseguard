import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ScrollToTopComponent } from '../scroll-to-top/scroll-to-top.component';

@Component({
  selector: 'app-root-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, ScrollToTopComponent],
  templateUrl: './root-layout.component.html',
  styleUrl: './root-layout.component.css'
})
export class RootLayoutComponent implements OnInit {
  showSidebar = false;
  sidebarOpen = false;
  private authRoutes = ['/dashboard', '/chatbot', '/settings', '/add-medication', '/upcoming-reminders', '/low-stock', '/admin', '/admin/users', '/admin/medications', '/admin/devices', '/admin/analytics', '/admin/chatbot', '/admin/alerts', '/admin/settings'];

  constructor(private router: Router) {}

  ngOnInit() {
    this.router.events.subscribe(() => {
      this.updateSidebarVisibility();
    });
    this.updateSidebarVisibility();
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  private updateSidebarVisibility() {
    const currentUrl = this.router.url;
    this.showSidebar = this.authRoutes.some(route => currentUrl.startsWith(route));
    this.sidebarOpen = false; // Reset sidebar open state on route change
  }
}
