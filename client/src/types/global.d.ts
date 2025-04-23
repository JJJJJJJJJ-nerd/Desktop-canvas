// Globale type definities voor aangepaste window properties

interface DraggedFileInfo {
  id: number;
  name: string;
  parentId?: number;
  startTime: number;
  position?: { x: number; y: number };
  updateTime?: number;
}

interface MouseDownInfo {
  fileId: number;
  startX: number;
  startY: number;
  timestamp: number;
  element: EventTarget;
  isDragging: boolean;
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
  
  // Tracking voor dubbele klikken
  _lastClickTimes?: {
    [fileId: number]: number;
  };
  
  // Tracking voor drag vs. click onderscheid
  _mouseDownInfo?: MouseDownInfo;
  
  // Desktop drag positie
  _desktopDragPosition?: {
    x: number;
    y: number;
  };
}