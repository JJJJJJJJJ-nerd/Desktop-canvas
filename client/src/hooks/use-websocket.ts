import { useEffect, useState, useRef, useCallback } from 'react';

type WebSocketMessage = {
  type: string;
  [key: string]: any;
};

/**
 * Hook om een WebSocket verbinding te beheren
 */
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  
  // Folder updates bijhouden
  const [folderUpdates, setFolderUpdates] = useState<{[folderId: number]: number}>({});
  
  useEffect(() => {
    // WebSocket URL opbouwen op basis van huidige protocol (http/https -> ws/wss)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`🔌 WebSocket verbinding opzetten naar ${wsUrl}`);
    
    // WebSocket instantie maken
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;
    
    // Event handlers
    socket.onopen = () => {
      console.log('✅ WebSocket verbinding geopend');
      setIsConnected(true);
      setError(null);
    };
    
    socket.onclose = (event) => {
      console.log(`🔌 WebSocket verbinding gesloten: ${event.code} ${event.reason}`);
      setIsConnected(false);
      
      // Probeer opnieuw te verbinden na 3 seconden
      setTimeout(() => {
        console.log('🔄 Proberen opnieuw te verbinden...');
        // De hook wordt opnieuw uitgevoerd door de pagina te verversen
      }, 3000);
    };
    
    socket.onerror = (event) => {
      console.error('❌ WebSocket fout:', event);
      setError(new Error('WebSocket connection error'));
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📩 WebSocket bericht ontvangen:', data);
        setLastMessage(data);
        
        // Mapupdates bijhouden
        if (data.type === 'mapupdate' && data.folderId) {
          setFolderUpdates(prev => ({
            ...prev,
            [data.folderId]: (prev[data.folderId] || 0) + 1
          }));
          
          console.log(`📂 Mapupdate ontvangen voor map ${data.folderId}`);
        }
      } catch (err) {
        console.error('Fout bij verwerken WebSocket bericht:', err);
      }
    };
    
    // Cleanup wanneer component unmount
    return () => {
      console.log('🔌 WebSocket verbinding sluiten bij cleanup');
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);
  
  // Functie om een bericht naar de server te sturen
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      console.log('📤 WebSocket bericht versturen:', message);
      socketRef.current.send(JSON.stringify(message));
      return true;
    } else {
      console.error('❌ Kan geen bericht versturen: WebSocket niet verbonden');
      return false;
    }
  }, []);
  
  // Functie om mapinhoud te vernieuwen via WebSocket
  const refreshFolder = useCallback((folderId: number) => {
    return sendMessage({
      type: 'requestFolderRefresh',
      folderId,
      timestamp: new Date().toISOString()
    });
  }, [sendMessage]);
  
  return {
    isConnected,
    error,
    lastMessage,
    sendMessage,
    refreshFolder,
    folderUpdates
  };
}