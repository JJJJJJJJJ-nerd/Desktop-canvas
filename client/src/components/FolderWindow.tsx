// Nieuwe wrapper voor het tonen van mapinhoud in een venster
// Dit bestand werkt samen met NewFolderViewer.tsx

import React from 'react';
import { DesktopFile } from '@/types';
import { NewFolderViewer } from './NewFolderViewer';

interface FolderWindowProps {
  folder: DesktopFile; 
  onClose: () => void;
}

export function FolderWindow({ folder, onClose }: FolderWindowProps) {
  // Als het bestand geen id heeft, kunnen we geen inhoud weergeven
  if (!folder.id) {
    return null;
  }
  
  return (
    <NewFolderViewer 
      folderId={folder.id} 
      folderName={folder.name} 
      onClose={onClose}
    />
  );
}