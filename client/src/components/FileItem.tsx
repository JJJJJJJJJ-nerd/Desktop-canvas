import { useRef, useState, useEffect } from "react";
import { DesktopFile } from "@/types";
import { getFileIcon, formatFileSize } from "@/utils/file-utils";
import { cn } from "@/lib/utils";
import { Maximize2 } from "lucide-react";

interface FileItemProps {
  file: DesktopFile;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  onDragEnd: (index: number, x: number, y: number) => void;
  onResize?: (index: number, width: number, height: number) => void;
  onPreview: (file: DesktopFile) => void;
}

export function FileItem({ 
  file, 
  index, 
  isSelected, 
  onSelect, 
  onDragEnd,
  onResize,
  onPreview
}: FileItemProps) {
  const fileRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number, y: number } | null>(null);
  const offsetRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    
    onSelect(index);
    
    if (fileRef.current) {
      const rect = fileRef.current.getBoundingClientRect();
      offsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (fileRef.current && dragStartPos.current) {
      const x = e.clientX - offsetRef.current.x;
      const y = e.clientY - offsetRef.current.y;
      
      fileRef.current.style.left = `${x}px`;
      fileRef.current.style.top = `${y}px`;
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (fileRef.current && dragStartPos.current) {
      // Only trigger click if it wasn't a significant drag
      const moveX = Math.abs(e.clientX - dragStartPos.current.x);
      const moveY = Math.abs(e.clientY - dragStartPos.current.y);
      
      const x = parseInt(fileRef.current.style.left);
      const y = parseInt(fileRef.current.style.top);
      
      onDragEnd(index, x, y);
    }
    
    dragStartPos.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClick = () => {
    onPreview(file);
  };

  return (
    <div
      ref={fileRef}
      className={cn(
        "file-item absolute backdrop-blur-sm rounded-lg shadow-md",
        isImage ? "w-48" : "w-24 bg-white/80 p-3",
        "transition-all duration-150 ease-in-out cursor-move",
        isSelected && "ring-2 ring-primary shadow-lg z-10"
      )}
      style={{
        left: `${file.position.x}px`,
        top: `${file.position.y}px`,
      }}
      onMouseDown={handleMouseDown}
      onClick={() => onSelect(index)}
      onDoubleClick={handleDoubleClick}
    >
      {isImage ? (
        <div className="flex flex-col">
          <div className="w-full h-32 overflow-hidden rounded-t-lg">
            <img 
              src={file.dataUrl} 
              alt={file.name} 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="bg-black/70 text-white p-2 rounded-b-lg">
            <p className="text-xs font-medium truncate" title={file.name}>
              {file.name}
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
              {file.name}
            </p>
            <p className="text-[10px] text-gray-500">
              {formatFileSize(file.size)}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
