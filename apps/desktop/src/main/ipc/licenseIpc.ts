import { app, ipcMain } from "electron";
import { deviceFingerprintService } from "../services/fingerprint";
import { activateLicense, checkLicense } from "../services/licenseWebApp";

interface ActivatePayload {
  licenseKey: string;
  customer?: string;
  phone?: string;
}

ipcMain.handle("license:webapp:check", async (_event, licenseKey: string) => {
  const softwareName = app.getName() || "Partling-sale";
  return checkLicense(licenseKey, softwareName);
});

ipcMain.handle("license:webapp:activate", async (_event, payload: ActivatePayload) => {
  const softwareName = app.getName() || "Partling-sale";
  const machineId = await deviceFingerprintService.getFingerprintHash();
  return activateLicense(payload.licenseKey, machineId, softwareName, payload.customer, payload.phone);
});
