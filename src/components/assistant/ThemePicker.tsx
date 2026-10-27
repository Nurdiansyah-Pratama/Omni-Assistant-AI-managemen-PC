import { assistantThemes } from "../../config/assistantThemes";

interface ThemePickerProps {
  selectedThemeId: string;
  onSelect: (themeId: string) => void;
}

export function ThemePicker({
  selectedThemeId,
  onSelect,
}: ThemePickerProps) {
  return (
    <div className="flex items-center gap-1.5" aria-label="Warna Omni">
      {assistantThemes.map((theme) => {
        const isSelected = theme.id === selectedThemeId;

        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => onSelect(theme.id)}
            className={`h-5 w-5 rounded-full border-2 transition hover:scale-110 ${
              isSelected
                ? "border-slate-700 ring-2 ring-slate-300"
                : "border-white"
            }`}
            style={{ backgroundColor: theme.accent }}
            aria-label={`Gunakan warna ${theme.label}`}
            aria-pressed={isSelected}
            title={theme.label}
          />
        );
      })}
    </div>
  );
}
