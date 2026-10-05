async function fetchDanburyTrail8Full() {
  const wayIds = [
    824017910, 824017911, 416775412, 1445229171, 1445229172, 926883166, // Danbury departure
    21450086, 21449259, 21448722 // Swiss Fire Lane, Carters Bridge, Briggs Lake
  ];

  let totalCoords = [];
  for (const wId of wayIds) {
    const url = `https://api.openstreetmap.org/api/0.6/way/${wId}/full.json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'TrailNavDanbury/1.0' } });
    const data = await res.json();
    const way = data.elements.find(e => e.type === 'way');
    const nodeMap = new Map();
    for (const el of data.elements) {
      if (el.type === 'node') nodeMap.set(el.id, [el.lon, el.lat]);
    }
    const coords = way.nodes.map(nId => nodeMap.get(nId)).filter(Boolean);
    console.log(`Way ${wId} (${way.tags?.name || 'Trail'}): ${coords.length} points`);
    totalCoords.push(...coords);
  }

  console.log(`\nTotal points for full Danbury Trail 8 West: ${totalCoords.length}`);
  console.log(`Starts at Danbury: [lat: ${totalCoords[0][1]}, lon: ${totalCoords[0][0]}]`);
  console.log(`Ends at Swiss/Briggs: [lat: ${totalCoords[totalCoords.length-1][1]}, lon: ${totalCoords[totalCoords.length-1][0]}]`);
}

fetchDanburyTrail8Full();
