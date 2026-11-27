import { describe, expect, it } from 'vitest';
import { esc, safeUrl, storyPage } from '../src/share/page';

const story = {
  id: 'a'.repeat(32), title: 'Sensex <rises> "300" & more', summary: 'The Sensex rose 300 points.', source: 'Mint',
  url: 'https://www.livemint.com/x', category: 'markets', publishedAt: Date.parse('2026-11-27T05:00:00Z'),
  image: { url: 'https://images.unsplash.com/p.jpg', photographer: 'Asha', providerName: 'Unsplash' },
};

describe('shared story page', () => {
  it('escapes text and sets link-preview tags', () => {
    const html = storyPage(story, 'https://x.dev/s/aaa', 'https://x.dev');
    expect(html).toContain('<meta property="og:title" content="Sensex &lt;rises&gt; &quot;300&quot; &amp; more">');
    expect(html).toContain('<meta property="og:image" content="https://images.unsplash.com/p.jpg">');
    expect(html).toContain('href="https://www.livemint.com/x"');
    expect(html).not.toContain('<rises>');
  });
  it('never links to non-http URLs', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('#');
    expect(storyPage({ ...story, url: 'javascript:alert(1)' }, 'p', 'o')).not.toContain('javascript:');
    expect(esc(`<'"&>`)).toBe('&lt;&#39;&quot;&amp;&gt;');
  });
});
