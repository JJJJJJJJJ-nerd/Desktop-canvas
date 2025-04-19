import { UploadIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface DesktopToolbarProps {
  fileCount: number;
  onUploadClick: () => void;
  onClearClick: () => void;
}

export function DesktopToolbar({ fileCount, onUploadClick, onClearClick }: DesktopToolbarProps) {
  return (
    <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-2 flex justify-between items-center shadow-sm">
      <div className="flex items-center space-x-2">
        <Button
          onClick={onUploadClick}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded-md text-sm font-medium flex items-center transition"
        >
          <UploadIcon className="h-4 w-4 mr-1.5" />
          Upload Files
        </Button>
        
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        <Button
          onClick={onClearClick}
          variant="ghost"
          className="text-neutral hover:text-destructive px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center"
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Clear All
        </Button>
      </div>
      
      <div className="text-sm text-gray-500">
        <span>{fileCount}</span> files on desktop
      </div>
    </div>
  );
}
