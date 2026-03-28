import { useState } from "react";

interface LicenseResp {
  ok: boolean;
  status: string;
  message?: string;
}

export default function Activate(): JSX.Element {
  const [key, setKey] = useState("");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const onCheck = async () => {
    if (!key.trim()) {
      setMsg("Vui long nhap ma kich hoat.");
      return;
    }

    setLoading(true);
    try {
      const r = (await window.license.check(key.trim())) as LicenseResp;
      setMsg(`${r.status}${r.message ? `: ${r.message}` : ""}`);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Check that bai");
    } finally {
      setLoading(false);
    }
  };

  const onActivate = async () => {
    if (!key.trim()) {
      setMsg("Vui long nhap ma kich hoat.");
      return;
    }

    setLoading(true);
    try {
      const r = (await window.license.activate(
        key.trim(),
        customer.trim() || undefined,
        phone.trim() || undefined
      )) as LicenseResp;
      setMsg(`${r.status}${r.message ? `: ${r.message}` : ""}`);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Activate that bai");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Kich hoat ban quyen</h2>
      <input
        className="w-full rounded border border-slate-300 px-3 py-2"
        placeholder="Ma Kich Hoat"
        value={key}
        onChange={(e) => setKey(e.target.value)}
      />
      <input
        className="w-full rounded border border-slate-300 px-3 py-2"
        placeholder="Khach hang (tuy chon)"
        value={customer}
        onChange={(e) => setCustomer(e.target.value)}
      />
      <input
        className="w-full rounded border border-slate-300 px-3 py-2"
        placeholder="SDT (tuy chon)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={onCheck}
          className="rounded bg-slate-100 px-4 py-2 hover:bg-slate-200 disabled:opacity-50"
        >
          Kiem tra
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={onActivate}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Kich hoat
        </button>
      </div>
      {msg && <div className="text-sm text-slate-700">{msg}</div>}
    </div>
  );
}
