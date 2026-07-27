import 'server-only'
import type { Candidate } from '@prisma/client'
import { prisma } from '@/backend/db/client'

export const candidateRepository = {
  findAll(): Promise<Candidate[]> {
    return prisma.candidate.findMany({ orderBy: { orderIndex: 'asc' } })
  },

  findById(id: string): Promise<Candidate | null> {
    return prisma.candidate.findUnique({ where: { id } })
  },

  findBySlug(slug: string): Promise<Candidate | null> {
    return prisma.candidate.findUnique({ where: { slug } })
  },

  /** Slugs only — used to pre-render candidate profile pages at build time. */
  async allSlugs(): Promise<string[]> {
    const rows = await prisma.candidate.findMany({ select: { slug: true } })
    return rows.map((row) => row.slug)
  },

  count(): Promise<number> {
    return prisma.candidate.count()
  },
}
