import { useRef, useState, useEffect, useLayoutEffect, Fragment } from "react";
import { DesktopFile } from "@/types";
import { getFileIcon, formatFileSize } from "@/utils/file-utils";
import { cn } from "@/lib/utils";
import { Maximize2, Edit, FolderOpen, Trash2, Upload } from "lucide-react";
import { 
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator 
} from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { ClosedFolderDropTarget } from "./ClosedFolderDropTarget";

// Function to highlight text with fuzzy matches
function highlightMatchedText(text: string, searchTerm: string) {
  if (!searchTerm || searchTerm.length < 2) return text;
  
  try {
    // Handle fuzzy matching highlighting
    // We'll highlight any characters that appear in the search term
    const searchChars = searchTerm.toLowerCase().split('');
    let result = [];
    let textLower = text.toLowerCase();
    let lastIndex = 0;
    let charIndex = 0;
    
    // Try to find each character of the search term in sequence
    for (let i = 0; i < text.length; i++) {
      if (charIndex < searchChars.length && text[i].toLowerCase() === searchChars[charIndex]) {
        // Add unhighlighted part
        if (i > lastIndex) {
          result.push(<Fragment key={`text-${i}`}>{text.substring(lastIndex, i)}</Fragment>);
        }
        
        // Add highlighted character
        result.push(
          <span key={`match-${i}`} className="bg-yellow-400 text-black px-0.5 font-semibold">
            {text[i]}
          </span>
        );
        
        lastIndex = i + 1;
        charIndex++;
      }
    }
    
    // Add any remaining unhighlighted text
    if (lastIndex < text.length) {
      result.push(<Fragment key={`text-end`}>{text.substring(lastIndex)}</Fragment>);
    }
    
    // If we didn't find all characters or didn't highlight anything, fall back to the original text
    return result.length > 0 ? result : text;
  } catch (error) {
    console.error('Error in highlightMatchedText:', error);
    return text;
  }
}

interface FileItemProps {
  file: DesktopFile;
  index: number;
  isSelected: boolean;
  isSearchMatch?: boolean;
  searchTerm?: string;
  onSelect: (index: number) => void;
  onDragEnd: (index: number, x: number, y: number) => void;
  onResize?: (index: number, width: number, height: number) => void;
  onPreview: (file: DesktopFile) => void;
  onDragStart?: (fileId: number | undefined) => void;
  onDragMove?: (fileId: number | undefined) => void;
  registerRef?: (fileId: number | undefined, element: HTMLElement | null) => void;
  onRename?: (fileId: number, newName: string) => void;
}

export function FileItem({ 
  file, 
  index, 
  isSelected,
  isSearchMatch = false,
  searchTerm = "",
  onSelect, 
  onDragEnd,
  onResize,
  onPreview,
  onDragStart,
  onDragMove,
  registerRef,
  onRename
}: FileItemProps) {
  // Get query client for data operations
  const queryClient = useQueryClient();
  const { isConnected, sendMessage, lastMessage } = useWebSocket();
  const { toast } = useToast();
  
  // API functions to manage files and folders
  // Add file to folder
  const addFileToFolder = async (fileId: number, folderId: number) => {
    try {
      console.log(`Adding file ${fileId} to folder ${folderId}`);
      const response = await fetch(`/api/folders/${folderId}/files/${fileId}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to add file to folder');
      }
      
      const result = await response.json();
      console.log('File added to folder successfully:', result);
      
      // Verstuur een WebSocket bericht om clients te informeren over deze wijziging
      if (isConnected) {
        sendMessage({
          type: 'fileAddedToFolder',
          fileId,
          folderId,
          timestamp: new Date().toISOString()
        });
        console.log('📡 WebSocket bericht verzonden over bestand toevoegen aan map');
      }
      
      // Force refresh the desktop files - this is crucial to make files disappear from desktop
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      
      // Toon een notificatie
      toast({
        title: "Bestand verplaatst",
        description: `Het bestand is naar de map verplaatst.`,
        duration: 3000,
      });
      
      return result;
    } catch (error) {
      console.error('Error adding file to folder:', error);
      
      toast({
        title: "Fout",
        description: "Kon het bestand niet naar de map verplaatsen.",
        variant: "destructive",
        duration: 3000,
      });
      
      throw error;
    }
  };
  
  // Remove file from folder (place back on desktop)
  const removeFileFromFolder = async (fileId: number, position?: { x: number; y: number }, parentId?: number) => {
    try {
      console.log(`Removing file ${fileId} from its current folder`);
      
      // Update UI FIRST before API call for instant feedback
      if (parentId) {
        try {
          // 1. Get and update folder contents
          const folderFilesKey = [`/api/folders/${parentId}/files`];
          const folderContents = queryClient.getQueryData<{files: DesktopFile[]}>(folderFilesKey);
          
          if (folderContents?.files) {
            // Find the file being removed
            const fileIndex = folderContents.files.findIndex(f => f.id === fileId);
            
            if (fileIndex >= 0) {
              // Get a copy of the file
              const removedFile = {...folderContents.files[fileIndex]};
              // Remove from folder view immediately
              const updatedFolderFiles = [...folderContents.files];
              updatedFolderFiles.splice(fileIndex, 1);
              
              // Update folder contents cache
              queryClient.setQueryData(folderFilesKey, {
                files: updatedFolderFiles
              });
              
              console.log(`✨ FILE ITEM: UI Updated to remove file ${fileId} from folder ${parentId}`);
            }
          }
        } catch (error) {
          console.error('Error updating UI before API call:', error);
        }
      }
      
      const response = await fetch(`/api/folders/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: position ? JSON.stringify({ position }) : undefined,
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove file from folder');
      }
      
      const result = await response.json();
      console.log('File removed from folder successfully:', result);
      
      // Als er een positie is opgegeven, direct de bestandspositie ook updaten
      if (position && result.file?.id) {
        try {
          await fetch(`/api/files/${result.file.id}/position`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ position }),
          });
          console.log(`✅ Positie van bestand ${result.file.name} succesvol bijgewerkt naar (${position.x}, ${position.y})`);
        } catch (err) {
          console.error('Fout bij direct updaten van bestandspositie:', err);
        }
      }
      
      // Force refresh the desktop files - this is crucial to make files appear on desktop again
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      
      return result;
    } catch (error) {
      console.error('Error removing file from folder:', error);
      throw error;
    }
  };
  // Enable draggable functionality for all files including folders
  const draggableProps = {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      if (file.id) {
        console.log(`🖱️ DRAG START: Started dragging ${file.isFolder === 'true' ? 'folder' : 'file'} ${file.name} (ID: ${file.id})`);
        
        // Zeer belangrijke stap: Markeer globaal dat we aan het slepen zijn
        // @ts-ignore - Adding custom properties to window
        window._isDraggingFile = true;
        // @ts-ignore
        window._lastDraggedFile = file.id;
        
        // Belangrijk: zet een ghost image voor de drag-operatie
        const dragGhost = document.createElement('div');
        dragGhost.classList.add('drag-ghost');
        dragGhost.innerHTML = `
          <div style="
            padding: 10px; 
            background: rgba(255,255,255,0.9); 
            border: 2px solid #4f46e5;
            border-radius: 6px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            font-size: 12px;
            max-width: 150px;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
          ">
            ${file.name}
          </div>
        `;
        
        document.body.appendChild(dragGhost);
        dragGhost.style.position = 'absolute';
        dragGhost.style.top = '-1000px';
        dragGhost.style.left = '-1000px';
        e.dataTransfer.setDragImage(dragGhost, 75, 25);
        
        setTimeout(() => {
          document.body.removeChild(dragGhost);
        }, 0);
        
        // ZEER BELANGRIJK: Zet diverse dataformaten voor maximale compatibiliteit
        // Dit is cruciaal voor de drop detection
        
        // 1. Simpel text format met het file ID
        e.dataTransfer.setData('text/plain', file.id.toString());
        
        // 2. JSON format met alle relevante details
        const jsonData = JSON.stringify({
          id: file.id,
          name: file.name,
          isFolder: file.isFolder === 'true',
          parentId: file.parentId,
          timestamp: Date.now()
        });
        e.dataTransfer.setData('application/json', jsonData);
        
        // 3. Aangepast format specifiek voor onze app
        e.dataTransfer.setData('application/x-file-id', file.id.toString());
        
        // 4. Stel de drop effect in
        e.dataTransfer.effectAllowed = 'move';
        
        // Globale tracking object voor folder detection en cross-component communicatie
        // @ts-ignore - Adding custom property to window
        window.draggedFileInfo = {
          id: file.id,
          name: file.name,
          isFolder: file.isFolder === 'true',
          parentId: file.parentId,
          startTime: Date.now(),
          element: e.currentTarget instanceof HTMLElement ? e.currentTarget : null, // Store the dragged element
          initialPosition: { 
            x: e.clientX, 
            y: e.clientY 
          },
          dragImageSet: true
        };
        
        console.log(`⭐ GLOBALE DRAG DATA INGESTELD: Bestand ${file.name} (ID: ${file.id}) wordt nu gesleept`);
        console.log('Drag data beschikbare formats:', e.dataTransfer.types);
        
        // Voeg visuele feedback toe aan het element
        if (e.currentTarget) {
          e.currentTarget.classList.add('opacity-50', 'dragging-element');
          document.body.classList.add('dragging-in-progress');
        }
        
        // Notify parent component that we've started dragging
        if (onDragStart) {
          onDragStart(file.id);
        }
      }
    },
    onDragEnd: (e: React.DragEvent) => {
      console.log(`🖱️ DRAG END: Stopped dragging ${file.isFolder === 'true' ? 'folder' : 'file'} ${file.name}`);
      
      // Verwijder alle visuele klassen die toegevoegd zijn tijdens slepen
      if (e.currentTarget) {
        e.currentTarget.classList.remove('opacity-50', 'dragging-element');
      }
      
      // Verwijder class van document.body
      document.body.classList.remove('dragging-in-progress');
      
      // Reset alle globale drag tracking variabelen
      // @ts-ignore - Clearing custom property
      window.draggedFileInfo = undefined;
      // @ts-ignore - Clearing custom property
      window._isDraggingFile = false;
      // @ts-ignore - Clearing custom property
      window._lastDraggedFile = null;
      // @ts-ignore - Clearing custom property
      window._draggingFileFromFolder = false;
      // @ts-ignore - Clearing custom property
      window._draggingFileToDesktop = false;
      // @ts-ignore - Clearing custom property
      window._hoverFolderId = undefined;
      // @ts-ignore - Clearing custom property
      window._activeDropFolder = undefined;
      
      // Log het einde van de drag operatie
      console.log(`✓ DRAG COMPLETE: Alle drag & drop tracking is gereset`);
    }
  };
  
  // State for the drop target (only for folders)
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Add drop target capabilities for folders
  const dropTargetProps = file.isFolder === 'true' ? {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Print de beschikbare data types voor debug
      console.log('DragOver data types:', e.dataTransfer.types);
      
      // Controleer of we een bestand slepen (File API of onze custom text/plain)
      const hasFileId = e.dataTransfer.types.includes('text/plain');
      const hasFiles = e.dataTransfer.types.includes('Files');
      
      if (hasFileId || hasFiles) {
        // Show that we can drop here (visual cursor feedback)
        e.dataTransfer.dropEffect = 'move';
        
        // Verbeterde detectie: gebruik eerst onze global tracking object of anders direct de dataTransfer
        // @ts-ignore - Using custom window property
        const draggedInfo = window.draggedFileInfo;
        
        // Als er bestanden worden gesleept vanaf bureaublad (met onze globale info) of van buitenaf
        if ((draggedInfo && file.id && draggedInfo.id !== file.id) || hasFiles) {
          // Zet de map-hover status aan als die nog niet aan stond
          if (!isDragOver) {
            setIsDragOver(true);
            console.log(`📂 DRAG OVER: ${draggedInfo ? `File ${draggedInfo.name}` : 'Externe bestanden'} hovering over folder ${file.name} (ID: ${file.id})`);
            
            // Globale tracking bijwerken voor onze drag & drop implementatie
            if (file.isFolder === 'true') {
              // @ts-ignore - Custom property
              window._hoverFolderId = file.id;
              
              // Consistente activeDropFolder eigenschap bijwerken voor alle foldervensters
              // Controleer of file.id een getal is
              if (typeof file.id === 'number') {
                // @ts-ignore - Custom property
                window._activeDropFolder = {
                  id: file.id,
                  name: file.name,
                  element: fileRef.current,
                  timestamp: Date.now()
                };
              }
              
              console.log(`✓ FOLDER READY: Closed folder ${file.name} (ID: ${file.id}) is now ready to receive files`);
              
              // Voeg een duidelijke visuele feedback toe (CSS klasse is al toegevoegd via className)
              if (fileRef.current) {
                fileRef.current.classList.add('folder-highlight-dragover');
              }
            }
          }
        }
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Controleer of we de juiste elementen verlaten
      // @ts-ignore - Using custom window property
      const draggedInfo = window.draggedFileInfo;
      const hasFiles = e.dataTransfer.types.includes('Files');
      
      // Alleen verwerken als we echt een bestand slepen of externe bestanden
      if ((draggedInfo && draggedInfo.id) || hasFiles) {
        // Kleine vertraging om te voorkomen dat we flikkeren bij het bewegen over subelementen
        setTimeout(() => {
          setIsDragOver(false);
          console.log(`📂 DRAG LEFT: Cursor verlaat map ${file.name}`);
          
          // Verwijder CSS klasse voor visuele feedback
          if (fileRef.current) {
            fileRef.current.classList.remove('folder-highlight-dragover');
          }
          
          // Leeg de hover tracking als we echt de map verlaten
          if (file.isFolder === 'true' && file.id) {
            // @ts-ignore - Custom property
            if (window._hoverFolderId === file.id) {
              // @ts-ignore - Custom property
              window._hoverFolderId = undefined;
            }
            
            // Leeg ook de activeDropFolder eigenschap
            // @ts-ignore - Custom property
            if (window._activeDropFolder?.id === file.id) {
              console.log(`❌ CLEARING DROP TARGET: Map ${file.name} is niet langer een drop target`);
              // @ts-ignore - Custom property
              window._activeDropFolder = undefined;
            }
          }
        }, 50); // Kleine vertraging om te zorgen dat we niet gewoon tussen child elementen bewegen
      }
    },
    onDrop: async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      
      console.log(`🎯 DROP SUCCESS: Bestand(en) gedropt in map ${file.name} (ID: ${file.id})`);
      console.log('DropEvent beschikbare datatypes:', e.dataTransfer.types);
      
      // Voeg extra debug logs toe
      if (e.dataTransfer.files.length > 0) {
        console.log(`DropEvent bevat ${e.dataTransfer.files.length} bestanden:`, 
          Array.from(e.dataTransfer.files).map(f => f.name));
      }
      
      // Verwijder visuele stijlen voor drop target
      if (fileRef.current) {
        fileRef.current.classList.remove('folder-highlight-dragover', 'folder-receive');
      }
      
      // Verwijder alle hovering tracking
      // @ts-ignore - Custom property
      window._activeDropFolder = undefined;
      // @ts-ignore - Custom property
      window._hoverFolderId = undefined;
      // @ts-ignore - Custom property voor compatibiliteit
      window._openFolderHoverId = undefined;
      
      // Controleer of de folder een geldig ID heeft
      if (!file.id) {
        console.error("Folder heeft geen geldig ID voor drop operatie");
        return;
      }
      
      try {
        // CASE 1: Controleer eerst op bestanden van bureaublad (intern versleept)
        const data = e.dataTransfer.getData('text/plain');
        if (data) {
          const fileId = parseInt(data);
          if (!isNaN(fileId)) {
            // Info ophalen over het gesleepte bestand
            const allDesktopFiles = queryClient.getQueryData<any>(['/api/files'])?.files || [];
            const droppedFile = allDesktopFiles.find((f: any) => f.id === fileId);
            
            console.log(`📁 DROP DETECTED: Bestand ${fileId} (${droppedFile?.name || 'onbekend'}) gedropt in map ${file.id} (${file.name})`);
            
            // Voorkom dat een map in zichzelf wordt gesleept (circulaire referentie)
            if (fileId === file.id) {
              console.log('Kan een map niet in zichzelf plaatsen');
              return;
            }
            
            // Voorkom dat mappen in mappen worden geplaatst (feature restricties)
            if (droppedFile?.isFolder === 'true') {
              console.log('Het plaatsen van mappen in andere mappen is momenteel niet ondersteund');
              return;
            }
            
            // Animatie toevoegen aan het gesleepte element
            const draggedFileElement = document.querySelector(`[data-file-id="${fileId}"]`);
            if (draggedFileElement) {
              draggedFileElement.classList.add('teleport-out');
            }
            
            // Ontvangst animatie toevoegen aan de map
            if (fileRef.current) {
              fileRef.current.classList.add('folder-receive');
              setTimeout(() => {
                if (fileRef.current) {
                  fileRef.current.classList.remove('folder-receive');
                }
              }, 500);
            }
            
            // Als het bestand in een andere map was, eerst verwijderen
            if (droppedFile && droppedFile.parentId) {
              await removeFileFromFolder(fileId);
            }
            
            // Met vertraging toevoegen voor betere visuele feedback
            setTimeout(async () => {
              try {
                // Zorg ervoor dat file.id een geldige waarde heeft
                if (typeof file.id !== 'number') {
                  console.error('Ongeldige folder ID:', file.id);
                  return;
                }
                
                // Toevoegen aan de map met de API - dit zal ook een WebSocket-bericht sturen via de hook
                await addFileToFolder(fileId, file.id);
                
                // Desktop bestanden verversen
                queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                
                // Expliciet de inhoud van de map verversen
                queryClient.invalidateQueries({ queryKey: [`/api/folders/${file.id}/files`] });
                
                // Extra WebSocket-bericht voor bestandsverplaatsing (voor gesloten mapweergaven)
                if (isConnected) {
                  sendMessage({
                    type: 'fileDroppedIntoFolder',
                    fileId,
                    folderId: file.id,
                    folderName: file.name,
                    timestamp: new Date().toISOString()
                  });
                  console.log(`📡 WebSocket: Bericht verstuurd over verplaatsing van bestand ${fileId} naar map ${file.id}`);
                }
                
                // Direct UI update voor instant feedback (zonder wachten op API)
                try {
                  const folderFilesKey = [`/api/folders/${file.id}/files`];
                  const folderContents = queryClient.getQueryData<{files: DesktopFile[]}>(folderFilesKey);
                  const desktopFiles = queryClient.getQueryData<{files: DesktopFile[]}>(['/api/files'])?.files || [];
                  
                  if (desktopFiles) {
                    // Zoek het gesleepte bestand op ID
                    const draggedFile = desktopFiles.find(f => f.id === fileId);
                    
                    if (draggedFile && folderContents) {
                      // Voeg het bestand toe aan de map cache (met bijgewerkte parentId)
                      const updatedFile = {
                        ...draggedFile,
                        parentId: file.id
                      };
                      
                      // Update de map inhoud cache
                      queryClient.setQueryData(folderFilesKey, {
                        files: [...folderContents.files, updatedFile]
                      });
                      
                      console.log(`✅ UI INSTANT UPDATE: Bestand ${draggedFile.name} direct zichtbaar gemaakt in map ${file.name}`);
                    }
                  }
                } catch (error) {
                  console.error('Fout bij updaten map UI cache:', error);
                }
              } catch (error) {
                console.error(`Fout bij toevoegen bestand ${fileId} aan map ${file.id}:`, error);
              }
            }, 300);
          }
        }
      } catch (error) {
        console.error('Fout bij slepen bestand naar map:', error);
      }
    }
  } : {};
  const fileRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [localPosition, setLocalPosition] = useState({ x: file.position.x, y: file.position.y });
  const resizeStartPos = useRef<{ x: number, y: number, width: number, height: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const fileIcon = getFileIcon(file.type);
  const isImage = file.type.startsWith('image/');
  const isFolder = file.type === 'folder' || file.type === 'application/folder' || file.isFolder === 'true';
  
  // State for rename dialog
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState(file.name);
  
  // Set initial dimensions from file or defaults
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => {
    if (file.dimensions) {
      return file.dimensions;
    }
    return isImage ? { width: 192, height: 160 } : { width: 96, height: 96 };
  });

  // Only update position from props on initial render
  useEffect(() => {
    // Only run on first mount
    setLocalPosition({ x: file.position.x, y: file.position.y });
  }, []);
  
  // BELANGRIJK: Alleen één registerRef effect 
  // Voeg hier geen duplicaat useEffect toe voor registerRef!

  // Track mouse position during dragging in non-reactive ref
  // to avoid re-renders that might cause jumps
  const currentPosition = useRef({ x: 0, y: 0 });
  
  // To track mouse movement for distinguishing between click and drag
  const initialClick = useRef<{x: number, y: number} | null>(null);
  const isClick = useRef<boolean>(true);

  // Improved direct drag implementation - allows immediate dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only respond to left mouse button
    if (e.button !== 0) return;
    
    // Don't interfere with resize operation
    if (isResizing) return;
    
    // Prevent default browser behavior and stop event propagation
    e.stopPropagation();
    e.preventDefault();
    
    // Always select the file on mouse down to allow for immediate interaction
    if (!isSelected) {
      onSelect(index);
    }
    
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
    
    // Add document-level event listeners immediately
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle mouse movement during drag with requestAnimationFrame for better performance
  const handleMouseMove = (e: MouseEvent) => {
    // Prevent any default browser behavior
    e.preventDefault();
    
    // If we have an active drag, update the tracking information for open folders to detect
    if (dragging && file.id) {
      // Update the global drag tracking info on every mouse move
      // This is crucial for the folder detection system
      // @ts-ignore - Custom property
      window.draggedFileInfo = {
        id: file.id,
        name: file.name,
        isFolder: file.isFolder === 'true',
        element: fileRef.current,
        position: { x: e.clientX, y: e.clientY },
        updateTime: Date.now()
      };
    }
    
    // If we moved enough to consider this a drag (not a click)
    if (initialClick.current) {
      const moveThreshold = 2; // pixels - reduced threshold for more responsive dragging
      const deltaX = Math.abs(e.clientX - initialClick.current.x);
      const deltaY = Math.abs(e.clientY - initialClick.current.y);
      
      // If we moved enough, consider this a drag
      if (deltaX > moveThreshold || deltaY > moveThreshold) {
        // No longer a click - it's a drag
        isClick.current = false;
        
        // Start dragging immediately upon movement
        if (!dragging) {
          setDragging(true);
          
          // Notify parent that we started dragging this file
          if (onDragStart && file.id) {
            onDragStart(file.id);
          }
        }
        
        // Calculate new position - ensure it stays within visible area
        const newX = Math.max(0, e.clientX - startPosRef.current.x);
        const newY = Math.max(0, e.clientY - startPosRef.current.y);
        
        // Update current position ref first (without causing re-renders)
        currentPosition.current = { x: newX, y: newY };
        
        // Notify parent that we've moved (for overlap detection)
        if (onDragMove && file.id) {
          onDragMove(file.id);
        }
        
        // Use requestAnimationFrame for smoother dragging
        window.requestAnimationFrame(() => {
          setLocalPosition(currentPosition.current);
        });
      }
    }
  };

  // Handle mouse up - end dragging or handle click
  const handleMouseUp = (e: MouseEvent) => {
    // Prevent default behavior
    e.preventDefault();
    
    // Handle as a click if there was minimal movement
    if (isClick.current) {
      // Select on click
      onSelect(index);
    } 
    // Handle as a drag completion
    else if (dragging) {
      // Save the final position
      onDragEnd(index, currentPosition.current.x, currentPosition.current.y);
      
      // End dragging state
      setDragging(false);
    }
    
    // Reset tracking variables
    initialClick.current = null;
    isClick.current = true;
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClick = () => {
    // Open file in preview or Excel window
    onPreview(file);
  };
  
  // Handle rename request from context menu
  const handleRenameClick = () => {
    setNewName(file.name);
    setIsRenameDialogOpen(true);
  };
  
  // Handle the rename dialog submission
  const handleRenameSubmit = () => {
    if (file.id && onRename && newName.trim() !== "") {
      onRename(file.id, newName.trim());
      setIsRenameDialogOpen(false);
    }
  };
  
  // Debug
  // Debug details removed for production
  
  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (fileRef.current) {
      const rect = fileRef.current.getBoundingClientRect();
      resizeStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        width: rect.width,
        height: rect.height
      };
      
      setIsResizing(true);
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    }
  };
  
  const handleResizeMove = (e: MouseEvent) => {
    if (resizeStartPos.current && fileRef.current) {
      const deltaX = e.clientX - resizeStartPos.current.x;
      const deltaY = e.clientY - resizeStartPos.current.y;
      
      const newWidth = Math.max(100, resizeStartPos.current.width + deltaX);
      const newHeight = Math.max(100, resizeStartPos.current.height + deltaY);
      
      // Update local dimensions state
      setDimensions({ width: newWidth, height: newHeight });
      
      // Apply dimensions to element
      if (isImage) {
        fileRef.current.style.width = `${newWidth}px`;
        const imgContainer = fileRef.current.querySelector('.image-container') as HTMLElement;
        if (imgContainer) {
          imgContainer.style.height = `${newHeight - 40}px`; // Subtract footer height
        }
      }
    }
  };
  
  const handleResizeEnd = (e: MouseEvent) => {
    if (resizeStartPos.current && onResize && fileRef.current) {
      // Save the final dimensions
      onResize(index, dimensions.width, dimensions.height);
    }
    
    resizeStartPos.current = null;
    setIsResizing(false);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  // Use the file's dimensions if available
  useEffect(() => {
    if (fileRef.current && file.dimensions) {
      if (isImage) {
        fileRef.current.style.width = `${file.dimensions.width}px`;
        const imgContainer = fileRef.current.querySelector('.image-container') as HTMLElement;
        if (imgContainer) {
          imgContainer.style.height = `${file.dimensions.height - 40}px`; // Subtract footer height
        }
      }
    }
  }, [file.dimensions, isImage]);
  
  // Register the file element with the parent component for overlap detection
  // Use a layout effect to ensure ref is registered before any DOM measurements
  const registeredRef = useRef(false);
  
  useLayoutEffect(() => {
    // Only register once on mount to avoid infinite loops
    if (!registeredRef.current && registerRef && fileRef.current && file.id) {
      // console.log(`🔄 Registreren element voor bestand ID: ${file.id}`);
      registerRef(file.id, fileRef.current);
      registeredRef.current = true;
    }
    
    // Cleanup on unmount
    return () => {
      if (registerRef && file.id) {
        // console.log(`🔄 Deregistreren element voor bestand ID: ${file.id}`);
        registerRef(file.id, null);
      }
    };
  }, []);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            ref={fileRef}
            data-file-id={file.id}
            className={cn(
              "file-item absolute backdrop-blur-sm rounded-lg shadow-md overflow-hidden",
              isImage ? "w-48" : "w-24 bg-white/80 p-3",
              "cursor-move",
              isSelected && "ring-2 ring-primary shadow-lg z-10",
              dragging && "z-50 shadow-xl", // Z-index voor sleepbeweging
              isSearchMatch && "animate-pulse shadow-xl shadow-primary/20",
              isSearchMatch && !isSelected && "ring-2 ring-yellow-400 z-10",
              isFolder && "folder-drop-zone", // Voeg folder-drop-zone class toe aan alle mappen
              isFolder && (isDragOver || file.id === (window as any)._hoverFolderId) && "ring-2 ring-green-500 shadow-lg bg-green-50/90 folder-highlight drop-target-active"
            )}
            style={{
              left: `${localPosition.x}px`,
              top: `${localPosition.y}px`,
              width: isImage && file.dimensions ? `${file.dimensions.width}px` : 'auto',
              transition: dragging ? 'none' : 'all 0.15s ease',
              // Hogere z-index voor elementen die geselecteerd of versleept worden, ALTIJD hoger dan open mappen
              zIndex: dragging ? 9999 : (isSelected ? 100 : 10)
            }}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            {...draggableProps}
            {...dropTargetProps}
          >
            {isImage ? (
              <div className="flex flex-col">
                <div className="image-container w-full h-32 overflow-hidden rounded-t-lg"
                    style={{
                      height: file.dimensions ? `${file.dimensions.height - 40}px` : '128px'
                    }}>
                  <img 
                    src={file.dataUrl} 
                    alt={file.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="bg-black/70 text-white p-2 rounded-b-lg">
                  <p className="text-xs font-medium truncate" title={file.name}>
                    {isSearchMatch && searchTerm ? (
                      <span className="relative">
                        {highlightMatchedText(file.name, searchTerm)}
                      </span>
                    ) : (
                      file.name
                    )}
                  </p>
                  <p className="text-[10px] text-gray-300">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className={`file-icon ${fileIcon.class} mb-2 w-12 h-12 mx-auto flex items-center justify-center rounded-md`}>
                  {fileIcon.icon}
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium truncate" title={file.name}>
                    {isSearchMatch && searchTerm ? (
                      <span className="relative">
                        {highlightMatchedText(file.name, searchTerm)}
                      </span>
                    ) : (
                      file.name
                    )}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </>
            )}
            
            {/* Resize handle - only for images and only shown when selected */}
            {isImage && isSelected && (
              <div 
                className="absolute bottom-0 right-0 w-5 h-5 bg-primary/90 flex items-center justify-center rounded-tl rounded-br-lg cursor-se-resize z-20"
                onMouseDown={handleResizeStart}
              >
                <Maximize2 className="w-3 h-3 text-white" />
              </div>
            )}
            
            {/* Folder drop target voor gesloten mappen */}
            {isFolder && <ClosedFolderDropTarget file={file} />}
            
            {/* Drop indicator for folders - enhanced teleportation effect */}
            {isFolder && (isDragOver || file.id === (window as any)._hoverFolderId) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-green-100 rounded-lg p-2 shadow-md animate-pulse">
                  <Upload className="h-6 w-6 text-green-600 animate-bounce" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-blue-500/30 rounded-lg animate-pulse"></div>
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={handleDoubleClick}>
            <FolderOpen className="w-4 h-4 mr-2" />
            Open
          </ContextMenuItem>
          
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleRenameClick}>
            <Edit className="w-4 h-4 mr-2" />
            Rename
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      
      {/* Rename dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename {isFolder ? "Folder" : "File"}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <Input
              id="name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
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
    </>
  );
}
