import { useRef, useEffect } from "react";
import { DesktopFile } from "@/types";
import { formatFileSize } from "@/utils/file-utils";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FilePreviewModalProps {
  file: DesktopFile | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FilePreviewModal({
  file,
  isOpen,
  onClose,
}: FilePreviewModalProps) {
  const downloadRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (isOpen && file && downloadRef.current) {
      downloadRef.current.href = file.dataUrl;
      downloadRef.current.download = file.name;
    }
  }, [isOpen, file]);

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] flex flex-col">
        <DialogHeader className="px-4 py-3 border-b">
          <div className="flex justify-between items-center">
            <DialogTitle className="font-semibold text-lg">{file.name}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto p-4 min-h-[40vh]">
          {file.type.startsWith("image/") ? (
            <div className="flex items-center justify-center h-full">
              <img
                src={file.dataUrl}
                alt={file.name}
                className="max-w-full max-h-[60vh] object-contain"
              />
            </div>
          ) : file.type === "application/pdf" ? (
            <div className="flex items-center justify-center h-[60vh]">
              <iframe
                src={file.dataUrl}
                width="100%"
                height="100%"
                className="border-0"
                title={file.name}
              />
            </div>
          ) : file.type.startsWith("video/") ? (
            <div className="flex items-center justify-center h-full">
              <video controls className="max-w-full max-h-[60vh]">
                <source src={file.dataUrl} type={file.type} />
                Your browser does not support video playback.
              </video>
            </div>
          ) : file.type.startsWith("audio/") ? (
            <div className="flex items-center justify-center h-full">
              <audio controls className="w-full max-w-md">
                <source src={file.dataUrl} type={file.type} />
                Your browser does not support audio playback.
              </audio>
            </div>
          ) : file.type.startsWith("text/") ? (
            <PreviewTextContent dataUrl={file.dataUrl} />
          ) : (
            <div className="flex flex-col items-center justify-center h-[40vh] text-center p-8">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16 text-gray-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-lg font-semibold mb-2">
                Preview not available
              </h3>
              <p className="text-gray-500 mb-6">
                This file type cannot be previewed. Please download the file to
                view its contents.
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter className="px-4 py-3 border-t">
          <div className="flex justify-between items-center w-full">
            <div className="text-sm text-gray-500">
              {file.type} · {formatFileSize(file.size)}
            </div>
            <a
              ref={downloadRef}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-neutral bg-white hover:bg-gray-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Download
            </a>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewTextContent({ dataUrl }: { dataUrl: string }) {
  const [text, setText] = useState<string>("");
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    fetch(dataUrl)
      .then((response) => response.text())
      .then((content) => {
        setText(content);
      })
      .catch((err) => {
        console.error("Error loading text file:", err);
        setError(true);
      });
  }, [dataUrl]);

  if (error) {
    return <div className="text-center text-red-500">Error loading file content</div>;
  }

  return (
    <div className="h-[60vh] overflow-auto">
      <pre className="text-sm whitespace-pre-wrap p-4 bg-gray-50 rounded border border-gray-200">
        {text}
      </pre>
    </div>
  );
}

import { useState } from "react";
