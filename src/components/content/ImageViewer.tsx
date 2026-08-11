import { X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ImageViewerProps {
  src: string;
  alt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImageViewer({ src, alt, open, onOpenChange }: ImageViewerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* sm:p-0 / sm:gap-0 override the base dialog's sm:p-6 gap-4 so the shell hugs the image.
          The :not() keeps our own close button from being caught by the Radix-close hide rule. */}
      <DialogContent className="sm:w-fit max-w-[95vw] max-h-[95vh] p-0 sm:p-0 gap-0 sm:gap-0 border-0 bg-transparent shadow-none [&>button:not([data-viewer-close])]:hidden">
        {/* Custom close button */}
        <button
          type="button"
          data-viewer-close
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-50 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        {/* No min-height: the container hugs the image instead of forcing a tall box */}
        <div
          className="flex items-center justify-center max-w-[90vw] max-h-[90vh] cursor-zoom-out"
          onClick={() => onOpenChange(false)}
        >
          <img
            src={src}
            alt={alt ?? ''}
            className={cn('max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded-lg')}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
