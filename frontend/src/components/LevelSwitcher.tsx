import { Button } from "@/components/ui/button";
import { LEVELS } from "@/core/content/types";
import { useContent } from "@/hooks/useContent";

export function LevelSwitcher() {
  const { level, available, setLevel } = useContent();

  return (
    <fieldset className="mx-auto flex max-w-6xl min-w-0 items-center gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible md:px-6">
      <legend className="sr-only">Cấp độ JLPT</legend>
      <span
        aria-hidden="true"
        className="mr-1 hidden shrink-0 text-xs font-medium text-muted-foreground sm:inline"
      >
        Cấp độ
      </span>
      {LEVELS.map((option) => {
        const ready = available.includes(option);
        const selected = ready && level === option;
        const label = option.toUpperCase();
        return (
          <Button
            key={option}
            type="button"
            variant={selected ? "default" : "outline"}
            size="sm"
            disabled={!ready}
            aria-pressed={selected}
            aria-label={
              ready
                ? label
                : `${label}, ${available.length ? "Sắp ra mắt" : "Đang tải"}`
            }
            data-ocid={`level.switcher.${option}`}
            className="min-h-11 shrink-0 gap-1.5 rounded-full px-3 text-xs sm:min-h-8 sm:px-3"
            onClick={() => setLevel(option)}
          >
            <span>{label}</span>
            {!ready && available.length > 0 && (
              <span className="text-[0.625rem] leading-none opacity-80">
                Sắp ra mắt
              </span>
            )}
          </Button>
        );
      })}
    </fieldset>
  );
}
