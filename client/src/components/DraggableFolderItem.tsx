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
    
    // Verwijder de debug en no-select classes van de body
    document.body.classList.remove('dragging-file-in-progress', 'no-select');
    
    // Verwijder eventuele resterende drag ghost elementen
    document.querySelectorAll('.drag-ghost').forEach(el => {
      try {
        document.body.removeChild(el);
      } catch (err) {
        // Element might already be removed
      }
    });
    
    // Herstel normale cursor
    document.body.style.cursor = '';
    
    console.log('✅ DragEnd cleanup voltooid');
  };

  // Functie voor het openen van bestanden
  const handleFileClick = (e: React.MouseEvent) => {
    // Voorkom dat dit klikevent het drag-event activeert 
    e.stopPropagation();
    
    console.log('=================================================');
    console.log('🖱️ BESTAND GESELECTEERD:', {
      id: file.id,
      naam: file.name,
      type: file.type,
      grootte: file.size,
      inMap: parentFolderId,
      tijdstip: new Date().toLocaleTimeString()
    });
    
    // Controleer of er een drag operatie bezig was
    // @ts-ignore - Custom property  
    const wasDragging = window._mouseDownInfo?.isDragging === true;
    
    if (wasDragging) {
      console.log('⚠️ Klik genegeerd omdat er een sleepoperatie plaatsvond');
      return;
    }
    
    console.log('📋 Event details:', {
      type: e.type,
      button: e.button, // 0 = links, 1 = midden, 2 = rechts
      clientX: e.clientX,
      clientY: e.clientY,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey  // Command key op Mac
    });
    
    // Alleen reageren op linksklikken zonder modifier toetsen
    if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) {
      console.log('⚠️ Klik genegeerd omdat het niet een standaard linksklik is');
      return;
    }
    
    // Controleren of het een dubbele klik is
    const now = Date.now();
    // @ts-ignore - Custom property
    const lastClickTime = (window._lastClickTimes?.[file.id]) || 0;
    const isDoubleClick = (now - lastClickTime) < 500; // 500ms tussen kliks
    
    // Bewaar de tijd van deze klik
    // @ts-ignore - Custom property
    if (!window._lastClickTimes) window._lastClickTimes = {};
    // @ts-ignore - Custom property
    window._lastClickTimes[file.id] = now;
    
    // We openen alleen het bestand bij een dubbele klik
    if (isDoubleClick) {
      console.log('👆 DUBBELE KLIK GEDETECTEERD op bestand:', file.name);
      
      // Toon een visuele indicatie dat het bestand wordt geopend
      const el = e.currentTarget as HTMLElement;
      el.classList.add('file-blink');
      
      // Verwijder de animatie na 1 seconde
      setTimeout(() => {
        el.classList.remove('file-blink');
      }, 1000);
      
      // Probeer het bestand te openen, mits het geen map is
      if (file.type !== 'folder' && file.type !== 'application/folder' && !file.isFolder) {
        try {
          // Maak een tijdelijke link om het bestand te openen
          const link = document.createElement('a');
          link.href = file.dataUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          
          console.log('🔗 Bestand openen met URL:', file.dataUrl.substring(0, 50) + '...');
          
          // Voeg toe aan het document en klik erop
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          console.log('✅ Bestand geopend in nieuw tabblad');
        } catch (error) {
          console.error('❌ Fout bij openen van bestand:', error);
        }
      } else {
        console.log('ℹ️ Dit is een map en kan niet direct worden geopend');
      }
    } else {
      console.log('ℹ️ Enkele klik gedetecteerd - bestand wordt niet geopend');
      
      // Toon een subtiele visuele feedback voor selectie
      const el = e.currentTarget as HTMLElement;
      el.classList.add('file-selected'); 
      
      setTimeout(() => {
        el.classList.remove('file-selected');
      }, 500);
    }
    
    console.log('=================================================');
  };

  // Handmatig drag-event starten bij mousedown
  const handleMouseDown = (e: React.MouseEvent) => {
    // Voorkom standaard tekstselectie gedrag
    e.preventDefault();
    
    // Als het niet de linker muisknop is, doe niets
    if (e.button !== 0) return;
    
    // Markeer dat we beginnen met een muisbeweging
    // @ts-ignore - Custom property
    window._mouseDownInfo = {
      fileId: file.id,
      startX: e.clientX,
      startY: e.clientY,
      timestamp: Date.now(),
      element: e.currentTarget,
      isDragging: false
    };
    
    console.log('🖱️ MOUSEDOWN EVENT op bestand:', {
      id: file.id,
      naam: file.name,
      inMap: parentFolderId,
      positie: { x: e.clientX, y: e.clientY }
    });
    
    // Stel in dat dit element draggable is (soms werkt dit beter dan via het attribuut)
    const element = e.currentTarget as HTMLElement;
    element.draggable = true;
    
    // Directe visuele feedback dat je het bestand kunt slepen
    document.body.style.cursor = 'grabbing';
    element.style.cursor = 'grabbing';
    
    // Zet ook een visueel teken dat dit element sleepbaar is
    element.classList.add('item-ready-to-drag');
    
    // Extra fix voor het voorkomen van tekstselectie
    document.body.classList.add('no-select');
    
    // Stel een timer in die de cursor verandert om aan te geven dat je kunt slepen
    const timer = setTimeout(() => {
      element.style.cursor = 'grab';
    }, 100);
    
    // Volg muisbewegingen om te bepalen of het een klik of sleep is
    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Bereken de afstand die de muis heeft afgelegd
      const dx = moveEvent.clientX - e.clientX;
      const dy = moveEvent.clientY - e.clientY;
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      // Als de afstand groter is dan 5px, beschouwen we het als een drag operatie
      if (distance > 5) {
        // @ts-ignore - Custom property
        if (window._mouseDownInfo) window._mouseDownInfo.isDragging = true;
      }
    };
    
    // Schoonmaak wanneer de muis wordt losgelaten
    const cleanup = () => {
      clearTimeout(timer);
      element.classList.remove('item-ready-to-drag');
      element.style.cursor = '';
      
      // Ook cursor van het document resetten
      document.body.style.cursor = '';
      
      // Verwijder de no-select class van body
      document.body.classList.remove('no-select');
      
      // Verwijder alle event listeners
      window.removeEventListener('mouseup', cleanup);
      window.removeEventListener('mousemove', handleMouseMove);
      
      // Reset de mouseDown info na korte vertraging (zodat click handler het nog kan gebruiken)
      setTimeout(() => {
        // @ts-ignore - Custom property
        window._mouseDownInfo = undefined;
      }, 50);
    };
    
    window.addEventListener('mouseup', cleanup);
    window.addEventListener('mousemove', handleMouseMove);
  };
  
  return (
    <div
      className="folder-item flex items-center p-3 rounded-md hover:bg-gray-100 cursor-pointer border border-gray-200 mb-1 transition-all duration-150 bg-white select-none"
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleFileClick}
      onMouseDown={handleMouseDown}
      data-file-id={file.id}
      data-parent-folder={parentFolderId}
      data-draggable="true"
      title={`Sleep om dit bestand naar het bureaublad te verplaatsen: ${file.name}`}
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none' }}
    >
      <div className="flex items-center gap-3 w-full select-none" style={{ pointerEvents: 'none' }}>
        {getIcon()}
        <div className="truncate font-medium text-sm select-none" style={{ pointerEvents: 'none' }}>{file.name}</div>
      </div>
      {/* Sleepindicator toevoegen */}
      <div className="hidden ml-2 text-blue-500 drag-indicator select-none">
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