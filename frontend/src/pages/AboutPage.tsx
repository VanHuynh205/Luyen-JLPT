import { nativeReleases } from "@/adapters/native/androidUpdate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isTauri } from "@tauri-apps/api/core";
import type { ReactNode } from "react";
import { toast } from "sonner";

function ExternalLink({
  href,
  children,
}: { href: string; children: ReactNode }) {
  return (
    <a
      className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        if (!isTauri()) return;
        event.preventDefault();
        void import("@tauri-apps/plugin-opener")
          .then(({ openUrl }) => openUrl(href))
          .catch(() => toast.error("Không mở được liên kết."));
      }}
    >
      {children}
    </a>
  );
}

export default function AboutPage() {
  return (
    <section
      data-ocid="about.page"
      className="mx-auto max-w-3xl space-y-6 px-4 py-12 md:px-6"
    >
      <div className="space-y-2">
        <h1 className="font-display text-3xl">Giới thiệu</h1>
        <p className="text-muted-foreground">
          Ôn JLPT giúp bạn học từ vựng, kanji, ngữ pháp và đọc hiểu N4.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Nguồn dữ liệu</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Âm On và Kun của kanji lấy từ KANJIDIC2 của Electronic Dictionary
            Research and Development Group. Ứng dụng hiển thị phần dữ liệu này
            trong Gói N4 theo giấy phép CC BY-SA 4.0.
          </p>
          <div className="flex flex-wrap gap-x-4">
            <ExternalLink href="https://www.edrdg.org/wiki/KANJIDIC_Project.html">
              Nguồn KANJIDIC2
            </ExternalLink>
            <ExternalLink href="https://creativecommons.org/licenses/by-sa/4.0/">
              Giấy phép CC BY-SA 4.0
            </ExternalLink>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cài app trực tiếp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p>
            Windows: tải bộ cài <code>.exe</code> từ trang phát hành. Nếu
            SmartScreen hiện cảnh báo, hãy xác minh nguồn trước khi chọn Thông
            tin thêm, rồi Vẫn chạy.
          </p>
          <p>
            Android: tải bộ cài <code>.apk</code> từ trang phát hành. Chỉ cho
            phép cài từ ứng dụng dùng để mở bộ cài, rồi tắt quyền sau khi cài.
          </p>
          <p>
            iOS: dùng iOS Simulator trên macOS để thử. Không có bản App Store.
          </p>
          <ExternalLink href={nativeReleases}>Mở trang phát hành</ExternalLink>
        </CardContent>
      </Card>
    </section>
  );
}
