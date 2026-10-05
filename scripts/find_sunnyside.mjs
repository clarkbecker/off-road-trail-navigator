async function findSunnysideRd() {
  const query = `[out:json][timeout:25];
way["name"~"Sunnyside",i](45.85,-92.35,46.15,-91.95);
out tags center;
`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'TrailNavDanbury/1.0 (clark@trailnav.local)'
    },
    body: 'data=' + encodeURIComponent(query),
  });
  const text = await res.text();
  if (!text.startsWith('{')) {
    console.log('Non-JSON response:', text.slice(0, 300));
    return;
  }
  const data = JSON.parse(text);
  console.log('Sunnyside ways:', data.elements?.map(e => ({ id: e.id, name: e.tags.name, lat: e.center.lat, lon: e.center.lon })));
}
findSunnysideRd();
