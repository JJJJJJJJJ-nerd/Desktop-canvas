// FolderContentPage.tsx - Standalone pagina voor het bekijken van mapinhoud
import React, { useState, useEffect } from 'react';

export default function FolderContentPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Folder ID uit URL parameters halen
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const folderId = searchParams.get('folderId');
    
    if (!folderId) {
      setError('Geen map ID opgegeven in URL');
      setLoading(false);
      return;
    }
    
    // Bestanden ophalen
    const fetchFiles = async () => {
      try {
        const response = await fetch(`/api/folders/${folderId}/files?t=${Date.now()}`);
        const data = await response.json();
        
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
    
    fetchFiles();
    
    // Ververs elke 5 seconden
    const interval = setInterval(fetchFiles, 5000);
    
    // Cleanup
    return () => clearInterval(interval);
  }, []);
  
  // Styling - puur inline CSS
  const styles = {
    container: {
      padding: '20px',
      maxWidth: '100%',
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif',
    } as React.CSSProperties,
    
    header: {
      marginBottom: '20px',
      paddingBottom: '10px',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    } as React.CSSProperties,
    
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#374151',
      marginBottom: '0',
    } as React.CSSProperties,
    
    subtitle: {
      fontSize: '14px',
      color: '#6b7280',
    } as React.CSSProperties,
    
    headerActions: {
      display: 'flex',
      gap: '8px',
    } as React.CSSProperties,
    
    viewToggle: {
      display: 'flex',
      alignItems: 'center',
      padding: '4px 8px',
      fontSize: '13px',
      borderRadius: '4px',
      background: '#f9fafb',
      border: '1px solid #e5e7eb',
      cursor: 'pointer',
    } as React.CSSProperties,
    
    loading: {
      textAlign: 'center',
      padding: '60px 20px',
      color: '#6b7280',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    } as React.CSSProperties,
    
    loadingSpinner: {
      width: '40px',
      height: '40px',
      border: '3px solid #f3f3f3',
      borderRadius: '50%',
      borderTop: '3px solid #3b82f6',
      marginBottom: '16px',
    } as React.CSSProperties,
    
    error: {
      padding: '16px',
      backgroundColor: '#fee2e2',
      borderRadius: '4px',
      color: '#b91c1c',
      marginBottom: '20px',
    } as React.CSSProperties,
    
    fileCount: {
      padding: '8px 0',
      marginBottom: '8px',
      color: '#6b7280',
      fontSize: '14px',
    } as React.CSSProperties,
    
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: '16px',
      padding: '8px',
    } as React.CSSProperties,
    
    list: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
    } as React.CSSProperties,
    
    listItem: {
      display: 'flex',
      alignItems: 'center',
      padding: '10px 12px',
      borderBottom: '1px solid #f3f3f4',
      transition: 'background-color 0.15s',
      cursor: 'pointer',
    } as React.CSSProperties,
    
    listIcon: {
      width: '24px',
      height: '24px',
      marginRight: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    } as React.CSSProperties,
    
    listName: {
      flex: '1',
      fontSize: '14px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    } as React.CSSProperties,
    
    fileCard: {
      border: '1px solid #e5e7eb',
      borderRadius: '6px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      transition: 'all 0.2s',
      cursor: 'pointer',
      backgroundColor: 'white',
      '&:hover': {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        transform: 'translateY(-2px)',
      },
    } as React.CSSProperties,
    
    fileIcon: {
      width: '48px',
      height: '48px',
      backgroundColor: '#eff6ff',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '12px',
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
    
    fileInfo: {
      fontSize: '12px',
      color: '#6b7280',
      marginTop: '4px',
    } as React.CSSProperties,
    
    empty: {
      textAlign: 'center',
      padding: '40px',
      color: '#6b7280',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      border: '1px dashed #d1d5db',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: '20px',
    } as React.CSSProperties,
    
    emptyIcon: {
      width: '48px',
      height: '48px',
      marginBottom: '16px',
      opacity: 0.5,
    } as React.CSSProperties,

  };

  // Page content
  const searchParams = new URLSearchParams(window.location.search);
  const folderId = searchParams.get('folderId');
  const folderName = searchParams.get('folderName') || 'Map';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          {folderName}
        </div>

      </div>
      
      {loading ? (
        <div style={styles.loading}>
          <div style={{width: '40px', height: '40px', border: '3px solid #f3f3f3', borderRadius: '50%', borderTop: '3px solid #3b82f6', animation: 'spin 1s linear infinite', marginBottom: '16px'}}></div>
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
          <div>Bezig met laden van mapinhoud...</div>
        </div>
      ) : error ? (
        <div style={styles.error}>
          <strong>Fout bij laden:</strong>
          <div>{error}</div>
        </div>
      ) : files.length === 0 ? (
        <div style={styles.empty}>
          <div style={{width: '48px', height: '48px', marginBottom: '16px', opacity: 0.5}}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1">
              <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM6 14c0-.55.45-1 1-1s1 .45 1 1-.45 1-1 1-1-.45-1-1zm3 0c0-.55.45-1 1-1s1 .45 1 1-.45 1-1 1-1-.45-1-1zm3 0c0-.55.45-1 1-1s1 .45 1 1-.45 1-1 1-1-.45-1-1z"/>
            </svg>
          </div>
          <div style={{ fontSize: '18px', marginBottom: '8px', fontWeight: 500 }}>Deze map is leeg</div>
          <div style={{ color: '#6b7280', fontSize: '14px' }}>
            Er zijn geen bestanden of submappen in deze map.
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '16px' }}>
            <strong>{files.length}</strong> {files.length === 1 ? 'bestand' : 'bestanden'} in deze map
          </div>
          
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
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}