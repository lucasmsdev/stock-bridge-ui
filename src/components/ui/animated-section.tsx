import React from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

type Animation = "fade-up" | "fade-left" | "fade-right" | "scale" | "none";

interface AnimatedSectionProps {
  animation?: Animation;
  delay?: number;
  className?: string;
  children: React.ReactNode;
  threshold?: number;
}

const animationClasses: Record<Animation, { hidden: string; visible: string }> = {
  "fade-up": {
    hidden: "opacity-0 translate-y-4",
    visible: "opacity-100 translate-y-0",
  },
  "fade-left": {
    hidden: "opacity-0 -translate-x-4",
    visible: "opacity-100 translate-x-0",
  },
  "fade-right": {
    hidden: "opacity-0 translate-x-4",
    visible: "opacity-100 translate-x-0",
  },
  scale: {
    hidden: "opacity-0 scale-[0.98]",
    visible: "opacity-100 scale-100",
  },
  none: {
    hidden: "",
    visible: "",
  },
};

export function AnimatedSection({
  animation = "fade-up",
  delay = 0,
  className,
  children,
  threshold = 0.1,
}: AnimatedSectionProps) {
  const { ref, isVisible } = useScrollReveal({ threshold });
  const classes = animationClasses[animation];

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-500 ease-out motion-reduce:!opacity-100 motion-reduce:!transform-none motion-reduce:!transition-none",
        isVisible ? classes.visible : classes.hidden,
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
