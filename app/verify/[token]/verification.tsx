"use client";
import { useEffect, useState } from "react";
import { Award, ShieldCheck, BookOpen } from "lucide-react";
export default function Verification({ token }: { token: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/certificate/verify?token=" + encodeURIComponent(token), {
      cache: "no-store",
    })
      .then(async (r) => {
        const j: any = await r.json();
        if (!r.ok) throw new Error(j.error);
        setData(j);
      })
      .catch((e) => setError(e.message));
  }, [token]);
  return (
    <main className="public-view">
      <a href="/" className="brand">
        <BookOpen /> LITRIC
      </a>
      <section className="panel" style={{ marginTop: 35, padding: 35 }}>
        <Award size={45} className="green-text" />
        <h1>Pengesahan sijil sekolah</h1>
        {error ? (
          <>
            <p>{error}</p>
            <p>
              Maklumat murid hanya tersedia kepada pengguna sekolah yang
              dibenarkan.
            </p>
            <a
              className="btn primary"
              href={
                "/signin-with-chatgpt?return_to=" +
                encodeURIComponent("/verify/" + token)
              }
              target="_top"
            >
              Log masuk
            </a>
          </>
        ) : data ? (
          <>
            <div className={"notice " + (data.revoked ? "danger" : "")}>
              <ShieldCheck />
              {data.revoked
                ? "Sijil ini telah dibatalkan."
                : "Sijil ditemui dalam daftar sekolah."}
            </div>
            <h2>{data.name}</h2>
            <p>
              {data.category} · {data.total} bahan{" "}
              {data.level ? "· " + data.level + " Bintang" : ""}
            </p>
            <p>{data.date}</p>
            <p>ID {data.id}</p>
            <p className="muted">{data.recognition}</p>
          </>
        ) : (
          <p>Menyemak sijil…</p>
        )}
      </section>
    </main>
  );
}
