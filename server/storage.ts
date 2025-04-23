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
  
  // Folder operations
  createFolder(name: string, position: { x: number, y: number }, userId?: number): Promise<DesktopFileDB>;
  addFileToFolder(fileId: number, folderId: number): Promise<DesktopFileDB | undefined>;
  getFilesInFolder(folderId: number): Promise<DesktopFileDB[]>;
  removeFileFromFolder(fileId: number, position?: { x: number, y: number }): Promise<DesktopFileDB | undefined>;
  updateFileName(id: number, name: string): Promise<DesktopFileDB | undefined>;
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
    try {
      if (userId) {
        return db.select().from(desktopFiles).where(eq(desktopFiles.userId, userId));
      }
      return db.select().from(desktopFiles);
    } catch (error) {
      console.error("Error in getFiles:", error);
      return [];
    }
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
  
  // Folder operations
  async createFolder(name: string, position: { x: number, y: number }, userId?: number): Promise<DesktopFileDB> {
    const folderData = {
      name,
      type: 'application/folder',
      size: 0,
      dataUrl: 'data:,', // Empty data URL for folders
      position,
      isFolder: 'true',
      userId,
    };
    
    const [newFolder] = await db
      .insert(desktopFiles)
      .values(folderData)
      .returning();
    return newFolder;
  }
  
  async addFileToFolder(fileId: number, folderId: number): Promise<DesktopFileDB | undefined> {
    // First check if the target is actually a folder
    const folder = await this.getFile(folderId);
    if (!folder || folder.isFolder !== 'true') {
      throw new Error('Target is not a folder');
    }
    
    const [updatedFile] = await db
      .update(desktopFiles)
      .set({ parentId: folderId })
      .where(eq(desktopFiles.id, fileId))
      .returning();
    return updatedFile || undefined;
  }
  
  async getFilesInFolder(folderId: number): Promise<DesktopFileDB[]> {
    try {
      if (isNaN(folderId) || folderId <= 0) {
        console.error(`⚠️ Ongeldige folder ID ontvangen: ${folderId}`);
        return [];
      }
      
      console.log(`🔍 DATABASE: Ophalen bestanden voor map ${folderId}`);
      
      const files = await db
        .select()
        .from(desktopFiles)
        .where(eq(desktopFiles.parentId, folderId));
      
      console.log(`📊 DATABASE: ${files.length} bestanden gevonden in map ${folderId}`);
      
      return files;
    } catch (error) {
      console.error(`❌ DATABASE ERROR bij ophalen bestanden in map ${folderId}:`, error);
      // Geef een leeg array terug in geval van fouten
      return [];
    }
  }
  
  async removeFileFromFolder(fileId: number, position?: { x: number, y: number }): Promise<DesktopFileDB | undefined> {
    try {
      console.log(`🔄 DATABASE: Removing file ${fileId} from folder${position ? ` and placing at position (${position.x}, ${position.y})` : ''}`);
      
      // Update set object that always includes parentId: null
      const updateSet: Partial<typeof desktopFiles.$inferInsert> = { 
        parentId: null 
      };
      
      // Add position if provided
      if (position) {
        updateSet.position = position;
      }
      
      // Perform the update
      const [updatedFile] = await db
        .update(desktopFiles)
        .set(updateSet)
        .where(eq(desktopFiles.id, fileId))
        .returning();
        
      console.log(`✅ DATABASE: File ${fileId} successfully removed from folder${position ? ' and position updated' : ''}`);
      return updatedFile || undefined;
    } catch (error) {
      console.error(`❌ DATABASE ERROR removing file ${fileId} from folder:`, error);
      return undefined;
    }
  }
  
  async updateFileName(id: number, name: string): Promise<DesktopFileDB | undefined> {
    const [updatedFile] = await db
      .update(desktopFiles)
      .set({ name })
      .where(eq(desktopFiles.id, id))
      .returning();
    return updatedFile || undefined;
  }
}

export const storage = new DatabaseStorage();
