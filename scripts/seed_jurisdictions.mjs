import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.udwdwmxtdmplxngovxxk:33t1L$AzJpC45s@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

const JURISDICTIONS = [
  // --- FEDERAL USFS ---
  {
    id: 'usfs-chequamegon-nicolet',
    name: 'Chequamegon-Nicolet National Forest',
    agency_level: 'federal_usfs',
    state: 'WI',
    county_name: 'Multi-County',
    condition_page_url: 'https://www.fs.usda.gov/alerts/cnnf/alerts-notices',
    condition_feed_type: 'html_scrape',
    contact_phone: '715-362-1300',
    current_status: 'open',
    status_headline: 'Chequamegon-Nicolet Forest Roads & Motorized Trails Open'
  },
  {
    id: 'usfs-superior',
    name: 'Superior National Forest',
    agency_level: 'federal_usfs',
    state: 'MN',
    county_name: 'Multi-County',
    condition_page_url: 'https://www.fs.usda.gov/alerts/superior/alerts-notices',
    condition_feed_type: 'html_scrape',
    contact_phone: '218-626-4300',
    current_status: 'open',
    status_headline: 'Superior National Forest Roads & OHV Trails Open'
  },
  {
    id: 'usfs-chippewa',
    name: 'Chippewa National Forest',
    agency_level: 'federal_usfs',
    state: 'MN',
    county_name: 'Multi-County',
    condition_page_url: 'https://www.fs.usda.gov/alerts/chippewa/alerts-notices',
    condition_feed_type: 'html_scrape',
    contact_phone: '218-335-8600',
    current_status: 'open',
    status_headline: 'Chippewa Forest Roads Open'
  },
  {
    id: 'usfs-ottawa',
    name: 'Ottawa National Forest',
    agency_level: 'federal_usfs',
    state: 'MI',
    county_name: 'Multi-County (Western UP)',
    condition_page_url: 'https://www.fs.usda.gov/alerts/ottawa/alerts-notices',
    condition_feed_type: 'html_scrape',
    contact_phone: '906-932-1330',
    current_status: 'open',
    status_headline: 'Ottawa National Forest ORV Roads Open'
  },
  {
    id: 'usfs-hiawatha',
    name: 'Hiawatha National Forest',
    agency_level: 'federal_usfs',
    state: 'MI',
    county_name: 'Multi-County (Central/Eastern UP)',
    condition_page_url: 'https://www.fs.usda.gov/alerts/hiawatha/alerts-notices',
    condition_feed_type: 'html_scrape',
    contact_phone: '906-428-5800',
    current_status: 'open',
    status_headline: 'Hiawatha National Forest Trails Open'
  },
  {
    id: 'usfs-huron-manistee',
    name: 'Huron-Manistee National Forests',
    agency_level: 'federal_usfs',
    state: 'MI',
    county_name: 'Multi-County (Lower Peninsula)',
    condition_page_url: 'https://www.fs.usda.gov/alerts/hmnf/alerts-notices',
    condition_feed_type: 'html_scrape',
    contact_phone: '231-775-5023',
    current_status: 'open',
    status_headline: 'Huron-Manistee ORV Trails Open'
  },
  {
    id: 'usfs-shawnee',
    name: 'Shawnee National Forest',
    agency_level: 'federal_usfs',
    state: 'IL',
    county_name: 'Multi-County (Southern IL)',
    condition_page_url: 'https://www.fs.usda.gov/alerts/shawnee/alerts-notices',
    condition_feed_type: 'html_scrape',
    contact_phone: '618-253-7114',
    current_status: 'open',
    status_headline: 'Shawnee Forest Roads & Non-Motorized Trails Open'
  },

  // --- STATE DNRS ---
  {
    id: 'wi-dnr',
    name: 'Wisconsin Department of Natural Resources',
    agency_level: 'state_dnr',
    state: 'WI',
    county_name: 'Statewide',
    condition_page_url: 'https://dnr.wisconsin.gov/topic/parks/trailconditions',
    condition_feed_type: 'html_scrape',
    contact_phone: '1-888-936-7463',
    current_status: 'open',
    status_headline: 'Wisconsin State Rail-Trails & Multi-Use Corridors Open'
  },
  {
    id: 'mn-dnr',
    name: 'Minnesota Department of Natural Resources',
    agency_level: 'state_dnr',
    state: 'MN',
    county_name: 'Statewide',
    condition_page_url: 'https://www.dnr.state.mn.us/ohv/closures.html',
    condition_feed_type: 'html_scrape',
    contact_phone: '888-646-6367',
    current_status: 'open',
    status_headline: 'Minnesota State Forest OHV Trails Open'
  },
  {
    id: 'mi-dnr',
    name: 'Michigan Department of Natural Resources',
    agency_level: 'state_dnr',
    state: 'MI',
    county_name: 'Statewide',
    condition_page_url: 'https://www.michigan.gov/dnr/things-to-do/orv-riding/trail-closures',
    condition_feed_type: 'html_scrape',
    contact_phone: '517-284-6047',
    current_status: 'open',
    status_headline: 'Michigan Designated ORV Trails & Routes Open'
  },
  {
    id: 'ia-dnr',
    name: 'Iowa Department of Natural Resources',
    agency_level: 'state_dnr',
    state: 'IA',
    county_name: 'Statewide',
    condition_page_url: 'https://www.iowadnr.gov/Things-to-Do/Off-Highway-Vehicles',
    condition_feed_type: 'html_scrape',
    contact_phone: '515-725-8200',
    current_status: 'open',
    status_headline: 'Iowa Designated OHV Parks Open'
  },

  // --- NORTHWEST WISCONSIN COUNTY FORESTRY DEPARTMENTS ---
  {
    id: 'wi-burnett-forestry',
    name: 'Burnett County Forest & Recreation Department',
    agency_level: 'county_forest',
    state: 'WI',
    county_name: 'Burnett',
    county_fips: '55013',
    condition_page_url: 'https://www.burnettcountywi.gov/index.aspx?NID=158',
    condition_feed_type: 'html_scrape',
    contact_phone: '715-349-2157',
    current_status: 'open',
    status_headline: 'Burnett County Forest Summer ATV/UTV Trails Open',
    current_status_reason: 'summer_season'
  },
  {
    id: 'wi-washburn-forestry',
    name: 'Washburn County Forestry Department',
    agency_level: 'county_forest',
    state: 'WI',
    county_name: 'Washburn',
    county_fips: '55129',
    condition_page_url: 'https://www.co.washburn.wi.us/departments/forestry/trail-conditions',
    condition_feed_type: 'html_scrape',
    contact_phone: '715-635-4490',
    current_status: 'open',
    status_headline: 'Washburn County ATV/UTV Trails Open',
    current_status_reason: 'summer_season'
  },
  {
    id: 'wi-douglas-forestry',
    name: 'Douglas County Forestry Department',
    agency_level: 'county_forest',
    state: 'WI',
    county_name: 'Douglas',
    county_fips: '55031',
    condition_page_url: 'https://www.douglascountywi.org/462/Trail-Conditions',
    condition_feed_type: 'html_scrape',
    contact_phone: '715-378-2219',
    current_status: 'open',
    status_headline: 'Douglas County Forest Trails Open',
    current_status_reason: 'summer_season'
  },
  {
    id: 'wi-bayfield-forestry',
    name: 'Bayfield County Forestry & Parks Department',
    agency_level: 'county_forest',
    state: 'WI',
    county_name: 'Bayfield',
    county_fips: '55007',
    condition_page_url: 'https://www.bayfieldcounty.wi.gov/245/Trail-Conditions',
    condition_feed_type: 'html_scrape',
    contact_phone: '715-373-6114',
    current_status: 'open',
    status_headline: 'Bayfield County Forest ATV/UTV Trail Network Open',
    current_status_reason: 'summer_season'
  },
  {
    id: 'wi-sawyer-forestry',
    name: 'Sawyer County Forestry Department',
    agency_level: 'county_forest',
    state: 'WI',
    county_name: 'Sawyer',
    county_fips: '55113',
    condition_page_url: 'https://www.sawyercountygov.org/218/Trail-Conditions',
    condition_feed_type: 'html_scrape',
    contact_phone: '715-634-4846',
    current_status: 'open',
    status_headline: 'Sawyer County Forest Trails & Fire Roads Open',
    current_status_reason: 'summer_season'
  },
  {
    id: 'wi-iron-forestry',
    name: 'Iron County Forestry Department',
    agency_level: 'county_forest',
    state: 'WI',
    county_name: 'Iron',
    county_fips: '55051',
    condition_page_url: 'https://www.ironcountyforestry.org/trail-report',
    condition_feed_type: 'html_scrape',
    contact_phone: '715-561-2697',
    current_status: 'open',
    status_headline: 'Iron County Forest Trails Open',
    current_status_reason: 'summer_season'
  },
  {
    id: 'wi-price-forestry',
    name: 'Price County Forestry & Tourism Department',
    agency_level: 'county_forest',
    state: 'WI',
    county_name: 'Price',
    county_fips: '55099',
    condition_page_url: 'https://www.pricecountywi.net/404/Trail-Report',
    condition_feed_type: 'html_scrape',
    contact_phone: '715-339-6371',
    current_status: 'open',
    status_headline: 'Price County Motorized Trails Open',
    current_status_reason: 'summer_season'
  },
  {
    id: 'wi-barron-forestry',
    name: 'Barron County Parks & Recreation',
    agency_level: 'county_forest',
    state: 'WI',
    county_name: 'Barron',
    county_fips: '55005',
    condition_page_url: 'https://www.barroncountywi.gov/departments/parks-and-recreation',
    condition_feed_type: 'html_scrape',
    contact_phone: '715-537-6295',
    current_status: 'open',
    status_headline: 'Barron County Trails Open'
  },
  {
    id: 'wi-polk-forestry',
    name: 'Polk County Parks & Trails',
    agency_level: 'county_forest',
    state: 'WI',
    county_name: 'Polk',
    county_fips: '55095',
    condition_page_url: 'https://www.co.polk.wi.us/parks',
    condition_feed_type: 'html_scrape',
    contact_phone: '715-485-9294',
    current_status: 'open',
    status_headline: 'Polk County Multi-Use Trails Open'
  },
  {
    id: 'wi-rusk-forestry',
    name: 'Rusk County Forestry Department',
    agency_level: 'county_forest',
    state: 'WI',
    county_name: 'Rusk',
    county_fips: '55107',
    condition_page_url: 'https://www.ruskcountywi.gov/forestry-trails',
    condition_feed_type: 'html_scrape',
    contact_phone: '715-532-2113',
    current_status: 'open',
    status_headline: 'Rusk County Forest Trails Open'
  },

  // --- NATIONWIDE BENCHMARKS (WESTERN & APPALACHIAN SCALE-TESTING) ---
  {
    id: 'ut-state-paiute',
    name: 'Paiute Trail Committee & Fishlake National Forest',
    agency_level: 'trail_club',
    state: 'UT',
    county_name: 'Piute / Sevier / Millard',
    condition_page_url: 'https://paiutejam.com/trail-conditions',
    condition_feed_type: 'html_scrape',
    contact_phone: '435-896-9233',
    current_status: 'open',
    status_headline: 'Paiute ATV Trail System Main Loop #01 Open (50" Gates Enforced on Select Side Spurs)'
  },
  {
    id: 'wv-hatfield-mccoy',
    name: 'Hatfield-McCoy Regional Recreation Authority',
    agency_level: 'state_dnr',
    state: 'WV',
    county_name: 'Multi-County (Southern WV)',
    condition_page_url: 'https://trailsheaven.com/trail-conditions/',
    condition_feed_type: 'html_scrape',
    contact_phone: '800-592-2217',
    current_status: 'open',
    status_headline: 'All Hatfield-McCoy Trail Systems Open (Rockhouse, Bearwallow, Pinnacle, Devil Anse)'
  },
  {
    id: 'tn-windrock-park',
    name: 'Windrock Park Off-Road & Outdoor Recreation',
    agency_level: 'private_commercial',
    state: 'TN',
    county_name: 'Anderson / Morgan',
    condition_page_url: 'https://windrockpark.com/trail-status',
    condition_feed_type: 'html_scrape',
    contact_phone: '865-435-3221',
    current_status: 'open',
    status_headline: 'Windrock Park 73,000-Acre Trail System Open 365 Days/Year'
  }
];

async function seedJurisdictions() {
  await client.connect();
  console.log(`Seeding ${JURISDICTIONS.length} authoritative jurisdictions...`);

  for (const j of JURISDICTIONS) {
    await client.query(`
      INSERT INTO jurisdictions (
        id, name, agency_level, state, county_name, county_fips,
        condition_page_url, condition_feed_type, contact_phone,
        current_status, status_headline, current_status_reason,
        status_updated_at, last_scraped_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        agency_level = EXCLUDED.agency_level,
        state = EXCLUDED.state,
        county_name = EXCLUDED.county_name,
        county_fips = EXCLUDED.county_fips,
        condition_page_url = EXCLUDED.condition_page_url,
        condition_feed_type = EXCLUDED.condition_feed_type,
        contact_phone = EXCLUDED.contact_phone,
        current_status = EXCLUDED.current_status,
        status_headline = EXCLUDED.status_headline,
        current_status_reason = EXCLUDED.current_status_reason;
    `, [
      j.id, j.name, j.agency_level, j.state, j.county_name, j.county_fips || null,
      j.condition_page_url, j.condition_feed_type, j.contact_phone,
      j.current_status, j.status_headline, j.current_status_reason || null
    ]);
  }

  const countRes = await client.query('SELECT count(*) FROM jurisdictions');
  console.log(`Successfully seeded jurisdictions! Total count in DB: ${countRes.rows[0].count}`);
  await client.end();
}

seedJurisdictions().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
