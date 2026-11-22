const url = process.env.VITE_SUPABASE_URL;
const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function isAnonKey(key) {
  if (/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key)) return true;
  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(key))
    return false;
  try {
    return (
      JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"))
        .role === "anon"
    );
  } catch {
    return false;
  }
}

if (
  !/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(url ?? "") ||
  !isAnonKey(publicKey ?? "")
) {
  throw new Error(
    "Configure a hosted Supabase URL and a publishable/anon key for native release builds.",
  );
}
