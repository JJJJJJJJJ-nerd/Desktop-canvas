import { useState, useEffect } from 'react';
import { FileItem } from './FileItem';
import { DesktopFile } from '@/types';
import { X, FolderOpen, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FolderViewProps {
  folder: DesktopFile;
  onClose: () => void;
  onSelectFile: (file: DesktopFile) => void;
}

export function FolderView({ folder, onClose, onSelectFile }: FolderViewProps) {
  const [files, setFiles] = useState<DesktopFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch files in the folder
  useEffect(() => {
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
      <div className="p-4 h-[calc(100%-40px)] overflow-auto">
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