// Draggable folder window met iframe voor de inhoud
import React, { useState, useRef, useEffect } from 'react';
import { DesktopFile } from '@/types';
import { X, Folder, Maximize, Minimize, FileText } from 'lucide-react';

interface DraggableFolderWindowProps {
  folder: DesktopFile;
  onClose: () => void;
  onDragEnd?: (id: number, x: number, y: number) => void;
}

export function DraggableFolderWindow({ folder, onClose, onDragEnd }: DraggableFolderWindowProps) {
  const [position, setPosition] = useState(() => ({
    x: folder.position?.x || 100,
    y: folder.position?.y || 100
  }));
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({
    width: folder.dimensions?.width || 600,
    height: folder.dimensions?.height || 450
  });
  const [isMaximized, setIsMaximized] = useState(false);
  const [preMaximizeState, setPreMaximizeState] = useState({
    position: { x: 0, y: 0 },
    dimensions: { width: 0, height: 0 }
  });
  const [folderFiles, setFolderFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const windowRef = useRef<HTMLDivElement>(null);
  
  // Direct de map inhoud ophalen zonder iframe - Supersnel met preloading
  useEffect(() => {
    // Snellere eerste laadtijd door directe instelling van laadstatus
    setIsLoading(true);
    
    // Object voor het beheren van fetch-verzoeken
    let isMounted = true;
    
    // Toon eerst de laadspinner, dan fetch data (zorgt voor betere UX)
    const fetchFolderContent = async () => {
      try {
        // Gebruik een AbortController voor snellere annulering indien nodig
        const controller = new AbortController();
        const signal = controller.signal;
        
        // Onmiddellijk verzoek starten zonder await te gebruiken
        const fetchPromise = fetch(`/api/folders/${folder.id}/files?t=${Date.now()}`, {
          signal,
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        // Instellen van een timeout om te voorkomen dat verzoeken te lang duren
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        // Nu wachten op de response
        const response = await fetchPromise;
        clearTimeout(timeoutId);
        
        if (!isMounted) return;
        
        const data = await response.json();
        
        if (data && Array.isArray(data.files)) {
          // Onmiddellijk voldoende gegevens tonen voor gebruikersinteractie
          const visibleFiles = data.files.slice(0, 20); // Maximaal 20 bestanden direct laden
          
          // Meteen bestanden instellen zonder te wachten op volledige verwerking
          setFolderFiles(visibleFiles);
          setIsLoading(false);
          
          // Als er meer bestanden zijn, laad ze dan op de achtergrond
          if (data.files.length > 20 && isMounted) {
            // Gebruik window.requestAnimationFrame voor soepele UI
            requestAnimationFrame(() => {
              if (isMounted) setFolderFiles(data.files);
            });
          }
        } else {
          if (isMounted) setFolderFiles([]);
        }
      } catch (error) {
        console.error('Fout bij ophalen mapinhoud:', error);
        if (isMounted) setFolderFiles([]); // Toon lege lijst bij fouten
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    // Direct aanroepen en wachten op eerste render voor spinner animatie
    requestAnimationFrame(() => {
      if (isMounted) fetchFolderContent();
    });
    
    // Minder frequente auto-refresh om server te ontlasten
    const interval = setInterval(fetchFolderContent, 10000);
    
    // Cleanup functie
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [folder.id]);
  // Venster slepen
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!windowRef.current) return;
    
    // Alleen reageren op muisklikken op de header, niet op de hele window
    if ((e.target as HTMLElement).closest('.folder-header')) {
      setIsDragging(true);
      const rect = windowRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      
      // Voorkom selectie van tekst tijdens slepen
      e.preventDefault();
    }
  };
  
  // Slepend venster volgen
  useEffect(() => {
    if (!isDragging) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      
      // Meld de nieuwe positie aan de parent component
      if (folder.id && onDragEnd) {
        onDragEnd(folder.id, position.x, position.y);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, folder.id, onDragEnd, position]);
  
  // Maximaliseren/minimaliseren
  const toggleMaximize = () => {
    if (isMaximized) {
      // Herstel naar vorige staat
      setPosition(preMaximizeState.position);
      setDimensions(preMaximizeState.dimensions);
      setIsMaximized(false);
    } else {
      // Sla huidige staat op en maximaliseer
      setPreMaximizeState({
        position: { ...position },
        dimensions: { ...dimensions }
      });
      
      // Pas grootte aan naar venstergrootte
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      
      setPosition({
        x: 20,
        y: 20
      });
      
      setDimensions({
        width: windowWidth - 40,
        height: windowHeight - 40
      });
      
      setIsMaximized(true);
    }
  };
  
  // Styling
  const styles = {
    window: {
      position: 'absolute',
      zIndex: 100,
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${dimensions.width}px`,
      height: `${dimensions.height}px`,
      borderRadius: '8px',
      backgroundColor: 'white',
      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      border: '1px solid #e2e8f0',
    } as React.CSSProperties,
    
    header: {
      backgroundColor: '#3b82f6',
      color: 'white',
      padding: '8px 12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      cursor: 'move',
      userSelect: 'none',
    } as React.CSSProperties,
    
    title: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontWeight: 'bold',
      fontSize: '14px',
    } as React.CSSProperties,
    
    controls: {
      display: 'flex',
      gap: '6px',
    } as React.CSSProperties,
    
    button: {
      background: 'transparent',
      border: 'none',
      color: 'white',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '24px',
      height: '24px',
      borderRadius: '4px',
    } as React.CSSProperties,
    
    buttonHover: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    } as React.CSSProperties,
    
    content: {
      flex: 1,
      overflow: 'hidden',
    } as React.CSSProperties,
    
    iframe: {
      width: '100%',
      height: '100%',
      border: 'none',
    } as React.CSSProperties,
  };

  return (
    <div 
      ref={windowRef}
      style={styles.window}
      onMouseDown={handleMouseDown}
      className={`folder-window ${isDragging ? 'dragging' : ''}`}
    >
      <div style={styles.header} className="folder-header">
        <div style={styles.title}>
          <Folder size={16} />
          <span>{folder.name}</span>
        </div>
        
        <div style={styles.controls}>
          <button 
            style={styles.button} 
            onClick={toggleMaximize}
            title={isMaximized ? "Normaliseren" : "Maximaliseren"}
          >
            {isMaximized ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          
          <button 
            style={styles.button}
            onClick={onClose}
            title="Sluiten"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      
      <div style={{...styles.content, padding: '16px', overflow: 'auto'}}>
        {isLoading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#666'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid #f3f3f3',
              borderTop: '3px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '12px'
            }}></div>
            <style>
              {`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}
            </style>
            <div>Laden...</div>
          </div>
        ) : folderFiles.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '32px',
            color: '#666'
          }}>
            <div style={{marginBottom: '12px'}}>
              <Folder size={40} color="#ccc" />
            </div>
            <div style={{fontWeight: 'bold', marginBottom: '8px'}}>
              Map is leeg
            </div>
            <div style={{fontSize: '14px'}}>
              Deze map bevat geen bestanden of submappen
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '16px',
            padding: '8px'
          }}>
            {folderFiles.map((file) => (
              <div key={file.id} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '12px 8px',
                border: '1px solid #eee',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
                backgroundColor: 'white',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.05)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '8px'
                }}>
                  {file.type === 'folder' ? (
                    <Folder size={32} color="#3b82f6" />
                  ) : (
                    <FileText size={32} color="#3b82f6" />
                  )}
                </div>
                <div style={{
                  fontSize: '13px',
                  textAlign: 'center',
                  width: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }} title={file.name}>
                  {file.name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}