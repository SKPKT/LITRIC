"use client";
import {useEffect, useState} from "react";
import {apiFetch, isPages} from "../lib/client-api";
export function ProtectedImage({src, alt}: {src: string; alt: string}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!isPages) return;
    let active = true, objectUrl = "";
    apiFetch(src).then(async r => {
      if (!r.ok || !r.headers.get("content-type")?.startsWith("image/")) return;
      objectUrl = URL.createObjectURL(await r.blob());
      if (active) setUrl(objectUrl); else URL.revokeObjectURL(objectUrl);
    }).catch(() => {});
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);
  return !isPages || url ? <img src={isPages ? url : src} alt={alt}/> : <span>{alt}</span>;
}
