import { PageContainer, Skeleton } from '@/frontend/components/ui/primitives'

export default function TransparencyLoading() {
  return (
    <PageContainer className="py-16">
      <div className="space-y-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[110px] rounded-3xl" />
        ))}
      </div>

      <div className="mt-8 space-y-6">
        <Skeleton className="h-[500px] rounded-3xl" />
        <Skeleton className="h-[500px] rounded-3xl" />
      </div>
    </PageContainer>
  )
}
