async function inspectSunnysideRoadArea() {
  // Bounding box around Danbury / Webb Lake / Sunnyside Rd
  // 45.95 to 46.05 lat, -92.20 to -92.00 lon
  const query = `[out:json][timeout:35];
(
  way["highway"~"track|path|unclassified|service"](45.94,-92.20,46.06,-92.00);
  way["atv"](45.94,-92.20,46.06,-92.00);
  way["name"](45.94,-92.20,46.06,-92.00);
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

  const text = await res.text();
  if (!text.startsWith('{')) {
    console.error('Overpass response error:', text.slice(0, 300));
    return;
  }

  const data = JSON.parse(text);
  console.log(`Found ${data.elements?.length || 0} features around Sunnyside Rd area.`);
  
  const namedFeatures = (data.elements || []).filter(e => e.tags?.name || e.tags?.ref || e.tags?.atv);
  console.log(`Named / ATV features (${namedFeatures.length}):`);
  for (const f of namedFeatures.slice(0, 35)) {
    console.log(`- ${f.tags.name || 'Unnamed'} (ref: ${f.tags.ref || 'none'}, highway: ${f.tags.highway}, atv: ${f.tags.atv}) at ${f.center?.lat}, ${f.center?.lon}`);
  }
}

inspectSunnysideRoadArea().catch(console.error);
