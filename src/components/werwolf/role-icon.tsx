"use client";

import { useState } from "react";

export function RoleIcon({
  name,
  short,
  className = "",
}: {
  name: string;
  short?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`flex h-full w-full items-center justify-center font-black uppercase tracking-wide ${className}`}
      >
        {short ?? name.slice(0, 2)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/roles/${encodeURIComponent(name)}icon.png`}
      alt={name}
      onError={() => setFailed(true)}
      className={`h-full w-full object-contain ${className}`}
      draggable={false}
    />
  );
}
