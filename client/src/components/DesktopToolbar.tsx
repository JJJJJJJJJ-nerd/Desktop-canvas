import { UploadIcon, Trash2, LogOut, Search, X, FileSearch, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useState, useRef } from "react";

interface DesktopToolbarProps {
  fileCount: number;
  onUploadClick: () => void;
  onClearClick: () => void;
  onSearch?: (query: string) => void;
  onFilesSelected?: (files: FileList) => void;
}

export function DesktopToolbar({ fileCount, onUploadClick, onClearClick, onSearch, onFilesSelected }: DesktopToolbarProps) {
  const [, setLocation] = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Eigen interne upload handler
  const handleDirectUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("DesktopToolbar: Direct file handling");
    if (e.target.files?.length) {
      console.log(`Geselecteerde bestanden: ${e.target.files.length}`);
      
      // Als de onFilesSelected handler bestaat, geef de bestanden door
      if (onFilesSelected) {
        console.log("Bestanden doorgeven aan parent component");
        onFilesSelected(e.target.files);
      } else {
        // Anders, gebruik de standaard upload knop handler
        console.log("Fallback naar standaard upload knop handler");
        onUploadClick();
      }
      
      // Reset de input voor toekomstig gebruik
      setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 100);
    }
  };

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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (onSearch) {
      onSearch(query);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-3 py-1 flex justify-between items-center shadow-sm">
      <div className="flex items-center space-x-1">
        <div className="relative">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleDirectUpload}
            multiple
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-20"
            title="Upload bestanden"
          />
          <Button
            type="button"
            size="sm"
            className="bg-primary hover:bg-primary/90 text-white flex items-center h-8 relative pointer-events-none"
          >
            <UploadIcon className="h-3.5 w-3.5 mr-1" />
            Upload
          </Button>
        </div>
        
        <Separator orientation="vertical" className="h-5 mx-1" />
        
        <Button
          onClick={onClearClick}
          variant="ghost"
          size="sm"
          className="text-neutral hover:text-destructive flex items-center h-8"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      </div>
      
      <div className="relative mx-auto max-w-sm w-64">
        <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
          <FileSearch className="h-3.5 w-3.5 text-primary" />
        </div>
        <Input
          type="text"
          placeholder="Zoek bestanden..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="h-8 pl-8 pr-8 py-1 text-sm bg-white/60 border-gray-200 focus:ring-1 focus:ring-primary/40 focus:border-primary shadow-sm"
          aria-label="Search files"
        />
        {searchQuery && (
          <button
            className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600"
            onClick={() => {
              setSearchQuery("");
              if (onSearch) onSearch("");
            }}
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <div className="text-xs text-gray-500">
          <span>{fileCount}</span> bestanden
        </div>
        
        <Separator orientation="vertical" className="h-5" />
        
        <Button
          onClick={handleLogout}
          variant="ghost"
          size="sm"
          className="text-neutral hover:text-destructive flex items-center h-8"
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-xs">Uitloggen...</span>
            </span>
          ) : (
            <>
              <LogOut className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Uitloggen</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
