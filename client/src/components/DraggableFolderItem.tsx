import React from 'react';
import { DesktopFile } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useDesktopFiles } from '@/hooks/use-desktop-files';
import { FileText, Folder, Image } from 'lucide-react';

interface DraggableFolderItemProps {
  file: DesktopFile;
  parentFolderId?: number;
}

export function DraggableFolderItem({ file, parentFolderId }: DraggableFolderItemProps) {
  const { toast } = useToast();
  const { removeFileFromFolder } = useDesktopFiles();

  // Bepaal het juiste icoon op basis van het bestandstype
  const getIcon = () => {
    if (file.isFolder === 'true' || file.type === 'folder' || file.type === 'application/folder') {
      return <Folder className="h-6 w-6 text-blue-500" />;
    } else if (file.type.startsWith('image/')) {
      return <Image className="h-6 w-6 text-green-500" />;
    } else {
      return <FileText className="h-6 w-6 text-gray-500" />;
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    // Log de sleeactie
    console.log(`🔄 DRAG START in folder: Bestand ${file.name} (ID: ${file.id}) wordt gesleept uit map ${parentFolderId}`);
    
    // Stel de dataTransfer in met het bestand-ID
    e.dataTransfer.setData('text/plain', String(file.id));
    e.dataTransfer.effectAllowed = 'move';
    
    // Maak een custom ghost image
    const dragGhost = document.createElement('div');
    dragGhost.classList.add('drag-ghost');
    dragGhost.innerHTML = `
      <div style="
        padding: 8px; 
        background: rgba(255,255,255,0.9); 
        border: 2px solid #4f46e5;
        border-radius: 6px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        font-size: 12px;
        max-width: 150px;
        display: flex;
        align-items: center;
        gap: 6px;
      ">
        <div>${file.name}</div>
      </div>
    `;
    
    document.body.appendChild(dragGhost);
    e.dataTransfer.setDragImage(dragGhost, 30, 15);
    
    setTimeout(() => {
      document.body.removeChild(dragGhost);
    }, 0);
    
    // Stel de global drag state in
    // @ts-ignore - Custom property
    window._draggingFileFromFolder = true;
    // @ts-ignore - Custom property
    window.draggedFileInfo = {
      id: file.id,
      name: file.name,
      parentId: parentFolderId,
      startTime: Date.now()
    };
    
    // Voeg een class toe aan het element om aan te geven dat het wordt gesleept
    if (e.currentTarget) {
      e.currentTarget.classList.add('opacity-50');
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    console.log(`🔄 DRAG END in folder: Bestand ${file.name} (ID: ${file.id})`);
    
    // Reset de visuele feedback
    if (e.currentTarget) {
      e.currentTarget.classList.remove('opacity-50');
    }
    
    // Reset drag state
    // @ts-ignore - Custom property
    window._draggingFileFromFolder = false;
    // @ts-ignore - Custom property
    window.draggedFileInfo = undefined;
  };

  return (
    <div
      className="folder-item flex items-center p-3 rounded-md hover:bg-gray-100 cursor-pointer border border-gray-200 mb-1 transition-all duration-150 bg-white"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      data-file-id={file.id}
      data-parent-folder={parentFolderId}
      title={`Sleep om dit bestand naar het bureaublad te verplaatsen: ${file.name}`}
    >
      <div className="flex items-center gap-3 w-full">
        {getIcon()}
        <div className="truncate font-medium text-sm">{file.name}</div>
      </div>
    </div>
  );
}