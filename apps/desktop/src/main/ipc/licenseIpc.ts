import { app, ipcMain } from "electron";
import { deviceFingerprintService } from "../services/fingerprint";
import { callWebApp } from "../services/licenseWebApp";

interface ActivatePayload {
  licenseKey: string;
  customer?: string;
  phone?: string;
}

ipcMain.handle("license:webapp:check", async (_event, licenseKey: string) => {
  const softwareName = app.getName() || "Partling-sale";
  return callWebApp("check", { licenseKey, softwareName });
});

ipcMain.handle("license:webapp:activate", async (_event, payload: ActivatePayload) => {
  const softwareName = app.getName() || "Partling-sale";
  const machineId = await deviceFingerprintService.getFingerprintHash();

  return callWebApp("activate", {
    licenseKey: payload.licenseKey,
    machineId,
    softwareName,
    customer: payload.customer,
    phone: payload.phone,
  });
});
