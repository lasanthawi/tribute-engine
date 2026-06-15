import { getCategoryMeta } from '@/lib/categories'

export default function CategoryBadge({
  category,
  size = 32,
}: {
  category: string | null | undefined
  size?: number
}) {
  const meta = getCategoryMeta(category)
  return (
    <span
      className={`category-badge ${meta.className}`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      title={meta.label}
    >
      {meta.icon}
    </span>
  )
}
