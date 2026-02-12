# Pixel Art Collection — Trait System

## Pipeline
1. **Vertex AI** generates chunky low-res pixel art (64×64 style, blocky pixels)
2. **Code** downscales to 40×40 grid → threshold to 2 colors
3. Output as PNG/SVG/raw bytes (200 bytes per face)

## Colors
- Background: `#07181f` (dark blue-black)
- Character: `#dff8d1` (pale mint green)
- (Or swapped — TBD)

## Rules
- Always front facing (facing south to camera)
- Upper body visible (face + shoulders)
- Prompt style: "Low resolution pixel art portrait, 64x64 pixels, chunky blocky pixels, very pixelated, 1-bit black and white, white background, front facing, retro game boy style, no anti-aliasing, no smoothing"

---

## Traits

### Hair (20)
1. Spiky mohawk
2. Slicked back
3. Afro
4. Buzz cut / bald
5. Long flowing
6. Messy curly
7. Ponytail
8. Dreadlocks
9. Bowl cut
10. Mullet
11. Cornrows
12. Box braids
13. Flat top
14. Twist out
15. Bantu knots
16. Jheri curl
17. Finger waves
18. Locs (thick)
19. Fade with waves
20. Silk press (straight long)

### Headwear (10)
1. Beanie
2. Baseball cap (forward)
3. Baseball cap (backwards)
4. Fedora
5. Cowboy hat
6. Bandana/headband
7. Hood up
8. Crown
9. Durag
10. None

### Eyewear (6)
1. Aviator sunglasses
2. Round glasses
3. Square glasses
4. Eyepatch
5. Visor
6. None

### Facial Hair (5)
1. Full beard
2. Goatee
3. Mustache
4. Stubble
5. Clean shaven

### Accessories (7)
1. Chain necklace
2. Hoop earrings
3. Stud earrings
4. Nose piercing
5. Headphones around neck
6. Scarf
7. None

### Clothing (10)
1. Leather jacket
2. Hoodie
3. Suit jacket + tie
4. Denim jacket
5. Tank top
6. Turtleneck
7. Oversized t-shirt
8. Varsity jacket
9. Military jacket
10. Fur coat

### Gender/Build (10)
1. Male slim
2. Male stocky/muscular
3. Male fat
4. Male skinny
5. Female slim
6. Female curvy
7. Female fat
8. Female skinny
9. Old man
10. Old woman

---

## Possible Combinations
20 × 10 × 6 × 5 × 7 × 10 × 10 = **4,200,000**

## Test Files
- `/tmp/pixelart/` — high-res Vertex originals
- `/tmp/lowres/` — chunky pixel art originals + 40×40 conversions
- `/tmp/grid40/` — 40×40 conversions
- `/tmp/custom-color/` — #07181f + #dff8d1 tests
- `/tmp/swap-color/` — swapped color tests
