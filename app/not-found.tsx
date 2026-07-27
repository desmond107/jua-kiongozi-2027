import Link from 'next/link'
import { Button } from '@/frontend/components/ui/button'
import { PageContainer } from '@/frontend/components/ui/primitives'

export default function NotFound() {
  return (
    <PageContainer className="py-24">
      <div className="glass mx-auto max-w-lg space-y-5 p-8 text-center">
        <p className="font-display text-6xl font-semibold text-white/10">404</p>
        <h1 className="font-display text-2xl font-semibold text-bone">Page not found</h1>
        <p className="text-sm leading-relaxed text-bone-muted">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="flex flex-col justify-center gap-2.5 sm:flex-row">
          <Button asChild variant="primary" size="sm">
            <Link href="/candidates">View candidates</Link>
          </Button>
          <Button asChild variant="glass" size="sm">
            <Link href="/transparency">Live results</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  )
}
