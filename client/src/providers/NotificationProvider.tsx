"use client";

import { useEffect } from "react";
import { useMe } from "@/hooks/useMe";
import { io, Socket } from "socket.io-client";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useMe();

  useEffect(() => {
    // Only request permission and connect if the user is logged in
    if (!user) return;

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(console.error);
    }

    let backendUrl = process.env.NEXT_PUBLIC_API_URL || "";
    try {
      if (backendUrl) {
        backendUrl = new URL(backendUrl).origin;
      }
    } catch (e) {
      console.error("Invalid NEXT_PUBLIC_API_URL for socket:", backendUrl);
    }
    
    const socket: Socket = io(backendUrl || undefined, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("Socket connected for notifications");
    });

    socket.on("new_notification", (notification) => {
      // 1. Dispatch window event so components like Sidebar can refresh unread count
      window.dispatchEvent(new CustomEvent("taskpilot:new_notification", { detail: notification }));

      // 2. Show Native OS Notification if permission granted
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          const nativeNotification = new window.Notification(notification.title || "New Notification", {
            body: notification.message,
            icon: "/logo.png",
          });

          nativeNotification.onclick = () => {
            window.focus();
            if (notification.taskId) {
              window.location.href = `/tasks/${notification.taskId}`;
            } else {
              window.location.href = "/notifications";
            }
          };
        } catch (error) {
          console.error("Failed to show native notification", error);
        }
      }
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  return <>{children}</>;
}
