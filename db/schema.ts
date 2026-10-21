import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const schools = sqliteTable("schools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  createdAt: text("created_at").notNull(),
});
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    studentId: text("student_id"),
    classIds: text("class_ids").notNull().default("[]"),
    active: integer("active").notNull().default(1),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("users_school").on(t.schoolId)],
);
export const invitations = sqliteTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id),
    email: text("email").notNull(),
    role: text("role").notNull(),
    studentId: text("student_id"),
    classIds: text("class_ids").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("invitation_school_email").on(t.schoolId, t.email)],
);
export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  schoolId: text("school_id")
    .notNull()
    .references(() => schools.id),
  name: text("name").notNull(),
  year: integer("year").notNull(),
});
export const students = sqliteTable(
  "students",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id),
    name: text("name").notNull(),
    classId: text("class_id").references(() => classes.id),
    academicYear: integer("academic_year"),
    status: text("status").notNull().default("unconfirmed"),
    memberId: text("member_id"),
    mergedInto: text("merged_into"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("student_school_name").on(t.schoolId, t.name)],
);
export const aliases = sqliteTable(
  "student_aliases",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id").notNull(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id),
    sourceId: text("source_id").notNull(),
    originalName: text("original_name").notNull(),
    verified: integer("verified").notNull().default(0),
  },
  (t) => [uniqueIndex("alias_source").on(t.schoolId, t.sourceId)],
);
export const classHistory = sqliteTable("student_class_history", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull(),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id),
  classId: text("class_id")
    .notNull()
    .references(() => classes.id),
  year: integer("year").notNull(),
  createdAt: text("created_at").notNull(),
});
export const batches = sqliteTable(
  "import_batches",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id),
    dataset: text("dataset").notNull(),
    filename: text("filename").notNull(),
    fingerprint: text("fingerprint").notNull(),
    fileHash: text("file_hash"),
    sourceType: text("source_type").notNull(),
    granularity: text("granularity").notNull().default("unknown"),
    year: integer("year"),
    periodStart: text("period_start"),
    periodEnd: text("period_end"),
    snapshotDate: text("snapshot_date"),
    monthHint: integer("month_hint"),
    verification: text("verification").notNull().default("unverified"),
    coverageComplete: integer("coverage_complete").notNull().default(0),
    starEligible: integer("star_eligible").notNull().default(0),
    status: text("status").notNull().default("active"),
    stats: text("stats").notNull(),
    sourceKey: text("source_key"),
    version: integer("version").notNull().default(1),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    verifiedBy: text("verified_by"),
    verificationNote: text("verification_note"),
  },
  (t) => [
    uniqueIndex("batch_fingerprint").on(t.schoolId, t.fingerprint),
    index("batch_scope").on(t.schoolId, t.dataset, t.year, t.status),
  ],
);
export const summaries = sqliteTable(
  "ains_summaries",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id").notNull(),
    batchId: text("batch_id")
      .notNull()
      .references(() => batches.id),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id),
    sourceId: text("source_id"),
    originalSchool: text("original_school").notNull(),
    originalName: text("original_name").notNull(),
    rowNumber: integer("row_number").notNull(),
    rowHash: text("row_hash").notNull(),
    approved: integer("approved").notNull(),
    rejected: integer("rejected").notNull(),
    measures: text("measures").notNull(),
    raw: text("raw").notNull(),
    status: text("status").notNull(),
    issue: text("issue"),
  },
  (t) => [
    index("summary_batch_student").on(t.batchId, t.studentId),
    index("summary_school").on(t.schoolId),
  ],
);
export const snapshots = sqliteTable("ains_snapshots", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull(),
  batchId: text("batch_id")
    .notNull()
    .references(() => batches.id),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id),
  snapshotDate: text("snapshot_date").notNull(),
  approved: integer("approved").notNull(),
});
export const importErrors = sqliteTable("import_errors", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull(),
  batchId: text("batch_id")
    .notNull()
    .references(() => batches.id),
  rowNumber: integer("row_number").notNull(),
  severity: text("severity").notNull(),
  message: text("message").notNull(),
  raw: text("raw").notNull(),
});
export const readings = sqliteTable(
  "school_reading_entries",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id").notNull(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id),
    bookId: text("book_id"),
    title: text("title").notNull(),
    date: text("date").notNull(),
    type: text("type").notNull(),
    completion: text("completion").notNull(),
    language: text("language").notNull(),
    category: text("category").notNull(),
    reflection: text("reflection"),
    teacherId: text("teacher_id").notNull(),
    confirmed: integer("confirmed").notNull(),
    reconciledSummaryId: text("reconciled_summary_id"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("reading_student_date").on(t.schoolId, t.studentId, t.date)],
);
export const targets = sqliteTable("reading_targets", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull(),
  studentId: text("student_id"),
  classId: text("class_id"),
  title: text("title").notNull(),
  target: integer("target").notNull(),
  start: text("start").notNull(),
  end: text("end").notNull(),
  source: text("source").notNull(),
  teacherId: text("teacher_id").notNull(),
  createdAt: text("created_at").notNull(),
});
export const rules = sqliteTable("star_rule_versions", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull(),
  thresholds: text("thresholds").notNull(),
  marks: text("marks").notNull(),
  certified: integer("certified").notNull().default(0),
  reference: text("reference"),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
});
export const achievements = sqliteTable("student_achievements", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull(),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id),
  ruleId: text("rule_id")
    .notNull()
    .references(() => rules.id),
  year: integer("year").notNull(),
  dataset: text("dataset").notNull(),
  level: integer("level").notNull(),
  total: integer("total").notNull(),
  createdAt: text("created_at").notNull(),
});
export const books = sqliteTable("smartlib_book_links", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull(),
  externalId: text("external_id"),
  title: text("title").notNull(),
  author: text("author"),
  isbn: text("isbn"),
  category: text("category"),
  language: text("language"),
  cover: text("cover"),
  availability: text("availability"),
  suitable: integer("suitable").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});
export const programmes = sqliteTable("reading_programmes", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull(),
  name: text("name").notNull(),
  date: text("date").notNull(),
  organizer: text("organizer").notNull(),
  targetParticipants: integer("target_participants").notNull(),
  actualParticipants: integer("actual_participants").notNull(),
  activities: text("activities").notNull(),
  outcomes: text("outcomes").notNull(),
  notes: text("notes"),
  teacherId: text("teacher_id").notNull(),
  createdAt: text("created_at").notNull(),
});
export const participants = sqliteTable("programme_participants", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull(),
  programmeId: text("programme_id")
    .notNull()
    .references(() => programmes.id),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id),
});
export const files = sqliteTable("evidence_files", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull(),
  programmeId: text("programme_id")
    .notNull()
    .references(() => programmes.id),
  key: text("key").notNull(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  createdAt: text("created_at").notNull(),
});
export const certificates = sqliteTable("certificates", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull(),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id),
  category: text("category").notNull(),
  total: integer("total").notNull(),
  level: integer("level"),
  date: text("date").notNull(),
  dataset: text("dataset").notNull(),
  scope: text("scope").notNull(),
  ruleId: text("rule_id"),
  verificationToken: text("verification_token").notNull().unique(),
  issuedBy: text("issued_by").notNull(),
  revoked: integer("revoked").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
export const observations = sqliteTable("teacher_observations", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull(),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id),
  note: text("note").notNull(),
  teacherId: text("teacher_id").notNull(),
  createdAt: text("created_at").notNull(),
});
export const merges = sqliteTable("identity_merges", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull(),
  fromId: text("from_id").notNull(),
  intoId: text("into_id").notNull(),
  reason: text("reason").notNull(),
  undone: integer("undone").notNull().default(0),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
});
export const settings = sqliteTable("settings", {
  schoolId: text("school_id")
    .primaryKey()
    .references(() => schools.id),
  data: text("data").notNull(),
});
export const audits = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id").notNull(),
    userId: text("user_id").notNull(),
    action: text("action").notNull(),
    entityId: text("entity_id"),
    detail: text("detail").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("audit_school_time").on(t.schoolId, t.createdAt)],
);
