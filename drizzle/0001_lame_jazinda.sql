CREATE TABLE `visitor_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visitor_name` text NOT NULL,
	`company_name` text NOT NULL,
	`visiting` text NOT NULL,
	`car_registration` text DEFAULT '' NOT NULL,
	`door_pass_number` text DEFAULT '' NOT NULL,
	`bay_number` integer,
	`notes` text DEFAULT '' NOT NULL,
	`time_in` text NOT NULL,
	`time_out` text,
	`status` text DEFAULT 'Signed In' NOT NULL,
	`created_by` text DEFAULT 'Unknown' NOT NULL,
	`signed_out_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
