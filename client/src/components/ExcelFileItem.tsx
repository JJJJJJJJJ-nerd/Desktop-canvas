import { useRef, useState, useEffect } from "react";
import { DesktopFile } from "@/types";
import { formatFileSize } from "@/utils/file-utils";
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

interface ExcelFileItemProps {
  file: DesktopFile;
  index: number;
  isSelected: boolean;
  searchTerm?: string;
  onSelect: (index: number) => void;
  onDragEnd: (index: number, x: number, y: number) => void;
  onResize: (index: number, width: number, height: number) => void;
  onClose: () => void;
}

export function ExcelFileItem({
  file,
  index,
  isSelected,
  searchTerm = "",
  onSelect,
  onDragEnd,
  onResize,
  onClose
}: ExcelFileItemProps) {
  const fileRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [localPosition, setLocalPosition] = useState({ x: file.position.x, y: file.position.y });
  const [localDimensions, setLocalDimensions] = useState<{ width: number; height: number }>(
    file.dimensions || { width: 600, height: 400 }
  );

  // Excel-specific state
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editingCell, setEditingCell] = useState<{row: number, col: number, value: string} | null>(null);
  const [modified, setModified] = useState<boolean>(false);
  const cellInputRef = useRef<HTMLInputElement>(null);
  
  // Current position reference to avoid jumps during drag
  const currentPosition = useRef({ x: 0, y: 0 });

  // Only update position from props on initial render
  useEffect(() => {
    setLocalPosition({ x: file.position.x, y: file.position.y });
  }, []);

  // Load Excel data when component mounts
  useEffect(() => {
    const loadExcel = async () => {
      try {
        setLoading(true);
        setError(null);
        setModified(false);

        // Fetch the Excel file
        const response = await fetch(file.dataUrl);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        
        // Parse Excel data
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        setWorkbook(wb);
        
        // Set the first sheet as active by default
        if (wb.SheetNames.length > 0) {
          const firstSheet = wb.SheetNames[0];
          setActiveSheet(firstSheet);
          
          // Convert worksheet to array of arrays
          const ws = wb.Sheets[firstSheet];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
          setSheetData(data as any[][]);
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Error loading Excel file:", err);
        setError("Failed to load spreadsheet. The file might be corrupted or in an unsupported format.");
        setLoading(false);
      }
    };

    loadExcel();
  }, [file.dataUrl]);

  // Focus the input field when editing a cell
  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
    }
  }, [editingCell]);

  // To track mouse movement for distinguishing between click and drag
  const initialClick = useRef<{x: number, y: number} | null>(null);
  const isClick = useRef<boolean>(true);
  
  // Handle header mouse down (for dragging)
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // Only respond to left mouse button
    if (e.button !== 0) return;
    
    // Prevent default browser behavior and stop event propagation
    e.stopPropagation();
    e.preventDefault();
    
    // Save the initial click position for later comparison
    initialClick.current = { x: e.clientX, y: e.clientY };
    isClick.current = true;
    
    // Calculate offset between mouse position and element top-left corner
    startPosRef.current = {
      x: e.clientX - localPosition.x,
      y: e.clientY - localPosition.y
    };
    
    // Store current position for reference
    currentPosition.current = localPosition;
    
    // Add document-level event listeners immediately
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle mouse movement during drag - Enhanced for better performance
  const handleMouseMove = (e: MouseEvent) => {
    // Prevent any default browser behavior
    e.preventDefault();
    
    // If we moved enough to consider this a drag (not a click)
    if (initialClick.current) {
      const moveThreshold = 2; // pixels - reduced threshold for more responsive dragging
      const deltaX = Math.abs(e.clientX - initialClick.current.x);
      const deltaY = Math.abs(e.clientY - initialClick.current.y);
      
      // If we moved enough, consider this a drag
      if (deltaX > moveThreshold || deltaY > moveThreshold) {
        // No longer a click - it's a drag
        isClick.current = false;
        
        // Start dragging immediately upon movement
        if (!dragging) {
          setDragging(true);
        }
        
        // Calculate new position - ensure it stays within visible area
        const newX = Math.max(0, e.clientX - startPosRef.current.x);
        const newY = Math.max(0, e.clientY - startPosRef.current.y);
        
        // Update current position ref first (without causing re-renders)
        currentPosition.current = { x: newX, y: newY };
        
        // Use requestAnimationFrame for smoother dragging
        window.requestAnimationFrame(() => {
          setLocalPosition(currentPosition.current);
        });
      }
    }
  };

  // Handle mouse up - end dragging or handle click
  const handleMouseUp = (e: MouseEvent) => {
    // Prevent default behavior
    e.preventDefault();
    
    // Handle as a click if there was minimal movement
    if (isClick.current) {
      // Select on click
      onSelect(index);
    } 
    // Handle as a drag completion
    else if (dragging) {
      // Save the final position
      onDragEnd(index, currentPosition.current.x, currentPosition.current.y);
      
      // End dragging state
      setDragging(false);
    }
    
    // Reset tracking variables
    initialClick.current = null;
    isClick.current = true;
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Handle sheet change
  const handleSheetChange = (sheetName: string) => {
    if (workbook) {
      // Check if we have unsaved changes
      if (modified) {
        const confirmChange = window.confirm("You have unsaved changes. Switch sheets anyway?");
        if (!confirmChange) return;
      }
      
      setActiveSheet(sheetName);
      const ws = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      setSheetData(data as any[][]);
      setModified(false);
    }
  };

  // Cell editing functions
  const handleCellClick = (rowIndex: number, colIndex: number, value: any) => {
    if (editMode) {
      setEditingCell({
        row: rowIndex,
        col: colIndex,
        value: value !== undefined && value !== null ? value.toString() : ""
      });
    }
  };

  const handleCellChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (editingCell) {
      setEditingCell({
        ...editingCell,
        value: e.target.value
      });
    }
  };

  const handleCellBlur = () => {
    if (editingCell) {
      // Update the sheet data with the new value
      const newSheetData = [...sheetData];
      
      // Ensure the row exists
      if (!newSheetData[editingCell.row]) {
        newSheetData[editingCell.row] = [];
      }
      
      // Update the cell value
      newSheetData[editingCell.row][editingCell.col] = editingCell.value;
      
      setSheetData(newSheetData);
      setEditingCell(null);
      setModified(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
    if (editingCell) {
      setEditingCell(null);
    }
  };

  const saveChanges = () => {
    if (!workbook || !modified) return;
    
    try {
      // Create a new worksheet from the edited data
      const newWs = XLSX.utils.aoa_to_sheet(sheetData);
      
      // Update the workbook with the new worksheet
      const newWb = { ...workbook };
      newWb.Sheets[activeSheet] = newWs;
      setWorkbook(newWb);
      
      // Generate a new Excel file
      const wbout = XLSX.write(newWb, { bookType: 'xlsx', type: 'array' });
      
      // Create a blob from the array
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = 'edited_' + file.name;
      a.click();
      
      // Clean up
      URL.revokeObjectURL(url);
      setModified(false);
      
      alert("Changes saved! File downloaded.");
    } catch (err) {
      console.error("Error saving Excel file:", err);
      alert("Failed to save changes.");
    }
  };

  // Handle resize
  const handlePanelResize = (sizes: number[]) => {
    if (!fileRef.current) return;
    
    const rect = fileRef.current.getBoundingClientRect();
    setLocalDimensions({
      width: rect.width,
      height: rect.height
    });
    
    // Save dimensions to parent
    onResize(index, rect.width, rect.height);
  };
  
  // Manual resize handlers
  const resizeStartPos = useRef<{ x: number, y: number, width: number, height: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (fileRef.current) {
      const rect = fileRef.current.getBoundingClientRect();
      resizeStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        width: rect.width,
        height: rect.height
      };
      
      setIsResizing(true);
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    }
  };
  
  const handleResizeMove = (e: MouseEvent) => {
    if (resizeStartPos.current && fileRef.current) {
      const deltaX = e.clientX - resizeStartPos.current.x;
      const deltaY = e.clientY - resizeStartPos.current.y;
      
      const newWidth = Math.max(400, resizeStartPos.current.width + deltaX);
      const newHeight = Math.max(300, resizeStartPos.current.height + deltaY);
      
      // Update local dimensions state
      setLocalDimensions({ width: newWidth, height: newHeight });
      
      // Apply dimensions to element
      fileRef.current.style.width = `${newWidth}px`;
      fileRef.current.style.height = `${newHeight}px`;
    }
  };
  
  const handleResizeEnd = (e: MouseEvent) => {
    if (resizeStartPos.current && fileRef.current) {
      // Save the final dimensions
      onResize(index, localDimensions.width, localDimensions.height);
    }
    
    resizeStartPos.current = null;
    setIsResizing(false);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  // Enhanced direct drag implementation for Excel windows
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only respond to left mouse button and skip if resize is active
    if (e.button !== 0 || isResizing) return;
    
    // Stop the event to prevent interference from parent elements
    e.stopPropagation();
    e.preventDefault();
    
    // Always select the Excel window on mouse down to allow for immediate interaction
    if (!isSelected) {
      onSelect(index);
    }
    
    // Save the initial click position for later comparison
    initialClick.current = { x: e.clientX, y: e.clientY };
    isClick.current = true;
    
    // Calculate mouse offset from top-left corner - crucial for smooth dragging
    startPosRef.current = {
      x: e.clientX - localPosition.x,
      y: e.clientY - localPosition.y
    };
    
    // Store current position for reference
    currentPosition.current = localPosition;
    
    // Add global event listeners - we'll determine drag state in the mousemove handler
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      ref={fileRef}
      className={cn(
        "absolute rounded-lg shadow-md overflow-hidden",
        "bg-white backdrop-blur-sm",
        isSelected && "ring-2 ring-primary shadow-lg z-10",
        dragging && "z-50 shadow-xl opacity-90",
        isResizing && "z-50 shadow-xl ring-2 ring-blue-400"
      )}
      style={{
        left: `${localPosition.x}px`,
        top: `${localPosition.y}px`,
        width: `${localDimensions.width}px`,
        height: `${localDimensions.height}px`,
        transition: dragging ? 'none' : 'box-shadow 0.1s ease',
        minWidth: '400px',
        minHeight: '300px'
      }}
      onMouseDown={handleMouseDown}
    >
      <ResizablePanelGroup
        direction="vertical"
        onLayout={handlePanelResize}
        className="w-full h-full"
      >
        {/* Header bar with filename and controls */}
        <ResizablePanel defaultSize={10} minSize={5} maxSize={10}>
          <div 
            className="flex justify-between items-center px-3 py-2 bg-gray-100 border-b cursor-move"
            // Handle header explicitly to improve UX
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 truncate">
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              <h3 className="font-medium text-sm truncate" title={file.name}>
                {file.name}
              </h3>
              <span className="text-xs text-gray-500">
                {formatFileSize(file.size)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 rounded-full hover:bg-gray-200"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onClose();
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Main content area */}
        <ResizablePanel defaultSize={80}>
          <div className="flex flex-col h-full">
            {/* Controls bar */}
            <div className="flex justify-between items-center py-2 px-3 border-b bg-gray-50">
              <div className="flex gap-2">
                <Button 
                  variant={editMode ? "default" : "outline"} 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleEditMode();
                  }}
                  className="text-xs flex items-center gap-1"
                >
                  {editMode ? <><Check className="h-3.5 w-3.5" /> Editing Active</> : <><Edit className="h-3.5 w-3.5" /> Edit Mode</>}
                </Button>
                
                {modified && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      saveChanges();
                    }}
                    className="text-xs flex items-center gap-1"
                  >
                    <Save className="h-3.5 w-3.5" /> Save Changes
                  </Button>
                )}
              </div>
              
              <div className="text-xs text-gray-500">
                {editMode ? "Click on any cell to edit" : "View-only mode"}
              </div>
            </div>
            
            {/* Sheet tabs */}
            {workbook && workbook.SheetNames.length > 1 && (
              <Tabs value={activeSheet} onValueChange={handleSheetChange} className="w-full">
                <div className="overflow-x-auto border-b">
                  <TabsList className="h-8 px-0 bg-transparent mb-px">
                    {workbook.SheetNames.map(sheetName => (
                      <TabsTrigger 
                        key={sheetName}
                        value={sheetName}
                        className={`data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 py-1 text-sm`}
                      >
                        {sheetName}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </Tabs>
            )}
            
            {/* Sheet content */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                  <span className="ml-3 text-gray-600">Loading spreadsheet...</span>
                </div>
              ) : error ? (
                <div className="text-center text-red-500 p-4 flex flex-col items-center">
                  <FileSpreadsheet className="w-12 h-12 mb-3 text-red-400" />
                  <h3 className="text-lg font-semibold mb-2">Error Loading Spreadsheet</h3>
                  <p>{error}</p>
                </div>
              ) : !workbook || workbook.SheetNames.length === 0 ? (
                <div className="text-center text-gray-500 p-4">
                  No data found in this spreadsheet.
                </div>
              ) : sheetData.length > 0 ? (
                <div className="inline-block min-w-full">
                  <table className="min-w-full border-collapse">
                    <tbody>
                      {sheetData.map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`} className={rowIndex === 0 ? "bg-gray-100 font-medium" : "border-b"}>
                          {/* Row header (line number) */}
                          <td className="px-3 py-2 text-xs text-gray-500 border-r bg-gray-50 sticky left-0">
                            {rowIndex + 1}
                          </td>
                          
                          {/* Columns */}
                          {Array.isArray(row) ? row.map((cell, cellIndex) => (
                            <td 
                              key={`cell-${rowIndex}-${cellIndex}`}
                              className={`px-3 py-2 text-sm border-r ${
                                rowIndex === 0 ? "font-medium bg-gray-100" : ""
                              } ${editMode ? "cursor-pointer hover:bg-blue-50" : ""}`}
                              onClick={() => handleCellClick(rowIndex, cellIndex, cell)}
                            >
                              {editingCell && editingCell.row === rowIndex && editingCell.col === cellIndex ? (
                                <input
                                  ref={cellInputRef}
                                  type="text"
                                  value={editingCell.value}
                                  onChange={handleCellChange}
                                  onBlur={handleCellBlur}
                                  onKeyDown={handleKeyDown}
                                  className="w-full px-1 py-0.5 border border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              ) : (
                                cell !== undefined && cell !== null ? cell.toString() : ""
                              )}
                            </td>
                          )) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  This sheet appears to be empty.
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Status bar */}
        <ResizablePanel defaultSize={5} minSize={5} maxSize={5}>
          <div className="px-3 py-1 text-xs text-gray-500 border-t bg-gray-50 flex justify-between items-center">
            <div>{activeSheet ? `Sheet: ${activeSheet}` : ''}</div>
            {modified && <div className="text-amber-600 font-medium">Modified</div>}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      
      {/* Resize handle */}
      <div 
        className={cn(
          "absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center cursor-se-resize z-20",
          "bg-gray-200 hover:bg-gray-300 transition-colors",
          "border-t border-l border-gray-300 rounded-tl-md",
          isSelected && "bg-blue-100 hover:bg-blue-200 border-blue-300"
        )}
        style={{ 
          borderTopLeftRadius: '6px',
        }}
        onMouseDown={handleResizeStart}
      >
        <Maximize2 className="w-3.5 h-3.5 text-gray-600" />
      </div>
    </div>
  );
}