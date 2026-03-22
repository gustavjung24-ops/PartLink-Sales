/**
 * License Management Routes
 * Platform Layer: License activation and validation contracts
 *
 * Routes:
 * ├── POST   /api/licenses/activate
 * ├── POST   /api/licenses/validate
 * ├── POST   /api/licenses/deactivate
 * └── GET    /api/licenses/status
 */

import crypto from "crypto";
import type { FastifyInstance } from "fastify";
import {
  LicenseState,
  LicenseActivationPayload,
  LicenseValidationPayload,
  LicenseValidationResponse,
  DeviceDeactivationPayload,
} from "@sparelink/shared";
import { apiError, apiSuccess, handleApiError, validateRequiredFields } from "../errors";
import { ApiErrorCode } from "../types";
import { prisma } from "../database/client";
import { licenseRepository } from "../database/repositories";
import { licenseService } from "../modules/licenses/services/license.service";

function createNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

const CLOCK_TOLERANCE_MS = 2 * 60 * 1000;

function mapLicenseState(status: string, isTrial: boolean): LicenseState {
  if (isTrial && status !== "REVOKED") {
    return LicenseState.TRIAL;
  }

  switch (status) {
    case "ACTIVATED":
      return LicenseState.ACTIVE;
    case "EXPIRED":
      return LicenseState.EXPIRED;
    case "SUSPENDED":
      return LicenseState.SUSPENDED;
    case "REVOKED":
      return LicenseState.DEACTIVATED;
    default:
      return LicenseState.NO_LICENSE;
  }
}

async function buildValidationResponse(key: string, machineId: string, message?: string): Promise<LicenseValidationResponse | null> {
  const license = await licenseRepository.findByKey(key);
  if (!license) {
    return null;
  }

  const activation = license.activations.find((item) => item.machineId === machineId) ?? license.activations[0] ?? null;
  const expiresAt = license.expiryDate ?? license.trialEndDate ?? activation?.expiresAt ?? license.createdAt;
  const nonce = createNonce();
  const nonceIssuedAt = new Date();

  if (activation) {
    await prisma.activation.update({
      where: { id: activation.id },
      data: {
        serverNonce: nonce,
        nonceIssuedAt,
        lastValidatedAt: nonceIssuedAt,
      } as any,
    });
  }

  return {
    success: true,
    status: mapLicenseState(license.status, license.isTrial),
    licenseData: {
      key: license.licenseKey,
      deviceId: activation?.machineId ?? machineId,
      status: mapLicenseState(license.status, license.isTrial),
      activatedAt: (activation?.activatedAt ?? license.createdAt).getTime(),
      expiresAt: expiresAt.getTime(),
      productName: "SPARELINK Pro",
      productVersion: "1.0.0",
      features: ["search", "quotes", "offline-sync"],
      maxDeviceResets: 2,
      totalResets: activation?.rebindCount ?? 0,
      lastResetDate: activation?.rebindLastAt?.getTime(),
      lastValidatedAt: nonceIssuedAt.getTime(),
      nonceIssuedAt: nonceIssuedAt.getTime(),
    },
    serverTime: Date.now(),
    nonce,
    nonceIssuedAt: nonceIssuedAt.getTime(),
    message,
  };
}

export async function registerLicenseRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: LicenseActivationPayload }>("/activate", async (request, reply) => {
    const validation = validateRequiredFields(request.body as unknown as Record<string, unknown>, ["key", "deviceFingerprint"]);
    if (validation) {
      return reply.code(400).send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, validation));
    }

    const result = await licenseService.activateLicense(
      request.body.key,
      request.body.deviceFingerprint.machineId,
      request.body.deviceFingerprint as unknown as Record<string, unknown>
    );

    if (!result.activated) {
      return reply.code(400).send(apiError(ApiErrorCode.INVALID_PAYLOAD, result.error ?? "Activation failed"));
    }

    const response = await buildValidationResponse(request.body.key, request.body.deviceFingerprint.machineId, "License activated");
    return reply.code(200).send(apiSuccess(response));
  });

  fastify.post<{ Body: LicenseValidationPayload }>("/validate", async (request, reply) => {
    const validation = validateRequiredFields(request.body as unknown as Record<string, unknown>, ["key", "deviceFingerprint", "lastNonce", "clientTime"]);
    if (validation) {
      return reply.code(400).send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, validation));
    }

    const license = await licenseRepository.findByKey(request.body.key);
    if (!license) {
      return reply.code(404).send(apiError(ApiErrorCode.NOT_FOUND, "License not found"));
    }

    const activation = license.activations.find((item) => item.machineId === request.body.deviceFingerprint.machineId);
    if (!activation) {
      return reply.code(401).send(apiError(ApiErrorCode.UNAUTHORIZED, "Device not activated for this license"));
    }

    const activationToken = activation as typeof activation & {
      serverNonce?: string | null;
      nonceIssuedAt?: Date | null;
    };

    if (activationToken.serverNonce && request.body.lastNonce !== activationToken.serverNonce) {
      return reply
        .code(401)
        .send(apiError(ApiErrorCode.UNAUTHORIZED, "Invalid validation challenge. Please re-activate online."));
    }

    if (
      activationToken.nonceIssuedAt &&
      request.body.clientTime < activationToken.nonceIssuedAt.getTime() - CLOCK_TOLERANCE_MS
    ) {
      return reply
        .code(401)
        .send(apiError(ApiErrorCode.UNAUTHORIZED, "System clock rollback detected. Online re-validation required."));
    }

    const result = await licenseService.validateLicense(request.body.key, request.body.deviceFingerprint.machineId);
    if (!result.valid) {
      return reply.code(401).send(apiError(ApiErrorCode.UNAUTHORIZED, result.reason ?? "License validation failed"));
    }

    const response = await buildValidationResponse(request.body.key, request.body.deviceFingerprint.machineId, "License valid");
    return reply.code(200).send(apiSuccess(response));
  });

  fastify.post<{ Body: DeviceDeactivationPayload }>("/deactivate", async (request, reply) => {
    const validation = validateRequiredFields(request.body as unknown as Record<string, unknown>, ["key", "deviceId", "reason"]);
    if (validation) {
      return reply.code(400).send(apiError(ApiErrorCode.MISSING_REQUIRED_FIELD, validation));
    }

    try {
      const license = await licenseRepository.findByKey(request.body.key);
      if (!license) {
        return reply.code(404).send(apiError(ApiErrorCode.NOT_FOUND, "License not found"));
      }

      const result = await prisma.$transaction(async (tx) => {
        const deactivated = await tx.activation.updateMany({
          where: {
            licenseId: license.id,
            machineId: request.body.deviceId,
            status: "ACTIVE",
          },
          data: {
            status: "REVOKED",
            rebindLastAt: new Date(),
          },
        });

        if (deactivated.count > 0) {
          await tx.license.update({
            where: { id: license.id },
            data: {
              activationCount: {
                decrement: Math.min(deactivated.count, license.activationCount),
              },
            },
          });
        }

        return deactivated.count;
      });

      if (result === 0) {
        return reply.code(404).send(apiError(ApiErrorCode.NOT_FOUND, "Active device activation not found"));
      }

      return reply.code(200).send(apiSuccess({ success: true, message: "License deactivated" }));
    } catch (error) {
      return reply.code(500).send(handleApiError(error));
    }
  });

  fastify.get<{ Params: { key: string } }>("/status/:key", async (request, reply) => {
    try {
      const license = await licenseRepository.findByKey(request.params.key);
      if (!license) {
        return reply.code(404).send(apiError(ApiErrorCode.NOT_FOUND, "License not found"));
      }

      const activation = license.activations[0] ?? null;
      const expiresAt = license.expiryDate ?? license.trialEndDate ?? activation?.expiresAt ?? license.createdAt;

      return reply.code(200).send(
        apiSuccess({
          key: license.licenseKey,
          status: license.status,
          activatedAt: (activation?.activatedAt ?? license.createdAt).getTime(),
          expiresAt: expiresAt.getTime(),
          deviceId: activation?.machineId ?? "",
          resets: {
            current: activation?.rebindCount ?? 0,
            max: 2,
            resetDate: activation?.rebindLastAt?.getTime() ?? 0,
          },
        })
      );
    } catch (error) {
      return reply.code(500).send(handleApiError(error));
    }
  });
}

export interface LicenseRoutes {
  /**
   * POST /api/licenses/activate
   * Activate license on new device
   * Returns: LicenseValidationResponse with initial nonce
   */
  activateContract: {
    request: LicenseActivationPayload;
    response: LicenseValidationResponse;
  };

  /**
   * POST /api/licenses/validate
   * Periodic license re-validation (background task)
   * Checks if license still valid, detects clock skew
   * Returns: Updated LicenseValidationResponse with new nonce
   */
  validateContract: {
    request: LicenseValidationPayload;
    response: LicenseValidationResponse;
  };

  /**
   * POST /api/licenses/deactivate
   * Deactivate license from device (for switch to new device)
   * Decrements rebinding counter
   */
  deactivateContract: {
    request: DeviceDeactivationPayload;
    response: { success: boolean; message: string };
  };

  /**
   * GET /api/licenses/status/:key
   * Get current license status (public, for support tools)
   */
  statusContract: {
    response: {
      key: string;
      status: string;
      activatedAt: number;
      expiresAt: number;
      deviceId: string;
      resets: { current: number; max: number; resetDate: number };
    };
  };
}
