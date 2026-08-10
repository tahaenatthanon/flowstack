import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

function fallbackCopy(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  Object.assign(ta.style, {
    position: 'fixed', top: '-1px', left: '-1px',
    width: '1px', height: '1px',
  });
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } catch {}
  document.body.removeChild(ta);
}

export function copyToClipboard(text: string) {
  // On HTTP (non-secure context), Clipboard API rejects asynchronously,
  // which loses the user gesture needed by execCommand fallback.
  if (!window.isSecureContext) {
    fallbackCopy(text);
    return;
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

export default function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs px-2 shrink-0"
      onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {label}
    </Button>
  );
}
