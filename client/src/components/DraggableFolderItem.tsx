import React, { useState, useRef, useEffect } from 'react';
import { DesktopFile } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useDesktopFiles } from '@/hooks/use-desktop-files';
import { useWebSocket } from '@/hooks/use-websocket';
import { FileText, Folder, Image, GripVertical } from 'lucide-react';

interface DraggableFolderItemProps {
  file: DesktopFile;
  parentFolderId?: number;
}

// Helper type voor de positie
interface Position {
  x: number;
  y: number;
}

export function DraggableFolderItem({ file, parentFolderId }: DraggableFolderItemProps) {
  const { toast } = useToast();
  const { removeFileFromFolder } = useDesktopFiles();
  const { isConnected, sendMessage, lastMessage, folderUpdates } = useWebSocket();
  
  // States voor de manual drag functionaliteit
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [wasDroppedOnDesktop, setWasDroppedOnDesktop] = useState(false);
  const dragElementRef = useRef<HTMLDivElement>(null);
  
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
        id: file.id || 0,
        name: file.name,
        parentId: parentFolderId || null,
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

  // Nieuwe drag functionaliteit
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.button !== 0) return; // Alleen linker muisknop
    
    // Start positie opslaan
    const offsetX = e.clientX - (e.currentTarget as HTMLElement).getBoundingClientRect().left;
    const offsetY = e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top;
    setDragOffset({ x: offsetX, y: offsetY });
    
    // Maak een visuele "ghost" element voor het slepen
    if (dragElementRef.current) {
      const rect = dragElementRef.current.getBoundingClientRect();
      setPosition({ 
        x: e.clientX - offsetX, 
        y: e.clientY - offsetY 
      });
      
      // Maak een clone van het element om te slepen
      const clone = document.createElement('div');
      clone.id = "drag-clone";
      clone.innerHTML = `
        <div style="
          position: fixed;
          left: ${e.clientX - offsetX}px;
          top: ${e.clientY - offsetY}px;
          width: ${rect.width}px;
          padding: 8px;
          background: white;
          border: 2px solid #3b82f6;
          border-radius: 6px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          opacity: 0.8;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 8px;
          pointer-events: none;
        ">
          <div>${getIcon() ? "<span class='text-blue-500'>" + getIcon() + "</span>" : ""}</div>
          <div style="font-weight: 500; font-size: 14px;">${file.name}</div>
        </div>
      `;
      document.body.appendChild(clone);
    }
    
    document.body.classList.add('no-select');
    document.body.style.cursor = 'grabbing';
    
    window._draggingFileFromFolder = true;
    window.draggedFileInfo = {
      id: file.id || 0,
      name: file.name,
      parentId: parentFolderId || null,
      position: { x: e.clientX, y: e.clientY }
    };
    
    setIsDragging(true);
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Verplaats de "ghost" tijdens het slepen
  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({ 
        x: e.clientX - dragOffset.x, 
        y: e.clientY - dragOffset.y 
      });
      
      // Update de positie van de ghost
      const clone = document.getElementById('drag-clone');
      if (clone && clone.firstElementChild) {
        (clone.firstElementChild as HTMLElement).style.left = `${e.clientX - dragOffset.x}px`;
        (clone.firstElementChild as HTMLElement).style.top = `${e.clientY - dragOffset.y}px`;
      }
      
      // Definieer het desktopgebied 
      const minY = 60; // Ongeveer de hoogte van de toolbar
      const isOverDesktop = e.clientY > minY;
      
      // Geef visuele indicatie of we boven desktop zijn
      if (isOverDesktop) {
        document.body.classList.add('can-drop-on-desktop');
        // Sla huidige positie op voor als we loslaten
        window._desktopDragPosition = { x: e.clientX, y: e.clientY };
      } else {
        document.body.classList.remove('can-drop-on-desktop');
        window._desktopDragPosition = undefined;
      }
    }
  };
  
  // Beëindig het slepen en bepaal of het bestand verplaatst moet worden
  const handleMouseUp = async (e: MouseEvent) => {
    if (isDragging) {
      setIsDragging(false);
      
      document.body.classList.remove('no-select', 'can-drop-on-desktop');
      document.body.style.cursor = '';
      
      // Verwijder listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Verwijder de ghost
      const clone = document.getElementById('drag-clone');
      if (clone) document.body.removeChild(clone);
      
      // Bepaal of we boven het bureaublad hebben losgelaten
      const minY = 60; // Ongeveer de hoogte van de toolbar
      const isOverDesktop = e.clientY > minY;
      
      if (isOverDesktop && parentFolderId) {
        try {
          // Probeer het bestand uit de map te verplaatsen naar het bureaublad
          setWasDroppedOnDesktop(true);
          
          // Zet de global sleepcondities terug
          window._draggingFileFromFolder = false;
          
          // Roep de API aan om het bestand uit de map te verwijderen
          if (file.id !== undefined) {
            await removeFileFromFolder(file.id, { 
              x: e.clientX, 
              y: e.clientY 
            });
          }
          
          toast({
            title: "Bestand verplaatst",
            description: `${file.name} is naar het bureaublad verplaatst.`,
            duration: 3000,
          });
          
        } catch (error) {
          console.error('Fout bij verplaatsen bestand:', error);
          setWasDroppedOnDesktop(false);
          
          toast({
            title: "Fout",
            description: `Kon ${file.name} niet verplaatsen.`,
            variant: "destructive"
          });
        }
      }
      
      // Reset alle globale variabelen
      window._draggingFileFromFolder = false;
      window.draggedFileInfo = undefined;
      window._desktopDragPosition = undefined;
    }
  };
  
  // Effect om component op te ruimen als deze verwijderd wordt
  // Luisteren naar WebSocket-verbinding
  useEffect(() => {
    if (isConnected && file.isFolder === 'true') {
      console.log(`🔌 WebSocket verbonden voor map ${file.name} (ID: ${file.id})`);
      
      // Stuur bericht dat we deze map volgen
      if (file.id) {
        sendMessage({
          type: 'subscribeToFolder',
          folderId: file.id
        });
      }
    }
  }, [isConnected, file.id, file.name, file.isFolder, sendMessage]);
  
  // Luisteren naar WebSocket-berichten over nieuwe bestanden die naar mappen worden gesleept
  useEffect(() => {
    if (lastMessage && file.isFolder === 'true' && file.id) {
      if (lastMessage.type === 'mapupdate' && lastMessage.folderId === file.id) {
        console.log(`📩 WebSocket bericht ontvangen voor map ${file.name}: update met ${lastMessage.fileCount} bestanden`);
        
        // Toon visuele feedback als een bestand naar deze map is gesleept
        if (dragElementRef.current) {
          // Voeg een pulse animatie toe aan de map
          dragElementRef.current.classList.add('folder-updated');
          
          // Verwijder de animatie na 1 seconde
          setTimeout(() => {
            if (dragElementRef.current) {
              dragElementRef.current.classList.remove('folder-updated');
            }
          }, 1000);
        }
      }
    }
  }, [lastMessage, file.id, file.name, file.isFolder]);
  
  // Opruimen bij unmount
  useEffect(() => {
    return () => {
      // Clean-up als de component unmount
      if (isDragging) {
        document.body.classList.remove('no-select', 'can-drop-on-desktop');
        document.body.style.cursor = '';
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        // Verwijder drag clone als die bestaat
        const clone = document.getElementById('drag-clone');
        if (clone) document.body.removeChild(clone);
        
        window._draggingFileFromFolder = false;
        window.draggedFileInfo = undefined;
      }
    };
  }, [isDragging]);
  
  // Als het bestand naar het bureaublad is verplaatst, toon dan niets
  if (wasDroppedOnDesktop) {
    return null;
  }
  
  return (
    <div 
      className={`folder-item-container ${isDragging ? 'opacity-50' : ''}`} 
      ref={dragElementRef}
    >
      <div className="flex items-center mb-1 rounded-md overflow-hidden">
        {/* Grip handle voor slepen */}
        <div 
          className="bg-blue-50 hover:bg-blue-100 p-2 cursor-grab active:cursor-grabbing flex-shrink-0"
          onMouseDown={startDrag}
        >
          <GripVertical size={16} className="text-blue-600" />
        </div>
        
        {/* Bestandsitem (alleen klikbaar) */}
        <div
          className="folder-item flex-grow flex items-center p-3 pl-3 hover:bg-gray-100 border-y border-r border-gray-200 bg-white"
          onClick={handleFileClick}
          data-file-id={file.id}
          data-parent-folder={parentFolderId}
        >
          <div className="flex items-center gap-3 w-full">
            <div>
              {getIcon()}
            </div>
            <div className="truncate font-medium text-sm">{file.name}</div>
          </div>
        </div>
      </div>
    </div>
  );
}