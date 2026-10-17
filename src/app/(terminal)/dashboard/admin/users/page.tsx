// Accounts: every sign-in on the platform, with operator promotion and
// suspension (both gated to non-self, write-confirmed by the API layer).
import { UsersConsole } from '@/components/custom/admin/users-console';

export default function AdminUsersPage() {
  return <UsersConsole />;
}
