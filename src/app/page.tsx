import { AppShell } from "@/components/app/AppShell";
import { AuthProvider } from "@/lib/auth-client";

export default function Page() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
