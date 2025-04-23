import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";
import { DesktopToolbar } from "@/components/DesktopToolbar";
import { FileItem } from "@/components/FileItem";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { WindowItem } from "@/components/WindowItem";
import { FolderView } from "@/components/FolderView";
import { EmptyState } from "@/components/EmptyState";
import { useDesktopFiles } from "@/hooks/use-desktop-files";
import { DesktopFile } from "@/types";
import { Loader2 as Spinner, Search, X, FileText, FolderSearch, Folder, FolderOpen, FolderPlus, RefreshCw, FileUp, Upload } from "lucide-react";
import Fuse from 'fuse.js';
import { useToast } from "@/hooks/use-toast";
import { 
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator 
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Interface for tracking overlapping files
interface FileOverlap {
  fileId: number;
  targetId: number;
  overlapStartTime: number;
  position: { x: number; y: number };
}

// Function to check if two files are overlapping
function areFilesOverlapping(file1Element: HTMLElement, file2Element: HTMLElement): boolean {
  const rect1 = file1Element.getBoundingClientRect();
  const rect2 = file2Element.getBoundingClientRect();
  
  // Check if one rectangle is to the left of the other
  if (rect1.right < rect2.left || rect2.right < rect1.left) return false;
  
  // Check if one rectangle is above the other
  if (rect1.bottom < rect2.top || rect2.bottom < rect1.top) return false;
  
  // Calculate the overlap area (minimum)
  const overlapWidth = Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left);
  const overlapHeight = Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top);
  const overlapArea = overlapWidth * overlapHeight;
  
  // Require significant overlap (at least 30% of the smaller element)
  const area1 = rect1.width * rect1.height;
  const area2 = rect2.width * rect2.height;
  const smallerArea = Math.min(area1, area2);
  const overlapPercentage = overlapArea / smallerArea;
  
  return overlapPercentage > 0.3; // 30% overlap threshold
}

export default function Desktop() {
  const { toast } = useToast();
  const {
    files,
    selectedFile,
    isLoading,
    error,
    addFiles,
    updateFilePosition,
    updateFileDimensions,
    clearAllFiles,
    selectFile,
    createFolderFromFiles,
    createFolder,
    addFileToFolder,
    removeFileFromFolder,
    updateFileName,
  } = useDesktopFiles();
  const [previewFile, setPreviewFile] = useState<DesktopFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredFiles, setFilteredFiles] = useState<DesktopFile[]>([]);
  const [openWindowFiles, setOpenWindowFiles] = useState<number[]>([]);
  const [activeOverlap, setActiveOverlap] = useState<FileOverlap | null>(null);
  const [draggingFileId, setDraggingFileId] = useState<number | null>(null);
  const [folderRefs, setFolderRefs] = useState<{[key: number]: HTMLElement}>({});
  const [dragPosition, setDragPosition] = useState<{x: number, y: number} | null>(null);
  
  // Folder naming dialog state
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("Nieuwe map");
  const [pendingFolderPosition, setPendingFolderPosition] = useState<{x: number, y: number} | null>(null);
  const [pendingFolderFiles, setPendingFolderFiles] = useState<number[] | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileElementsRef = useRef<{[key: string]: HTMLElement}>({});
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle upload button click
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file selection from file input
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    // Pass the FileList to addFiles, which will handle uploading to server
    addFiles(e.target.files);
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
    
    // Controleer of een element wordt gesleept vanuit een map en signaleer dat we over het bureaublad zweven
    // @ts-ignore - Custom property
    window._draggingFileToDesktop = true;
    
    // Update elke keer de desktopDragPosition - dit is belangrijk voor nauwkeurige positionering
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (canvasRect) {
      // Bereken de relatieve positie binnen het canvas gebied
      const relativeX = e.clientX - canvasRect.left;
      const relativeY = e.clientY - canvasRect.top;
      
      // @ts-ignore - Custom property
      window._desktopDragPosition = {
        x: relativeX,
        y: relativeY
      };
      
      console.log(`🖱️ Desktop drag positie bijgewerkt naar: ${relativeX}, ${relativeY}`);
    } else {
      // Fallback naar clientX/Y als we de canvasRect niet kunnen krijgen
      // @ts-ignore - Custom property
      window._desktopDragPosition = {
        x: e.clientX,
        y: e.clientY
      };
    }
    
    // Set cursor to indicate we can drop here
    e.dataTransfer.dropEffect = 'move';
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    // Reset desktop drag indicator when cursor leaves desktop area
    // @ts-ignore - Custom property
    window._draggingFileToDesktop = false;
  };
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    // Check for files first (regular file upload)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Pass files to addFiles function
      addFiles(e.dataTransfer.files);
      return;
    }
    
    // Check for dragged files from folders (which use dataTransfer.getData)
    const fileIdText = e.dataTransfer.getData('text/plain');
    if (fileIdText) {
      try {
        const fileId = parseInt(fileIdText);
        if (!isNaN(fileId)) {
          console.log(`🖥️ DESKTOP DROP: Bestand met ID ${fileId} op bureaublad geplaatst`);
          
          // Bevestig dat we op het bureaublad slepen
          // @ts-ignore - Custom property
          window._draggingFileToDesktop = true;
          
          // Get information about the dragged file from global state (if available)
          // @ts-ignore - Custom property
          const draggedFileInfo = window.draggedFileInfo;
          
          // Determine the exact drop position on the desktop
          let dropPosition;
          
          // First, check if we have a stored position from dragOver events (meer nauwkeurig)
          // @ts-ignore - Custom property
          const storedPosition = window._desktopDragPosition;
          
          if (storedPosition) {
            dropPosition = storedPosition;
            console.log('🎯 Using precise position from drag tracking: ', dropPosition);
          } else {
            // Get relative position within canvas as fallback
            const canvasRect = canvasRef.current?.getBoundingClientRect();
            if (canvasRect) {
              dropPosition = {
                x: e.clientX - canvasRect.left,
                y: e.clientY - canvasRect.top
              };
              console.log('🎯 Using calculated position from drop event: ', dropPosition);
            } else {
              // Last resort fallback
              dropPosition = {
                x: e.clientX,
                y: e.clientY
              };
              console.log('⚠️ Using absolute position as fallback: ', dropPosition);
            }
          }
          
          // Update UI immediately before API call for instant feedback
          if (draggedFileInfo && draggedFileInfo.fromFolder) {
            // Get current desktop files and add this file to it
            const desktopFiles = queryClient.getQueryData<{files: DesktopFile[]}>(['/api/files']);
            
            if (desktopFiles?.files) {
              // Create a file object with the correct position
              const fileForDesktop = {
                id: fileId,
                name: draggedFileInfo.name,
                type: draggedFileInfo.type,
                size: draggedFileInfo.size,
                dataUrl: draggedFileInfo.dataUrl,
                position: dropPosition,
                parentId: undefined, // Not in a folder
                className: 'file-teleport-in' // Add animation class
              };
              
              // Add it to the desktop files cache
              queryClient.setQueryData(['/api/files'], {
                files: [...desktopFiles.files, fileForDesktop]
              });
              
              // Show toast notification
              toast({
                title: "Bestand verplaatst",
                description: `"${draggedFileInfo.name}" is direct verplaatst naar het bureaublad.`,
                duration: 2000
              });
            }
          }
          
          console.log(`⬇️ DESKTOP DROP POSITIE: ${dropPosition.x}, ${dropPosition.y}`);
          
          // Verwijderen uit map en direct op bureaubladpositie plaatsen (update database)
          await removeFileFromFolder(fileId, dropPosition);
          console.log('File removed from folder and placed on desktop at position:', dropPosition);
          
          // Reset drag trackers
          // @ts-ignore - Custom property
          window._draggingFileToDesktop = false;
          // @ts-ignore - Custom property
          window._desktopDragPosition = undefined;
          // @ts-ignore - Custom property
          window.draggedFileInfo = undefined;
        }
      } catch (error) {
        console.error('Error moving file to desktop:', error);
        toast({
          title: "Fout",
          description: "Er ging iets mis bij het verplaatsen van het bestand.",
          variant: "destructive"
        });
      }
    }
  };

  // Handle canvas click (deselects files)
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      selectFile(null);
    }
  };
  
  // Handle creating a new folder via context menu
  const handleCreateNewFolder = async (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    // Get mouse coordinates for folder position
    const rect = canvasRef.current.getBoundingClientRect();
    const position = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    // Open the folder naming dialog
    setFolderName("Nieuwe map");
    setPendingFolderPosition(position);
    setPendingFolderFiles(null);
    setIsFolderDialogOpen(true);
  };

  // Handle file selection
  const handleSelectFile = (index: number) => {
    selectFile(index);
  };
  
  // Handle file position update
  const handleFilePositionUpdate = (index: number, x: number, y: number) => {
    const file = files[index];
    if (file && file.id) {
      updateFilePosition(file.id, x, y);
    }
  };
  
  // Handle file resize
  const handleFileResize = (index: number, width: number, height: number) => {
    const file = files[index];
    if (file && file.id) {
      updateFileDimensions(file.id, width, height);
    }
  };
  
  // Check if file is an Excel file
  const isExcelFile = (file: DesktopFile) => {
    return (
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
      file.type === "application/vnd.ms-excel" ||
      file.type === "text/csv" ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls') ||
      file.name.endsWith('.csv')
    );
  };

  // Handle file preview
  const handlePreviewFile = (file: DesktopFile) => {
    if (file.id) {
      // For all files (including folders), open in a window
      if (!openWindowFiles.includes(file.id)) {
        setOpenWindowFiles([...openWindowFiles, file.id]);
      }
      
      // Select the file
      const fileIndex = files.findIndex(f => f.id === file.id);
      if (fileIndex !== -1 && selectedFile !== fileIndex) {
        selectFile(fileIndex);
      }
    }
  };
  
  // Close preview modal
  const closePreview = () => {
    setIsPreviewOpen(false);
  };
  
  // Close file window
  const closeWindowFile = (fileId: number) => {
    setOpenWindowFiles(openWindowFiles.filter(id => id !== fileId));
  };

  // Setup Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(files, {
      keys: ['name', 'type'],
      threshold: 0.4, // Lower threshold = more strict matching
      ignoreLocation: true,
      includeScore: true, // Include score to see how close the match is
    });
  }, [files]);

  // Filter files based on search query with fuzzy matching
  // Also filter out files that are inside folders (have parentId)
  useEffect(() => {
    // First filter files to only show those not in folders
    const filesOnDesktop = files.filter(file => !file.parentId);
    
    if (!searchQuery) {
      // If no search query, show all desktop files
      setFilteredFiles(filesOnDesktop);
    } else {
      // Use fuzzy search to find matches
      const results = fuse.search(searchQuery);
      // Extract the items from results and filter out files in folders
      const filtered = results
        .map(result => result.item)
        .filter(file => !file.parentId);
      setFilteredFiles(filtered);
    }
    
    console.log('Filtered files update:', {
      totalFiles: files.length,
      filesInFolders: files.filter(f => f.parentId).length,
      filesOnDesktop: filesOnDesktop.length,
      displayedFiles: !searchQuery ? filesOnDesktop.length : 'filtered search results'
    });
  }, [searchQuery, files, fuse]);
  
  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Register file element refs for overlap detection
  const registerFileElement = (id: number | undefined, element: HTMLElement | null) => {
    if (id && element) {
      fileElementsRef.current[`file-${id}`] = element;
      console.log(`Registered file element for ID: ${id}`);
      
      // Als dit een map is, houdt die bij in folderRefs
      const fileObj = files.find(f => f.id === id);
      if (fileObj && (fileObj.isFolder === 'true' || fileObj.type === 'folder' || fileObj.type === 'application/folder')) {
        setFolderRefs(prev => ({...prev, [id]: element}));
      }
    } else if (id) {
      delete fileElementsRef.current[`file-${id}`];
      setFolderRefs(prev => {
        const newRefs = {...prev};
        delete newRefs[id];
        return newRefs;
      });
    }
  };
  
  // Track mouse movement for checking overlap with folders during drag
  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (draggingFileId) {
      setDragPosition({x: e.clientX, y: e.clientY});
      
      // Check if dragging over any folder
      Object.entries(folderRefs).forEach(([folderId, element]) => {
        if (Number(folderId) === draggingFileId) return; // Skip self
        
        const rect = element.getBoundingClientRect();
        const isInside = 
          e.clientX >= rect.left && 
          e.clientX <= rect.right && 
          e.clientY >= rect.top && 
          e.clientY <= rect.bottom;
        
        if (isInside) {
          console.log(`🔍 GLOBAL TRACKING: Bestand ${draggingFileId} bevindt zich boven map ${folderId}`);
          // Show visual feedback - add highlight class
          element.classList.add('folder-highlight-dragover');
          
          // Set this folder as active drop target
          // @ts-ignore - Custom property
          window._hoverFolderId = Number(folderId);
        } else {
          // Remove highlight when not hovering
          element.classList.remove('folder-highlight-dragover');
          
          // Clear hover state if this was the active folder
          // @ts-ignore - Custom property
          if (window._hoverFolderId === Number(folderId)) {
            // @ts-ignore - Custom property
            window._hoverFolderId = undefined;
          }
        }
      });
    }
  }, [draggingFileId, folderRefs]);
  
  // ENHANCED GLOBAL MOUSE POSITION TRACKER - IMPROVED FOLDER DETECTION
  useEffect(() => {
    const handleGlobalMouseTracking = (e: MouseEvent) => {
      // @ts-ignore - Custom window property
      if (window.draggedFileInfo && window.draggedFileInfo.id) {
        // Store current mouse position and update global tracking object
        // @ts-ignore - Custom property
        window.draggedFileInfo.position = { x: e.clientX, y: e.clientY };
        // @ts-ignore - Custom property  
        window.draggedFileInfo.updateTime = Date.now();
        const mousePosition = { x: e.clientX, y: e.clientY };
        
        // Controleer alle open mappen
        const openFolderWindows = document.querySelectorAll('[id^="folder-window-"]');
        let foundOverlappingFolder = false;
        
        openFolderWindows.forEach((folderElement) => {
          if (!(folderElement instanceof HTMLElement)) return;
          
          // Haal folder ID uit element ID (format: folder-window-{id})
          const folderId = parseInt(folderElement.id.replace('folder-window-', ''));
          // @ts-ignore - Check voor gelijk ID om slepen naar zichzelf te voorkomen
          if (folderId === window.draggedFileInfo.id) return;
          
          const rect = folderElement.getBoundingClientRect();
          const isInside = 
            mousePosition.x >= rect.left && 
            mousePosition.x <= rect.right && 
            mousePosition.y >= rect.top && 
            mousePosition.y <= rect.bottom;
          
          if (isInside) {
            foundOverlappingFolder = true;
            console.log(`🎯🎯 BELANGRIJKE DETECTIE: Gesleept bestand bevindt zich boven open map ${folderId}`);
            
            // Voeg highlight class toe aan dit element
            folderElement.classList.add('folder-highlight-dragover');
            
            // Sla informatie op over actieve drop target
            // @ts-ignore - Custom window property
            window._activeDropFolder = {
              id: folderId,
              element: folderElement,
              timestamp: Date.now()
            };
            
            // @ts-ignore - Voor backward compatibility
            window._openFolderHoverId = folderId;
          } else {
            // Verwijder highlight als we deze map verlaten
            folderElement.classList.remove('folder-highlight-dragover');
            
            // @ts-ignore - Custom window property
            if (window._activeDropFolder?.id === folderId) {
              // @ts-ignore - Custom window property
              window._activeDropFolder = undefined;
              // @ts-ignore - Custom window property for backward compatibility
              window._openFolderHoverId = undefined;
            }
          }
        });
        
        // Debug logging voor het bijhouden van overlaps
        if (foundOverlappingFolder) {
          console.log('🎯 Overlap gedetecteerd met open map!');
        }
      }
    };
    
    // Voeg event listener toe en ruim op - ALTIJD ACTIEF
    document.addEventListener('mousemove', handleGlobalMouseTracking);
    return () => document.removeEventListener('mousemove', handleGlobalMouseTracking);
  }, []);
  
  // Listen for global mouse movement when dragging
  useEffect(() => {
    if (draggingFileId) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
    }
  }, [draggingFileId, handleGlobalMouseMove]);
  
  // Function to check if two elements are overlapping
  const checkFileOverFolder = (movingFileId: number | undefined) => {
    if (!movingFileId) return null;
    
    const movingElementKey = `file-${movingFileId}`;
    const movingElement = fileElementsRef.current[movingElementKey];
    if (!movingElement) return null;
    
    const movingRect = movingElement.getBoundingClientRect();
    
    // Find all folder IDs
    const folderFiles = files.filter(f => f.isFolder === 'true' || f.type === 'folder' || f.type === 'application/folder');
    
    // Clear any previous hover state
    // @ts-ignore - Custom window property
    window._hoverFolderId = undefined;
    
    for (const folder of folderFiles) {
      if (!folder.id || folder.id === movingFileId) continue; // Skip if same file or invalid id
      
      const folderElementKey = `file-${folder.id}`;
      const folderElement = fileElementsRef.current[folderElementKey];
      if (!folderElement) continue;
      
      const folderRect = folderElement.getBoundingClientRect();
      
      // Check for overlap
      const overlap = !(
        movingRect.right < folderRect.left || 
        movingRect.left > folderRect.right || 
        movingRect.bottom < folderRect.top || 
        movingRect.top > folderRect.bottom
      );
      
      if (overlap) {
        // Store the folder ID in a global variable so FileItem can access it
        // @ts-ignore - Custom window property
        window._hoverFolderId = folder.id;
        
        console.log(`🎯 OVERLAP DETECTED: File ${movingFileId} is overlapping with folder ${folder.id}`);
        return { fileId: movingFileId, folderId: folder.id };
      }
    }
    
    return null;
  };
  
  // Handle file drag start
  const handleFileDragStart = (fileId: number | undefined) => {
    if (fileId) {
      setDraggingFileId(fileId);
    }
  };
  
  // Handle file drag end - UITGESCHAKELD: automatische map-creatie
  const handleFileDragEnd = async (fileId: number | undefined, x: number, y: number) => {
    if (!fileId) return;
    
    // Clear dragging state
    setDraggingFileId(null);
    
    // Clear any active overlap timeout
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }
    
    // Automatische map-creatie uitgeschakeld
    if (activeOverlap) {
      setActiveOverlap(null);
    }
    
    /* UITGESCHAKELDE CODE:
    // If we had an active overlap, create a folder
    if (activeOverlap && activeOverlap.fileId === fileId) {
      const now = Date.now();
      if (now - activeOverlap.overlapStartTime >= 1000) { // Ensure it's been 1 second
        createFolderFromOverlap(activeOverlap);
      }
      setActiveOverlap(null);
    }
    */
    
    // Check if we're over an open folder window
    // Check if there's an active drop folder (new implementation)
    // @ts-ignore - Custom property
    const activeDropFolder = window._activeDropFolder;
    
    // If we have an active drop folder target and a valid file ID
    if (activeDropFolder?.id && fileId) {
      try {
        console.log(`📂 Moving file ${fileId} into folder ${activeDropFolder.name} (ID: ${activeDropFolder.id})`);
        
        // Get the current files from the query cache
        const desktopFiles = queryClient.getQueryData<{files: DesktopFile[]}>(['/api/files']);
        if (desktopFiles?.files) {
          // Find the file that's being moved
          const fileIndex = desktopFiles.files.findIndex(f => f.id === fileId);
          
          if (fileIndex >= 0) {
            // Clone the files array to avoid mutating the cache directly
            const updatedFiles = [...desktopFiles.files];
            const movedFile = {...updatedFiles[fileIndex]};
            
            // Update the file's parentId to the folder's ID
            movedFile.parentId = activeDropFolder.id;
            
            // Remove the file from desktop view immediately for instant visual feedback
            updatedFiles.splice(fileIndex, 1);
            
            // Update the cache with the file removed from desktop
            queryClient.setQueryData(['/api/files'], {
              files: updatedFiles
            });
            
            // Get folder contents and add the file there immediately
            const folderFilesKey = [`/api/folders/${activeDropFolder.id}/files`];
            const folderContents = queryClient.getQueryData<{files: DesktopFile[]}>(folderFilesKey) || {files: []};
            
            // Update folder contents cache immediately
            queryClient.setQueryData(folderFilesKey, {
              files: [...folderContents.files, movedFile]
            });
            
            // Trigger visuele updates in alle openstaande FolderView componenten
            // @ts-ignore - Custom event
            window.dispatchEvent(new CustomEvent('folder-contents-updated', {
              detail: { 
                folderId: activeDropFolder.id,
                addedFile: movedFile
              }
            }));
            
            // Show success message with folder name
            toast({
              title: "File moved",
              description: `File was moved to "${activeDropFolder.name}" folder successfully.`,
            });
            
            // Clear the active drop folder reference
            // @ts-ignore - Custom property
            window._activeDropFolder = undefined;
            // @ts-ignore - Custom property for backward compatibility
            window._openFolderHoverId = undefined;
            
            // THEN make the actual API call to update the database
            addFileToFolder(fileId, activeDropFolder.id)
              .then(() => {
                console.log("✅ Database updated to match UI changes");
              })
              .catch(error => {
                console.error('Error moving file to open folder:', error);
                toast({
                  title: "Error",
                  description: "Failed to move file to folder.",
                  variant: "destructive"
                });
                // Revert UI changes by refetching data
                queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                queryClient.invalidateQueries({ queryKey: folderFilesKey });
              });
            
            return; // Skip position update since file is now in a folder
          }
        } else {
          // Fallback to direct API call if cache not available
          await addFileToFolder(fileId, activeDropFolder.id);
          
          // Clear the active drop folder reference
          // @ts-ignore - Custom property
          window._activeDropFolder = undefined;
          // @ts-ignore - Custom property for backward compatibility
          window._openFolderHoverId = undefined;
          
          // Show success message with folder name
          toast({
            title: "File moved",
            description: `File was moved to "${activeDropFolder.name}" folder successfully.`,
          });
          
          return; // Skip position update since file is now in a folder
        }
      } catch (error) {
        console.error('Error moving file to open folder:', error);
        toast({
          title: "Error",
          description: "Failed to move file to folder.",
          variant: "destructive"
        });
      }
    }
    
    // Check if we're over a closed folder (using our custom window property)
    // @ts-ignore - Custom window property
    const hoverFolderId = window._hoverFolderId;
    if (hoverFolderId && fileId) {
      try {
        console.log(`🗂️ Moving file ${fileId} into folder ${hoverFolderId}`);
        
        // Get the current files from the query cache
        const desktopFiles = queryClient.getQueryData<{files: DesktopFile[]}>(['/api/files']);
        if (desktopFiles?.files) {
          // Find the file that's being moved
          const fileIndex = desktopFiles.files.findIndex(f => f.id === fileId);
          
          if (fileIndex >= 0) {
            // Clone the files array to avoid mutating the cache directly
            const updatedFiles = [...desktopFiles.files];
            const movedFile = {...updatedFiles[fileIndex]};
            
            // Update the file's parentId to the folder's ID
            movedFile.parentId = hoverFolderId;
            
            // Remove the file from desktop view immediately for instant visual feedback
            updatedFiles.splice(fileIndex, 1);
            
            // Update the cache with the file removed from desktop
            queryClient.setQueryData(['/api/files'], {
              files: updatedFiles
            });
            
            // Get folder contents and add the file there immediately
            const folderFilesKey = [`/api/folders/${hoverFolderId}/files`];
            const folderContents = queryClient.getQueryData<{files: DesktopFile[]}>(folderFilesKey) || {files: []};
            
            // Update folder contents cache immediately
            queryClient.setQueryData(folderFilesKey, {
              files: [...folderContents.files, movedFile]
            });
            
            // Trigger visuele updates in alle openstaande FolderView componenten
            // @ts-ignore - Custom event
            window.dispatchEvent(new CustomEvent('folder-contents-updated', {
              detail: { 
                folderId: hoverFolderId,
                addedFile: movedFile
              }
            }));
            
            // Show success message
            toast({
              title: "File moved",
              description: "File was moved to folder successfully.",
            });
            
            // Clear the hover folder ID
            // @ts-ignore - Custom window property
            window._hoverFolderId = undefined;
            
            // THEN make the actual API call to update the database
            addFileToFolder(fileId, hoverFolderId)
              .then(() => {
                console.log("✅ Database updated to match UI changes");
              })
              .catch(error => {
                console.error('Error moving file to folder:', error);
                toast({
                  title: "Error",
                  description: "Failed to move file to folder.",
                  variant: "destructive"
                });
                // Revert UI changes by refetching data
                queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                queryClient.invalidateQueries({ queryKey: folderFilesKey });
              });
            
            return; // Skip position update since file is now in a folder
          }
        } else {
          // Fallback to direct API call if cache not available
          await addFileToFolder(fileId, hoverFolderId);
          
          // Clear the hover folder ID
          // @ts-ignore - Custom window property
          window._hoverFolderId = undefined;
          
          // Show success message
          toast({
            title: "File moved",
            description: "File was moved to folder successfully.",
          });
          
          return; // Skip position update since file is now in a folder
        }
      } catch (error) {
        console.error('Error moving file to folder:', error);
        toast({
          title: "Error",
          description: "Failed to move file to folder.",
          variant: "destructive"
        });
      }
    }
  };
  
  // Check for file overlaps - UITGESCHAKELD: functie om automatisch mappen te maken is gedeactiveerd
  const checkFileOverlap = (fileId: number | undefined) => {
    // Functie uitgeschakeld op verzoek van de gebruiker
    // De automatische map-creatie functie is nu uitgeschakeld
    
    return; // Early return om geen overlap-detectie uit te voeren
    
    /* UITGESCHAKELDE CODE:
    if (!fileId || !draggingFileId || fileId === draggingFileId) return;
    
    // Clear any existing timeout
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }
    
    const draggedElement = fileElementsRef.current[`file-${draggingFileId}`];
    const targetElement = fileElementsRef.current[`file-${fileId}`];
    
    if (draggedElement && targetElement) {
      const isOverlapping = areFilesOverlapping(draggedElement, targetElement);
      
      if (isOverlapping) {
        // Calculate the midpoint between the two files for folder position
        const draggedRect = draggedElement.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();
        
        const position = {
          x: (draggedRect.left + targetRect.left) / 2,
          y: (draggedRect.top + targetRect.top) / 2
        };
        
        // Start the timer for folder creation
        const overlap: FileOverlap = {
          fileId: draggingFileId,
          targetId: fileId,
          overlapStartTime: Date.now(),
          position
        };
        
        setActiveOverlap(overlap);
        
        // Set timeout for 1 second
        dragTimeoutRef.current = setTimeout(() => {
          createFolderFromOverlap(overlap);
        }, 1000);
      } else if (activeOverlap && 
                (activeOverlap.fileId === draggingFileId || activeOverlap.targetId === fileId)) {
        // Files are no longer overlapping, cancel folder creation
        setActiveOverlap(null);
      }
    }
    */
  };
  
  // Create a folder from overlapping files
  const createFolderFromOverlap = async (overlap: FileOverlap) => {
    try {
      const { fileId, targetId, position } = overlap;
      
      // Open the folder naming dialog with the files to include
      setFolderName("New Folder");
      setPendingFolderPosition(position);
      setPendingFolderFiles([fileId, targetId]);
      setIsFolderDialogOpen(true);
      
      // Clear active overlap
      setActiveOverlap(null);
      
      // Clear any timeout
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('Error creating folder from overlap:', error);
    }
  };

  // Prevent default browser behavior for drag and drop
  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
    };
    
    window.addEventListener('dragover', preventDefaults);
    window.addEventListener('drop', preventDefaults);
    
    return () => {
      window.removeEventListener('dragover', preventDefaults);
      window.removeEventListener('drop', preventDefaults);
    };
  }, []);
  
  // Clean up any timeouts on unmount
  useEffect(() => {
    return () => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-blue-900 to-purple-900 bg-cover bg-center">
      <DesktopToolbar
        fileCount={files.length}
        onUploadClick={handleUploadClick}
        onClearClick={clearAllFiles}
        onSearch={handleSearch}
      />
      
      {searchQuery && (
        <div className="relative bg-gradient-to-r from-blue-900/80 via-primary/60 to-blue-900/80 backdrop-blur-sm py-2 px-4 border-b border-primary/30 shadow-md">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <Search className="h-4 w-4 text-white mr-2" />
              <p className="text-white text-sm font-medium">
                {filteredFiles.length === 0 
                  ? "No files found" 
                  : `Found ${filteredFiles.length} file${filteredFiles.length !== 1 ? 's' : ''} matching `}
                {filteredFiles.length > 0 && (
                  <span className="bg-primary/30 rounded px-1 py-0.5 mx-1 font-semibold">"{searchQuery}"</span>
                )}
              </p>
            </div>
            <button 
              onClick={() => setSearchQuery("")}
              className="text-white text-sm hover:bg-white/10 px-2 py-1 rounded flex items-center transition-colors"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </button>
          </div>
        </div>
      )}

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={canvasRef}
            className={`canvas-area relative flex-1 ${
              isDraggingOver ? "bg-blue-100/20" : ""
            }${searchQuery ? " bg-blue-900/50" : ""}`}
            onClick={handleCanvasClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Folder creation indicator */}
            {activeOverlap && (
              <div 
                className="absolute z-40 pointer-events-none"
                style={{
                  left: `${activeOverlap.position.x - 25}px`,
                  top: `${activeOverlap.position.y - 25}px`,
                  transition: 'all 0.2s ease'
                }}
              >
                <div className="flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-primary/30 backdrop-blur-md flex items-center justify-center animate-pulse">
                    <Folder className="w-6 h-6 text-white" />
                  </div>
                  <div className="mt-1 text-white text-xs font-medium bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">
                    Creating folder...
                  </div>
                </div>
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Spinner className="animate-spin text-white w-8 h-8" />
                <span className="ml-2 text-white text-lg">Loading files...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-white">
                <p className="text-lg">Error loading files. Please try again.</p>
              </div>
            ) : files.length === 0 ? (
              <EmptyState onUploadClick={handleUploadClick} />
            ) : filteredFiles.length === 0 && searchQuery ? (
              <div className="flex flex-col items-center justify-center h-full text-white">
                <div className="p-6 bg-black/20 backdrop-blur-md rounded-lg max-w-md text-center border border-primary/30 shadow-lg">
                  <FolderSearch className="w-16 h-16 mx-auto text-primary/70 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Matches Found</h3>
                  <p className="mb-4 text-gray-300">
                    No files match your fuzzy search for <span className="bg-primary/20 px-2 py-0.5 rounded font-mono">"{searchQuery}"</span>
                  </p>
                  <p className="text-sm text-gray-400 mb-4">Try using shorter search terms or checking for typos</p>
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors duration-200 inline-flex items-center"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Clear Search
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Regular file icons */}
                {filteredFiles.map((file: DesktopFile, index: number) => {
                  // Get the real index from the original files array
                  const realIndex = files.findIndex(f => 
                    (f.id && file.id) ? f.id === file.id : f === file
                  );
                  
                  // All files in filteredFiles match the search criteria when using fuzzy search
                  const isMatch = searchQuery ? true : false;
                  
                  // Skip rendering files that are currently open as windows
                  // or that belong to a folder
                  if (file.id && (openWindowFiles.includes(file.id) || file.parentId)) {
                    return null;
                  }
                  
                  return (
                    <FileItem
                      key={file.id ? `file-${file.id}` : `file-${index}`}
                      file={file}
                      index={realIndex !== -1 ? realIndex : index}
                      isSelected={selectedFile === realIndex}
                      isSearchMatch={isMatch}
                      searchTerm={searchQuery}
                      onSelect={handleSelectFile}
                      onDragEnd={(index, x, y) => {
                        if (file.id) handleFileDragEnd(file.id, x, y);
                        handleFilePositionUpdate(index, x, y);
                      }}
                      onDragStart={(fileId) => handleFileDragStart(fileId)}
                      onDragMove={(fileId) => {
                        checkFileOverlap(fileId);
                        // Check for overlapping folders using our new function
                        checkFileOverFolder(fileId);
                      }}
                      registerRef={registerFileElement}
                      onResize={handleFileResize}
                      onPreview={handlePreviewFile}
                      onRename={updateFileName}
                    />
                  );
                })}
                
                {/* Open files in windows */}
                {openWindowFiles.map((fileId: number) => {
                  const fileIndex = files.findIndex(f => f.id === fileId);
                  if (fileIndex === -1) return null;
                  
                  const file = files[fileIndex];
                  
                  // Check if this is a folder
                  if (file.isFolder === 'true') {
                    return (
                      <FolderView
                        key={`folder-${fileId}`}
                        folder={file}
                        onClose={() => closeWindowFile(fileId)}
                        onSelectFile={handlePreviewFile}
                        onRename={updateFileName}
                      />
                    );
                  }
                  
                  // Regular file window
                  return (
                    <WindowItem
                      key={`window-${fileId}`}
                      file={file}
                      index={fileIndex}
                      isSelected={selectedFile === fileIndex}
                      onSelect={handleSelectFile}
                      onDragEnd={handleFilePositionUpdate}
                      onResize={handleFileResize}
                      onClose={() => closeWindowFile(fileId)}
                    />
                  );
                })}
              </>
            )}
          </div>
        </ContextMenuTrigger>
        
        <ContextMenuContent className="w-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-md">
          <ContextMenuItem 
            onClick={handleCreateNewFolder}
            className="flex items-center cursor-pointer"
          >
            <FolderPlus className="mr-2 h-4 w-4 text-primary" />
            <span>Create new folder</span>
          </ContextMenuItem>
          
          <ContextMenuSeparator />
          
          <ContextMenuItem 
            onClick={handleUploadClick}
            className="flex items-center cursor-pointer"
          >
            <FileUp className="mr-2 h-4 w-4 text-primary" />
            <span>Upload file</span>
          </ContextMenuItem>
          
          <ContextMenuItem 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/files'] })}
            className="flex items-center cursor-pointer"
          >
            <RefreshCw className="mr-2 h-4 w-4 text-primary" />
            <span>Refresh</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={handleFileInputChange}
      />
      
      <FilePreviewModal
        file={previewFile}
        isOpen={isPreviewOpen}
        onClose={closePreview}
      />
      
      {/* Folder naming dialog */}
      <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
            <DialogDescription>
              Enter a name for the new folder.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center space-x-2 mt-4">
            <div className="grid flex-1 gap-2">
              <Input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Folder name"
                className="col-span-3"
                autoFocus
              />
            </div>
          </div>
          
          <DialogFooter className="sm:justify-between mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsFolderDialogOpen(false);
                setPendingFolderPosition(null);
                setPendingFolderFiles(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                // Make sure we have a position
                if (!pendingFolderPosition) return;
                
                try {
                  if (pendingFolderFiles && pendingFolderFiles.length >= 2) {
                    // Create folder from overlapping files with custom name
                    await createFolderFromFiles(pendingFolderFiles, pendingFolderPosition, folderName);
                  } else {
                    // Create a new empty folder
                    await createFolder(folderName, pendingFolderPosition);
                  }
                  
                  // Close the dialog and reset state
                  setIsFolderDialogOpen(false);
                  setPendingFolderPosition(null);
                  setPendingFolderFiles(null);
                } catch (error) {
                  console.error('Error creating folder:', error);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}