import { useRef, useState, useEffect, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  children: ReactNode;
  className?: string;
}

export default function ScrollableKanban({ children, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const check = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
    };

    container.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();

    const mo = new MutationObserver(check);
    mo.observe(container, { childList: true, subtree: true });

    return () => {
      container.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      mo.disconnect();
    };
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    const container = containerRef.current;
    if (!container) return;
    const amount = container.clientWidth * 0.6;
    container.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div className="relative group">
      {canScrollLeft && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-background to-transparent z-10 rounded-l-lg" />
      )}
      {canScrollRight && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-background to-transparent z-10 rounded-r-lg" />
      )}

      {canScrollLeft && (
        <Button
          variant="outline"
          size="icon"
          className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full shadow hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => scroll('left')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {canScrollRight && (
        <Button
          variant="outline"
          size="icon"
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full shadow hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => scroll('right')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      <div
        ref={containerRef}
        className={cn(
          'flex overflow-x-auto gap-4 pb-2',
          'snap-x snap-mandatory md:snap-none',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
