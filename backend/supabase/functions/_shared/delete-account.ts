import { checkMethod, type Config, json, upstream } from "./http.ts";

export async function deleteAccount(
  request: Request,
  config: Config,
  fetcher = fetch,
): Promise<Response> {
  const methodError = checkMethod(request);
  if (methodError) return methodError;
  const token = /^Bearer ([^\s,]{1,8192})$/i.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
  const unauthorized = () => json({ error: "unauthorized" }, 401);
  const failure = () => json({ error: "delete_failed" }, 503);
  if (!token) return unauthorized();

  try {
    const verified = await upstream(
      fetcher,
      `${config.url}/auth/v1/user`,
      config.anonKey,
      "GET",
      token,
    );
    if (verified.status === 401 || verified.status === 403) {
      return unauthorized();
    }
    if (!verified.ok) return failure();
    const user = await verified.json();
    if (
      user?.role !== "authenticated" || user.is_anonymous === true ||
      typeof user.id !== "string" ||
      user.id !== request.headers.get("x-confirmed-owner") ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(user.id)
    ) return unauthorized();

    const deleted = await upstream(
      fetcher,
      `${config.url}/auth/v1/admin/users/${user.id}`,
      config.serviceKey,
      "DELETE",
      config.serviceKey,
      { should_soft_delete: false },
    );
    return deleted.ok ? json({ deleted: true }) : failure();
  } catch {
    return failure();
  }
}
