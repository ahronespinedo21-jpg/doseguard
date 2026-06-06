import { Routes } from '@angular/router';
import { RootLayoutComponent } from './components/root-layout/root-layout.component';
import { LoginPageComponent } from './pages/login/login.component';
import { SignupPageComponent } from './pages/signup/signup.component';
import { DashboardPageComponent } from './pages/dashboard/dashboard.component';
import { ChatbotPageComponent } from './pages/chatbot/chatbot.component';
import { SettingsPageComponent } from './pages/settings/settings.component';
import { AddMedicationPageComponent } from './pages/add-medication/add-medication.component';
import { EditMedicationPageComponent } from './pages/edit-medication/edit-medication.component';
import { UpcomingRemindersComponent } from './pages/upcoming-reminders/upcoming-reminders.component';
import { LowStockComponent } from './pages/low-stock/low-stock.component';
import { AdminLoginComponent } from './pages/admin-login/admin-login.component';
import { AdminDashboardComponent } from './pages/admin/dashboard/dashboard.component';
import { UserManagementComponent } from './pages/admin/users/users.component';
import { MedicationRecordsComponent } from './pages/admin/medications/medications.component';
import { DeviceManagementComponent } from './pages/admin/devices/devices.component';
import { AdherenceAnalyticsComponent } from './pages/admin/analytics/analytics.component';
import { ChatbotLogsComponent } from './pages/admin/chatbot/chatbot.component';
import { AlertsReportsComponent } from './pages/admin/alerts/alerts.component';
import { SystemSettingsComponent } from './pages/admin/settings/settings.component';
import { DatabaseViewerComponent } from './pages/admin/database-viewer/database-viewer.component';
import { AdminGuard } from './guards/admin.guard';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: RootLayoutComponent,
    children: [
      // ── Public routes (no auth required)
      { path: '', component: LoginPageComponent },
      { path: 'login', redirectTo: '', pathMatch: 'full' }, // alias used by logout() / interceptor
      { path: 'signup', component: SignupPageComponent },

      // ── Authenticated user routes (AuthGuard: requires valid JWT token)
      { path: 'dashboard',          component: DashboardPageComponent,    canActivate: [AuthGuard] },
      { path: 'chatbot',            component: ChatbotPageComponent,      canActivate: [AuthGuard] },
      { path: 'settings',           component: SettingsPageComponent,     canActivate: [AuthGuard] },
      { path: 'add-medication',     component: AddMedicationPageComponent, canActivate: [AuthGuard] },
      { path: 'edit-medication/:id', component: EditMedicationPageComponent, canActivate: [AuthGuard] },
      { path: 'upcoming-reminders', component: UpcomingRemindersComponent, canActivate: [AuthGuard] },
      { path: 'low-stock',          component: LowStockComponent,         canActivate: [AuthGuard] },
    ]
  },

  // ── Admin routes (outside root layout — separate full-page admin shell)
  // AdminGuard: requires admin role OR doseguard_admin session key
  { path: 'admin-login',     component: AdminLoginComponent },
  // /admin-dashboard is the primary post-login destination
  { path: 'admin-dashboard', component: AdminDashboardComponent,    canActivate: [AdminGuard] },
  // /admin kept as redirect alias for backward compatibility
  { path: 'admin',           redirectTo: 'admin-dashboard',         pathMatch: 'full' },
  { path: 'admin/users',      component: UserManagementComponent,    canActivate: [AdminGuard] },
  { path: 'admin/medications', component: MedicationRecordsComponent, canActivate: [AdminGuard] },
  { path: 'admin/devices',    component: DeviceManagementComponent,  canActivate: [AdminGuard] },
  { path: 'admin/analytics',  component: AdherenceAnalyticsComponent, canActivate: [AdminGuard] },
  { path: 'admin/chatbot',    component: ChatbotLogsComponent,       canActivate: [AdminGuard] },
  { path: 'admin/alerts',     component: AlertsReportsComponent,     canActivate: [AdminGuard] },
  { path: 'admin/settings',   component: SystemSettingsComponent,    canActivate: [AdminGuard] },
  { path: 'admin/database',   component: DatabaseViewerComponent,    canActivate: [AdminGuard] },

  // ── Wildcard: redirect unknown routes to login
  { path: '**', redirectTo: '/' }
];
