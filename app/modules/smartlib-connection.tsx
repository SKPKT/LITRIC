import React, { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/client-api";
import { SMARTLIB_SOURCE_URL } from "../../lib/smartlib-status.mjs";

const labels: Record<string, string> = {
  connected: "Connected — verified live connection",
  disconnected: "Disconnected — connection failed",
  not_configured: "Not Configured — missing configuration",
  stale: "Stale Data — last synchronization is outdated",
};
const timestamp = (value: string | null) => value
  ? new Date(value).toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur" }) + " MYT"
  : "Belum ada pengesahan";

export function SmartlibConnection() {
  const [connection, setConnection] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const check = useCallback(async (signal?: AbortSignal) => {
    setBusy(true);
    try {
      const response = await apiFetch("/api/smartlib/status", { signal });
      if (!response.ok) throw new Error("Status unavailable");
      const result: any = await response.json();
      if (!labels[result.status]) throw new Error("Invalid status");
      if (signal?.aborted) return;
      setConnection(result);
      setFailed(false);
    } catch {
      if (signal?.aborted) return;
      // Never retain a green status after a failed health request.
      setConnection(null);
      setFailed(true);
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void check(controller.signal);
    const interval = setInterval(() => void check(controller.signal), 60_000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [check]);
  return <section className="smartlib-connection" aria-labelledby="smartlib-connection-heading">
    <div className="smartlib-connection-heading">
      <h3 id="smartlib-connection-heading">SMARTLIB Connection</h3>
      <button className="btn" disabled={busy} onClick={() => void check()}>
        {busy ? "Menyemak…" : "Semak status"}
      </button>
    </div>
    <p role="status">{failed ? labels.disconnected : connection ? labels[connection.status] : "Menyemak status sambungan…"}</p>
    <dl>
      <dt>Sumber SMARTLIB</dt>
      <dd><a href={SMARTLIB_SOURCE_URL} target="_blank" rel="noreferrer">{SMARTLIB_SOURCE_URL}</a><br/>Frontend disahkan; sambungan backend dan pangkalan data belum disahkan.</dd>
      <dt>Sambungan data terakhir berjaya</dt><dd>{timestamp(connection?.lastSuccessfulConnectionAt)}</dd>
      <dt>Sinkronisasi katalog terakhir</dt><dd>{timestamp(connection?.lastCatalogueSyncAt)}</dd>
      <dt>Pengesahan sambungan terakhir</dt><dd>{timestamp(connection?.verifiedAt)}</dd>
      <dt>Rekod katalog berjaya dibaca</dt><dd>{connection?.catalogueRecordsRead ?? "Belum disahkan"}</dd>
      <dt>Kesihatan sambungan</dt><dd>{connection?.health === "not_verified" ? "Belum disahkan" : failed ? "Semakan status gagal" : "Belum diketahui"}</dd>
    </dl>
    <p className="muted">SMARTLIB Integration: NOT VERIFIED</p>
    <p className="muted">Akses baca sahaja khusus, pemetaan pangkalan data produksi dan ujian katalog/pinjaman sebenar masih diperlukan. Tiada judul buku atau ketersediaan direka.</p>
  </section>;
}
