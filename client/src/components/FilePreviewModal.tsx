import { useRef, useEffect, useState } from "react";
import { DesktopFile } from "@/types";
import { formatFileSize } from "@/utils/file-utils";
import { X, FileSpreadsheet, Save, Edit, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import * as XLSX from 'xlsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FilePreviewModalProps {
  file: DesktopFile | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FilePreviewModal({
  file,
  isOpen,
  onClose,
}: FilePreviewModalProps) {
  const downloadRef = useRef<HTMLAnchorElement>(null);

  // Gebruik preloading om de bestandsinhoud klaar te hebben voordat het modal wordt geopend
  useEffect(() => {
    // Meteen de download link instellen zodra we een bestand hebben
    if (file && downloadRef.current) {
      downloadRef.current.href = file.dataUrl;
      downloadRef.current.download = file.name;
    }
    
    // Pre-load het bestand als het een afbeelding is
    if (file && file.type.startsWith("image/")) {
      const img = new Image();
      img.src = file.dataUrl;
    }
  }, [file]);

  if (!file) return null;

  // Check if file is an Excel/spreadsheet file
  const isExcel = 
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
    file.type === "application/vnd.ms-excel" ||
    file.type === "text/csv" ||
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls') ||
    file.name.endsWith('.csv');

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] flex flex-col">
        <DialogHeader className="px-4 py-3 border-b">
          <div className="flex justify-between items-center">
            <DialogTitle className="font-semibold text-lg">{file.name}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto p-4 min-h-[40vh]">
          {file.type.startsWith("image/") ? (
            <div className="flex items-center justify-center h-full">
              <img
                src={file.dataUrl}
                alt={file.name}
                className="max-w-full max-h-[60vh] object-contain"
              />
            </div>
          ) : file.type === "application/pdf" ? (
            <div className="flex items-center justify-center h-[60vh]">
              <iframe
                src={file.dataUrl}
                width="100%"
                height="100%"
                className="border-0"
                title={file.name}
              />
            </div>
          ) : file.type.startsWith("video/") ? (
            <div className="flex items-center justify-center h-full">
              <video controls className="max-w-full max-h-[60vh]">
                <source src={file.dataUrl} type={file.type} />
                Your browser does not support video playback.
              </video>
            </div>
          ) : file.type.startsWith("audio/") ? (
            <div className="flex items-center justify-center h-full">
              <audio controls className="w-full max-w-md">
                <source src={file.dataUrl} type={file.type} />
                Your browser does not support audio playback.
              </audio>
            </div>
          ) : file.type.startsWith("text/") ? (
            <PreviewTextContent dataUrl={file.dataUrl} />
          ) : isExcel ? (
            <ExcelPreview dataUrl={file.dataUrl} />
          ) : (
            <div className="flex flex-col items-center justify-center h-[40vh] text-center p-8">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16 text-gray-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-lg font-semibold mb-2">
                Preview not available
              </h3>
              <p className="text-gray-500 mb-6">
                This file type cannot be previewed. Please download the file to
                view its contents.
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter className="px-4 py-3 border-t">
          <div className="flex justify-between items-center w-full">
            <div className="text-sm text-gray-500">
              {file.type} · {formatFileSize(file.size)}
            </div>
            <a
              ref={downloadRef}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-neutral bg-white hover:bg-gray-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Download
            </a>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Gedeelde cache voor eerder geladen bestandsinhoud (prestatieverbetering)
const textContentCache = new Map<string, string>();

// Component to display text content - geoptimaliseerd met caching
function PreviewTextContent({ dataUrl }: { dataUrl: string }) {
  const [text, setText] = useState<string>("");
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadProgress, setLoadProgress] = useState<number>(0);

  useEffect(() => {
    // Controleer eerst of we dit bestand al in de cache hebben
    if (textContentCache.has(dataUrl)) {
      setText(textContentCache.get(dataUrl) || "");
      setLoading(false);
      return;
    }
    
    // Beperk textbestand grootte voor betere prestaties met progressieve lading
    const fetchWithTimeout = async () => {
      setLoading(true);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconden timeout
        
        // Begin met bestand ophalen
        const response = await fetch(dataUrl, { signal: controller.signal });
        
        // Controleer bestandsgrootte
        const contentLength = response.headers.get('Content-Length');
        const totalSize = contentLength ? parseInt(contentLength, 10) : undefined;
        
        // Stream de response voor grote bestanden
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Kan bestandsinhoud niet lezen");
        
        let receivedLength = 0;
        let chunks: Uint8Array[] = [];
        
        // Lees in chunks
        while(true) {
          const {done, value} = await reader.read();
          
          if (done) {
            break;
          }
          
          chunks.push(value);
          receivedLength += value.length;
          
          // Update progressiestatus
          if (totalSize) {
            setLoadProgress(Math.round((receivedLength / totalSize) * 100));
          }
          
          // Als we een enorm bestand tegenkomen, stoppen we na 1MB
          if (receivedLength > 1048576) { // 1MB
            chunks.push(new TextEncoder().encode("\n\n[Bestand ingekort vanwege grootte (>1MB)...]"));
            break;
          }
        }
        
        // Combineer chunks tot tekst
        const chunksAll = new Uint8Array(receivedLength);
        let position = 0;
        for(let chunk of chunks) {
          chunksAll.set(chunk, position);
          position += chunk.length;
        }
        
        // Decodeer de bestandsinhoud
        const content = new TextDecoder("utf-8").decode(chunksAll);
        
        // Limiteer aantal tekens voor grote bestanden
        const finalContent = content.length > 500000 
          ? content.substring(0, 500000) + "\n\n[Bestand ingekort vanwege grootte (>500K tekens)...]" 
          : content;
        
        // Cache het resultaat voor latere weergave
        textContentCache.set(dataUrl, finalContent);
        
        setText(finalContent);
        clearTimeout(timeoutId);
        setLoading(false);
      } catch (err) {
        console.error("Error loading text file:", err);
        setError(true);
        setLoading(false);
      }
    };
    
    fetchWithTimeout();
  }, [dataUrl]);

  if (error) {
    return <div className="text-center text-red-500">Error loading file content</div>;
  }
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[40vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-3"></div>
        <span className="text-gray-600">Bestand laden...</span>
        {loadProgress > 0 && (
          <div className="w-64 mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${loadProgress}%` }}></div>
            </div>
            <div className="text-xs text-gray-500 mt-1 text-center">{loadProgress}% geladen</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-[60vh] overflow-auto">
      <pre className="text-sm whitespace-pre-wrap p-4 bg-gray-50 rounded border border-gray-200">
        {text}
      </pre>
    </div>
  );
}

// Component to display and edit Excel spreadsheet content
function ExcelPreview({ dataUrl }: { dataUrl: string }) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editingCell, setEditingCell] = useState<{row: number, col: number, value: string} | null>(null);
  const [modified, setModified] = useState<boolean>(false);
  const cellInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadExcel = async () => {
      try {
        setLoading(true);
        setError(null);
        setModified(false);

        // Fetch the Excel file
        const response = await fetch(dataUrl);
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
  }, [dataUrl]);

  // Focus the input field when editing a cell
  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
    }
  }, [editingCell]);

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
      a.download = 'edited_' + (new Date().toISOString().slice(0, 10)) + '.xlsx';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <span className="ml-3 text-gray-600">Loading spreadsheet...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 p-4 flex flex-col items-center">
        <FileSpreadsheet className="w-12 h-12 mb-3 text-red-400" />
        <h3 className="text-lg font-semibold mb-2">Error Loading Spreadsheet</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!workbook || workbook.SheetNames.length === 0) {
    return (
      <div className="text-center text-gray-500 p-4">
        No data found in this spreadsheet.
      </div>
    );
  }

  return (
    <div className="h-[60vh] flex flex-col">
      {/* Controls bar */}
      <div className="flex justify-between items-center py-2 px-4 border-b bg-gray-50">
        <div className="flex gap-2">
          <Button 
            variant={editMode ? "default" : "outline"} 
            size="sm" 
            onClick={toggleEditMode}
            className="text-xs flex items-center gap-1"
          >
            {editMode ? <><Check className="h-3.5 w-3.5" /> Editing Active</> : <><Edit className="h-3.5 w-3.5" /> Edit Mode</>}
          </Button>
          
          {modified && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={saveChanges}
              className="text-xs flex items-center gap-1"
            >
              <Save className="h-3.5 w-3.5" /> Save Changes
            </Button>
          )}
        </div>
        
        <div className="text-xs text-gray-500">
          {editMode ? "Click on any cell to edit" : "Double-click to preview, enable Edit Mode to modify"}
        </div>
      </div>
      
      {/* Sheet tabs */}
      {workbook.SheetNames.length > 1 && (
        <Tabs value={activeSheet} onValueChange={handleSheetChange} className="w-full">
          <div className="overflow-x-auto border-b">
            <TabsList className="h-9 px-0 bg-transparent mb-px">
              {workbook.SheetNames.map(sheetName => (
                <TabsTrigger 
                  key={sheetName}
                  value={sheetName}
                  className={`data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 py-1.5 text-sm`}
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
        {sheetData.length > 0 ? (
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
  );
}
