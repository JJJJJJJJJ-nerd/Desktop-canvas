import { UploadIcon, Trash2, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import { useState } from "react";

interface DesktopToolbarProps {
  fileCount: number;
  onUploadClick: () => void;
  onClearClick: () => void;
}

export function DesktopToolbar({ fileCount, onUploadClick, onClearClick }: DesktopToolbarProps) {
  const [, setLocation] = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        setLocation('/auth');
      } else {
        console.error('Failed to logout');
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

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
      
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-500">
          <span>{fileCount}</span> files on desktop
        </div>
        
        <Separator orientation="vertical" className="h-6" />
        
        <Button
          onClick={handleLogout}
          variant="ghost"
          size="sm"
          className="text-neutral hover:text-destructive flex items-center"
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Logging out...
            </span>
          ) : (
            <>
              <LogOut className="h-4 w-4 mr-1.5" />
              Logout
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
