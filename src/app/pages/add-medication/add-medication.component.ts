import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { MedicationService } from '../../services/medication.service';
import { NotificationService } from '../../services/notification.service';
import { BottomNavigationComponent } from '../../components/bottom-navigation/bottom-navigation.component';
import { finalize } from 'rxjs/operators';
import { from } from 'rxjs';

@Component({
  selector: 'app-add-medication',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, BottomNavigationComponent],
  templateUrl: './add-medication.component.html',
  styleUrl: './add-medication.component.css'
})
export class AddMedicationPageComponent {
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  medicationForm: FormGroup;
  availableTimes = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
  ];

  // Time Picker Properties
  selectedTimes: (string | null)[] = [null, null, null];
  showTimePicker = false;
  currentTimeIndex = 0;
  tempTime = '00:00 AM';
  tempHour = 0;
  tempMinute = 0;
  tempPeriod: 'AM' | 'PM' = 'AM';
  timePresets = ['08:00 AM', '12:00 PM', '02:00 PM', '06:00 PM', '08:00 PM', '10:00 PM'];

  constructor(
    private medicationService: MedicationService,
    private notificationService: NotificationService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.medicationForm = this.fb.group({
      name: ['', Validators.required],
      dosageType: ['', Validators.required],
      dosage: ['', Validators.required],
      category: ['', Validators.required],
      reminderTimes: [''],
      stockLevel: [30, [Validators.required, Validators.min(1), Validators.max(30)]],
      notes: [''],
      isPillboxConnected: [false],
      startDate: [new Date().toISOString().split('T')[0], Validators.required],
    });
  }

  // Time Picker Methods
  openTimePicker(index: number) {
    this.currentTimeIndex = index;
    this.showTimePicker = true;

    // Load existing time if set
    if (this.selectedTimes[index]) {
      const timeStr = this.selectedTimes[index]!;
      const parts = timeStr.split(' ');
      const [hours, minutes] = parts[0].split(':').map(Number);
      this.tempPeriod = (parts[1] as 'AM' | 'PM') || 'AM';
      this.tempHour = hours;
      this.tempMinute = minutes;
    } else {
      this.tempHour = 12;
      this.tempMinute = 0;
      this.tempPeriod = 'AM';
    }
    this.updateTempTime();
  }

  closeTimePicker() {
    this.showTimePicker = false;
  }

  confirmTime() {
    this.selectedTimes[this.currentTimeIndex] = this.tempTime;
    this.updateFormRemindersControl();
    this.closeTimePicker();
  }

  clearTime(index: number) {
    this.selectedTimes[index] = null;
    this.updateFormRemindersControl();
  }

  private updateFormRemindersControl() {
    const validTimes = this.selectedTimes.filter(t => t !== null) as string[];
    this.medicationForm.get('reminderTimes')?.setValue(validTimes.join(','));
  }

  isReminderValid(): boolean {
    const validTimes = this.selectedTimes.filter(t => t !== null) as string[];
    return validTimes.length > 0;
  }

  incrementHour() {
    this.tempHour = this.tempHour === 12 ? 1 : this.tempHour + 1;
    this.updateTempTime();
  }

  decrementHour() {
    this.tempHour = this.tempHour === 1 ? 12 : this.tempHour - 1;
    this.updateTempTime();
  }

  incrementMinute() {
    this.tempMinute = (this.tempMinute + 1) % 60;
    this.updateTempTime();
  }

  decrementMinute() {
    this.tempMinute = this.tempMinute === 0 ? 59 : this.tempMinute - 1;
    this.updateTempTime();
  }

  normalizeHour() {
    if (this.tempHour < 1) this.tempHour = 12;
    if (this.tempHour > 12) this.tempHour = 12;
    this.updateTempTime();
  }

  normalizeMinute() {
    if (this.tempMinute < 0) this.tempMinute = 0;
    if (this.tempMinute > 59) this.tempMinute = 59;
    this.updateTempTime();
  }

  setPresetTime(preset: string) {
    const parts = preset.split(' ');
    const [hours, minutes] = parts[0].split(':').map(Number);
    this.tempHour = hours;
    this.tempMinute = minutes;
    this.tempPeriod = parts[1] as 'AM' | 'PM';
    this.updateTempTime();
  }

  togglePeriod() {
    this.tempPeriod = this.tempPeriod === 'AM' ? 'PM' : 'AM';
    this.updateTempTime();
  }

  updateTempTime() {
    const hours = String(this.tempHour).padStart(2, '0');
    const minutes = String(this.tempMinute).padStart(2, '0');
    this.tempTime = `${hours}:${minutes} ${this.tempPeriod}`;
  }

  hasAnySelectedTimes(): boolean {
    return this.selectedTimes.some(t => t !== null);
  }

  getSelectedTimesString(): string {
    const times = this.selectedTimes.filter(t => t !== null) as string[];
    const uniqueTimes = [...new Set(times)].sort();
    return uniqueTimes.join(', ');
  }

  onHourChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.tempHour = parseInt(input.value) || 0;
    this.normalizeHour();
  }

  onMinuteChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.tempMinute = parseInt(input.value) || 0;
    this.normalizeMinute();
  }

  onSubmit() {
    this.errorMessage = '';
    let validTimes = this.selectedTimes.filter(t => t !== null) as string[];

    if (validTimes.length === 0) {
      this.errorMessage = 'Please select at least one reminder time.';
      return;
    }

    validTimes = [...new Set(validTimes)].sort();

    const stockControl = this.medicationForm.get('stockLevel');
    if (stockControl && stockControl.invalid) {
      if (stockControl.errors?.['required']) {
        this.errorMessage = 'Stock level is required.';
      } else {
        this.errorMessage = 'Stock level must be between 1 and 30 tablets.';
      }
      return;
    }

    if (this.medicationForm.invalid) {
      const missingFields: string[] = [];
      Object.keys(this.medicationForm.controls).forEach(key => {
        const control = this.medicationForm.get(key);
        control?.markAsTouched();
        if (control?.errors?.['required']) {
          missingFields.push(this.getFieldLabel(key));
        }
      });
      this.errorMessage = missingFields.length > 0 ? `Please fill in: ${missingFields.join(', ')}` : 'Please fill in all required fields.';
      return;
    }

    const sanitizeHtml = (str: string) => {
      if (typeof str !== 'string') return '';
      return str.replace(/<[^>]*>/g, '').trim();
    };

    const formValue = this.medicationForm.value;
    this.isLoading = true;

    const reminderTimes24h = validTimes.map(time12h => {
      const parts = time12h.split(' ');
      let [hours, minutes] = parts[0].split(':').map(Number);
      const period = parts[1];
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }).sort();

    const payload = {
      name: sanitizeHtml(formValue.name),
      dosage: sanitizeHtml(formValue.dosage),
      dosageType: formValue.dosageType,
      category: sanitizeHtml(formValue.category),
      notes: sanitizeHtml(formValue.notes),
      isPillboxConnected: formValue.isPillboxConnected,
      timeSchedule: reminderTimes24h,
      stockLevel: formValue.stockLevel,
      frequency: 'daily',
      startDate: formValue.startDate
    };

    from(this.medicationService.addMedication(payload)).pipe(
      finalize(() => {
        this.isLoading = false;
      })
    ).subscribe({
      next: (response) => {
        this.medicationService.notifyRemindersUpdated();
        this.router.navigate(['/upcoming-reminders']);
      },
      error: (error: any) => {
        console.error('Add medication error:', error);
        this.errorMessage = error?.error?.message || error?.message || 'Failed to add medication.';
      }
    });
  }

  private getFieldLabel(key: string): string {
    const labels: { [key: string]: string } = {
      name: 'Medication Name',
      dosageType: 'Dosage Type',
      dosage: 'Dosage',
      category: 'Category',
      reminderTimes: 'Reminder Times'
    };
    return labels[key] || key;
  }

  goToDashboard() {
    this.router.navigate(['/upcoming-reminders']);
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  isTimeValid(time: string | null): boolean {
    if (!time) return false;
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  getTimeLabel(time: string): string {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const hour = hours;
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 18) return 'Afternoon';
    if (hour >= 18 && hour < 22) return 'Evening';
    return 'Night';
  }

  getTimeLabelColor(time: string): string {
    const label = this.getTimeLabel(time);
    switch (label) {
      case 'Morning': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Afternoon': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Evening': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Night': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }
}
