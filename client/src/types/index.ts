export interface DesktopFile {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  position: {
    x: number;
    y: number;
  };
}

export interface FileIconInfo {
  class: string;
  icon: JSX.Element;
}
