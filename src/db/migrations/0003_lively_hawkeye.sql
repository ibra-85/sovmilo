CREATE TABLE `bill_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bill_id` text NOT NULL,
	`due_on` text NOT NULL,
	`amount_cents` integer,
	`paid_on` text,
	`paid_amount_cents` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bill_occurrences_amount_positive" CHECK("bill_occurrences"."amount_cents" IS NULL OR "bill_occurrences"."amount_cents" > 0),
	CONSTRAINT "bill_occurrences_paid_amount_positive" CHECK("bill_occurrences"."paid_amount_cents" IS NULL OR "bill_occurrences"."paid_amount_cents" > 0),
	CONSTRAINT "bill_occurrences_paid_amount_needs_payment" CHECK("bill_occurrences"."paid_amount_cents" IS NULL OR "bill_occurrences"."paid_on" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bill_occurrences_bill_due_idx` ON `bill_occurrences` (`bill_id`,`due_on`);--> statement-breakpoint
CREATE INDEX `bill_occurrences_due_idx` ON `bill_occurrences` (`due_on`);--> statement-breakpoint
CREATE TABLE `bills` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`expected_amount_cents` integer,
	`recurrence` text DEFAULT 'none' NOT NULL,
	`anchor_date` text NOT NULL,
	`stopped_on` text,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT "bills_expected_amount_positive" CHECK("bills"."expected_amount_cents" IS NULL OR "bills"."expected_amount_cents" > 0),
	CONSTRAINT "bills_recurrence_known" CHECK("bills"."recurrence" IN ('none', 'monthly', 'yearly'))
);
