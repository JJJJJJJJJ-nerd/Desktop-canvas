import { useRef, useState, useEffect } from "react";
import { DesktopFile } from "@/types";
import { formatFileSize, getFileIcon } from "@/utils/file-utils";
import { FileSpreadsheet, Save, Edit, Check, X, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from 'xlsx';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

interface WindowItemProps {
  file: DesktopFile;
  index: number;
  isSelected: boolean;
  searchTerm?: string;
  onSelect: (index: number) => void;
  onDragEnd: (index: number, x: number, y: number) => void;
  onResize: (index: number, width: number, height: number) => void;
  onClose: () => void;
}

export function WindowItem({
  file,
  index,
  isSelected,
  searchTerm = "",
  onSelect,
  onDragEnd,
  onResize,
  onClose
}: WindowItemProps) {
  const fileRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [localPosition, setLocalPosition] = useState({ x: file.position.x, y: file.position.y });
  const [localDimensions, setLocalDimensions] = useState<{ width: number; height: number }>(
    file.dimensions || { width: 600, height: 400 }
  );
  
  // For Excel files
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editingCell, setEditingCell] = useState<{row: number, col: number, value: string} | null>(null);
  const [modified, setModified] = useState<boolean>(false);
  const cellInputRef = useRef<HTMLInputElement>(null);
  
  // For text/image content
  const [textContent, setTextContent] = useState<string>("");
  
  // Current position reference to avoid jumps during drag
  const currentPosition = useRef({ x: 0, y: 0 });
  
  const isExcel = 
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
    file.type === "application/vnd.ms-excel" ||
    file.type === "text/csv" ||
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls') ||
    file.name.endsWith('.csv');
  
  const isImage = file.type.startsWith('image/');
  const isText = file.type.startsWith('text/') && !file.type.includes('csv');
  const isPDF = file.type === 'application/pdf';
  
  // Only update position from props on initial render
  useEffect(() => {
    setLocalPosition({ x: file.position.x, y: file.position.y });
  }, []);
  
  // Load file data when component mounts
  useEffect(() => {
    const loadFileContent = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (isExcel) {
          // Load Excel data
          const response = await fetch(file.dataUrl);
          const data = await response.arrayBuffer();
          const wb = XLSX.read(data, { type: 'array' });
          
          if (wb.SheetNames.length === 0) {
            throw new Error("No sheets found in workbook");
          }
          
          setWorkbook(wb);
          const sheetName = wb.SheetNames[0];
          setActiveSheet(sheetName);
          
          const wsData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 }) as any[][];
          setSheetData(wsData);
          
        } else if (isText) {
          // Load text data
          const response = await fetch(file.dataUrl);
          const text = await response.text();
          setTextContent(text);
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Error loading file:", err);
        setError(err instanceof Error ? err.message : "Failed to load file");
        setLoading(false);
      }
    };
    
    loadFileContent();
  }, [file.dataUrl, isExcel, isText]);
  
  // Save data for Excel files
  const saveExcelData = async () => {
    if (!workbook || !activeSheet) return;
    
    try {
      // Update the sheet data
      const ws = XLSX.utils.json_to_sheet(sheetData, { skipHeader: true });
      workbook.Sheets[activeSheet] = ws;
      
      // Write to buffer
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      
      // Create blob and URL
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const newDataUrl = URL.createObjectURL(blob);
      
      // Create a new file object with updated dataUrl
      const updatedFile = {
        ...file,
        dataUrl: newDataUrl
      };
      
      setModified(false);
      
      // TODO: Implement actual saving to backend if needed
      console.log("Excel data saved (in memory only)");
    } catch (err) {
      console.error("Failed to save Excel data:", err);
    }
  };
  
  // Handle Excel cell edit
  const handleCellEdit = (row: number, col: number, value: string) => {
    // Clone the data to avoid mutation
    const newSheetData = [...sheetData];
    
    // Ensure row exists
    if (!newSheetData[row]) {
      newSheetData[row] = [];
    }
    
    // Update the cell value
    newSheetData[row][col] = value;
    
    setSheetData(newSheetData);
    setModified(true);
    setEditingCell(null);
  };
  
  // Handle window drag
  const handleMouseDown = (e: React.MouseEvent) => {
    // Skip if clicking on elements we don't want to trigger drag
    const target = e.target as HTMLElement;
    if (
      target.closest('.no-drag') ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'INPUT' ||
      target.closest('.resize-handle')
    ) {
      return;
    }
    
    e.preventDefault();
    
    if (!isSelected) {
      onSelect(index);
    }
    
    // Start dragging
    setDragging(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    currentPosition.current = { ...localPosition };
    
    // Add event listeners for drag and end
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Handle mouse move during drag
  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    
    const newX = currentPosition.current.x + dx;
    const newY = currentPosition.current.y + dy;
    
    setLocalPosition({ x: newX, y: newY });
  };
  
  // Handle mouse up to end drag
  const handleMouseUp = (e: MouseEvent) => {
    if (!dragging) return;
    
    setDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Send the final position to parent
    onDragEnd(index, localPosition.x, localPosition.y);
  };
  
  // Handle resize starts
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isSelected) {
      onSelect(index);
    }
    
    const resizeHandle = e.currentTarget as HTMLElement;
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };
  
  // Handle resize move
  const handleResizeMove = (e: MouseEvent) => {
    if (!fileRef.current) return;
    
    const rect = fileRef.current.getBoundingClientRect();
    
    // Calculate new dimensions based on mouse position relative to window origin
    const width = Math.max(300, e.clientX - rect.left);
    const height = Math.max(200, e.clientY - rect.top);
    
    setLocalDimensions({ width, height });
  };
  
  // Handle resize end
  const handleResizeEnd = (e: MouseEvent) => {
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    
    // Update dimensions in parent component
    onResize(index, localDimensions.width, localDimensions.height);
  };
  
  // Handle tab change for Excel
  const handleTabChange = (sheetName: string) => {
    if (!workbook) return;
    
    setActiveSheet(sheetName);
    const wsData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 }) as any[][];
    setSheetData(wsData);
  };
  
  // Render file window content based on type
  const renderFileContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-gray-600">Loading content...</span>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="text-center text-red-500 p-4 flex flex-col items-center">
          {getFileIcon(file.type).icon}
          <h3 className="text-lg font-semibold mb-2">Error Loading File</h3>
          <p>{error}</p>
        </div>
      );
    }
    
    if (isExcel) {
      // Excel content
      return (
        <div className="flex flex-col h-full">
          {/* Toolbar */}
          <div className="flex items-center justify-between bg-gray-100 p-2 border-b">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditMode(!editMode)}
                className="h-8 px-2 flex gap-1 items-center"
              >
                {editMode ? <Check className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                {editMode ? "Done" : "Edit"}
              </Button>
              
              {modified && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={saveExcelData}
                  className="h-8 px-2 flex gap-1 items-center"
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              )}
            </div>
          </div>
          
          {/* Tabs for sheets */}
          {workbook && workbook.SheetNames.length > 1 && (
            <Tabs value={activeSheet} onValueChange={handleTabChange} className="w-full">
              <TabsList className="w-full px-2 overflow-x-auto flex-nowrap">
                {workbook.SheetNames.map((sheet) => (
                  <TabsTrigger key={sheet} value={sheet} className="flex-shrink-0">
                    {sheet}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          
          {/* Excel data */}
          <div className="overflow-auto flex-grow p-1">
            <table className="min-w-full border-collapse">
              <tbody>
                {sheetData.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`} className="border-b border-gray-200">
                    {Array.isArray(row) ? row.map((cell, cellIndex) => (
                      <td
                        key={`cell-${rowIndex}-${cellIndex}`}
                        className={cn(
                          "border border-gray-200 p-1 min-w-[80px]",
                          rowIndex === 0 && "bg-gray-100 font-medium"
                        )}
                        onClick={() => editMode && setEditingCell({ row: rowIndex, col: cellIndex, value: String(cell ?? '') })}
                      >
                        {editingCell && editingCell.row === rowIndex && editingCell.col === cellIndex ? (
                          <input
                            ref={cellInputRef}
                            autoFocus
                            className="w-full h-full p-1 focus:outline-none focus:ring-1 focus:ring-primary"
                            value={editingCell.value}
                            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                            onBlur={() => handleCellEdit(rowIndex, cellIndex, editingCell.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCellEdit(rowIndex, cellIndex, editingCell.value);
                              } else if (e.key === 'Escape') {
                                setEditingCell(null);
                              }
                            }}
                          />
                        ) : (
                          cell ?? ''
                        )}
                      </td>
                    )) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    } else if (isImage) {
      // Image content
      return (
        <div className="h-full overflow-auto flex items-center justify-center bg-gray-200">
          <img
            src={file.dataUrl}
            alt={file.name}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      );
    } else if (isText) {
      // Text content
      return (
        <div className="h-full overflow-auto p-4">
          <pre className="whitespace-pre-wrap">{textContent}</pre>
        </div>
      );
    } else if (isPDF) {
      // PDF content
      return (
        <div className="h-full flex items-center justify-center">
          <iframe
            src={file.dataUrl}
            className="w-full h-full border-0"
            title={file.name}
          />
        </div>
      );
    } else {
      // Unsupported content type
      return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center">
          <div className="mb-4 text-gray-500">
            {getFileIcon(file.type).icon}
          </div>
          <h3 className="font-medium text-lg mb-2">Preview not available</h3>
          <p className="text-sm text-gray-500 mb-4">
            This file type doesn't support direct preview in window mode.
          </p>
          <a
            href={file.dataUrl}
            download={file.name}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            Download
          </a>
        </div>
      );
    }
  };
  
  return (
    <div
      ref={fileRef}
      className={cn(
        "window-item absolute rounded-lg shadow-lg overflow-hidden bg-white",
        isSelected && "z-40 ring-1 ring-primary shadow-md",
        dragging && "z-50 opacity-90"
      )}
      style={{
        left: `${localPosition.x}px`,
        top: `${localPosition.y}px`,
        width: `${localDimensions.width}px`,
        height: `${localDimensions.height}px`,
        transition: dragging ? 'none' : 'box-shadow 0.2s ease'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Window titlebar */}
      <div 
        className="window-titlebar flex items-center justify-between bg-gray-100 px-3 py-2 cursor-move border-b"
      >
        <div className="flex items-center gap-2">
          <div className="file-icon w-4 h-4">
            {getFileIcon(file.type).icon}
          </div>
          <h3 className="text-sm font-medium truncate max-w-[200px]">
            {file.name}
          </h3>
          {modified && <span className="text-xs text-gray-500 italic">(modified)</span>}
        </div>
        
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6" 
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Window content */}
      <div className="window-content h-[calc(100%-40px)]">
        {renderFileContent()}
      </div>
      
      {/* Resize handle */}
      <div 
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize resize-handle"
        onMouseDown={handleResizeStart}
      >
        <Maximize2 className="w-3 h-3 text-gray-400" />
      </div>
    </div>
  );
}