/**
 * useLicense Hook - React hook for license management
 * Handles license state, validation, and UI integration
 */

import { useEffect, useState, useCallback } from "react";
import type { LicenseData, LicenseState } from "@sparelink/shared";
import { LicenseState as LicenseStateEnum } from "@sparelink/shared";

export interface UseLicenseReturn {
  license: LicenseData | null;
  state: LicenseState;
  isValid: boolean;
  isLoading: boolean;
  error: string | null;
  activate: (licenseKey: string) => Promise<void>;
  deactivate: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook to manage license state
 */
export function useLicense(): UseLicenseReturn {
  const [license, setLicense] = useState<LicenseData | null>(null);
  const [state, setState] = useState<LicenseState>(LicenseStateEnum.NO_LICENSE);
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load license on mount
   */
  useEffect(() => {
    loadLicense();
  }, []);

  const loadLicense = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [currentLicense, currentState, valid] = await Promise.all([
        window.electronAPI.license.getCurrent(),
        window.electronAPI.license.getState(),
        window.electronAPI.license.isValid(),
      ]);

      setLicense(currentLicense);
      setState(currentState as LicenseState);
      setIsValid(valid);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load license";
      setError(message);
      setLicense(null);
      setState(LicenseStateEnum.NO_LICENSE);
      setIsValid(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const activate = useCallback(async (licenseKey: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await window.electronAPI.license.activate({
        licenseKey,
      });

      setLicense(response.licenseData);
      setState(response.status);
      setIsValid(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Activation failed";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deactivate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await window.electronAPI.license.deactivate();
      setLicense(null);
      setState(LicenseStateEnum.DEACTIVATED);
      setIsValid(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deactivation failed";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!license) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await window.electronAPI.license.validate({
        licenseKey: license.key,
      });

      setLicense(response.licenseData);
      setState(response.status);
      setIsValid(response.status !== LicenseStateEnum.EXPIRED &&
                 response.status !== LicenseStateEnum.SUSPENDED);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [license]);

  return {
    license,
    state,
    isValid,
    isLoading,
    error,
    activate,
    deactivate,
    refresh,
  };
}

/**
 * Hook for license protection - redirect if not licensed
 */
export function useLicenseProtection() {
  const { isValid, isLoading, state } = useLicense();

  const isAccessAllowed = isValid && state !== LicenseStateEnum.EXPIRED;

  return {
    isAccessAllowed,
    isLoading,
    state,
    needsActivation: !isValid && state === LicenseStateEnum.NO_LICENSE,
    isExpired: state === LicenseStateEnum.EXPIRED,
    isSuspended: state === LicenseStateEnum.SUSPENDED,
  };
}
