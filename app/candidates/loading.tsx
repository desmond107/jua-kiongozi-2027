import { CandidateCardSkeleton } from '@/frontend/components/candidates/candidate-card'
import { PageContainer, Skeleton } from '@/frontend/components/ui/primitives'

/** Matches the real page's layout so nothing shifts when the data lands. */
export default function CandidatesLoading() {
  return (
    <PageContainer className="py-16">
      <div className="space-y-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <Skeleton className="mt-8 h-12 w-full rounded-2xl" />

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <CandidateCardSkeleton key={index} />
        ))}
      </div>
    </PageContainer>
  )
}
