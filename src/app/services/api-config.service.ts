import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

/**
 * Dynamic API Configuration Service
 * URL is resolved SYNCHRONOUSLY in the constructor to prevent race conditions.
 * Capacitor.getPlatform() is always synchronous — safe to use at startup.
 * Device.getInfo() (async) is used only to refine emulator vs. real device.
 */
@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {

  // ─── CHANGE THIS IF YOUR LAN IP CHANGES ───────────────────────────────────
  private readonly LAN_IP = '192.168.10.206';  // Updated: current PC IP
  private readonly PORT        = '3001';
  // ──────────────────────────────────────────────────────────────────────────

  private readonly EMULATOR_URL = `http://10.0.2.2:${this.PORT}/api`;
  private readonly LAN_URL = `http://${this.LAN_IP}:${this.PORT}/api`;
  private readonly LOCAL_URL = `http://localhost:${this.PORT}/api`;

  private apiUrl: string;

  constructor() {
    // ✅ SYNCHRONOUS — no race condition possible
    const platform = Capacitor.getPlatform();

    if (platform === 'android' || platform === 'ios') {
      this.apiUrl = 'https://doseguard-backend.onrender.com/api';
    } else {
      // Web browser
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        this.apiUrl = this.LOCAL_URL;
      } else if (/^[0-9.]+$/.test(hostname)) {
        // IP address (e.g. LAN)
        this.apiUrl = `http://${hostname}:${this.PORT}/api`;
      } else {
        // Production web domain (Hosted on Render)
        this.apiUrl = 'https://doseguard-backend.onrender.com/api';
      }
    }

    console.log(`🌐 ApiConfigService initialized — Platform: ${platform} — URL: ${this.apiUrl}`);

    // Async refinement: swap to 10.0.2.2 only if running inside Android emulator
    if (platform === 'android') {
      Device.getInfo().then(info => {
        if (info.isVirtual) {
          this.apiUrl = this.EMULATOR_URL;
          console.log(`🤖 Emulator detected — Switching to: ${this.apiUrl}`);
        }
      }).catch(err => {
        console.warn('⚠️ Device.getInfo() failed, keeping LAN URL:', err);
      });
    }
  }

  /** Get the API base URL (always safe to call — no race condition) */
  public getBaseUrl(): string {
    return this.apiUrl;
  }

  /** Build a full endpoint URL */
  public buildUrl(endpoint: string): string {
    return `${this.apiUrl}/${endpoint}`.replace(/\/+/g, '/');
  }

  /** Debug: current host info */
  public getHostInfo() {
    return {
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      port: window.location.port,
      apiUrl: this.apiUrl
    };
  }

  /** Test backend connectivity */
  public async testConnectivity(): Promise<boolean> {
    try {
      const healthUrl = this.apiUrl.replace('/api', '') + '/health';
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const response = await fetch(healthUrl, { method: 'GET', signal: ctrl.signal });
      clearTimeout(timer);
      return response.ok;
    } catch (error) {
      console.error('❌ Backend health check failed:', error);
      return false;
    }
  }
}
