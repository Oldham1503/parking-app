import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const parkingSessions = sqliteTable("parking_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bayNumber: integer("bay_number").notNull(),
  personName: text("person_name").notNull(),
  carRegistration: text("car_registration").notNull(),
  notes: text("notes").notNull().default(""),
  timeIn: text("time_in").notNull(),
  timeOut: text("time_out"),
  status: text("status", { enum: ["Occupied", "Completed"] })
    .notNull()
    .default("Occupied"),
  createdBy: text("created_by").notNull().default("Unknown"),
  checkedOutBy: text("checked_out_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const visitorSessions = sqliteTable("visitor_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitorName: text("visitor_name").notNull(),
  companyName: text("company_name").notNull(),
  visiting: text("visiting").notNull(),
  carRegistration: text("car_registration").notNull().default(""),
  doorPassNumber: text("door_pass_number").notNull().default(""),
  bayNumber: integer("bay_number"),
  notes: text("notes").notNull().default(""),
  timeIn: text("time_in").notNull(),
  timeOut: text("time_out"),
  status: text("status", { enum: ["Signed In", "Signed Out"] })
    .notNull()
    .default("Signed In"),
  createdBy: text("created_by").notNull().default("Unknown"),
  signedOutBy: text("signed_out_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
