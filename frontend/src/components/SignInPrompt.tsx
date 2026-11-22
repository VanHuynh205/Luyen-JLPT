import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function SignInPrompt() {
  return (
    <aside
      className="mx-auto max-w-6xl px-4 py-4 md:px-6"
      aria-label="Lưu tiến độ"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
        <p>
          Tiến độ của bạn chỉ lưu trên máy này. Đăng nhập để đồng bộ giữa các
          thiết bị.
        </p>
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/tai-khoan">Đăng nhập</Link>
        </Button>
      </div>
    </aside>
  );
}
