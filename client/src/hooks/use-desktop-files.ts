import { useState, useEffect } from 'react';
import { DesktopFile } from '@/types';

export function useDesktopFiles() {
  const [files, setFiles] = useState<DesktopFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<number | null>(null);
  
  // Load files from localStorage on initial render
  useEffect(() => {
    const savedFiles = localStorage.getItem('desktopFiles');
    if (savedFiles) {
      try {
        setFiles(JSON.parse(savedFiles));
      } catch (e) {
        console.error('Error loading saved files:', e);
      }
    }
  }, []);

  // Save files to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('desktopFiles', JSON.stringify(files));
  }, [files]);

  const addFiles = (newFiles: DesktopFile[]) => {
    setFiles(prevFiles => [...prevFiles, ...newFiles]);
  };

  const updateFilePosition = (index: number, x: number, y: number) => {
    setFiles(prevFiles => 
      prevFiles.map((file, i) => 
        i === index 
          ? { ...file, position: { x, y } } 
          : file
      )
    );
  };

  const clearAllFiles = () => {
    if (window.confirm('Are you sure you want to clear all files from the desktop?')) {
      setFiles([]);
      setSelectedFile(null);
    }
  };

  const selectFile = (index: number | null) => {
    setSelectedFile(index);
  };

  return {
    files,
    selectedFile,
    addFiles,
    updateFilePosition,
    clearAllFiles,
    selectFile
  };
}
