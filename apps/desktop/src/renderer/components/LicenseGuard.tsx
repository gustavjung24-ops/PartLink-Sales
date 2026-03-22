/**
 * LicenseGuard Component - Protects routes requiring valid license
 * Task 3.3: License state protection for application pages
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { useLicense, useLicenseProtection } from "../hooks/useLicense";
import { LicenseState } from "@sparelink/shared";

interface LicenseGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Wrapper component for license-protected pages
 */
export function LicenseGuard({ children, fallback }: LicenseGuardProps) {
  const navigate = useNavigate();
  const { isAccessAllowed, isLoading, needsActivation, isExpired, isSuspended } =
    useLicenseProtection();

  React.useEffect(() => {
    if (!isLoading && (needsActivation || isExpired)) {
      navigate("/license", { replace: true });
    }
  }, [isExpired, isLoading, needsActivation, navigate]);

  if (isLoading) {
    return <div className="p-6 text-center">Checking license...</div>;
  }

  if (!isAccessAllowed && !isSuspended) {
    return null;
  }

  if (isSuspended) {
    return (
      fallback || (
        <div className="p-6 max-w-md mx-auto">
          <div className="bg-orange-50 border border-orange-200 rounded p-4">
            <h2 className="text-lg font-semibold mb-2">License Suspended</h2>
            <p className="text-sm">
              Your license has been suspended. Please contact support for assistance.
            </p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}

/**
 * License status indicator for UI
 */
export function LicenseStatusIndicator() {
  const { state } = useLicenseProtection();
  const { license } = useLicense();

  const daysRemaining = React.useMemo(() => {
    if (!license?.expiresAt) {
      return 0;
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((license.expiresAt - Date.now()) / msPerDay));
  }, [license?.expiresAt]);

  const statusConfig: Record<string, { bg: string; text: string; emoji: string }> = {
    [LicenseState.ACTIVE]: { bg: "bg-green-100", text: "text-green-700", emoji: "✓" },
    [LicenseState.TRIAL]: {
      bg: daysRemaining > 7 ? "bg-blue-100" : "bg-orange-100",
      text: daysRemaining > 7 ? "text-blue-700" : "text-orange-700",
      emoji: "⏱",
    },
    [LicenseState.EXPIRED]: { bg: "bg-red-100", text: "text-red-700", emoji: "✕" },
    [LicenseState.SUSPENDED]: { bg: "bg-red-100", text: "text-red-700", emoji: "!" },
    [LicenseState.NO_LICENSE]: { bg: "bg-gray-100", text: "text-gray-700", emoji: "?" },
    [LicenseState.DEACTIVATED]: { bg: "bg-blue-100", text: "text-blue-700", emoji: "↻" },
  };

  const config = statusConfig[state] || statusConfig[LicenseState.NO_LICENSE];

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
      <span>{config.emoji}</span>
      <span>{state}</span>
    </div>
  );
}

/**
 * License info widget for app header/sidebar
 */
export function LicenseInfoWidget() {
  const { isAccessAllowed, isExpired, isSuspended, state } = useLicenseProtection();
  const { license } = useLicense();

  const daysRemaining = React.useMemo(() => {
    if (!license?.expiresAt) {
      return 0;
    }
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((license.expiresAt - Date.now()) / msPerDay));
  }, [license?.expiresAt]);

  if (isAccessAllowed) {
    const trialClass = daysRemaining > 7 ? "text-blue-600" : "text-orange-600";
    const statusClass = state === LicenseState.TRIAL ? trialClass : "text-green-600";

    return (
      <div className="text-xs text-gray-600">
        License: <span className={`font-semibold ${statusClass}`}>{state}</span>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="text-xs">
        License: <span className="font-semibold text-red-600">EXPIRED</span>
      </div>
    );
  }

  if (isSuspended) {
    return (
      <div className="text-xs">
        License: <span className="font-semibold text-orange-600">SUSPENDED</span>
      </div>
    );
  }

  return (
    <div className="text-xs">
      License: <span className="font-semibold text-gray-600">INACTIVE</span>
    </div>
  );
}
