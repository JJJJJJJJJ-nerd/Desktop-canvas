import { useState, useRef, useEffect } from "react";
import { DesktopToolbar } from "@/components/DesktopToolbar";
import { FileItem } from "@/components/FileItem";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { EmptyState } from "@/components/EmptyState";
import { useDesktopFiles } from "@/hooks/use-desktop-files";
import { DesktopFile } from "@/types";
import { Loader2 as Spinner } from "lucide-react";

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
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    
    // Pass files to addFiles function
    addFiles(e.dataTransfer.files);
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
  
  // Handle file preview
  const handlePreviewFile = (file: DesktopFile) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
  };
  
  // Close preview modal
  const closePreview = () => {
    setIsPreviewOpen(false);
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
        ) : (
          files.map((file: DesktopFile, index: number) => (
            <FileItem
              key={file.id ? `file-${file.id}` : `file-${index}`}
              file={file}
              index={index}
              isSelected={selectedFile === index}
              onSelect={handleSelectFile}
              onDragEnd={handleFilePositionUpdate}
              onResize={handleFileResize}
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
