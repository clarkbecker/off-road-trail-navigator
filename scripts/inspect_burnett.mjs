async function inspectDetails() {
  const query = `[out:json][timeout:45];
(
  way(440076655);
  way(440076663);
  way(440083594);
  way(440083596);
  way(491695476);
  way(491697481);
  way(727824881);
  way(727827109);
  way(727827110);
  way(729143305);
  way(1556636173);
  way(1556636174);
  way["ref"~"7|8"](45.7,-92.7,46.15,-92.0);
  relation["route"~"atv|snowmobile"](45.7,-92.7,46.15,-92.0);
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
  const data = await res.json();
  console.log('Results count:', data.elements?.length);
  for (const el of data.elements || []) {
    console.log(`${el.type} ${el.id}: center=[${el.center?.lat}, ${el.center?.lon}] tags=`, el.tags);
  }
}

inspectDetails();
