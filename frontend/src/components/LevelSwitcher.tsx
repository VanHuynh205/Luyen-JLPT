import { Button } from "@/components/ui/button";
import { LEVELS } from "@/core/content/types";
import { useContent } from "@/hooks/useContent";

export function LevelSwitcher() {
  const { level, available, setLevel } = useContent();

  return (
    <fieldset className="mx-auto grid max-w-6xl grid-cols-5 items-center gap-1 px-4 pb-2 sm:flex sm:flex-wrap sm:gap-1.5 md:px-6">
      <legend className="sr-only">Cấp độ JLPT</legend>
      <span
        aria-hidden="true"
        className="mr-1 hidden text-xs font-medium text-muted-foreground sm:inline"
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
            className="min-h-11 min-w-0 flex-col gap-0 rounded-xl px-1 text-xs sm:min-h-9 sm:flex-row sm:gap-2 sm:rounded-full sm:px-3"
            onClick={() => setLevel(option)}
          >
            {label}
            {!ready && available.length > 0 && (
              <span className="whitespace-normal text-center text-[0.625rem] leading-tight">
                Sắp ra mắt
              </span>
            )}
          </Button>
        );
      })}
    </fieldset>
  );
}
