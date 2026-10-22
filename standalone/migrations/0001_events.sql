CREATE TABLE `ains_activity_records` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`student_id` text NOT NULL,
	`event_id` text NOT NULL,
	`date` text NOT NULL,
	`title` text NOT NULL,
	`approval_status` text NOT NULL,
	`content_hash` text NOT NULL,
	`raw` text NOT NULL,
	`row_number` integer NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_school_event` ON `ains_activity_records` (`school_id`,`event_id`);--> statement-breakpoint
CREATE INDEX `activity_student_date` ON `ains_activity_records` (`school_id`,`student_id`,`date`);--> statement-breakpoint
CREATE TABLE `ains_event_registry` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`event_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`content_hash` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action
);
