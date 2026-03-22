/**
 * License Activation Page
 * Task 3.3: License activation screen UI
 * - License key input form
 * - Status indicators
 * - Trial countdown
 * - Success/error messages
 * - License info table
 * - Deactivate option
 */

import React, { useEffect, useState } from "react";
import type { LicenseData, LicenseState, LicenseValidationResponse } from "@sparelink/shared";
import { LicenseState as LicenseStateEnum } from "@sparelink/shared";

interface LicenseActivationPageProps {
  onActivationSuccess?: (license: LicenseData) => void;
}

type PageState = "IDLE" | "LOADING" | "ERROR" | "SUCCESS" | "DEACTIVATING";

export function LicenseActivationPage({ onActivationSuccess }: LicenseActivationPageProps) {
  const [licenseKey, setLicenseKey] = useState("");
  const [currentLicense, setCurrentLicense] = useState<LicenseData | null>(null);
  const [licenseState, setLicenseState] = useState<LicenseState | null>(null);
  const [pageState, setPageState] = useState<PageState>("IDLE");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  /**
   * Load current license on component mount
   */
  useEffect(() => {
    loadCurrentLicense();
  }, []);

  const loadCurrentLicense = async () => {
    try {
      const current = await window.electronAPI.license.getCurrent();
      const state = await window.electronAPI.license.getState();

      setCurrentLicense(current);
      setLicenseState(state as LicenseState);
    } catch (error) {
      // No license is OK -  just stay in IDLE
      setCurrentLicense(null);
      setLicenseState(LicenseStateEnum.NO_LICENSE);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!licenseKey.trim()) {
      setErrorMessage("Please enter a license key");
      return;
    }

    setPageState("LOADING");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await window.electronAPI.license.activate({
        licenseKey: licenseKey.trim(),
      });

      setCurrentLicense(response.licenseData);
      setLicenseState(response.status);
      setSuccessMessage(`✓ License activated successfully: ${response.licenseData.productName}`);
      setLicenseKey("");
      setPageState("SUCCESS");

      onActivationSuccess?.(response.licenseData);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Activation failed";
      setErrorMessage(message);
      setPageState("ERROR");
    }
  };

  const handleDeactivate = async () => {
    if (!currentLicense) return;

    if (!window.confirm("Deactivate license for device switch? You can activate on another device.")) {
      return;
    }

    setPageState("DEACTIVATING");
    setErrorMessage("");

    try {
      await window.electronAPI.license.deactivate();
      setCurrentLicense(null);
      setLicenseState(LicenseStateEnum.DEACTIVATED);
      setSuccessMessage("✓ License deactivated. Ready for new device activation.");
      setPageState("SUCCESS");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Deactivation failed";
      setErrorMessage(message);
      setPageState("ERROR");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">License Management</h1>

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
          <p className="font-semibold">⚠️ Error</p>
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded text-green-800">
          <p>{successMessage}</p>
        </div>
      )}

      {/* Current License Status */}
      {currentLicense && <LicenseDisplayCard license={currentLicense} state={licenseState} />}

      {/* Activation Form */}
      {(!currentLicense || licenseState === LicenseStateEnum.EXPIRED) && (
        <form onSubmit={handleActivate} className="mt-8">
          <div className="bg-white p-6 rounded border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">Activate License</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">License Key</label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="e.g., SL-XXXX-XXXX-XXXX"
                disabled={pageState === "LOADING"}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>

            <button
              type="submit"
              disabled={pageState === "LOADING"}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {pageState === "LOADING" ? "Activating..." : "Activate License"}
            </button>
          </div>

          {/* Note */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
            <p>
              📝 Enter the license key you received by email. Device fingerprint will be automatically
              sent for validation.
            </p>
          </div>
        </form>
      )}

      {/* Deactivate Button */}
      {currentLicense && licenseState !== LicenseStateEnum.DEACTIVATED && (
        <div className="mt-8">
          <button
            onClick={handleDeactivate}
            disabled={pageState === "DEACTIVATING"}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
          >
            {pageState === "DEACTIVATING" ? "Deactivating..." : "Deactivate for Device Switch"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * License Display Card Component
 */
interface LicenseDisplayCardProps {
  license: LicenseData;
  state: LicenseState | null;
}

function LicenseDisplayCard({ license, state }: LicenseDisplayCardProps) {
  const daysRemaining = calculateDaysRemaining(license.expiresAt);
  const isExpired = state === LicenseStateEnum.EXPIRED || state === LicenseStateEnum.EXPIRED;
  const isTrialing = state === LicenseStateEnum.TRIAL;

  return (
    <div className={`p-6 rounded border-2 ${isExpired ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-2xl font-bold">{license.productName}</h3>
          <p className="text-sm text-gray-600">Status: {renderStatusBadge(state)}</p>
        </div>
      </div>

      {/* Trial Countdown */}
      {isTrialing && daysRemaining >= 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm font-semibold">⏱️ Trial Active</p>
          <p className="text-lg font-bold">{daysRemaining} days remaining</p>
        </div>
      )}

      {/* License Info Table */}
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-t">
            <td className="py-2 font-semibold">Activated</td>
            <td>{formatDate(license.activatedAt)}</td>
          </tr>
          <tr className="border-t">
            <td className="py-2 font-semibold">Expires</td>
            <td>
              {formatDate(license.expiresAt)}
              {daysRemaining < 30 && !isExpired && <span className="text-red-600 ml-2">⚠️ Soon</span>}
            </td>
          </tr>
          <tr className="border-t">
            <td className="py-2 font-semibold">Device ID</td>
            <td className="font-mono text-xs">{license.deviceId.substring(0, 16)}...</td>
          </tr>
          <tr className="border-t">
            <td className="py-2 font-semibold">Device Resets</td>
            <td>
              {license.totalResets}/{license.maxDeviceResets}
            </td>
          </tr>
          {license.features && license.features.length > 0 && (
            <tr className="border-t">
              <td className="py-2 font-semibold">Features</td>
              <td>{license.features.join(", ")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Helper: Calculate days remaining
 */
function calculateDaysRemaining(expiresAt: number): number {
  const now = Date.now();
  const msRemaining = expiresAt - now;
  return Math.max(0, Math.floor(msRemaining / (1000 * 60 * 60 * 24)));
}

/**
 * Helper: Format date for display
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Helper: Render status badge
 */
function renderStatusBadge(state: LicenseState | null): React.ReactNode {
  const badges: Record<string, { bg: string; text: string; label: string }> = {
    [LicenseStateEnum.NO_LICENSE]: { bg: "bg-gray-50", text: "text-gray-600", label: "No License" },
    [LicenseStateEnum.TRIAL]: {
      bg: "bg-yellow-50",
      text: "text-yellow-600",
      label: "Trial Mode",
    },
    [LicenseStateEnum.ACTIVE]: { bg: "bg-green-50", text: "text-green-600", label: "Active" },
    [LicenseStateEnum.EXPIRED]: { bg: "bg-red-50", text: "text-red-600", label: "Expired" },
    [LicenseStateEnum.SUSPENDED]: { bg: "bg-orange-50", text: "text-orange-600", label: "Suspended" },
    [LicenseStateEnum.DEACTIVATED]: { bg: "bg-blue-50", text: "text-blue-600", label: "Deactivated" },
  };

  const badge = badges[state || LicenseStateEnum.NO_LICENSE];
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  );
}
