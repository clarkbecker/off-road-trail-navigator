async function inspectTrail8() {
  const query = `[out:json][timeout:30];
(
  way(21447179);
  >;
);
out meta;
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
  const way = data.elements.find(e => e.type === 'way');
  console.log('Way 21447179 tags:', way?.tags);
  console.log('Node count:', way?.nodes?.length);
  const nodes = data.elements.filter(e => e.type === 'node');
  if (nodes.length > 0) {
    console.log(`First node: [${nodes[0].lat}, ${nodes[0].lon}], Last node: [${nodes[nodes.length-1].lat}, ${nodes[nodes.length-1].lon}]`);
  }
}
inspectTrail8();
