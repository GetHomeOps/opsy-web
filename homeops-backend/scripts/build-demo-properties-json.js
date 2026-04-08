"use strict";

/**
 * Regenerates data/demo-properties.json with Unsplash house exterior + portrait URLs.
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

/**
 * Unsplash house exterior photos — all verified HTTP 200.
 * Unsplash allows hotlinking per https://unsplash.com/license
 */
const HOUSE_IDS = [
  "1564013799919-ab600027ffc6",
  "1570129477492-45c003edd2be",
  "1583608205776-bfd35f0d9f83",
  "1600596542815-ffad4c1539a9",
  "1600585154340-be6161a56a0c",
  "1600047509807-ba8f99d2cdde",
  "1512917774080-9991f1c4c750",
  "1523217582562-09d0def993a6",
  "1600585154526-990dced4db0d",
  "1600573472550-8090b5e0745e",
  "1600573472592-401b489a3cdc",
  "1600566753190-17f0baa2a6c3",
  "1600607687939-ce8a6c25118c",
  "1600607687644-c7171b42498f",
  "1605276374104-dee2a0ed3cd6",
  "1600585153490-76fb20a32601",
  "1600566752355-35792bedcfea",
  "1600585154363-67eb9e2e2099",
  "1600585154084-4e5fe7c39198",
  "1600573472591-ee6b68d14c68",
  "1600047509358-9dc75507daeb",
  "1558036117-15d82a90b9b1",
  "1580587771525-78b9dba3b914",
  "1625602812206-5ec545ca1231",
  "1518780664697-55e3ad937233",
  "1572120360610-d971b9d7767c",
  "1568605114967-8130f3a36994",
  "1605146769289-440113cc3d00",
  "1613977257365-aaae5a9817ff",
  "1592595896616-c37162298647",
  "1599809275671-b5942cabc7a2",
  "1592595896551-12b371d546d5",
  "1484154218962-a197022b5858",
  "1430285561322-7808604715df",
  "1502672260266-1c1ef2d93688",
  "1416331108676-a22ccb276e35",
  "1510627489930-0c1b0bfb6785",
  "1480074568708-e7b720bb3f09",
  "1542314831-068cd1dbfeeb",
];

/** Unsplash portrait photos — verified HTTP 200. */
const PORTRAIT_IDS = [
  "1507003211169-0a1dd7228f2d",
  "1494790108377-be9c29b29330",
  "1544005313-94ddf0286df2",
  "1500648767791-00dcc994a43e",
  "1506794778202-cad84cf45f1d",
  "1534528741775-53994a69daeb",
  "1488426862026-3ee34a7d66df",
  "1517841905240-472988babdf9",
  "1472099645785-5658abf4ff4e",
  "1580489944761-15a19d654956",
  "1438761681033-6461ffad8d80",
  "1573496359142-b8d87734a5a2",
  "1560250097-0b93528c311a",
  "1567532939604-b6b5b0db2604",
  "1499996860823-5214fcc65f8f",
  "1508214751196-bcfd4ca60f91",
  "1544725176-7c40e5a71c5e",
  "1519085360753-af0119f7cbe7",
  "1552058544-f2b08422138a",
  "1542596768-5d1d21f1cf98",
  "1600878459138-e1123b37cb30",
];

function unsplashHouse(id) {
  return `https://images.unsplash.com/photo-${id}?w=1200&fit=crop&q=80`;
}

function unsplashPortrait(id) {
  return `https://images.unsplash.com/photo-${id}?w=400&fit=crop&q=80`;
}

function parseAddressLine(line) {
  const parts = line.split(",").map((s) => s.trim());
  if (parts.length < 3) throw new Error(`Bad address line: ${line}`);
  const address_line_1 = parts.slice(0, -2).join(", ");
  const city = parts[parts.length - 2];
  const stateZip = parts[parts.length - 1];
  const m = stateZip.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (!m) throw new Error(`Bad state/zip: ${stateZip} in ${line}`);
  return { full: line.trim(), address_line_1, city, state: m[1].toUpperCase(), zip: m[2] };
}

const FIRST = [
  "Alex", "Sam", "Jordan", "Riley", "Casey", "Morgan", "Taylor", "Quinn", "Jamie", "Avery",
  "Blake", "Cameron", "Dakota", "Drew", "Emery", "Frankie", "Hayden", "Jessie", "Kelly", "Lane",
  "Micah", "Noel", "Parker", "Reese", "Sage", "Skyler", "Tatum", "Val", "Wren", "Zion",
];
const LAST = [
  "Nguyen", "Patel", "Garcia", "Kim", "Chen", "Martinez", "Brown", "Lee", "Singh", "Walker",
  "Rivera", "Clark", "Lewis", "Robinson", "Hall", "Young", "Anderson", "Thomas", "Jackson", "White",
  "Harris", "Martin", "Thompson", "Moore", "Scott", "Wilson", "Davis", "Miller", "Johnson", "Jones",
];

function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

function shuffle(arr, seed) {
  const rng = seededRng(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const allPairs = [];
for (const first of FIRST) {
  for (const last of LAST) {
    if (first.toLowerCase() !== last.toLowerCase()) allPairs.push({ first, last });
  }
}
const namePairs = shuffle(allPairs, 20250407).slice(0, 100);

const properties = ADDRESS_LINES.map((line, i) => {
  const n = i + 1;
  const { first, last } = namePairs[i];
  const emailLocal = `${first.toLowerCase()}.${last.toLowerCase()}`;
  return {
    index: n,
    homeowner: {
      email: `${emailLocal}@email.com`,
      name: `${first} ${last}`,
      phone: `206555${String(1000 + n).slice(-4)}`,
      password: "12345678",
      role: "homeowner",
      avatar_url: unsplashPortrait(PORTRAIT_IDS[i % PORTRAIT_IDS.length]),
    },
    address: parseAddressLine(line),
    main_photo: unsplashHouse(HOUSE_IDS[i % HOUSE_IDS.length]),
  };
});

const doc = {
  version: 2,
  description:
    "Demo seed: 1 agent (all properties), 1 homeowner per property. Passwords are plaintext — hash before persisting. Photos: Unsplash (house exteriors + portraits).",
  agent: {
    email: "agent@opsy.com",
    name: "Jordan Agent",
    phone: "2065550000",
    password: "12345678",
    role: "agent",
    avatar_url: unsplashPortrait("1560250097-0b93528c311a"),
  },
  properties,
};

if (properties.length !== 100) throw new Error(`Expected 100 properties, got ${properties.length}`);

fs.writeFileSync(OUT, JSON.stringify(doc, null, 2), "utf8");
console.log(`Wrote ${OUT} (${properties.length} properties)`);
