import SuperAdmin from '@/components/super-admin'

// Dedicated login URL for discoverability/bookmarking. The component itself
// shows the login screen whenever there's no valid Super Admin session, and
// the dashboard once signed in — so this route and /super-admin both resolve
// to the correct view without a redirect dance.
export default function Page() {
  return <SuperAdmin />
}
