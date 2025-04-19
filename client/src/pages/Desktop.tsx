import { useState, useRef, useEffect } from "react";
import { DesktopToolbar } from "@/components/DesktopToolbar";
import { FileItem } from "@/components/FileItem";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { EmptyState } from "@/components/EmptyState";
import { useDesktopFiles } from "@/hooks/use-desktop-files";
import { getRandomPosition } from "@/utils/file-utils";
import { DesktopFile } from "@/types";
import { apiRequest } from "@/lib/queryClient";

export default function Desktop() {
  const {
    files,
    selectedFile,
    addFiles,
    updateFilePosition,
    clearAllFiles,
    selectFile,
  } = useDesktopFiles();
  const [previewFile, setPreviewFile] = useState<DesktopFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Handle upload button click
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file selection from file input
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const canvasWidth = canvasRef.current?.clientWidth || window.innerWidth;
    const canvasHeight = canvasRef.current?.clientHeight || window.innerHeight;
    
    const filesArray = Array.from(e.target.files);
    const newFiles: DesktopFile[] = [];
    
    for (const file of filesArray) {
      // Read file as data URL
      const dataUrl = await readFileAsDataURL(file);
      
      newFiles.push({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl,
        position: getRandomPosition(canvasWidth, canvasHeight)
      });
    }
    
    addFiles(newFiles);
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Read file as data URL
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          resolve(event.target.result);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
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
    
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    
    const canvasWidth = canvasRef.current?.clientWidth || window.innerWidth;
    const canvasHeight = canvasRef.current?.clientHeight || window.innerHeight;
    
    const filesArray = Array.from(e.dataTransfer.files);
    const newFiles: DesktopFile[] = [];
    
    for (const file of filesArray) {
      // Read file as data URL
      const dataUrl = await readFileAsDataURL(file);
      
      // Generate a position near the drop point, but ensure it's within the canvas
      const x = Math.min(Math.max(e.clientX - 50, 0), canvasWidth - 100);
      const y = Math.min(Math.max(e.clientY - 50, 0), canvasHeight - 100);
      
      newFiles.push({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl,
        position: { x, y }
      });
    }
    
    addFiles(newFiles);
  };

  // Handle canvas click (deselects files)
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      selectFile(null);
    }
  };

  // Handle file selection
  const handleSelectFile = (index: number) => {
    selectFile(index);
  };
  
  // Handle file position update
  const handleFilePositionUpdate = (index: number, x: number, y: number) => {
    updateFilePosition(index, x, y);
  };
  
  // Handle file preview
  const handlePreviewFile = (file: DesktopFile) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
  };
  
  // Close preview modal
  const closePreview = () => {
    setIsPreviewOpen(false);
  };

  // Save files to server (optional)
  const saveFilesToServer = async () => {
    try {
      await apiRequest('POST', '/api/desktop/save', { files });
      console.log('Desktop state saved to server');
    } catch (error) {
      console.error('Failed to save desktop state to server:', error);
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

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-blue-900 to-purple-900 bg-cover bg-center">
      <DesktopToolbar
        fileCount={files.length}
        onUploadClick={handleUploadClick}
        onClearClick={clearAllFiles}
      />
      
      <div
        ref={canvasRef}
        className={`canvas-area relative flex-1 ${
          isDraggingOver ? "bg-blue-100/20" : ""
        }`}
        onClick={handleCanvasClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {files.length === 0 ? (
          <EmptyState onUploadClick={handleUploadClick} />
        ) : (
          files.map((file, index) => (
            <FileItem
              key={`${file.name}-${index}`}
              file={file}
              index={index}
              isSelected={selectedFile === index}
              onSelect={handleSelectFile}
              onDragEnd={handleFilePositionUpdate}
              onPreview={handlePreviewFile}
            />
          ))
        )}
      </div>
      
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
    </div>
  );
}
