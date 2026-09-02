"use client";

import React, { useState } from "react";
import { File, Download, Loader2, Image as ImageIcon, FileText } from "lucide-react";
import api from "@/services/api";
import { useToast } from "./ToastProvider";

interface Attachment {
  key: string;
  filename: string;
  fileType: string;
  size: number;
  uploadedAt?: string;
  _id?: string;
}

interface AttachmentListProps {
  attachments: Attachment[];
}

export default function AttachmentList({ attachments }: AttachmentListProps) {
  const { showToast } = useToast();
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    if (fileType.includes("pdf") || fileType.includes("document")) return <FileText className="w-5 h-5 text-red-500" />;
    return <File className="w-5 h-5 text-slate-500" />;
  };

  const handleDownload = async (key: string, filename: string) => {
    setDownloadingKey(key);
    try {
      const { data } = await api.get(`/upload/download-url?key=${key}`);

      // Open the presigned URL in a new tab
      window.open(data.downloadUrl, "_blank");
    } catch (error: any) {
      console.error("Failed to generate download link:", error);
      showToast({ variant: "error", title: "Download Failed", description: "Failed to download file." });
    } finally {
      setDownloadingKey(null);
    }
  };

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="space-y-2 mt-3">
      {attachments.map((attachment) => (
        <div 
          key={attachment._id || attachment.key} 
          className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-sm transition-shadow"
        >
          <div className="flex items-center space-x-3 overflow-hidden">
            {getIcon(attachment.fileType)}
            <div className="flex flex-col truncate">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                {attachment.filename}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {formatSize(attachment.size)}
              </span>
            </div>
          </div>
          
          <button
            onClick={() => handleDownload(attachment.key, attachment.filename)}
            disabled={downloadingKey === attachment.key}
            className="p-2 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-full transition-colors focus:outline-none"
            title="Download / View"
          >
            {downloadingKey === attachment.key ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
