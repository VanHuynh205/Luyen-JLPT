import { serve } from "../_shared/http.ts";
import { resolveLogin } from "../_shared/resolve-login.ts";

serve(resolveLogin);
