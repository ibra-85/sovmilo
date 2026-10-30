CREATE TABLE `account_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`real_balance_cents` integer NOT NULL,
	`recorded_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `account_snapshots_recorded_at_idx` ON `account_snapshots` (`recorded_at`);--> statement-breakpoint
DROP INDEX `budgets_month_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_user_category_month_idx` ON `budgets` (`user_id`,`category_id`,`month`);