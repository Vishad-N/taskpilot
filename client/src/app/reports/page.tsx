"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useMe } from "@/hooks/useMe";
import { useToast } from "@/components/ui/ToastProvider";
import api from "@/services/api";
import { DownloadSimple, CircleNotch, CalendarBlank, WarningCircle } from "@phosphor-icons/react";

export default function ReportsPage() {
  const { user } = useMe();
  const { showToast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <p className="text-gray-400">You do not have permission to view reports.</p>
        </div>
      </DashboardLayout>
    );
  }

  const handleExport = async () => {
    setError("");
    if (!startDate || !endDate) {
      setError("Please select both start and end dates.");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      setError("End date cannot be before start date.");
      return;
    }

    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 396) {
      setError("Export range cannot exceed 1 year.");
      return;
    }

    try {
      setIsExporting(true);
      
      const res = await api.get(`/reports/tasks/export`, {
        params: { startDate, endDate },
        responseType: 'blob'
      });
      
      // Create a blob from the response
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      
      // Extract filename from Content-Disposition header if possible
      let filename = `Task_Report_${startDate}_to_${endDate}.xlsx`;
      const disposition = res.headers['content-disposition'];
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename="([^"]*)"/.exec(disposition);
        if (matches != null && matches[1]) filename = matches[1];
      }

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showToast({ title: "Report exported successfully!", variant: "success" });
    } catch (err: any) {
      console.error("Export error:", err);
      // Try to parse the blob error response
      if (err.response && err.response.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          setError(json.message || "Failed to export report.");
        } catch {
          setError("Failed to export report.");
        }
      } else {
        setError("Failed to export report. Please try again later.");
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[2rem] font-black uppercase tracking-[0.05em] text-white">
            Reports Center
          </h1>
          <p className="mt-2 text-sm font-semibold tracking-wide text-gray-400">
            Export comprehensive data reports for your organization.
          </p>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Export Task Report Card */}
          <div className="bg-[#11161D] border border-white/5 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group transition-all duration-300 hover:border-emerald-500/30">
            <div className="absolute top-0 right-0 p-8 opacity-5 transition-opacity duration-300 group-hover:opacity-20 pointer-events-none">
              <DownloadSimple weight="duotone" className="w-32 h-32 text-emerald-400" />
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2 relative z-10">Export Task Report</h2>
            <p className="text-sm text-gray-400 mb-8 relative z-10 leading-relaxed">
              Download a comprehensive Excel report showing all tasks assigned to employees and their daily attendance within a selected date range. Includes a monthly summary worksheet.
            </p>

            <div className="space-y-6 relative z-10">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                  <WarningCircle className="w-5 h-5 shrink-0 mt-0.5" weight="fill" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">
                    Start Date
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <CalendarBlank className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      disabled={isExporting}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">
                    End Date
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <CalendarBlank className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      disabled={isExporting}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleExport}
                disabled={isExporting || !startDate || !endDate}
                className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-all hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
              >
                {isExporting ? (
                  <>
                    <CircleNotch className="w-5 h-5 animate-spin" weight="bold" />
                    <span>Generating Report...</span>
                  </>
                ) : (
                  <>
                    <DownloadSimple className="w-5 h-5" weight="bold" />
                    <span>Export to Excel</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </DashboardLayout>
  );
}
