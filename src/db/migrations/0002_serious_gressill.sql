CREATE TABLE `shopping_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`list_id` text NOT NULL,
	`name` text NOT NULL,
	`quantity_milli` integer DEFAULT 1000 NOT NULL,
	`unit` text DEFAULT 'piece' NOT NULL,
	`unit_price_cents` integer,
	`checked` integer DEFAULT false NOT NULL,
	`checked_at` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`list_id`) REFERENCES `shopping_lists`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shopping_items_quantity_positive" CHECK("shopping_items"."quantity_milli" > 0),
	CONSTRAINT "shopping_items_price_positive" CHECK("shopping_items"."unit_price_cents" IS NULL OR "shopping_items"."unit_price_cents" > 0)
);
--> statement-breakpoint
CREATE INDEX `shopping_items_list_idx` ON `shopping_items` (`list_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `shopping_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
