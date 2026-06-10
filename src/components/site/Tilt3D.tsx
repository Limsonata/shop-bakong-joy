import { useRef, useState } from "react";

interface Tilt3DProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glare?: boolean;
  /** scene mode: perspective on outer wrapper so children can use translateZ for real depth */
  scene?: boolean;
  perspective?: number;
}

export function Tilt3D({
  children,
  className = "",
  maxTilt = 14,
  glare = true,
  scene = false,
  perspective = 1000,
}: Tilt3DProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [rot, setRot] = useState({ x: 0, y: 0, active: false });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    setRot({ x: -dy * maxTilt, y: dx * maxTilt, active: true });
    if (glare) {
      setGlarePos({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
        opacity: 0.22,
      });
    }
  };

  const handleMouseLeave = () => {
    setRot({ x: 0, y: 0, active: false });
    setGlarePos((p) => ({ ...p, opacity: 0 }));
  };

  const scaleVal = rot.active ? 1.04 : 1;
  const innerTransform = scene
    ? `rotateX(${rot.x}deg) rotateY(${rot.y}deg) scale3d(${scaleVal},${scaleVal},${scaleVal})`
    : `perspective(${perspective}px) rotateX(${rot.x}deg) rotateY(${rot.y}deg) scale3d(${scaleVal},${scaleVal},${scaleVal})`;

  if (scene) {
    return (
      <div
        className={`relative ${className}`}
        style={{ perspective: `${perspective}px`, perspectiveOrigin: "50% 50%" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={ref}
          style={{
            transform: innerTransform,
            transformStyle: "preserve-3d",
            transition: "transform 0.18s ease-out",
            willChange: "transform",
            width: "100%",
            height: "100%",
          }}
        >
          {children}
          {glare && (
            <div
              className="absolute inset-0 pointer-events-none rounded-[inherit]"
              style={{
                background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,${glarePos.opacity}) 0%, transparent 55%)`,
                opacity: glarePos.opacity > 0 ? 1 : 0,
                transition: "opacity 0.18s ease-out",
                mixBlendMode: "overlay",
                zIndex: 999,
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{
        transform: innerTransform,
        transformStyle: "preserve-3d",
        transition: "transform 0.15s ease-out",
        willChange: "transform",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {glare && (
        <div
          className="absolute inset-0 rounded-[inherit] pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,${glarePos.opacity * 2}) 0%, transparent 60%)`,
            opacity: glarePos.opacity > 0 ? 1 : 0,
            transition: "opacity 0.15s ease-out",
            mixBlendMode: "overlay",
          }}
        />
      )}
    </div>
  );
}
