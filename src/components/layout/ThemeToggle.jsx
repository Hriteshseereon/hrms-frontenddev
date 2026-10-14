import { Moon, Sun } from "lucide-react";
import { toggleTheme, useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const theme = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className="hover:bg-muted grid h-9 w-9 shrink-0 place-items-center rounded-lg transition"
    >
      {theme === "dark" ? (
        <Sun className="text-muted-foreground h-5 w-5" />
      ) : (
        <Moon className="text-muted-foreground h-5 w-5" />
      )}
    </button>
  );
}
