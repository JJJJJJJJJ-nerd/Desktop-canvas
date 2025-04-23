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
        console.log(`[FolderPage] Ophalen bestanden voor map ${folderId}`);
        const response = await fetch(`/api/folders/${folderId}/files?t=${Date.now()}`);
        const data = await response.json();
        
        console.log('[FolderPage] Ontvangen data:', data);
        
        if (data && Array.isArray(data.files)) {
          setFiles(data.files);
        } else {
          setError('Ongeldig antwoord van server');
        }
      } catch (err) {
        console.error('[FolderPage] Fout bij ophalen bestanden:', err);
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
    } as React.CSSProperties,
    
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#374151',
      marginBottom: '5px',
    } as React.CSSProperties,
    
    subtitle: {
      fontSize: '14px',
      color: '#6b7280',
    } as React.CSSProperties,
    
    loading: {
      textAlign: 'center',
      padding: '40px',
      color: '#6b7280',
    } as React.CSSProperties,
    
    error: {
      padding: '16px',
      backgroundColor: '#fee2e2',
      borderRadius: '4px',
      color: '#b91c1c',
      marginBottom: '20px',
    } as React.CSSProperties,
    
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: '16px',
      padding: '8px',
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
    } as React.CSSProperties,
    
    debugSection: {
      marginTop: '30px',
      padding: '16px',
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '4px',
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
          {folderName} (ID: {folderId})
        </div>
        <div style={styles.subtitle}>
          Deze pagina toont de inhoud van de map rechtsreeks zonder complexe componenten
        </div>
      </div>
      
      {loading ? (
        <div style={styles.loading}>
          Bezig met laden van mapinhoud...
        </div>
      ) : error ? (
        <div style={styles.error}>
          <strong>Fout bij laden:</strong>
          <div>{error}</div>
        </div>
      ) : files.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Deze map is leeg</div>
          <div>Er zijn geen bestanden of submappen in deze map.</div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '16px' }}>
            <strong>{files.length} bestanden/mappen gevonden:</strong>
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