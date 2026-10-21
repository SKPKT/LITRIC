export const DEFAULT_RULE = {
  thresholds: [144, 288, 432, 576, 720],
  marks: [3, 4, 5, 6, 7],
  certified: false,
};
export const SCHOOL = {
  id: "ABA6052",
  code: "ABA6052",
  name: "SK Pendidikan Khas Taiping",
};
export const MONTHS = [
  "Jan",
  "Feb",
  "Mac",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Ogos",
  "Sep",
  "Okt",
  "Nov",
  "Dis",
];
export const norm = (x) =>
  String(x ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
export const identityKey = (row) =>
  String(row.email || row.source_id || "")
    .trim()
    .toLowerCase();
export const stable = (x) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(x)
        .filter(([k]) => !k.startsWith("_"))
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
export async function digest(x) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(typeof x === "string" ? x : stable(x)),
      ),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function star(total, rule = DEFAULT_RULE) {
  if (total == null)
    return {
      level: null,
      marks: null,
      next: null,
      remaining: null,
      progress: 0,
    };
  const level = rule.thresholds.filter((n) => total >= n).length,
    next = rule.thresholds[level] ?? null,
    previous = level ? rule.thresholds[level - 1] : 0;
  return {
    level,
    marks: level ? rule.marks[level - 1] : null,
    next,
    remaining: next == null ? 0 : Math.max(0, next - total),
    progress:
      next == null
        ? 100
        : Math.max(
            0,
            Math.min(100, ((total - previous) / (next - previous)) * 100),
          ),
  };
}
export function validRule(r) {
  return (
    r.thresholds?.length === 5 &&
    r.marks?.length === 5 &&
    r.thresholds.every(
      (x, i, a) => Number.isSafeInteger(x) && x > 0 && (!i || x > a[i - 1]),
    ) &&
    r.marks.every((x) => Number.isSafeInteger(x) && x >= 0 && x <= 100)
  );
}
export function integer(value) {
  const s = String(value ?? "").trim();
  return /^\d+$/.test(s) &&
    Number.isSafeInteger(Number(s)) &&
    Number(s) <= 10000000
    ? Number(s)
    : null;
}
const measureKeys = [
  "total eng",
  "total bm",
  "total others",
  "digital eng",
  "digital bm",
  "digital others",
  "not book eng",
  "not book bm",
  "not book others",
  "book eng fiction",
  "book eng non fiction",
  "book bm fiction",
  "book bm non fiction",
  "book others fiction",
  "book others non fiction",
];
export async function reviewRows(rawRows, school = SCHOOL.code) {
  const rows = [],
    errors = [],
    seen = new Set(),
    counts = new Map();
  let excluded = 0;
  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i],
      code = norm(raw.code),
      rowNumber = raw._row || i + 2;
    if (code !== school) {
      excluded++;
      continue;
    }
    const rowHash = await digest(stable(raw)),
      approved = integer(raw.approved),
      rejected = integer(raw.rejected ?? 0),
      measures = {};
    let issue = !norm(raw.name)
      ? "Nama murid tiada"
      : approved == null || rejected == null
        ? "Bacaan mesti nombor bulat bukan negatif"
        : "";
    for (const k of measureKeys) {
      if (raw[k] != null && raw[k] !== "") {
        const n = integer(raw[k]);
        if (n == null) issue = `Nilai tidak sah: ${k}`;
        else measures[k] = n;
      }
    }
    const sourceId = identityKey(raw);
    const status = seen.has(rowHash)
      ? "duplicate"
      : issue
        ? "rejected"
        : !sourceId
          ? "review"
          : "accepted";
    if (status === "review")
      issue = "Pengecam sumber tiada. Padanan nama memerlukan semakan.";
    if (status === "duplicate") issue = "Baris sumber berulang tepat.";
    seen.add(rowHash);
    if (status === "accepted")
      counts.set(sourceId, (counts.get(sourceId) || 0) + 1);
    rows.push({
      raw,
      rowNumber,
      rowHash,
      sourceId,
      name: String(raw.name || "").trim(),
      approved: approved ?? 0,
      rejected: rejected ?? 0,
      measures,
      status,
      issue,
      originalSchool: String(raw._originalSchool || raw.code || ""),
    });
  }
  for (const r of rows) {
    if (r.status === "accepted" && counts.get(r.sourceId) > 1) {
      r.status = "review";
      r.issue =
        "Pengecam murid berulang dengan kandungan berbeza dalam fail yang sama.";
    }
    if (r.issue)
      errors.push({ row: r.rowNumber, status: r.status, message: r.issue });
  }
  const stats = {
    accepted: 0,
    rejected: 0,
    duplicate: 0,
    review: 0,
    excluded,
    reported: 0,
    students: 0,
  };
  const students = new Set();
  for (const r of rows) {
    stats[r.status]++;
    if (!["rejected", "duplicate"].includes(r.status)) {
      stats.reported += r.approved;
      students.add(r.sourceId || r.rowHash);
    }
  }
  stats.students = students.size;
  return { rows, errors, stats };
}
export function validScope(b) {
  if (
    !Number.isInteger(b.year) ||
    b.year < 2000 ||
    b.year > 2100 ||
    !["monthly", "annual", "snapshot", "event"].includes(b.granularity)
  )
    return false;
  const iso = (s) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s || "") &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  return (
    iso(b.period_start) &&
    iso(b.period_end) &&
    b.period_start <= b.period_end &&
    Number(b.period_start.slice(0, 4)) === b.year &&
    Number(b.period_end.slice(0, 4)) === b.year &&
    (b.granularity !== "snapshot" ||
      (iso(b.snapshot_date) && b.snapshot_date >= b.period_end))
  );
}
export function overlap(a, b) {
  return a.period_start <= b.period_end && b.period_start <= a.period_end;
}
export function selectVerified(rows, batches) {
  const map = new Map(batches.map((b) => [b.id, b]));
  const eligible = rows.filter(
    (r) =>
      r.status === "accepted" &&
      map.get(r.batch_id)?.status === "active" &&
      map.get(r.batch_id)?.verification === "verified" &&
      map.get(r.batch_id)?.star_eligible &&
      validScope(map.get(r.batch_id)),
  );
  const groups = new Map(),
    blocked = [];
  for (const row of eligible) {
    const b = map.get(row.batch_id),
      key = `${row.canonical_id || row.student_id}|${b.dataset}|${b.year}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ row, b });
  }
  const result = [];
  for (const group of groups.values()) {
    const snaps = group
      .filter((x) => x.b.granularity === "snapshot")
      .sort(
        (a, b) =>
          b.b.snapshot_date.localeCompare(a.b.snapshot_date) ||
          b.b.created_at.localeCompare(a.b.created_at),
      );
    const baselines = new Set();
    const latestSnapshots = snaps.filter((x) => {
      if (baselines.has(x.b.period_start)) return false;
      baselines.add(x.b.period_start);
      return true;
    });
    const selected = snaps.length
      ? [
          ...latestSnapshots,
          ...group.filter((x) => x.b.granularity !== "snapshot"),
        ]
      : group;
    const collisions = selected.some((x, i) =>
      selected.some(
        (y, j) =>
          i < j &&
          overlap(x.b, y.b) &&
          !(x.b.granularity === "event" && y.b.granularity === "event"),
      ),
    );
    if (collisions) {
      blocked.push(group[0].row.canonical_id || group[0].row.student_id);
      continue;
    }
    result.push(...selected.map((x) => x.row));
  }
  const cross = new Set();
  for (let i = 0; i < result.length; i++)
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i],
        b = result[j],
        aa = map.get(a.batch_id),
        bb = map.get(b.batch_id);
      if (
        (a.canonical_id || a.student_id) === (b.canonical_id || b.student_id) &&
        aa.year === bb.year &&
        aa.dataset !== bb.dataset &&
        overlap(aa, bb) &&
        !(aa.granularity === "event" && bb.granularity === "event")
      )
        cross.add(a.canonical_id || a.student_id);
    }
  return {
    rows: result.filter((r) => !cross.has(r.canonical_id || r.student_id)),
    blocked: [...new Set([...blocked, ...cross])],
  };
}
export function readingValue(row, f = {}) {
  const m =
      typeof row.measures === "string"
        ? JSON.parse(row.measures)
        : row.measures || {},
    langs = f.language ? [f.language] : ["bm", "eng", "others"];
  if (f.category) {
    const keys = langs.map((l) =>
      f.category === "fiction"
        ? `book ${l} fiction`
        : f.category === "nonfiction"
          ? `book ${l} non fiction`
          : f.category === "digital"
            ? `digital ${l}`
            : `not book ${l}`,
    );
    return keys.every((k) => k in m)
      ? keys.reduce((s, k) => s + m[k], 0)
      : null;
  }
  if (f.language) {
    const k = `total ${f.language}`;
    return k in m ? m[k] : null;
  }
  return row.approved;
}
export function selectSourceRows(rows, batches) {
  const map = new Map(batches.map((b) => [b.id, b])),
    latest = new Map();
  const group = (r) => {
    const b = map.get(r.batch_id);
    return (
      (r.canonical_id || r.student_id) + "|" + b.dataset + "|" + (b.year || "?")
    );
  };
  for (const r of rows) {
    const b = map.get(r.batch_id);
    if (b?.granularity !== "snapshot") continue;
    const k = group(r) + "|" + (b.period_start || "?"),
      prev = latest.get(k);
    if (
      !prev ||
      (b.snapshot_date || b.created_at) >
        (prev.snapshot_date || prev.created_at)
    )
      latest.set(k, b);
  }
  return rows.filter((r) => {
    const b = map.get(r.batch_id),
      base = group(r);
    if (b.granularity === "snapshot")
      return b.id === latest.get(base + "|" + (b.period_start || "?"))?.id;
    return ![...latest.entries()].some(
      ([k, snap]) => k.startsWith(base + "|") && overlap(b, snap),
    );
  });
}
export function aggregate({
  students,
  rows,
  batches,
  rule = DEFAULT_RULE,
  filters = {},
}) {
  const scopedBatches = batches.filter(
    (b) =>
      b.status === "active" &&
      (!filters.dataset || b.dataset === filters.dataset) &&
      (!filters.year || String(b.year) === String(filters.year)) &&
      (!filters.month || b.month_hint === Number(filters.month)) &&
      (!filters.source || b.source_type === filters.source) &&
      (!filters.verification || b.verification === filters.verification),
  );
  const ids = new Set(scopedBatches.map((b) => b.id)),
    studentIds = new Set(
      students
        .filter(
          (s) =>
            (!filters.classId || s.class_id === filters.classId) &&
            (!filters.student || s.id === filters.student),
        )
        .map((s) => s.id),
    );
  const rawScopedRows = rows.filter(
    (r) =>
      ids.has(r.batch_id) &&
      studentIds.has(r.canonical_id || r.student_id) &&
      !["duplicate", "rejected", "excluded"].includes(r.status),
  );
  const scopedRows = selectSourceRows(rawScopedRows, scopedBatches);
  const verified = selectVerified(rawScopedRows, scopedBatches),
    perStudent = new Map();
  for (const r of scopedRows) {
    const id = r.canonical_id || r.student_id;
    if (!perStudent.has(id))
      perStudent.set(id, {
        reported: 0,
        eligible: null,
        hasReading: false,
        unavailable: false,
        eligibleUnavailable: false,
      });
    const x = perStudent.get(id),
      n = readingValue(r, filters);
    if (n != null) {
      x.reported += n;
      x.hasReading ||= n > 0;
    } else x.unavailable = true;
  }
  const eligibleYears = new Set(
      scopedBatches
        .filter((b) => b.verification === "verified" && b.star_eligible)
        .map((b) => b.year),
    ),
    multiyear = eligibleYears.size > 1;
  for (const r of verified.rows) {
    const n = readingValue(r, filters);
    if (n != null) {
      const x = perStudent.get(r.canonical_id || r.student_id);
      x.eligible = (x.eligible ?? 0) + n;
    } else {
      const x = perStudent.get(r.canonical_id || r.student_id);
      if (x) x.eligibleUnavailable = true;
    }
  }
  const list = students
    .filter((s) => perStudent.has(s.id))
    .map((s) => {
      const x = perStudent.get(s.id);
      return {
        ...s,
        ...x,
        reported: x.unavailable ? null : x.reported,
        eligible: multiyear || x.eligibleUnavailable ? null : x.eligible,
        achievement: star(
          multiyear || x.eligibleUnavailable ? null : x.eligible,
          rule,
        ),
      };
    })
    .sort((a, b) => b.reported - a.reported || a.name.localeCompare(b.name));
  const dimensionUnavailable = scopedRows.some(
    (r) => readingValue(r, filters) == null,
  );
  const reported = dimensionUnavailable
      ? null
      : scopedRows.reduce((n, r) => n + (readingValue(r, filters) ?? 0), 0),
    approvedEligible = verified.rows.reduce(
      (n, r) => n + (readingValue(r, filters) ?? 0),
      0,
    ),
    complete =
      scopedBatches.length > 0 &&
      scopedBatches.every(
        (b) =>
          b.verification === "verified" && b.coverage_complete && validScope(b),
      ) &&
      !verified.blocked.length &&
      !dimensionUnavailable &&
      !rawScopedRows.some((r) => r.status === "review") &&
      list.every((s) =>
        coversRange(
          verified.rows
            .filter((r) => (r.canonical_id || r.student_id) === s.id)
            .map((r) => {
              const b = scopedBatches.find((b) => b.id === r.batch_id);
              return [b.period_start, b.period_end];
            }),
          scopedBatches.map((b) => b.period_start).sort()[0],
          scopedBatches
            .map((b) => b.period_end)
            .sort()
            .at(-1),
        ),
      );
  const languages = ["bm", "eng", "others"].map((key) => ({
      key,
      value:
        scopedRows.length &&
        scopedRows.every((r) => readingValue(r, { language: key }) != null)
          ? scopedRows.reduce(
              (s, r) =>
                s +
                ((typeof r.measures === "string"
                  ? JSON.parse(r.measures)
                  : r.measures)?.[`total ${key}`] || 0),
              0,
            )
          : null,
    })),
    categories = ["fiction", "nonfiction", "digital", "nonbook"].map((key) => ({
      key,
      value:
        scopedRows.length &&
        scopedRows.every(
          (r) => readingValue(r, { ...filters, category: key }) != null,
        )
          ? scopedRows.reduce(
              (s, r) =>
                s + (readingValue(r, { ...filters, category: key }) ?? 0),
              0,
            )
          : null,
    }));
  const monthly = scopedBatches
    .filter(
      (b) =>
        b.granularity !== "event" &&
        b.month_hint &&
        scopedRows.some((r) => r.batch_id === b.id),
    )
    .sort((a, b) => a.month_hint - b.month_hint)
    .map((b) => {
      const rr = scopedRows.filter((r) => r.batch_id === b.id);
      return {
        id: b.id,
        month: b.month_hint,
        label: MONTHS[b.month_hint - 1],
        value: rr.some((r) => readingValue(r, filters) == null)
          ? null
          : rr.reduce((s, r) => s + (readingValue(r, filters) ?? 0), 0),
        active: rr.some((r) => readingValue(r, filters) == null)
          ? null
          : new Set(
              rr
                .filter((r) => (readingValue(r, filters) || 0) > 0)
                .map((r) => r.canonical_id || r.student_id),
            ).size,
        verified: b.verification === "verified",
        cohort: [...new Set(rr.map((r) => r.canonical_id || r.student_id))]
          .sort()
          .join("|"),
        filename: b.filename,
      };
    });
  const eventMonths = new Map();
  const batchMap = new Map(scopedBatches.map((b) => [b.id, b]));
  for (const row of scopedRows) {
    const batch = batchMap.get(row.batch_id);
    if (batch?.granularity !== "event") continue;
    const raw = typeof row.raw === "string" ? JSON.parse(row.raw) : row.raw;
    for (const e of raw?.events || []) {
      const ym = String(e.reading_date || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      if (!eventMonths.has(ym))
        eventMonths.set(ym, {
          id: "events-" + ym,
          month: Number(ym.slice(5)),
          label: MONTHS[Number(ym.slice(5)) - 1] + " " + ym.slice(0, 4),
          value: 0,
          readers: new Set(),
          cohort: new Set(),
          seen: new Set(),
          verified: true,
          filenames: new Set(),
          unavailable: false,
        });
      const point = eventMonths.get(ym);
      point.verified &&= batch.verification === "verified";
      point.filenames.add(batch.filename);
      point.cohort.add(row.canonical_id || row.student_id);
      if (!["APPROVED", "DILULUSKAN"].includes(norm(e.approval_status)))
        continue;
      const lang = {
          bm: "bm",
          eng: "eng",
          others: "others",
          malay: "bm",
          english: "eng",
          "bahasa melayu": "bm",
          "bahasa inggeris": "eng",
          "lain-lain": "others",
        }[String(e.language || "").toLowerCase()],
        category = {
          fiction: "fiction",
          fiksyen: "fiction",
          nonfiction: "nonfiction",
          "non fiction": "nonfiction",
          "bukan fiksyen": "nonfiction",
          digital: "digital",
          nonbook: "nonbook",
          "bukan buku": "nonbook",
        }[String(e.category || "").toLowerCase()];
      if ((filters.language && !lang) || (filters.category && !category)) {
        point.unavailable = true;
        continue;
      }
      if (
        (filters.language && filters.language !== lang) ||
        (filters.category && filters.category !== category) ||
        point.seen.has(e.event_id)
      )
        continue;
      point.seen.add(e.event_id);
      point.value++;
      point.readers.add(row.canonical_id || row.student_id);
    }
  }
  for (const [ym, p] of [...eventMonths.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  ))
    monthly.push({
      id: p.id,
      month: p.month,
      label: p.label,
      value: p.unavailable ? null : p.value,
      active: p.unavailable ? null : p.readers.size,
      verified: p.verified,
      filename: [...p.filenames].join(", "),
      cohort: [...p.cohort].sort().join("|"),
    });
  const classGroups = [...new Set(list.map((s) => s.class_id || ""))].map(
      (id) => {
        const g = list.filter((s) => (s.class_id || "") === id),
          total = g.some((s) => s.reported == null)
            ? null
            : g.reduce((n, s) => n + s.reported, 0);
        return {
          id,
          total,
          count: g.length,
          average: g.length && total != null ? total / g.length : null,
          active: g.some((s) => s.reported == null)
            ? null
            : g.filter((s) => s.hasReading).length,
          stars: g.filter((s) => s.achievement.level > 0).length,
        };
      },
    ),
    starDistribution = Array.from({ length: 6 }, (_, level) => ({
      level,
      count: list.filter((s) => s.achievement.level === level).length,
    }));
  return {
    students: list,
    reported,
    eligible:
      multiyear ||
      !verified.rows.length ||
      verified.rows.some((r) => readingValue(r, filters) == null)
        ? null
        : approvedEligible,
    eligibleStudents: list.filter((s) => s.eligible != null).length,
    rejected:
      filters.language || filters.category
        ? null
        : scopedRows.reduce((s, r) => s + r.rejected, 0),
    active: dimensionUnavailable
      ? null
      : list.filter((s) => s.hasReading).length,
    inactive: complete ? list.filter((s) => !s.hasReading).length : null,
    average: list.length && reported != null ? reported / list.length : null,
    dimensionUnavailable,
    monthly,
    languages,
    categories,
    classGroups,
    starDistribution,
    batches: scopedBatches,
    blocked: verified.blocked,
    complete,
    multiyear,
    reviewCount: rawScopedRows.filter((r) => r.status === "review").length,
    rawReported: rawScopedRows.reduce(
      (n, r) => n + (readingValue(r, filters) ?? 0),
      0,
    ),
    unverified:
      scopedBatches.some(
        (b) => b.verification !== "verified" || !validScope(b),
      ) || verified.blocked.length > 0,
  };
}
export function canAccessStudent(u, s) {
  if (!u || !u.active || u.school_id !== s.school_id) return false;
  if (u.role === "admin") return true;
  if (u.role === "student") return u.student_id === s.id;
  return (
    u.role === "teacher" && JSON.parse(u.class_ids || "[]").includes(s.class_id)
  );
}
export function canRole(u, roles) {
  return !!u?.active && roles.includes(u.role);
}
export function coversRange(intervals, start, end) {
  const sorted = intervals
    .filter(([a, b]) => a && b && a <= end && b >= start)
    .sort(([a], [b]) => a.localeCompare(b));
  let cursor = start;
  for (const [a, b] of sorted) {
    if (a > cursor) return false;
    if (b >= end) return true;
    if (b >= cursor)
      cursor = new Date(Date.parse(b) + 86400000).toISOString().slice(0, 10);
  }
  return false;
}
export function explainInsights(m, near = 12) {
  const messages = [];
  if (!m.unverified && !m.multiyear) {
    const sorted = m.monthly
        .filter((x) => x.verified)
        .sort((a, b) => a.month - b.month),
      a = sorted.at(-2),
      b = sorted.at(-1);
    if (
      a &&
      b &&
      b.month === a.month + 1 &&
      m.complete &&
      a.cohort &&
      a.cohort === b.cohort
    ) {
      const batches = m.batches.filter((x) => [a.id, b.id].includes(x.id));
      if (
        batches.length === 2 &&
        batches.every((x) => x.granularity === "monthly")
      ) {
        if (b.value > a.value)
          messages.push(
            `Bacaan sumber meningkat ${b.value - a.value} bahan dari ${a.label} ke ${b.label}.`,
          );
        if (b.value < a.value)
          messages.push(
            `Bacaan sumber menurun ${a.value - b.value} bahan dari ${a.label} ke ${b.label}.`,
          );
        if (b.active < a.active && b.value > a.value)
          messages.push(
            "Bilangan murid aktif menurun walaupun jumlah bacaan meningkat.",
          );
      }
    }
  }
  for (const s of m.students) {
    if (s.achievement.remaining > 0 && s.achievement.remaining <= near)
      messages.push(
        `${s.name}: ${s.achievement.remaining} bahan lagi menuju bintang seterusnya.`,
      );
  }
  return messages;
}
