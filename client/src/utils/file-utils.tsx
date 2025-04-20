import { FileIconInfo } from "@/types";
import { 
  File as FileIcon,
  FileText,
  Image,
  UserRound,
  Contact
} from "lucide-react";

export const getFileIcon = (fileType: string, fileName?: string): FileIconInfo => {
  let iconClass = '';
  let icon;
  
  // Check if file is a VCF/vCard contact file
  const isVCF = fileType === 'text/vcard' || (fileName && fileName.toLowerCase().endsWith('.vcf'));
  
  if (isVCF) {
    iconClass = 'contact';
    icon = <Contact className="h-6 w-6" />;
  } else if (fileType.startsWith('image/')) {
    iconClass = 'image';
    icon = <Image className="h-6 w-6" />;
  } else if (fileType === 'application/pdf') {
    iconClass = 'pdf';
    icon = <FileText className="h-6 w-6" />;
  } else if (fileType.startsWith('video/')) {
    iconClass = 'video';
    icon = <FileIcon className="h-6 w-6" />;
  } else if (fileType.startsWith('audio/')) {
    iconClass = 'audio';
    icon = <FileIcon className="h-6 w-6" />;
  } else if (fileType.includes('zip') || fileType.includes('compressed') || fileType.includes('archive')) {
    iconClass = 'archive';
    icon = <FileIcon className="h-6 w-6" />;
  } else if (fileType.includes('word') || fileType.includes('document') || fileType.includes('text')) {
    iconClass = 'document';
    icon = <FileText className="h-6 w-6" />;
  } else {
    iconClass = 'other';
    icon = <FileIcon className="h-6 w-6" />;
  }
  
  return { class: iconClass, icon };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getRandomPosition = (canvasWidth: number, canvasHeight: number) => {
  const padding = 100;
  const x = Math.floor(Math.random() * (canvasWidth - padding * 2) + padding);
  const y = Math.floor(Math.random() * (canvasHeight - padding * 2) + padding);
  return { x, y };
};