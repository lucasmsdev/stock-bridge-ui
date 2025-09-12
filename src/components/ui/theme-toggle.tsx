import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeProvider } from "@/components/layout/ThemeProvider";

interface ThemeToggleProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ThemeToggle({ variant = "ghost", size = "icon" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeProvider();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleTheme}
      className="transition-all duration-200 hover:scale-105"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}