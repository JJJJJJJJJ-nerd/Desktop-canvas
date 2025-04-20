import { 
  users, 
  desktopFiles,
  type User, 
  type InsertUser, 
  type DesktopFile,
  type DesktopFileDB, 
  type InsertDesktopFile 
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Desktop file operations
  getFiles(userId?: number): Promise<DesktopFileDB[]>;
  getFile(id: number): Promise<DesktopFileDB | undefined>;
  createFile(file: InsertDesktopFile): Promise<DesktopFileDB>;
  updateFile(id: number, position: { x: number, y: number }): Promise<DesktopFileDB | undefined>;
  updateFileDimensions(id: number, dimensions: { width: number, height: number }): Promise<DesktopFileDB | undefined>;
  deleteFile(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Desktop file operations
  async getFiles(userId?: number): Promise<DesktopFileDB[]> {
    if (userId) {
      return db.select().from(desktopFiles).where(eq(desktopFiles.userId, userId));
    }
    return db.select().from(desktopFiles);
  }

  async getFile(id: number): Promise<DesktopFileDB | undefined> {
    const [file] = await db.select().from(desktopFiles).where(eq(desktopFiles.id, id));
    return file || undefined;
  }

  async createFile(file: InsertDesktopFile): Promise<DesktopFileDB> {
    const [newFile] = await db
      .insert(desktopFiles)
      .values(file)
      .returning();
    return newFile;
  }

  async updateFile(id: number, position: { x: number, y: number }): Promise<DesktopFileDB | undefined> {
    const [updatedFile] = await db
      .update(desktopFiles)
      .set({ position })
      .where(eq(desktopFiles.id, id))
      .returning();
    return updatedFile || undefined;
  }
  
  async updateFileDimensions(id: number, dimensions: { width: number, height: number }): Promise<DesktopFileDB | undefined> {
    const [updatedFile] = await db
      .update(desktopFiles)
      .set({ dimensions })
      .where(eq(desktopFiles.id, id))
      .returning();
    return updatedFile || undefined;
  }

  async deleteFile(id: number): Promise<void> {
    await db.delete(desktopFiles).where(eq(desktopFiles.id, id));
  }
}

export const storage = new DatabaseStorage();
