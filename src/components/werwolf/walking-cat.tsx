"use client";

import { useEffect, useState } from "react";

export function WalkingCat({ cardWidth }: { cardWidth: number }) {
  const [frame, setFrame] = useState(0);
  const [position, setPosition] = useState(0);
  const [forward, setForward] = useState(true);
  const [failed, setFailed] = useState(false);

  const size = Math.max(16, cardWidth / 8);
  const maxPosition = cardWidth - size;

  useEffect(() => {
    const interval = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 300);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPosition((current) => {
        const step = Math.max(0.5, cardWidth / 200);
        let next = forward ? current + step : current - step;
        if (next >= maxPosition) {
          next = maxPosition;
          setForward(false);
        } else if (next <= 0) {
          next = 0;
          setForward(true);
        }
        return next;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [forward, maxPosition, cardWidth]);

  if (failed) return null;

  const src =
    frame === 0 ? "/frames/GrayCatWalkingOne.png" : "/frames/GrayCatWalkingTwo.png";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Walking Cat"
      onError={() => setFailed(true)}
      className="pointer-events-none absolute bottom-0"
      style={{
        width: size,
        height: size,
        left: position,
        transform: forward ? "scaleX(1)" : "scaleX(-1)",
        objectFit: "contain",
      }}
      draggable={false}
    />
  );
}
