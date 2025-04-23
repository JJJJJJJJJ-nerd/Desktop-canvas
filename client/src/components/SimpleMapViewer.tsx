// Zo simpel mogelijk, zonder enige complexiteit
import React, { useState, useEffect } from 'react';
import { DesktopFile } from '@/types';
import { Button } from './ui/button';
import { X, Folder } from 'lucide-react';

interface SimpleMapViewerProps {
  folder: DesktopFile;
  onClose: () => void;
}

export function SimpleMapViewer({ folder, onClose }: SimpleMapViewerProps) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Als de map wijzigt, haal de inhoud op
  useEffect(() => {
    if (!folder || !folder.id) return;
    
    // Reset state bij nieuwe map
    setLoading(true);
    setError(null);
    
    // Bestanden ophalen met directe fetch
    const getFiles = async () => {
      try {
        console.log(`SimpleMapViewer: Ophalen bestanden voor map ${folder.id}`);
        const response = await fetch(`/api/folders/${folder.id}/files?t=${Date.now()}`);
        const data = await response.json();
        
        console.log('SimpleMapViewer: Ontvangen data:', data);
        
        if (data && Array.isArray(data.files)) {
          setFiles(data.files);
        } else {
          setError('Ongeldig antwoord van server');
        }
      } catch (err) {
        console.error('Fout bij ophalen bestanden:', err);
        setError(`Fout: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };
    
    getFiles();
    
    // Ververs elke 5 seconden
    const interval = setInterval(getFiles, 5000);
    
    // Cleanup
    return () => clearInterval(interval);
  }, [folder.id]);

  // Basis styling
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
      width: '80%',
      height: '80%',
      maxWidth: '900px',
      maxHeight: '600px',
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
    
    content: {
      flex: 1,
      padding: '16px',
      overflowY: 'auto',
    } as React.CSSProperties,
    
    loading: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      color: '#6b7280',
    } as React.CSSProperties,
    
    error: {
      padding: '16px',
      backgroundColor: '#fee2e2',
      borderRadius: '4px',
      color: '#b91c1c',
      margin: '16px',
    } as React.CSSProperties,
    
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
      gap: '16px',
      padding: '8px',
    } as React.CSSProperties,
    
    fileCard: {
      border: '1px solid #e5e7eb',
      borderRadius: '6px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      transition: 'all 0.2s',
      cursor: 'pointer',
    } as React.CSSProperties,
    
    fileIcon: {
      width: '40px',
      height: '40px',
      backgroundColor: '#eff6ff',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '8px',
    } as React.CSSProperties,
    
    fileName: {
      fontSize: '14px',
      fontWeight: 500,
      textAlign: 'center',
      width: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    } as React.CSSProperties,
    
    debugSection: {
      marginTop: '24px',
      padding: '12px',
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '4px',
    } as React.CSSProperties,
    
    empty: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '200px',
      color: '#6b7280',
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
        
        <div style={styles.content}>
          {loading ? (
            <div style={styles.loading}>
              Bezig met laden...
            </div>
          ) : error ? (
            <div style={styles.error}>
              <strong>Fout bij laden:</strong>
              <div>{error}</div>
            </div>
          ) : files.length === 0 ? (
            <div style={styles.empty}>
              <Folder size={48} color="#9ca3af" />
              <p>Deze map is leeg</p>
            </div>
          ) : (
            <>
              <h3>Bestanden in deze map ({files.length}):</h3>
              
              <div style={styles.grid}>
                {files.map((file) => (
                  <div key={file.id} style={styles.fileCard}>
                    <div style={styles.fileIcon}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    </div>
                    <div style={styles.fileName} title={file.name}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                      ID: {file.id}
                    </div>
                  </div>
                ))}
              </div>
              
              <div style={styles.debugSection}>
                <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Debug Informatie</h4>
                <pre style={{ 
                  fontSize: '12px', 
                  backgroundColor: '#f1f5f9', 
                  padding: '8px', 
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '150px'
                }}>
                  {JSON.stringify(files, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}