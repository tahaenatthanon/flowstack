import DOMPurify from 'dompurify';

interface SafeHtmlProps {
  html: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export default function SafeHtml({ html, className, as: Tag = 'div' }: SafeHtmlProps) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'img', 'a', 'span', 'div',
      'blockquote', 'hr',
    ],
    ALLOWED_ATTR: ['src', 'alt', 'href', 'target', 'rel', 'class', 'style', 'width', 'height', 'colspan', 'rowspan'],
  });
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
