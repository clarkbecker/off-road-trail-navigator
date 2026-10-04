async function queryTigerTrails() {
  const query = `[out:json][timeout:25];
(
  way["name"~"Snomobile|Snowmobile|ATV",i](45.65,-92.85,46.16,-92.05);
  way["tiger:cfcc"="A41"](45.65,-92.85,46.16,-92.05);
);
out body;
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
  console.log('Total matches:', data.elements?.length || 0);
  for (const el of data.elements || []) {
    console.log(`way ${el.id} | name: "${el.tags?.name}" | ref: "${el.tags?.ref}" | atv: "${el.tags?.atv}"`);
  }
}

queryTigerTrails();
