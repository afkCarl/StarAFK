import { AuthGate } from "@/components/auth/auth-gate";
import WerwolfApp from "@/components/werwolf/werwolf-app";

export default function HomePage() {
  return (
    <AuthGate>
      <WerwolfApp />
    </AuthGate>
  );
}
