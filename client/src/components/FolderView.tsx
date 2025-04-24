import { useState, useEffect, useRef } from 'react';
import { FileItem } from './FileItem';
import { DraggableFolderItem } from './DraggableFolderItem';
import { DesktopFile } from '@/types';
import { X, FolderOpen, ArrowLeft, Upload, Check, Folder, MoveRight, FileX, Edit, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { queryClient } from '@/lib/queryClient';
import { useDesktopFiles } from '@/hooks/use-desktop-files';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface FolderViewProps {
  folder: DesktopFile;
  onClose: () => void;
  onSelectFile: (file: DesktopFile) => void;
  onRename?: (fileId: number, newName: string) => void;
}

export function FolderView({ folder, onClose, onSelectFile, onRename }: FolderViewProps) {
  // Globale loading overlay component voor hergebruik
  const LoadingOverlay = ({ message }: { message: string }) => (
    <div className="fixed top-0 left-0 w-screen h-screen bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999]" style={{
      animation: "fadeIn 0.2s ease-out",
      position: "fixed"
    }}>
      <div className="bg-white p-8 rounded-xl shadow-2xl border-2 border-primary flex flex-col items-center transform scale-110">
        <div className="h-16 w-16 animate-spin text-primary mb-6 border-4 border-primary/20 border-t-primary rounded-full"></div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{message}</h3>
        <p className="text-lg text-gray-500">Een ogenblik geduld...</p>
      </div>
    </div>
  );
  const [files, setFiles] = useState<DesktopFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  
  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);
  
  // Toast notificaties
  const { toast } = useToast();
  
  // Gebruik de functies uit de hook
  const { removeFileFromFolder, addFileToFolder } = useDesktopFiles();
  const [selectedFileIds, setSelectedFileIds] = useState<number[]>([]);
  const [externalFiles, setExternalFiles] = useState<DesktopFile[]>([]);
  
  // State for rename dialog
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState(folder.name);
  
  const dropAreaRef = useRef<HTMLDivElement>(null);

  // Positie van de map bijhouden
  const [localPosition, setLocalPosition] = useState(folder.position);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Global state to track which folder is being dragged
  // @ts-ignore - Custom property
  window._folderBeingDragged = dragging ? folder.id : null;
  
  // Files ophalen voor deze map - verbeterde versie met directe verwerking
  const fetchFiles = async () => {
    if (!folder.id) return;
    
    console.log(`🔄 LOADING: Bestanden ophalen voor map ${folder.name} (ID: ${folder.id})`);
    
    try {
      setIsRefreshing(true);
      const folderFilesKey = [`/api/folders/${folder.id}/files`];
      
      // Gebruik een cachebreaker om zeker verse data te krijgen
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/folders/${folder.id}/files?_t=${timestamp}`);
      
      if (!response.ok) {
        console.error(`HTTP Error ${response.status} bij ophalen mapinhoud`);
        throw new Error(`Failed to fetch folder files: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      console.log(`📂 FOLDER ${folder.id} DATA FETCHED: ${data.files?.length || 0} bestanden gevonden`);
      console.log(`📄 RUWE DATA: ${JSON.stringify(data)}`);
      
      // Controleer of de data de verwachte structuur heeft
      if (!data.files || !Array.isArray(data.files)) {
        console.error("⚠️ Onverwachte datastructuur:", data);
        // Maak een leeg array als fallback
        data.files = [];
      }
      
      // Update het cachegeheugen
      queryClient.setQueryData(folderFilesKey, { files: data.files });
      
      // HIER IS DE WIJZIGING: Forceer een state update met een nieuw array
      // React kan soms niet reageren op veranderingen in arrays/objecten zonder referentiewijziging
      setFiles([...data.files]);
      
      // Log de data voor debugging
      if (data.files.length > 0) {
        console.log(`📄 FOLDER INHOUD (${data.files.length}):`);
        data.files.forEach((file: any, index: number) => {
          console.log(`   ${index+1}. ${file.name} (ID: ${file.id})`);
        });
      } else {
        console.log(`📄 FOLDER IS LEEG (0 bestanden)`);
      }
      
      return data.files;
    } catch (err) {
      console.error("❌ FOUT bij ophalen mapinhoud:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      
      toast({
        title: "Fout bij laden",
        description: "Kon de inhoud van de map niet laden",
        variant: "destructive"
      });
      return [];
    } finally {
      // Een kleine vertraging voordat we de loading states resetten
      // Zorgt ervoor dat React tijd heeft om de nieuwe data te verwerken
      setTimeout(() => {
        setIsLoading(false);
        setIsRefreshing(false);
      }, 300);
    }
  };
  
  // WebSocket setup
  useEffect(() => {
    if (!folder.id) return;
    
    console.log(`🔌 Setting up WebSocket for folder ${folder.id}`);
    
    // WebSocket setup volgens het protocol dat overeenkomt met de pagina
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    // Maak WebSocket verbinding
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;
    
    // Connection opened
    socket.addEventListener('open', () => {
      console.log(`🔌 WebSocket connected for folder ${folder.id}`);
      
      // Vraag om de mapinhoud bij verbinding
      socket.send(JSON.stringify({
        type: 'requestFolderRefresh',
        folderId: folder.id,
        timestamp: new Date().toISOString()
      }));
    });
    
    // Listen for messages
    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`📩 WebSocket message received for folder ${folder.id}:`, data.type);
        
        // Verwerk verschillende soorten berichten
        if (data.type === 'folderContents' && data.folderId === folder.id) {
          console.log(`📂 WebSocket: Ontvangen mapinhoud voor ${folder.id}: ${data.files.length} bestanden`);
          console.log('📄 DEBUG FOLDER CONTENTS:', JSON.stringify(data.files, null, 2));
          
          // Update files array in state
          setFiles(data.files || []);
          setIsLoading(false);
          setIsRefreshing(false);
          
          // Also update cache for consistency
          queryClient.setQueryData([`/api/folders/${folder.id}/files`], { files: data.files || [] });
          
        } else if (data.type === 'folderUpdate' && data.folderId === folder.id) {
          console.log(`🔄 WebSocket: Mapupdate ontvangen voor ${folder.id}`);
          console.log('📄 DEBUG FOLDER UPDATE:', JSON.stringify(data.files, null, 2));
          
          // Update files array in state
          setFiles(data.files || []);
          
          // Also update cache for consistency
          queryClient.setQueryData([`/api/folders/${folder.id}/files`], { files: data.files || [] });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    // Connection closed
    socket.addEventListener('close', () => {
      console.log(`🔌 WebSocket disconnected for folder ${folder.id}`);
    });
    
    // Connection error
    socket.addEventListener('error', (error) => {
      console.error(`🔌 WebSocket error for folder ${folder.id}:`, error);
      
      // Als de WebSocket mislukt, val terug op gewone HTTP
      console.log('Falling back to traditional HTTP for folder data');
      fetchFiles();
    });
    
    // Clean up
    return () => {
      console.log(`🔌 Closing WebSocket for folder ${folder.id}`);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [folder.id, folder.name]);
  
  // Load files when component mounts - Traditional fallback method
  useEffect(() => {
    console.log(`📂 FOLDER VIEW MOUNTED: Map ${folder.name} (ID: ${folder.id})`);
    
    // Zet laadstatus om laad-indicator te tonen
    setIsLoading(true);
    
    // Stel lokale positie in op basis van folderdata
    setLocalPosition(folder.position);
    
    // Direct laden
    fetchFiles();
    
    // En nogmaals na een korte vertraging om mislukte eerste pogingen te compenseren
    const timeoutId = setTimeout(() => {
      if (files.length === 0) {
        console.log(`🔄 RETRY: Geen bestanden geladen, probeer opnieuw voor map ${folder.id}`);
        fetchFiles();
      }
    }, 800);
    
    return () => clearTimeout(timeoutId);
  }, [folder.id, folder.name]);
  
  // Debug en auto-refresh effect
  useEffect(() => {
    if (!folder.id) return;
    
    // Automatisch om de paar seconden verversen voor debugging
    const debugInterval = setInterval(() => {
      // Alleen debug logs, geen fetch om performance te sparen
      console.log(`🔍 DEBUG Map ${folder.id}: huidige status: ${files.length} bestanden, loading: ${isLoading}`);
      
      // Force rendering debug
      console.log(`🔍 CURRENT FILES IN STATE:`, files.map(f => `${f.name} (${f.id})`).join(', ') || 'Geen bestanden');
      
      // Log als in development mode
      if (process.env.NODE_ENV === 'development') {
        // Controleer of het DOM overeenkomt met de state
        const folderContent = document.querySelector(`#folder-window-${folder.id} .grid`);
        if (folderContent) {
          const fileItems = folderContent.querySelectorAll('.file-item');
          console.log(`🔍 DOM INHOUD: ${fileItems.length} bestand elementen in het DOM`);
        }
      }
    }, 3000);
    
    return () => clearInterval(debugInterval);
  }, [folder.id, files.length, isLoading]);
  
  // Handle the window/folder dragging
  useEffect(() => {
    // Element referentie voor betere performance
    const folderWindowEl = document.getElementById(`folder-window-${folder.id}`);
    if (!folderWindowEl) return;
    
    // Startpositie bijhouden voordat we gaan slepen
    let startPos = { x: localPosition.x, y: localPosition.y };
    let isFolderHeaderDrag = false;
    
    // Handle mouse down op folder header
    const handleHeaderMouseDown = (e: MouseEvent) => {
      // Skip als we klikken op buttons of interactieve elementen
      if ((e.target as HTMLElement).tagName === 'BUTTON' || 
          (e.target as HTMLElement).tagName === 'INPUT' ||
          (e.target as HTMLElement).closest('button')) {
        return;
      }
      
      // Vind de folder header - direct element reference
      const folderHeader = folderWindowEl.querySelector('.folder-header');
      const targetElement = e.target as HTMLElement;
      
      // Check of we in de folder header hebben geklikt (direct of kind)
      const isHeaderOrChild = folderHeader && (
        folderHeader === targetElement || 
        folderHeader.contains(targetElement)
      );
      
      if (isHeaderOrChild) {
        console.log(`🖱️ Mouse DOWN op folder header ${folder.id}`);
        
        // Start drag operatie
        startPos = { ...localPosition };
        isFolderHeaderDrag = true;
        setDragging(true);
        
        // Bereken de offset voor de drag (waar klikken we t.o.v. window corner)
        const rect = folderWindowEl.getBoundingClientRect();
        const newOffset = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        setDragOffset(newOffset);
        
        console.log(`🖐️ START drag folder from (${startPos.x}, ${startPos.y}), offset: (${newOffset.x}, ${newOffset.y})`);
        
        // Voorkom dat andere elementen de event stelen
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (dragging && isFolderHeaderDrag) {
        // Bereken de nieuwe positie met grenzen
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const folderWidth = folderWindowEl.offsetWidth;
        const folderHeight = folderWindowEl.offsetHeight;
        
        // Voorkom dat de map buiten het scherm kan worden gesleept
        // Houd altijd tenminste 100px binnen het scherm
        const newX = Math.max(
          -folderWidth + 100, 
          Math.min(
            screenWidth - 100, 
            e.clientX - dragOffset.x
          )
        );
        
        const newY = Math.max(
          0, // Bij de bovenkant niet negatief
          Math.min(
            screenHeight - 50, // Altijd visible onderaan
            e.clientY - dragOffset.y
          )
        );
        
        // Update de lokale positie voor directe visuele feedback
        setLocalPosition({
          x: newX,
          y: newY
        });
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (dragging && isFolderHeaderDrag) {
        // Reset dragging state
        setDragging(false);
        isFolderHeaderDrag = false;
        
        // Gebruik de huidige positie, niet e.clientX/Y omdat we al beperkingen toepassen
        const finalX = localPosition.x;
        const finalY = localPosition.y;
        
        // Controleer of de positie daadwerkelijk is veranderd
        const hasMoved = 
          Math.abs(finalX - startPos.x) > 5 || 
          Math.abs(finalY - startPos.y) > 5;
        
        if (!hasMoved) {
          console.log(`🔙 Folder was clicked but not moved significantly`);
          return; // Skip update als de map nauwelijks bewogen heeft
        }
        
        console.log(`✋ Folder drag completed: (${finalX}, ${finalY})`);
        
        // Update the server with the new position
        if (folder.id) {
          console.log(`📤 Updating folder ${folder.id} position from (${startPos.x}, ${startPos.y}) to (${finalX}, ${finalY})`);
          
          fetch(`/api/files/${folder.id}/position`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              position: {
                x: finalX,
                y: finalY
              }
            })
          })
          .then(response => {
            if (!response.ok) throw new Error('Failed to update folder position');
            console.log(`✅ Folder position successfully updated to:`, {
              x: finalX,
              y: finalY
            });
          })
          .catch(err => {
            console.error('Error updating folder position:', err);
            
            // Bij fout, herstel naar de originele positie
            toast({
              title: "Fout bij verplaatsen",
              description: "Kon de mappositie niet opslaan",
              variant: "destructive"
            });
            
            // Terug naar positie voor het slepen
            setLocalPosition(startPos);
          });
        }
      }
    };
    
    // Direct event registratie op het folder header element voor betere performance
    const folderHeader = folderWindowEl.querySelector('.folder-header') as HTMLElement;
    if (folderHeader) {
      folderHeader.addEventListener('mousedown', handleHeaderMouseDown);
      
      // Globale events voor moving en mouseup (want je kunt buiten de header slepen)
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      console.log('🔌 Drag handlers geregistreerd voor folder', folder.id);
      
      return () => {
        folderHeader.removeEventListener('mousedown', handleHeaderMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        console.log('🔌 Drag handlers verwijderd voor folder', folder.id);
      };
    }
    
    // Fallback voor als de header niet bestaat
    return () => {};
  }, [folder.id, folder.name, dragging, dragOffset]);
  
  // Handle file drag-and-drop functionality
  useEffect(() => {
    // Wait until DOM has been rendered
    const timeoutId = setTimeout(() => {
      const folderElement = document.getElementById(`folder-window-${folder.id}`);
      if (!folderElement) return;
      
      // Handle mouse movement to detect when cursor is over folder
      const handleGlobalMouseMove = (e: MouseEvent) => {
        // Only process if we're currently dragging a file
        // @ts-ignore - Custom property for global tracking
        const dragInfo = window.draggedFileInfo;
        if (!dragInfo) return;
        
        // Skip if we're dragging a folder into itself (prevents loops)
        if (dragInfo.isFolder && dragInfo.id === folder.id) return;
        
        // Check if mouse is inside this folder's bounds
        const rect = folderElement.getBoundingClientRect();
        const isInside = 
          e.clientX >= rect.left && 
          e.clientX <= rect.right && 
          e.clientY >= rect.top && 
          e.clientY <= rect.bottom;
        
        if (isInside) {
          // Mouse is over this open folder while dragging a file
          console.log(`🎯 DETECTED: File ${dragInfo.name} is hovering over open folder ${folder.name}`);
          
          // Show drop indicators
          folderElement.classList.add('folder-highlight-dragover');
          setIsDraggingOver(true);
          
          // Store this folder as the global active target for files
          // @ts-ignore - Custom global properties
          window._activeDropFolder = {
            id: folder.id,
            name: folder.name,
            element: folderElement,
            timestamp: Date.now()
          };
          
          // Also update the more generic tracking property
          // @ts-ignore
          window._currentDropTarget = {
            id: folder.id,
            element: folderElement
          };
          
          // Broadcast that we're over an open folder
          // @ts-ignore
          window._openFolderHoverId = folder.id;
        } else {
          // Mouse is not over this folder
          folderElement.classList.remove('folder-highlight-dragover');
          
          // Only reset the tracking properties if they were pointing to this folder
          // @ts-ignore
          if (window._activeDropFolder?.id === folder.id) {
            // @ts-ignore
            window._activeDropFolder = null;
            // @ts-ignore
            window._openFolderHoverId = null;
            setIsDraggingOver(false);
          }
          
          // @ts-ignore
          if (window._currentDropTarget?.id === folder.id) {
            // @ts-ignore
            window._currentDropTarget = null;
          }
        }
      };
      
      // Handle drop events on the folder window
      const handleFolderDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const folderElement = document.getElementById(`folder-window-${folder.id}`);
        if (folderElement) {
          folderElement.classList.remove('folder-highlight-dragover');
        }
        setIsDraggingOver(false);
        
        // Get the file ID from the drag data
        if (!e.dataTransfer) return;
        
        const fileId = e.dataTransfer.getData('text/plain');
        if (!fileId) return;
        
        // Add the file to this folder
        try {
          const fileIdNum = parseInt(fileId);
          if (!isNaN(fileIdNum) && typeof folder.id === 'number') {
            // Show visual feedback
            onSelectFile({
              id: fileIdNum,
              name: "Moving file...",
              type: "placeholder",
              size: 0,
              dataUrl: "",
              position: { x: 0, y: 0 }
            });
            
            // Immediately update UI for instant feedback
            const desktopFiles = queryClient.getQueryData<{files: DesktopFile[]}>(['/api/files']);
            if (desktopFiles?.files) {
              // Find the file that's being moved
              const fileIndex = desktopFiles.files.findIndex(f => f.id === fileIdNum);
              
              if (fileIndex >= 0) {
                // Clone the files array to avoid mutating the cache directly
                const updatedFiles = [...desktopFiles.files];
                const movedFile = {...updatedFiles[fileIndex]};
                
                // Update the file's parentId to the folder's ID
                movedFile.parentId = folder.id;
                
                // Remove the file from desktop view
                updatedFiles.splice(fileIndex, 1);
                
                // Update the cache with the file removed from desktop
                queryClient.setQueryData(['/api/files'], {
                  files: updatedFiles
                });
                
                // Get folder contents and add the file there
                const folderFilesKey = [`/api/folders/${folder.id}/files`];
                const folderContents = queryClient.getQueryData<{files: DesktopFile[]}>(folderFilesKey) || {files: []};
                
                // Update folder contents cache
                queryClient.setQueryData(folderFilesKey, {
                  files: [...folderContents.files, movedFile]
                });
                
                // Show success toast immediately
                toast({
                  title: "File moved",
                  description: "File successfully moved to folder",
                  duration: 2000
                });
                
                // Then make the actual API call to update the database
                addFileToFolder(fileIdNum, folder.id)
                  .then(() => {
                    console.log("✅ Database updated to match UI");
                    // Refresh all files data to ensure consistency
                    setTimeout(() => {
                      fetchFiles();
                      queryClient.invalidateQueries({ queryKey: folderFilesKey });
                    }, 300);
                  })
                  .catch(error => {
                    console.error("Error moving file to folder:", error);
                    // Show error and revert UI changes
                    toast({
                      title: "Error",
                      description: "Failed to move file to folder",
                      variant: "destructive",
                      duration: 3000
                    });
                    // Refresh data to revert visual changes
                    fetchFiles();
                  });
              }
            } else {
              // Fallback if we don't have the current files in cache
              addFileToFolder(fileIdNum, folder.id)
                .then(() => {
                  toast({
                    title: "File moved",
                    description: "File successfully moved to folder",
                    duration: 3000
                  });
                  fetchFiles();
                })
                .catch(error => {
                  console.error("Error moving file to folder:", error);
                  toast({
                    title: "Error",
                    description: "Failed to move file to folder",
                    variant: "destructive",
                    duration: 3000
                  });
                });
            }
          }
        } catch (error) {
          console.error("Error processing drop:", error);
        }
      };
      
      // Add event listeners
      document.addEventListener('mousemove', handleGlobalMouseMove);
      folderElement.addEventListener('drop', handleFolderDrop);
      folderElement.addEventListener('dragover', e => {
        e.preventDefault(); 
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
      });
      
      // Clean up when component unmounts
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        folderElement.removeEventListener('drop', handleFolderDrop);
        folderElement.removeEventListener('dragover', e => e.preventDefault());
      };
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [folder.id, folder.name, onSelectFile, addFileToFolder, fetchFiles, toast]);

  return (
    <>
      {/* Centraal loading overlay voor alle laadoperaties */}
      {(isLoading || isRefreshing) && (
        <LoadingOverlay message={isLoading ? "Map Wordt Geladen" : "Map Wordt Bijgewerkt"} />
      )}
      
      <div 
        id={`folder-window-${folder.id}`}
        className={`absolute bg-white/95 backdrop-blur-md rounded-lg shadow-xl overflow-hidden ${
          isDraggingOver ? 'folder-highlight-dragover' : ''
        }`}
        style={{
        width: '600px',
        height: 'auto', 
        maxWidth: '95vw',
        maxHeight: '85vh',
        left: localPosition.x,
        top: localPosition.y,
        zIndex: dragging ? 1000 : 30, // Higher when dragging, lower when static but still allow files to be visible above
        transition: dragging ? 'none' : 'all 0.15s ease',
        border: isDraggingOver ? '2px solid #3b82f6' : '1px solid rgba(0,0,0,0.1)'
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Only apply effects if actually dragging a file (with file ID)
        const hasFileId = e.dataTransfer.types.includes('text/plain');
        
        if (hasFileId) {
          console.log(`🟢 DRAG OVER OPEN MAP: ${folder.name} (ID: ${folder.id})`);
          setIsDraggingOver(true);
          e.dataTransfer.dropEffect = 'move';
          
          // Sla de open map op als actieve drop target
          // @ts-ignore - Custom property
          window._activeDropFolder = {
            id: folder.id,
            name: folder.name,
            element: document.getElementById(`folder-window-${folder.id}`),
            timestamp: Date.now()
          };
        }
        
        // @ts-ignore - Voor backward compatibility
        window._openFolderHoverId = folder.id;
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Only process when we're actually dragging a file
        const hasFileId = e.dataTransfer.types.includes('text/plain');
        
        if (hasFileId) {
          console.log(`🔴 DRAG LEAVE OPEN MAP: ${folder.name}`);
          
          // Small delay to prevent flickering when moving between elements
          setTimeout(() => {
            setIsDraggingOver(false);
          }, 50);
          
          // @ts-ignore - Custom property
          if (window._activeDropFolder?.id === folder.id) {
            // @ts-ignore - Custom property
            window._activeDropFolder = undefined;
            // @ts-ignore - Custom property
            window._openFolderHoverId = undefined;
          }
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`⬇️ DROP OP OPEN MAP: ${folder.name} (ID: ${folder.id})`);
        setIsDraggingOver(false);
        
        // Reset globalfolders
        // @ts-ignore - Custom property
        window._activeDropFolder = undefined;
        // @ts-ignore - Custom property
        window._openFolderHoverId = undefined;
        
        // Haal bestandsID op uit de drag data
        const fileId = e.dataTransfer.getData('text/plain');
        if (!fileId) {
          console.log('❌ Geen bestand-ID gevonden in drop data');
          return;
        }
        
        console.log(`📁 Bestand met ID ${fileId} gedropt op open map ${folder.id}`);
        
        // Verwerk de drop
        try {
          const fileIdNumber = parseInt(fileId);
          if (isNaN(fileIdNumber)) {
            console.error('❌ Ongeldige bestand-ID:', fileId);
            return;
          }
          
          // Toon visuele feedback
          setIsRefreshing(true);
          onSelectFile({
            id: fileIdNumber,
            name: "Bestand wordt verplaatst...",
            type: "placeholder",
            size: 0,
            dataUrl: "",
            position: { x: 0, y: 0 }
          });
          
          // Bereid de UI update voor
          const desktopFiles = queryClient.getQueryData<{files: DesktopFile[]}>(['/api/files']);
          
          if (desktopFiles?.files) {
            // Zoek het bestand dat verplaatst wordt
            const fileIndex = desktopFiles.files.findIndex(f => f.id === fileIdNumber);
            
            if (fileIndex >= 0) {
              // Kloon arrays om direct mutaties te voorkomen
              const updatedDesktopFiles = [...desktopFiles.files];
              const movedFile = {...updatedDesktopFiles[fileIndex]};
              
              // Update het bestand met de nieuwe parent map
              movedFile.parentId = folder.id;
              
              // Verwijder het bestand uit desktop view
              updatedDesktopFiles.splice(fileIndex, 1);
              
              // Update de cache voor desktop bestanden
              queryClient.setQueryData(['/api/files'], {
                files: updatedDesktopFiles
              });
              
              // Update de mapinhoud in de cache
              const folderFilesKey = [`/api/folders/${folder.id}/files`];
              let currentFolderFiles = queryClient.getQueryData<{files: DesktopFile[]}>(folderFilesKey)?.files || [];
              
              // Controleer of bestand al bestaat om duplicaten te voorkomen
              const fileExists = currentFolderFiles.some(f => f.id === fileIdNumber);
              
              if (!fileExists) {
                // Voeg alleen toe als het bestand nog niet in de map zit
                currentFolderFiles = [...currentFolderFiles, movedFile];
                
                // Update cache
                queryClient.setQueryData(folderFilesKey, {
                  files: currentFolderFiles
                });
                
                // Update lokale staat voor directe UI feedback
                setFiles(currentFolderFiles);
              }
              
              // Toon succes bericht
              toast({
                title: "Bestand verplaatst",
                description: `Bestand toegevoegd aan map "${folder.name}"`,
                duration: 2000
              });
              
              // Maak API call voor database update
              if (folder.id !== undefined) {
                // Roep API aan om bestand toe te voegen aan map
                addFileToFolder(fileIdNumber, folder.id)
                  .then(() => {
                    console.log(`✅ Bestand ${fileIdNumber} succesvol toegevoegd aan map ${folder.id}`);
                    
                    // Vernieuw beide caches om consistentie te garanderen
                    queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                    queryClient.invalidateQueries({ queryKey: folderFilesKey });
                    
                    // Haal nieuwe mapinhoud op via WebSocket als beschikbaar
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      console.log('🔄 WebSocket refresh request sent');
                      wsRef.current.send(JSON.stringify({
                        type: 'requestFolderRefresh',
                        folderId: folder.id,
                        timestamp: new Date().toISOString()
                      }));
                    } else {
                      // Fallback naar traditionele API als WebSocket niet beschikbaar is
                      console.log('🔄 Traditional fetch for folder contents');
                      fetchFiles();
                    }
                    
                    setIsRefreshing(false);
                  })
                  .catch(error => {
                    console.error("❌ Fout bij verplaatsen van bestand naar map:", error);
                    
                    // Toon foutmelding
                    toast({
                      title: "Fout bij verplaatsen",
                      description: "Kon het bestand niet naar de map verplaatsen",
                      variant: "destructive",
                      duration: 3000
                    });
                    
                    // Vernieuw data om visuele wijzigingen terug te draaien
                    fetchFiles();
                    queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                    
                    setIsRefreshing(false);
                  });
              }
            } else {
              console.error(`❌ Bestand ${fileIdNumber} niet gevonden in desktop bestanden`);
              setIsRefreshing(false);
            }
          } else {
            // Fallback naar directe API aanroep als cache niet beschikbaar is
            console.log('💾 Geen cache data beschikbaar, directe API aanroep');
            
            if (folder.id !== undefined) {
              addFileToFolder(fileIdNumber, folder.id)
                .then(() => {
                  toast({
                    title: "Bestand verplaatst",
                    description: `Bestand toegevoegd aan map "${folder.name}"`,
                    duration: 2000
                  });
                  
                  // Vernieuw alle data
                  fetchFiles();
                  queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                  setIsRefreshing(false);
                })
                .catch(error => {
                  console.error("❌ Fout bij verplaatsen van bestand naar map:", error);
                  toast({
                    title: "Fout bij verplaatsen",
                    description: "Kon het bestand niet naar de map verplaatsen",
                    variant: "destructive",
                    duration: 3000
                  });
                  setIsRefreshing(false);
                });
            }
          }
        } catch (error) {
          console.error("❌ Fout bij verwerken van drop:", error);
          setIsRefreshing(false);
        }
      }}
      >
        {/* Window header */}
        <div className="folder-header p-2 bg-primary/90 text-white flex items-center justify-between cursor-move">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            <span className="font-semibold">{folder.name}</span>
            {/* Badge with file count */}
            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
              {files.length} bestand{files.length !== 1 ? 'en' : ''}
            </span>
            
            {isRefreshing && (
              <div className="ml-2 flex items-center">
                <div className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full"></div>
                <span className="ml-1 text-xs text-white/80">Bijwerken...</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsRenameDialogOpen(true)}
              className="p-1 hover:bg-primary-300 rounded-md focus:outline-none"
              title="Map hernoemen"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setIsRefreshing(true);
                
                // WebSocket verzoek eerste proberen
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'requestFolderRefresh',
                    folderId: folder.id,
                    timestamp: new Date().toISOString()
                  }));
                  console.log(`🔄 WebSocket refresh request sent for folder ${folder.id}`);
                } else {
                  // Fallback naar traditionele API
                  console.log(`🔄 Traditional fetch for folder ${folder.id}`);
                  fetchFiles();
                }
                
                // Voor zekerheid ook een timeout voor het geval beide methoden falen
                setTimeout(() => {
                  if (isRefreshing) {
                    setIsRefreshing(false);
                  }
                }, 2000);
              }}
              className="p-1 hover:bg-primary-300 rounded-md focus:outline-none relative"
              title="Vernieuwen"
            >
              <ArrowLeft className="h-4 w-4 rotate-45" />
            </button>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-primary-300 rounded-md focus:outline-none"
              title="Sluiten"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Folder content area */}
        <div 
          className="p-4 relative bg-white/90"
          style={{ height: 'auto', maxHeight: '500px' }}
          ref={dropAreaRef}
        >
          {/* We gebruiken een compleet andere aanpak die niet afhankelijk is van conditionele rendering */}
          <div className="relative w-full h-full">
            {/* Loading overlay - absolute positioned */}
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
                <div className="animate-spin h-12 w-12 border-4 border-gray-300 border-t-primary rounded-full mb-4"></div>
                <p className="text-sm font-medium">Inhoud laden...</p>
              </div>
            )}
            
            {/* Empty state - only shown when not loading and no files */}
            {!isLoading && files.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <div className="mb-4 bg-gray-100 p-4 rounded-full">
                  <FileX className="w-12 h-12 opacity-30" />
                </div>
                <p className="text-lg font-medium mb-1">Map is leeg</p>
                <p className="text-sm mb-4">Sleep bestanden naar deze map</p>
              </div>
            )}
            
            {/* Files grid - volledig onafhankelijk van folder structuur */}
            <div className="files-container overflow-auto border border-gray-200 rounded-md mb-2" style={{
              height: '250px',
              maxHeight: '250px',
              width: '100%'
            }}>
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 auto-rows-max ${(isLoading || files.length === 0) ? 'opacity-0' : 'opacity-100'}`}>
                {files.map((file) => {
                  // Log alleen in ontwikkelomgeving
                  if (process.env.NODE_ENV === 'development') {
                    // Gebruik console.log buiten JSX
                    console.log(`🔍 RENDERING FILE: ${file.id} - ${file.name}`);
                  }
                  
                  return (
                    <div 
                      key={file.id}
                      className={`file-container rounded-lg p-1 ${selectedFileIds.includes(file.id || 0) ? 'bg-blue-50 border border-blue-200 shadow-sm' : ''}`}
                      style={{ width: '100%', maxWidth: '100%' }}
                      onClick={() => {
                        // Selecteer het bestand bij klikken
                        setSelectedFileIds(prev => 
                          prev.includes(file.id || 0) 
                            ? prev.filter(id => id !== file.id) 
                            : [...prev, file.id || 0]
                        );
                      }}
                      onDoubleClick={() => {
                        // Preview het bestand bij dubbelklikken
                        onSelectFile(file);
                      }}
                    >
                      {/* Volledig losgekoppelde component voor files in folders */}
                      <DraggableFolderItem 
                        file={file} 
                        parentFolderId={folder.id}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Force manual file debug here */}
            <div className="hidden">
              Debug info: {files.length > 0 ? `Files: ${files.map(f => f.name).join(', ')}` : 'No files'}
            </div>
          </div>
        </div>
      </div>

      {/* Rename dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Mapnaam wijzigen</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              id="folder-name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Mapnaam"
              className="col-span-2"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setNewFolderName(folder.name);
                setIsRenameDialogOpen(false);
              }}
            >
              Annuleren
            </Button>
            <Button 
              onClick={() => {
                if (folder.id && onRename && newFolderName.trim()) {
                  onRename(folder.id, newFolderName);
                  setIsRenameDialogOpen(false);
                }
              }}
              disabled={!newFolderName.trim() || newFolderName === folder.name}
            >
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}