import { useRef, useState, useEffect, Fragment } from "react";
import { DesktopFile } from "@/types";
import { getFileIcon, formatFileSize } from "@/utils/file-utils";
import { cn } from "@/lib/utils";
import { Maximize2 } from "lucide-react";

// Function to highlight text matches in a string
function highlightMatchedText(text: string, searchTerm: string) {
  if (!searchTerm) return text;
  
  const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
  return parts.map((part, index) => 
    part.toLowerCase() === searchTerm.toLowerCase() ? (
      <span key={index} className="bg-yellow-400 text-black px-0.5 rounded">
        {part}
      </span>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  );
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
  onPreview
}: FileItemProps) {
  const fileRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: file.position.x, y: file.position.y });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStartPos = useRef<{ x: number, y: number, width: number, height: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const fileIcon = getFileIcon(file.type);
  const isImage = file.type.startsWith('image/');
  
  // Set initial dimensions from file or defaults
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => {
    if (file.dimensions) {
      return file.dimensions;
    }
    return isImage ? { width: 192, height: 160 } : { width: 96, height: 96 };
  });

  // Update position state when file position changes from props
  useEffect(() => {
    if (!isDragging) {
      setPosition({ x: file.position.x, y: file.position.y });
    }
  }, [file.position, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    
    onSelect(index);
    
    if (fileRef.current) {
      const rect = fileRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      setIsDragging(true);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      
      setPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (isDragging) {
      // Update the server with the final position
      onDragEnd(index, position.x, position.y);
      setIsDragging(false);
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
  };

  const handleDoubleClick = () => {
    onPreview(file);
  };
  
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

  return (
    <div
      ref={fileRef}
      className={cn(
        "file-item absolute backdrop-blur-sm rounded-lg shadow-md relative",
        isImage ? "w-48" : "w-24 bg-white/80 p-3",
        "transition-colors duration-150 ease-in-out cursor-move",
        isSelected && "ring-2 ring-primary shadow-lg z-10",
        isDragging && "z-50 shadow-xl",
        isSearchMatch && "animate-pulse shadow-xl shadow-primary/20",
        isSearchMatch && !isSelected && "ring-2 ring-yellow-400 z-10"
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isImage && file.dimensions ? `${file.dimensions.width}px` : 'auto',
        transition: isDragging ? 'none' : 'all 0.1s ease'
      }}
      onMouseDown={handleMouseDown}
      onClick={() => onSelect(index)}
      onDoubleClick={handleDoubleClick}
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
    </div>
  );
}
