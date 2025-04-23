import { useState, useEffect, useRef } from 'react';
import { FileItem } from './FileItem';
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
  
  // Files ophalen voor deze map
  const fetchFiles = async () => {
    if (!folder.id) return;
    
    console.log(`🔄 LOADING: Bestanden ophalen voor map ${folder.name} (ID: ${folder.id})`);
    
    try {
      setIsRefreshing(true);
      const folderFilesKey = [`/api/folders/${folder.id}/files`];
      
      // Haal altijd verse data op van de API
      const response = await fetch(`/api/folders/${folder.id}/files`);
      if (!response.ok) throw new Error('Failed to fetch folder files');
      
      const data = await response.json();
      
      console.log(`📂 FOLDER ${folder.id} DATA FETCHED: ${data.files.length} bestanden gevonden`);
      
      // Update het cachegeheugen
      queryClient.setQueryData(folderFilesKey, data);
      
      // Zet de bestanden in de lokale staat
      setFiles(data.files);
      
      // Log voor debug
      if (data.files.length > 0) {
        console.log(`📄 FOLDER BEVAT: ${data.files.map((f: any) => f.name).join(', ')}`);
      } else {
        console.log(`📄 FOLDER IS LEEG`);
      }
      
      return data.files;
    } catch (err) {
      console.error("❌ FOUT bij ophalen mapinhoud:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      
      toast({
        title: "Fout",
        description: "Kon de inhoud van de map niet laden",
        variant: "destructive"
      });
      return [];
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
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
          setFiles(data.files);
          setIsLoading(false);
          setIsRefreshing(false);
          
          // Update cache voor consistentie
          queryClient.setQueryData([`/api/folders/${folder.id}/files`], { files: data.files });
          
        } else if (data.type === 'folderUpdate' && data.folderId === folder.id) {
          console.log(`🔄 WebSocket: Mapupdate ontvangen voor ${folder.id}`);
          setFiles(data.files);
          
          // Update cache voor consistentie
          queryClient.setQueryData([`/api/folders/${folder.id}/files`], { files: data.files });
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
  
  // Handle the window/folder dragging
  useEffect(() => {
    const handleHeaderMouseDown = (e: MouseEvent) => {
      // Only proceed if target is folder header
      const target = e.target as HTMLElement;
      const folderHeader = document.querySelector(`#folder-window-${folder.id} .folder-header`);
      
      // Check if click was in folder header or its children
      if (folderHeader && (folderHeader === target || folderHeader.contains(target))) {
        setDragging(true);
        
        // Calculate offset so the drag starts from where the mouse is
        const rect = document.getElementById(`folder-window-${folder.id}`)?.getBoundingClientRect();
        if (rect) {
          setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          });
        }
        
        e.preventDefault();
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (dragging) {
        // Voorkom dat de map buiten het scherm kan worden gesleept
        const newX = Math.max(0, e.clientX - dragOffset.x);
        const newY = Math.max(0, e.clientY - dragOffset.y);
        
        // Update de lokale positie voor directe visuele feedback
        setLocalPosition({
          x: newX,
          y: newY
        });
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (dragging) {
        setDragging(false);
        
        // Bereken de uiteindelijke positie bij loslaten
        const finalX = Math.max(0, e.clientX - dragOffset.x);
        const finalY = Math.max(0, e.clientY - dragOffset.y);
        
        // Update de lokale positie met de definitieve waarden
        setLocalPosition({
          x: finalX,
          y: finalY
        });
        
        // Update the server with the new position
        if (folder.id) {
          console.log(`Updating folder ${folder.id} position to:`, { x: finalX, y: finalY });
          
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
            setLocalPosition(folder.position);
          });
        }
      }
    };
    
    document.addEventListener('mousedown', handleHeaderMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousedown', handleHeaderMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
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
        width: folder.dimensions?.width || 600,
        height: folder.dimensions?.height || 400,
        left: localPosition.x,
        top: localPosition.y,
        zIndex: dragging ? 1000 : 30, // Higher when dragging, lower when static but still allow files to be visible above
        transition: dragging ? 'none' : 'all 0.15s ease'
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
        
        const fileId = e.dataTransfer.getData('text/plain');
        if (!fileId) return;
        
        console.log(`📁 Bestand met ID ${fileId} gedropt op open map ${folder.id}`);
        
        // Immediately update UI for instant feedback
        try {
          const fileIdNumber = parseInt(fileId);
          if (!isNaN(fileIdNumber)) {
            // Show visual feedback
            onSelectFile({
              id: fileIdNumber,
              name: "Moving file...",
              type: "placeholder",
              size: 0,
              dataUrl: "",
              position: { x: 0, y: 0 }
            });
            
            // Instant visual update
            const desktopFiles = queryClient.getQueryData<{files: DesktopFile[]}>(['/api/files']);
            if (desktopFiles?.files) {
              // Find the file that's being moved
              const fileIndex = desktopFiles.files.findIndex(f => f.id === fileIdNumber);
              
              if (fileIndex >= 0) {
                // Clone the files array to avoid mutating the cache directly
                const updatedFiles = [...desktopFiles.files];
                const movedFile = {...updatedFiles[fileIndex]};
                
                // Update the file's parentId to the folder's ID
                movedFile.parentId = folder.id;
                
                // Remove the file from desktop view immediately
                updatedFiles.splice(fileIndex, 1);
                
                // Update the cache with the file removed from desktop
                queryClient.setQueryData(['/api/files'], {
                  files: updatedFiles
                });
                
                // Get folder contents and add the file there
                const folderFilesKey = [`/api/folders/${folder.id}/files`];
                const folderContents = queryClient.getQueryData<{files: DesktopFile[]}>(folderFilesKey) || {files: []};
                
                // Check if file already exists in this folder to avoid duplicates
                const fileExists = folderContents.files.some(f => f.id === fileIdNumber);
                
                if (!fileExists) {
                  // Update folder contents cache immediately
                  queryClient.setQueryData(folderFilesKey, {
                    files: [...folderContents.files, movedFile]
                  });
                  
                  // Also directly update the visible UI with React state
                  setFiles(prevFiles => {
                    // Check if file already exists in state to avoid duplicates
                    const alreadyExists = prevFiles.some(f => f.id === fileIdNumber);
                    if (alreadyExists) return prevFiles;
                    return [...prevFiles, movedFile];
                  });
                }
                
                // Show success toast
                toast({
                  title: "Bestand verplaatst",
                  description: `Bestand toegevoegd aan "${folder.name}"`,
                  duration: 2000
                });
                
                // Then make the actual API call to update the database
                if (folder.id !== undefined) {
                  addFileToFolder(fileIdNumber, folder.id)
                    .then(() => {
                      console.log("✅ Database updated to match UI");
                      
                      // Force refresh both folder content and desktop files for consistency
                      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                      queryClient.invalidateQueries({ queryKey: [`/api/folders/${folder.id}/files`] });
                      
                      // Refetch files to ensure consistency
                      setTimeout(() => {
                        fetchFiles();
                      }, 100);
                    })
                    .catch(error => {
                      console.error("Error moving file to folder:", error);
                      // Show error and revert the visual changes
                      toast({
                        title: "Error",
                        description: "Failed to move file to folder",
                        variant: "destructive",
                        duration: 3000
                      });
                      // Refresh to revert visual changes
                      fetchFiles();
                    });
                }
              }
            } else {
              // Fallback to direct API call if we don't have cache data
              if (folder.id !== undefined) {
                addFileToFolder(fileIdNumber, folder.id)
                  .then(() => {
                    toast({
                      title: "Bestand verplaatst",
                      description: `Bestand toegevoegd aan "${folder.name}"`,
                      duration: 2000
                    });
                    // Refetch all data
                    fetchFiles();
                    queryClient.invalidateQueries({ queryKey: ['/api/files'] });
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
          }
        } catch (error) {
          console.error("Error processing drop:", error);
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
              onClick={() => fetchFiles()}
              className="p-1 hover:bg-primary-300 rounded-md focus:outline-none"
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
          className="p-4 h-[calc(100%-48px)] overflow-auto bg-white/90"
          ref={dropAreaRef}
        >
          {files.length === 0 && !isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <div className="mb-4 bg-gray-100 p-4 rounded-full">
                <FileX className="w-12 h-12 opacity-30" />
              </div>
              <p className="text-lg font-medium mb-1">Map is leeg</p>
              <p className="text-sm mb-4">Sleep bestanden naar deze map</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4 auto-rows-max">
              {files.map((file) => (
                <FileItem
                  key={file.id}
                  file={file}
                  index={file.id || 0}
                  isSelected={selectedFileIds.includes(file.id || 0)}
                  onSelect={() => {
                    setSelectedFileIds(prev => 
                      prev.includes(file.id || 0) 
                        ? prev.filter(id => id !== file.id) 
                        : [...prev, file.id || 0]
                    );
                  }}
                  onDragEnd={(id, x, y) => {
                    // Handle dragging inside folder (rearrangement) if needed
                  }}
                  onPreview={() => {
                    // Handle previewing file
                    onSelectFile(file);
                  }}
                  onRename={onRename}
                />
              ))}
            </div>
          )}
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