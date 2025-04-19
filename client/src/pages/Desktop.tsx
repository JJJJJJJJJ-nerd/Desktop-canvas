import { useState, useRef, useEffect, useMemo } from "react";
import { DesktopToolbar } from "@/components/DesktopToolbar";
import { FileItem } from "@/components/FileItem";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { EmptyState } from "@/components/EmptyState";
import { useDesktopFiles } from "@/hooks/use-desktop-files";
import { DesktopFile } from "@/types";
import { Loader2 as Spinner, Search, X, FileText, FolderSearch } from "lucide-react";
import Fuse from 'fuse.js';

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
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredFiles, setFilteredFiles] = useState<DesktopFile[]>([]);
  
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
          filteredFiles.map((file: DesktopFile, index: number) => {
            // Get the real index from the original files array
            const realIndex = files.findIndex(f => 
              (f.id && file.id) ? f.id === file.id : f === file
            );
            
            // All files in filteredFiles match the search criteria when using fuzzy search
            const isMatch = searchQuery ? true : false;
            
            return (
              <FileItem
                key={file.id ? `file-${file.id}` : `file-${index}`}
                file={file}
                index={realIndex !== -1 ? realIndex : index}
                isSelected={selectedFile === realIndex}
                isSearchMatch={isMatch}
                searchTerm={searchQuery}
                onSelect={handleSelectFile}
                onDragEnd={handleFilePositionUpdate}
                onResize={handleFileResize}
                onPreview={handlePreviewFile}
              />
            );
          })
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
