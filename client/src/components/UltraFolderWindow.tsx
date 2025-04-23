// Ultra-eenvoudige folder venster wrapper
// Gebruikt inline styles en minimale code voor maximale betrouwbaarheid

import React from 'react';
import { DesktopFile } from '@/types';
import { UltraSimpleFolderViewer } from './UltraSimpleFolderViewer';

interface UltraFolderWindowProps {
  folder: DesktopFile;
  onClose: () => void;
}

export function UltraFolderWindow({ folder, onClose }: UltraFolderWindowProps) {
  // Valideer dat we een geldige folder hebben met een id
  if (!folder || !folder.id) {
    console.error('Geen geldige map ontvangen:', folder);
    return null;
  }
  
  console.log('ULTRA MAP VENSTER OPENEN:', folder);
  
  return (
    <UltraSimpleFolderViewer
      folderId={folder.id}
      folderName={folder.name}
      onClose={onClose}
    />
  );
}