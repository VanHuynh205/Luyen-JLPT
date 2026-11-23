import {
  LOGIN_ERROR,
  clearDeletedSession,
  deleteAccount,
  login,
  signInWithGoogle,
  supabase,
} from "@/adapters/auth/client";
import { getAuthRedirectUrl } from "@/adapters/auth/nativeAuth";
import { useAuth } from "@/adapters/auth/session";
import { progressStore } from "@/adapters/local-store/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isTauri } from "@tauri-apps/api/core";
import { type FormEvent, useState } from "react";

type Mode = "login" | "signup" | "reset";
const modes: Record<Mode, string> = {
  login: "Đăng nhập",
  signup: "Đăng ký",
  reset: "Quên mật khẩu",
};

export default function AccountPage() {
  const { session, recovering, finishRecovery } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletedOwner, setDeletedOwner] = useState<string | null>(null);
  const [changePassword, setChangePassword] = useState(false);
  const callback = getAuthRedirectUrl(window.location.origin);

  async function run(
    action: () => Promise<void>,
    failure = "Không thực hiện được. Vui lòng thử lại.",
  ) {
    if (!supabase || busy) return;
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch {
      setNotice(failure);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabase;
    if (!client) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const field = (name: string) => String(data.get(name) ?? "");
    void run(
      async () => {
        if (session) {
          const { error } = await client.auth.updateUser({
            password: field("password"),
          });
          if (error) throw error;
          finishRecovery();
          setChangePassword(false);
          setNotice("Đã cập nhật mật khẩu.");
        } else if (mode === "login") {
          await login(field("identifier"), field("password"));
        } else if (mode === "signup") {
          const { error } = await client.auth.signUp({
            email: field("email").trim(),
            password: field("password"),
            options: {
              data: { username: field("username").trim().toLowerCase() },
              emailRedirectTo: callback,
            },
          });
          if (error) throw error;
          setNotice(
            isTauri()
              ? "Mở liên kết xác nhận trên thiết bị này rồi chọn mở bằng Luyện JLPT."
              : "Hãy mở thư xác nhận trên trình duyệt này để hoàn tất đăng ký.",
          );
        } else {
          const { error } = await client.auth.resetPasswordForEmail(
            field("email").trim(),
            { redirectTo: callback },
          );
          if (
            error?.code === "over_email_send_rate_limit" ||
            error?.code === "over_request_rate_limit"
          ) {
            setNotice("Có quá nhiều yêu cầu. Vui lòng thử lại sau.");
            return;
          }
          if (error) throw error;
          setNotice(
            isTauri()
              ? "Nếu email có tài khoản, bạn sẽ nhận được thư đặt lại mật khẩu. Hãy mở liên kết trên thiết bị này."
              : "Nếu email có tài khoản, bạn sẽ nhận được thư đặt lại mật khẩu.",
          );
        }
        form.reset();
      },
      !session && mode === "login"
        ? LOGIN_ERROR
        : mode === "signup"
          ? "Không đăng ký được. Kiểm tra thông tin hoặc chọn tên đăng nhập khác."
          : undefined,
    );
  }

  return (
    <section
      data-ocid="account.page"
      className="mx-auto max-w-xl space-y-5 px-4 py-12"
    >
      <h1 className="font-display text-3xl">Tài khoản</h1>
      {notice && <output className="rounded-md bg-muted p-3">{notice}</output>}
      {!supabase ? (
        <p>
          Bạn có thể học và lưu tiến độ trên máy. Bản này chưa cấu hình dịch vụ
          tài khoản.
        </p>
      ) : session ? (
        <>
          <p>
            Đã đăng nhập: <strong>{session.user.email}</strong>
          </p>
          <p>
            {session.user.email_confirmed_at
              ? "Tiến độ lưu trên máy và tự đồng bộ khi có mạng."
              : "Hãy xác nhận email để đồng bộ tiến độ."}
          </p>
          {recovering || changePassword ? (
            <form onSubmit={submit} className="grid gap-3">
              <label htmlFor="auth-password">
                Mật khẩu mới
                <Input
                  id="auth-password"
                  required
                  type="password"
                  name="password"
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <Button disabled={busy}>Lưu mật khẩu mới</Button>
            </form>
          ) : (
            <Button variant="outline" onClick={() => setChangePassword(true)}>
              Đổi mật khẩu
            </Button>
          )}
          <div>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() =>
                void run(async () => {
                  const { error } = await supabase!.auth.signOut({
                    scope: "local",
                  });
                  if (error) throw error;
                })
              }
            >
              Đăng xuất
            </Button>
          </div>
          {confirmDelete === session.user.id ? (
            <div className="space-y-3 rounded-md border p-4">
              <p>
                Bạn sẽ mất tài khoản và toàn bộ tiến độ đã lưu. Không thể hoàn
                tác.
              </p>
              <Button
                disabled={busy}
                variant="destructive"
                onClick={() =>
                  void run(async () => {
                    if (deletedOwner !== confirmDelete) {
                      await deleteAccount(confirmDelete);
                      setDeletedOwner(confirmDelete);
                    }
                    await progressStore.purgeOwner(confirmDelete);
                    await clearDeletedSession(confirmDelete);
                    window.location.reload();
                  })
                }
              >
                Xác nhận xoá vĩnh viễn
              </Button>{" "}
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => setConfirmDelete(null)}
              >
                Huỷ
              </Button>
            </div>
          ) : (
            <Button
              disabled={busy}
              variant="destructive"
              onClick={() => setConfirmDelete(session.user.id)}
            >
              Xoá tài khoản
            </Button>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(modes) as Mode[]).map((option) => (
              <Button
                type="button"
                key={option}
                variant={mode === option ? "default" : "outline"}
                aria-pressed={mode === option}
                disabled={busy}
                onClick={() => {
                  setNotice("");
                  setMode(option);
                }}
              >
                {modes[option]}
              </Button>
            ))}
          </div>
          <form
            key={mode}
            onSubmit={submit}
            className="grid gap-4 rounded-xl border bg-card p-5"
          >
            {mode === "login" ? (
              <label htmlFor="auth-identifier">
                Email hoặc tên đăng nhập
                <Input
                  id="auth-identifier"
                  required
                  name="identifier"
                  autoComplete="username"
                  maxLength={254}
                />
              </label>
            ) : (
              <label htmlFor="auth-email">
                Email
                <Input
                  id="auth-email"
                  required
                  type="email"
                  name="email"
                  autoComplete="email"
                  maxLength={254}
                />
              </label>
            )}
            {mode === "signup" && (
              <label htmlFor="auth-username">
                Tên đăng nhập (3–32 chữ, số, dấu gạch dưới)
                <Input
                  id="auth-username"
                  required
                  name="username"
                  autoComplete="username"
                  pattern="[a-zA-Z0-9_]{3,32}"
                  maxLength={32}
                />
              </label>
            )}
            {mode !== "reset" && (
              <label htmlFor="auth-password">
                Mật khẩu
                <Input
                  id="auth-password"
                  required
                  name="password"
                  type="password"
                  minLength={mode === "signup" ? 8 : 1}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                />
              </label>
            )}
            <Button disabled={busy}>
              {mode === "reset"
                ? "Gửi liên kết"
                : mode === "signup"
                  ? "Tạo tài khoản"
                  : "Vào tài khoản"}
            </Button>
          </form>
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => void run(signInWithGoogle)}
          >
            Tiếp tục với Google
          </Button>
        </>
      )}
    </section>
  );
}
