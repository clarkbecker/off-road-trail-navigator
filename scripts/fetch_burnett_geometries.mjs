async function fetchGeoms() {
  const wayIds = [
    21447179, // Trail 8 East
    21450086, // Swiss Fire Lane (Trail 8 West)
    21448722, // Briggs Lake Rd (Trail 8 West)
    21449259, // Carters Bridge Rd (Trail 8 West)
    21450526, // Frog Lake Rd (Trail 7)
    1058738256, // Frog Lake Rd (Trail 7)
    21450441, // Webb Creek Dr (Trail 7B)
    1431825555, // Trail 45 N
    1431825559, // Trail 45 N
    1431825562, // Trail 45 N
    1478698397, // Trail 151
    21444059, // Trail 41 N
  ];

  const query = `[out:json][timeout:30];
(
  ${wayIds.map(id => `way(${id});`).join('\n  ')}
);
out geom;
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
  console.log('Retrieved ways with geom:', data.elements?.length || 0);
  for (const w of data.elements || []) {
    console.log(`Way ${w.id} (${w.tags?.name || w.tags?.ref}): ${w.geometry?.length} points`);
  }
}

fetchGeoms();
