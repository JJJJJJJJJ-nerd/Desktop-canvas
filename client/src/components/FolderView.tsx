import { useState, useEffect, useRef } from 'react';
import { FileItem } from './FileItem';
import { DesktopFile } from '@/types';
import { X, FolderOpen, ArrowLeft, Upload, Check, Folder, MoveRight, FileX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';

interface FolderViewProps {
  folder: DesktopFile;
  onClose: () => void;
  onSelectFile: (file: DesktopFile) => void;
}

export function FolderView({ folder, onClose, onSelectFile }: FolderViewProps) {
  const [files, setFiles] = useState<DesktopFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<number[]>([]);
  const [externalFiles, setExternalFiles] = useState<DesktopFile[]>([]);
  const [position, setPosition] = useState({ x: folder.position.x, y: folder.position.y });
  const [isDragging, setIsDragging] = useState(false);
  
  const dropAreaRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });

  // Handle drag over events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  // Handle drag leave events
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  // Handle drop events
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    
    // Check if files were dropped
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
    } else if (e.dataTransfer.getData('text/plain')) {
      // This might be a file ID dragged from desktop
      try {
        const fileId = parseInt(e.dataTransfer.getData('text/plain'));
        if (!isNaN(fileId) && folder.id) {
          await addFileToFolder(fileId, folder.id);
          // Refresh folder contents and desktop files
          fetchFiles();
          queryClient.invalidateQueries({ queryKey: ['/api/files'] });
        }
      } catch (error) {
        console.error('Error adding file to folder:', error);
      }
    }
  };
  
  // Add file to folder
  const addFileToFolder = async (fileId: number, folderId: number) => {
    try {
      const response = await fetch(`/api/folders/${folderId}/files/${fileId}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to add file to folder');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error adding file to folder:', error);
      throw error;
    }
  };

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

  // Mouse event handlers for dragging the folder
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Calculate offset between mouse position and window top-left corner
    startPosRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    
    // Immediately start dragging - no delay needed
    setIsDragging(true);
    
    // Add document-level event listeners for dragging
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    // Only proceed if we're in dragging mode
    if (!isDragging) return;
    
    e.preventDefault();
    
    // Calculate new position - ensure we stay within boundaries
    const newX = Math.max(0, e.clientX - startPosRef.current.x);
    const newY = Math.max(0, e.clientY - startPosRef.current.y);
    
    // Update position immediately
    setPosition({ x: newX, y: newY });
  };
  
  const handleMouseUp = async (e: MouseEvent) => {
    // Only proceed if we were dragging
    if (!isDragging) return;
    
    e.preventDefault();
    
    // Stop dragging state
    setIsDragging(false);
    
    // Save the new position to the server
    if (folder.id) {
      try {
        // Use integer values to prevent serialization issues
        const posX = Math.round(position.x);
        const posY = Math.round(position.y);
        
        console.log(`Saving folder position: ${posX}, ${posY}`);
        
        // Update file position in database
        const response = await fetch(`/api/files/${folder.id}/position`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            x: posX, 
            y: posY 
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Failed to save folder position:', errorData);
        } else {
          console.log('Successfully saved folder position');
        }
      } catch (error) {
        console.error('Error saving folder position:', error);
      }
    }
    
    // Clean up event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
  
  // Initial fetch of files and cleanup event listeners
  useEffect(() => {
    if (folder.id) {
      fetchFiles();
    }
    
    // Cleanup function to remove event listeners
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [folder.id]);

  return (
    <div className="absolute bg-white/95 backdrop-blur-md rounded-lg shadow-xl overflow-hidden"
      style={{
        width: folder.dimensions?.width || 600,
        height: folder.dimensions?.height || 400,
        left: position.x,
        top: position.y,
        zIndex: isDragging ? 100 : 50,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* Window header - drag handle */}
      <div 
        ref={headerRef}
        className="bg-primary/90 text-white py-2 px-3 flex items-center justify-between cursor-grab select-none"
        onMouseDown={handleHeaderMouseDown}>
        <div className="flex items-center space-x-2">
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
        className={`p-4 h-[calc(100%-40px)] overflow-auto ${isDraggingOver ? 'bg-primary/10 ring-2 ring-primary/30 ring-inset' : ''}`}
        onDragOver={!isSelectMode ? handleDragOver : undefined}
        onDragLeave={!isSelectMode ? handleDragLeave : undefined}
        onDrop={!isSelectMode ? handleDrop : undefined}
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
          <div className="grid grid-cols-4 gap-4">
            {files.map((file) => (
              <div 
                key={file.id} 
                className="file-item flex flex-col items-center justify-center p-2 rounded hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => onSelectFile(file)}
              >
                <FileItemPreview file={file} />
                <p className="text-xs font-medium mt-1 text-center truncate w-full">{file.name}</p>
              </div>
            ))}
          </div>
        )}
        
        {/* Drag overlay */}
        {isDraggingOver && !isSelectMode && (
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="bg-white p-4 rounded-lg shadow-lg text-center">
              <div className="flex gap-2 justify-center mb-2">
                <MoveRight className="w-10 h-10 text-primary" />
                <Upload className="w-10 h-10 text-primary" />
              </div>
              <p className="text-sm font-medium text-gray-700">Drop files to move them into this folder</p>
            </div>
          </div>
        )}
      </div>
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