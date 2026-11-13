
ALTER TABLE students ADD COLUMN school_year_level TEXT;
CREATE TABLE nilam_annual_reports (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id),
  batch_id TEXT NOT NULL REFERENCES import_batches(id),
  student_id TEXT NOT NULL REFERENCES students(id),
  report_year INTEGER NOT NULL CHECK(report_year BETWEEN 2000 AND 2100),
  reported INTEGER NOT NULL CHECK(reported >= 0),
  school_year_level TEXT,
  class_name TEXT,
  row_number INTEGER NOT NULL,
  UNIQUE(batch_id, student_id)
);
CREATE INDEX nilam_report_scope ON nilam_annual_reports(school_id,report_year,student_id);
CREATE INDEX nilam_report_batch ON nilam_annual_reports(batch_id);
