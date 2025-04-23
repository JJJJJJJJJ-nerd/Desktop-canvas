import { useState, useEffect } from 'react';
import { DesktopFile } from '@/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ApiResponse {
  files?: DesktopFile[];
  file?: DesktopFile;
  message?: string;
}

export function useDesktopFiles() {
  const [selectedFile, setSelectedFile] = useState<number | null>(null);
  const queryClient = useQueryClient();
  
  // Fetch files from API
  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ['/api/files'],
    refetchOnWindowFocus: false,
  });

  const files = data?.files || [];

  // Upload files mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
    },
  });

  // Update file position mutation
  const updatePositionMutation = useMutation({
    mutationFn: async ({ id, position }: { id: number; position: { x: number; y: number } }) => {
      const response = await fetch(`/api/files/${id}/position`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ position }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
    },
  });
  
  // Update file dimensions mutation
  const updateDimensionsMutation = useMutation({
    mutationFn: async ({ id, dimensions }: { id: number; dimensions: { width: number; height: number } }) => {
      const response = await fetch(`/api/files/${id}/dimensions`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dimensions }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
    },
  });
  
  // Update file name mutation
  const updateFileNameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const response = await fetch(`/api/files/${id}/name`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/files/${id}`, {
        method: 'DELETE',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
    },
  });

  // Save all desktop state (file positions)
  const saveDesktopMutation = useMutation({
    mutationFn: async (files: DesktopFile[]) => {
      const response = await fetch('/api/desktop/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files }),
      });
      return response.json();
    },
  });
  
  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async ({ name, position }: { name: string; position: { x: number; y: number } }) => {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, position }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
    },
  });
  
  // Add file to folder mutation
  const addFileToFolderMutation = useMutation({
    mutationFn: async ({ fileId, folderId }: { fileId: number; folderId: number }) => {
      console.log('📂 API: Toevoegen van bestand', fileId, 'aan map', folderId);
      
      // UI update eerst - bij naar map slepen
      try {
        // 1. Huidige desktop bestanden ophalen
        const desktopFiles = queryClient.getQueryData<{files: DesktopFile[]}>(['/api/files']);
        if (desktopFiles?.files) {
          // Find the file that's being moved
          const fileIndex = desktopFiles.files.findIndex(f => f.id === fileId);
          
          if (fileIndex >= 0) {
            // Clone the files array to avoid mutating the cache directly
            const updatedFiles = [...desktopFiles.files];
            const movedFile = {...updatedFiles[fileIndex]};
            
            // Update the file's parentId to the folder's ID
            movedFile.parentId = folderId;
            
            // Remove the file from desktop view immediately
            updatedFiles.splice(fileIndex, 1);
            
            // Update the cache with the file removed from desktop
            queryClient.setQueryData(['/api/files'], {
              files: updatedFiles
            });
            
            // Get folder contents and add the file there
            const folderFilesKey = [`/api/folders/${folderId}/files`];
            const folderContents = queryClient.getQueryData<{files: DesktopFile[]}>(folderFilesKey) || {files: []};
            
            // Add the file to the folder's contents with teleport-in animation class
            movedFile.className = 'file-teleport-in';
            
            // Update folder contents cache
            queryClient.setQueryData(folderFilesKey, {
              files: [...folderContents.files, movedFile]
            });
            
            console.log(`✨ UI Updated: File ${movedFile.name} is now shown in folder ${folderId}`);
          }
        }
      } catch (error) {
        console.error('Error updating UI before API call:', error);
      }
      
      // Then do the API call
      const response = await fetch(`/api/folders/${folderId}/files/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.json();
    },
    onSuccess: (data) => {
      console.log('✅ Bestand', data.file.name, '(ID:', data.file.id, ') succesvol aan map toegevoegd');
      
      // Dit was het probleem! De invalidatie moet specifiek zijn
      // We moeten EXPLICITLY de folderFilesKey invalideren met het specifieke folder ID
      const folderId = data.file.parentId;
      if (folderId) {
        const folderFilesKey = [`/api/folders/${folderId}/files`];
        console.log(`🔄 Vernieuwen van map inhoud voor map ID: ${folderId}`);
        queryClient.invalidateQueries({ queryKey: folderFilesKey });
      }
      
      // Ook de desktop bestanden vernieuwen
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
    },
  });
  
  // Remove file from folder mutation
  const removeFileFromFolderMutation = useMutation({
    mutationFn: async ({ 
      fileId, 
      position,
      parentId 
    }: { 
      fileId: number; 
      position?: { x: number; y: number };
      parentId?: number;
    }) => {
      console.log('📤 API: Verwijderen van bestand', fileId, 'uit map');
      if (position) {
        console.log('🖱️ Met nieuwe positie:', `x=${position.x}, y=${position.y}`);
      }
      
      // Update UI FIRST before API call for instant feedback
      if (parentId && position) {
        try {
          // 1. Get and update folder contents
          const folderFilesKey = [`/api/folders/${parentId}/files`];
          const folderContents = queryClient.getQueryData<{files: DesktopFile[]}>(folderFilesKey);
          
          if (folderContents?.files) {
            // Find the file being removed
            const fileIndex = folderContents.files.findIndex(f => f.id === fileId);
            
            if (fileIndex >= 0) {
              // Get a copy of the file
              const removedFile = {...folderContents.files[fileIndex]};
              // Remove from folder view immediately
              const updatedFolderFiles = [...folderContents.files];
              updatedFolderFiles.splice(fileIndex, 1);
              
              // Update folder contents cache
              queryClient.setQueryData(folderFilesKey, {
                files: updatedFolderFiles
              });
              
              // 2. Add file back to desktop
              const desktopFiles = queryClient.getQueryData<{files: DesktopFile[]}>(['/api/files']);
              if (desktopFiles?.files) {
                // Add to desktop with new position and without parentId
                const updatedFile = {
                  ...removedFile,
                  position: position,
                  parentId: undefined
                };
                
                // Update desktop files cache
                queryClient.setQueryData(['/api/files'], {
                  files: [...desktopFiles.files, updatedFile]
                });
                
                console.log('✅ Bestand', removedFile.name, '(ID:', fileId, ') succesvol uit map verwijderd');
                console.log('🖱️ Bijwerken van bestandspositie na verwijdering uit map:', position.x, position.y);
              }
            }
          }
        } catch (error) {
          console.error('Fout bij direct bijwerken van UI voor bestandsverplaatsing:', error);
        }
      }
      
      // THEN make the actual API call
      const response = await fetch(`/api/folders/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          position: position || undefined,
          parentId: parentId || undefined
        }),
      });
      
      const result = await response.json();
      
      // Als er een positie is opgegeven, direct de bestandspositie ook updaten
      if (position && result.file?.id) {
        try {
          await fetch(`/api/files/${result.file.id}/position`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ position }),
          });
          console.log(`✅ Positie van bestand ${result.file.name} succesvol bijgewerkt naar (${position.x}, ${position.y})`);
        } catch (err) {
          console.error('Fout bij direct updaten van bestandspositie:', err);
        }
      }
      
      return result;
    },
    onSuccess: (data) => {
      // Vernieuw bestanden op het bureaublad
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      
      // Als er een parentId was, invalideer die mapinhoud
      if (data.parentId) {
        const folderFilesKey = [`/api/folders/${data.parentId}/files`];
        console.log(`🔄 Vernieuwen van mapinhoud voor map ID: ${data.parentId}`);
        queryClient.invalidateQueries({ queryKey: folderFilesKey });
      }
      
      console.log('✅ Bestand succesvol uit map verwijderd en queries vernieuwd');
    },
  });

  // Add uploaded files
  const addFiles = async (fileList: FileList) => {
    const formData = new FormData();
    Array.from(fileList).forEach(file => {
      formData.append('files', file);
    });
    
    try {
      await uploadMutation.mutateAsync(formData);
    } catch (error) {
      console.error('Error uploading files:', error);
    }
  };

  // Update file position
  const updateFilePosition = async (id: number, x: number, y: number) => {
    // First, update the file position locally in the cache
    const currentFiles = queryClient.getQueryData<ApiResponse>(['/api/files']);
    if (currentFiles?.files) {
      const updatedFiles = currentFiles.files.map(file => {
        if (file.id === id) {
          return { ...file, position: { x, y } };
        }
        return file;
      });
      
      // Update the cache immediately for a responsive UI
      queryClient.setQueryData(['/api/files'], { ...currentFiles, files: updatedFiles });
    }
    
    // Then send the update to the server
    try {
      await updatePositionMutation.mutateAsync({ 
        id, 
        position: { x, y } 
      });
    } catch (error) {
      console.error('Error updating file position:', error);
      // On error, revert to the original data
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
    }
  };
  
  // Update file dimensions
  const updateFileDimensions = async (id: number, width: number, height: number) => {
    try {
      await updateDimensionsMutation.mutateAsync({
        id,
        dimensions: { width, height }
      });
    } catch (error) {
      console.error('Error updating file dimensions:', error);
    }
  };

  // Clear all files
  const clearAllFiles = async () => {
    if (window.confirm('Are you sure you want to clear all files from the desktop?')) {
      try {
        // Delete each file one by one
        for (const file of files) {
          if (file.id) {
            await deleteFileMutation.mutateAsync(file.id);
          }
        }
        setSelectedFile(null);
      } catch (error) {
        console.error('Error clearing files:', error);
      }
    }
  };

  // Save desktop state
  const saveDesktopState = async () => {
    try {
      await saveDesktopMutation.mutateAsync(files);
    } catch (error) {
      console.error('Error saving desktop state:', error);
    }
  };

  // Auto-save desktop state when files change
  useEffect(() => {
    if (files.length > 0) {
      saveDesktopState();
    }
  }, [files]);

  const selectFile = (index: number | null) => {
    setSelectedFile(index);
  };
  
  // Create a new folder
  const createFolder = async (name: string, position: { x: number; y: number }) => {
    try {
      return await createFolderMutation.mutateAsync({ name, position });
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };
  
  // Add a file to a folder
  const addFileToFolder = async (fileId: number, folderId: number) => {
    if (typeof fileId !== 'number' || typeof folderId !== 'number') {
      console.error('Invalid fileId or folderId:', { fileId, folderId });
      return;
    }
    
    try {
      return await addFileToFolderMutation.mutateAsync({ fileId, folderId });
    } catch (error) {
      console.error('Error adding file to folder:', error);
    }
  };
  
  // Remove a file from a folder, optionally with a new desktop position
  const removeFileFromFolder = async (
    fileId: number, 
    position?: { x: number; y: number },
    parentId?: number
  ) => {
    try {
      return await removeFileFromFolderMutation.mutateAsync({ 
        fileId, 
        position,
        parentId 
      });
    } catch (error) {
      console.error('Error removing file from folder:', error);
    }
  };
  
  // Update file or folder name
  const updateFileName = async (id: number, name: string) => {
    try {
      return await updateFileNameMutation.mutateAsync({ id, name });
    } catch (error) {
      console.error('Error updating file name:', error);
    }
  };
  
  // Create a folder from files that were dragged on top of each other
  const createFolderFromFiles = async (fileIds: number[], position: { x: number; y: number }, customName?: string) => {
    if (fileIds.length < 2) return;
    
    try {
      // Create a new folder with either the custom name or default name
      const folderName = customName || "New Folder";
      const result = await createFolderMutation.mutateAsync({ name: folderName, position });
      
      const folderId = result.folder.id;
      if (!folderId) {
        console.error('Failed to get folder ID after creation');
        return;
      }
      
      // Add all files to the folder
      for (const fileId of fileIds) {
        await addFileToFolderMutation.mutateAsync({ fileId, folderId });
      }
      
      return result.folder;
    } catch (error) {
      console.error('Error creating folder from files:', error);
    }
  };

  return {
    files,
    selectedFile,
    isLoading,
    error,
    addFiles,
    updateFilePosition,
    updateFileDimensions,
    clearAllFiles,
    selectFile,
    createFolder,
    addFileToFolder,
    removeFileFromFolder,
    createFolderFromFiles,
    updateFileName
  };
}