import { useRef, useState, useEffect, Fragment } from "react";
import { DesktopFile } from "@/types";
import { getFileIcon, formatFileSize } from "@/utils/file-utils";
import { cn } from "@/lib/utils";
import { Maximize2 } from "lucide-react";

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
  const startPosRef = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [localPosition, setLocalPosition] = useState({ x: file.position.x, y: file.position.y });
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

  // Only update position from props on initial render
  useEffect(() => {
    // Only run on first mount
    setLocalPosition({ x: file.position.x, y: file.position.y });
  }, []);

  // Track mouse position during dragging in non-reactive ref
  // to avoid re-renders that might cause jumps
  const currentPosition = useRef({ x: 0, y: 0 });

  // Direct drag implementation - starts dragging immediately on mouse down
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only respond to left mouse button
    if (e.button !== 0) return;
    
    // Don't interfere with resize operation
    if (isResizing) return;
    
    // Prevent default browser behavior and stop event propagation
    e.stopPropagation();
    e.preventDefault();
    
    // Always select on mousedown if not already selected
    if (!isSelected) {
      onSelect(index);
    }
    
    // Calculate offset between mouse position and element top-left corner
    startPosRef.current = {
      x: e.clientX - localPosition.x,
      y: e.clientY - localPosition.y
    };
    
    // Store current position for reference
    currentPosition.current = localPosition;
    
    // Set dragging state immediately
    setDragging(true);
    
    // Add document-level event listeners for move and release
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle mouse movement during drag with requestAnimationFrame for better performance
  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    
    // Prevent any default browser behavior
    e.preventDefault();
    
    // Calculate new position - ensure it stays within visible area
    const newX = Math.max(0, e.clientX - startPosRef.current.x);
    const newY = Math.max(0, e.clientY - startPosRef.current.y);
    
    // Update current position ref first (without causing re-renders)
    currentPosition.current = { x: newX, y: newY };
    
    // Use requestAnimationFrame for smoother dragging
    window.requestAnimationFrame(() => {
      setLocalPosition(currentPosition.current);
    });
  };

  // Handle mouse up - end dragging
  const handleMouseUp = (e: MouseEvent) => {
    if (!dragging) return;
    
    // Prevent default behavior
    e.preventDefault();
    
    // Save the final position
    onDragEnd(index, currentPosition.current.x, currentPosition.current.y);
    
    // End dragging state
    setDragging(false);
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClick = () => {
    // Open file in preview or Excel window
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
        "file-item absolute backdrop-blur-sm rounded-lg shadow-md",
        isImage ? "w-48" : "w-24 bg-white/80 p-3",
        "cursor-move",
        isSelected && "ring-2 ring-primary shadow-lg z-10",
        dragging && "z-50 shadow-xl",
        isSearchMatch && "animate-pulse shadow-xl shadow-primary/20",
        isSearchMatch && !isSelected && "ring-2 ring-yellow-400 z-10"
      )}
      style={{
        left: `${localPosition.x}px`,
        top: `${localPosition.y}px`,
        width: isImage && file.dimensions ? `${file.dimensions.width}px` : 'auto',
        transition: dragging ? 'none' : 'transform 0.1s ease'
      }}
      onMouseDown={handleMouseDown}
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
