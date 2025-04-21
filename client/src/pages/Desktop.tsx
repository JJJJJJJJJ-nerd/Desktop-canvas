import { useState, useRef, useEffect, useMemo } from "react";
import { queryClient } from "@/lib/queryClient";
import { DesktopToolbar } from "@/components/DesktopToolbar";
import { FileItem } from "@/components/FileItem";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { WindowItem } from "@/components/WindowItem";
import { FolderView } from "@/components/FolderView";
import { EmptyState } from "@/components/EmptyState";
import { useDesktopFiles } from "@/hooks/use-desktop-files";
import { DesktopFile } from "@/types";
import { Loader2 as Spinner, Search, X, FileText, FolderSearch, Folder, FolderOpen, FolderPlus, RefreshCw, FileUp } from "lucide-react";
import Fuse from 'fuse.js';
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
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
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
      const fileId = parseInt(fileIdText);
      if (!isNaN(fileId)) {
        // We found a valid file ID, so this must be a file from a folder
        // Remove from folder and place on desktop
        try {
          await removeFileFromFolder(fileId);
          console.log('File removed from folder and placed on desktop:', fileId);
        } catch (error) {
          console.error('Error moving file to desktop:', error);
        }
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
  useEffect(() => {
    if (!searchQuery) {
      // If no search query, show all files
      setFilteredFiles(files);
    } else {
      // Use fuzzy search to find matches
      const results = fuse.search(searchQuery);
      // Extract the items from results and sort them by score
      const filtered = results.map(result => result.item);
      setFilteredFiles(filtered);
    }
  }, [searchQuery, files, fuse]);
  
  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Register file element refs for overlap detection
  const registerFileElement = (id: number | undefined, element: HTMLElement | null) => {
    if (id && element) {
      fileElementsRef.current[`file-${id}`] = element;
    }
  };
  
  // Handle file drag start
  const handleFileDragStart = (fileId: number | undefined) => {
    if (fileId) {
      setDraggingFileId(fileId);
    }
  };
  
  // Handle file drag end - check for overlaps and create folder if needed
  const handleFileDragEnd = (fileId: number | undefined, x: number, y: number) => {
    if (!fileId) return;
    
    // Clear dragging state
    setDraggingFileId(null);
    
    // Clear any active overlap timeout
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }
    
    // If we had an active overlap, create a folder
    if (activeOverlap && activeOverlap.fileId === fileId) {
      const now = Date.now();
      if (now - activeOverlap.overlapStartTime >= 1000) { // Ensure it's been 1 second
        createFolderFromOverlap(activeOverlap);
      }
      setActiveOverlap(null);
    }
  };
  
  // Check for file overlaps
  const checkFileOverlap = (fileId: number | undefined) => {
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
                      onDragMove={(fileId) => checkFileOverlap(fileId)}
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
            <span>Nieuwe map maken</span>
          </ContextMenuItem>
          
          <ContextMenuSeparator />
          
          <ContextMenuItem 
            onClick={handleUploadClick}
            className="flex items-center cursor-pointer"
          >
            <FileUp className="mr-2 h-4 w-4 text-primary" />
            <span>Bestand uploaden</span>
          </ContextMenuItem>
          
          <ContextMenuItem 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/files'] })}
            className="flex items-center cursor-pointer"
          >
            <RefreshCw className="mr-2 h-4 w-4 text-primary" />
            <span>Vernieuwen</span>
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
            <DialogTitle>Map maken</DialogTitle>
            <DialogDescription>
              Geef een naam aan de nieuwe map.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center space-x-2 mt-4">
            <div className="grid flex-1 gap-2">
              <Input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Map naam"
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
              Annuleren
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
              Maken
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}