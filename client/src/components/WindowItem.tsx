import { useRef, useState, useEffect } from "react";
import { DesktopFile } from "@/types";
import { formatFileSize, getFileIcon } from "@/utils/file-utils";
import { FileSpreadsheet, Save, Edit, Check, X, Maximize2, Mail, Phone, User, AtSign, Phone as PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from 'xlsx';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  
  // For vCard content
  const [vCardData, setVCardData] = useState<{
    name?: string;
    fullName?: string;
    emails?: {type: string; value: string}[];
    phones?: {type: string; value: string}[];
    photo?: string;
  } | null>(null);
  
  // Current position reference to avoid jumps during drag
  const currentPosition = useRef({ x: 0, y: 0 });
  
  // For tracking click vs drag distinction
  const initialClick = useRef<{x: number, y: number} | null>(null);
  const isClick = useRef<boolean>(true);
  
  const isExcel = 
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
    file.type === "application/vnd.ms-excel" ||
    file.type === "text/csv" ||
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls') ||
    file.name.endsWith('.csv');
  
  const isImage = file.type.startsWith('image/');
  const isVCF = file.type === "text/vcard" || file.name.endsWith('.vcf');
  const isText = file.type.startsWith('text/') && !file.type.includes('csv') && !isVCF;
  const isPDF = file.type === 'application/pdf';
  
  // Only update position from props on initial render
  useEffect(() => {
    setLocalPosition({ x: file.position.x, y: file.position.y });
  }, []);
  
  // Parse VCF data from string
  const parseVCardData = (vcfContent: string) => {
    // Extract basic fields from vCard
    const nameMatch = vcfContent.match(/FN:(.*?)(?:\r?\n|$)/i);
    const fullName = nameMatch ? nameMatch[1].trim() : undefined;
    
    // Extract display name
    const displayNameMatch = vcfContent.match(/N:([^;]*);([^;]*);([^;]*);([^;]*);([^;]*)(?:\r?\n|$)/i);
    let name = undefined;
    if (displayNameMatch) {
      // Format varies but usually [lastName];[firstName];[middleName];[prefix];[suffix]
      const lastName = displayNameMatch[1]?.trim() || '';
      const firstName = displayNameMatch[2]?.trim() || '';
      name = firstName || lastName;
    }
    
    // Extract emails
    const emailRegex = /EMAIL(?:;[^:]*)*:(.*?)(?:\r?\n|$)/gi;
    const emails: {type: string, value: string}[] = [];
    
    let emailMatch;
    while ((emailMatch = emailRegex.exec(vcfContent)) !== null) {
      // Try to extract email type (HOME/WORK)
      const typeMatch = emailMatch[0].match(/type=([^;:]*)/i);
      const type = typeMatch ? typeMatch[1].toUpperCase() : 'OTHER';
      
      emails.push({
        type,
        value: emailMatch[1].trim()
      });
    }
    
    // Extract phone numbers
    const phoneRegex = /TEL(?:;[^:]*)*:(.*?)(?:\r?\n|$)/gi;
    const phones: {type: string, value: string}[] = [];
    
    let phoneMatch;
    while ((phoneMatch = phoneRegex.exec(vcfContent)) !== null) {
      // Try to extract phone type (CELL/WORK/HOME)
      const typeMatch = phoneMatch[0].match(/type=([^;:]*)/i);
      const type = typeMatch ? typeMatch[1].toUpperCase() : 'OTHER';
      
      phones.push({
        type,
        value: phoneMatch[1].trim()
      });
    }
    
    // Extract photo if present
    let photo = undefined;
    
    // Check for different vCard photo formats
    // Format 1: PHOTO;ENCODING=b;TYPE=JPEG:base64data
    const photoRegex1 = /PHOTO;(?:[^:]*?ENCODING=b[^:]*?):(.+?)(?:\r?\n|$)/i;
    const photoMatch1 = vcfContent.match(photoRegex1);
    
    // Format 2: PHOTO;JPEG;ENCODING=BASE64:base64data
    const photoRegex2 = /PHOTO;(?:[^:]*?BASE64[^:]*?):(.+?)(?:\r?\n|$)/i;
    const photoMatch2 = vcfContent.match(photoRegex2);
    
    // Format 3: PHOTO:base64data
    const photoRegex3 = /PHOTO:(.+?)(?:\r?\n|$)/i;
    const photoMatch3 = vcfContent.match(photoRegex3);
    
    // Choose the first match found
    const photoMatch = photoMatch1 || photoMatch2 || photoMatch3;
    
    if (photoMatch && photoMatch[1]) {
      // Photo is in base64 format, clean up any whitespace
      const photoData = photoMatch[1].replace(/\s/g, '');
      photo = `data:image/jpeg;base64,${photoData}`;
    }
    
    return {
      name: name || fullName,
      fullName,
      emails,
      phones,
      photo
    };
  };

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
          
        } else if (isVCF) {
          // Load and parse vCard data
          const response = await fetch(file.dataUrl);
          const vcfText = await response.text();
          
          // Store text content for reference
          setTextContent(vcfText);
          
          // Parse VCF data for display
          const parsedData = parseVCardData(vcfText);
          setVCardData(parsedData);
          
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
  }, [file.dataUrl, isExcel, isText, isVCF]);
  
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
  
  // Handle window drag with improved implementation for immediate dragging
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
    
    // Prevent default browser behavior and stop event propagation
    e.stopPropagation();
    e.preventDefault();
    
    // Always select the window on mouse down to allow for immediate interaction
    if (!isSelected) {
      onSelect(index);
    }
    
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
  
  // Handle mouse movement during drag with requestAnimationFrame for better performance
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
          {getFileIcon(file.type, file.name).icon}
          <h3 className="text-lg font-semibold mb-2">Error Loading File</h3>
          <p>{error}</p>
        </div>
      );
    }
    
    if (isVCF && vCardData) {
      // VCF Contact Card display - safe to access vCardData properties here
      const contactName = vCardData.name || vCardData.fullName || 'Unnamed Contact';
      const emails = vCardData.emails || [];
      const phones = vCardData.phones || [];
      const hasEmails = emails.length > 0;
      const hasPhones = phones.length > 0;
      
      return (
        <div className="h-full overflow-auto bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="flex flex-col items-center p-6">
            {/* Contact Photo or Avatar */}
            <div className="mb-6">
              <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
                {vCardData.photo ? (
                  <AvatarImage src={vCardData.photo} alt={contactName} />
                ) : (
                  <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                    {vCardData.name ? vCardData.name.charAt(0).toUpperCase() : <User size={48} />}
                  </AvatarFallback>
                )}
              </Avatar>
            </div>
            
            {/* Contact Name */}
            <h2 className="text-2xl font-bold mb-1 text-center">
              {contactName}
            </h2>
            
            {/* Contact Details Card */}
            <div className="w-full max-w-md bg-white rounded-xl shadow-md overflow-hidden mt-4">
              {/* Email Section */}
              {hasEmails && (
                <div className="p-4 border-b border-gray-100">
                  <h3 className="text-sm uppercase tracking-wide text-gray-500 mb-3 flex items-center">
                    <Mail className="h-4 w-4 mr-2" />Email
                  </h3>
                  <ul className="space-y-2">
                    {emails.map((email, index) => (
                      <li key={`email-${index}`} className="flex items-start">
                        <Badge 
                          variant="outline" 
                          className="mr-2 text-xs py-0 h-5 mt-0.5"
                        >
                          {email.type}
                        </Badge>
                        <a 
                          href={`mailto:${email.value}`} 
                          className="text-primary hover:underline flex items-center"
                        >
                          <AtSign className="h-3.5 w-3.5 mr-1 text-primary/70" />
                          {email.value}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Phone Section */}
              {hasPhones && (
                <div className="p-4">
                  <h3 className="text-sm uppercase tracking-wide text-gray-500 mb-3 flex items-center">
                    <PhoneIcon className="h-4 w-4 mr-2" />Phone
                  </h3>
                  <ul className="space-y-2">
                    {phones.map((phone, index) => (
                      <li key={`phone-${index}`} className="flex items-start">
                        <Badge 
                          variant="outline" 
                          className="mr-2 text-xs py-0 h-5 mt-0.5"
                        >
                          {phone.type}
                        </Badge>
                        <a 
                          href={`tel:${phone.value}`} 
                          className="text-primary hover:underline flex items-center"
                        >
                          <Phone className="h-3.5 w-3.5 mr-1 text-primary/70" />
                          {phone.value}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 mt-6">
              {hasEmails && (
                <Button 
                  size="sm" 
                  className="no-drag flex items-center" 
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `mailto:${emails[0].value}`;
                  }}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
              )}
              
              {hasPhones && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="no-drag flex items-center" 
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `tel:${phones[0].value}`;
                  }}
                >
                  <PhoneIcon className="h-4 w-4 mr-2" />
                  Call
                </Button>
              )}
            </div>
          </div>
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
                onClick={(e) => {
                  e.stopPropagation();
                  setEditMode(!editMode);
                }}
                className="h-8 px-2 flex gap-1 items-center no-drag"
              >
                {editMode ? <Check className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                {editMode ? "Done" : "Edit"}
              </Button>
              
              {modified && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    saveExcelData();
                  }}
                  className="h-8 px-2 flex gap-1 items-center no-drag"
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              )}
            </div>
          </div>
          
          {/* Tabs for sheets */}
          {workbook && workbook.SheetNames.length > 1 && (
            <Tabs value={activeSheet} onValueChange={handleTabChange} className="w-full no-drag">
              <TabsList className="w-full px-2 overflow-x-auto flex-nowrap">
                {workbook.SheetNames.map((sheet) => (
                  <TabsTrigger 
                    key={sheet} 
                    value={sheet} 
                    className="flex-shrink-0 no-drag"
                    onClick={(e) => e.stopPropagation()}
                  >
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
            {getFileIcon(file.type, file.name).icon}
          </div>
          <h3 className="font-medium text-lg mb-2">Preview not available</h3>
          <p className="text-sm text-gray-500 mb-4">
            This file type doesn't support direct preview in window mode.
          </p>
          <a
            href={file.dataUrl}
            download={file.name}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors no-drag"
            onClick={(e) => e.stopPropagation()}
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
      onClick={() => {
        if (!isSelected) {
          onSelect(index);
        }
      }}
    >
      {/* Window titlebar */}
      <div 
        className="window-titlebar flex items-center justify-between bg-gray-100 px-3 py-2 cursor-move border-b"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className="file-icon w-4 h-4">
            {getFileIcon(file.type, file.name).icon}
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
            className="h-6 w-6 no-drag" 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Window content */}
      <div 
        className="window-content h-[calc(100%-40px)]"
        onClick={() => {
          if (!isSelected) {
            onSelect(index);
          }
        }}
      >
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