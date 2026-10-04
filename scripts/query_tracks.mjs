async function queryForestTracks() {
  const query = `[out:json][timeout:60];
(
  way["highway"~"track|path"](45.85,-92.35,46.10,-91.95);
  way["tracktype"](45.85,-92.35,46.10,-91.95);
  way["motor_vehicle"](45.85,-92.35,46.10,-91.95);
  way["atv"](45.85,-92.35,46.10,-91.95);
);
out tags 100;
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
  console.log('Tracks/paths found in Burnett Forest area:', data.elements?.length);
  const named = (data.elements || []).filter(e => e.tags?.name || e.tags?.ref || e.tags?.atv);
  console.log(`Named or ref or atv tagged: ${named.length}`);
  for (const el of named.slice(0, 30)) {
    console.log(`id: ${el.id} | name: ${el.tags.name} | ref: ${el.tags.ref} | atv: ${el.tags.atv} | highway: ${el.tags.highway}`);
  }
}
queryForestTracks();
