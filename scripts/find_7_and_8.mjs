async function findTrail7And8Ways() {
  const query = `[out:json][timeout:30];
(
  way["name"~"Swiss Fire Lane|Carters Bridge|Briggs Lake|Frog Lake",i](45.8,-92.4,46.15,-92.0);
  way["ref"="8"](45.8,-92.4,46.15,-92.0);
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
    console.log('Error text:', text.slice(0, 500));
    return;
  }
  const data = JSON.parse(text);
  console.log('Matches:', data.elements?.length || 0);
  for (const el of data.elements || []) {
    console.log(`id: ${el.id} | name: "${el.tags?.name}" | ref: "${el.tags?.ref}" | atv: "${el.tags?.atv}" | highway: "${el.tags?.highway}" | lat: ${el.center?.lat}, lon: ${el.center?.lon}`);
  }
}

findTrail7And8Ways();
