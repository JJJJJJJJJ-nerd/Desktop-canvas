// Een zeer eenvoudige mapweergave zonder complexe React-logica

import React, { useState, useEffect } from 'react';
import { DesktopFile } from '@/types';
import { X, Folder, FileText, RefreshCw } from 'lucide-react';

interface SuperSimpleFolderViewProps {
  folder: DesktopFile;
  onClose: () => void;
}

export function SuperSimpleFolderView({ folder, onClose }: SuperSimpleFolderViewProps) {
  const [files, setFiles] = useState<DesktopFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());

  // Functie om bestanden op te halen
  const fetchFiles = async () => {
    if (!folder.id) return;
    
    setIsLoading(true);
    try {
      console.log(`SUPER SIMPLE: Ophalen bestanden voor map ${folder.id}`);
      const response = await fetch(`/api/folders/${folder.id}/files?nocache=${Date.now()}`);
      const data = await response.json();
      
      console.log(`SUPER SIMPLE: Ontvangen data:`, data);
      
      if (data && Array.isArray(data.files)) {
        console.log(`SUPER SIMPLE: ${data.files.length} bestanden gevonden`);
        setFiles(data.files);
      } else {
        console.error('Onverwachte data structuur:', data);
        setFiles([]);
        setError('De server stuurde een onverwachte datastructuur');
      }
    } catch (err: any) {
      console.error('Fout bij ophalen mapbestanden:', err);
      setError(err.message || 'Fout bij het ophalen van de bestanden');
      setFiles([]);
    } finally {
      setIsLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    }
  };

  // Bij eerste render en bij wijziging van folder.id
  useEffect(() => {
    fetchFiles();
    
    // Elke 5 seconden verversen
    const interval = setInterval(fetchFiles, 5000);
    
    // Cleanup
    return () => clearInterval(interval);
  }, [folder.id]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-4/5 h-4/5 max-w-5xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-blue-600 text-white p-3 flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            Map: {folder.name} 
            <span className="ml-2 text-xs opacity-70">(ID: {folder.id})</span>
          </h2>
          <div className="flex items-center space-x-2">
            <button 
              onClick={fetchFiles} 
              className="p-1 hover:bg-blue-700 rounded flex items-center"
              title="Vernieuwen"
            >
              <RefreshCw size={18} />
            </button>
            <button 
              onClick={onClose} 
              className="p-1 hover:bg-blue-700 rounded"
              title="Sluiten"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="text-sm text-gray-500 mb-4 flex justify-between items-center">
            <div>
              {isLoading ? 'Bestanden worden geladen...' : `Laatste update: ${lastUpdated}`}
            </div>
            <button 
              onClick={fetchFiles}
              className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
            >
              <RefreshCw size={14} className="mr-1" />
              Vernieuwen
            </button>
          </div>
          
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
              <p className="mt-4">Bestanden laden...</p>
            </div>
          )}
          
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center py-20 text-red-600">
              <div className="text-xl mb-2">⚠️</div>
              <p>Fout: {error}</p>
              <button 
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
                onClick={fetchFiles}
              >
                Opnieuw proberen
              </button>
            </div>
          )}
          
          {!isLoading && !error && files.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <Folder size={64} className="text-gray-300 mb-4" />
              <p>Deze map is leeg</p>
              <p className="text-sm text-gray-400 mt-1">Er zijn geen bestanden in deze map.</p>
            </div>
          )}
          
          {!isLoading && !error && files.length > 0 && (
            <div>
              <h3 className="font-semibold mb-4">{files.length} bestanden in deze map:</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {files.map((file) => (
                  <div 
                    key={file.id} 
                    className="border rounded p-3 hover:bg-gray-50 flex flex-col items-center text-center"
                  >
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-2">
                      <FileText className="text-blue-600" size={24} />
                    </div>
                    <div className="truncate w-full text-sm font-medium" title={file.name}>
                      {file.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      ID: {file.id}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Debug info */}
              <div className="mt-8 p-4 border rounded bg-gray-50">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-mono text-sm">Debug informatie:</div>
                  <button 
                    onClick={() => console.log('Bestandsdata:', files)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Log naar console
                  </button>
                </div>
                <pre className="text-xs overflow-auto max-h-40 bg-gray-100 p-2 rounded">
                  {JSON.stringify(files, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}