async function analyzeBurnettTrails() {
  const query = `[out:json][timeout:45];
(
  way["name"~"Snomobile|Snowmobile|ATV",i](45.65,-92.85,46.16,-92.05);
  way["atv"](45.65,-92.85,46.16,-92.05);
  way["tiger:cfcc"="A41"](45.65,-92.85,46.16,-92.05);
);
out tags center;
`;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'TrailNavigator/1.0 (clark@trailnav.local)',
    },
    body: 'data=' + encodeURIComponent(query),
  });
  const data = await res.json();
  const elements = data.elements || [];
  console.log(`Retrieved ${elements.length} elements.`);

  const trailsWithRef = elements.filter(e => e.tags?.ref || e.tags?.name);
  console.log(`With ref or name: ${trailsWithRef.length}`);

  const refsFound = {};
  for (const e of trailsWithRef) {
    const key = `${e.tags.ref || '(no ref)'} | ${e.tags.name || '(no name)'}`;
    refsFound[key] = (refsFound[key] || 0) + 1;
  }
  console.log('\n--- Grouped Trails in Burnett County ---');
  for (const [k, count] of Object.entries(refsFound)) {
    if (count > 1 || k.includes('7') || k.includes('8') || k.toLowerCase().includes('atv') || k.toLowerCase().includes('trail')) {
      console.log(`${k}: ${count} segments`);
    }
  }
}

analyzeBurnettTrails();
