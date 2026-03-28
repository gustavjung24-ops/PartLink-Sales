import { ipcMain, app } from "electron";
import { getHashedMachineId } from "../services/fingerprint";
import { checkLicense, activateLicense } from "../services/licenseWebApp";

ipcMain.handle("license:check", async (_e, licenseKey: string) => {
  const softwareName = app.getName() || "Partling-sale";
  return checkLicense(licenseKey, softwareName);
});

ipcMain.handle(
  "license:activate",
  async (
    _e,
    p: { licenseKey: string; customer?: string; phone?: string }
  ) => {
    const softwareName = app.getName() || "Partling-sale";
    const mid = await getHashedMachineId();
    return activateLicense(
      p.licenseKey,
      mid,
      softwareName,
      p.customer,
      p.phone
    );
  }
);
