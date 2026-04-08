"use strict";

/**
 * Regenerates data/demo-properties.json (static Pexels CDN URLs).
 * Run from homeops-backend: node scripts/build-demo-properties-json.js
 */

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "data", "demo-properties.json");

const ADDRESS_LINES = `
4150 86th Ave SE, Mercer Island, WA 98040
3021 74th Ave SE, Mercer Island, WA 98040
8815 SE 63rd St, Mercer Island, WA 98040
4305 92nd Ave SE, Mercer Island, WA 98040
7610 SE 40th St, Mercer Island, WA 98040
5100 84th Ave SE, Mercer Island, WA 98040
9102 SE 50th St, Mercer Island, WA 98040
3820 80th Ave SE, Mercer Island, WA 98040
7215 SE 29th St, Mercer Island, WA 98040
8412 SE 68th St, Mercer Island, WA 98040
2415 NW 65th St, Seattle, WA 98117
7512 35th Ave NE, Seattle, WA 98115
4120 51st Ave SW, Seattle, WA 98116
1824 11th Ave W, Seattle, WA 98119
6515 Phinney Ave N, Seattle, WA 98103
3218 38th Ave SW, Seattle, WA 98126
912 24th Ave E, Seattle, WA 98112
5420 39th Ave S, Seattle, WA 98118
1415 E Aloha St, Seattle, WA 98102
8312 20th Ave NW, Seattle, WA 98117
2815 34th Ave S, Seattle, WA 98144
7718 18th Ave NE, Seattle, WA 98115
4521 4th Ave NE, Seattle, WA 98105
6210 25th Ave NW, Seattle, WA 98107
1115 W Galer St, Seattle, WA 98119
8214 1st Ave NE, Seattle, WA 98115
3315 19th Ave S, Seattle, WA 98144
5218 42nd Ave SW, Seattle, WA 98136
1712 28th Ave W, Seattle, WA 98199
9415 8th Ave NW, Seattle, WA 98117
14502 SE 14th St, Bellevue, WA 98007
2115 104th Ave SE, Bellevue, WA 98004
16210 NE 12th St, Bellevue, WA 98008
4515 130th Ave SE, Bellevue, WA 98006
11215 SE 60th St, Bellevue, WA 98006
13210 NE 40th St, Bellevue, WA 98005
15412 SE 22nd St, Bellevue, WA 98007
10214 NE 15th St, Bellevue, WA 98004
16415 SE 42nd St, Bellevue, WA 98006
3215 118th Ave SE, Bellevue, WA 98005
14210 NE 72nd St, Redmond, WA 98052
16515 NE 104th St, Redmond, WA 98052
7812 154th Ave NE, Redmond, WA 98052
18210 NE 30th St, Redmond, WA 98052
11215 172nd Ave NE, Redmond, WA 98052
9214 122nd Ave NE, Kirkland, WA 98033
13415 100th Ave NE, Kirkland, WA 98034
11512 80th Ave NE, Kirkland, WA 98034
7415 116th Ave NE, Kirkland, WA 98033
14210 119th Ave NE, Kirkland, WA 98034
5214 230th Ave SE, Issaquah, WA 98029
4115 212th Way SE, Issaquah, WA 98027
1412 Front St S, Issaquah, WA 98027
24510 SE 44th St, Issaquah, WA 98029
6215 220th Ave SE, Issaquah, WA 98027
3412 N 26th St, Tacoma, WA 98407
1515 S 19th St, Tacoma, WA 98405
4210 N Huson St, Tacoma, WA 98407
5112 S 8th St, Tacoma, WA 98465
2815 N Proctor St, Tacoma, WA 98407
1214 S Washington St, Tacoma, WA 98405
3815 N 15th St, Tacoma, WA 98406
6412 S Puget Sound Ave, Tacoma, WA 98409
4515 N Lexington St, Tacoma, WA 98407
2115 S Tyler St, Tacoma, WA 98405
4215 Colby Ave, Everett, WA 98203
1512 73rd St SE, Everett, WA 98203
2315 112th St SE, Everett, WA 98208
5412 Mukilteo Blvd, Everett, WA 98203
3415 35th St, Everett, WA 98201
8210 19th Ave SE, Everett, WA 98208
4615 Grand Ave, Everett, WA 98203
1215 100th Pl SE, Everett, WA 98208
6512 Fleming St, Everett, WA 98203
2815 14th St, Everett, WA 98201
1412 21st St, Snohomish, WA 98290
5215 116th St SE, Snohomish, WA 98290
13210 4th St, Snohomish, WA 98290
8415 160th St SE, Snohomish, WA 98296
6112 120th Ave SE, Snohomish, WA 98290
2415 108th St SE, Everett, WA 98208
7210 200th St SW, Lynnwood, WA 98036
4515 164th St SW, Lynnwood, WA 98037
18210 72nd Ave W, Edmonds, WA 98026
9415 220th St SW, Edmonds, WA 98020
21510 48th Ave W, Mountlake Terrace, WA 98043
15412 12th Ave NE, Shoreline, WA 98155
18215 8th Ave NW, Shoreline, WA 98177
11210 NE 132nd St, Kirkland, WA 98034
14515 148th Ave NE, Woodinville, WA 98072
17210 140th Ave NE, Woodinville, WA 98072
2115 NE 195th St, Bothell, WA 98011
24015 112th Ave SE, Kent, WA 98031
13210 SE 272nd St, Kent, WA 98042
31215 124th Ave SE, Auburn, WA 98092
4512 S 300th St, Auburn, WA 98001
15210 SE 296th St, Kent, WA 98042
2415 NW Sammamish Rd, Issaquah, WA 98027
4112 228th Ave SE, Sammamish, WA 98075
1215 212th Ave SE, Sammamish, WA 98074
`.trim().split("\n");

/** Pexels house / exterior photos (verified HTTP 200; cycled for 100 rows). */
const HOUSE_IDS = [
  1396132, 1115804, 1643384, 2251247, 323705, 1029599, 221540, 1390684, 2102587, 280221,
  534220, 106399, 1181406, 318191, 1396120, 323780, 259588, 1396123, 1571460, 1396122,
  2014422, 1393942, 2121121, 1571468, 1396125, 1643389, 1396134, 1396126, 2724748, 2635038,
  2724749, 2635037, 2121122, 1571453, 1643383, 1396127, 259751, 1390966, 1571467, 1396133,
];

/** Pexels portrait / people photos for homeowner avatars (verified HTTP 200). */
const PORTRAIT_IDS = [
  774909, 1181695, 1222271, 1239291, 1181514, 1236723, 1181686, 1043471, 1121796, 1181687,
  2379004, 1024311, 733872, 614810, 3785079, 3771089, 3783184, 3785077, 3785078, 1181516,
  1043472, 1121797,
];

function pexelsHouse(id) {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200`;
}

function pexelsPortrait(id) {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800`;
}

function parseAddressLine(line) {
  const parts = line.split(",").map((s) => s.trim());
  if (parts.length < 3) {
    throw new Error(`Bad address line: ${line}`);
  }
  const address_line_1 = parts.slice(0, -2).join(", ");
  const city = parts[parts.length - 2];
  const stateZip = parts[parts.length - 1];
  const m = stateZip.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (!m) {
    throw new Error(`Bad state/zip: ${stateZip} in ${line}`);
  }
  return {
    full: line.trim(),
    address_line_1,
    city,
    state: m[1].toUpperCase(),
    zip: m[2],
  };
}

const FIRST = ["Alex", "Sam", "Jordan", "Riley", "Casey", "Morgan", "Taylor", "Quinn", "Jamie", "Avery"];
const LAST = ["Nguyen", "Patel", "Garcia", "Kim", "Chen", "Martinez", "Brown", "Lee", "Singh", "Walker"];

const properties = ADDRESS_LINES.map((line, i) => {
  const n = i + 1;
  const pad = String(n).padStart(3, "0");
  const houseId = HOUSE_IDS[i % HOUSE_IDS.length];
  const portraitId = PORTRAIT_IDS[i % PORTRAIT_IDS.length];
  return {
    index: n,
    homeowner: {
      email: `demo.homeowner.${pad}@opsy.local`,
      name: `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]} ${pad}`,
      phone: `206555${String(1000 + n).slice(-4)}`,
      password: "12345678",
      role: "homeowner",
      avatar_url: pexelsPortrait(portraitId),
      pexels_portrait_photo_id: portraitId,
    },
    address: parseAddressLine(line),
    main_photo: pexelsHouse(houseId),
    pexels_house_photo_id: houseId,
  };
});

const agentPortraitId = 2182970;
const doc = {
  version: 1,
  description:
    "Demo seed: one agent (all properties), one homeowner per property. Passwords are plaintext for local seed scripts only — hash before persisting. Images: Pexels (see photo ids on each record).",
  agent: {
    email: "agent@opsy.com",
    name: "Jordan Agent",
    phone: "2065550000",
    password: "12345678",
    role: "agent",
    avatar_url: pexelsPortrait(agentPortraitId),
    pexels_portrait_photo_id: agentPortraitId,
  },
  properties,
};

if (properties.length !== 100) {
  throw new Error(`Expected 100 properties, got ${properties.length}`);
}

fs.writeFileSync(OUT, JSON.stringify(doc, null, 2), "utf8");
console.log(`Wrote ${OUT}`);
