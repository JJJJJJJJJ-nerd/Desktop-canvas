// Draggable folder window met iframe voor de inhoud
import React, { useState, useRef, useEffect } from 'react';
import { DesktopFile } from '@/types';
import { X, Folder, Maximize, Minimize } from 'lucide-react';

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
  const [iframeLoading, setIframeLoading] = useState(true);
  
  const windowRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Iframe URL samenstellen
  const iframeUrl = `/folder-content?folderId=${folder.id}&folderName=${encodeURIComponent(folder.name)}&t=${Date.now()}`;
  
  // Detecteer wanneer iframe geladen is
  const handleIframeLoad = () => {
    setIframeLoading(false);
  };
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
      
      <div style={styles.content}>
        {iframeLoading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5
          }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '10px'
            }}></div>
            <style>
              {`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}
            </style>
            <div style={{ fontSize: '14px', color: '#666' }}>
              Map "{folder.name}" wordt geladen...
            </div>
          </div>
        )}
        <iframe 
          ref={iframeRef}
          src={iframeUrl} 
          style={styles.iframe}
          title={`Map: ${folder.name}`}
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
}