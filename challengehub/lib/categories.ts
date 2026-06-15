export interface CategoryMeta {
  icon: string
  label: string
  className: string
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  wellness: { icon: '🧘', label: 'Wellness', className: 'cat-wellness' },
  fitness: { icon: '💪', label: 'Fitness', className: 'cat-fitness' },
  finance: { icon: '💰', label: 'Finance', className: 'cat-finance' },
  learning: { icon: '📚', label: 'Learning', className: 'cat-learning' },
  digital_wellness: { icon: '🌙', label: 'Digital Detox', className: 'cat-digital_wellness' },
  creator: { icon: '🎥', label: 'Creator', className: 'cat-creator' },
  general: { icon: '🎯', label: 'General', className: 'cat-general' },
}

export function getCategoryMeta(category: string | null | undefined): CategoryMeta {
  return CATEGORY_META[category ?? 'general'] ?? CATEGORY_META.general
}
