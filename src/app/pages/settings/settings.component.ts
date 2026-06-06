import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BottomNavigationComponent } from '../../components/bottom-navigation/bottom-navigation.component';
import { UserService, UserProfile } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, BottomNavigationComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsPageComponent implements OnInit {
  isDarkMode = false;
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  successMessage = '';
  notificationSettings = {
    pushNotifications: true,
    voiceReminders: true,
    emailNotifications: true,
    lowStockAlerts: true
  };
  userProfile: UserProfile = {
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: ''
  };

  constructor(private router: Router, private userService: UserService, private authService: AuthService) {}

  ngOnInit() {
    // Load theme preference on component init
    const savedTheme = localStorage.getItem('darkMode');
    this.isDarkMode = savedTheme === 'true';
    this.applyTheme();
    
    // Load notification settings
    const savedNotifications = localStorage.getItem('notificationSettings');
    if (savedNotifications) {
      this.notificationSettings = JSON.parse(savedNotifications);
    }
    
    // Immediately load and display user profile from localStorage
    this.loadUserDataFromLocalStorage();
    
    // Then sync with backend
    this.syncUserProfile();
  }

  loadUserDataFromLocalStorage() {
    const storedUser = localStorage.getItem('doseguard_user');
    
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        
        // Update userProfile object to trigger UI update
        this.userProfile = {
          id: userData.id || '',
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || '',
          phone: userData.phone || '',
          dateOfBirth: userData.dateOfBirth || '',
          address: userData.address || '',
          role: userData.role || ''
        };
        
      } catch (error) {
        console.error('❌ Error parsing localStorage user:', error);
      }
    } else {
    }
  }

  syncUserProfile() {
    // Fetch from backend silently to sync latest data
    this.userService.getProfile().subscribe({
      next: (profile: UserProfile) => {
        // Update if backend has more recent data
        this.userProfile = {
          ...this.userProfile,
          ...profile
        };
      },
      error: (error: any) => {
        // Silently fail if backend not available
        // User already has localStorage data
      }
    });
  }

  loadUserProfile() {
    // Now loading is handled by loadUserDataFromLocalStorage and syncUserProfile
    // This method is kept for compatibility
  }

  saveProfileChanges() {
    if (!this.userProfile.firstName || !this.userProfile.lastName) {
      this.errorMessage = 'Please fill in at least First Name and Last Name.';
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.userService.updateProfile({
      firstName: this.userProfile.firstName,
      lastName: this.userProfile.lastName,
      phone: this.userProfile.phone,
      dateOfBirth: this.userProfile.dateOfBirth,
      address: this.userProfile.address
    }).subscribe({
      next: (updatedProfile: UserProfile) => {
        this.isSaving = false;
        this.userProfile = updatedProfile;
        this.successMessage = '✅ Profile updated successfully!';
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error: any) => {
        this.isSaving = false;
        this.errorMessage = error?.error?.message || 'Failed to save profile changes. Please try again.';
        console.error('❌ Error saving profile:', error);
      }
    });
  }

  toggleNotification(setting: keyof typeof this.notificationSettings) {
    this.notificationSettings[setting] = !this.notificationSettings[setting];
    localStorage.setItem('notificationSettings', JSON.stringify(this.notificationSettings));
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    this.applyTheme();
    localStorage.setItem('darkMode', this.isDarkMode.toString());
  }

  private applyTheme() {
    if (this.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  configurePillbox() {
    alert('Pillbox configuration page coming soon');
  }

  logout() {
    if (confirm('Are you sure you want to log out?')) {
      this.authService.logout();
    }
  }
}
