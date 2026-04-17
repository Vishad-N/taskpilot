"use client";

type SoftLoaderProps = {
  title?: string;
  subtitle?: string;
};

export default function SoftLoader({
  title = "Loading workspace",
  subtitle = "Please wait a moment while we bring everything in.",
}: SoftLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="relative flex items-center justify-center">
        <video
          src="/DUCK.webm"
          autoPlay
          loop
          muted
          playsInline
          className="w-32 h-32 object-contain"
        />
      </div>
      <h2 className="mt-2 text-lg font-bold text-white">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-[var(--muted)]">{subtitle}</p>
    </div>
  );
}
