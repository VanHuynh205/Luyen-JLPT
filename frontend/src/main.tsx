import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AccountProgress } from "./adapters/auth/AccountProgress";
import { AuthProvider } from "./adapters/auth/session";
import { ContentProvider } from "./hooks/useContent";
import "./index.css";

BigInt.prototype.toJSON = function () {
  return this.toString();
};

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ContentProvider>
        <AccountProgress>
          <App />
        </AccountProgress>
      </ContentProvider>
    </AuthProvider>
  </QueryClientProvider>,
);
