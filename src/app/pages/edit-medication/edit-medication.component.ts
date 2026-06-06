import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { MedicationService, Medication } from '../../services/medication.service';
import { NotificationService } from '../../services/notification.service';
import { BottomNavigationComponent } from '../../components/bottom-navigation/bottom-navigation.component';

@Component({
  selector: 'app-edit-medication',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, BottomNavigationComponent],
  templateUrl: './edit-medication.component.html',
  styleUrl: './edit-medication.component.css'
})
export class EditMedicationPageComponent implements OnInit {
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  medicationForm: FormGroup;
  medicationId: string = '';
  currentMedication: Medication | null = null;

  // Time Picker Properties
  selectedTimes: (string | null)[] = [null, null, null];
  showTimePicker = false;
  currentTimeIndex = 0;
  tempTime = '00:00 AM';
  tempHour = 12;
  tempMinute = 0;
  tempPeriod: 'AM' | 'PM' = 'AM';
  timePresets = ['08:00 AM', '12:00 PM', '02:00 PM', '06:00 PM', '08:00 PM', '10:00 PM'];

  constructor(
    private medicationService: MedicationService,
    private notificationService: NotificationService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.medicationForm = this.fb.group({
      name: ['', Validators.required],
      dosageType: ['', Validators.required],
      dosage: ['', Validators.required],
      category: ['', Validators.required],
      reminderTimes: [''],
      stockLevel: [0, [Validators.required, Validators.min(1), Validators.max(30)]],
      notes: [''],
      isPillboxConnected: [false],
    });
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.medicationId = params['id'];
      if (this.medicationId) {
        this.loadMedication();
      }
    });
  }

  loadMedication() {
    this.isLoading = true;
    this.medicationService.getMedications().subscribe({
      next: (response: any) => {
        this.isLoading = false;
        const medications = response?.medications || [];
        const med = medications.find((m: any) => m.id === this.medicationId);
        if (med) {
          this.currentMedication = med;
          this.populateForm(med);
        } else {
          this.errorMessage = 'Medication not found';
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error loading medication:', err);
        this.errorMessage = 'Failed to load medication details';
      }
    });
  }

  populateForm(medication: Medication) {
    // Extract times reliably
    let times: string[] = [];
    const sourceTimes = (medication as any).timeSchedule || medication.reminderTimes;
    
    if (Array.isArray(sourceTimes)) {
      times = sourceTimes;
    } else if (typeof sourceTimes === 'string') {
      try {
        const parsed = JSON.parse(sourceTimes);
        times = Array.isArray(parsed) ? parsed : [sourceTimes];
      } catch (e) {
        times = sourceTimes.split(',').map(t => t.trim()).filter(t => t);
      }
    }

    // Convert 24h to 12h for display
    this.selectedTimes = [null, null, null];
    times.forEach((time, index) => {
      if (index < 3 && time) {
        this.selectedTimes[index] = this.convertTo12h(time);
      }
    });
    
    this.medicationForm.patchValue({
      name: medication.name,
      dosageType: medication.dosageType || 'specific',
      dosage: medication.dosage,
      category: medication.category,
      reminderTimes: this.selectedTimes.filter(t => t !== null).join(','),
      stockLevel: medication.stockLevel || 0,
      notes: medication.notes || '',
      isPillboxConnected: medication.isPillboxConnected || false,
    });
  }

  private convertTo12h(time24: string): string {
    if (!time24) return '';
    if (time24.includes('AM') || time24.includes('PM')) return time24;
    
    let [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
  }

  // Time Picker Methods
  openTimePicker(index: number) {
    this.currentTimeIndex = index;
    this.showTimePicker = true;
    
    // Load existing time if set
    if (this.selectedTimes[index]) {
      const parts = this.selectedTimes[index]!.split(' ');
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
      this.errorMessage = 'Please fill in all required fields.';
      return;
    }

    this.isLoading = true;
    const formValue = this.medicationForm.value;

    // Convert back to 24h for backend
    const timeSchedule = validTimes.map(time12h => {
      const parts = time12h.split(' ');
      let [hours, minutes] = parts[0].split(':').map(Number);
      const period = parts[1];
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }).sort();

    const sanitizeHtml = (str: string) => {
      if (typeof str !== 'string') return '';
      return str.replace(/<[^>]*>/g, '').trim();
    };

    const payload = {
      name: sanitizeHtml(formValue.name),
      dosage: sanitizeHtml(formValue.dosage),
      dosageType: formValue.dosageType,
      category: sanitizeHtml(formValue.category),
      notes: sanitizeHtml(formValue.notes),
      isPillboxConnected: formValue.isPillboxConnected,
      stockLevel: formValue.stockLevel,
      timeSchedule: timeSchedule
    };

    this.medicationService.updateMedication(this.medicationId, payload).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = '✓ Medication Updated Successfully';
        this.medicationService.notifyRemindersUpdated();
        setTimeout(() => this.router.navigate(['/dashboard']), 2000);
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = error?.error?.message || 'Failed to update medication.';
      }
    });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  getTimeLabel(time: string): string {
    if (!time) return '';
    const parts = time.split(' ');
    let hours = parseInt(parts[0].split(':')[0]);
    const period = parts[1];
    
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    if (hours >= 5 && hours < 12) return 'Morning';
    if (hours >= 12 && hours < 18) return 'Afternoon';
    if (hours >= 18 && hours < 22) return 'Evening';
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
