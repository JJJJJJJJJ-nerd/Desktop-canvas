import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import express from "express";
import multer from "multer";
import { z } from "zod";
import { insertDesktopFileSchema, type DesktopFile } from "@shared/schema";
import { setupAuth } from "./auth";

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  // Get all files (protected route - requires authentication)
  app.get('/api/files', async (req, res) => {
    try {
      // If user is authenticated, get their files
      if (req.isAuthenticated()) {
        const userId = req.user?.id;
        const files = await storage.getFiles(userId);
        return res.status(200).json({ files });
      } else {
        // For non-authenticated users, return public files or empty array
        const files = await storage.getFiles();
        return res.status(200).json({ files });
      }
    } catch (error) {
      console.error('Error getting files:', error);
      return res.status(500).json({ message: 'Error getting files' });
    }
  });

  // Get a single file by ID
  app.get('/api/files/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const file = await storage.getFile(id);
      
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      return res.status(200).json({ file });
    } catch (error) {
      console.error('Error getting file:', error);
      return res.status(500).json({ message: 'Error getting file' });
    }
  });

  // File upload endpoint - now saves to database
  app.post('/api/files/upload', upload.array('files'), async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const savedFiles = [];
      for (const file of req.files) {
        // Convert the Buffer to a Base64 string
        const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
        
        // Generate random position for the new file
        const position = {
          x: Math.floor(Math.random() * 800),
          y: Math.floor(Math.random() * 500)
        };

        const newFile = {
          name: file.originalname,
          type: file.mimetype || 'application/octet-stream',
          size: file.size,
          dataUrl,
          position,
          userId: req.user?.id, // Associate with logged-in user if available
        };

        // Validate with zod schema
        const validationResult = insertDesktopFileSchema.safeParse(newFile);
        if (!validationResult.success) {
          console.error('Validation error:', validationResult.error);
          continue; // Skip invalid files
        }

        // Save to database
        const savedFile = await storage.createFile(newFile);
        savedFiles.push(savedFile);
      }

      return res.status(200).json({ files: savedFiles });
    } catch (error) {
      console.error('Error uploading files:', error);
      return res.status(500).json({ message: 'Error uploading files' });
    }
  });

  // Update file position
  app.patch('/api/files/:id/position', express.json(), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const positionSchema = z.object({
        x: z.number(),
        y: z.number()
      });

      // Validate input
      const validationResult = positionSchema.safeParse(req.body.position);
      if (!validationResult.success) {
        return res.status(400).json({ message: 'Invalid position data' });
      }

      const updatedFile = await storage.updateFile(id, req.body.position);
      
      if (!updatedFile) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      return res.status(200).json({ file: updatedFile });
    } catch (error) {
      console.error('Error updating file position:', error);
      return res.status(500).json({ message: 'Error updating file position' });
    }
  });

  // Update file dimensions
  app.patch('/api/files/:id/dimensions', express.json(), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const dimensionsSchema = z.object({
        width: z.number().min(100),
        height: z.number().min(100)
      });

      // Validate input
      const validationResult = dimensionsSchema.safeParse(req.body.dimensions);
      if (!validationResult.success) {
        return res.status(400).json({ message: 'Invalid dimensions data' });
      }

      const updatedFile = await storage.updateFileDimensions(id, req.body.dimensions);
      
      if (!updatedFile) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      return res.status(200).json({ file: updatedFile });
    } catch (error) {
      console.error('Error updating file dimensions:', error);
      return res.status(500).json({ message: 'Error updating file dimensions' });
    }
  });

  // Delete a file
  app.delete('/api/files/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteFile(id);
      return res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
      console.error('Error deleting file:', error);
      return res.status(500).json({ message: 'Error deleting file' });
    }
  });

  // Save desktop state endpoint
  app.post('/api/desktop/save', express.json({ limit: '50mb' }), async (req, res) => {
    try {
      const filesSchema = z.array(
        z.object({
          id: z.number().optional(),
          name: z.string(),
          type: z.string(),
          size: z.number(),
          dataUrl: z.string(),
          position: z.object({
            x: z.number(),
            y: z.number()
          })
        })
      );

      // Validate input
      const validationResult = filesSchema.safeParse(req.body.files);
      if (!validationResult.success) {
        return res.status(400).json({ message: 'Invalid file data' });
      }

      const files = validationResult.data;
      
      // Update position of each file in the database
      for (const file of files) {
        if (file.id) {
          await storage.updateFile(file.id, file.position);
        }
      }
      
      return res.status(200).json({ message: 'Desktop state saved successfully' });
    } catch (error) {
      console.error('Error saving desktop state:', error);
      return res.status(500).json({ message: 'Error saving desktop state' });
    }
  });
  
  // Create a new folder
  app.post('/api/folders', express.json(), async (req, res) => {
    try {
      const { name, position } = req.body;
      
      if (!name || !position) {
        return res.status(400).json({ message: 'Name and position are required' });
      }
      
      const userId = req.user?.id;
      const folder = await storage.createFolder(name, position, userId);
      
      return res.status(201).json({ folder });
    } catch (error) {
      console.error('Error creating folder:', error);
      return res.status(500).json({ message: 'Error creating folder' });
    }
  });
  
  // Add a file to a folder
  app.post('/api/folders/:folderId/files/:fileId', async (req, res) => {
    try {
      const folderId = parseInt(req.params.folderId);
      const fileId = parseInt(req.params.fileId);
      
      const updatedFile = await storage.addFileToFolder(fileId, folderId);
      
      if (!updatedFile) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      return res.status(200).json({ file: updatedFile });
    } catch (error) {
      console.error('Error adding file to folder:', error);
      return res.status(500).json({ message: 'Error adding file to folder' });
    }
  });
  
  // Get files in a folder
  app.get('/api/folders/:folderId/files', async (req, res) => {
    try {
      const folderId = parseInt(req.params.folderId);
      const files = await storage.getFilesInFolder(folderId);
      
      return res.status(200).json({ files });
    } catch (error) {
      console.error('Error getting files from folder:', error);
      return res.status(500).json({ message: 'Error getting files from folder' });
    }
  });
  
  // Remove a file from a folder
  app.delete('/api/folders/files/:fileId', async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);
      const updatedFile = await storage.removeFileFromFolder(fileId);
      
      if (!updatedFile) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      return res.status(200).json({ file: updatedFile });
    } catch (error) {
      console.error('Error removing file from folder:', error);
      return res.status(500).json({ message: 'Error removing file from folder' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
