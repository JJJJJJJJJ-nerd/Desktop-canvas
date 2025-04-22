import { useState, useEffect, useRef } from 'react';
import { FileItem } from './FileItem';
import { DesktopFile } from '@/types';
import { X, FolderOpen, ArrowLeft, Upload, Check, Folder, MoveRight, FileX, Edit } from 'lucide-react';
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
  const [files, setFiles] = useState<DesktopFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  
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

  // Handle drag over events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Set dropEffect to 'move' to indicate this is a valid drop target
    e.dataTransfer.dropEffect = 'move';

    console.log('🔍 Open folder drag over event triggered', { 
      folderId: folder.id, 
      folderName: folder.name,
      x: e.clientX,
      y: e.clientY,
      dataTypes: e.dataTransfer.types,
      eventType: 'dragover',
      element: 'FolderView'
    });
    
    // BELANGRIJK: Check of de dataTransfer informatie bevat
    console.log('🔄 DATA TRANSFER TYPES:', Array.from(e.dataTransfer.types));
    
    // Probeer de text/plain data te lezen tijdens drag
    try {
      // Let op: dit kan alleen in de drop handler, niet in dragover
      // Maar we kunnen wel de draggedFileInfo global gebruiken
      
      // @ts-ignore - Custom property
      if (window.draggedFileInfo && window.draggedFileInfo.id) {
        // @ts-ignore - Custom property
        console.log(`🔍 DESKTOP → FOLDER: Bestand met ID ${window.draggedFileInfo.id} (${window.draggedFileInfo.name}) wordt over map ${folder.name} gesleept`);
      }
    } catch (error) {
      console.error('Error tijdens dragover event:', error);
    }

    // Setup global tracking of open folder - this is the MOST IMPORTANT part
    if (folder.id) {
      // Set this folder ID globally so it can be detected by other components
      // @ts-ignore - Custom property
      window._activeDropFolder = {
        id: folder.id,
        name: folder.name,
        element: dropAreaRef.current,
        timestamp: Date.now()
      };
      
      // @ts-ignore - Custom property for backward compatibility
      window._openFolderHoverId = folder.id;
      
      console.log(`✓ FOLDER READY: Open folder ${folder.name} (ID: ${folder.id}) is now ready to receive files`);
      
      // Force the dragging over state to true when ANY drag happens over the folder
      if (!isDraggingOver) {
        setIsDraggingOver(true);
        console.log(`🎯 DROP TARGET ACTIVE: Folder ${folder.name} is now highlighted as drop target`);
      }
    }
  };

  // Handle drag leave events
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // We need to check if we're truly leaving the dropzone or just entering a child element
    // This helps prevent flickering when moving over child elements
    setTimeout(() => {
      // If the related target is not a child of the folder content area
      if (!dropAreaRef.current?.contains(e.relatedTarget as Node)) {
        console.log(`⬅️ DRAG LEAVE: File being dragged has left folder ${folder.name}`);
        setIsDraggingOver(false);
        
        // Clear the folder hover ID when truly leaving
        // @ts-ignore - Custom property
        if (window._activeDropFolder?.id === folder.id) {
          console.log(`❌ CLEARING DROP TARGET: Folder ${folder.name} is no longer a drop target`);
          // @ts-ignore - Custom property
          window._activeDropFolder = undefined;
          // @ts-ignore - Custom property for backward compatibility
          window._openFolderHoverId = undefined;
        }
      }
    }, 50); // Small delay to ensure we're not just moving between child elements
  };

  // Handle drop events
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    
    console.log(`🎯 DROP SUCCESS: File dropped into folder ${folder.name} (ID: ${folder.id})`);
    
    // Clear all folder hover tracking
    // @ts-ignore - Custom property
    window._activeDropFolder = undefined;
    // @ts-ignore - Custom property for backward compatibility
    window._openFolderHoverId = undefined;
    
    console.log("Drop event in folder view:", folder.name, folder.id);
    console.log("Drop data types:", Array.from(e.dataTransfer.types));
    
    // BELANGRIJK: Debug informatie voor drag-drop operatie
    console.log(`📝 BESTANDSVERPLAATSING: Drop event in map ${folder.name} (ID: ${folder.id})`);
    
    // Check de globale drag info
    // @ts-ignore - Custom property
    if (window.draggedFileInfo) {
      // @ts-ignore - Custom property
      console.log(`📋 DRAG INFO: Bestand ${window.draggedFileInfo.name} (ID: ${window.draggedFileInfo.id}) is verplaatst.`);
      
      // Extra nuttige debug info
      const dragDuration = Date.now() - (
        // @ts-ignore - Custom property
        window.draggedFileInfo.startTime || Date.now()
      );
      console.log(`⏱️ DRAG DUUR: ${dragDuration}ms`);
    }
    
    // Try to get a dragged fileId first
    const fileIdText = e.dataTransfer.getData('text/plain');
    if (fileIdText && folder.id) {
      try {
        const fileId = parseInt(fileIdText);
        if (!isNaN(fileId)) {
          console.log(`🔄 Processing file ID drop: ${fileId} into folder ${folder.id}`);
          
          const allDesktopFiles = queryClient.getQueryData<any>(['/api/files'])?.files || [];
          const draggedFile = allDesktopFiles.find((file: any) => file.id === fileId);
          
          if (draggedFile) {
            // Check if the file is already in a folder (including this one)
            if (draggedFile.parentId) {
              console.log(`Bestand zit al in map ${draggedFile.parentId}, eerst verwijderen`);
              await removeFileFromFolder(fileId);
            }
            
            console.log(`Toevoegen van bestand ${draggedFile.name} aan map ${folder.name} (${folder.id})`);
            const result = await addFileToFolder(fileId, folder.id);
            
            toast({
              title: "Bestand toegevoegd aan map",
              description: `"${draggedFile.name}" is toegevoegd aan map "${folder.name}"`,
              duration: 3000,
            });
            
            // Refresh both views - this is critical
            fetchFiles();
            queryClient.invalidateQueries({ queryKey: ['/api/files'] });
            
            return;
          }
        }
      } catch (error) {
        console.error("Error moving file to folder:", error);
      }
    }
    
    // If no file ID was found, check for file uploads
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Handle dropped files (upload)
      const formData = new FormData();
      Array.from(e.dataTransfer.files).forEach((file) => {
        formData.append('files', file);
      });
      
      try {
        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Failed to upload files');
        }
        
        const data = await response.json();
        
        // Toon een succes toast
        toast({
          title: "Bestanden geüpload",
          description: `De bestanden zijn succesvol geüpload naar map "${folder.name}"`,
          duration: 3000,
        });
        
        // Move newly uploaded files to this folder
        if (data.files && data.files.length > 0) {
          for (const file of data.files) {
            if (file.id && folder.id) {
              await addFileToFolder(file.id, folder.id);
            }
          }
          
          // Refresh folder contents
          fetchFiles();
        }
      } catch (error) {
        console.error('Error uploading files:', error);
      }
    }
  };
  
  // We gebruiken nu de addFileToFolder functie uit de hook

  // Fetch files in the folder
  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/folders/${folder.id}/files`);
      if (!response.ok) {
        throw new Error('Failed to fetch folder contents');
      }
      const data = await response.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      console.error('Error fetching folder contents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch all external files (files not in this folder)
  const fetchExternalFiles = async () => {
    try {
      const response = await fetch('/api/files');
      if (!response.ok) {
        throw new Error('Failed to fetch external files');
      }
      const data = await response.json();
      
      console.log('All files from API:', data.files);
      console.log('Current folder ID:', folder.id);
      
      // Filter to include only files that:
      // 1. Aren't in this folder already
      // 2. Aren't folders themselves
      const externalFilesOnly = data.files.filter((file: DesktopFile) => {
        // Make sure file has an ID
        if (!file.id) {
          console.log('Skipping file with no ID:', file);
          return false;
        }
        
        // Skip folders by checking type or name
        const isFolder = (
          String(file.isFolder) === 'true' || 
          file.type === 'application/folder' ||
          file.name.endsWith('.folder')
        );
        
        if (isFolder) {
          console.log('Skipping folder:', file.name, file);
          return false;
        }
        
        // Skip files that are already in this folder
        if (file.parentId === folder.id) {
          console.log('Skipping file already in folder:', file.name, file);
          return false;
        }
        
        console.log('Including file:', file.name, file);
        // Include all other files
        return true;
      });
      
      console.log('Filtered external files:', externalFilesOnly);
      setExternalFiles(externalFilesOnly);
    } catch (error) {
      console.error('Error fetching external files:', error);
    }
  };
  
  // Toggle select mode
  const toggleSelectMode = () => {
    // If turning on select mode, fetch external files first
    if (!isSelectMode) {
      fetchExternalFiles();
    } else {
      // If turning off select mode, clear selected files
      setSelectedFileIds([]);
    }
    
    setIsSelectMode(!isSelectMode);
  };
  
  // Toggle file selection
  const toggleFileSelection = (fileId: number) => {
    setSelectedFileIds(prev => {
      if (prev.includes(fileId)) {
        return prev.filter(id => id !== fileId);
      } else {
        return [...prev, fileId];
      }
    });
  };
  
  // Move selected files to this folder
  const moveSelectedFilesToFolder = async () => {
    if (selectedFileIds.length === 0 || !folder.id) return;
    
    try {
      // Add each selected file to this folder
      for (const fileId of selectedFileIds) {
        await addFileToFolder(fileId, folder.id);
      }
      
      // Refresh folder contents and desktop view
      fetchFiles();
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      
      // Exit select mode
      setIsSelectMode(false);
      setSelectedFileIds([]);
    } catch (error) {
      console.error('Error moving files to folder:', error);
    }
  };

  // Handle opening the rename dialog
  const handleRenameClick = () => {
    setNewFolderName(folder.name);
    setIsRenameDialogOpen(true);
  };
  
  // Handle the rename dialog submission
  const handleRenameSubmit = () => {
    if (folder.id && onRename && newFolderName.trim() !== "") {
      onRename(folder.id, newFolderName.trim());
      setIsRenameDialogOpen(false);
    }
  };
  
  // Initial fetch of files
  useEffect(() => {
    if (folder.id) {
      fetchFiles();
    }
  }, [folder.id]);

  // State and refs for dragging folder
  const [dragging, setDragging] = useState(false);
  const [localPosition, setLocalPosition] = useState({ x: folder.position.x, y: folder.position.y });
  const startPosRef = useRef({ x: 0, y: 0 });
  const currentPosition = useRef({ x: folder.position.x, y: folder.position.y });
  const headerRef = useRef<HTMLDivElement>(null);
  const initialClick = useRef<{x: number, y: number} | null>(null);
  const isClick = useRef<boolean>(true);
  
  // Handle mouse down on folder header for dragging
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // Only respond to left mouse button
    if (e.button !== 0) return;
    
    // Prevent default browser behavior and stop event propagation
    e.stopPropagation();
    e.preventDefault();
    
    // Save the initial click position for later comparison
    initialClick.current = { x: e.clientX, y: e.clientY };
    isClick.current = true;
    
    // Calculate offset between mouse position and element top-left corner
    startPosRef.current = {
      x: e.clientX - localPosition.x,
      y: e.clientY - localPosition.y
    };
    
    // Store current position for reference
    currentPosition.current = localPosition;
    
    // Add document-level event listeners
    document.addEventListener('mousemove', handleHeaderMouseMove);
    document.addEventListener('mouseup', handleHeaderMouseUp);
  };
  
  // Handle mouse movement during drag
  const handleHeaderMouseMove = (e: MouseEvent) => {
    // Prevent any default browser behavior
    e.preventDefault();
    
    // If we moved enough to consider this a drag (not a click)
    if (initialClick.current) {
      const moveThreshold = 2; // pixels for responsive dragging
      const deltaX = Math.abs(e.clientX - initialClick.current.x);
      const deltaY = Math.abs(e.clientY - initialClick.current.y);
      
      // If we moved enough, consider this a drag
      if (deltaX > moveThreshold || deltaY > moveThreshold) {
        // No longer a click - it's a drag
        isClick.current = false;
        
        // Start dragging immediately upon movement
        if (!dragging) {
          setDragging(true);
        }
        
        // Calculate new position - ensure it stays within visible area
        const newX = Math.max(0, e.clientX - startPosRef.current.x);
        const newY = Math.max(0, e.clientY - startPosRef.current.y);
        
        // Update current position ref first (without causing re-renders)
        currentPosition.current = { x: newX, y: newY };
        
        // Use requestAnimationFrame for smoother dragging
        window.requestAnimationFrame(() => {
          setLocalPosition(currentPosition.current);
        });
      }
    }
  };
  
  // Handle mouse up - end dragging or handle click
  const handleHeaderMouseUp = async (e: MouseEvent) => {
    // Prevent default behavior
    e.preventDefault();
    
    // Clean up after a drag operation
    if (!isClick.current && dragging && folder.id) {
      // Update the folder position in the database
      try {
        const response = await fetch(`/api/files/${folder.id}/position`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            position: { 
              x: currentPosition.current.x, 
              y: currentPosition.current.y 
            } 
          }),
        });
        
        if (!response.ok) {
          console.error('Failed to update folder position');
        }
      } catch (error) {
        console.error('Error updating folder position:', error);
      }
      
      setDragging(false);
    }
    
    // Reset tracking variables
    initialClick.current = null;
    isClick.current = true;
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleHeaderMouseMove);
    document.removeEventListener('mouseup', handleHeaderMouseUp);
  };

  // EXTREEM DIRECTE OPLOSSING - Maakt alle open mappen tot dropzones
  useEffect(() => {
    // Plaats deze map in een globale lijst van beschikbare drop targets
    console.log(`📂 Open map registreren als drop target: ${folder.name} (ID: ${folder.id})`);
    
    // @ts-ignore - Custom property
    if (!window._openFolders) {
      // @ts-ignore - Custom property
      window._openFolders = {};
    }
    
    // @ts-ignore - Custom property - Registreer deze map
    window._openFolders[folder.id] = {
      id: folder.id,
      name: folder.name,
      element: document.getElementById(`folder-window-${folder.id}`),
      isOpen: true,
      timestamp: Date.now()
    };
    
    // Toon een grote groene knop onder in de map om als drop zone te dienen
    const folderElement = document.getElementById(`folder-window-${folder.id}`);
    
    // Schoonmaken bij unmount
    return () => {
      // @ts-ignore - Custom property
      if (window._openFolders && window._openFolders[folder.id]) {
        // @ts-ignore - Custom property - Verwijderen bij unmount
        delete window._openFolders[folder.id];
      }
    };
  }, [folder.id, folder.name]);
  
  // Add global mouse tracking for better folder drop detection
  useEffect(() => {
    // Wait until DOM has been rendered
    const timeoutId = setTimeout(() => {
      const folderElement = document.getElementById(`folder-window-${folder.id}`);
      if (!folderElement) return;
      
      // Create a visible drop indicator that appears when dragging
      const dropIndicator = document.createElement('div');
      dropIndicator.className = 'central-dropzone'; // Using our enhanced central dropzone style
      dropIndicator.innerHTML = `
        <div class="flex items-center justify-center mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            <path d="M12 11v6"></path>
            <path d="m9 14 3 3 3-3"></path>
          </svg>
        </div>
        <p class="text-green-700 font-medium text-sm text-center mb-1">Drop files here</p>
        <p class="text-green-600/75 text-xs text-center">Files will be moved to this folder</p>
      `;
      
      // Add the drop indicator to the folder window
      folderElement.appendChild(dropIndicator);
      
      // Enhanced mouse movement tracking to reliably detect when cursor is over an open folder
      const handleMouseMove = (e: MouseEvent) => {
        // Only process if we're currently dragging a file
        // @ts-ignore - Custom property for global tracking
        const dragInfo = window.draggedFileInfo;
        if (!dragInfo) return;
        
        // Skip if we're dragging a folder into itself (prevents loops)
        if (dragInfo.isFolder && dragInfo.id === folder.id) return;
        
        // Check if mouse is inside this folder's bounds with increased precision
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
          dropIndicator.classList.add('active');
          folderElement.classList.add('folder-highlight-dragover');
          setIsDraggingOver(true);
          
          // Store this folder as the global active target for files
          // This is crucial for other components to know where a file will be dropped
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
          dropIndicator.classList.remove('active');
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
      
      // Handle drop events on the whole folder window
      const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        dropIndicator.classList.remove('active');
        folderElement.classList.remove('folder-highlight-dragover');
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
            
            // Call the API to move the file
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
        } catch (error) {
          console.error("Error processing drop:", error);
        }
      };
      
      // Add event listeners
      document.addEventListener('mousemove', handleMouseMove);
      folderElement.addEventListener('drop', handleDrop);
      folderElement.addEventListener('dragover', e => {
        e.preventDefault(); 
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
      });
      
      // Clean up when component unmounts
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        folderElement.removeEventListener('drop', handleDrop);
        folderElement.removeEventListener('dragover', e => e.preventDefault());
        
        if (folderElement.contains(dropIndicator)) {
          folderElement.removeChild(dropIndicator);
        }
      };
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [folder.id, folder.name, addFileToFolder, fetchFiles, onSelectFile, toast]);

  return (
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
        
        // @ts-ignore - Voor backward compatibility
        window._openFolderHoverId = folder.id;
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`🔴 DRAG LEAVE OPEN MAP: ${folder.name}`);
        setIsDraggingOver(false);
        
        // @ts-ignore - Custom property
        if (window._activeDropFolder?.id === folder.id) {
          // @ts-ignore - Custom property
          window._activeDropFolder = undefined;
          // @ts-ignore - Custom property
          window._openFolderHoverId = undefined;
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
        
        // Voeg het bestand toe aan deze map
        try {
          const fileIdNumber = parseInt(fileId);
          if (!isNaN(fileIdNumber)) {
            // Roep de add-to-folder API aan
            onSelectFile({
              id: fileIdNumber,
              name: "Moving file...",
              type: "placeholder",
              size: 0,
              dataUrl: "",
              position: { x: 0, y: 0 }
            });
            
            // Gebruik addFileToFolder functie die via useDesktopFiles is geïmporteerd
            // Dit heeft toegang tot de backend API om bestanden aan mappen toe te voegen
            if (folder.id !== undefined) {
              addFileToFolder(fileIdNumber, folder.id);
            }
          }
        } catch (error) {
          console.error('Error adding file to folder:', error);
        }
      }}
    >
      {/* Window header */}
      <div 
        ref={headerRef}
        className="bg-primary/90 text-white py-2 px-3 flex items-center justify-between cursor-move"
        onMouseDown={handleHeaderMouseDown}
      >
        <div 
          className="flex items-center space-x-2 cursor-pointer" 
          onContextMenu={(e) => {
            e.preventDefault();
            handleRenameClick();
          }}
        >
          <FolderOpen className="w-5 h-5" />
          <h3 className="font-medium text-sm">{folder.name}</h3>
        </div>
        <div className="flex items-center space-x-2">
          {isSelectMode && selectedFileIds.length > 0 && (
            <Button 
              size="sm" 
              variant="secondary"
              className="py-0.5 h-8 bg-green-600 hover:bg-green-700 text-white"
              onClick={moveSelectedFilesToFolder}
            >
              <MoveRight className="w-3 h-3 mr-1" />
              Move Files ({selectedFileIds.length})
            </Button>
          )}
          
          <Button 
            size="sm" 
            variant="ghost"
            className={`py-0.5 h-8 ${isSelectMode ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'text-white/80 hover:text-white hover:bg-primary-600'}`}
            onClick={toggleSelectMode}
          >
            {isSelectMode ? (
              <>
                <X className="w-3 h-3 mr-1" />
                Cancel
              </>
            ) : (
              <>
                <MoveRight className="w-3 h-3 mr-1" />
                Move Files
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="py-0.5 h-8 text-white/80 hover:text-white hover:bg-primary-600"
            onClick={handleRenameClick}
          >
            <Edit className="w-3 h-3 mr-1" />
            Rename
          </Button>
          
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Window content */}
      <div 
        ref={dropAreaRef}
        className={`p-4 h-[calc(100%-40px)] overflow-auto ${
          isDraggingOver ? 'bg-green-100/60 ring-2 ring-green-500/60 ring-inset backdrop-blur-sm transition-all duration-200' : 'transition-all duration-200'
        }`}
        onDragOver={!isSelectMode ? handleDragOver : undefined}
        onDragLeave={!isSelectMode ? handleDragLeave : undefined}
        onDrop={!isSelectMode ? handleDrop : undefined}
        style={{ 
          // zIndex blijft laag om bestanden zichtbaar te houden tijdens sleep
          zIndex: 10, // Lagere z-index zodat bestanden zichtbaar blijven tijdens sleep
          boxShadow: isDraggingOver ? 'inset 0 0 20px rgba(34, 197, 94, 0.4)' : 'none'
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin border-2 border-primary/20 border-t-primary rounded-full w-6 h-6"></div>
            <span className="ml-2 text-gray-600">Loading folder contents...</span>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center py-4">
            <p>Error loading folder contents.</p>
            <button 
              className="mt-2 px-3 py-1 bg-primary/90 text-white rounded hover:bg-primary transition-colors text-sm"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        ) : isSelectMode ? (
          // Selection mode - show files from desktop that can be moved here
          <>
            {externalFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <div className="flex items-center mb-2 text-gray-400">
                    <MoveRight className="w-8 h-8 mr-1 opacity-30" />
                    <FileX className="w-12 h-12 opacity-30" />
                  </div>
                  <p>No files available to move</p>
                  <p className="text-xs mt-2 text-gray-400">All files are already in this folder or there are no files on the desktop</p>
                  <button 
                    onClick={() => setIsSelectMode(false)}
                    className="mt-4 px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 text-gray-600 text-sm flex items-center"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Cancel selection
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-3 bg-blue-50 p-3 rounded-md text-sm">
                  <p className="text-blue-800 flex items-center">
                    <MoveRight className="w-4 h-4 mr-1" />
                    Select files to move to this folder. Files will blink until selected.
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {externalFiles.map((file) => (
                    <div 
                      key={file.id} 
                      className={cn(
                        "file-item flex flex-col items-center justify-center p-2 rounded cursor-pointer transition-colors relative",
                        selectedFileIds.includes(file.id!) ? "bg-green-100 ring-2 ring-green-400" : "hover:bg-gray-100 file-blink"
                      )}
                      onClick={() => file.id && toggleFileSelection(file.id)}
                    >
                      <FileItemPreview file={file} />
                      <p className="text-xs font-medium mt-1 text-center truncate w-full">{file.name}</p>
                      
                      {/* Selection checkmark */}
                      {selectedFileIds.includes(file.id!) && (
                        <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : files.length === 0 ? (
          // Empty folder view
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FolderOpen className="w-12 h-12 mb-2 opacity-30" />
            <p>This folder is empty</p>
            <p className="text-xs mt-2 text-gray-400">Drag and drop files here or use the Move Files button</p>
            <div className="flex gap-2 mt-4">
              <div className="p-2 border-2 border-dashed border-gray-300 rounded-lg">
                <MoveRight className="w-6 h-6 text-gray-400" />
              </div>
              <div className="p-2 border-2 border-dashed border-gray-300 rounded-lg">
                <Upload className="w-6 h-6 text-gray-400" />
              </div>
            </div>
          </div>
        ) : (
          // Normal folder view with files
          <div 
            className="grid grid-cols-4 gap-4" 
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Toon hier een visuele indicator dat je files kunt verplaatsen binnen de folder
              setIsDraggingOver(true);
              
              // Set cursor style to indicate drop is possible
              e.dataTransfer.dropEffect = 'move';
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
            }}
            onDrop={(e) => {
              // Voorkomen van default browser gedrag
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingOver(false);
              
              // Haal het file ID op uit de data transfer
              const fileId = e.dataTransfer.getData('text/plain');
              if (!fileId) return;
              
              console.log(`🎯 Bestand met ID ${fileId} is losgelaten in de folder met ID ${folder.id}`);
              
              // Als het bestand al in deze map zit, opnieuw positioneren
              const draggedFile = files.find(f => f.id === parseInt(fileId));
              if (draggedFile) {
                console.log(`📍 Bestand wordt intern verplaatst binnen dezelfde map`);
                
                // Hier kan je het bestand verplaatsen binnen de folder zelf
                // Voor een eenvoudige implementatie, doen we nog niets hiermee
                // Hier zou je bijvoorbeeld grid-coordinaten kunnen updaten
                
                toast({
                  title: "Positionering binnen map",
                  description: "Je kunt bestanden opnieuw ordenen binnen een map, deze functie komt binnenkort.",
                  duration: 3000,
                });
                
                return;
              }
              
              // Anders, het bestand toevoegen aan de map
              if (folder.id) {
                const parsedFileId = parseInt(fileId);
                const folderId = folder.id;
                
                addFileToFolder(parsedFileId, folderId)
                  .then(() => {
                    // Vernieuwen van maphoud
                    toast({
                      title: "Bestand toegevoegd",
                      description: "Bestand is toegevoegd aan de map.",
                      duration: 3000,
                    });
                    
                    // Vernieuwen van mapinhoud
                    fetchFiles();
                  })
                  .catch(err => {
                    console.error('Fout bij toevoegen van bestand aan map:', err);
                    toast({
                      title: "Fout",
                      description: "Er ging iets mis bij het toevoegen van het bestand aan de map.",
                      variant: "destructive",
                      duration: 3000,
                    });
                  });
              }
            }}
          >
            {files.map((file) => (
              <div 
                key={file.id} 
                className="file-item flex flex-col items-center justify-center p-2 rounded hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => onSelectFile(file)}
                draggable="true"
                onDragStart={(e) => {
                  if (file.id) {
                    e.dataTransfer.setData('text/plain', file.id.toString());
                    e.dataTransfer.effectAllowed = 'move';
                    // Add class to show we're dragging with consistent styling
                    e.currentTarget.classList.add('opacity-50');
                    
                    // Set up global drag tracking
                    // @ts-ignore - Custom property
                    window.draggedFileInfo = {
                      id: file.id,
                      name: file.name,
                      isFolder: false,
                      fromFolder: true,  // Markeer dat dit bestand uit een map komt
                      parentFolderId: folder.id  // Bewaar de huidige map ID
                    };
                    
                    console.log(`📤 DRAG START vanuit map: Bestand ${file.name} (ID: ${file.id}) wordt gesleept uit map ${folder.name}`);
                  }
                }}
                onDragEnd={(e) => {
                  // Remove the opacity class when drag ends
                  e.currentTarget.classList.remove('opacity-50');
                  
                  // Als het bestand boven het desktop gebied werd losgelaten, verwijderen we het uit de map
                  // @ts-ignore - Custom property
                  if (window._draggingFileToDesktop && file.id) {
                    console.log(`📤 DRAG TO DESKTOP: File ${file.name} (ID: ${file.id}) wordt naar bureaublad gesleept`);
                    
                    // Bepaal de positie waar het bestand zou moeten komen
                    // Gebruik bij voorkeur de laatst bekende positie op het bureaublad (veel nauwkeuriger)
                    // @ts-ignore - Custom property
                    const desktopPosition = window._desktopDragPosition;
                    
                    // Als er geen bureaubladpositie is, gebruik dan de huidige muispositie als fallback
                    const mousePosition = desktopPosition || {
                      x: e.clientX,
                      y: e.clientY
                    };
                    
                    console.log(`🖱️ Positie voor bestand: ${mousePosition.x}, ${mousePosition.y}`);
                    
                    // Verwijderen uit huidige map en positie doorgeven
                    removeFileFromFolder(file.id, mousePosition)
                      .then(() => {
                        // Toast melding tonen
                        toast({
                          title: "Bestand verplaatst",
                          description: `"${file.name}" is verplaatst naar het bureaublad op de exacte positie waar je het losliet.`,
                        });
                        
                        // Vernieuwen van desktop bestanden
                        queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                        
                        // Ook de mapinhoud vernieuwen
                        fetchFiles();
                      })
                      .catch(err => console.error('Fout bij verplaatsen bestand naar bureaublad:', err));
                  }
                  
                  // Clear global tracking
                  // @ts-ignore - Custom property
                  window.draggedFileInfo = undefined;
                  // @ts-ignore - Custom property
                  window._draggingFileToDesktop = false;
                }}
              >
                <FileItemPreview file={file} />
                <p className="text-xs font-medium mt-1 text-center truncate w-full">{file.name}</p>
              </div>
            ))}
          </div>
        )}
        
        {/* Drag overlay - even more visible */}
        {isDraggingOver && !isSelectMode && (
          <div className="absolute inset-0 bg-green-200/40 backdrop-blur-sm flex items-center justify-center pointer-events-none z-50 animate-pulse">
            <div className="bg-white p-6 rounded-lg shadow-xl text-center border-2 border-green-500">
              <div className="flex gap-3 justify-center mb-3">
                <MoveRight className="w-12 h-12 text-green-600" />
                <FolderOpen className="w-12 h-12 text-green-600" />
              </div>
              <p className="text-lg font-semibold text-green-700">Drop here to move file into this folder</p>
              <p className="text-sm text-gray-500 mt-1">Release mouse button to complete</p>
              <p className="text-xs text-blue-600 mt-2 max-w-xs">
                Files in this folder can be rearranged by drag and drop, or moved to other folders or the desktop.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Rename dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <Input
              id="name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New name"
              className="col-span-3"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRenameSubmit();
                }
              }}
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleRenameSubmit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// A simplified version of FileItem just for preview
function FileItemPreview({ file }: { file: DesktopFile }) {
  const isImage = file.type.startsWith('image/');
  
  if (isImage) {
    return (
      <div className="w-16 h-16 overflow-hidden rounded border border-gray-200">
        <img 
          src={file.dataUrl} 
          alt={file.name} 
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  
  // Get file extension
  const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
  
  // Determine icon color based on extension
  let iconColorClass = 'bg-blue-100 text-blue-600';
  if (['pdf'].includes(fileExt)) {
    iconColorClass = 'bg-red-100 text-red-600';
  } else if (['doc', 'docx', 'txt'].includes(fileExt)) {
    iconColorClass = 'bg-blue-100 text-blue-600';
  } else if (['xls', 'xlsx', 'csv'].includes(fileExt)) {
    iconColorClass = 'bg-green-100 text-green-600';
  } else if (['ppt', 'pptx'].includes(fileExt)) {
    iconColorClass = 'bg-orange-100 text-orange-600';
  } else if (['zip', 'rar', 'tar', 'gz'].includes(fileExt)) {
    iconColorClass = 'bg-purple-100 text-purple-600';
  } else if (['mp3', 'wav', 'ogg'].includes(fileExt)) {
    iconColorClass = 'bg-pink-100 text-pink-600';
  } else if (['mp4', 'avi', 'mov'].includes(fileExt)) {
    iconColorClass = 'bg-indigo-100 text-indigo-600';
  }
  
  return (
    <div className={cn("w-14 h-14 flex items-center justify-center rounded", iconColorClass)}>
      <span className="text-xs font-bold uppercase">{fileExt}</span>
    </div>
  );
}