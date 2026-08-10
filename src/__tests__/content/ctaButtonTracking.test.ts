import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Paragraph from '@tiptap/extension-paragraph';

// Mirrors the CTA-button markup inserted by ArticleEditor's "แทรกปุ่มลิงก์ในอีเมล" action.
const CTA_HTML =
  '<p style="text-align:center;margin:24px 0;"><a href="https://example.com/promo" style="display:inline-block;background:#3b82f6;color:#ffffff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">อ่านต่อ</a></p>';

// Mirror the StyledLink / StyledParagraph extensions used in ArticleEditor — both
// preserve inline `style` so the CTA button look and its centering survive getHTML().
const keepStyleAttribute = {
  style: {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute('style'),
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.style ? { style: attributes.style } : {},
  },
};

const StyledLink = Link.extend({
  addAttributes() {
    return { ...this.parent?.(), ...keepStyleAttribute };
  },
});

const StyledParagraph = Paragraph.extend({
  addAttributes() {
    return { ...this.parent?.(), ...keepStyleAttribute };
  },
});

function makeEditor() {
  return new Editor({
    extensions: [
      StarterKit.configure({ link: false, underline: false, paragraph: false } as never),
      StyledParagraph,
      Underline,
      StyledLink.configure({ openOnClick: false }),
    ],
    content: '',
  });
}

describe('CTA button insertion preserves email-button styling', () => {
  it('keeps the inline style on the inserted <a> so it renders as a button when sent', () => {
    const editor = makeEditor();
    editor.commands.insertContent(CTA_HTML);
    const html = editor.getHTML();

    // href must survive (required for click tracking to wrap it)
    expect(html).toContain('https://example.com/promo');
    // The inline button styling must survive — otherwise the email shows a plain link.
    // (jsdom normalizes the hex color to rgb(), so assert on the structural button props.)
    expect(html).toMatch(/style="[^"]*display:\s*inline-block/);
    expect(html).toMatch(/style="[^"]*padding:\s*12px 32px/);
    // The wrapping paragraph keeps its centering
    expect(html).toMatch(/<p[^>]*style="[^"]*text-align:\s*center/);
    editor.destroy();
  });
});
