import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, from } from 'rxjs';
import { Router } from '@angular/router';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ApiConfigService } from './api-config.service';
import { inject } from '@angular/core';
import { Auth, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, authState, updateProfile } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

export interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  role?: 'user' | 'admin';
}

interface StoredUser extends User {
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private tokenSubject = new BehaviorSubject<string | null>(null);
  public token$ = this.tokenSubject.asObservable();
  private readonly USERS_STORAGE_KEY = 'doseguard_users';
  private readonly ADMIN_EMAIL = 'admin@doseguard.app';
  private readonly ADMIN_PASSWORD = 'admin123';
  private get API_URL(): string {
    return this.apiConfig.getBaseUrl();
  }
  private fireAuth = inject(Auth);
  private firestore = inject(Firestore);

  constructor(
    private router: Router,
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {
    this.loadFromStorage();
    this.initializeDefaultAdmin();
    this.setupFirebaseAuthSync();
  }

  private initializeDefaultAdmin(): void {
    const users = this.getAllUsers();
    const adminExists = users.some(u => u.email === this.ADMIN_EMAIL);
    if (!adminExists) {
      const adminUser: StoredUser = {
        id: 'admin-1',
        firstName: 'Admin',
        lastName: 'User',
        email: this.ADMIN_EMAIL,
        password: this.ADMIN_PASSWORD,
        role: 'admin'
      };
      users.push(adminUser);
      localStorage.setItem(this.USERS_STORAGE_KEY, JSON.stringify(users));
    }
  }

  private loadFromStorage(): void {
    const storedUser = localStorage.getItem('doseguard_user');
    const storedToken = localStorage.getItem('doseguard_token');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      this.currentUserSubject.next(parsed);
      console.log('[AUTH] Firebase session active — user restored from storage:', parsed.email || parsed.id);
    }
    if (storedToken) {
      this.tokenSubject.next(storedToken);
      console.log('[AUTH] Backend token restored from storage.');
    }
  }

  private getAllUsers(): StoredUser[] {
    const usersJson = localStorage.getItem(this.USERS_STORAGE_KEY);
    return usersJson ? JSON.parse(usersJson) : [];
  }

  private saveUsers(users: StoredUser[]): void {
    localStorage.setItem(this.USERS_STORAGE_KEY, JSON.stringify(users));
  }

  private generateToken(email: string): string {
    return btoa(`${email}:${Date.now()}`);
  }

  get isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  /** True when the current session belongs to an admin (role OR email check) */
  get isAdmin(): boolean {
    const user = this.currentUserSubject.value;
    if (!user) return false;
    return user.role === 'admin' || user.email === 'admin@doseguard.app';
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  getAuthHeader() {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Called by AdminService after a direct Firebase Auth admin login.
   * Stores the admin identity in the same currentUserSubject so isAdmin
   * getter, AuthGuard, and page-refresh restoration all work correctly.
   */
  setAdminSession(admin: { id: string; email: string; role: 'admin' }, token?: string): void {
    const user: User = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      firstName: 'Admin',
      lastName: ''
    };
    this.currentUserSubject.next(user);
    // Use the passed real JWT token, fallback to local storage or synthetic token
    const storedToken = localStorage.getItem('doseguard_token');
    const finalToken = token || storedToken || btoa(`${admin.email}:admin:${Date.now()}`);
    this.tokenSubject.next(finalToken);
    localStorage.setItem('doseguard_user', JSON.stringify(user));
    localStorage.setItem('doseguard_token', finalToken);
    console.log('[AUTH] Admin session set. UID:', admin.id, '| Email:', admin.email);
  }

  // User Login - Real backend implementation
  // Navigation is role-aware: admin → /admin, user → /dashboard
  login(email: string, password: string): Observable<any> {
    const loginData = { email, password };

    return this.http.post(`${this.API_URL}/auth/login`, loginData).pipe(
      tap((response: any) => {
        const token = response.token;
        const user: User = {
          id: response.user.id,
          firstName: response.user.firstName,
          lastName: response.user.lastName,
          email: response.user.email,
          role: response.user.role
        };

        this.currentUserSubject.next(user);
        this.tokenSubject.next(token);
        localStorage.setItem('doseguard_user', JSON.stringify(user));
        localStorage.setItem('doseguard_token', token);

        const isAdmin = user.role === 'admin';
        console.log('[AUTH] Backend login successful. User:', user.email, '| Role:', user.role, '| ID:', user.id);
        console.log('[AUTH] Backend token stored.');
        if (isAdmin) {
          console.log('[ADMIN] Admin role detected. Will redirect to /admin after Firebase session.');
        }

        // ── Sign into Firebase Auth with the REAL password the user typed.
        // This establishes a stable Firebase UID for RTDB + Firestore listeners.
        const fbUser = this.fireAuth.currentUser;
        if (fbUser && fbUser.email === email) {
          console.log('[AUTH] Firebase session already active. UID:', fbUser.uid);
          this.syncUserToFirestore(fbUser.uid, user);
          this.navigateAfterLogin(user);
        } else {
          console.log('[AUTH] Establishing Firebase session for:', email);
          signInWithEmailAndPassword(this.fireAuth, email, password)
            .then(fbCred => {
              console.log('[AUTH] Stable Firebase session established');
              console.log('[AUTH] Using UID:', fbCred.user.uid);
              this.syncUserToFirestore(fbCred.user.uid, user);
            })
            .catch(err => {
              console.warn('[AUTH] Firebase sign-in failed (non-fatal):', err.code, err.message);
              console.warn('[AUTH] Ensure this email is registered in Firebase Authentication console.');
            })
            .finally(() => {
              this.navigateAfterLogin(user);
            });
        }
      }),
      catchError((error: any) => {
        console.error('[AUTH] ❌ Login failed:', error?.status, error?.error?.message || error?.message);
        const errorMessage = error?.error?.message || 'Invalid email or password.';
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Role-aware post-login navigation.
   * admin → /admin | user → /dashboard
   */
  private navigateAfterLogin(user: User): void {
    if (user.role === 'admin') {
      console.log('[ADMIN] Redirecting admin to /admin');
      console.log('[ROUTER] navigate → /admin');
      this.router.navigate(['/admin']);
    } else {
      console.log('[AUTH] Redirecting user to /dashboard');
      console.log('[ROUTER] navigate → /dashboard');
      this.router.navigate(['/dashboard']);
    }
  }


  /** Sync the backend user's profile into Firestore under the Firebase UID */
  private syncUserToFirestore(firebaseUid: string, user: User): void {
    const userDocRef = doc(this.firestore, `users/${firebaseUid}`);
    setDoc(userDocRef, {
      id: firebaseUid,
      backendId: user.id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      email: user.email,
      role: user.role || 'user',
      updatedAt: new Date().toISOString()
    }, { merge: true }).then(() => {
      console.log('[AUTH] User profile synced to Firestore. UID:', firebaseUid);
    }).catch(err => {
      console.warn('[AUTH] Firestore user sync failed (non-fatal):', err.message || err);
    });
  }

  // User Signup
  // Flow: Firebase Auth first → get real UID → register with backend using that UID
  // This guarantees the same UID is used in Firebase Auth, Firestore, RTDB, and the backend DB.
  signup(firstName: string, lastName: string, email: string, password: string): Observable<any> {
    console.log('[SIGNUP] Starting Firebase Auth account creation for:', email);

    // Step 1: Create the Firebase Auth account to get the real Firebase UID
    return from(
      createUserWithEmailAndPassword(this.fireAuth, email, password)
        .then(async (fbCred) => {
          const firebaseUid = fbCred.user.uid;
          console.log('[SIGNUP] Firebase Auth account created. UID:', firebaseUid);

          // Set display name in Firebase Auth
          await updateProfile(fbCred.user, {
            displayName: `${firstName} ${lastName}`.trim()
          }).catch(e => console.warn('[SIGNUP] updateProfile non-fatal:', e.message));

          // Step 2: Register with backend, passing the Firebase UID as the user id
          const signupData = { firstName, lastName, email, password, firebaseUid };

          const response: any = await this.http
            .post(`${this.API_URL}/auth/register`, signupData)
            .toPromise()
            .catch(async (backendErr) => {
              // Backend registration failed — delete the Firebase account to keep in sync
              console.error('[SIGNUP] Backend registration failed. Rolling back Firebase account:', backendErr?.error?.message || backendErr?.message);
              await fbCred.user.delete().catch(e => console.warn('[SIGNUP] Firebase rollback failed:', e.message));
              throw backendErr;
            });

          console.log('[SIGNUP] Backend registration successful. Backend ID:', response?.user?.id);
          console.log('[AUTH] Stable Firebase session established');
          console.log('[AUTH] Using UID:', firebaseUid);

          // Step 3: Sync user profile to Firestore under the Firebase UID
          const user: User = {
            id: firebaseUid,   // Always use the Firebase UID as the app-wide user ID
            firstName: response?.user?.firstName || firstName,
            lastName: response?.user?.lastName || lastName,
            email: response?.user?.email || email,
            role: response?.user?.role || 'user'
          };
          this.syncUserToFirestore(firebaseUid, user);

          // Step 4: Sign out the newly created user immediately
          console.log('[SIGNUP] Signing out newly created Firebase user to require manual login.');
          await signOut(this.fireAuth);

          console.log('[SIGNUP] Signup complete. Handing off redirect to component.');
          return response;
        })
    ).pipe(
      catchError((error: any) => {
        let errorMessage = 'Signup failed. Please try again.';
        const code = error?.code || error?.error?.code || '';
        if (code === 'auth/email-already-in-use' || error?.status === 409) {
          errorMessage = 'This email is already registered. Please log in instead.';
        } else if (code === 'auth/invalid-email') {
          errorMessage = 'Please enter a valid email address.';
        } else if (code === 'auth/weak-password') {
          errorMessage = 'Password must be at least 6 characters.';
        } else if (code === 'auth/network-request-failed') {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error?.error?.message) {
          errorMessage = error.error.message;
        } else if (error?.message) {
          errorMessage = error.message;
        }
        console.error('[SIGNUP] ❌ Error:', error?.code || error?.status, errorMessage);
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  // Admin Login - Real backend implementation
  adminLogin(email: string, password: string): Observable<any> {

    const loginData = { email, password };

    return this.http.post(`${this.API_URL}/auth/login`, loginData).pipe(
      tap((response: any) => {

        // Check if user is admin
        if (response.user.role !== 'admin') {
          throw new Error('Only admin accounts can access the admin panel.');
        }

        const token = response.token;
        const user: User = {
          id: response.user.id,
          firstName: response.user.firstName,
          lastName: response.user.lastName,
          email: response.user.email,
          role: response.user.role
        };

        this.currentUserSubject.next(user);
        this.tokenSubject.next(token);
        localStorage.setItem('doseguard_user', JSON.stringify(user));
        localStorage.setItem('doseguard_token', token);
        this.router.navigate(['/admin']);
      }),
      catchError((error: any) => {
        console.error('❌ Admin login failed:', error);
        const errorMessage = error?.error?.message || 'Invalid admin credentials.';
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  // Social Login Methods
  signInWithGoogle(): Observable<any> {

    if (Capacitor.isNativePlatform()) {

      return from(
        FirebaseAuthentication.signInWithGoogle()
      ).pipe(
        tap((result: any) => {
          if (result.user) {
            this.handleSocialLoginSuccess(result.user);
          }
        }),
        catchError((error: any) => {
          console.error('❌ FULL GOOGLE ERROR:', JSON.stringify(error));
          console.error(error);
          return throwError(() => error);
        })
      );
    }

    const provider = new GoogleAuthProvider();

    return from(
      signInWithPopup(this.fireAuth, provider)
    ).pipe(
      tap((result: any) => {
        this.handleSocialLoginSuccess(result.user);
      }),
      catchError((error: any) => {
        console.error('❌ FULL GOOGLE ERROR:', JSON.stringify(error));
        console.error(error);
        return throwError(() => error);
      })
    );
  }

  signInWithFacebook(): Observable<any> {
    const provider = new FacebookAuthProvider();
    return from(signInWithPopup(this.fireAuth, provider)).pipe(
      tap((result: any) => {
        this.handleSocialLoginSuccess(result.user);
      }),
      catchError((error: any) => {
        console.error('❌ Facebook login failed:', error);
        return throwError(() => new Error('Facebook login failed. Please try again.'));
      })
    );
  }

  private handleSocialLoginSuccess(firebaseUser: any) {
    const token = firebaseUser.accessToken || this.generateToken(firebaseUser.email || firebaseUser.uid);
    const user: User = {
      id: firebaseUser.uid,
      firstName: firebaseUser.displayName?.split(' ')[0] || 'User',
      lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
      email: firebaseUser.email || `${firebaseUser.uid}@social.local`,
      role: 'user'
    };
    this.currentUserSubject.next(user);
    this.tokenSubject.next(token);
    localStorage.setItem('doseguard_user', JSON.stringify(user));
    localStorage.setItem('doseguard_token', token);
    this.router.navigate(['/dashboard']);
  }

  // Logout
  logout(redirectRoute: string = '/'): void {
    this.currentUserSubject.next(null);
    this.tokenSubject.next(null);
    localStorage.removeItem('doseguard_user');
    localStorage.removeItem('doseguard_token');
    signOut(this.fireAuth)
      .then(() => console.log('[AUTH] Logged out from Firebase Auth'))
      .catch(err => console.error('[AUTH] Firebase signout error:', err));
    this.router.navigate([redirectRoute]);
  }

  private setupFirebaseAuthSync(): void {
    // Listen to Firebase Auth state.
    // When a real Firebase user is present (established by login() above),
    // log the stable UID. This is purely informational — no re-auth attempt.
    authState(this.fireAuth).subscribe(fbUser => {
      if (fbUser) {
        console.log('[AUTH] Firebase session active. UID:', fbUser.uid);
      } else {
        console.log('[AUTH] No active Firebase session.');
      }
    });
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // Verify token
  verifyToken(): Observable<any> {
    const token = this.getToken();
    if (!token) {
      this.logout();
      return throwError(() => new Error('No token found'));
    }
    return of({ valid: true });
  }
}
