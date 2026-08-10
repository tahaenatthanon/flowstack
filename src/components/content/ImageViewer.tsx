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
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-transparent shadow-none [&>button]:hidden">
        {/* Custom close button */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-50 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <div
          className="flex items-center justify-center w-full h-full min-h-[60vh] cursor-zoom-out"
          onClick={() => onOpenChange(false)}
        >
          <img
            src={src}
            alt={alt ?? ''}
            className={cn('max-w-full max-h-[90vh] object-contain rounded-lg')}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
