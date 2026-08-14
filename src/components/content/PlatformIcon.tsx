import { cn } from '@/lib/utils';

// Minimal SVG brand icons for each social/content platform
// Using simple paths — no external deps needed

interface Props {
  platform: string;
  className?: string;
  size?: number;
}

export function PlatformIcon({ platform, className, size = 12 }: Props) {
  const cls = cn('shrink-0 inline-block', className);
  const s = size;
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (platform) {
    case 'facebook':
      return (
        <svg className={cls} width={s} height={s} viewBox="0 0 24 24" {...stroke}>
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
        </svg>
      );
    case 'instagram':
      return (
        <svg className={cls} width={s} height={s} viewBox="0 0 24 24" {...stroke}>
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
          <circle cx="12" cy="12" r="4"/>
          <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none"/>
        </svg>
      );
    case 'tiktok':
      return (
        <svg className={cls} width={s} height={s} viewBox="0 0 24 24" {...stroke}>
          <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>
        </svg>
      );
    case 'lineoa':
      return (
        <svg className={cls} width={s} height={s} viewBox="0 0 24 24" {...stroke}>
          <path d="M21 11.5C21 7.36 16.97 4 12 4S3 7.36 3 11.5c0 3.63 3.22 6.68 7.56 7.26.3.06.7.2.8.45.09.23.06.58.03.82l-.13.78c-.04.23-.18.9.79.49 1-.41 5.37-3.16 7.33-5.41A6.5 6.5 0 0 0 21 11.5z"/>
          <path d="M8.5 13H7V9.5" strokeLinecap="round"/>
          <path d="M10 9.5v3.5" strokeLinecap="round"/>
          <path d="M11.5 9.5h1.5a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5h-1.5v.5h1.5a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5h-1.5"/>
          <path d="M15.5 9.5h1.5" strokeLinecap="round"/>
          <path d="M16.25 9.5v3.5" strokeLinecap="round"/>
        </svg>
      );
    case 'linkedin':
      return (
        <svg className={cls} width={s} height={s} viewBox="0 0 24 24" {...stroke}>
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
          <rect x="2" y="9" width="4" height="12"/>
          <circle cx="4" cy="4" r="2"/>
        </svg>
      );
    case 'twitter':
      return (
        <svg className={cls} width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
    case 'wordpress':
      return (
        <svg className={cls} width={s} height={s} viewBox="0 0 24 24" {...stroke}>
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      );
    case 'wix':
      return (
        <svg className={cls} width={s} height={s} viewBox="0 0 24 24" {...stroke}>
          <polyline points="3 7 7 17 10 11 13 17 17 7"/>
          <line x1="20" y1="7" x2="20" y2="17"/>
          <line x1="18" y1="7" x2="22" y2="7"/>
          <line x1="18" y1="17" x2="22" y2="17"/>
        </svg>
      );
    case 'custom':
      return (
        <svg className={cls} width={s} height={s} viewBox="0 0 24 24" {...stroke}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      );
    case 'lotusdomino':
      return (
        <svg className={cls} width={s} height={s} viewBox="0 0 24 24" {...stroke}>
          <ellipse cx="12" cy="12" rx="10" ry="6"/>
          <ellipse cx="12" cy="12" rx="10" ry="6" transform="rotate(60 12 12)"/>
          <ellipse cx="12" cy="12" rx="10" ry="6" transform="rotate(120 12 12)"/>
        </svg>
      );
    case 'youtube':
      return (
        <svg className={cls} width={s} height={s} viewBox="0 0 24 24" {...stroke}>
          <rect x="2" y="5" width="20" height="14" rx="4" ry="4"/>
          <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none"/>
        </svg>
      );
    default:
      return (
        <svg className={cls} width={s} height={s} viewBox="0 0 24 24" {...stroke}>
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      );
  }
}

