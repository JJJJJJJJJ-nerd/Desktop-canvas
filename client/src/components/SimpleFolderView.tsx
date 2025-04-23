// Een zeer eenvoudige, iframe-gebaseerde mapweergave zonder complexe React-logica

import React, { useState } from 'react';
import { DesktopFile } from '@/types';
import { X, Folder } from 'lucide-react';

interface SimpleFolderViewProps {
  folder: DesktopFile;
  onClose: () => void;
}

export function SimpleFolderView({ folder, onClose }: SimpleFolderViewProps) {
  const [iframeKey, setIframeKey] = useState(Date.now()); // Voor forced refresh
  
  // Bouw een volledige HTML-pagina die gerenderd wordt binnen een iframe
  const createIframeContent = () => {
    const folderId = folder.id;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Map: ${folder.name}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: white;
            color: #333;
          }
          
          h1 {
            font-size: 18px;
            margin-bottom: 15px;
            color: #1E40AF;
            border-bottom: 1px solid #E5E7EB;
            padding-bottom: 10px;
          }
          
          .file-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 20px;
          }
          
          .file-item {
            border: 1px solid #E5E7EB;
            border-radius: 6px;
            padding: 10px;
            transition: background-color 0.2s;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          
          .file-item:hover {
            background-color: #F3F4F6;
          }
          
          .file-icon {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 8px;
            background-color: #E5E7EB;
            border-radius: 6px;
          }
          
          .file-name {
            font-size: 14px;
            word-break: break-word;
            max-width: 130px;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .file-id {
            font-size: 10px;
            color: #9CA3AF;
            margin-top: 4px;
          }
          
          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 0;
            color: #9CA3AF;
          }
          
          .empty-icon {
            width: 60px;
            height: 60px;
            margin-bottom: 15px;
            color: #E5E7EB;
          }
          
          .refresh-button {
            background-color: #1E40AF;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 16px;
            font-size: 14px;
            cursor: pointer;
            margin-top: 15px;
          }
          
          .refresh-button:hover {
            background-color: #1C3879;
          }
          
          .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100px;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .spinner {
            border: 4px solid #E5E7EB;
            border-radius: 50%;
            border-top: 4px solid #1E40AF;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
          }
          
          .debug-section {
            margin-top: 30px;
            padding: 15px;
            background-color: #F9FAFB;
            border-radius: 6px;
            border: 1px solid #E5E7EB;
          }
          
          .debug-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          
          pre {
            font-family: monospace;
            font-size: 12px;
            background-color: #F3F4F6;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>
        <h1>Inhoud van map: ${folder.name} (ID: ${folderId})</h1>
        <div id="content">
          <div class="loading">
            <div class="spinner"></div>
          </div>
        </div>
        
        <script>
          // Direct na het laden van het iframe uitvoeren
          (function() {
            const contentElement = document.getElementById('content');
            
            // Functie om bestanden op te halen en weer te geven
            async function loadFolderContents() {
              try {
                contentElement.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
                
                // Bestanden ophalen via fetch API
                const response = await fetch(\`/api/folders/${folderId}/files?ts=\${Date.now()}\`);
                const responseData = await response.json();
                
                console.log('Ontvangen data:', responseData);
                
                if (responseData && Array.isArray(responseData.files)) {
                  if (responseData.files.length === 0) {
                    // Lege map weergeven
                    contentElement.innerHTML = \`
                      <div class="empty-state">
                        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"></path>
                        </svg>
                        <div>Deze map is leeg</div>
                        <div class="file-id">Map ID: ${folderId}</div>
                        <button class="refresh-button" onclick="loadFolderContents()">Vernieuwen</button>
                      </div>
                    \`;
                  } else {
                    // Bestanden weergeven
                    let html = \`
                      <div>
                        <div>${data.files.length} bestanden gevonden:</div>
                        <div class="file-grid">
                    \`;
                    
                    data.files.forEach(file => {
                      html += \`
                        <div class="file-item">
                          <div class="file-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <line x1="16" y1="13" x2="8" y2="13"></line>
                              <line x1="16" y1="17" x2="8" y2="17"></line>
                              <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                          </div>
                          <div class="file-name">${file.name}</div>
                          <div class="file-id">ID: ${file.id}</div>
                        </div>
                      \`;
                    });
                    
                    html += \`
                        </div>
                        <div class="debug-section">
                          <div class="debug-title">Debug informatie:</div>
                          <pre>${JSON.stringify(data.files, null, 2)}</pre>
                        </div>
                      </div>
                    \`;
                    
                    contentElement.innerHTML = html;
                  }
                } else {
                  contentElement.innerHTML = \`
                    <div class="empty-state">
                      <div>Er is een fout opgetreden bij het laden van de bestanden</div>
                      <button class="refresh-button" onclick="loadFolderContents()">Opnieuw proberen</button>
                      <pre>${JSON.stringify(data, null, 2)}</pre>
                    </div>
                  \`;
                }
              } catch (error) {
                contentElement.innerHTML = \`
                  <div class="empty-state">
                    <div>Er is een fout opgetreden: ${error.message}</div>
                    <button class="refresh-button" onclick="loadFolderContents()">Opnieuw proberen</button>
                  </div>
                \`;
              }
            }
            
            // Bestanden laden wanneer het iframe is geladen
            loadFolderContents();
            
            // Regelmatig verversen
            setInterval(loadFolderContents, 5000);
          })();
        </script>
      </body>
      </html>
    `;
  };
  
  // Creëer een iframe met een data URI
  const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(createIframeContent())}`;
  
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
          <h2 className="text-lg font-semibold">Map: {folder.name}</h2>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setIframeKey(Date.now())} 
              className="p-1 hover:bg-blue-700 rounded flex items-center"
              title="Vernieuwen"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
              </svg>
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
        
        {/* Iframe container - neemt de rest van de ruimte in */}
        <div className="flex-1 min-h-0">
          <iframe
            key={iframeKey}
            src={dataUri}
            className="w-full h-full border-0"
            title={`Folder: ${folder.name}`}
            sandbox="allow-same-origin allow-scripts allow-popups"
          />
        </div>
      </div>
    </div>
  );
}