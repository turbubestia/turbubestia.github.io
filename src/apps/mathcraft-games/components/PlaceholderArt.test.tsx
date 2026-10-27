// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlaceholderArt } from './PlaceholderArt';

describe('PlaceholderArt', () => {
  it('displays the logical asset name when no image source is provided', () => {
    render(<PlaceholderArt name="Hero" />);
    expect(screen.getByText('Hero')).not.toBeNull();
  });

  it('renders a static image when an asset source is provided', () => {
    render(<PlaceholderArt name="Boss" src="/boss.png" alt="Boss" />);
    const image = screen.getByRole('img', { name: 'Boss' }) as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('/boss.png');
  });
});
