# Role headshots

Drop the six pixel-art headshots in this directory, named by role key:

```
ceo.png   cfo.png   cto.png   cmo.png   cro.png   cs.png
```

They're picked up automatically (no code change) and shown circular-masked at
small sizes in the role cards, the HUD, and the victory screen. Any missing
file falls back to that role's emoji. PNGs are inlined into the bundle at
build time, so keep them reasonably small (roughly 128–256px square is plenty
for the display sizes used).
