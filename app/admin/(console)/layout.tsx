import { redirect } from 'next/navigation'
import { getAdminSession } from '@/backend/services/adminSession.service'
import { AdminChrome } from '@/frontend/components/admin/admin-chrome'

/**
 * The guard for every authenticated admin page.
 *
 * In the App Router a layout renders before the pages nested inside it, so no
 * child page's data fetching begins until this check has passed. The route
 * group `(console)` keeps the login page — a sibling, not a child — outside it.
 *
 * This protects PAGES. Every admin API route repeats the check for itself,
 * because an endpoint is reachable directly and a layout has no say in that.
 */

export const dynamic = 'force-dynamic'

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  return <AdminChrome username={session.username}>{children}</AdminChrome>
}
