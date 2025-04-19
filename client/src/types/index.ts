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
  createdAt?: string;
  updatedAt?: string;
  userId?: number;
}

export interface FileIconInfo {
  class: string;
  icon: JSX.Element;
}
