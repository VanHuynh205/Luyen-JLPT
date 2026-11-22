import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";

interface EmptyResultsProps {
  query: string;
  onClear: () => void;
}

export function EmptyResults({ query, onClear }: EmptyResultsProps) {
  return (
    <div
      data-ocid="kanji_library.empty_state"
      className="flex flex-col items-center rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-xl font-semibold">Không tìm thấy kết quả</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground break-words">
        Không có mục nào khớp với “{query}”. Thử tìm bằng chữ kanji, cách đọc,
        âm Hán Việt hoặc nghĩa tiếng Việt.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-5 rounded-lg"
        onClick={onClear}
        data-ocid="kanji_library.clear_button"
      >
        Xóa tìm kiếm
      </Button>
    </div>
  );
}
