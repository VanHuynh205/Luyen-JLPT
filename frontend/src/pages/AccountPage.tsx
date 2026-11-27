import {
  AuthLoginError,
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import {
  type ThemePreference,
  useThemePreference,
} from "@/hooks/useThemePreference";
import { isTauri } from "@tauri-apps/api/core";
import { Monitor, Moon, Sun } from "lucide-react";
import { type FormEvent, useState } from "react";

type Mode = "login" | "signup" | "reset";
const modes: Record<Mode, string> = {
  login: "Đăng nhập",
  signup: "Đăng ký",
  reset: "Quên mật khẩu",
};

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối (Sumi đêm)", icon: Moon },
  { value: "system", label: "Theo hệ thống", icon: Monitor },
];

function MotionSettingsCard() {
  const { setPreference, mode, osReduced, webglSupported, lowPerf } =
    useMotionPreference();
  const { preference: themePreference, setPreference: setThemePreference } =
    useThemePreference();
  const effectsEnabled = mode !== "reduced";

  const helperText = osReduced
    ? "Đang tắt theo cài đặt Giảm chuyển động của thiết bị."
    : !effectsEnabled
      ? "Đã tắt chuyển động 3D; lật thẻ chuyển sang mờ dần nhẹ nhàng."
      : webglSupported === false || lowPerf
        ? "Thiết bị đang dùng ảnh tĩnh thay cho cảnh 3D để đảm bảo mượt mà."
        : "Hiển thị bàn học 3D, lật thẻ và chuyển cảnh mượt.";

  return (
    <section
      aria-labelledby="account-motion-title"
      className="rounded-xl border bg-card p-5 shadow-subtle"
    >
      <h2
        id="account-motion-title"
        className="font-display text-xl font-semibold"
      >
        Giao diện &amp; hiệu ứng
      </h2>
      <fieldset className="mt-4 space-y-2.5 border-0 p-0">
        <legend className="text-sm font-medium text-foreground">
          Chế độ màu
        </legend>
        <p className="text-xs text-muted-foreground">
          Chọn nền giấy Washi sáng hoặc mực đêm Sumi dịu mắt.
        </p>
        <div className="flex flex-wrap gap-2">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = themePreference === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                variant={selected ? "default" : "outline"}
                aria-pressed={selected}
                data-ocid={`account.theme.${option.value}.button`}
                className="min-h-11 min-w-11 sm:min-h-11"
                onClick={() => setThemePreference(option.value)}
              >
                <Icon className="size-4" aria-hidden="true" />
                {option.label}
              </Button>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-4 flex min-h-11 items-center justify-between gap-4 border-t pt-4">
        <div className="min-w-0 space-y-1">
          <Label
            htmlFor="account-motion-switch"
            className="cursor-pointer text-sm font-medium text-foreground"
          >
            Hiệu ứng 3D và chuyển động
          </Label>
          <p className="text-xs text-muted-foreground">{helperText}</p>
        </div>
        <Switch
          id="account-motion-switch"
          data-ocid="account.motion.switch"
          checked={effectsEnabled}
          disabled={osReduced}
          onCheckedChange={(checked) =>
            setPreference(checked ? "full" : "reduced")
          }
        />
      </div>
    </section>
  );
}

export default function AccountPage() {
  const {
    session,
    recovering,
    callbackError,
    clearCallbackError,
    finishRecovery,
  } = useAuth();
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
    clearCallbackError();
    try {
      await action();
    } catch (error) {
      setNotice(error instanceof AuthLoginError ? error.message : failure);
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
      className="mx-auto max-w-xl space-y-6 px-4 py-12"
    >
      <h1 className="font-display text-3xl font-semibold">Tài khoản</h1>
      {(notice || callbackError) && (
        <output className="block rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground">
          {notice || callbackError}
        </output>
      )}
      {!supabase ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-subtle">
          Bạn có thể học và lưu tiến độ trên máy. Bản này chưa cấu hình dịch vụ
          tài khoản.
        </p>
      ) : session ? (
        <div className="space-y-4 rounded-xl border bg-card p-5 shadow-subtle">
          <p>
            Đã đăng nhập: <strong>{session.user.email}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            {session.user.email_confirmed_at
              ? "Tiến độ lưu trên máy và tự đồng bộ khi có mạng."
              : "Hãy xác nhận email để đồng bộ tiến độ."}
          </p>
          {recovering || changePassword ? (
            <form onSubmit={submit} className="grid gap-3">
              <label
                htmlFor="auth-password"
                className="flex flex-col gap-1.5 text-sm font-medium text-foreground"
              >
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
            <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm">
                Bạn sẽ mất tài khoản và toàn bộ tiến độ đã lưu. Không thể hoàn
                tác.
              </p>
              <div className="flex flex-wrap gap-2">
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
                </Button>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => setConfirmDelete(null)}
                >
                  Huỷ
                </Button>
              </div>
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
        </div>
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
                  clearCallbackError();
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
            className="grid gap-4 rounded-xl border bg-card p-5 shadow-subtle"
          >
            {mode === "login" ? (
              <label
                htmlFor="auth-identifier"
                className="flex flex-col gap-1.5 text-sm font-medium text-foreground"
              >
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
              <label
                htmlFor="auth-email"
                className="flex flex-col gap-1.5 text-sm font-medium text-foreground"
              >
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
              <label
                htmlFor="auth-username"
                className="flex flex-col gap-1.5 text-sm font-medium text-foreground"
              >
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
              <label
                htmlFor="auth-password"
                className="flex flex-col gap-1.5 text-sm font-medium text-foreground"
              >
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

      <MotionSettingsCard />
    </section>
  );
}
