import { env } from "cloudflare:workers";
import {
  auth,
  loadData,
  metrics,
  mutation,
  filtersFrom,
  requireRole,
  studentAccess,
  first,
  all,
  run,
  audit,
  fail,
  uid,
  now,
  db,
  statement,
} from "../../../lib/server";
import { certificatePDF, reportPDF, reportXLSX } from "../../../lib/exports";
import {readLimitedBody} from "../../../lib/request-body.mjs";
import { nilamWorkbook } from '../../../lib/nilam-workbook';
export const dynamic = "force-dynamic";
const json = (data: any, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const attachment = (bytes: any, name: string, type: string) =>
  new Response(bytes, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function handle(request: Request) {
  try {
    const url = new URL(request.url),
      path = url.pathname.replace(/^\/api\//, "");
    const origin = request.headers.get("origin");
    if (origin && origin !== ((env as any).LITRIC_AUTH_MODE === "standalone" ? ((env as any).FRONTEND_ORIGIN || url.origin) : url.origin))
      fail("Asal permintaan tidak dibenarkan.", 403);
    const u = await auth(request);
    if (request.method !== "GET") {
      if (path === "file") {
        requireRole(u, ["admin", "teacher"]);
        const form = await new Response(await readLimitedBody(request), {headers: {"content-type": request.headers.get("content-type") || ""}}).formData(),
          file = form.get("file") as File,
          programmeId = String(form.get("programme_id") || "");
        const p = await first(
          "SELECT * FROM reading_programmes WHERE id=? AND school_id=?",
          programmeId,
          u.school_id,
        );
        if (!p || (u.role === "teacher" && p.teacher_id !== u.id))
          fail("Program tidak dibenarkan.", 403);
        if (
          !file ||
          file.size > 8 * 1024 * 1024 ||
          ![
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf",
          ].includes(file.type)
        )
          fail("Bukti: JPG, PNG, WebP atau PDF sehingga 8 MB.");
        if (!env.BUCKET) fail("Storan bukti belum tersedia.", 503);
        const id = uid(),
          key = `${u.school_id}/evidence/${id}`;
        await env.BUCKET.put(key, file.stream(), {
          httpMetadata: { contentType: file.type },
        });
        await run(
          "INSERT INTO evidence_files (id,school_id,programme_id,key,name,mime,created_at) VALUES (?,?,?,?,?,?,?)",
          id,
          u.school_id,
          programmeId,
          key,
          file.name,
          file.type,
          now(),
        );
        await audit(u, "Muat naik bukti program", id);
        return json({ id });
      }
      if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) fail("Jenis kandungan JSON diperlukan.", 415);
      const bytes = await readLimitedBody(request);
      let p: any;
      try { p = JSON.parse(new TextDecoder().decode(bytes)); }
      catch { fail("Kandungan JSON tidak sah."); }
      if (!p || typeof p !== "object" || Array.isArray(p)) fail("Objek JSON diperlukan.");
      return json(await mutation(u, path, p));
    }
    if (path === "state") {
      if (u.role === "public") {
        const data = await loadData({ ...u, role: "admin" }),
          m = metrics(data, filtersFrom(url));
        return json({
          user: { name: u.name, role: u.role },
          aggregate: {
            students: m.students.length,
            reported: m.reported,
            active: m.active,
            unverified: m.unverified,
          },
          school: data.settings.schoolName,
        });
      }
      const data = await loadData(u);
      return json({
        user: u,
        ...data,
        metrics: metrics(data, filtersFrom(url)),
      });
    }
    if (u.role === "public") fail("Akses data murid tidak dibenarkan.", 403);
    if (path === "certificate/pdf") {
      const c = await first(
        "SELECT * FROM certificates WHERE id=? AND school_id=?",
        url.searchParams.get("id"),
        u.school_id,
      );
      if (!c) fail("Sijil tidak ditemui.", 404);
      const s = await studentAccess(u, c.student_id);
      const settings = JSON.parse(
        (
          await first(
            "SELECT data FROM settings WHERE school_id=?",
            u.school_id,
          )
        )?.data || "{}",
      );
      return attachment(
        await certificatePDF(
          c,
          s,
          settings.schoolName || "SK Pendidikan Khas Taiping",
          url.origin,
        ),
        `LITRIC-sijil-${c.id}.pdf`,
        "application/pdf",
      );
    }
    if (path === "certificate/verify") {
      const c = await first(
        "SELECT c.*,s.name FROM certificates c JOIN students s ON s.id=c.student_id WHERE c.verification_token=? AND c.school_id=?",
        url.searchParams.get("token"),
        u.school_id,
      );
      if (!c) fail("Sijil tidak ditemui.", 404);
      await studentAccess(u, c.student_id);
      return json({
        id: c.id,
        name: c.name,
        category: c.category,
        total: c.total,
        level: c.level,
        date: c.date,
        revoked: !!c.revoked,
        recognition:
          "Pengiktirafan sekolah; bukan pensijilan rasmi AINS/PAJSK.",
      });
    }
    if (path === "report") {
      requireRole(u, ["admin", "teacher"]);
      if(url.searchParams.get('format')==='xlsx'){
        const data=await loadData(u);
        const filters=Object.fromEntries(['academicYear','classId','status','star','search'].map(k=>[k,url.searchParams.get(k)||'']));
        let report;
        try{report=await nilamWorkbook(data,filters);}catch(error:any){fail(error.message,400);}
        await audit(u,'Muat turun laporan Excel',null,{filters,students:report.count});
        return attachment(report.bytes,`LITRIC_LAPORAN_NILAM_${report.date}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      }
      const data = await loadData(u),
        filters = filtersFrom(url),
        pid = url.searchParams.get("programme");
      const programme = pid
        ? data.reading_programmes.find((p: any) => p.id === pid)
        : undefined;
      if (pid && !programme) fail("Program tidak dibenarkan.", 403);
      if (programme) {
        const participantIds = new Set(
          data.programme_participants
            .filter((p: any) => p.programme_id === pid)
            .map((p: any) => p.canonical_id || p.student_id),
        );
        data.students = data.students.filter((s: any) =>
          participantIds.has(s.id),
        );
        data.programmeScope = participantIds.size
          ? "Pencapaian peserta dalam sumber terpilih. Hasil tidak diatribusikan secara automatik kepada program."
          : "Senarai peserta belum dipautkan. Bacaan individu tidak disertakan.";
        data.evidence = [];
        const fs = data.evidence_files.filter(
          (f: any) => f.programme_id === pid,
        );
        let inlineBudget = 12 * 1024 * 1024;
        for (const [i, f] of fs.entries()) {
          const obj = i < 8 && env.BUCKET ? await env.BUCKET.get(f.key) : null;
          const bytes =
            obj && obj.size <= 8 * 1024 * 1024 && obj.size <= inlineBudget
              ? new Uint8Array(await obj.arrayBuffer())
              : null;
          if (bytes) inlineBudget -= bytes.byteLength;
          data.evidence.push({
            ...f,
            bytes,
          });
        }
      }
      const m = metrics(data, filters);
      await audit(u, "Eksport laporan", pid, {
        filters,
        format: url.searchParams.get("format"),
      });
      if (url.searchParams.get("format") === "xlsx")
        return attachment(
          await reportXLSX(data, m, filters, programme),
          "LITRIC-laporan.xlsx",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
      return attachment(
        await reportPDF(data, m, filters, programme),
        "LITRIC-laporan.pdf",
        "application/pdf",
      );
    }
    if (path === "errors") {
      requireRole(u, ["admin"]);
      const rows = await all(
        "SELECT row_number,severity,message FROM import_errors WHERE batch_id=? AND school_id=?",
        url.searchParams.get("batch"),
        u.school_id,
      );
      const csv = [
        "Baris,Status,Isu",
        ...rows.map((r) =>
          [r.row_number, r.severity, r.message]
            .map((x) => '"' + String(x).replace(/"/g, '""') + '"')
            .join(","),
        ),
      ].join("\r\n");
      return attachment(
        "\ufeff" + csv,
        "LITRIC-ralat-import.csv",
        "text/csv; charset=utf-8",
      );
    }
    if (path === "source") {
      requireRole(u, ["admin"]);
      const b = await first(
        "SELECT * FROM import_batches WHERE id=? AND school_id=?",
        url.searchParams.get("batch"),
        u.school_id,
      );
      if (!b) fail("Sumber tidak ditemui.", 404);
      const source =
        b.source_key && env.BUCKET ? await env.BUCKET.get(b.source_key) : null;
      const data = source
        ? await source.text()
        : JSON.stringify(
            await all(
              "SELECT row_number,raw FROM ains_summaries WHERE batch_id=? AND school_id=?",
              b.id,
              u.school_id,
            ),
          );
      return attachment(data, `LITRIC-sumber-${b.id}.json`, "application/json");
    }
    if (path === "file") {
      requireRole(u, ["admin", "teacher"]);
      const f = await first(
        "SELECT f.*,p.teacher_id FROM evidence_files f JOIN reading_programmes p ON p.id=f.programme_id WHERE f.id=? AND f.school_id=?",
        url.searchParams.get("id"),
        u.school_id,
      );
      if (!f || (u.role === "teacher" && f.teacher_id !== u.id))
        fail("Fail tidak dibenarkan.", 403);
      const obj = await env.BUCKET?.get(f.key);
      if (!obj) fail("Fail tidak ditemui.", 404);
      return attachment(
        await obj!.arrayBuffer(),
        "bukti." +
          ((
            {
              "image/jpeg": "jpg",
              "image/png": "png",
              "image/webp": "webp",
              "application/pdf": "pdf",
            } as Record<string, string>
          )[f.mime] || "bin"),
        f.mime,
      );
    }
    if (path === "backup") {
      requireRole(u, ["admin"]);
      const tables = [
        "schools",
        "users",
        "invitations",
        "students",
        "student_aliases",
        "classes",
        "student_class_history",
        "import_batches",
        "ains_summaries",
        "ains_snapshots",
        "ains_activity_records",
        "ains_event_registry",
        "import_errors",
        "school_reading_entries",
        "reading_targets",
        "star_rule_versions",
        "student_achievements",
        "smartlib_book_links",
        "reading_programmes",
        "programme_participants",
        "certificates",
        "teacher_observations",
        "identity_merges",
        "settings",
        "evidence_files",
        "audit_logs",
      ];
      const data: any = {
        version: 1,
        createdAt: now(),
        school: u.school_id,
        tables: {},
      };
      for (const t of tables)
        data.tables[t] = await all(
          `SELECT * FROM ${t} WHERE ${t === "schools" ? "id" : "school_id"}=?`,
          u.school_id,
        );
      if (env.BUCKET)
        await env.BUCKET.put(
          `${u.school_id}/backups/${now()}.json`,
          JSON.stringify(data),
        );
      await audit(u, "Sandaran pangkalan data", u.school_id);
      return attachment(
        JSON.stringify(data, null, 2),
        "LITRIC-sandaran.json",
        "application/json",
      );
    }
    if (path === "smartlib") {
      requireRole(u, ["admin", "teacher"]);
      const settings = JSON.parse(
        (
          await first(
            "SELECT data FROM settings WHERE school_id=?",
            u.school_id,
          )
        )?.data || "{}",
      );
      if (!settings.smartlibUrl)
        fail(
          "SMARTLIB belum disambungkan. Tetapkan URL adapter HTTPS dalam Tetapan Sistem.",
          409,
        );
      const target = new URL(settings.smartlibUrl);
      target.searchParams.set(
        "q",
        (url.searchParams.get("q") || "").slice(0, 150),
      );
      target.searchParams.set("school", u.school_id);
      const res = await fetch(target, {
        headers: {
          Accept: "application/json",
          ...((env as any).SMARTLIB_API_KEY
            ? { Authorization: `Bearer ${(env as any).SMARTLIB_API_KEY}` }
            : {}),
        },
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) fail(`SMARTLIB memberikan status ${res.status}.`, 502);
      if (Number(res.headers.get("content-length") || 0) > 1024 * 1024)
        fail("Respons SMARTLIB terlalu besar.", 502);
      const body = await res.text();
      if (body.length > 1024 * 1024)
        fail("Respons SMARTLIB terlalu besar.", 502);
      const raw = JSON.parse(body),
        items = Array.isArray(raw) ? raw : raw.books;
      if (!Array.isArray(items))
        fail("Adapter mesti memulangkan senarai books.", 502);
      const books = items
        .slice(0, 50)
        .filter((b: any) => typeof b.title === "string")
        .map((b: any) => ({
          id: String(b.id || b.isbn || uid()).slice(0, 150),
          title: String(b.title).slice(0, 300),
          author: String(b.author || "").slice(0, 300),
          isbn: String(b.isbn || "").slice(0, 100),
          category: String(b.category || "").slice(0, 100),
          language: String(b.language || "").slice(0, 20),
          availability: String(b.availability || "").slice(0, 100),
          cover:
            typeof b.cover === "string" && b.cover.startsWith("https://")
              ? b.cover
              : null,
        }));
      await audit(u, "Carian katalog SMARTLIB", null, {
        results: books.length,
      });
      return json({ books, connected: true, ainsApproved: false });
    }
    fail("Laluan tidak ditemui.", 404);
  } catch (e: any) {
    console.error("LITRIC API", e.status || 500, e.message);
    return json(
      {
        error: e.status
          ? e.message
          : "Operasi tidak berjaya. Sila cuba semula atau semak log pelayan.",
      },
      e.status || 500,
    );
  }
}
export const GET = handle;
export const POST = handle;
