/**
 * License State Management Service
 * Manages license lifecycle and state transitions
 *
 * Task 3.2: Machine license state
 * - States: NO_LICENSE → TRIAL → ACTIVE → EXPIRED → SUSPENDED  
 * - State validators and transitions
 * - License data storage (encrypted)
 * - Mocked database persistence
 */

import type {
  DeviceRebindingStatus,
  LicenseData,
  LicenseState,
  LicenseStateChangeEvent,
} from "@sparelink/shared";
import { LicenseState as LicenseStateEnum } from "@sparelink/shared";

/**
 * Validators for state transitions
 */
const STATE_TRANSITIONS: Record<LicenseState, LicenseState[]> = {
  [LicenseStateEnum.NO_LICENSE]: [LicenseStateEnum.TRIAL, LicenseStateEnum.ACTIVE],
  [LicenseStateEnum.TRIAL]: [LicenseStateEnum.ACTIVE, LicenseStateEnum.EXPIRED, LicenseStateEnum.NO_LICENSE],
  [LicenseStateEnum.ACTIVE]: [
    LicenseStateEnum.EXPIRED,
    LicenseStateEnum.SUSPENDED,
    LicenseStateEnum.DEACTIVATED,
  ],
  [LicenseStateEnum.EXPIRED]: [
    LicenseStateEnum.ACTIVE,
    LicenseStateEnum.SUSPENDED,
    LicenseStateEnum.NO_LICENSE,
  ],
  [LicenseStateEnum.SUSPENDED]: [
    LicenseStateEnum.ACTIVE,
    LicenseStateEnum.EXPIRED,
    LicenseStateEnum.NO_LICENSE,
  ],
  [LicenseStateEnum.DEACTIVATED]: [LicenseStateEnum.NO_LICENSE],
};

export class LicenseStateManager {
  private licenseData: LicenseData | null = null;
  private stateChangeListeners: ((event: LicenseStateChangeEvent) => void)[] = [];

  private validationTimer: NodeJS.Timeout | null = null;
  /**
   * Initialize license from stored data
   */
  async initialize(licenseData: LicenseData | null): Promise<void> {
    if (licenseData) {
      this.licenseData = licenseData;
      this.updateStateBasedOnExpiry();
      console.log(`[License Manager] Initialized with state: ${this.licenseData.status}`);
    } else {
      this.licenseData = null;
      console.log("[License Manager] Initialized without license");
    }
  }

  /**
   * Get current license data
   */
  getCurrentLicense(): LicenseData | null {
    return this.licenseData;
  }

  /**
   * Get current state
   */
  getCurrentState(): LicenseState {
    if (!this.licenseData) {
      return LicenseStateEnum.NO_LICENSE;
    }
    return this.licenseData.status;
  }

  /**
   * Check if license is valid (can be used)
   */
  isLicenseValid(): boolean {
    if (!this.licenseData) return false;

    const state = this.licenseData.status;
    return (
      state === LicenseStateEnum.ACTIVE ||
      (state === LicenseStateEnum.TRIAL && this.licenseData.expiresAt > Date.now())
    );
  }

  /**
   * Validate and perform state transition
   */
  private canTransitionTo(fromState: LicenseState, toState: LicenseState): boolean {
    const validNextStates = STATE_TRANSITIONS[fromState] || [];
    return validNextStates.includes(toState);
  }

  /**
   * Transition to new state with validation
   */
  private transitionState(newState: LicenseState, reason: string): void {
    if (!this.licenseData) {
      console.error("[License Manager] Cannot transition: no license data");
      return;
    }

    const currentState = this.licenseData.status;

    if (!this.canTransitionTo(currentState, newState)) {
      throw new Error(
        `Invalid state transition: ${currentState} → ${newState}. Allowed: ${STATE_TRANSITIONS[currentState].join(", ")}`
      );
    }

    const previousState = currentState;
    this.licenseData.status = newState;

    const event: LicenseStateChangeEvent = {
      previousState,
      newState,
      reason,
      timestamp: Date.now(),
      licenseData: this.licenseData,
    };

    console.log(
      `[License Manager] State transition: ${previousState} → ${newState} (${reason})`
    );

    // Notify listeners
    this.stateChangeListeners.forEach((listener) => listener(event));
  }

  /**
   * Set license from activation or validation response
   */
  setLicense(licenseData: LicenseData, isFirstActivation: boolean = false): void {
    const previousState = this.getCurrentState();
    this.licenseData = licenseData;
    this.updateStateBasedOnExpiry();

    if (isFirstActivation) {
      const event: LicenseStateChangeEvent = {
        previousState,
        newState: this.licenseData.status,
        reason: "Initial activation",
        timestamp: Date.now(),
        licenseData: this.licenseData,
      };

      this.stateChangeListeners.forEach((listener) => listener(event));
    }

    console.log(`[License Manager] License set: ${licenseData.productName} (expires: ${new Date(licenseData.expiresAt).toISOString()})`);
  }

  /**
   * Update state based on expiry time
   * Called after loading persisted data or on validation
   */
  private updateStateBasedOnExpiry(): void {
    if (!this.licenseData) return;

    const now = Date.now();
    const state = this.licenseData.status;

    // If license expired and no grace period
    if (
      state === LicenseStateEnum.ACTIVE &&
      now > this.licenseData.expiresAt &&
      (!this.licenseData.graceUntil || now > this.licenseData.graceUntil)
    ) {
      this.transitionState(LicenseStateEnum.EXPIRED, "License expiration date passed");
    }

    // If grace period still active but will expire soon
    if (
      state === LicenseStateEnum.EXPIRED &&
      this.licenseData.graceUntil &&
      now <= this.licenseData.graceUntil
    ) {
      // Stay in EXPIRED but grace period is active
      console.log(
        `[License Manager] In grace period until ${new Date(this.licenseData.graceUntil).toISOString()}`
      );
    }
  }

  /**
   * Mark license as suspended
   */
  suspendLicense(reason: string = "Server requested suspension"): void {
    if (!this.licenseData) return;
    this.transitionState(LicenseStateEnum.SUSPENDED, reason);
  }

  /**
   * Deactivate license for device switch
   */
  deactivateLicense(): void {
    if (!this.licenseData) return;
    
    // Decrement rebinding counter
    this.licenseData.totalResets = (this.licenseData.totalResets || 0) + 1;
    this.licenseData.lastResetDate = Date.now();

    if (this.licenseData.totalResets >= this.licenseData.maxDeviceResets) {
      console.warn(
        `[License Manager] Device rebinding limit reached: ${this.licenseData.totalResets}/${this.licenseData.maxDeviceResets}`
      );
    }

    this.transitionState(LicenseStateEnum.DEACTIVATED, "User requested deactivation for device switch");
  }

  /**
   * Clear license (remove from this device)
   */
  clearLicense(): void {
    this.licenseData = null;
    console.log("[License Manager] License cleared");
  }

  /**
   * Get remaining trial days
   */
  getRemainingTrialDays(): number {
    if (!this.licenseData || this.licenseData.status !== LicenseStateEnum.TRIAL) {
      return 0;
    }

    const now = Date.now();
    const expiresAt = this.licenseData.expiresAt;
    const daysRemaining = Math.max(0, Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24)));

    return daysRemaining;
  }

  /**
   * Register listener for state changes
   */
  onStateChange(listener: (event: LicenseStateChangeEvent) => void): () => void {
    this.stateChangeListeners.push(listener);

    // Return unsubscribe function
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Start periodic validation timer
   */
  startValidationTimer(intervalMs: number = 6 * 60 * 60 * 1000): void {
    // 6 hours default
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
    }

    this.validationTimer = setInterval(() => {
      this.updateStateBasedOnExpiry();
      console.log(`[License Manager] Periodic validation check: ${this.getCurrentState()}`);
      // TODO: Trigger server validation here
    }, intervalMs);

    console.log(`[License Manager] Validation timer started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop validation timer
   */
  stopValidationTimer(): void {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
      console.log("[License Manager] Validation timer stopped");
    }
  }

  /**
   * Get device rebinding info
   */
  getDeviceRebindingInfo(): { current: number; max: number; remaining: number } | null {
    if (!this.licenseData) return null;

    return {
      current: this.licenseData.totalResets || 0,
      max: this.licenseData.maxDeviceResets,
      remaining: Math.max(0, this.licenseData.maxDeviceResets - (this.licenseData.totalResets || 0)),
    };
  }

  canRebindDevice(): DeviceRebindingStatus {
    const info = this.getDeviceRebindingInfo();

    if (!info) {
      return {
        allowed: false,
        current: 0,
        max: 0,
        remaining: 0,
      };
    }

    return {
      allowed: info.remaining > 0,
      current: info.current,
      max: info.max,
      remaining: info.remaining,
    };
  }
}

export const licenseStateManager = new LicenseStateManager();
