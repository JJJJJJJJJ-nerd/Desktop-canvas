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
    // Meer uitgebreide logging
    console.log('=============================================');
    console.log(`🔄 DRAG START DETECTED: Bestand ${file.name} (ID: ${file.id})`);
    console.log(`📂 Vanuit map: ${parentFolderId}`);
    console.log(`📋 Event details:`, {
      type: e.type,
      clientX: e.clientX,
      clientY: e.clientY,
      target: e.target,
      currentTarget: e.currentTarget,
    });
    console.log('=============================================');
    
    try {
      // Zeer belangrijk: alle noodzakelijke data formaten instellen om cross-browser compatibiliteit te garanderen
      // Gebruik meerdere dataformaten voor grotere compatibiliteit
      e.dataTransfer.setData('text/plain', String(file.id));
      e.dataTransfer.setData('application/json', JSON.stringify({
        id: file.id,
        name: file.name,
        parentId: parentFolderId,
        type: file.type,
        source: 'folder-item'
      }));
      
      // Belangrijk: zonder dit werkt het slepen mogelijk niet in alle browsers
      e.dataTransfer.effectAllowed = 'all'; // 'all' in plaats van 'move' voor betere compatibiliteit
      
      // Stel de global drag state in - BELANGRIJK voor communicatie tussen componenten
      window._draggingFileFromFolder = true;
      window.draggedFileInfo = {
        id: file.id,
        name: file.name,
        parentId: parentFolderId,
        startTime: Date.now()
      };
      
      console.log('✅ Global state ingesteld:', {
        _draggingFileFromFolder: window._draggingFileFromFolder,
        draggedFileInfo: window.draggedFileInfo
      });
      
      // Direct het element markeren als gesleept (belangrijke visuele feedback)
      const element = e.currentTarget as HTMLElement;
      element.classList.add('dragging-element', 'opacity-50');
      
      // Maak een beter zichtbare custom ghost image
      const dragGhost = document.createElement('div');
      dragGhost.classList.add('drag-ghost');
      dragGhost.innerHTML = `
        <div style="
          padding: 12px; 
          background: rgba(255,255,255,0.95); 
          border: 3px solid #4f46e5;
          border-radius: 8px;
          box-shadow: 0 6px 12px rgba(0,0,0,0.2);
          font-size: 14px;
          font-weight: bold;
          max-width: 250px;
          display: flex;
          align-items: center;
          gap: 8px;
          pointer-events: none;
          z-index: 9999;
        ">
          <div>🔄 ${file.name}</div>
        </div>
      `;
      
      document.body.appendChild(dragGhost);
      
      // Probeer de drag image op meerdere manieren in te stellen voor betere cross-browser compatibiliteit
      try {
        e.dataTransfer.setDragImage(dragGhost, 30, 15);
      } catch (err) {
        console.warn('Kon drag image niet instellen, fallback gebruikt:', err);
      }
      
      setTimeout(() => {
        try {
          document.body.removeChild(dragGhost);
        } catch (err) {
          // Stille fout afhandeling
        }
      }, 0);
      
      // Extra visuele hint voor de gebruiker
      toast({
        title: "Bestand slepen",
        description: "Sleep dit bestand naar het bureaublad om het te verplaatsen.",
        duration: 3000,
      });
      
      // Voorkom dat de browser standaard drag-gedrag gebruikt
      if (e.stopPropagation) e.stopPropagation();
      
      // Debug Helper: voeg een globale CSS class toe aan body om aan te geven dat we aan het slepen zijn
      document.body.classList.add('dragging-file-in-progress');
      
      return false; // belangrijk voor sommige browsers
    } catch (error) {
      console.error('❌ FOUT bij drag start:', error);
      
      // Herstel de global drag state bij fouten
      window._draggingFileFromFolder = false;
      window.draggedFileInfo = undefined;
      
      toast({
        title: "Fout",
        description: "Er ging iets mis bij het starten van de sleepactie.",
        variant: "destructive"
      });
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    console.log(`🔄 DRAG END in folder: Bestand ${file.name} (ID: ${file.id})`);
    console.log('📋 DragEnd event details:', {
      clientX: e.clientX,
      clientY: e.clientY,
      dropEffect: e.dataTransfer.dropEffect,
      effectAllowed: e.dataTransfer.effectAllowed
    });
    
    // Reset alle visuele feedback
    if (e.currentTarget) {
      const element = e.currentTarget as HTMLElement;
      element.classList.remove('opacity-50', 'dragging-element', 'item-ready-to-drag');
      element.style.cursor = '';
    }
    
    // Reset global drag state
    window._draggingFileFromFolder = false;
    window.draggedFileInfo = undefined;
    
    // Verwijder de debug class van de body
    document.body.classList.remove('dragging-file-in-progress');
    
    // Verwijder eventuele resterende drag ghost elementen
    document.querySelectorAll('.drag-ghost').forEach(el => {
      document.body.removeChild(el);
    });
    
    // Herstel normale cursor
    document.body.style.cursor = '';
    
    console.log('✅ DragEnd cleanup voltooid');
  };

  // Nieuwe functie voor het loggen van bestandsselectie
  const handleFileClick = (e: React.MouseEvent) => {
    console.log('=================================================');
    console.log('🖱️ BESTAND GESELECTEERD:', {
      id: file.id,
      naam: file.name,
      type: file.type,
      grootte: file.size,
      inMap: parentFolderId,
      tijdstip: new Date().toLocaleTimeString()
    });
    console.log('📋 Event details:', {
      type: e.type,
      button: e.button, // 0 = links, 1 = midden, 2 = rechts
      clientX: e.clientX,
      clientY: e.clientY,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey  // Command key op Mac
    });
    console.log('🔍 Element details:', {
      target: e.target,
      currentTarget: e.currentTarget
    });
    console.log('=================================================');
  };

  // Handmatig drag-event starten bij mousedown
  const handleMouseDown = (e: React.MouseEvent) => {
    // Als het niet de linker muisknop is, doe niets
    if (e.button !== 0) return;
    
    console.log('🖱️ MOUSEDOWN EVENT op bestand:', {
      id: file.id,
      naam: file.name,
      inMap: parentFolderId
    });
    
    // Stel in dat dit element draggable is (soms werkt dit beter dan via het attribuut)
    const element = e.currentTarget as HTMLElement;
    element.draggable = true;
    
    // Zet ook een visueel teken dat dit element sleepbaar is
    element.classList.add('item-ready-to-drag');
    
    // Stel een timer in die de cursor verandert om aan te geven dat je kunt slepen
    const timer = setTimeout(() => {
      element.style.cursor = 'grab';
    }, 100);
    
    // Schoonmaak wanneer de muis wordt losgelaten
    const cleanup = () => {
      clearTimeout(timer);
      element.classList.remove('item-ready-to-drag');
      element.style.cursor = '';
      window.removeEventListener('mouseup', cleanup);
    };
    
    window.addEventListener('mouseup', cleanup);
  };
  
  return (
    <div
      className="folder-item flex items-center p-3 rounded-md hover:bg-gray-100 cursor-pointer border border-gray-200 mb-1 transition-all duration-150 bg-white"
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleFileClick}
      onMouseDown={handleMouseDown}
      data-file-id={file.id}
      data-parent-folder={parentFolderId}
      data-draggable="true"
      title={`Sleep om dit bestand naar het bureaublad te verplaatsen: ${file.name}`}
    >
      <div className="flex items-center gap-3 w-full">
        {getIcon()}
        <div className="truncate font-medium text-sm">{file.name}</div>
      </div>
      {/* Sleepindicator toevoegen */}
      <div className="hidden ml-2 text-blue-500 drag-indicator">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="18" x2="12" y2="12"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
      </div>
    </div>
  );
}