// Een vereenvoudigde versie van de FolderView component

import React, { useState, useEffect } from 'react';
import { DesktopFile } from '@/types';
import { X, FileText } from 'lucide-react';

interface BasicFolderViewProps {
  folder: DesktopFile;
  onClose: () => void;
}

export function BasicFolderView({ folder, onClose }: BasicFolderViewProps) {
  const [files, setFiles] = useState<DesktopFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // DIRECTE fetch zonder caching, complexe logica of websockets
  useEffect(() => {
    async function fetchFilesDirectly() {
      if (!folder.id) return;
      
      setIsLoading(true);
      try {
        console.log(`BASIC FOLDER VIEW: Ophalen bestanden voor map ${folder.id}`);
        const response = await fetch(`/api/folders/${folder.id}/files?nocache=${new Date().getTime()}`);
        const data = await response.json();
        
        console.log(`BASIC FOLDER VIEW: Ontvangen data:`, data);
        
        if (data && Array.isArray(data.files)) {
          console.log(`BASIC FOLDER VIEW: ${data.files.length} bestanden gevonden`);
          setFiles(data.files);
        } else {
          console.error('Onverwachte data structuur:', data);
          setFiles([]);
          setError('De server stuurde een onverwachte datastructuur');
        }
      } catch (err) {
        console.error('Fout bij ophalen mapbestanden:', err);
        setError('Fout bij het ophalen van de bestanden');
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchFilesDirectly();
  }, [folder.id]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-3/4 h-3/4 max-w-4xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-blue-600 text-white p-3 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Map: {folder.name} (ID: {folder.id})</h2>
          <button onClick={onClose} className="p-1 hover:bg-blue-700 rounded">
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 h-[calc(100%-60px)] overflow-auto">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
              <p className="mt-2">Bestanden laden...</p>
            </div>
          )}
          
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center h-full text-red-600">
              <p>Fout: {error}</p>
              <button 
                className="mt-2 bg-blue-600 text-white px-3 py-1 rounded"
                onClick={() => window.location.reload()}
              >
                Vernieuwen
              </button>
            </div>
          )}
          
          {!isLoading && !error && files.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p>Deze map is leeg</p>
            </div>
          )}
          
          {!isLoading && !error && files.length > 0 && (
            <div>
              <p className="mb-4 text-sm font-semibold">{files.length} bestanden gevonden:</p>
              <div className="grid grid-cols-4 gap-4">
                {files.map((file) => (
                  <div key={file.id} className="border rounded p-2 hover:bg-gray-100">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="truncate text-sm" title={file.name}>
                        {file.name}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      ID: {file.id}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 p-4 border rounded bg-gray-50">
                <p className="font-mono text-xs whitespace-pre-wrap">
                  {JSON.stringify(files, null, 2)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}