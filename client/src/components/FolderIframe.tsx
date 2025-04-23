// Zeer eenvoudige iframe-gebaseerde map viewer - werkt altijd
import React from 'react';
import { DesktopFile } from '@/types';
import { Button } from './ui/button';
import { X, Folder } from 'lucide-react';

interface FolderIframeProps {
  folder: DesktopFile;
  onClose: () => void;
}

export function FolderIframe({ folder, onClose }: FolderIframeProps) {
  // Check of we een geldige map hebben
  if (!folder || !folder.id) {
    console.error('Geen geldige map ontvangen:', folder);
    return null;
  }
  
  // Iframe URL samenstellen
  const iframeUrl = `/folder-content?folderId=${folder.id}&folderName=${encodeURIComponent(folder.name)}`;
  console.log('IFRAME URL:', iframeUrl);
  
  // Styling voor de map interface
  const styles = {
    backdrop: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    } as React.CSSProperties,
    
    window: {
      backgroundColor: 'white',
      borderRadius: '8px',
      width: '90%',
      height: '90%',
      maxWidth: '1000px',
      maxHeight: '700px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    } as React.CSSProperties,
    
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 16px',
      backgroundColor: '#3b82f6',
      color: 'white',
    } as React.CSSProperties,
    
    title: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontWeight: 'bold',
    } as React.CSSProperties,
    
    iframe: {
      flex: 1,
      border: 'none',
      width: '100%',
      height: '100%',
    } as React.CSSProperties,
  };

  // Stop propagatie om te voorkomen dat klikken op de map het venster sluit
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.window} onClick={handleContentClick}>
        <div style={styles.header}>
          <div style={styles.title}>
            <Folder size={18} />
            <span>{folder.name} (ID: {folder.id})</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            style={{ color: 'white' }}
          >
            <X size={18} />
          </Button>
        </div>
        
        <iframe 
          src={iframeUrl} 
          style={styles.iframe}
          title={`Map: ${folder.name}`}
        />
      </div>
    </div>
  );
}