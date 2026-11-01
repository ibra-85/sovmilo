CREATE TABLE `savings_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`target_cents` integer NOT NULL,
	`icon` text DEFAULT '🎯' NOT NULL,
	`target_date` text,
	`note` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT "savings_goals_target_positive" CHECK("savings_goals"."target_cents" > 0)
);
--> statement-breakpoint
CREATE INDEX `savings_goals_order_idx` ON `savings_goals` (`archived_at`,`sort_order`);--> statement-breakpoint
CREATE TABLE `savings_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`goal_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`occurred_on` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`goal_id`) REFERENCES `savings_goals`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "savings_movements_amount_positive" CHECK("savings_movements"."amount_cents" > 0),
	CONSTRAINT "savings_movements_kind_known" CHECK("savings_movements"."kind" IN ('deposit', 'withdrawal'))
);
--> statement-breakpoint
CREATE INDEX `savings_movements_goal_idx` ON `savings_movements` (`goal_id`,`occurred_on`);