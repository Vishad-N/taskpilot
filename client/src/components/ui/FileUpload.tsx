"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, File, X, Loader2 } from "lucide-react";
import axios from "axios";
import api from "@/services/api";
import { useToast } from "./ToastProvider";

interface FileUploadProps {
  onUploadComplete: (metadata: { key: string; filename: string; fileType: string; size: number }) => void;
  maxSizeMB?: number;
}

export default function FileUpload({ onUploadComplete, maxSizeMB = 50 }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = async (file: File) => {
    // Check size limit
    if (file.size > maxSizeMB * 1024 * 1024) {
      showToast({ variant: "error", title: "Upload Failed", description: `File exceeds the ${maxSizeMB}MB limit.` });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 1. Get presigned URL from backend
      const { data } = await api.post(
        "/upload/presigned-url",
        {
          filename: file.name,
          fileType: file.type,
          size: file.size,
        }
      );

      const { uploadUrl, key } = data;

      // 2. Upload file to R2 using the presigned URL
      await axios.put(uploadUrl, file, {
        headers: {
          "Content-Type": file.type,
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        },
      });

      // 3. Notify parent component
      onUploadComplete({
        key,
        filename: file.name,
        fileType: file.type,
        size: file.size,
      });
      
      showToast({ variant: "success", title: "Upload Complete", description: "File uploaded successfully!" });

    } catch (error: any) {
      console.error("Upload failed:", error);
      showToast({ variant: "error", title: "Upload Failed", description: error.response?.data?.message || "Failed to upload file." });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
        isDragging ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" : "border-slate-300 dark:border-slate-700 hover:border-purple-400"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !isUploading && fileInputRef.current?.click()}
    >
      <input
        type="file"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileInput}
        disabled={isUploading}
      />
      
      {isUploading ? (
        <div className="flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Uploading... {uploadProgress}%
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden dark:bg-slate-700 max-w-[200px]">
            <div 
              className="h-full bg-purple-500 transition-all duration-300" 
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-2">
          <UploadCloud className="w-10 h-10 text-slate-400" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Drag & drop a file here, or click to select
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Supports all formats (Max {maxSizeMB}MB)
          </p>
        </div>
      )}
    </div>
  );
}
