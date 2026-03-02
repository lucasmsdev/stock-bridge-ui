import React from "react";
import { cn } from "@/lib/utils";

interface SectionDividerProps {
  variant?: "wave" | "curve" | "angle";
  flip?: boolean;
  fromColor?: string;
  toColor?: string;
  className?: string;
}

const paths = {
  wave: "M0,64 C320,120 640,0 960,64 C1280,128 1440,32 1440,32 L1440,160 L0,160 Z",
  curve: "M0,128 C480,0 960,160 1440,64 L1440,160 L0,160 Z",
  angle: "M0,96 L720,160 L1440,64 L1440,160 L0,160 Z",
};

export const SectionDivider = ({
  variant = "wave",
  flip = false,
  fromColor = "bg-background",
  toColor = "bg-background",
  className,
}: SectionDividerProps) => {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden leading-[0] -my-px",
        flip && "rotate-180",
        className
      )}
      aria-hidden="true"
    >
      {/* Background layer - color of the NEXT section */}
      <div className={cn("absolute inset-0", toColor)} />
      
      {/* SVG shape - color of the PREVIOUS section */}
      <svg
        className={cn("relative block w-full h-[48px] sm:h-[64px] lg:h-[80px]", fromColor)}
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d={paths[variant]}
          fill="currentColor"
          className="text-current"
        />
      </svg>
    </div>
  );
};
