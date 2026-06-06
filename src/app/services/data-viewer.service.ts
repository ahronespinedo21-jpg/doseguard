import { Injectable } from '@angular/core';

export interface StoredUser {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
  role?: 'user' | 'admin';
}

export interface StoredMedication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  reason: string;
  startDate: string;
  endDate?: string;
  userId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DataViewerService {
  private readonly USERS_KEY = 'doseguard_users';
  private readonly MEDICATIONS_KEY = 'doseguard_medications';

  constructor() {}

  // Get all stored users
  getAllStoredUsers(): StoredUser[] {
    const usersJson = localStorage.getItem(this.USERS_KEY);
    return usersJson ? JSON.parse(usersJson) : [];
  }

  // Get all stored medications
  getAllStoredMedications(): StoredMedication[] {
    const medsJson = localStorage.getItem(this.MEDICATIONS_KEY);
    return medsJson ? JSON.parse(medsJson) : [];
  }

  // Get all localStorage data as object
  getAllStorageData(): { [key: string]: any } {
    const data: { [key: string]: any } = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        try {
          data[key] = value ? JSON.parse(value) : value;
        } catch {
          data[key] = value;
        }
      }
    }
    return data;
  }

  // Export data as JSON
  exportDataAsJson(): string {
    return JSON.stringify(this.getAllStorageData(), null, 2);
  }

  // Export data as CSV (for users)
  exportUsersAsCSV(): string {
    const users = this.getAllStoredUsers();
    if (users.length === 0) return 'No users found';

    const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Role'];
    const rows = users.map(u => [
      u.id,
      u.firstName || '',
      u.lastName || '',
      u.email,
      u.role || 'user'
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csv;
  }

  // Export medications as CSV
  exportMedicationsAsCSV(): string {
    const meds = this.getAllStoredMedications();
    if (meds.length === 0) return 'No medications found';

    const headers = ['ID', 'Name', 'Dosage', 'Frequency', 'Reason', 'Start Date', 'End Date'];
    const rows = meds.map(m => [
      m.id,
      m.name,
      m.dosage,
      m.frequency,
      m.reason,
      m.startDate,
      m.endDate || ''
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csv;
  }

  // Clear all data
  clearAllData(): void {
    localStorage.clear();
  }

  // Download file helper
  downloadFile(content: string, filename: string, type: string = 'text/plain'): void {
    const element = document.createElement('a');
    element.setAttribute('href', `data:${type};charset=utf-8,${encodeURIComponent(content)}`);
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }
}
