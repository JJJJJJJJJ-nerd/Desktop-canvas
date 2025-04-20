import { useState, useEffect, useRef } from 'react';
import { DesktopFile } from '@/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ApiResponse {
  files?: DesktopFile[];
  file?: DesktopFile;
  folder?: DesktopFile;
  message?: string;
}

export function useDesktopFiles() {
  const [selectedFile, setSelectedFile] = useState<number | null>(null);
  const [folderCreationTimeout, setFolderCreationTimeout] = useState<NodeJS.Timeout | null>(null);
  const [filesForFolderCreation, setFilesForFolderCreation] = useState<{ source: number, target: number } | null>(null);
  const folderCreationDelay = 1500; // 1.5 seconds delay for folder creation
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
      const response = await fetch(`/api/files/${fileId}/move-to-folder/${folderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
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
  
  // Create a folder from files
  const createFolderWithFiles = async (sourceFileId: number, targetFileId: number) => {
    try {
      // Get source and target files
      const sourceFile = files.find(file => file.id === sourceFileId);
      const targetFile = files.find(file => file.id === targetFileId);
      
      if (!sourceFile || !targetFile) {
        console.error('Files not found');
        return;
      }
      
      // Create folder name from both files
      const folderName = `${sourceFile.name.split('.')[0]}_${targetFile.name.split('.')[0]}`;
      
      // Create the folder at the target file's position
      const folderResponse = await createFolderMutation.mutateAsync({
        name: folderName,
        position: targetFile.position,
      });
      
      if (folderResponse.folder?.id) {
        // Move both files to the folder
        await addFileToFolderMutation.mutateAsync({
          fileId: sourceFileId,
          folderId: folderResponse.folder.id,
        });
        
        await addFileToFolderMutation.mutateAsync({
          fileId: targetFileId,
          folderId: folderResponse.folder.id,
        });
      }
    } catch (error) {
      console.error('Error creating folder with files:', error);
    }
  };
  
  // Start folder creation timer when a file is dragged over another
  const startFolderCreation = (sourceFileId: number, targetFileId: number) => {
    // Clear any existing timeout
    if (folderCreationTimeout) {
      clearTimeout(folderCreationTimeout);
    }
    
    // Set the files for folder creation
    setFilesForFolderCreation({ source: sourceFileId, target: targetFileId });
    
    // Start a new timeout
    const timeout = setTimeout(() => {
      if (filesForFolderCreation) {
        createFolderWithFiles(sourceFileId, targetFileId);
      }
      setFolderCreationTimeout(null);
      setFilesForFolderCreation(null);
    }, folderCreationDelay);
    
    setFolderCreationTimeout(timeout);
  };
  
  // Cancel folder creation
  const cancelFolderCreation = () => {
    if (folderCreationTimeout) {
      clearTimeout(folderCreationTimeout);
      setFolderCreationTimeout(null);
    }
    setFilesForFolderCreation(null);
  };

  // Auto-save desktop state when files change
  useEffect(() => {
    if (files.length > 0) {
      saveDesktopState();
    }
  }, [files]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (folderCreationTimeout) {
        clearTimeout(folderCreationTimeout);
      }
    };
  }, [folderCreationTimeout]);

  const selectFile = (index: number | null) => {
    setSelectedFile(index);
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
    startFolderCreation,
    cancelFolderCreation,
    filesForFolderCreation
  };
}
