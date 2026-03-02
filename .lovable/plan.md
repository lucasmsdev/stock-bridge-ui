
# Fix Infinite Marketplace Carousel

## Problem
The marquee animation is not working. The logos appear static. After browser inspection, the items render (28 children = 7 marketplaces x 4) but the CSS animation isn't producing visible movement.

## Root Cause
The combination of `style={{ width: 'max-content' }}` with `overflow: hidden` on the parent creates a situation where the browser may not compute the animation properly. The `translateX(-50%)` percentage is relative to the element's own width, but the flex container may not be calculating its width correctly when constrained.

## Solution - Complete Rewrite of Marquee Section

Replace the current approach with a proven infinite marquee pattern using two side-by-side divs that each contain the full set of items, both animated together.

### File: `src/pages/Landing.tsx` (lines ~564-586)

**Changes:**
1. Replace single `animate-marquee` div with TWO identical `animate-marquee` divs inside the `marquee-container`
2. Each div contains only one copy of `marketplaces` (not 4x)
3. Both divs are placed in a wrapper with `display: flex` and `width: fit-content`
4. Remove the inline `style={{ width: 'max-content' }}` -- instead, the wrapper flex handles this

Structure:
```text
marquee-container (overflow: hidden, w-full)
  └── wrapper div (flex, animate-marquee)
        ├── set div (flex, gap-8, shrink-0)
        │     └── 7 marketplace cards
        └── set div (flex, gap-8, shrink-0, aria-hidden)
              └── 7 marketplace cards (duplicate)
```

### File: `src/index.css`

**Changes to `.animate-marquee`:**
- Keep `display: flex` and `animation: marquee 30s linear infinite`
- Add `min-width: 100%` -- this is key: it forces the flex container to stretch beyond the viewport
- The two children (each containing all items) sit side by side

The animation `translateX(-50%)` moves the entire wrapper left by exactly half (one full set of items), creating a seamless loop since the second set is identical to the first.

### Why this works
The classic infinite marquee pattern requires:
1. Content duplicated exactly once (2 copies total)
2. A flex wrapper containing both copies, animated with `translateX(-50%)`
3. The wrapper must be wider than the viewport (guaranteed by having 2 sets of items)
4. `overflow: hidden` on the parent clips the overflow

This is the standard approach used by production marquees.
