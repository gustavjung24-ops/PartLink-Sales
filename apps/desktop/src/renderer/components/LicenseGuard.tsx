/**
 * LicenseGuard Component - Protects routes requiring valid license
 * Task 3.3: License state protection for application pages
 */

import React from "react";
import { useLicenseProtection } from "../hooks/useLicense";
import { LicenseState } from "@sparelink/shared";

interface LicenseGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Wrapper component for license-protected pages
 */
export function LicenseGuard({ children, fallback }: LicenseGuardProps) {
  const { isAccessAllowed, isLoading, needsActivation, isExpired, isSuspended } =
    useLicenseProtection();

  if (isLoading) {
    return <div className="p-6 text-center">Checking license...</div>;
  }

  if (needsActivation) {
    return (
      fallback || (
        <div className="p-6 max-w-md mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <h2 className="text-lg font-semibold mb-2">License Required</h2>
            <p className="text-sm mb-4">Please activate a license to use this feature.</p>
            <a
              href="/license"
              className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Go to License Activation
            </a>
          </div>
        </div>
      )
    );
  }

  if (isExpired) {
    return (
      fallback || (
        <div className="p-6 max-w-md mx-auto">
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <h2 className="text-lg font-semibold mb-2">License Expired</h2>
            <p className="text-sm mb-4">Your license has expired. Please renew to continue.</p>
            <a
              href="/license"
              className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Renew License
            </a>
          </div>
        </div>
      )
    );
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

  if (!isAccessAllowed) {
    return (
      fallback || (
        <div className="p-6 max-w-md mx-auto">
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-sm">You don't have access to this feature.</p>
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
  const { isAccessAllowed, state } = useLicenseProtection();

  const statusConfig: Record<string, { bg: string; text: string; emoji: string }> = {
    [LicenseState.ACTIVE]: { bg: "bg-green-100", text: "text-green-700", emoji: "✓" },
    [LicenseState.TRIAL]: { bg: "bg-yellow-100", text: "text-yellow-700", emoji: "⏱️" },
    [LicenseState.EXPIRED]: { bg: "bg-red-100", text: "text-red-700", emoji: "✕" },
    [LicenseState.SUSPENDED]: { bg: "bg-orange-100", text: "text-orange-700", emoji: "⚠️" },
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

  if (isAccessAllowed) {
    return (
      <div className="text-xs text-gray-600">
        License: <span className="font-semibold text-green-600">{state}</span>
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
