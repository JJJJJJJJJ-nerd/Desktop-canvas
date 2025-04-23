// Globale type definities voor aangepaste window properties

interface DraggedFileInfo {
  id: number;
  name: string;
  parentId?: number | null;
  startTime?: number;
  position?: { x: number; y: number };
  updateTime?: number;
  isFolder?: boolean; // Toevoegen om te controleren of het een map is
  element?: HTMLElement | null; // Voeg element toe om het te kunnen volgen
  initialPosition?: { x: number, y: number }; // Begin positie voor drag operaties
  dragImageSet?: boolean; // Flag voor drag image setup
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
    element: HTMLElement | null;
    timestamp: number;
    name?: string; // Naam toevoegen voor betere debugging
  };
  
  // Extra tracking voor slepen naar mappen
  _lastDragTarget?: number;
  _isDraggingFile?: boolean;
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