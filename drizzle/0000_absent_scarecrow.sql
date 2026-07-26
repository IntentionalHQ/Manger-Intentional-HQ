CREATE TABLE `connections` (
	`id` text NOT NULL,
	`owner_email` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`detail` text NOT NULL,
	`mark` text NOT NULL,
	`status` text DEFAULT 'not_connected' NOT NULL,
	`last_synced_at` text,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_email`, `id`)
);
