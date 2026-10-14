"use client";

export function SkyBackground({ isActive }: { isActive: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 transition-opacity duration-1000 ${
        isActive ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Ebenen von hinten nach vorne: sky (z-0) → clouds (z-10) → foreground (z-20).
          Der z-Index der Wolken liegt auf den animierten, geblendeten Elementen selbst
          (nicht auf den overflow-hidden-Wrappern), damit mix-blend-screen weiterhin
          gegen den Himmel blendet und der Vordergrund trotzdem davor liegt. */}
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
      {/* Vordergrund liegt deckend vor den Wolken. Bewusst ohne Maske/Verlauf:
          eine Ausblendung der oberen Bildhälfte ließ die Wolken vor dem Dorf
          durchscheinen, obwohl die Ebene korrekt gestapelt war. */}
      <div className="absolute inset-0 z-20 bg-[url('/foreground.png')] bg-bottom bg-cover bg-no-repeat" />
    </div>
  );
}
