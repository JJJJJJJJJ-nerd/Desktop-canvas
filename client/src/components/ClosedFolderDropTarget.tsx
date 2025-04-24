import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useDesktopFiles } from '@/hooks/use-desktop-files';
import { DesktopFile } from '@/types';

interface ClosedFolderDropTargetProps {
  file: DesktopFile;
}

export function ClosedFolderDropTarget({ file }: ClosedFolderDropTargetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addFileToFolder } = useDesktopFiles();
  const [isDragOver, setIsDragOver] = useState(false);
  const dropTargetRef = useRef<HTMLDivElement>(null);

  // Controleer of dit een map is
  const isFolder = file.isFolder === 'true' || 
                  file.type === 'folder' || 
                  file.type === 'application/folder';

  // Fix voor TypeScript: zorg ervoor dat file.id altijd een nummer is
  const folderId = file.id || 0;

  // Alleen actief voor mappen, niet voor andere bestandstypes
  if (!isFolder || !folderId) return null;

  // Handlers voor drag & drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Controleer of er een bestand wordt gesleept (via data transfer)
    const hasFileData = e.dataTransfer.types.includes('text/plain') || 
                        e.dataTransfer.types.includes('application/json');

    if (hasFileData) {
      setIsDragOver(true);
      e.dataTransfer.dropEffect = 'move';
      
      // Sla de map op als potentiële drop target
      // @ts-ignore - Custom property
      window._hoveredFolderId = file.id;
      // @ts-ignore - Custom property 
      window._hoveredFolderName = file.name;
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    // Wis de map als drop target
    // @ts-ignore - Custom property
    if (window._hoveredFolderId === file.id) {
      // @ts-ignore - Custom property
      window._hoveredFolderId = null;
      // @ts-ignore - Custom property
      window._hoveredFolderName = null;
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    console.log(`🔶 DROP OP GESLOTEN MAP: ${file.name} (ID: ${file.id})`);
    
    // Krijg het gesleepte bestand ID
    const fileIdText = e.dataTransfer.getData('text/plain');
    if (!fileIdText) {
      console.error('❌ Geen bestand-ID gevonden in de drop data');
      return;
    }
    
    try {
      const fileId = parseInt(fileIdText);
      if (isNaN(fileId) || !fileId) {
        console.error('❌ Ongeldig bestand-ID:', fileIdText);
        return;
      }
      
      // Voorkom dat een map in zichzelf wordt geplaatst
      if (fileId === file.id) {
        console.log('❌ Een map kan niet in zichzelf worden geplaatst');
        toast({
          title: "Niet toegestaan",
          description: "Een map kan niet in zichzelf worden geplaatst.",
          variant: "destructive",
          duration: 3000
        });
        return;
      }
      
      // Voorkom dat mappen in mappen worden geplaatst (feature restricties)
      const draggedFile = queryClient.getQueryData<{files: DesktopFile[]}>(['/api/files'])
                          ?.files?.find(f => f.id === fileId);
                          
      if (draggedFile?.isFolder === 'true' || draggedFile?.type === 'folder') {
        console.log('❌ Het plaatsen van mappen in andere mappen is niet ondersteund');
        toast({
          title: "Niet ondersteund",
          description: "Het plaatsen van mappen in andere mappen is momenteel niet ondersteund.",
          variant: "destructive",
          duration: 3000
        });
        return;
      }
      
      // Optimistic UI update - voeg het bestand toe aan de map in de UI
      try {
        // Huidige desktop bestanden ophalen
        const desktopFiles = queryClient.getQueryData<{files: DesktopFile[]}>(['/api/files']);
        
        if (desktopFiles?.files) {
          // Zoek het bestand dat verplaatst wordt
          const fileIndex = desktopFiles.files.findIndex(f => f.id === fileId);
          
          if (fileIndex >= 0) {
            // Kloon arrays om directe mutaties te voorkomen
            const updatedDesktopFiles = [...desktopFiles.files];
            const movedFile = {...updatedDesktopFiles[fileIndex]};
            
            // Update het bestand met de nieuwe parent map 
            movedFile.parentId = file.id;
            
            // Verwijder het bestand uit desktop view
            updatedDesktopFiles.splice(fileIndex, 1);
            
            // Update de cache
            queryClient.setQueryData(['/api/files'], {
              files: updatedDesktopFiles
            });
            
            // Update eventuele map inhoud cache
            if (movedFile.parentId) {
              const previousFolderKey = [`/api/folders/${movedFile.parentId}/files`];
              queryClient.invalidateQueries({ queryKey: previousFolderKey });
            }
          }
        }
      } catch (err) {
        console.error('Fout bij optimistic UI update:', err);
      }
      
      // Animatie toevoegen
      if (dropTargetRef.current) {
        dropTargetRef.current.classList.add('folder-receive');
        setTimeout(() => {
          if (dropTargetRef.current) {
            dropTargetRef.current.classList.remove('folder-receive');
          }
        }, 500);
      }
      
      // Server update met wat vertraging voor betere visuele feedback
      setTimeout(async () => {
        try {
          // API aanroep om het bestand in de map te plaatsen
          // Gebruik folderId (vaste waarde) in plaats van file.id (die kan undefined zijn)
          await addFileToFolder(fileId, folderId);
          
          // Bevestiging tonen
          toast({
            title: "Bestand verplaatst",
            description: `Bestand toegevoegd aan map "${file.name}"`,
            duration: 2000
          });
          
          // Cache vernieuwen
          queryClient.invalidateQueries({ queryKey: ['/api/files'] });
          const folderFilesKey = [`/api/folders/${file.id}/files`];
          queryClient.invalidateQueries({ queryKey: folderFilesKey });
        } catch (error) {
          console.error('❌ Fout bij verplaatsen van bestand naar map:', error);
          toast({
            title: "Fout bij verplaatsen",
            description: "Kon het bestand niet naar de map verplaatsen",
            variant: "destructive",
            duration: 3000
          });
          
          // Cache vernieuwen om eventuele wijzigingen terug te draaien
          queryClient.invalidateQueries({ queryKey: ['/api/files'] });
        }
      }, 300);
      
    } catch (error) {
      console.error('❌ Fout bij verwerken van drop:', error);
    }
  };

  return (
    <div 
      ref={dropTargetRef}
      className={`absolute inset-0 rounded-md z-10 ${isDragOver ? 'folder-drop-target' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-is-folder-drop-target="true"
      data-folder-id={file.id}
    />
  );
}