"use client";

import { useEffect, useRef } from "react";
import { useMe } from "@/hooks/useMe";
import { io, Socket } from "socket.io-client";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useMe();
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

    const playSound = () => {
      try {
        if (typeof window === "undefined") return;
        if (!audioRef.current) {
          audioRef.current = new window.Audio("/mixkit-musical-reveal-961.wav");
        }
        const audio = audioRef.current;
        // Prevent overlapping loud instances if already playing
        if (!audio.paused && audio.currentTime > 0) {
          return;
        }
        audio.currentTime = 0;
        audio.play().catch(err => {
          // Gracefully handle browser autoplay restrictions
          console.debug("Autoplay prevented for notification sound:", err);
        });
      } catch (e) {
        console.debug("Audio playback error:", e);
      }
    };

    socket.on("new_notification", (notification) => {
      playSound();
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

    socket.on("task_created", (task) => {
      window.dispatchEvent(new CustomEvent("taskpilot:task_created", { detail: task }));
    });

    socket.on("task_updated", (task) => {
      playSound();
      window.dispatchEvent(new CustomEvent("taskpilot:task_updated", { detail: task }));
    });

    socket.on("attendance_updated", (attendance) => {
      // You don't necessarily need to play a sound for every attendance update
      window.dispatchEvent(new CustomEvent("taskpilot:attendance_updated", { detail: attendance }));
    });

    socket.on("task_deleted", (data) => {
      playSound();
      window.dispatchEvent(new CustomEvent("taskpilot:task_deleted", { detail: data }));
    });

    socket.on("task_comment_added", (data) => {
      playSound();
      window.dispatchEvent(new CustomEvent("taskpilot:task_comment_added", { detail: data }));
    });

    socket.on("leave_updated", () => {
      window.dispatchEvent(new CustomEvent("taskpilot:leave_updated"));
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  return <>{children}</>;
}
