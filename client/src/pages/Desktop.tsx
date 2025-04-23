import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";
import { DesktopToolbar } from "@/components/DesktopToolbar";
import { FileItem } from "@/components/FileItem";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { WindowItem } from "@/components/WindowItem";
// Gebruik de verplaatsbare iframe venster versie
import { DraggableFolderWindow } from "@/components/DraggableFolderWindow"; // Versleepbaar venster met iframe
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
    
    // Signaleer dat we over het bureaublad zweven - zodat bestanden uit open mappen naar hier gesleept kunnen worden
    // @ts-ignore - Custom property
    window._draggingFileToDesktop = true;
    
    // Bewaar de huidige muispositie voor gebruik als droplocatie bij slepen vanuit mappen
    // @ts-ignore - Custom property
    window._desktopDragPosition = {
      x: e.clientX,
      y: e.clientY
    };
    
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
    
    // Start van uitgebreide logging voor het drop event
    console.log('++++++++++++++++++++ DROP EVENT ++++++++++++++++++++');
    console.log('⬇️ Bestand losgelaten op bureaublad:', {
      positie: { x: e.clientX, y: e.clientY },
      target: e.target
    });
    console.log('📋 DataTransfer inhoud:', {
      types: Array.from(e.dataTransfer.types),
      bestanden: e.dataTransfer.files.length,
      tekstData: e.dataTransfer.getData('text/plain')
    });
    console.log('📊 Drag state bij drop:', {
      _draggingFileFromFolder: window._draggingFileFromFolder,
      draggedFileInfo: window.draggedFileInfo
    });
    
    // Visuele debug indicator (tijdelijk element op drop positie)
    const debugMarker = document.createElement('div');
    debugMarker.style.position = 'fixed';
    debugMarker.style.left = `${e.clientX}px`;
    debugMarker.style.top = `${e.clientY}px`;
    debugMarker.style.width = '20px';
    debugMarker.style.height = '20px';
    debugMarker.style.borderRadius = '50%';
    debugMarker.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
    debugMarker.style.zIndex = '9999';
    debugMarker.style.pointerEvents = 'none';
    debugMarker.setAttribute('data-debug', 'drop-marker');
    document.body.appendChild(debugMarker);
    
    // Verwijder de marker na 3 seconden
    setTimeout(() => {
      document.body.removeChild(debugMarker);
    }, 3000);
    
    // Check for files first (regular file upload)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      console.log('📁 Normale bestandsupload gedetecteerd, aantal bestanden:', e.dataTransfer.files.length);
      // Pass files to addFiles function
      addFiles(e.dataTransfer.files);
      return;
    }
    
    // Check for dragged files from folders (which use dataTransfer.getData)
    try {
      console.log('🔍 Controleren op data in dataTransfer...');
      
      // Probeer meerdere dataformaten te lezen voor betere compatibiliteit
      let fileIdText = "";
      let fileData = null;
      
      // Probeer eerst application/json, dan text/plain
      try {
        if (e.dataTransfer.types.includes('application/json')) {
          const jsonData = e.dataTransfer.getData('application/json');
          if (jsonData) {
            fileData = JSON.parse(jsonData);
            fileIdText = String(fileData.id);
            console.log('📋 Verwerkt uit application/json:', fileData);
          }
        }
      } catch (jsonErr) {
        console.warn('⚠️ Kon JSON data niet verwerken:', jsonErr);
      }
      
      // Als geen JSON data, probeer text/plain
      if (!fileIdText && e.dataTransfer.types.includes('text/plain')) {
        fileIdText = e.dataTransfer.getData('text/plain');
        console.log('📋 Verwerkt uit text/plain:', fileIdText);
      }
      
      // Log alle beschikbare types voor debugging
      console.log('📋 Beschikbare dataTransfer types:', Array.from(e.dataTransfer.types));
      
      // Volledige sleepflow logging
      console.log('📝 SLEEP FLOW DEBUG LOG:');
      console.log('1. DragStart gedetecteerd in FolderView voor bestand', window.draggedFileInfo?.id);
      console.log('2. DataTransfer data ontvangen:', { fileIdText, fileData });
      console.log('3. Window._draggingFileFromFolder flag status =', window._draggingFileFromFolder);
      console.log('4. Drop event ontvangen op bureaublad positie', { x: e.clientX, y: e.clientY });
      
      // Geef prioriteit aan window.draggedFileInfo als het beschikbaar is (meest betrouwbaar)
      const preferredFileId = window.draggedFileInfo?.id || (fileIdText ? parseInt(fileIdText) : null);
      
      if (preferredFileId) {
        console.log(`✅ Geldig bestand ID gedetecteerd: ${preferredFileId}`);
        
        // Markeer het element visueel om te debuggen
        const draggedElement = document.querySelector(`[data-file-id="${preferredFileId}"]`);
        if (draggedElement) {
          draggedElement.classList.add('debug-dragged-element');
          draggedElement.setAttribute('data-debug-status', 'being-moved');
          
          // Visuele hint tonen
          const hint = document.createElement('div');
          hint.innerHTML = `<div style="position:fixed;top:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:10px;border-radius:5px;z-index:9999">Bestand wordt verplaatst: ID ${preferredFileId}</div>`;
          document.body.appendChild(hint);
          
          // Verwijder markers na 5 seconden
          setTimeout(() => {
            draggedElement.classList.remove('debug-dragged-element');
            draggedElement.removeAttribute('data-debug-status');
            document.body.removeChild(hint);
          }, 5000);
        } else {
          console.warn('⚠️ Element voor bestand niet gevonden in de DOM');
        }
        
        // Bevestig dat we op het bureaublad slepen
        window._draggingFileToDesktop = true;
        
        // Check flag of bestand uit map komt
        const isFromFolder = Boolean(window._draggingFileFromFolder) || Boolean(window.draggedFileInfo?.parentId);
        console.log(`🔄 DESKTOP DROP: Bestand komt ${isFromFolder ? 'WEL' : 'NIET'} uit een map`);
        
        if (!isFromFolder) {
          console.log('⚠️ Bestand komt niet uit een map, het verplaatsen wordt overgeslagen');
          toast({
            title: "Niet verplaatst",
            description: "Dit bestand komt niet uit een map en kan niet worden verplaatst.",
            duration: 3000,
          });
          return;
        }
        
        // We found a valid file ID from a folder
        // Remove from folder and place on desktop at the exact position where dropped
        try {
          // Gebruik de exacte muispositie voor het plaatsen van het bestand
          const dropPosition = {
            x: e.clientX,
            y: e.clientY
          };
          
          console.log(`⬇️ DESKTOP DROP POSITIE: ${dropPosition.x}, ${dropPosition.y}`);
          
          // Verkrijg het parent ID uit de draggedFileInfo (indien beschikbaar)
          const parentFolderId = window.draggedFileInfo?.parentId;
          
          console.log(`📂 PARENT FOLDER ID: ${parentFolderId || 'niet gevonden'}`);
          console.log(`🔄 REMOVING FILE ${preferredFileId} FROM FOLDER ${parentFolderId || 'unknown'}`);
          
          if (!parentFolderId) {
            console.warn('⚠️ Geen parent folder ID gevonden, dit kan het verplaatsen beïnvloeden');
          }
          
          console.log('🔌 API AANROEP: Bestand uit map verwijderen:', {
            bestandId: preferredFileId,
            mapId: parentFolderId,
            nieuwePositie: dropPosition
          });
          
          // Verwijderen uit map en direct op bureaubladpositie plaatsen
          const result = await removeFileFromFolder(preferredFileId, dropPosition, parentFolderId);
          
          console.log('🔌 API RESPONSE:', {
            status: 'success',
            updatedFile: result?.file,
            parentId: result?.parentId
          });
          
          // Toon een toast-melding
          toast({
            title: "Bestand verplaatst",
            description: "Bestand is verplaatst naar het bureaublad op de exacte plaats waar je het losliet.",
            duration: 3000,
          });
          
          // Reset the dragging state
          window._draggingFileFromFolder = false;
          window.draggedFileInfo = undefined;
          
          console.log('✅ Verplaatsing voltooid en status gereset');
          console.log('++++++++++++++++++++++++++++++++++++++++++++++++++++++');
        } catch (error) {
          console.error('❌ FOUT bij verplaatsen van bestand naar bureaublad:', error);
          console.log('❌ FOUT bij sleepoperatie:', {
            fase: 'drop',
            foutmelding: (error as Error).message,
            details: error
          });
          toast({
            title: "Fout",
            description: "Er ging iets mis bij het verplaatsen van het bestand.",
            variant: "destructive"
          });
        }
      } else {
        console.error('❌ Geen geldig bestand ID in dataTransfer:', fileIdText);
      }
    } catch (error) {
      console.error('❌ FOUT bij verwerken van drop event:', error);
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
  
  // Preload folder contents voor betere snelheid
  useEffect(() => {
    // Alleen folders identificeren
    const folderIds = files
      .filter(file => file.type === 'folder')
      .map(folder => folder.id)
      .filter((id): id is number => id !== undefined);
      
    // Preload folder contents maar slechts één tegelijk met 500ms timeout
    const preloadFolder = async (index: number) => {
      if (index >= folderIds.length) return;
      
      const folderId = folderIds[index];
      
      try {
        // Voeg cache-busting toe door een timestamp
        await fetch(`/api/folders/${folderId}/files?t=${Date.now()}`);
        console.log(`[Preload] Mapinhoud voor map ${folderId} is voorgeladen`);
      } catch (err) {
        console.error(`[Preload] Fout bij voorladen map ${folderId}:`, err);
      }
      
      // Laad de volgende map na 500ms
      setTimeout(() => preloadFolder(index + 1), 500);
    };
    
    // Start het voorladen als er mappen zijn
    if (folderIds.length > 0) {
      preloadFolder(0);
    }
  }, [files]);

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
    // Only process if we're actually dragging a file
    // @ts-ignore - Using custom window property
    const isDraggingFile = window.draggedFileInfo && window.draggedFileInfo.id;
    
    if (draggingFileId && isDraggingFile) {
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
    } else if (!isDraggingFile) {
      // Clear all folder highlights if we're not dragging
      Object.values(folderRefs).forEach(element => {
        element.classList.remove('folder-highlight-dragover');
      });
      
      // Clear the hover folder ID
      // @ts-ignore - Custom property
      window._hoverFolderId = undefined;
    }
  }, [draggingFileId, folderRefs]);
  
  // Attach/detach global mouse tracking
  useEffect(() => {
    document.addEventListener('mousemove', handleGlobalMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [handleGlobalMouseMove]);

  // Create folder from overlapping files when held together for a set duration
  const createFolderFromOverlap = async (overlap: FileOverlap) => {
    // Get files from overlap
    try {
      // Generate a position that's the average of the two files
      const position = overlap.position;
      
      // Open folder naming dialog
      setFolderName("Nieuwe map");
      setPendingFolderPosition(position);
      setPendingFolderFiles([overlap.fileId, overlap.targetId]);
      setIsFolderDialogOpen(true);
      
      // Clear the active overlap
      setActiveOverlap(null);
      
      // Clear any pending timeouts
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }
      
      console.log("✅ Dialoog geopend voor nieuwe map maken van overlappende bestanden");
    } catch (error) {
      console.error("❌ Fout bij het maken van een map van overlappende bestanden:", error);
      toast({
        title: "Fout",
        description: "Kon geen map maken van deze bestanden.",
        variant: "destructive"
      });
    }
  };
  
  // When files are dragged on top of each other, set a timer to create a folder
  useEffect(() => {
    // Skip if no active overlap
    if (!activeOverlap) return;
    
    // Clear any existing timeout
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }
    
    // Set a timeout to create a folder if the overlap persists
    dragTimeoutRef.current = setTimeout(() => {
      if (activeOverlap) {
        createFolderFromOverlap(activeOverlap);
      }
    }, 1500); // 1.5 seconds
    
    // Cleanup when component unmounts or overlap changes
    return () => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };
  }, [activeOverlap]);

  // Submit the folder name dialog
  const handleSubmitFolderName = async () => {
    if (pendingFolderPosition) {
      try {
        if (pendingFolderFiles) {
          // Create a folder from the pending files
          await createFolderFromFiles(pendingFolderFiles, pendingFolderPosition, folderName);
        } else {
          // Create a new empty folder
          await createFolder(folderName, pendingFolderPosition);
        }
        
        // Close the dialog and reset state
        setIsFolderDialogOpen(false);
        setFolderName("");
        setPendingFolderPosition(null);
        setPendingFolderFiles(null);
        
        // Clear the active overlap
        setActiveOverlap(null);
        
        // Clear any pending timeouts
        if (dragTimeoutRef.current) {
          clearTimeout(dragTimeoutRef.current);
          dragTimeoutRef.current = null;
        }
        
        // Show a success message
        toast({
          title: "Map aangemaakt",
          description: `De map "${folderName}" is aangemaakt.`,
        });
      } catch (error) {
        console.error("❌ Fout bij aanmaken van map:", error);
        
        toast({
          title: "Fout",
          description: "Er is een fout opgetreden bij het maken van de map.",
          variant: "destructive"
        });
      }
    }
  };

  // Handle clearing all files
  const handleClearClick = () => {
    if (window.confirm('Weet je zeker dat je alle bestanden wilt verwijderen?')) {
      clearAllFiles();
    }
  };

  // Handle renaming a file
  const handleRenameFile = (fileId: number, newName: string) => {
    updateFileName(fileId, newName);
  };

  // Reset all timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }
    };
  }, []);

  // Render the loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Spinner className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg font-medium">Bestanden laden...</p>
        </div>
      </div>
    );
  }

  // Render the error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-red-500 mx-auto mb-4">
            <X className="h-10 w-10" />
          </div>
          <p className="text-lg">Error loading files. Please try again.</p>
          <button
            className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Toolbar */}
      <DesktopToolbar
        fileCount={filteredFiles.length}
        onUploadClick={handleUploadClick}
        onClearClick={handleClearClick}
        onSearch={handleSearch}
      />
      
      {/* Desktop area with folders and files */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={canvasRef}
            className="flex-1 relative overflow-auto bg-slate-100 canvas-area"
            onClick={handleCanvasClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* If there are no files, show the empty state */}
            {filteredFiles.length === 0 && !searchQuery && (
              <EmptyState onUploadClick={handleUploadClick} />
            )}
            
            {/* Render the files */}
            {filteredFiles.map((file: DesktopFile, index: number) => {
              // Skip files that are inside folders
              if (file.parentId) return null;
              
              // Check if this file needs to be displayed in a window
              const isWindowOpen = file.id && openWindowFiles.includes(file.id);
              
              // Based on the file type, render the appropriate component
              if (isWindowOpen) {
                if (isExcelFile(file)) {
                  return (
                    <WindowItem
                      key={`window-${file.id || index}`}
                      file={file}
                      index={index}
                      isSelected={selectedFile === index}
                      onSelect={handleSelectFile}
                      onDragEnd={handleFilePositionUpdate}
                      onResize={handleFileResize}
                      onClose={() => file.id && closeWindowFile(file.id)}
                    />
                  );
                } else if (file.type === 'folder' || file.isFolder === 'true') {
                  return (
                    <DraggableFolderWindow
                      key={`folder-${file.id || index}`}
                      folder={file}
                      onClose={() => file.id && closeWindowFile(file.id)}
                      onDragEnd={(id, x, y) => updateFilePosition(id, x, y)}
                    />
                  );
                }
              }
              
              // Regular file item on desktop
              return (
                <FileItem
                  key={`file-${file.id || index}`}
                  file={file}
                  index={index}
                  isSelected={selectedFile === index}
                  isSearchMatch={searchQuery.length > 0}
                  searchTerm={searchQuery}
                  onSelect={handleSelectFile}
                  onDragEnd={handleFilePositionUpdate}
                  onDragStart={(fileId) => setDraggingFileId(fileId)}
                  onDragMove={() => {}}
                  onResize={handleFileResize}
                  onPreview={handlePreviewFile}
                  registerRef={registerFileElement}
                  onRename={handleRenameFile}
                />
              );
            })}
            
            {/* File preview modal */}
            <FilePreviewModal
              file={previewFile}
              isOpen={isPreviewOpen}
              onClose={closePreview}
            />
            
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileInputChange}
              multiple
            />
          </div>
        </ContextMenuTrigger>
        
        {/* Context menu for right-click on desktop */}
        <ContextMenuContent>
          <ContextMenuItem onClick={handleCreateNewFolder}>
            <FolderPlus className="mr-2 h-4 w-4" />
            Nieuwe map
          </ContextMenuItem>
          <ContextMenuItem onClick={handleUploadClick}>
            <Upload className="mr-2 h-4 w-4" />
            Bestand uploaden
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Verversen
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      
      {/* Folder naming dialog */}
      <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe map</DialogTitle>
            <DialogDescription>
              Geef een naam op voor de nieuwe map.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Nieuwe map"
            className="mt-4"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFolderDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleSubmitFolderName}>Aanmaken</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}