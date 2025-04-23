// Globale type definities voor aangepaste window properties

interface DraggedFileInfo {
  id: number;
  name: string;
  parentId?: number;
  startTime: number;
  position?: { x: number; y: number };
  updateTime?: number;
}

interface Window {
  // Drag & Drop flags
  _draggingFileFromFolder: boolean;
  _draggingFileToDesktop: boolean;
  draggedFileInfo?: DraggedFileInfo;
  
  // Folder hover tracking
  _hoverFolderId?: number;
  _activeDropFolder?: {
    id: number;
    element: HTMLElement;
    timestamp: number;
  };
  _openFolderHoverId?: number;
}