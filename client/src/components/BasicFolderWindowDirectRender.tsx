// Extreem eenvoudige implementatie met minimaal React en directe DOM-manipulatie
import React, { useEffect, useRef } from 'react';
import { DesktopFile } from '@/types';

interface BasicFolderWindowDirectRenderProps {
  folder: DesktopFile;
  onClose: () => void;
}

export function BasicFolderWindowDirectRender({ folder, onClose }: BasicFolderWindowDirectRenderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Direct DOM-manipulatie in plaats van React state management
  useEffect(() => {
    // Check of de container bestaat
    if (!containerRef.current || !folder.id) return;
    
    const folderId = folder.id;
    const folderName = folder.name;
    
    // Directe DOM manipulatie voor het tonen van de folder content
    const container = containerRef.current;
    
    // Header aanmaken
    const header = document.createElement('div');
    header.style.backgroundColor = '#3b82f6';
    header.style.color = 'white';
    header.style.padding = '12px';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    
    const title = document.createElement('div');
    title.textContent = `Map: ${folderName}`;
    title.style.fontWeight = 'bold';
    
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✕';
    closeButton.style.border = 'none';
    closeButton.style.background = 'transparent';
    closeButton.style.color = 'white';
    closeButton.style.fontSize = '16px';
    closeButton.style.cursor = 'pointer';
    closeButton.onclick = onClose;
    
    header.appendChild(title);
    header.appendChild(closeButton);
    container.appendChild(header);
    
    // Content container aanmaken
    const content = document.createElement('div');
    content.style.padding = '20px';
    content.style.overflow = 'auto';
    content.style.maxHeight = 'calc(100% - 48px)';
    
    // Loading indicator tonen
    const loadingDiv = document.createElement('div');
    loadingDiv.style.textAlign = 'center';
    loadingDiv.style.padding = '40px 0';
    loadingDiv.innerHTML = 'Bestanden laden...';
    content.appendChild(loadingDiv);
    
    container.appendChild(content);
    
    // Functie om bestanden op te halen en te tonen
    const loadFiles = async () => {
      try {
        console.log(`Direct DOM: Bestanden ophalen voor map ${folderId}`);
        const response = await fetch(`/api/folders/${folderId}/files?ts=${Date.now()}`);
        const data = await response.json();
        
        console.log('Direct DOM: Ontvangen data:', data);
        
        // Content element leegmaken
        content.innerHTML = '';
        
        if (data && Array.isArray(data.files)) {
          if (data.files.length === 0) {
            // Lege map tonen
            const emptyDiv = document.createElement('div');
            emptyDiv.style.textAlign = 'center';
            emptyDiv.style.padding = '40px 0';
            emptyDiv.style.color = '#6b7280';
            emptyDiv.innerHTML = 'Deze map is leeg';
            content.appendChild(emptyDiv);
          } else {
            // Aantal bestanden tonen
            const countDiv = document.createElement('h3');
            countDiv.textContent = `${data.files.length} bestanden gevonden:`;
            countDiv.style.marginBottom = '16px';
            content.appendChild(countDiv);
            
            // Grid container aanmaken voor bestanden
            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
            grid.style.gap = '16px';
            
            // Bestanden toevoegen aan grid
            data.files.forEach((file: any) => {
              const fileItem = document.createElement('div');
              fileItem.style.border = '1px solid #e5e7eb';
              fileItem.style.borderRadius = '6px';
              fileItem.style.padding = '12px';
              fileItem.style.textAlign = 'center';
              
              // Bestandsicoon
              const iconDiv = document.createElement('div');
              iconDiv.style.width = '40px';
              iconDiv.style.height = '40px';
              iconDiv.style.backgroundColor = '#eff6ff';
              iconDiv.style.display = 'flex';
              iconDiv.style.alignItems = 'center';
              iconDiv.style.justifyContent = 'center';
              iconDiv.style.borderRadius = '6px';
              iconDiv.style.margin = '0 auto 8px auto';
              iconDiv.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              `;
              
              // Bestandsnaam
              const nameDiv = document.createElement('div');
              nameDiv.textContent = file.name;
              nameDiv.style.fontWeight = '500';
              nameDiv.style.overflow = 'hidden';
              nameDiv.style.textOverflow = 'ellipsis';
              nameDiv.style.whiteSpace = 'nowrap';
              nameDiv.title = file.name;
              
              fileItem.appendChild(iconDiv);
              fileItem.appendChild(nameDiv);
              grid.appendChild(fileItem);
            });
            
            content.appendChild(grid);
            

          }
        } else {
          // Error tonen
          const errorDiv = document.createElement('div');
          errorDiv.style.padding = '16px';
          errorDiv.style.backgroundColor = '#fee2e2';
          errorDiv.style.borderRadius = '6px';
          errorDiv.style.color = '#b91c1c';
          
          const errorTitle = document.createElement('div');
          errorTitle.textContent = 'Fout';
          errorTitle.style.fontWeight = 'bold';
          errorTitle.style.marginBottom = '4px';
          
          const errorMessage = document.createElement('div');
          errorMessage.textContent = 'Onverwachte datastructuur ontvangen van server';
          
          errorDiv.appendChild(errorTitle);
          errorDiv.appendChild(errorMessage);
          content.appendChild(errorDiv);
          
          console.error('Onverwachte data structuur:', data);
        }
      } catch (err) {
        // Error tonen
        content.innerHTML = '';
        
        const errorDiv = document.createElement('div');
        errorDiv.style.padding = '16px';
        errorDiv.style.backgroundColor = '#fee2e2';
        errorDiv.style.borderRadius = '6px';
        errorDiv.style.color = '#b91c1c';
        
        const errorTitle = document.createElement('div');
        errorTitle.textContent = 'Fout';
        errorTitle.style.fontWeight = 'bold';
        errorTitle.style.marginBottom = '4px';
        
        const errorMessage = document.createElement('div');
        errorMessage.textContent = `Er is een fout opgetreden: ${err instanceof Error ? err.message : String(err)}`;
        
        errorDiv.appendChild(errorTitle);
        errorDiv.appendChild(errorMessage);
        content.appendChild(errorDiv);
        
        console.error('Fout bij ophalen map bestanden:', err);
      }
    };
    
    // Direct bestanden laden
    loadFiles();
    
    // Regelmatig verversen
    const intervalId = setInterval(loadFiles, 5000);
    
    // Cleanup when component unmounts
    return () => {
      clearInterval(intervalId);
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [folder.id, folder.name, onClose]);
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div 
        ref={containerRef}
        style={{
          backgroundColor: 'white',
          width: '80%',
          maxWidth: '800px',
          height: '80%',
          maxHeight: '600px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Container wordt via useEffect gevuld met DOM elementen */}
      </div>
    </div>
  );
}