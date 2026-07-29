'use client'

import { FileSpreadsheet, FileText } from 'lucide-react'
import type { ExportDataset } from '@/backend/validators'
import { adminExportUrl } from '@/frontend/lib/api'

/**
 * CSV and Excel download links for one dataset.
 *
 * Anchors with `download`, not fetch-then-blob: the browser handles
 * Content-Disposition, shows real download progress, streams straight to disk
 * instead of through memory, and carries the session cookie without any work
 * here. A blob approach would buy nothing and would break on a large export.
 */
export function ExportButtons({
  dataset,
  county,
  note,
}: {
  dataset: ExportDataset
  county?: string
  note?: string
}) {
  const base =
    'inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-sm text-bone-muted transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-bone'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={adminExportUrl(dataset, 'csv', county)} download className={base}>
        <FileText className="h-4 w-4" aria-hidden />
        CSV
      </a>
      <a href={adminExportUrl(dataset, 'xlsx', county)} download className={base}>
        <FileSpreadsheet className="h-4 w-4" aria-hidden />
        Excel
      </a>
      {note ? <span className="text-xs text-bone-dim">{note}</span> : null}
    </div>
  )
}
