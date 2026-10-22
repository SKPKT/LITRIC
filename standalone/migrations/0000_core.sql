CREATE TABLE `student_achievements` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`year` integer NOT NULL,
	`dataset` text NOT NULL,
	`level` integer NOT NULL,
	`total` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rule_id`) REFERENCES `star_rule_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `student_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`source_id` text NOT NULL,
	`original_name` text NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alias_source` ON `student_aliases` (`school_id`,`source_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_school_time` ON `audit_logs` (`school_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`dataset` text NOT NULL,
	`filename` text NOT NULL,
	`fingerprint` text NOT NULL,
	`file_hash` text,
	`source_type` text NOT NULL,
	`granularity` text DEFAULT 'unknown' NOT NULL,
	`year` integer,
	`period_start` text,
	`period_end` text,
	`snapshot_date` text,
	`month_hint` integer,
	`verification` text DEFAULT 'unverified' NOT NULL,
	`coverage_complete` integer DEFAULT 0 NOT NULL,
	`star_eligible` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`stats` text NOT NULL,
	`source_key` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`verified_by` text,
	`verification_note` text,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `batch_fingerprint` ON `import_batches` (`school_id`,`fingerprint`);--> statement-breakpoint
CREATE INDEX `batch_scope` ON `import_batches` (`school_id`,`dataset`,`year`,`status`);--> statement-breakpoint
CREATE TABLE `smartlib_book_links` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`external_id` text,
	`title` text NOT NULL,
	`author` text,
	`isbn` text,
	`category` text,
	`language` text,
	`cover` text,
	`availability` text,
	`suitable` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`category` text NOT NULL,
	`total` integer NOT NULL,
	`level` integer,
	`date` text NOT NULL,
	`dataset` text NOT NULL,
	`scope` text NOT NULL,
	`rule_id` text,
	`verification_token` text NOT NULL,
	`issued_by` text NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `certificates_verification_token_unique` ON `certificates` (`verification_token`);--> statement-breakpoint
CREATE TABLE `student_class_history` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`class_id` text NOT NULL,
	`year` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`name` text NOT NULL,
	`year` integer NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `evidence_files` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`programme_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`programme_id`) REFERENCES `reading_programmes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `import_errors` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`row_number` integer NOT NULL,
	`severity` text NOT NULL,
	`message` text NOT NULL,
	`raw` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`student_id` text,
	`class_ids` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_school_email` ON `invitations` (`school_id`,`email`);--> statement-breakpoint
CREATE TABLE `identity_merges` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`from_id` text NOT NULL,
	`into_id` text NOT NULL,
	`reason` text NOT NULL,
	`undone` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teacher_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`note` text NOT NULL,
	`teacher_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `programme_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`programme_id` text NOT NULL,
	`student_id` text NOT NULL,
	FOREIGN KEY (`programme_id`) REFERENCES `reading_programmes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reading_programmes` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`organizer` text NOT NULL,
	`target_participants` integer NOT NULL,
	`actual_participants` integer NOT NULL,
	`activities` text NOT NULL,
	`outcomes` text NOT NULL,
	`notes` text,
	`teacher_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `school_reading_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`book_id` text,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`completion` text NOT NULL,
	`language` text NOT NULL,
	`category` text NOT NULL,
	`reflection` text,
	`teacher_id` text NOT NULL,
	`confirmed` integer NOT NULL,
	`reconciled_summary_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reading_student_date` ON `school_reading_entries` (`school_id`,`student_id`,`date`);--> statement-breakpoint
CREATE TABLE `star_rule_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`thresholds` text NOT NULL,
	`marks` text NOT NULL,
	`certified` integer DEFAULT 0 NOT NULL,
	`reference` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schools_code_unique` ON `schools` (`code`);--> statement-breakpoint
CREATE TABLE `settings` (
	`school_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ains_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`student_id` text NOT NULL,
	`snapshot_date` text NOT NULL,
	`approved` integer NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`name` text NOT NULL,
	`class_id` text,
	`academic_year` integer,
	`status` text DEFAULT 'unconfirmed' NOT NULL,
	`member_id` text,
	`merged_into` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `student_school_name` ON `students` (`school_id`,`name`);--> statement-breakpoint
CREATE TABLE `ains_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`student_id` text NOT NULL,
	`source_id` text,
	`original_school` text NOT NULL,
	`original_name` text NOT NULL,
	`row_number` integer NOT NULL,
	`row_hash` text NOT NULL,
	`approved` integer NOT NULL,
	`rejected` integer NOT NULL,
	`measures` text NOT NULL,
	`raw` text NOT NULL,
	`status` text NOT NULL,
	`issue` text,
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `summary_batch_student` ON `ains_summaries` (`batch_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `summary_school` ON `ains_summaries` (`school_id`);--> statement-breakpoint
CREATE TABLE `reading_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text,
	`class_id` text,
	`title` text NOT NULL,
	`target` integer NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`source` text NOT NULL,
	`teacher_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`student_id` text,
	`class_ids` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `users_school` ON `users` (`school_id`);
