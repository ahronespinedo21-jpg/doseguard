import { Injectable, NgZone } from '@angular/core';
import { firstValueFrom, from, Observable, of, Subject, throwError, combineLatest, BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiConfigService } from './api-config.service';
import { HttpClient } from '@angular/common/http';
import { tap, catchError, delay, switchMap, debounceTime, distinctUntilChanged, map, finalize, shareReplay, timeout, startWith } from 'rxjs/operators';
import { NotificationService } from './notification.service';
import { Firestore, collection, doc, setDoc, getDocs, deleteDoc, updateDoc, collectionData, onSnapshot } from '@angular/fire/firestore';
import { Database, ref as dbRef, set as dbSet, onValue, off, DataSnapshot } from '@angular/fire/database';
import { Auth, authState } from '@angular/fire/auth';
import { RefreshService } from './refresh.service';

export interface Medication {
  id?: string;
  name: string;
  medicationName?: string;
  dosage: string;
  dosageType?: 'estimated' | 'specific';
  frequency: string;
  schedule?: string[];
  timeSchedule?: string[];
  reminderSchedule?: string[];
  amount?: number;
  reminderTimes?: string[];
  reminderTime?: string;
  isPillboxConnected?: boolean;
  
  stockLevel?: number;
  stock?: number;
  currentStock?: number;
  maxCapacity?: number;
  category?: string;
  notes?: string;
  reason?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  userId?: string;
  status?: 'pending' | 'taken' | 'missed';
  pending?: boolean;
  taken?: boolean;
  missed?: boolean;
  reminders?: any[];
  createdAt?: string;
}

export interface AdherenceRecord {
  id: string;
  medicationId: string;
  scheduledTime: string;
  takenTime?: string;
  status: 'taken' | 'missed' | 'pending';
  date: string;
}

@Injectable({
  providedIn: 'root'
})
export class MedicationService {
  private get API_URL(): string {
    return this.apiConfig.getBaseUrl();
  }
  private readonly MEDICATIONS_STORAGE_KEY = 'doseguard_medications';
  private readonly ADHERENCE_STORAGE_KEY = 'doseguard_adherence';

  private medicationsSubject = new BehaviorSubject<Medication[]>([]);

  /**
   * Single source of truth for all UI components.
   * Sourced directly from medicationsSubject so BOTH:
   *  - Firestore onSnapshot updates, and
   *  - RTDB optimistic pushes
   * flow through the same stream instantly.
   */
  public medications$: Observable<Medication[]>;

  private adherenceRecordsSubject = new BehaviorSubject<AdherenceRecord[]>([]);
  public adherenceRecords$ = this.adherenceRecordsSubject.asObservable();

  private adherenceStatsSubject = new BehaviorSubject<any>(null);
  public adherenceStats$ = this.adherenceStatsSubject.asObservable();

  private remindersUpdatedSubject = new Subject<void>();
  public remindersUpdated$ = this.remindersUpdatedSubject.asObservable();

  private refreshMedicationsSubject = new Subject<void>();
  private lastMedicationsFetch: Medication[] = [];
  private isFetching = false;
  private currentFetch$: Observable<any> | null = null;

  // RTDB ESP32 sync — reference kept so we can detach on logout
  private rtdbTakenRef: any = null;

  /**
   * Last RTDB snapshot received from the ESP32 listener.
   * Cached here so the Firestore onSnapshot tap can replay RTDB taken=true
   * flags even if they arrived before Firestore finished loading.
   * This fixes the core timing race where onValue fires immediately on attach
   * (with taken=true from a previous session) before medicationsSubject has
   * any Firestore data to match against.
   */
  private lastRtdbSnapshot: Record<string, any> | null = null;

  constructor(
    private authService: AuthService,
    private apiConfig: ApiConfigService,
    private http: HttpClient,
    private notificationService: NotificationService,
    private firestore: Firestore,
    private auth: Auth,
    private zone: NgZone,
    private refreshService: RefreshService,
    private database: Database
  ) {
    // ── medications$ is driven by medicationsSubject (BehaviorSubject) so that
    // BOTH Firestore onSnapshot updates AND RTDB optimistic pushes propagate
    // through one unified reactive stream to every subscriber.
    this.medications$ = this.medicationsSubject.asObservable();

    const safeAuthState$ = authState(this.auth).pipe(
      timeout(3000),
      catchError(err => {
        console.warn('[SYNC] [AUTH] Firebase authState initialization timed out or failed, continuing with null:', err);
        return of(null);
      }),
      startWith(null)
    );

    // Firestore onSnapshot feeds INTO medicationsSubject; it does NOT replace
    // medications$ directly.  This keeps the RTDB optimistic pushes visible.
    combineLatest([
      safeAuthState$,
      this.refreshService.refreshAction$
    ]).pipe(
      switchMap(([user, _refreshTick]) => {
        console.log('[SYNC] [STREAM] [FIRESTORE] Auth state emitted:', user ? user.uid : 'null');
        if (!user) {
          const customUser = this.authService.getCurrentUser();
          if (customUser && (customUser.email || customUser.id)) {
            console.log('[SYNC] [STREAM] [AUTH] Firebase Auth session still initializing for:', customUser.email || 'custom user');
            const cachedMeds = this.medicationsSubject.value || [];
            console.log('[SYNC] [STREAM] [AUTH] Emitting cached medications during init, count:', cachedMeds.length);
            return of(cachedMeds);
          }
          console.log('[SYNC] [STREAM] [AUTH] No authenticated user found, returning empty array.');
          return of([]);
        }

        const medsRef = collection(this.firestore, `users/${user.uid}/medications`);
        console.log('[SYNC] [FIRESTORE] Attaching onSnapshot listener:', `users/${user.uid}/medications`);

        return new Observable<Medication[]>(subscriber => {
          const unsubscribe = onSnapshot(medsRef,
            (snapshot) => {
              const freshMeds: Medication[] = [];
              snapshot.forEach(d => {
                freshMeds.push({ id: d.id, ...d.data() } as Medication);
              });
              console.log('[SYNC] [STREAM] raw onSnapshot received count:', freshMeds.length);

              // ── Merge: preserve any in-memory taken=true flags that the RTDB
              // listener has already applied optimistically but Firestore has
              // not yet confirmed.  This prevents a stale snapshot from erasing
              // an ESP32 dispensing event before the Firestore write resolves.
              const current = this.medicationsSubject.value || [];
              const merged = freshMeds.map(fm => {
                const inMem = current.find(c => c.id === fm.id);
                if (inMem && Array.isArray(inMem.reminders)) {
                  const updatedReminders = (fm.reminders || []).map((r: any) => {
                    const match = inMem.reminders?.find((imr: any) => imr.reminderTime === r.reminderTime || imr.time === r.time);
                    if (match && match.status === 'taken' && r.status !== 'taken') {
                      return { ...r, status: 'taken' };
                    }
                    return r;
                  });
                  return { ...fm, reminders: updatedReminders };
                }
                return fm;
              });

              this.zone.run(() => subscriber.next(merged));
            },
            (error) => {
              console.error('[SYNC] [STREAM] raw onSnapshot error:', error);
              const cachedMeds = this.medicationsSubject.value || [];
              this.zone.run(() => subscriber.next(cachedMeds));
            }
          );
          return () => unsubscribe();
        }).pipe(
          map(meds => {
            console.log('[SYNC] [STREAM] Running missed reminders detection');
            return this.detectAndProcessMissedReminders(meds);
          }),
          tap(meds => {
            // Apply any RTDB taken=true flags that arrived before Firestore loaded.
            // This is the fix for the timing race: RTDB onValue fires on attach
            // immediately, but medicationsSubject was empty at that point.
            const withRtdb = this.applyRtdbSnapshotToMeds(meds);
            this.medicationsSubject.next(withRtdb);
            this.saveToStorage(withRtdb);
            console.log('[SYNC] Medications loaded, count:', withRtdb.length);
            console.log('[SYNC] [STREAM] medicationsSubject updated, count:', withRtdb.length);
          }),
          catchError(innerErr => {
            console.error('[SYNC] [STREAM] Inner stream error, falling back to cached:', innerErr);
            return of(this.medicationsSubject.value || []);
          })
        );
      })
    ).subscribe({      // side-effect only — feeds medicationsSubject
      error: (err) => {
        console.error('[SYNC] [STREAM] Firestore side-effect pipeline errored (non-fatal):', err);
      }
    });

    this.loadFromStorage();

    window.addEventListener('medication_adherence_action', (e: any) => {
      if (e.detail) {
        const { medicationId, status, time } = e.detail;
        this.logReminder(medicationId, status, time, new Date().toISOString()).subscribe();
      }
    });

    this.refreshMedicationsSubject.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(() => this.getMedicationsInternal())
    ).subscribe();

    // Start RTDB ESP32 taken-status listener after auth resolves
    authState(this.auth).pipe(
      startWith(null)
    ).subscribe(user => {
      // Detach any previous listener before attaching a new one
      this.detachRtdbTakenListener();
      if (user) {
        this.listenToRtdbTakenStatus(user.uid);
      }
    });
  }

  private loadFromStorage(): void {
    const savedMeds = localStorage.getItem(this.MEDICATIONS_STORAGE_KEY);
    if (savedMeds) {
      try {
        const meds = JSON.parse(savedMeds);
        this.medicationsSubject.next(meds);
        this.lastMedicationsFetch = meds;
      } catch (e) {
        console.error('❌ Error parsing medications from storage:', e);
      }
    }

    const savedAdherence = localStorage.getItem(this.ADHERENCE_STORAGE_KEY);
    if (savedAdherence) {
      try {
        this.adherenceRecordsSubject.next(JSON.parse(savedAdherence));
      } catch (e) {
        console.error('❌ Error parsing adherence from storage:', e);
      }
    }
  }

  private saveMedications(medications: Medication[]): void {
    const seenIds = new Set<string>();
    const uniqueMeds: Medication[] = [];

    medications.forEach(med => {
      const id = med.id || med.name;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        uniqueMeds.push({
          ...med,
          reminderTimes: this.parseTimeSchedule(med.timeSchedule || med.reminderTimes || [])
        });
      }
    });

    localStorage.setItem(this.MEDICATIONS_STORAGE_KEY, JSON.stringify(uniqueMeds));
    this.medicationsSubject.next(uniqueMeds);
    this.lastMedicationsFetch = uniqueMeds;
  }

  private saveToStorage(medications: Medication[]): void {
      localStorage.setItem(this.MEDICATIONS_STORAGE_KEY, JSON.stringify(medications));
  }

  private saveAdherence(records: AdherenceRecord[]): void {
    localStorage.setItem(this.ADHERENCE_STORAGE_KEY, JSON.stringify(records));
    this.adherenceRecordsSubject.next(records);
  }

  private parseTimeSchedule(timeSchedule: any): string[] {
    if (!timeSchedule) return [];
    if (Array.isArray(timeSchedule)) {
      return timeSchedule.filter(t => t && typeof t === 'string');
    }
    if (typeof timeSchedule === 'string') {
      try {
        const parsed = JSON.parse(timeSchedule);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        return timeSchedule.split(',').map(t => t.trim()).filter(t => t);
      }
    }
    return [];
  }

  format24hto12h(time24h: string): string {
    if (!time24h) return '08:00 AM';
    try {
      const parts = time24h.split(':');
      let hour = parseInt(parts[0], 10);
      const minute = parts[1];
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      hour = hour ? hour : 12;
      return `${String(hour).padStart(2, '0')}:${minute} ${ampm}`;
    } catch (e) {
      return time24h;
    }
  }

  format12hto24h(time12h: string): string {
    if (!time12h) return '08:00';
    try {
      const parts = time12h.split(' ');
      let [hours, minutes] = parts[0].split(':').map(Number);
      const period = parts[1];
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } catch (e) {
      return time12h;
    }
  }

  checkAndGetReminderStatus(med: Medication, time: string): 'pending' | 'taken' | 'missed' {
    const existing = med.reminders?.find((r: any) => r.reminderTime === time || r.time === time);
    let status: 'pending' | 'taken' | 'missed' = 'pending';

    if (existing && (existing.status === 'taken' || existing.status === 'missed' || existing.status === 'pending')) {
      status = existing.status;
    } else {
      try {
        const now = new Date();
        const parts = time.split(' ');
        if (parts.length >= 2) {
          let [hours, minutes] = parts[0].split(':').map(Number);
          const period = parts[1];
          if (period === 'PM' && hours < 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;

          const scheduledDate = new Date();
          scheduledDate.setHours(hours, minutes, 0, 0);

          // Prevent auto-missed bug: if scheduled time today is before creation time, it's pending for tomorrow.
          const createdDate = med.createdAt ? new Date(med.createdAt) : new Date();
          if (scheduledDate.getTime() < createdDate.getTime()) {
            status = 'pending';
          } else {
            const gracePeriodMs = 30 * 60 * 1000;
            if (now.getTime() > (scheduledDate.getTime() + gracePeriodMs)) {
              status = 'missed';
            } else {
              status = 'pending';
            }
          }
        }
      } catch (e) {
        console.error('Error parsing scheduled time:', time, e);
      }
    }

    // Calculate pending count for diagnostic logs
    const medications = this.medicationsSubject.value || [];
    let pendingCount = 0;
    medications.forEach(m => {
      if (m.isActive !== false) {
        const schedules = m.schedule || [];
        schedules.forEach(t => {
          const ext = m.reminders?.find((r: any) => r.reminderTime === t || r.time === t);
          if (ext && ext.status === 'taken') return;
          if (ext && ext.status === 'missed') return;
          
          try {
            const now = new Date();
            const parts = t.split(' ');
            if (parts.length >= 2) {
              let [hours, minutes] = parts[0].split(':').map(Number);
              const period = parts[1];
              if (period === 'PM' && hours < 12) hours += 12;
              if (period === 'AM' && hours === 12) hours = 0;

              const scheduledDate = new Date();
              scheduledDate.setHours(hours, minutes, 0, 0);

              const createdDate = m.createdAt ? new Date(m.createdAt) : new Date();
              if (scheduledDate.getTime() < createdDate.getTime()) {
                pendingCount++;
                return;
              }

              const gracePeriodMs = 30 * 60 * 1000;
              if (now.getTime() <= (scheduledDate.getTime() + gracePeriodMs)) {
                pendingCount++;
              }
            }
          } catch {}
        });
      }
    });

    console.log(`[STATUS] [TIME_CHECK] current time: ${new Date().toISOString()}, reminder time: ${time}, computed status: ${status}, pending count: ${pendingCount}`);
    return status;
  }

  private getMedicationsInternal(): Observable<any> {
    if (this.currentFetch$) {
      return this.currentFetch$;
    }

    this.isFetching = true;
    const user = this.authService.getCurrentUser();
    
    if (!user || !user.id) {
       this.isFetching = false;
       return of({ medications: this.lastMedicationsFetch });
    }

    const medsRef = collection(this.firestore, `users/${user.id}/medications`);
    
    this.currentFetch$ = from(getDocs(medsRef)).pipe(
      map(snapshot => {
        const meds: Medication[] = [];
        snapshot.forEach(doc => {
          meds.push({ id: doc.id, ...doc.data() } as Medication);
        });
        return { medications: meds };
      }),
      tap((response: any) => {
        const meds = response.medications || [];
        this.saveMedications(meds);
      }),
      catchError((error) => {
        console.error('❌ Failed to fetch medications from Firestore:', error);
        return of({ medications: this.lastMedicationsFetch });
      }),
      finalize(() => {
        this.isFetching = false;
        this.currentFetch$ = null;
      }),
      shareReplay(1)
    );

    return this.currentFetch$;
  }

  getMedications(): Observable<any> {
    console.log('[SYNC] getMedications() returning centralized realtime stream medications$');
    return this.medications$.pipe(
      map(meds => ({ medications: meds }))
    );
  }

  refreshMedications(): void {
    console.log('[SYNC] Realtime stream is active, manual refresh skipped. Triggering global refresh instead.');
    this.refreshService.triggerRefresh();
    this.refreshMedicationsSubject.next();
  }

  getLowStockMedications(): Observable<any> {
    const meds = this.medicationsSubject.value || [];
    const lowStock = meds.filter(m => m.stockLevel !== undefined && m.stockLevel < 10);
    return of({ success: true, count: lowStock.length, medications: lowStock });
  }

  async addMedication(medication: any) {
    const userId = this.getActiveUserId();
    const customUser = this.authService.getCurrentUser();

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Name Validation
    if (!medication.name || typeof medication.name !== 'string' || medication.name.trim().length < 2 || medication.name.trim().length > 100) {
      throw new Error('Medication name must be between 2 and 100 characters.');
    }

    // Dosage Validation
    if (!medication.dosage || typeof medication.dosage !== 'string' || medication.dosage.trim().length < 1 || medication.dosage.trim().length > 50) {
      throw new Error('Dosage description must be between 1 and 50 characters.');
    }

    // Duplicate Medication Name Check (Case-Insensitive)
    const currentMeds = this.medicationsSubject.value || [];
    const duplicateName = currentMeds.find(m => m.isActive && m.name.trim().toLowerCase() === medication.name.trim().toLowerCase());
    if (duplicateName) {
      throw new Error(`Medication '${medication.name}' already exists.`);
    }

    // Unify schedules: ensure we populate both schedule (12h format) and timeSchedule (24h format)
    const timeSchedule = medication.timeSchedule || [];
    const schedule = medication.schedule || (timeSchedule.length ? timeSchedule.map((t: string) => this.format24hto12h(t)) : ['08:00 AM']);
    const finalTimeSchedule = timeSchedule.length ? timeSchedule : schedule.map((t: string) => this.format12hto24h(t));

    // Duplicate Schedule Time Check
    if (finalTimeSchedule && finalTimeSchedule.length > 0) {
      const uniqueTimes = new Set(finalTimeSchedule.map((t: string) => t.trim()));
      if (uniqueTimes.size !== finalTimeSchedule.length) {
        throw new Error('Schedule contains duplicate times.');
      }
    }

    const medsCollection = collection(
      this.firestore,
      `users/${userId}/medications`
    );

    const medDocRef = doc(medsCollection);

    // Validate stock input before saving
    const inputStock = medication.stockLevel !== undefined ? medication.stockLevel : (medication.stock !== undefined ? medication.stock : 30);
    if (typeof inputStock !== 'number' || isNaN(inputStock) || inputStock < 1 || inputStock > 30) {
      throw new Error('Invalid stock level. Value must be between 1 and 30.');
    }

    const localMedication: any = {
      id: medDocRef.id,
      userId: userId,
      userName: customUser ? `${customUser.firstName || ''} ${customUser.lastName || ''}`.trim() : '',
      userEmail: customUser?.email || '',
      name: medication.name || '',
      medicationName: medication.name || '',
      dosage: medication.dosage || '',
      dosageType: medication.dosageType || 'estimated',
      category: medication.category || 'General',
      frequency: medication.frequency || 'daily',
      schedule: schedule,
      timeSchedule: finalTimeSchedule,
      reminderSchedule: schedule,
      reminderTime: schedule[0] || '08:00 AM',
      createdAt: new Date().toISOString(),
      isActive: true,
      pending: true,
      taken: false,
      missed: false,
      status: 'pending',
      stockLevel: inputStock,
      stock: inputStock,
      currentStock: inputStock,
      maxCapacity: 30,
      notes: medication.notes || '',
      isPillboxConnected: medication.isPillboxConnected || false,
      reminders: schedule.map((time: string) => ({
        reminderTime: time,
        time: time,
        status: 'pending'
      }))
    };

    // Recursively sanitize all undefined values to prevent Firebase errors
    const sanitizedMedication = this.sanitizeData(localMedication);

    // STEP 2 & 3 — IMMEDIATE LOCAL UI UPDATE
    const latestMeds = this.medicationsSubject.value || [];
    this.medicationsSubject.next([
      sanitizedMedication,
      ...latestMeds
    ]);
    this.saveMedications([sanitizedMedication, ...latestMeds]);

    console.log(
      '[SYNC] [DASHBOARD] Local dashboard updated instantly for added medication'
    );

    // STEP 5 — SCHEDULE ALARMS IMMEDIATELY
    if (sanitizedMedication.schedule && sanitizedMedication.schedule.length > 0) {
      this.notificationService.scheduleMultipleReminders(
        medDocRef.id,
        sanitizedMedication.name,
        sanitizedMedication.schedule,
        sanitizedMedication.dosage
      ).catch(err => console.error('Notification scheduling error:', err));
    }

    this.refreshMedications();

    // STEP 6 — FIREBASE BACKGROUND SAVE (Firestore)
    console.log(
      '[SYNC] [FIRESTORE] Saving medication path:',
      `users/${userId}/medications/${medDocRef.id}`
    );

    try {
      await setDoc(medDocRef, sanitizedMedication);
      console.log(
        '[SYNC] [FIRESTORE] Saved medication to Firestore'
      );
    } catch (err) {
      console.error('[SYNC] [FIRESTORE] Failed to sync to Firestore in background:', err);
    }

    // STEP 7 — PARALLEL SAVE TO FIREBASE REALTIME DATABASE (for ESP32 IoT)
    // Writes to: users/{uid}/medications/med1
    // reminderTime stays in 12h format (e.g. "08:00 PM") as expected by the ESP32
    try {
      const rtdbPath = `users/${userId}/medications/med1`;
      const reminderTime12h = sanitizedMedication.schedule?.[0] || sanitizedMedication.reminderTime || '08:00 AM';
      const rtdbPayload = {
        medicineName: sanitizedMedication.name,
        medicationName: sanitizedMedication.medicationName,
        reminderTime: reminderTime12h,
        taken: false,
        reminders: (sanitizedMedication.reminders || []).map((r: any) => ({
          time: r.time || r.reminderTime || '08:00 AM',
          status: r.status || 'pending'
        })),
        stockLevel: sanitizedMedication.stockLevel,
        stock: sanitizedMedication.stock,
        currentStock: sanitizedMedication.currentStock,
        maxCapacity: sanitizedMedication.maxCapacity,
        reminderSchedule: sanitizedMedication.reminderSchedule,
        status: sanitizedMedication.status,
        createdAt: sanitizedMedication.createdAt
      };

      console.log(
        '%c[RTDB] Attempting save to Realtime Database...',
        'color: #4fc3f7; font-weight: bold;',
        '\nPath:', rtdbPath,
        '\nPayload:', JSON.stringify(rtdbPayload)
      );

      await dbSet(dbRef(this.database, rtdbPath), rtdbPayload);

      console.log(
        '%c[RTDB] ✅ SUCCESS — Realtime Database updated for ESP32!',
        'color: #81c784; font-weight: bold;',
        '\nPath:', rtdbPath,
        '\nmedicineName:', rtdbPayload.medicineName,
        '\nreminderTime:', rtdbPayload.reminderTime,
        '\nremindersCount:', rtdbPayload.reminders.length
      );
    } catch (rtdbErr: any) {
      // Non-blocking: log error but do not disrupt the rest of the app
      console.error(
        '%c[RTDB] ❌ FAILED — Realtime Database save error',
        'color: #ef5350; font-weight: bold;',
        '\nError Code:', rtdbErr?.code || 'unknown',
        '\nError Message:', rtdbErr?.message || rtdbErr,
        '\nFull Error:', rtdbErr,
        '\n\nACTION REQUIRED: If error is PERMISSION_DENIED, open Firebase Console → Realtime Database → Rules and set read/write to true for testing.'
      );
    }
  }

  // Recursive data sanitizer to ensure safe Firestore writes
  private sanitizeData(data: any): any {
    if (data === null || data === undefined) return null;
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }
    if (typeof data === 'object') {
      const sanitized: any = {};
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined) {
          sanitized[key] = this.sanitizeData(data[key]);
        }
      });
      return sanitized;
    }
    return data;
  }

  // ─── ESP32 / RTDB Taken-Status Sync ─────────────────────────────────────────

  /**
   * Helper function to find the reminder slot closest to the current local time.
   */
  private getClosestReminderSlot(schedule: string[]): string {
    if (!schedule || schedule.length === 0) return '08:00 AM';

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    let closestTime = schedule[0];
    let minDifference = Infinity;

    schedule.forEach(timeStr => {
      try {
        const parts = timeStr.split(' ');
        if (parts.length >= 2) {
          let [hours, minutes] = parts[0].split(':').map(Number);
          const period = parts[1];
          if (period === 'PM' && hours < 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;

          const slotMinutes = hours * 60 + minutes;
          let diff = Math.abs(nowMinutes - slotMinutes);
          // 24-hour wrap around
          if (diff > 12 * 60) {
            diff = 24 * 60 - diff;
          }

          if (diff < minDifference) {
            minDifference = diff;
            closestTime = timeStr;
          }
        }
      } catch (e) {
        console.error('[REMINDER_SLOT] Error parsing schedule time in getClosestReminderSlot:', timeStr, e);
      }
    });

    return closestTime;
  }

  /**
   * Attach a Firebase Realtime Database onValue listener to:
   *   users/{uid}/medications   ← full node, not just med1
   *
   * Listens for ANY medication key (med1, med2 …) that has taken === true.
   * Matches by medicineName (case-insensitive) to the corresponding Firestore
   * medication and performs a three-step sync:
   *   1. Optimistic BehaviorSubject push  → instant UI update
   *   2. logReminder()                    → adherence record
   *   3. Firestore updateDoc()            → durable persistence + onSnapshot
   */
  private listenToRtdbTakenStatus(uid: string): void {
    const path = `users/${uid}/medications`;
    this.rtdbTakenRef = dbRef(this.database, path);

    console.log('[RTDB] [SYNC] Listening to ESP32 status on path:', path);

    onValue(this.rtdbTakenRef, (snapshot: DataSnapshot) => {
      const allRtdbMeds = snapshot.val();

      if (!allRtdbMeds || typeof allRtdbMeds !== 'object') {
        console.log('[RTDB] [SYNC] No medication data at RTDB path.');
        this.lastRtdbSnapshot = null;
        return;
      }

      this.lastRtdbSnapshot = allRtdbMeds;

      const normalize = (v: string) => (v || '').trim().toLowerCase();

      Object.entries(allRtdbMeds).forEach(([rtdbKey, rtdbMedRaw]) => {
        const rtdbMed = rtdbMedRaw as any;
        if (!rtdbMed || typeof rtdbMed !== 'object') return;

        const medicineName: string = (rtdbMed.medicineName || '').trim();

        // Parse slot-level reminders if available
        let rtdbReminders: any[] = [];
        if (rtdbMed.reminders) {
          if (Array.isArray(rtdbMed.reminders)) {
            rtdbReminders = rtdbMed.reminders;
          } else if (typeof rtdbMed.reminders === 'object') {
            rtdbReminders = Object.values(rtdbMed.reminders);
          }
        }

        const currentMeds = this.medicationsSubject.value || [];
        if (currentMeds.length === 0) {
          console.log('[SYNC] [ESP32] medicationsSubject is empty, caching snapshot for replay.');
          return;
        }

        const matchedMed = currentMeds.find(m => {
          if (!m.name) return false;
          if (medicineName) {
            return normalize(m.name) === normalize(medicineName);
          }
          return m.isActive !== false;
        }) ?? currentMeds.find(m => m.isActive !== false);

        if (!matchedMed || !matchedMed.id) {
          console.warn(`[SYNC] [ESP32] No matching Firestore medication for "${medicineName}". Available:`, currentMeds.map(m => m.name));
          return;
        }

        const schedule = matchedMed.schedule || matchedMed.reminderTimes || (matchedMed.reminderTime ? [matchedMed.reminderTime] : []);
        if (schedule.length === 0) {
          console.warn(`[SYNC] [ESP32] Matched medication "${matchedMed.name}" has no schedule.`);
          return;
        }

        let slotUpdated = false;

        // Process slot-level statuses from RTDB
        if (rtdbReminders.length > 0) {
          rtdbReminders.forEach((rtdbRem: any) => {
            if (!rtdbRem || typeof rtdbRem !== 'object') return;
            const rtdbTime = rtdbRem.time || rtdbRem.reminderTime;
            const rtdbStatus = rtdbRem.status;

            if ((rtdbStatus === 'taken' || rtdbStatus === 'missed' || rtdbStatus === 'pending') && rtdbTime) {
              const matchedTime = schedule.find(t => t === rtdbTime || this.format24hto12h(t) === this.format24hto12h(rtdbTime));
              if (matchedTime) {
                const existingReminders: any[] = Array.isArray(matchedMed.reminders) ? [...matchedMed.reminders] : [];
                const currentSlot = existingReminders.find(
                  (r: any) => r.reminderTime === matchedTime || r.time === matchedTime
                );
                const currentStatus = currentSlot?.status || 'pending';

                if (currentStatus !== rtdbStatus) {
                  slotUpdated = true;
                  console.log(`[ESP32] Status update received for medicine: ${matchedMed.name}`);
                  console.log(`[REMINDER_SLOT] Matched slot ${matchedTime} from RTDB`);
                  console.log(`[SYNC] Updating slot status ${currentStatus} → ${rtdbStatus}`);

                  let stockLevel = matchedMed.stockLevel !== undefined ? matchedMed.stockLevel : 30;
                  let stock = matchedMed.stock !== undefined ? matchedMed.stock : 30;
                  let currentStock = matchedMed.currentStock !== undefined ? matchedMed.currentStock : stockLevel;
                  const maxCapacity = matchedMed.maxCapacity !== undefined ? matchedMed.maxCapacity : 30;

                  // Stock changes:
                  // 1. Transition to 'taken' from non-taken: decrement stock by 1
                  if (rtdbStatus === 'taken' && currentStatus !== 'taken') {
                    stockLevel = Math.max(0, stockLevel - 1);
                    stock = Math.max(0, stock - 1);
                    currentStock = Math.max(0, currentStock - 1);
                  }
                  // 2. Transition from 'taken' to non-taken (reset to pending or missed): increment stock back by 1
                  else if (currentStatus === 'taken' && rtdbStatus !== 'taken') {
                    stockLevel = Math.min(maxCapacity, stockLevel + 1);
                    stock = Math.min(maxCapacity, stock + 1);
                    currentStock = Math.min(maxCapacity, currentStock + 1);
                  }

                  const updatedReminders = schedule.map((time: string) => {
                    const existing = existingReminders.find((r: any) => r.reminderTime === time || r.time === time);
                    if (time === matchedTime) {
                      return { reminderTime: time, time: time, status: rtdbStatus };
                    }
                    return { reminderTime: time, time: time, status: existing?.status || 'pending' };
                  });

                  this.zone.run(() => {
                    const updatedMeds = (this.medicationsSubject.value || []).map(m =>
                      m.id === matchedMed.id ? { ...m, reminders: updatedReminders, stockLevel, stock, currentStock, maxCapacity } : m
                    );
                    this.medicationsSubject.next(updatedMeds);
                    this.saveToStorage(updatedMeds);
                  });

                  this.logReminder(matchedMed.id!, rtdbStatus, matchedTime, new Date().toISOString()).subscribe();

                  const userId = this.getActiveUserId();
                  if (userId) {
                    const docRef = doc(this.firestore, `users/${userId}/medications/${matchedMed.id}`);
                    from(updateDoc(docRef, { reminders: updatedReminders, stockLevel, stock, currentStock, maxCapacity })).subscribe({
                      next: () => console.log(`[SYNC] [FIRESTORE] Firestore reminder slot and stock updated from RTDB slot-level event (${rtdbStatus})`),
                      error: (err) => console.error('[SYNC] [ESP32] ❌ Firestore updateDoc failed:', err)
                    });
                  }
                }
              }
            }
          });
        }

        // Fallback: legacy taken = true
        if (!slotUpdated && rtdbMed.taken === true) {
          console.log(`[ESP32] [BACKWARD_COMPATIBILITY] Hand detection received via legacy taken flag for medicine: ${medicineName}`);

          const pendingSlot = this.getClosestReminderSlot(schedule);
          console.log('[REMINDER_SLOT] [LEGACY] Matched closest slot:', pendingSlot);

          const existingReminders: any[] = Array.isArray(matchedMed.reminders) ? [...matchedMed.reminders] : [];
          const alreadyTaken = existingReminders.some(
            (r: any) => (r.reminderTime === pendingSlot || r.time === pendingSlot) && r.status === 'taken'
          );

          if (alreadyTaken) {
            console.log(`[SYNC] [ESP32] Legacy fallback: "${matchedMed.name}" @ ${pendingSlot} already TAKEN — skipping.`);
            return;
          }

          let stockLevel = matchedMed.stockLevel !== undefined ? matchedMed.stockLevel : 30;
          let stock = matchedMed.stock !== undefined ? matchedMed.stock : 30;
          let currentStock = matchedMed.currentStock !== undefined ? matchedMed.currentStock : stockLevel;
          const maxCapacity = matchedMed.maxCapacity !== undefined ? matchedMed.maxCapacity : 30;
          stockLevel = Math.max(0, stockLevel - 1);
          stock = Math.max(0, stock - 1);
          currentStock = Math.max(0, currentStock - 1);

          const updatedReminders = schedule.map((time: string) => {
            const existing = existingReminders.find((r: any) => r.reminderTime === time || r.time === time);
            if (time === pendingSlot) {
              return { reminderTime: time, time: time, status: 'taken' };
            }
            return { reminderTime: time, time: time, status: existing?.status || 'pending' };
          });

          this.zone.run(() => {
            const updatedMeds = (this.medicationsSubject.value || []).map(m =>
              m.id === matchedMed.id ? { ...m, reminders: updatedReminders, stockLevel, stock, currentStock, maxCapacity } : m
            );
            this.medicationsSubject.next(updatedMeds);
            this.saveToStorage(updatedMeds);
          });

          this.logReminder(matchedMed.id!, 'taken', pendingSlot, new Date().toISOString()).subscribe();

          const userId = this.getActiveUserId();
          if (userId) {
            const docRef = doc(this.firestore, `users/${userId}/medications/${matchedMed.id}`);
            from(updateDoc(docRef, { reminders: updatedReminders, stockLevel, stock, currentStock, maxCapacity })).subscribe({
              next: () => console.log('[SYNC] [FIRESTORE] Firestore reminder slot and stock updated from RTDB legacy event'),
              error: (err) => console.error('[SYNC] [ESP32] ❌ Firestore legacy updateDoc failed:', err)
            });
          }
        }
      });
    }, (error: Error) => {
      console.error('[SYNC] [ESP32] RTDB listener error:', error);
    });
  }

  /** Detach the RTDB taken-status listener to prevent memory leaks on logout */
  private detachRtdbTakenListener(): void {
    if (this.rtdbTakenRef) {
      off(this.rtdbTakenRef);
      this.rtdbTakenRef = null;
      console.log('[RTDB] [ESP32] Detached RTDB listener.');
    }
  }

  /**
   * Apply any cached RTDB taken=true flags or slot-level taken statuses to a Firestore medications array.
   */
  private applyRtdbSnapshotToMeds(meds: Medication[]): Medication[] {
    if (!this.lastRtdbSnapshot || meds.length === 0) return meds;

    const normalize = (v: string) => (v || '').trim().toLowerCase();
    let anyChanged = false;

    const result = meds.map(med => {
      // Find matching RTDB medication entry by name
      const rtdbEntry = Object.values(this.lastRtdbSnapshot!).find((entry: any) => {
        if (!entry) return false;
        const rtdbName = (entry.medicineName || '').trim();
        if (rtdbName) {
          return normalize(med.name) === normalize(rtdbName);
        }
        return med.isActive !== false;
      }) as any;

      if (!rtdbEntry) return med;

      const schedule = med.schedule || med.reminderTimes || (med.reminderTime ? [med.reminderTime] : []);
      const existingReminders: any[] = Array.isArray(med.reminders) ? [...med.reminders] : [];
      let updatedReminders = [...existingReminders];
      let medUpdated = false;

      let stockLevel = med.stockLevel !== undefined ? med.stockLevel : 30;
      let stock = med.stock !== undefined ? med.stock : 30;
      let currentStock = med.currentStock !== undefined ? med.currentStock : stockLevel;
      const maxCapacity = med.maxCapacity !== undefined ? med.maxCapacity : 30;

      // Parse slot-level reminders from RTDB snapshot first
      let rtdbReminders: any[] = [];
      if (rtdbEntry.reminders) {
        if (Array.isArray(rtdbEntry.reminders)) {
          rtdbReminders = rtdbEntry.reminders;
        } else if (typeof rtdbEntry.reminders === 'object') {
          rtdbReminders = Object.values(rtdbEntry.reminders);
        }
      }

      if (rtdbReminders.length > 0) {
        rtdbReminders.forEach((rtdbRem: any) => {
          if (!rtdbRem || typeof rtdbRem !== 'object') return;
          const rtdbTime = rtdbRem.time || rtdbRem.reminderTime;
          const rtdbStatus = rtdbRem.status;

          if ((rtdbStatus === 'taken' || rtdbStatus === 'missed' || rtdbStatus === 'pending') && rtdbTime) {
            const matchedTime = schedule.find(t => t === rtdbTime || this.format24hto12h(t) === this.format24hto12h(rtdbTime));
            if (matchedTime) {
              const currentSlot = updatedReminders.find(
                (r: any) => r.reminderTime === matchedTime || r.time === matchedTime
              );
              const currentStatus = currentSlot?.status || 'pending';

              if (currentStatus !== rtdbStatus) {
                medUpdated = true;
                if (rtdbStatus === 'taken' && currentStatus !== 'taken') {
                  stockLevel = Math.max(0, stockLevel - 1);
                  stock = Math.max(0, stock - 1);
                  currentStock = Math.max(0, currentStock - 1);
                } else if (currentStatus === 'taken' && rtdbStatus !== 'taken') {
                  stockLevel = Math.min(maxCapacity, stockLevel + 1);
                  stock = Math.min(maxCapacity, stock + 1);
                  currentStock = Math.min(maxCapacity, currentStock + 1);
                }
                updatedReminders = schedule.map((time: string) => {
                  const existing = updatedReminders.find((r: any) => r.reminderTime === time || r.time === time);
                  if (time === matchedTime) {
                    return { reminderTime: time, time: time, status: rtdbStatus };
                  }
                  return { reminderTime: time, time: time, status: existing?.status || 'pending' };
                });
                console.log(`[ESP32] [REPLAY] Matched slot ${matchedTime} → ${rtdbStatus} from slot-level cached RTDB`);
              }
            }
          }
        });
      }

      // Fallback: legacy taken = true
      if (!medUpdated && rtdbEntry.taken === true) {
        const pendingSlot = this.getClosestReminderSlot(schedule);
        if (pendingSlot) {
          const alreadyTaken = updatedReminders.some(
            (r: any) => (r.reminderTime === pendingSlot || r.time === pendingSlot) && r.status === 'taken'
          );
          if (!alreadyTaken) {
            medUpdated = true;
            stockLevel = Math.max(0, stockLevel - 1);
            stock = Math.max(0, stock - 1);
            currentStock = Math.max(0, currentStock - 1);
            updatedReminders = schedule.map((time: string) => {
              const existing = updatedReminders.find((r: any) => r.reminderTime === time || r.time === time);
              if (time === pendingSlot) {
                return { reminderTime: time, time: time, status: 'taken' };
              }
              return { reminderTime: time, time: time, status: existing?.status || 'pending' };
            });
            console.log(`[ESP32] [REPLAY] Matched closest legacy slot ${pendingSlot} → taken`);
          }
        }
      }

      if (medUpdated) {
        anyChanged = true;
        return { ...med, reminders: updatedReminders, stockLevel, stock, currentStock, maxCapacity };
      }

      return med;
    });

    if (anyChanged) {
      console.log('[SYNC] Updating UI instantly (replay from Firestore load)');
      const userId = this.getActiveUserId();
      if (userId) {
        result.forEach(med => {
          const schedule = med.schedule || med.reminderTimes || (med.reminderTime ? [med.reminderTime] : []);
          const existingInMeds = meds.find(m => m.id === med.id)?.reminders || [];
          
          schedule.forEach(slotTime => {
            const oldSlot = existingInMeds.find((r: any) => r.reminderTime === slotTime || r.time === slotTime);
            const oldStatus = oldSlot?.status || 'pending';
            const newSlot = (med.reminders || []).find((r: any) => r.reminderTime === slotTime || r.time === slotTime);
            const newStatus = newSlot?.status || 'pending';

            if (med.id && oldStatus !== newStatus) {
              const docRef = doc(this.firestore, `users/${userId}/medications/${med.id}`);
              from(updateDoc(docRef, {
                reminders: med.reminders,
                stockLevel: med.stockLevel,
                stock: med.stock,
                currentStock: med.currentStock,
                maxCapacity: med.maxCapacity
              })).subscribe({
                next: () => {
                  console.log(`[SYNC] [FIRESTORE] Firestore reminder slot ${slotTime} and stock updated for replay (${oldStatus} → ${newStatus})`);
                  this.logReminder(med.id!, newStatus, slotTime, new Date().toISOString()).subscribe();
                },
                error: (err) => console.error('[SYNC] [ESP32] [REPLAY] Firestore updateDoc failed:', err)
              });
            }
          });
        });
      }
    }

    return result;
  }


  // ─────────────────────────────────────────────────────────────────────────────

  private getActiveUserId(): string | null {
    const fbUser = this.auth.currentUser;
    if (fbUser) return fbUser.uid;
    const customUser = this.authService.getCurrentUser();
    return customUser ? customUser.id : null;
  }

  // Detect and process expired pending reminders to transition to missed
  private detectAndProcessMissedReminders(meds: Medication[]): Medication[] {
    if (!meds || meds.length === 0) return [];
    const userId = this.getActiveUserId();
    if (!userId) return meds;

    const mappedMeds = meds.map(med => {
      // Guard: if the medication-level taken flag is true (set by RTDB sync),
      // never downgrade any slot to missed — the medication was already taken.
      if (med.taken === true) {
        return med;
      }

      let hasMedChanges = false;
      const schedule = med.schedule || [];
      const currentReminders = Array.isArray(med.reminders) ? [...med.reminders] : [];

      const updatedReminders = schedule.map(time => {
        const existing = currentReminders.find(r => r.reminderTime === time);
        if (existing) {
          // Never overwrite a slot that is already taken or missed
          if (existing.status === 'taken' || existing.status === 'missed') {
            return existing;
          }
          if (existing.status === 'pending') {
            const isPastGrace = this.isReminderTimePastGrace(time, med.createdAt);
            if (isPastGrace) {
              console.log(`[SYNC] [FIRESTORE] Auto-marking "${med.name}" @ ${time} as missed.`);
              hasMedChanges = true;
              return { ...existing, status: 'missed' };
            }
          }
          return existing;
        } else {
          const isPastGrace = this.isReminderTimePastGrace(time, med.createdAt);
          const status = isPastGrace ? 'missed' : 'pending';
          if (status === 'missed') hasMedChanges = true;
          return { reminderTime: time, status };
        }
      });

      if (hasMedChanges || !med.reminders || med.reminders.length !== updatedReminders.length) {
        const updatedMed = { ...med, reminders: updatedReminders };
        
        // Log all newly missed reminder slots to adherence logs
        updatedReminders.forEach((newR) => {
          const oldR = currentReminders.find(r => r.reminderTime === newR.reminderTime);
          const oldStatus = oldR?.status || 'pending';
          if (oldStatus !== 'missed' && newR.status === 'missed') {
            this.logReminder(med.id!, 'missed', newR.reminderTime, new Date().toISOString()).subscribe();
          }
        });

        // Dispatch safe async background update to Firestore to avoid blocking the stream
        const docRef = doc(this.firestore, `users/${userId}/medications/${med.id}`);
        console.log(`[SYNC] [FIRESTORE] Updating Firestore document ${med.id} with missed status`);
        
        from(updateDoc(docRef, { reminders: updatedReminders })).subscribe({
          next: () => console.log(`[SYNC] [FIRESTORE] Successfully persisted missed status for "${med.name}"`),
          error: (err) => console.error(`[SYNC] [FIRESTORE] Failed to persist missed status for "${med.name}":`, err)
        });

        return updatedMed;
      }

      return med;
    });

    return mappedMeds;
  }

  private isReminderTimePastGrace(time12h: string, createdAt?: string): boolean {
    try {
      const now = new Date();
      const parts = time12h.split(' ');
      if (parts.length >= 2) {
        let [hours, minutes] = parts[0].split(':').map(Number);
        const period = parts[1];
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;

        const scheduledDate = new Date();
        scheduledDate.setHours(hours, minutes, 0, 0);

        // Prevent auto-missed bug: if scheduled time today is before creation time, it's not past grace.
        const createdDate = createdAt ? new Date(createdAt) : new Date();
        if (scheduledDate.getTime() < createdDate.getTime()) {
          return false;
        }

        // 30 minute grace period
        const gracePeriodMs = 30 * 60 * 1000;
        return now.getTime() > (scheduledDate.getTime() + gracePeriodMs);
      }
    } catch (e) {
      console.error('[SYNC] Error parsing time in isReminderTimePastGrace:', time12h, e);
    }
    return false;
  }

  markReminderAsTaken(medicationId: string, reminderTime: string): Observable<any> {
    const userId = this.getActiveUserId();
    if (!userId) return throwError(() => new Error('Not logged in'));

    // OFFLINE-FIRST: update local cache immediately
    const meds = this.medicationsSubject.value;
    const med = meds.find(m => m.id === medicationId);
    if (med) {
      const schedule = med.schedule || [];
      const existingReminders = med.reminders || [];
      
      const currentSlot = existingReminders.find((r: any) => r.reminderTime === reminderTime || r.time === reminderTime);
      const isAlreadyTaken = currentSlot && currentSlot.status === 'taken';

      const updatedReminders = schedule.map((time: string) => {
        if (time === reminderTime) {
          return { reminderTime: time, time: time, status: 'taken' };
        }
        const existing = existingReminders.find((r: any) => r.reminderTime === time || r.time === time);
        return { reminderTime: time, time: time, status: existing?.status || 'pending' };
      });

      let stockLevel = med.stockLevel !== undefined ? med.stockLevel : 30;
      let stock = med.stock !== undefined ? med.stock : 30;
      let currentStock = med.currentStock !== undefined ? med.currentStock : stockLevel;
      const maxCapacity = med.maxCapacity !== undefined ? med.maxCapacity : 30;

      // Prevent duplicate deductions and enforce stock >= 0
      if (!isAlreadyTaken) {
        stockLevel = Math.max(0, stockLevel - 1);
        stock = Math.max(0, stock - 1);
        currentStock = Math.max(0, currentStock - 1);
      }

      // Update local memory
      const updatedMeds = meds.map(m => m.id === medicationId ? { ...m, reminders: updatedReminders, stockLevel, stock, currentStock, maxCapacity } : m);
      this.saveMedications(updatedMeds);

      console.log('[REMINDER] Updating slot ' + reminderTime + ' → taken, Stock Level: ' + stockLevel);

      // Log reminder to adherence logs
      this.logReminder(medicationId, 'taken', reminderTime, new Date().toISOString()).subscribe();

      // Also update RTDB in parallel to keep ESP32 in sync
      try {
        const rtdbPath = `users/${userId}/medications/med1`;
        const rtdbPayload = {
          medicineName: med.name,
          medicationName: med.medicationName || med.name,
          reminderTime: med.schedule?.[0] || med.reminderTime || '08:00 AM',
          taken: updatedReminders.every((r: any) => r.status === 'taken'),
          reminders: updatedReminders.map((r: any) => ({
            time: r.time || r.reminderTime || '08:00 AM',
            status: r.status || 'pending'
          })),
          stockLevel,
          stock,
          currentStock,
          maxCapacity
        };
        dbSet(dbRef(this.database, rtdbPath), rtdbPayload).then(() => {
          console.log('[RTDB] [SYNC] Successfully synchronized in-app Take action to RTDB reminders array');
        }).catch(err => 
          console.error('[RTDB] [SYNC] Failed to update RTDB in parallel:', err)
        );
      } catch (rtdbErr) {
        console.error('[RTDB] [SYNC] Error setting RTDB on take action:', rtdbErr);
      }

      // Persist to Firestore
      const docRef = doc(this.firestore, `users/${userId}/medications/${medicationId}`);
      return from(updateDoc(docRef, { reminders: updatedReminders, stockLevel, stock, currentStock, maxCapacity })).pipe(
        tap(() => console.log('[SYNC] Firestore reminder and stock updated'))
      );
    }
    return of({ success: false });
  }

  markReminderSlotMissed(medicationId: string, reminderTime: string): Observable<any> {
    const userId = this.getActiveUserId();
    if (!userId) return throwError(() => new Error('Not logged in'));

    const meds = this.medicationsSubject.value;
    const med = meds.find(m => m.id === medicationId);
    if (med) {
      const schedule = med.schedule || [];
      const existingReminders = med.reminders || [];
      
      const currentSlot = existingReminders.find((r: any) => r.reminderTime === reminderTime || r.time === reminderTime);
      const wasTakenBefore = currentSlot && currentSlot.status === 'taken';

      const updatedReminders = schedule.map((time: string) => {
        if (time === reminderTime) {
          return { reminderTime: time, time: time, status: 'missed' };
        }
        const existing = existingReminders.find((r: any) => r.reminderTime === time || r.time === time);
        return { reminderTime: time, time: time, status: existing?.status || 'pending' };
      });

      let stockLevel = med.stockLevel !== undefined ? med.stockLevel : 30;
      let stock = med.stock !== undefined ? med.stock : 30;
      let currentStock = med.currentStock !== undefined ? med.currentStock : stockLevel;
      const maxCapacity = med.maxCapacity !== undefined ? med.maxCapacity : 30;

      // If transitioning from taken to missed, increment stock back
      if (wasTakenBefore) {
        stockLevel = Math.min(maxCapacity, stockLevel + 1);
        stock = Math.min(maxCapacity, stock + 1);
        currentStock = Math.min(maxCapacity, currentStock + 1);
      }

      // Update local memory
      const updatedMeds = meds.map(m => m.id === medicationId ? { ...m, reminders: updatedReminders, stockLevel, stock, currentStock, maxCapacity } : m);
      this.saveMedications(updatedMeds);

      console.log('[REMINDER] Updating slot ' + reminderTime + ' → missed');

      // Log reminder to adherence logs
      this.logReminder(medicationId, 'missed', reminderTime, new Date().toISOString()).subscribe();

      // Also update RTDB in parallel to keep ESP32 in sync
      try {
        const rtdbPath = `users/${userId}/medications/med1`;
        const rtdbPayload = {
          medicineName: med.name,
          medicationName: med.medicationName || med.name,
          reminderTime: med.schedule?.[0] || med.reminderTime || '08:00 AM',
          taken: updatedReminders.every((r: any) => r.status === 'taken'),
          reminders: updatedReminders.map((r: any) => ({
            time: r.time || r.reminderTime || '08:00 AM',
            status: r.status || 'pending'
          })),
          stockLevel,
          stock,
          currentStock,
          maxCapacity
        };
        dbSet(dbRef(this.database, rtdbPath), rtdbPayload).then(() => {
          console.log('[RTDB] [SYNC] Successfully synchronized in-app Missed action to RTDB reminders array');
        }).catch(err => 
          console.error('[RTDB] [SYNC] Failed to update RTDB in parallel:', err)
        );
      } catch (rtdbErr) {
        console.error('[RTDB] [SYNC] Error setting RTDB on missed action:', rtdbErr);
      }

      // Persist to Firestore
      const docRef = doc(this.firestore, `users/${userId}/medications/${medicationId}`);
      return from(updateDoc(docRef, { reminders: updatedReminders, stockLevel, stock, currentStock, maxCapacity })).pipe(
        tap(() => console.log('[SYNC] Firestore reminder updated to missed'))
      );
    }
    return of({ success: false });
  }

  updateMedication(id: string, updates: Partial<Medication>): Observable<any> {
    const userId = this.getActiveUserId();
    if (!userId) return throwError(() => new Error('Not logged in'));

    // Name Validation
    if (updates.name !== undefined) {
      if (!updates.name || typeof updates.name !== 'string' || updates.name.trim().length < 2 || updates.name.trim().length > 100) {
        return throwError(() => new Error('Medication name must be between 2 and 100 characters.'));
      }
      // Duplicate check
      const currentMeds = this.medicationsSubject.value || [];
      const duplicateName = currentMeds.find(m => m.isActive && m.id !== id && m.name.trim().toLowerCase() === updates.name!.trim().toLowerCase());
      if (duplicateName) {
        return throwError(() => new Error(`Medication '${updates.name}' already exists.`));
      }
    }

    // Dosage Validation
    if (updates.dosage !== undefined) {
      if (!updates.dosage || typeof updates.dosage !== 'string' || updates.dosage.trim().length < 1 || updates.dosage.trim().length > 50) {
        return throwError(() => new Error('Dosage description must be between 1 and 50 characters.'));
      }
    }

    // Duplicate Schedule Time Check
    const times = updates.timeSchedule || updates.schedule || updates.reminderSchedule;
    if (times && Array.isArray(times) && times.length > 0) {
      const uniqueTimes = new Set(times.map((t: string) => t.trim()));
      if (uniqueTimes.size !== times.length) {
        return throwError(() => new Error('Schedule contains duplicate times.'));
      }
    }

    // Validate stock if being updated (between 1 and 30)
    const newStockVal = updates.stockLevel !== undefined ? updates.stockLevel : updates.currentStock;
    if (newStockVal !== undefined) {
      if (typeof newStockVal !== 'number' || isNaN(newStockVal) || newStockVal < 1 || newStockVal > 30) {
        return throwError(() => new Error('Invalid stock level. Value must be between 1 and 30.'));
      }
      updates.stockLevel = newStockVal;
      updates.stock = newStockVal;
      updates.currentStock = newStockVal;
      updates.maxCapacity = 30;
    }

    // Synchronize stockLevel, stock, and currentStock
    if (updates.stockLevel !== undefined) {
      updates.stock = updates.stockLevel;
      updates.currentStock = updates.stockLevel;
    } else if (updates.stock !== undefined) {
      updates.stockLevel = updates.stock;
      updates.currentStock = updates.stock;
    } else if (updates.currentStock !== undefined) {
      updates.stockLevel = updates.currentStock;
      updates.stock = updates.currentStock;
    }

    if (updates.name !== undefined) {
      updates.medicationName = updates.name;
    } else if (updates.medicationName !== undefined) {
      updates.name = updates.medicationName;
    }

    if (updates.schedule !== undefined) {
      updates.reminderSchedule = updates.schedule;
    } else if (updates.reminderSchedule !== undefined) {
      updates.schedule = updates.reminderSchedule;
    }

    // OFFLINE-FIRST: Update local cache immediately
    const cachedMeds = this.medicationsSubject.value;
    const updatedMeds = cachedMeds.map(m => m.id === id ? { ...m, ...updates } : m);
    this.saveMedications(updatedMeds);
    
    const updatedMed = updatedMeds.find(m => m.id === id);

    if (updatedMed) {
      // OFFLINE-FIRST: Update local notifications by replacing them
      this.notificationService.cancelAllRemindersForMedication(id).then(() => {
        if (updatedMed.isActive !== false) {
          this.notificationService.scheduleMultipleReminders(
            id,
            updatedMed.name,
            updatedMed.timeSchedule || [],
            updatedMed.dosage
          ).catch(err => console.error('Notification rescheduling error:', err));
        }
      }).catch(err => console.error('Notification cancellation error:', err));
    }

    // Clean undefined values from updates
    const safeUpdates: any = { ...updates };
    Object.keys(safeUpdates).forEach(key => safeUpdates[key] === undefined && delete safeUpdates[key]);

    const docRef = doc(this.firestore, `users/${userId}/medications/${id}`);

    // Sync to Firestore in the background with timeout protection
    return from(updateDoc(docRef, safeUpdates)).pipe(
      timeout(5000),
      map(() => ({ success: true, medication: updatedMed })),
      catchError((error) => {
        console.warn('⚠️ Firestore update delayed or failed (updated locally):', error);
        return of({ success: true, medication: updatedMed, offline: true });
      })
    );
  }

  deleteMedication(id: string): Observable<any> {
    const userId = this.getActiveUserId();
    if (!userId) return throwError(() => new Error('Not logged in'));

    // OFFLINE-FIRST: Remove local notifications
    this.notificationService.cancelAllRemindersForMedication(id)
      .catch(err => console.error('Notification cancellation error:', err));

    // OFFLINE-FIRST: Update local cache
    const currentMeds = this.medicationsSubject.value;
    this.saveMedications(currentMeds.filter(m => m.id !== id));
    this.getAdherenceStats().subscribe();

    const docRef = doc(this.firestore, `users/${userId}/medications/${id}`);

    // Sync to Firestore in the background with timeout protection
    return from(deleteDoc(docRef)).pipe(
      timeout(5000),
      map(() => ({ success: true })),
      catchError((error) => {
        console.warn('⚠️ Firestore delete delayed or failed (deleted locally):', error);
        return of({ success: true, offline: true });
      })
    );
  }

  logReminder(medicationId: string, status: string, scheduledTime: string, takenTime?: string): Observable<any> {
    const actualTakenTime = takenTime || new Date().toISOString();
    
    // 1. Immediately update local state for fast UI & offline support
    const records = this.adherenceRecordsSubject.value || [];
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Remove existing record for the same time today to prevent duplicates
    const filteredRecords = records.filter(r => {
      const rDate = new Date(r.date).toISOString().split('T')[0];
      return !(r.medicationId === medicationId && r.scheduledTime === scheduledTime && rDate === todayStr);
    });
    
    const logId = `adherence-${Date.now()}`;
    const record: AdherenceRecord = {
      id: logId,
      medicationId,
      scheduledTime,
      status: status as any,
      takenTime: actualTakenTime,
      date: new Date().toISOString()
    };
    
    filteredRecords.push(record);
    this.saveAdherence(filteredRecords);
    
    // Notify components that data has changed
    this.notifyRemindersUpdated();

    // Update local adherence stats
    this.getAdherenceStats().subscribe();

    // 2. Sync with Firestore
    const userId = this.getActiveUserId();
    if (userId) {
      const docRef = doc(this.firestore, `users/${userId}/reminderLogs/${logId}`);
      return from(setDoc(docRef, record)).pipe(
        timeout(5000),
        map(() => ({ success: true, log: record })),
        catchError((error) => {
          console.warn('⚠️ Firestore log save delayed/failed (saved locally):', error);
          return of({ success: true, offline: true, log: record });
        })
      );
    }

    return of({ success: true, offline: true, log: record });
  }

  getReminderLogs(): Observable<any> {
    const userId = this.getActiveUserId();
    if (!userId) {
      const logs = this.adherenceRecordsSubject.value || [];
      return of({ success: true, count: logs.length, logs });
    }

    const logsRef = collection(this.firestore, `users/${userId}/reminderLogs`);
    return from(getDocs(logsRef)).pipe(
      timeout(5000),
      map(snapshot => {
        const logs: any[] = [];
        snapshot.forEach(doc => {
          logs.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, count: logs.length, logs };
      }),
      catchError(() => {
        // Offline Fallback
        const logs = this.adherenceRecordsSubject.value || [];
        return of({ success: true, count: logs.length, logs });
      })
    );
  }

  getTodayReminders(): Observable<any> {
    const medications = this.medicationsSubject.value || [];
    return of({ reminders: medications.filter(m => m.isActive) }).pipe(delay(300));
  }

  logMedicationTaken(medicationId: string, scheduledTime?: string): Observable<any> {
    const now = new Date();
    const takenTime = now.toISOString();
    // Use the actual scheduled time slot if provided, otherwise fall back to current HH:mm
    const slotTime = scheduledTime || `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    return this.logReminder(medicationId, 'taken', slotTime, takenTime).pipe(
      tap(() => this.getAdherenceStats().subscribe())
    );
  }

  getAdherenceStats(): Observable<any> {
    const records = this.adherenceRecordsSubject.value || [];
    const medications = this.medicationsSubject.value || [];
    const todayStr = new Date().toISOString().split('T')[0];

    const todayRecords = records.filter(r => {
      try {
        return new Date(r.date).toISOString().split('T')[0] === todayStr;
      } catch (e) {
        return false;
      }
    });

    let totalScheduledToday = 0;
    const activeMedIds = new Set<string>();

    medications.forEach(med => {
      if (med.isActive !== false) {
        if (med.id) activeMedIds.add(med.id);
        const times = med.reminderTimes || (med as any).timeSchedule || [];
        totalScheduledToday += times.length;
      }
    });

    const taken = todayRecords.filter(r => r.status === 'taken' && activeMedIds.has(r.medicationId)).length;
    const missed = todayRecords.filter(r => r.status === 'missed' && activeMedIds.has(r.medicationId)).length;
    const pending = Math.max(0, totalScheduledToday - (taken + missed));

    let adherenceRate = 0;
    if (totalScheduledToday > 0) {
      adherenceRate = (taken / totalScheduledToday) * 100;
    }
    adherenceRate = Math.min(100, Math.round(adherenceRate));

    const stats = { totalReminders: totalScheduledToday, taken, missed, pending, adherenceRate };
    return of({ stats }).pipe(
      delay(300),
      tap((response: any) => this.adherenceStatsSubject.next(response.stats))
    );
  }

  getStoredAdherenceRecords(): AdherenceRecord[] {
    return this.adherenceRecordsSubject.value || [];
  }

  notifyRemindersUpdated(): void {
    this.remindersUpdatedSubject.next();
  }
}
