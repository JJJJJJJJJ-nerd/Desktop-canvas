export interface DesktopFile {
  id?: number;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  position: {
    x: number;
    y: number;
  };
  dimensions?: {
    width: number;
    height: number;
  };
  isFolder?: boolean;
  parentId?: number | null;
  createdAt?: string;
  updatedAt?: string;
  userId?: number;
}

export interface FileIconInfo {
  class: string;
  icon: JSX.Element;
}
