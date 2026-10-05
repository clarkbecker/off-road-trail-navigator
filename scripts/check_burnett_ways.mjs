const wayIds = [
  21450086, 21449259, 21448722, // Trail 8 West (Swiss Fire Ln, Carters Bridge, Briggs Lake)
  21447179, // Trail 8 East
  21450526, 1058738256, // Trail 7 (Frog Lake Rd, Namekagon)
  21450441, // Trail 7B (Webb Creek)
  1431825555, 1431825559, 1431825562, // Trail 45 North
  21444059, // Trail 41 North
  1478698397 // Trail 151
];

async function checkWays() {
  for (const wId of wayIds) {
    try {
      const url = `https://api.openstreetmap.org/api/0.6/way/${wId}.json`;
      const res = await fetch(url, { headers: { 'User-Agent': 'TrailNavDanbury/1.0' } });
      const data = await res.json();
      const way = data.elements?.[0];
      console.log(`Way ${wId}: name="${way?.tags?.name}", ref="${way?.tags?.ref}", highway="${way?.tags?.highway}"`);
    } catch (e) {
      console.error(`Error on way ${wId}:`, e.message);
    }
  }
}

checkWays();
