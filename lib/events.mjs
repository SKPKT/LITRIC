import { norm, identityKey, stable, digest } from "./domain.mjs";
export function eventDate(value) {
  const s = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s
    ? s
    : null;
}
export async function prepareEvents(rawRows, school, existing = new Map()) {
  const events = [],
    errors = [],
    seen = new Map();
  let duplicates = 0,
    excluded = 0;
  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i],
      row = raw._row || i + 2;
    if (norm(raw.code) !== school) {
      excluded++;
      continue;
    }
    const eventId = String(raw.event_id || "").trim(),
      sourceId = identityKey(raw),
      date = eventDate(raw.reading_date),
      statusKey = norm(raw.approval_status).replace(/\s+/g, "");
    const status = {
      APPROVED: "approved",
      DILULUSKAN: "approved",
      REJECTED: "rejected",
      DITOLAK: "rejected",
      PENDING: "pending",
      BELUMDISAHKAN: "pending",
    }[statusKey];
    const error = !eventId
      ? "ID peristiwa diperlukan"
      : !sourceId
        ? "Pengecam murid diperlukan untuk peristiwa"
        : !norm(raw.name)
          ? "Nama murid diperlukan"
          : !date
            ? "Tarikh aktiviti mesti YYYY-MM-DD yang sah"
            : !status
              ? "Status kelulusan mesti approved/rejected/pending"
              : !String(raw.title || "").trim()
                ? "Tajuk bahan diperlukan"
                : "";
    if (error) {
      errors.push({ row, status: "rejected", message: error, raw });
      continue;
    }
    const content = {
        eventId,
        sourceId,
        date,
        status,
        name: norm(raw.name),
        title: String(raw.title).trim(),
        language: String(raw.language || "").toLowerCase(),
        category: String(raw.category || "").toLowerCase(),
      },
      hash = await digest(stable(content));
    if (seen.has(eventId)) {
      if (seen.get(eventId) !== hash)
        throw new Error(`ID peristiwa bercanggah dalam fail: ${eventId}`);
      duplicates++;
      errors.push({
        row,
        status: "duplicate",
        message: "ID peristiwa berulang tepat.",
        raw,
      });
      continue;
    }
    seen.set(eventId, hash);
    if (existing.has(eventId)) {
      const prev = existing.get(eventId);
      if (prev.content_hash !== hash) {
        errors.push({
          row,
          status: "review",
          message:
            "ID peristiwa sedia ada mempunyai kandungan berbeza. Semak atau batal kelompok asal sebelum pembetulan.",
          raw,
        });
      } else {
        duplicates++;
        errors.push({
          row,
          status: "duplicate",
          message: "Peristiwa telah diimport dalam kelompok aktif.",
          raw,
        });
      }
      continue;
    }
    events.push({ ...content, hash, raw, row });
  }
  const groups = new Map();
  for (const event of events) {
    const key = event.sourceId + "|" + event.name;
    if (!groups.has(key))
      groups.set(key, {
        code: school,
        school: event.raw.school,
        name: event.raw.name,
        email: event.sourceId,
        approved: 0,
        rejected: 0,
        _row: event.row,
        event_ids: [],
        events: [],
        _languagesComplete: true,
        _categoriesComplete: true,
        "total bm": 0,
        "total eng": 0,
        "total others": 0,
      });
    const r = groups.get(key);
    r.event_ids.push(event.eventId);
    r.events.push(event.raw);
    if (event.status === "rejected") r.rejected++;
    if (event.status !== "approved") continue;
    r.approved++;
    const l = {
      bm: "bm",
      malay: "bm",
      "bahasa melayu": "bm",
      eng: "eng",
      english: "eng",
      "bahasa inggeris": "eng",
      others: "others",
      "lain-lain": "others",
    }[event.language];
    if (l) r["total " + l]++;
    else r._languagesComplete = false;
    const category = {
      fiction: "fiction",
      fiksyen: "fiction",
      nonfiction: "non fiction",
      "non fiction": "non fiction",
      "bukan fiksyen": "non fiction",
      digital: "digital",
      nonbook: "not book",
      "bukan buku": "not book",
    }[event.category];
    if (!l || !category) r._categoriesComplete = false;
    else {
      const k =
        category === "digital" || category === "not book"
          ? category + " " + l
          : "book " + l + " " + category;
      r[k] = (r[k] || 0) + 1;
    }
  }
  const rows = [...groups.values()].map((r) => {
    r.event_ids.sort();
    if (!r._languagesComplete)
      for (const l of ["bm", "eng", "others"]) delete r["total " + l];
    if (r._categoriesComplete)
      for (const l of ["bm", "eng", "others"])
        for (const c of [
          "book " + l + " fiction",
          "book " + l + " non fiction",
          "digital " + l,
          "not book " + l,
        ])
          r[c] ??= 0;
    return r;
  });
  return {
    events,
    rows,
    errors,
    duplicates,
    excluded,
    stats: {
      sourceGranularity: "event",
      sourceEvents: rawRows.length,
      acceptedEvents: events.length,
      rejectedEvents: errors.filter((x) => x.status === "rejected").length,
      reviewEvents: errors.filter((x) => x.status === "review").length,
      duplicateEvents: duplicates,
      excludedEvents: excluded,
    },
  };
}
