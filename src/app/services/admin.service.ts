import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, from, of, combineLatest } from 'rxjs';
import { tap, catchError, switchMap, map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';
import { AuthService } from './auth.service';
import { ApiConfigService } from './api-config.service';
import { Firestore, collectionGroup, doc, onSnapshot, deleteDoc, collection, query, where, getDocs, addDoc } from '@angular/fire/firestore';

export interface Admin {
  id: string;
  username: string;
  role: 'admin' | 'super-admin';
}

export interface DoseGuardUser {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  phone?: string;
  role?: string;
  createdAt?: string;
}

export interface MedicationReminder {
  id: string;
  userId: string;
  userName?: string;
  patientName?: string;
  patientEmail?: string;
  medicationName?: string;
  name?: string;
  dosage: string;
  frequency: string;
  time?: string;
  status: string;
  createdAt: string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private get apiUrl(): string {
    return this.apiConfig.getBaseUrl();
  }
  private currentAdminSubject = new BehaviorSubject<Admin | null>(null);
  private usersSubject = new BehaviorSubject<DoseGuardUser[]>([]);
  private medicationRecordsSubject = new BehaviorSubject<any[]>([]);
  private dashboardStatsSubject = new BehaviorSubject<any>(null);
  private userProfileCache = new Map<string, any>();

  public currentAdmin$ = this.currentAdminSubject.asObservable();
  public users$ = this.usersSubject.asObservable();
  public medicationRecords$ = this.medicationRecordsSubject.asObservable();
  public dashboardStats$ = this.dashboardStatsSubject.asObservable();

  private firebaseAuth = inject(Auth);

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private apiConfig: ApiConfigService,
    private firestore: Firestore,
    private router: Router
  ) {
    this.loadAdminFromStorage();
  }

  private loadAdminFromStorage(): void {
    const storedAdmin = localStorage.getItem('doseguard_admin');
    if (storedAdmin) {
      this.currentAdminSubject.next(JSON.parse(storedAdmin));
    }
  }

  // List of admin emails — add more here if needed
  private readonly ADMIN_EMAILS = ['admin@doseguard.app'];

  get isAdminAuthenticated(): boolean {
    return this.currentAdminSubject.value !== null;
  }

  /**
   * Admin Login — authenticates via backend API (SQL DB with bcrypt).
   * Backend has admin@doseguard.app / admin123 stored correctly.
   * After backend auth, optionally signs into Firebase Auth (non-fatal)
   * so RTDB listeners can attach with the correct Firebase UID.
   */
  adminLogin(email: string, password: string): Observable<any> {
    console.log('[ADMIN] Login attempt for:', email);

    const isAllowedAdmin = this.ADMIN_EMAILS.includes(email.trim().toLowerCase());
    if (!isAllowedAdmin) {
      console.warn('[ADMIN] ❌ Email not in admin allowlist:', email);
      return throwError(() => new Error('This account does not have admin privileges.'));
    }

    // Step 1: Authenticate directly with Firebase Authentication
    return from(signInWithEmailAndPassword(this.firebaseAuth, email.trim(), password)).pipe(
      switchMap(async (fbCred) => {
        const idToken = await fbCred.user.getIdToken();
        console.log('[AUTH] Firebase admin sign-in successful. UID:', fbCred.user.uid);

        // Step 2: Call backend /auth/login with the firebase token to verify and establish session
        const payload = {
          email: email.trim().toLowerCase(),
          firebaseToken: idToken,
          firebaseSuccess: true
        };

        const response: any = await this.http.post(`${this.apiUrl}/auth/login`, payload).toPromise();
        return { fbCred, response };
      }),
      tap(({ fbCred, response }) => {
        if (!response?.user || response.user.role !== 'admin') {
          console.error('[ADMIN] ❌ Role check failed:', response?.user?.role);
          throw new Error('This account does not have admin privileges.');
        }

        // Additional safeguard to prevent unauthorized non-admin accounts
        if (fbCred.user.email?.toLowerCase() !== 'admin@doseguard.app') {
          console.error('[ADMIN] ❌ Email does not match admin credentials:', fbCred.user.email);
          throw new Error('This account does not have admin privileges.');
        }

        const backendId = response.user.id;
        const userEmail = response.user.email;

        console.log('[ADMIN] Backend auth success. ID:', backendId, '| Role:', response.user.role);

        const admin: Admin = { id: backendId, username: userEmail, role: 'admin' };
        this.currentAdminSubject.next(admin);
        localStorage.setItem('doseguard_admin', JSON.stringify(admin));

        // Store in AuthService so isAdmin getter + AdminGuard work
        this.authService.setAdminSession({ id: backendId, email: userEmail, role: 'admin' }, response.token);
        console.log('[ADMIN] Admin session stored.');

        // Navigate IMMEDIATELY
        console.log('[ROUTER] navigate → /admin-dashboard');
        this.router.navigate(['/admin-dashboard']);
      }),
      catchError((error: any) => {
        let errorMessage = 'Admin login failed. Please try again.';
        const code = error?.code || '';
        const status = error?.status;
        const msg = error?.error?.message || error?.message || '';

        if (code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
          errorMessage = 'Incorrect email or password.';
        } else if (status === 401 || msg.toLowerCase().includes('invalid')) {
          errorMessage = 'Incorrect email or password.';
        } else if (status === 0) {
          errorMessage = 'Cannot reach server. Is the backend running?';
        } else if (msg.includes('admin privileges')) {
          errorMessage = msg;
        } else if (msg) {
          errorMessage = msg;
        }

        console.error('[ADMIN] ❌ Login failed:', error);
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  adminLogout(): void {
    this.currentAdminSubject.next(null);
    localStorage.removeItem('doseguard_admin');
    this.authService.logout('/admin-login');
  }

  getCurrentAdmin(): Admin | null {
    return this.currentAdminSubject.value;
  }

  /**
   * Get all users - Admin only
   */
  getAllUsers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/users`, {
      headers: this.authService.getAuthHeader() as any
    }).pipe(
      tap((response: any) => {
        this.usersSubject.next(response.users || []);
      }),
      catchError((error) => {
        console.error('❌ Failed to fetch users:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user by ID - Admin only
   */
  getUserById(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/users/${userId}`, {
      headers: this.authService.getAuthHeader() as any
    }).pipe(
      catchError((error) => {
        console.error('❌ Failed to fetch user:', error);
        return throwError(() => error);
      })
    );
  }

  getAllMedications(): Observable<any[]> {
    console.log(
      '[ADMIN] [FIRESTORE] Firestore instance initialized:',
      this.firestore
    );

    const medsRef = collectionGroup(
      this.firestore,
      'medications'
    );

    console.log(
      '[ADMIN] collectionGroup medication stream initialized'
    );

    const medicationsStream$ = new Observable<any[]>(subscriber => {
      const unsubscribe = onSnapshot(medsRef, 
        (snapshot) => {
          const meds: any[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            const parentUserId = doc.ref.parent?.parent?.id || data['userId'] || '';
            meds.push({ id: doc.id, userId: parentUserId, ...data });
          });
          subscriber.next(meds);
        },
        (err) => {
          subscriber.error(err);
        }
      );
      return () => unsubscribe();
    });

    return medicationsStream$.pipe(
      tap((medications) => {
        console.log(
          '[ADMIN] Realtime collectionGroup medications emitted, count:',
          medications.length
        );
      }),
      switchMap((medications: any[]) => {
        if (!medications.length) {
          console.warn(
            '[ADMIN] No medications found'
          );
          return of([]);
        }

        const joinedStreams = medications.map((medication) => {
          const userRef = doc(
            this.firestore,
            `users/${medication.userId}`
          );

          const userDocStream$ = new Observable<any>(sub => {
            const unsub = onSnapshot(userRef, 
              (snapshot) => {
                sub.next(snapshot.data());
              },
              (err) => {
                sub.error(err);
              }
            );
            return () => unsub();
          });

          return userDocStream$.pipe(
            map((userData: any) => ({
              ...medication,
              patientName:
                userData?.name ||
                medication.userName ||
                'Unknown User',
              patientEmail:
                userData?.email ||
                medication.userEmail ||
                'No Email'
            })),
            catchError(() =>
              of({
                ...medication,
                patientName:
                  medication.userName ||
                  'Unknown User',
                patientEmail:
                  medication.userEmail ||
                  'No Email'
              })
            )
          );
        });

        return combineLatest(joinedStreams);
      }),
      tap((joinedData) => {
        console.log(
          '[ADMIN] Realtime user-medication join completed successfully, count:',
          joinedData.length
        );
      }),
      catchError((error) => {
        console.error(
          '[ADMIN] Realtime query or join failed:',
          error
        );
        return of([]);
      })
    );
  }

  /**
   * Get all reminder logs - Admin only
   */
  getAllReminderLogs(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/reminder-logs`, {
      headers: this.authService.getAuthHeader() as any
    }).pipe(
      tap((response: any) => {
        this.medicationRecordsSubject.next(response.logs || []);
      }),
      catchError((error) => {
        console.error('❌ Failed to fetch reminder logs:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get system statistics - Admin only
   */
  getDashboardStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/stats/system`, {
      headers: this.authService.getAuthHeader() as any
    }).pipe(
      tap((response: any) => {
        this.dashboardStatsSubject.next(response.stats || {});
      }),
      catchError((error) => {
        console.error('❌ Failed to fetch stats:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user's medication records - Admin only
   */
  getUserMedicationRecords(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/users/${userId}/medications`, {
      headers: this.authService.getAuthHeader() as any
    }).pipe(
      catchError((error) => {
        console.error('❌ Failed to fetch user medications:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user's reminder logs - Admin only
   */
  getUserReminderLogs(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/users/${userId}/reminder-logs`, {
      headers: this.authService.getAuthHeader() as any
    }).pipe(
      catchError((error) => {
        console.error('❌ Failed to fetch user reminder logs:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete user - Admin only
   */
  deleteUser(userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/users/${userId}`, {
      headers: this.authService.getAuthHeader() as any
    }).pipe(
      tap((response: any) => {
      }),
      catchError((error) => {
        console.error('❌ Failed to delete user:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Add user - Admin only (uses registration endpoint)
   */
  addUser(userData: { firstName: string; lastName: string; email: string; phone?: string }): Observable<any> {
    const payload = {
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      phone: userData.phone || '',
      password: this.generateRandomPassword() // Generate a random password for the user
    };
    
    return this.http.post(`${this.apiUrl}/auth/register`, payload).pipe(
      tap((response: any) => {
      }),
      catchError((error) => {
        console.error('❌ Failed to add user:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Generate a random password for new users
   */
  private generateRandomPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Update user - Admin only
   */
  updateUser(userId: string, userData: { firstName: string; lastName: string; email: string; phone?: string }): Observable<any> {
    const payload = {
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      phone: userData.phone || ''
    };
    
    return this.http.put(`${this.apiUrl}/admin/users/${userId}`, payload, {
      headers: this.authService.getAuthHeader() as any
    }).pipe(
      tap((response: any) => {
      }),
      catchError((error) => {
        console.error('❌ Failed to update user:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user adherence statistics - Admin only
   */
  getUserAdherence(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/users/${userId}/adherence`, {
      headers: this.authService.getAuthHeader() as any
    }).pipe(
      catchError((error) => {
        console.error('❌ Failed to fetch adherence:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete medication - Admin only
   */
  deleteMedication(userId: string, medicationId: string, medicationName: string): Observable<any> {
    console.log('[ADMIN] Initiating deletion for medication:', medicationName, 'ID:', medicationId, 'User:', userId);

    // 1. Delete medication document from Firestore
    const medDocRef = doc(this.firestore, `users/${userId}/medications/${medicationId}`);
    const firestoreMedDelete$ = from(deleteDoc(medDocRef)).pipe(
      tap(() => console.log('[ADMIN] Successfully deleted medication document from Firestore')),
      catchError((err) => {
        console.warn('[ADMIN] Firestore medication deletion failed:', err);
        return of(null);
      })
    );

    // 2. Query and delete associated reminder logs from Firestore
    const logsRef = collection(this.firestore, `users/${userId}/reminderLogs`);
    const logsQuery = query(logsRef, where('medicationId', '==', medicationId));
    const firestoreLogsDelete$ = from(getDocs(logsQuery)).pipe(
      switchMap((snapshot) => {
        const deletePromises: Promise<void>[] = [];
        snapshot.forEach((docSnapshot) => {
          deletePromises.push(deleteDoc(docSnapshot.ref));
        });
        return from(Promise.all(deletePromises));
      }),
      tap((results) => console.log('[ADMIN] Successfully deleted associated reminder logs from Firestore, count:', results?.length || 0)),
      catchError((err) => {
        console.warn('[ADMIN] Firestore reminder logs deletion failed:', err);
        return of(null);
      })
    );

    // 3. Write Audit Log to Firestore
    const auditLogsCollection = collection(this.firestore, 'auditLogs');
    const auditPayload = {
      userId: this.authService.getCurrentUser()?.id || 'ADMIN',
      medicationId,
      medicationName,
      timestamp: new Date().toISOString(),
      action: 'DELETE_MEDICATION'
    };
    const firestoreAuditLog$ = from(addDoc(auditLogsCollection, auditPayload)).pipe(
      tap(() => console.log('[ADMIN] Successfully wrote deletion audit log to Firestore')),
      catchError((err) => {
        console.warn('[ADMIN] Firestore audit log writing failed:', err);
        return of(null);
      })
    );

    // 4. Call backend API to delete from MySQL
    const backendDelete$ = this.http.delete(`${this.apiUrl}/admin/medications/${medicationId}`, {
      params: { userId },
      headers: this.authService.getAuthHeader() as any
    }).pipe(
      tap(() => console.log('[ADMIN] Successfully deleted medication records from MySQL database'))
    );

    // Execute Firestore operations first, then call backend
    return firestoreMedDelete$.pipe(
      switchMap(() => firestoreLogsDelete$),
      switchMap(() => firestoreAuditLog$),
      switchMap(() => backendDelete$),
      catchError((error) => {
        console.error('❌ Failed to delete medication:', error);
        return throwError(() => error);
      })
    );
  }
}
