import { useState } from "react";

declare global {
  interface Window {
    license: {
      check(k: string): Promise<{ ok: boolean; status: string; message?: string }>;
      activate(
        k: string,
        c?: string,
        p?: string
      ): Promise<{ ok: boolean; status: string; message?: string }>;
    };
  }
}

export default function Activate() {
  const [key, setKey] = useState("");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");

  const onCheck = async () => {
    const r = await window.license.check(key.trim());
    setMsg(`${r.status}${r.message ? `: ${r.message}` : ""}`);
  };
  const onActivate = async () => {
    const r = await window.license.activate(
      key.trim(),
      customer.trim() || undefined,
      phone.trim() || undefined
    );
    setMsg(`${r.status}${r.message ? `: ${r.message}` : ""}`);
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Kích hoạt bản quyền</h2>
      <input
        placeholder="Mã Kích Hoạt"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        className="w-full border rounded px-3 py-2"
      />
      <input
        placeholder="Khách hàng (tùy chọn)"
        value={customer}
        onChange={(e) => setCustomer(e.target.value)}
        className="w-full border rounded px-3 py-2"
      />
      <input
        placeholder="SĐT (tùy chọn)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full border rounded px-3 py-2"
      />
      <div className="flex gap-2">
        <button
          onClick={onCheck}
          className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
        >
          Kiểm tra
        </button>
        <button
          onClick={onActivate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Kích hoạt
        </button>
      </div>
      {msg && <div className="text-sm text-gray-700">{msg}</div>}
    </div>
  );
}
