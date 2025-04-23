import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import express from "express";
import multer from "multer";
import { z } from "zod";
import { insertDesktopFileSchema, type DesktopFile } from "@shared/schema";
import { setupAuth } from "./auth";
import { WebSocketServer, WebSocket } from "ws";

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

  // Update file name
  app.patch('/api/files/:id/name', express.json(), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: 'Name is required' });
      }
      
      const updatedFile = await storage.updateFileName(id, name);
      
      if (!updatedFile) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      return res.status(200).json({ file: updatedFile });
    } catch (error) {
      console.error('Error updating file name:', error);
      return res.status(500).json({ message: 'Error updating file name' });
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
      
      console.log(`📂 API: Toevoegen van bestand ${fileId} aan map ${folderId}`);
      
      const updatedFile = await storage.addFileToFolder(fileId, folderId);
      
      if (!updatedFile) {
        console.error(`⚠️ Bestand ${fileId} niet gevonden bij toevoegen aan map ${folderId}`);
        return res.status(404).json({ message: 'File not found' });
      }
      
      console.log(`✅ Bestand ${updatedFile.name} (ID: ${updatedFile.id}) succesvol aan map toegevoegd`);
      
      // Stuur een update naar alle verbonden clients
      await broadcastFolderUpdate(folderId);
      
      return res.status(200).json({ file: updatedFile });
    } catch (error) {
      console.error('Error adding file to folder:', error);
      return res.status(500).json({ message: 'Error adding file to folder' });
    }
  });
  
  // Cache voor mapinhoudsresultaten met zeer lange levensduur
  const folderContentsCache: {[folderId: number]: { files: any[], timestamp: number }} = {};
  const CACHE_TTL = 60000; // 60 seconden cache geldigheid (verhoogd voor betere prestaties)
    
  // Get files in a folder (VERBETERD MET CACHING)
  app.get('/api/folders/:folderId/files', async (req, res) => {
    try {
      const folderId = parseInt(req.params.folderId);
      if (isNaN(folderId)) {
        console.error('Invalid folder ID:', req.params.folderId);
        return res.status(400).json({ message: 'Invalid folder ID', files: [] });
      }
      
      // Check cache first
      const now = Date.now();
      const cachedResult = folderContentsCache[folderId];
      
      // Force refresh als er een 'refresh=true' parameter is of als er een timestamp (t) parameter is
      const forceRefresh = req.query.refresh === 'true' || req.query.t !== undefined;
      
      if (cachedResult && !forceRefresh && now - cachedResult.timestamp < CACHE_TTL) {
        console.log(`🚀 CACHE HIT: Mapinhoud voor map ${folderId} (${cachedResult.files.length} bestanden)`);
        return res.status(200).json({ 
          files: cachedResult.files, 
          message: 'Successfully retrieved files from cache',
          fromCache: true
        });
      }
      
      console.log(`📂 API REQUEST: Ophalen bestanden voor map ${folderId}`);
      
      // Haal bestanden op
      const files = await storage.getFilesInFolder(folderId);
      console.log(`📄 MAP ${folderId} BEVAT ${files.length} BESTANDEN:`, 
        files.map(f => `${f.name} (ID:${f.id})`).join(', '));
      
      // Update de cache
      folderContentsCache[folderId] = {
        files,
        timestamp: now
      };
      
      // Ververs WebSocket clients met deze data
      try {
        await broadcastFolderUpdate(folderId);
      } catch (wsError) {
        console.error('Error broadcasting folder update via WebSocket:', wsError);
        // Dit is niet kritiek, dus we laten de request doorgaan
      }
      
      return res.status(200).json({ 
        files,
        message: `Successfully retrieved ${files.length} files from folder ${folderId}`
      });
    } catch (error) {
      console.error('Error getting files from folder:', error);
      return res.status(500).json({ 
        message: 'Error getting files from folder', 
        error: String(error),
        files: [] // Verstuur een leeg array als fallback
      });
    }
  });
  
  // Remove a file from a folder, optionally setting its new position
  app.delete('/api/folders/files/:fileId', express.json(), async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);
      
      console.log(`📤 API: Verwijderen van bestand ${fileId} uit map`);
      
      // Haal zowel positie als parent ID uit de request body
      let validPosition = undefined;
      let parentFolderId = undefined;
      
      // Controleer en valideer positie
      if (req.body?.position) {
        console.log(`🖱️ Met aangevraagde positie: x=${req.body.position.x}, y=${req.body.position.y}`);
        
        const positionSchema = z.object({
          x: z.number(),
          y: z.number()
        });
        
        const validationResult = positionSchema.safeParse(req.body.position);
        if (validationResult.success) {
          validPosition = req.body.position;
          console.log(`🖱️ Geldige positie gevalideerd: x=${validPosition.x}, y=${validPosition.y}`);
        } else {
          console.error(`⚠️ Ongeldige positie ontvangen:`, req.body.position);
        }
      }
      
      // Controleer parent ID
      if (req.body?.parentId) {
        parentFolderId = parseInt(req.body.parentId);
        if (!isNaN(parentFolderId)) {
          console.log(`📂 Bestand wordt verwijderd uit map ${parentFolderId}`);
        } else {
          console.error(`⚠️ Ongeldige parent ID ontvangen:`, req.body.parentId);
          parentFolderId = undefined;
        }
      } else {
        console.log(`📤 Geen parent ID opgegeven voor het bestand`);
      }
      
      // Verwijder het bestand uit de map met de nieuwe positie in één operatie
      let updatedFile = await storage.removeFileFromFolder(fileId, validPosition);
      
      if (!updatedFile) {
        console.error(`⚠️ Bestand ${fileId} niet gevonden bij verwijderen uit map`);
        return res.status(404).json({ message: 'File not found' });
      }
      
      console.log(`✅ Bestand ${updatedFile.name} (ID: ${updatedFile.id}) succesvol uit map verwijderd`);
      console.log(`   ${validPosition ? `en geplaatst op positie (${validPosition.x}, ${validPosition.y})` : 'zonder positie-update'}`);
      
      // Als er een parentId was meegegeven, trigger een broadcast om die map te verversen
      if (parentFolderId) {
        try {
          console.log(`🔄 Sending folder update broadcast voor map ${parentFolderId}`);
          await broadcastFolderUpdate(parentFolderId);
        } catch (err) {
          console.error(`❌ Fout bij broadcast van mapupdate na verwijderen bestand:`, err);
        }
      }
      
      return res.status(200).json({ file: updatedFile, parentId: parentFolderId });
    } catch (error) {
      console.error('❌ Error removing file from folder:', error);
      return res.status(500).json({ message: 'Error removing file from folder' });
    }
  });

  const httpServer = createServer(app);
  
  // Setup WebSocket server op een apart pad
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Websocket server setup
  wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected');
    
    // Stuur een bevestiging naar de client
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'WebSocket connection established',
      timestamp: new Date().toISOString()
    }));
    
    // Luister naar berichten van de client
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('📱 WebSocket bericht ontvangen:', data);
        
        // Verwerk verschillende soorten berichten
        if (data.type === 'requestFolderRefresh' && data.folderId) {
          console.log(`🔄 WebSocket: verzoek om map ${data.folderId} te verversen`);
          
          // Haal de mapinhoud op en stuur terug
          storage.getFilesInFolder(data.folderId)
            .then(files => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'folderContents',
                  folderId: data.folderId,
                  files: files,
                  timestamp: new Date().toISOString()
                }));
                console.log(`📤 WebSocket: mapinhoud verzonden voor map ${data.folderId}, ${files.length} bestanden`);
              }
            })
            .catch(error => {
              console.error(`❌ WebSocket: fout bij ophalen mapinhoud:`, error);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Error fetching folder contents',
                  error: error.message,
                  timestamp: new Date().toISOString()
                }));
              }
            });
        }
      } catch (error) {
        console.error('❌ WebSocket: Fout bij verwerken bericht:', error);
      }
    });
    
    // Onderhoud een heartbeat om de connectie actief te houden
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
      }
    }, 30000);
    
    // Cleanup bij disconnect
    ws.on('close', () => {
      console.log('🔌 WebSocket client disconnected');
      clearInterval(interval);
    });
  });
  
  // Helper functie om berichten naar alle WebSocket clients te versturen
  const broadcastToClients = (data: any) => {
    try {
      let clientCount = 0;
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
          clientCount++;
        }
      });
      console.log(`📢 Broadcast verzonden naar ${clientCount} clients`);
    } catch (err) {
      console.error('❌ Fout bij broadcast naar clients:', err);
    }
  };
  
  // Event broadcaster voor mapupdates - realtime WebSocket implementatie
  const broadcastFolderUpdate = async (folderId: number) => {
    try {
      const files = await storage.getFilesInFolder(folderId);
      console.log(`📢 WebSocket broadcast: mapupdate voor map ${folderId}, ${files.length} bestanden`);
      
      // Stuur updates naar verbonden clients
      broadcastToClients({
        type: 'mapupdate',
        folderId,
        fileCount: files.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`❌ WebSocket broadcast fout:`, error);
    }
  };
  
  // Exporteer de httpServer
  return httpServer;
}
