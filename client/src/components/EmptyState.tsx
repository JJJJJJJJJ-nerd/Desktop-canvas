import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onUploadClick: () => void;
}

export function EmptyState({ onUploadClick }: EmptyStateProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 text-white/80">
      <div className="bg-black/30 p-6 rounded-xl backdrop-blur-md max-w-md">
        <Upload className="h-16 w-16 mx-auto mb-4 opacity-70" />
        <h2 className="text-xl font-semibold mb-2">Your desktop is empty</h2>
        <p className="text-white/70 mb-6">
          Drag and drop files anywhere on this canvas, or use the upload button above.
        </p>
        <Button 
          onClick={onUploadClick}
          className="bg-white/90 hover:bg-white text-neutral-900 px-5 py-2.5 rounded-lg font-medium transition"
        >
          Upload Files
        </Button>
      </div>
    </div>
  );
}
