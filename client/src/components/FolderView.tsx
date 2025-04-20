import { useState, useEffect, useRef } from 'react';
import { FileItem } from './FileItem';
import { DesktopFile } from '@/types';
import { X, FolderOpen, ArrowLeft, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { queryClient } from '@/lib/queryClient';

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
  
  const dropAreaRef = useRef<HTMLDivElement>(null);

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

  // Initial fetch of files
  useEffect(() => {
    if (folder.id) {
      fetchFiles();
    }
  }, [folder.id]);

  return (
    <div className="absolute bg-white/95 backdrop-blur-md rounded-lg shadow-xl overflow-hidden"
      style={{
        width: folder.dimensions?.width || 600,
        height: folder.dimensions?.height || 400,
        left: folder.position.x,
        top: folder.position.y,
        zIndex: 50
      }}
    >
      {/* Window header */}
      <div className="bg-primary/90 text-white py-2 px-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FolderOpen className="w-5 h-5" />
          <h3 className="font-medium text-sm">{folder.name}</h3>
        </div>
        <button 
          onClick={onClose}
          className="text-white/80 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Window content */}
      <div 
        ref={dropAreaRef}
        className={`p-4 h-[calc(100%-40px)] overflow-auto ${isDraggingOver ? 'bg-primary/10 ring-2 ring-primary/30 ring-inset' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FolderOpen className="w-12 h-12 mb-2 opacity-30" />
            <p>This folder is empty</p>
            <p className="text-xs mt-2 text-gray-400">Drag and drop files here</p>
            <div className="mt-4 p-2 border-2 border-dashed border-gray-300 rounded-lg">
              <Upload className="w-6 h-6 text-gray-400" />
            </div>
          </div>
        ) : (
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
        {isDraggingOver && (
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="bg-white p-4 rounded-lg shadow-lg text-center">
              <Upload className="w-10 h-10 mx-auto text-primary mb-2" />
              <p className="text-sm font-medium text-gray-700">Drop files to add them to this folder</p>
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