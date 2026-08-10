export const PLATFORM_COLORS: Record<string, { bg: string; text: string; border: string; filterBg: string; filterText: string }> = {
  facebook:  { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe', filterBg: '#eef2ff', filterText: '#4338ca' },
  instagram: { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8', filterBg: '#fdf2f8', filterText: '#be185d' },
  tiktok:    { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1', filterBg: '#f1f5f9', filterText: '#334155' },
  lineoa:    { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', filterBg: '#f0fdf4', filterText: '#15803d' },
  linkedin:  { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd', filterBg: '#f0f9ff', filterText: '#0369a1' },
  twitter:   { bg: '#fafafa', text: '#52525b', border: '#e4e4e7', filterBg: '#fafafa', filterText: '#52525b' },
  wordpress: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', filterBg: '#eff6ff', filterText: '#1d4ed8' },
  wix:       { bg: '#fdf4ff', text: '#9333ea', border: '#f5d0fe', filterBg: '#fdf4ff', filterText: '#9333ea' },
  lotusdomino: { bg: '#fffbeb', text: '#92400e', border: '#fde68a', filterBg: '#fffbeb', filterText: '#92400e' },
  default:     { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb', filterBg: '#f3f4f6', filterText: '#374151' },
};

export function getPlatformColors(platform: string) {
  return PLATFORM_COLORS[platform] ?? PLATFORM_COLORS.default;
}

export const PLATFORM_LABELS: Record<string, string> = {
  facebook:  'Facebook',
  instagram: 'Instagram',
  tiktok:    'TikTok',
  lineoa:    'LINE OA',
  linkedin:  'LinkedIn',
  twitter:   'X (Twitter)',
  wordpress: 'WordPress',
  wix:       'Wix',
};
