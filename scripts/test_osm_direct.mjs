async function testOSMWay() {
  const wayId = 21450086;
  const url = `https://api.openstreetmap.org/api/0.6/way/${wayId}/full.json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'TrailNavDanbury/1.0' } });
  const data = await res.json();
  console.log('Way elements:', data.elements?.length);
  const way = data.elements?.find(e => e.type === 'way');
  console.log('Way tags:', way?.tags);
  const nodeMap = new Map();
  for (const el of data.elements) {
    if (el.type === 'node') nodeMap.set(el.id, [el.lon, el.lat]);
  }
  const coords = way?.nodes?.map(nId => nodeMap.get(nId)).filter(Boolean);
  console.log(`Coords count: ${coords?.length}, first coord:`, coords?.[0]);
}
testOSMWay();
