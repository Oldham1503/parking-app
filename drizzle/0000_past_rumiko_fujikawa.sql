CREATE TABLE `parking_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bay_number` integer NOT NULL,
	`person_name` text NOT NULL,
	`car_registration` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`time_in` text NOT NULL,
	`time_out` text,
	`status` text DEFAULT 'Occupied' NOT NULL,
	`created_by` text DEFAULT 'Unknown' NOT NULL,
	`checked_out_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
