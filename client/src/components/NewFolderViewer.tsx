// Volledig nieuwe implementatie van de mapviewer
// Geen afhankelijkheid van bestaande componenten

import React, { useState, useEffect, useCallback } from 'react';
import { X, Folder, File, FileText, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';

type SimpleFile = {
  id: number;
  name: string;
  type: string;
  parentId?: number;
};

interface NewFolderViewerProps {
  folderId: number;
  folderName: string;
  onClose: () => void;
}

export function NewFolderViewer({ folderId, folderName, onClose }: NewFolderViewerProps) {
  const [files, setFiles] = useState<SimpleFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  
  // Functie om direct bestanden op te halen van de API
  const fetchFolderContents = useCallback(async () => {
    if (!folderId) return;
    
    console.log(`NewFolderViewer: Bestanden ophalen voor map ${folderId}`);
    setIsLoading(true);
    setError(null);
    
    try {
      // Direct API call zonder caching of andere complexiteit
      const response = await fetch(`/api/folders/${folderId}/files?ts=${Date.now()}`);
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('NewFolderViewer: Ontvangen data:', data);
      
      if (data && Array.isArray(data.files)) {
        setFiles(data.files);
        console.log(`NewFolderViewer: ${data.files.length} bestanden geladen`);
      } else {
        setFiles([]);
        console.warn('NewFolderViewer: Onverwachte datastructuur ontvangen', data);
      }
    } catch (err) {
      setError(`Er is een fout opgetreden: ${err instanceof Error ? err.message : String(err)}`);
      console.error('NewFolderViewer: Fout bij ophalen bestanden:', err);
    } finally {
      setIsLoading(false);
    }
  }, [folderId]);
  
  // Trigger initiële fetch en bij elke refresh
  useEffect(() => {
    fetchFolderContents();
    
    // Elke 5 seconden automatisch verversen
    const intervalId = setInterval(fetchFolderContents, 5000);
    return () => clearInterval(intervalId);
  }, [fetchFolderContents, refreshCounter]);
  
  // Handmatig verversen
  const handleRefresh = () => {
    setRefreshCounter(prev => prev + 1);
  };
  
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="relative bg-white w-[90vw] max-w-5xl rounded-lg overflow-hidden shadow-2xl"
        style={{ height: 'calc(90vh - 40px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Titelbalk */}
        <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <Folder className="mr-2" />
            <h2 className="font-semibold text-lg">{folderName}</h2>
            <span className="ml-2 text-xs opacity-75">ID: {folderId}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              className="p-1 hover:bg-blue-700 rounded-md transition"
              onClick={handleRefresh}
              title="Vernieuwen"
            >
              <RefreshCw size={20} />
            </button>
            <button 
              className="p-1 hover:bg-blue-700 rounded-md transition"
              onClick={onClose}
              title="Sluiten"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Inhoud */}
        <div className="p-6 overflow-auto" style={{ height: 'calc(100% - 56px)' }}>
          {/* Status */}
          <div className="mb-4 text-sm text-gray-500 flex justify-between items-center">
            <div>
              {isLoading ? (
                <span className="flex items-center">
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Bestanden worden geladen...
                </span>
              ) : (
                <span>
                  {files.length} bestanden in map
                </span>
              )}
            </div>
            
            <button 
              className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
              onClick={handleRefresh}
            >
              <RefreshCw size={14} className="mr-1" />
              Verversen
            </button>
          </div>
          
          {/* Error state */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4 text-red-700 flex items-start">
              <AlertTriangle className="mr-3 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-medium">Er is een fout opgetreden</p>
                <p className="mt-1 text-sm">{error}</p>
                <button 
                  className="mt-2 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md text-xs"
                  onClick={handleRefresh}
                >
                  Opnieuw proberen
                </button>
              </div>
            </div>
          )}
          
          {/* Leeg state */}
          {!isLoading && !error && files.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Folder size={48} className="mb-3 opacity-30" />
              <p className="text-lg">Deze map is leeg</p>
              <p className="text-sm mt-1">Sleep bestanden naar deze map om ze toe te voegen</p>
            </div>
          )}
          
          {/* Bestanden */}
          {!isLoading && !error && files.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {files.map(file => (
                <div 
                  key={file.id}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-blue-50 hover:border-blue-200 transition-colors flex flex-col items-center text-center"
                >
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-2">
                    {file.type === 'folder' || file.type === 'application/folder' ? (
                      <Folder className="text-blue-500" size={24} />
                    ) : (
                      <FileText className="text-blue-500" size={24} />
                    )}
                  </div>
                  <div 
                    className="text-sm font-medium text-gray-700 w-full truncate px-1" 
                    title={file.name}
                  >
                    {file.name}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    ID: {file.id}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Debug sectie */}
          {!isLoading && !error && files.length > 0 && (
            <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-md">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-gray-500">Debug Informatie</h3>
                <button 
                  className="text-xs text-blue-600"
                  onClick={() => console.log('Mapinhoud:', files)}
                >
                  Log naar console
                </button>
              </div>
              <pre className="text-xs overflow-auto bg-gray-100 p-3 rounded-md max-h-40">
                {JSON.stringify(files, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}