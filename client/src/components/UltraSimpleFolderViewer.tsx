// Ultraeenvoudige folder viewer met minimale aanpak
// Geen geavanceerde functies, alleen directe weergave van bestanden

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface UltraSimpleFolderViewerProps {
  folderId: number;
  folderName: string;
  onClose: () => void;
}

export function UltraSimpleFolderViewer({ folderId, folderName, onClose }: UltraSimpleFolderViewerProps) {
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Effect voor eerste keer laden
  useEffect(() => {
    // Direct functie voor het ophalen van bestanden
    async function getFiles() {
      try {
        setLoading(true);
        setError(null);
        
        // Directe fetch call met timestamp voor caching te voorkomen
        const response = await fetch(`/api/folders/${folderId}/files?nocache=${Date.now()}`);
        const data = await response.json();
        
        console.log(`ULTRA-EENVOUDIG: Ontvangen data voor map ${folderId}:`, data);
        
        if (data && Array.isArray(data.files)) {
          setFiles(data.files);
          console.log(`ULTRA-EENVOUDIG: ${data.files.length} bestanden gevonden`);
        } else {
          setFiles([]);
          setError('Onverwachte data structuur ontvangen van server');
          console.error('Onverwachte data structuur:', data);
        }
      } catch (err) {
        console.error('Fout bij ophalen map bestanden:', err);
        setError(`Er is een fout opgetreden: ${err instanceof Error ? err.message : 'Onbekende fout'}`);
      } finally {
        setLoading(false);
      }
    }
    
    // Roep functie aan
    getFiles();
    
    // Vernieuw elke 5 seconden
    const interval = setInterval(getFiles, 5000);
    return () => clearInterval(interval);
  }, [folderId]);
  
  // Merk op - geen complexe JSX, alleen basis HTML elementen
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          width: '80%', 
          maxWidth: '800px',
          height: '80%',
          maxHeight: '600px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          backgroundColor: '#2563eb', // blue-600
          color: 'white',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontWeight: 'bold' }}>
            Map: {folderName}
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div style={{ 
          padding: '20px',
          overflowY: 'auto',
          flexGrow: 1
        }}>
          {/* Loading */}
          {loading && (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 0',
              color: '#6b7280' // gray-500
            }}>
              <div style={{ 
                display: 'inline-block',
                width: '40px',
                height: '40px',
                border: '4px solid #e5e7eb', // gray-200
                borderTopColor: '#2563eb', // blue-600
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
              <p style={{ marginTop: '16px' }}>Bestanden laden...</p>
            </div>
          )}
          
          {/* Error */}
          {!loading && error && (
            <div style={{ 
              padding: '16px',
              backgroundColor: '#fee2e2', // red-100
              borderRadius: '6px',
              color: '#b91c1c', // red-700
              marginBottom: '16px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Fout</div>
              <div>{error}</div>
            </div>
          )}
          
          {/* Empty state */}
          {!loading && !error && files.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 0',
              color: '#6b7280' // gray-500
            }}>
              <p>Deze map is leeg</p>
            </div>
          )}
          
          {/* Files */}
          {!loading && !error && files.length > 0 && (
            <div>
              <h3 style={{ 
                marginBottom: '16px',
                fontSize: '16px',
                fontWeight: 'bold'
              }}>
                {files.length} bestanden in map
              </h3>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '16px'
              }}>
                {files.map((file: any) => (
                  <div key={file.id} style={{
                    border: '1px solid #e5e7eb', // gray-200
                    borderRadius: '6px',
                    padding: '12px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: '#eff6ff', // blue-50
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 8px auto',
                      borderRadius: '6px'
                    }}>
                      <svg 
                        width="24" 
                        height="24" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="#2563eb"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    </div>
                    <div style={{
                      fontWeight: 'medium',
                      fontSize: '14px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }} title={file.name}>
                      {file.name}
                    </div>

                  </div>
                ))}
              </div>
              

            </div>
          )}
        </div>
      </div>
    </div>
  );
}