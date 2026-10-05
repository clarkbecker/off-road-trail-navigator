async function inspectDanburyToSwiss() {
  // Danbury is around lat 46.005, lon -92.372
  // Swiss Fire Lane starts around lat 46.005, lon -92.332
  // Let's search between lon -92.38 and -92.30, lat 45.99 and 46.03
  const query = `[out:json][timeout:35];
(
  way["highway"](45.99,-92.385,46.03,-92.30);
);
out tags center;
`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TrailNavDanbury/1.0' },
    body: 'data=' + encodeURIComponent(query),
  });
  const text = await res.text();
  if (!text.startsWith('{')) {
    console.log('Error/busy:', text.slice(0, 300));
    return;
  }
  const data = JSON.parse(text);
  console.log(`Found ${data.elements?.length} ways between Danbury and Swiss Fire Lane.`);
  const named = data.elements.filter(e => e.tags.name || e.tags.ref);
  for (const w of named) {
    console.log(`Way ${w.id}: "${w.tags.name}" (ref: ${w.tags.ref}, highway: ${w.tags.highway}) at lat ${w.center?.lat}, lon ${w.center?.lon}`);
  }
}

inspectDanburyToSwiss().catch(console.error);
