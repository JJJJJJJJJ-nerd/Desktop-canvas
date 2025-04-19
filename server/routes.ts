import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import express from "express";
import multer from "multer";
import { z } from "zod";

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // File upload endpoint
  app.post('/api/files/upload', upload.array('files'), (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const uploadedFiles = req.files.map(file => {
        // Convert the Buffer to a Base64 string
        const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
        
        return {
          name: file.originalname,
          type: file.mimetype || 'application/octet-stream',
          size: file.size,
          dataUrl
        };
      });

      return res.status(200).json({ files: uploadedFiles });
    } catch (error) {
      console.error('Error uploading files:', error);
      return res.status(500).json({ message: 'Error uploading files' });
    }
  });

  // Save desktop state endpoint
  app.post('/api/desktop/save', express.json({ limit: '50mb' }), (req, res) => {
    try {
      const filesSchema = z.array(
        z.object({
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

      // In this version, we're just acknowledging the save
      // In a real application, we would save to a database
      return res.status(200).json({ message: 'Desktop state saved successfully' });
    } catch (error) {
      console.error('Error saving desktop state:', error);
      return res.status(500).json({ message: 'Error saving desktop state' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
