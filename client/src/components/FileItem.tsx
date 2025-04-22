import { useRef, useState, useEffect, Fragment } from "react";
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
      
      // Force refresh the desktop files - this is crucial to make files disappear from desktop
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      
      return result;
    } catch (error) {
      console.error('Error adding file to folder:', error);
      throw error;
    }
  };
  
  // Remove file from folder (place back on desktop)
  const removeFileFromFolder = async (fileId: number) => {
    try {
      console.log(`Removing file ${fileId} from its current folder`);
      const response = await fetch(`/api/folders/files/${fileId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove file from folder');
      }
      
      const result = await response.json();
      console.log('File removed from folder successfully:', result);
      
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
        
        // Set the dragged file ID as data
        e.dataTransfer.setData('text/plain', file.id.toString());
        e.dataTransfer.effectAllowed = 'move';
        
        // Store the currently dragged file ID in a global object for folder detection
        // @ts-ignore - Adding custom property to window
        window.draggedFileInfo = {
          id: file.id,
          name: file.name,
          isFolder: file.isFolder === 'true'
        };
        
        // Add classes to show we're dragging
        if (e.currentTarget) {
          e.currentTarget.classList.add('dragging-element');
        }
        
        // For our custom drag logic
        if (onDragStart) {
          onDragStart(file.id);
        }
      }
    },
    onDragEnd: (e: React.DragEvent) => {
      console.log(`🖱️ DRAG END: Stopped dragging ${file.isFolder === 'true' ? 'folder' : 'file'} ${file.name}`);
      
      // Remove the dragging class when drag ends
      if (e.currentTarget) {
        e.currentTarget.classList.remove('dragging-element');
      }
      
      // Clear the global drag reference
      // @ts-ignore - Clearing custom property
      window.draggedFileInfo = undefined;
    }
  };
  
  // State for the drop target (only for folders)
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Add drop target capabilities for folders
  const dropTargetProps = file.isFolder === 'true' ? {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Only highlight if dragging a file element (via data transfer, not upload)
      const hasFileId = e.dataTransfer.types.includes('text/plain');
      
      if (hasFileId) {
        // Show that we can drop here (visual cursor feedback)
        e.dataTransfer.dropEffect = 'move';
        
        // Use our global tracking object to see which file is being dragged
        // @ts-ignore - Using custom window property
        const draggedInfo = window.draggedFileInfo;
        
        if (draggedInfo && file.id) {
          // Only set drag over if not already set
          if (!isDragOver) {
            setIsDragOver(true);
            console.log(`📂 DRAG OVER: File ${draggedInfo.name} (ID: ${draggedInfo.id}) is hovering over folder ${file.name} (ID: ${file.id})`);
            
            // Also set up the global folder tracking
            if (file.isFolder === 'true') {
              // @ts-ignore - Custom property
              window._hoverFolderId = file.id;
              
              // Also update the activeDropFolder property for consistency with open folders
              // @ts-ignore - Custom property
              window._activeDropFolder = {
                id: file.id,
                name: file.name,
                element: fileRef.current,
                timestamp: Date.now()
              };
              
              console.log(`✓ FOLDER READY: Closed folder ${file.name} (ID: ${file.id}) is now ready to receive files`);
            }
          }
        }
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // We need to check if we're truly leaving the folder or just entering a child element
      // to prevent flickering when moving around
      setTimeout(() => {
        setIsDragOver(false);
        console.log(`📂 DRAG LEFT: Cursor left folder ${file.name}`);
        
        // Clear the hover folder IDs when truly leaving
        if (file.isFolder === 'true' && file.id) {
          // @ts-ignore - Custom property
          if (window._hoverFolderId === file.id) {
            // @ts-ignore - Custom property
            window._hoverFolderId = undefined;
          }
          
          // Also clear the activeDropFolder property
          // @ts-ignore - Custom property
          if (window._activeDropFolder?.id === file.id) {
            console.log(`❌ CLEARING DROP TARGET: Folder ${file.name} is no longer a drop target`);
            // @ts-ignore - Custom property
            window._activeDropFolder = undefined;
          }
        }
      }, 50); // Small delay to ensure we're not just moving between child elements
    },
    onDrop: async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      
      console.log(`🎯 DROP SUCCESS: File dropped into folder ${file.name} (ID: ${file.id})`);
      
      // Clear all folder hover tracking
      // @ts-ignore - Custom property
      window._activeDropFolder = undefined;
      // @ts-ignore - Custom property
      window._hoverFolderId = undefined;
      // @ts-ignore - Custom property for backward compatibility
      window._openFolderHoverId = undefined;
      
      if (file.id) {
        const data = e.dataTransfer.getData('text/plain');
        if (data) {
          try {
            const fileId = parseInt(data);
            if (!isNaN(fileId)) {
              // Get info about the dragged file
              const allDesktopFiles = queryClient.getQueryData<any>(['/api/files'])?.files || [];
              const droppedFile = allDesktopFiles.find((f: any) => f.id === fileId);
              
              console.log(`📁 DROP DETECTED: File ${fileId} dropped into folder ${file.id} (${file.name})`);
              console.log(`📁 TELEPORTING: Beginning teleport animation for ${droppedFile?.name || 'unknown file'}...`);
              
              // Don't allow dropping a folder into itself or any circular references
              if (fileId === file.id || droppedFile?.isFolder === 'true') {
                console.log('Cannot drop a folder into itself or another folder');
                return;
              }
              
              // Find the dragged file's DOM element
              const draggedFileElement = document.querySelector(`[data-file-id="${fileId}"]`);
              if (draggedFileElement) {
                // Add teleport animation class
                draggedFileElement.classList.add('teleport-out');
              }
              
              // Add receiving animation to folder
              if (fileRef.current) {
                fileRef.current.classList.add('folder-receive');
                setTimeout(() => {
                  if (fileRef.current) {
                    fileRef.current.classList.remove('folder-receive');
                  }
                }, 500);
              }
              
              if (droppedFile && droppedFile.parentId) {
                // First remove from current folder
                await removeFileFromFolder(fileId);
              }
              
              // Now add to this folder - slight delay for animation to complete
              setTimeout(async () => {
                if (file.id !== undefined && typeof file.id === 'number') {
                  await addFileToFolder(fileId, file.id);
                  
                  // Refresh desktop files - this is crucial to make files disappear from desktop
                  queryClient.invalidateQueries({ queryKey: ['/api/files'] });
                }
              }, 300);
            }
          } catch (error) {
            console.error('Error dropping file into folder:', error);
          }
        }
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
  useEffect(() => {
    if (registerRef && fileRef.current) {
      registerRef(file.id, fileRef.current);
    }
    
    return () => {
      if (registerRef) {
        registerRef(file.id, null);
      }
    };
  }, [file.id, registerRef]);

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
              dragging && "z-50 shadow-xl pointer-events-none", // Toegevoegd pointer-events-none om door open folders te kunnen gaan
              isSearchMatch && "animate-pulse shadow-xl shadow-primary/20",
              isSearchMatch && !isSelected && "ring-2 ring-yellow-400 z-10",
              isFolder && (isDragOver || file.id === (window as any)._hoverFolderId) && "ring-2 ring-green-500 shadow-lg bg-green-50/90 folder-highlight"
            )}
            style={{
              left: `${localPosition.x}px`,
              top: `${localPosition.y}px`,
              width: isImage && file.dimensions ? `${file.dimensions.width}px` : 'auto',
              transition: dragging ? 'none' : 'all 0.15s ease',
              zIndex: dragging ? 900 : (isSelected ? 100 : 10) // Higher z-index when dragging but still below open folders
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
