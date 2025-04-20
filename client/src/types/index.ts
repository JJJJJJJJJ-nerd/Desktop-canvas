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
  createdAt?: string;
  updatedAt?: string;
  userId?: number;
  parentId?: number;
  isFolder?: string;
  children?: DesktopFile[];
}

export interface FileIconInfo {
  class: string;
  icon: JSX.Element;
}
