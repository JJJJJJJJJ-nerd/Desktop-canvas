// Een super-vereenvoudigde versie van de FolderView component - zonder state

import React from 'react';
import { DesktopFile } from '@/types';
import { X, FileText, Folder } from 'lucide-react';

interface BasicFolderViewProps {
  folder: DesktopFile;
  onClose: () => void;
}

// HARDCODED data rechtstreeks laden in de component
// Dit is een directe benadering zonder enige complexe state-management
export function BasicFolderView({ folder, onClose }: BasicFolderViewProps) {
  // Direct functie om data van server te laden (sync)
  const loadFolderFiles = () => {
    const id = folder.id;
    if (!id) return [];

    try {
      // Controleer of er een fout optreedt
      const xhr = new XMLHttpRequest();
      xhr.open('GET', `/api/folders/${id}/files?ts=${Date.now()}`, false); // false = synchroon
      xhr.send();
      
      if (xhr.status !== 200) {
        console.error('Fout bij ophalen bestanden:', xhr.statusText);
        return [];
      }
      
      const data = JSON.parse(xhr.responseText);
      console.log('>>> SYNCHROON LADEN - DATA ONTVANGEN:', data);
      
      if (data && Array.isArray(data.files)) {
        return data.files;
      }
      
      return [];
    } catch (err) {
      console.error('Fout bij synchroon laden bestanden:', err);
      return [];
    }
  };
  
  // Direct laden
  const folderFiles = loadFolderFiles();
  console.log('>>> GELADEN BESTANDEN:', folderFiles.length, folderFiles);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" 
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-3/4 h-3/4 max-w-4xl overflow-hidden"
        style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
      >
        {/* Header - Eenvoudig en direct */}
        <div className="bg-blue-600 text-white p-3 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Map: {folder.name} (ID: {folder.id})</h2>
          <button onClick={onClose} className="p-1 hover:bg-blue-700 rounded">
            <X size={20} />
          </button>
        </div>
        
        {/* Content - Super simpel */}
        <div className="p-4 h-[calc(100%-60px)] overflow-auto">
          {folderFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Folder size={48} className="text-gray-300 mb-2" />
              <p>Deze map is leeg</p>
              <p className="text-sm text-gray-400 mt-1">Map ID: {folder.id}</p>
              <button 
                className="mt-4 bg-blue-600 text-white px-3 py-1 rounded"
                onClick={() => window.location.reload()}
              >
                Pagina vernieuwen
              </button>
            </div>
          ) : (
            <div>
              <p className="mb-4 text-sm font-semibold">{folderFiles.length} bestanden gevonden:</p>
              <div className="grid grid-cols-4 gap-4">
                {folderFiles.map((file: any) => (
                  <div key={file.id} className="border rounded p-3 hover:bg-gray-100">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="truncate text-sm font-medium" title={file.name}>
                        {file.name}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      ID: {file.id}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Debug info */}
              <div className="mt-8 p-4 border rounded bg-gray-50">
                <p className="font-mono text-xs overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(folderFiles, null, 2)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}