"use client";

export function SkyBackground({ isActive }: { isActive: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 transition-opacity duration-1000 ${
        isActive ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Layer order (back to front): sky (z-0) → clouds (z-10) → foreground (z-20) */}
      <div className="absolute inset-0 z-0 bg-[url('/sky.png')] bg-cover bg-center" />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-0 top-0 z-10 flex h-full w-[200vw] animate-[slideCloudsRight_140s_linear_infinite] opacity-40 mix-blend-screen">
          <div className="h-full w-[100vw] scale-x-[-1.1] scale-y-110 bg-[url('/clouds.png')] bg-cover bg-center" />
          <div className="h-full w-[100vw] scale-x-[-1.1] scale-y-110 bg-[url('/clouds.png')] bg-cover bg-center" />
        </div>
      </div>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-0 top-0 z-10 flex h-full w-[200vw] animate-[slideCloudsRight_80s_linear_infinite] opacity-75 mix-blend-screen">
          <div className="h-full w-[100vw] bg-[url('/clouds.png')] bg-cover bg-center" />
          <div className="h-full w-[100vw] bg-[url('/clouds.png')] bg-cover bg-center" />
        </div>
      </div>
      <div
        className="absolute inset-0 z-20 bg-[url('/foreground.png')] bg-bottom bg-cover bg-no-repeat"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 52%, black 74%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 52%, black 74%)",
        }}
      />
    </div>
  );
}
