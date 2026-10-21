import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { schools, batches, students } from "./schema";
export const activityRecords = sqliteTable(
  "ains_activity_records",
  {
    id: text("id").primaryKey(),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id),
    batchId: text("batch_id")
      .notNull()
      .references(() => batches.id),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id),
    eventId: text("event_id").notNull(),
    date: text("date").notNull(),
    title: text("title").notNull(),
    approvalStatus: text("approval_status").notNull(),
    contentHash: text("content_hash").notNull(),
    raw: text("raw").notNull(),
    rowNumber: integer("row_number").notNull(),
  },
  (t) => [
    index("activity_school_event").on(t.schoolId, t.eventId),
    index("activity_student_date").on(t.schoolId, t.studentId, t.date),
  ],
);
export const eventRegistry = sqliteTable("ains_event_registry", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull(),
  eventId: text("event_id").notNull(),
  batchId: text("batch_id")
    .notNull()
    .references(() => batches.id),
  contentHash: text("content_hash").notNull(),
});
