# Large-graph rendering

The camera still uses a single requestAnimationFrame transform. React updates the render window only when its 240-screen-pixel overscan is exhausted, the viewport changes size, or a zoom detail threshold is crossed.

- At 65% and above: complete cards, symbols, and node animations.
- From 35% to 65%: circles and symbols, without unreadable text cards.
- Below 35%: circles and links only.
- All levels retain click-to-inspect and middle-button subtree dragging.
- Offscreen nodes are omitted from the DOM; intersecting links remain visible even when both endpoints are outside the viewport.
- Static links are batched into three SVG paths (chain, Fork, yellow Agent creation).
- Data, token totals, saved positions and evolution state are independent of rendering visibility. Zooming does not discard history or follow new nodes.

Tests use deterministic geometry and jsdom interactions, not GPU frame-rate measurements. Browser performance still depends on the host and graph size.
