import { pgTable, text, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  dataUrl: text("dataUrl").notNull(),
  position: jsonb("position").notNull().$type<{ x: number; y: number }>(),
  userId: integer("user_id").notNull(), // If we want to associate files with users
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertFileSchema = createInsertSchema(files).pick({
  name: true,
  type: true,
  size: true,
  dataUrl: true,
  position: true,
  userId: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

export type DesktopFile = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  position: {
    x: number;
    y: number;
  };
};
