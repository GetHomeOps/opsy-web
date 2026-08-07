# ATTOM API Endpoints Inventory

Inventory of ATTOM Developer Platform API endpoints and whether Opsy currently calls them.

| | |
| --- | --- |
| **Source** | [ATTOM API Documentation](https://api.developer.attomdata.com/docs) |
| **Last reviewed** | 2026-08-04 |
| **Auth** | `apikey` request header (Parcel Tiles also supports `apikey` / `apiKey` as a query param for map clients) |
| **Using** | 1 |
| **Not using** | 50 |

## Opsy usage

Opsy calls a single Property API endpoint:

- **Path:** `/property/expandedprofile`
- **Base URL:** `https://api.gateway.attomdata.com/propertyapi/v1.0.0`
- **Implementation:** [`services/attomLookupService.js`](../services/attomLookupService.js) (`ATTOM_PROPERTY_ENDPOINT`)
- **Flows:** sync property predict (`routes/propertyPredict.js`), background jobs (`services/attomLookupQueue.js`), pre-purchase convert enqueue, Identity “Pull property data” refresh

## Base URLs

| API family | Base URL |
| --- | --- |
| Property API | `https://api.gateway.attomdata.com/propertyapi/v1.0.0` |
| Area API | `https://api.gateway.attomdata.com/areaapi/v2.0.0` (also v4 paths under `/areaapi/` and `/v4/`) |
| Community / POI / Location | `https://api.gateway.attomdata.com/v4/` |
| Parcel Tiles | `https://api.gateway.attomdata.com` |

---

## Property API

Paths below are relative to `propertyapi/v1.0.0` unless noted.

### Property

| Endpoint | Path | Using | Not using | Notes |
| --- | --- | --- | --- | --- |
| Property ID | `/property/id` | | ✅ | |
| Property Address | `/property/address` | | ✅ | |
| Property Snapshot | `/property/snapshot` | | ✅ | |
| Property Detail | `/property/detail` | | ✅ | |
| Property Detail Mortgage | `/property/detailmortgage` | | ✅ | |
| Property Detail Owner | `/property/detailowner` | | ✅ | |
| Property Detail Mortgage Owner | `/property/detailmortgageowner` | | ✅ | |
| Property Detail With Schools | `/property/detailwithschools` | | ✅ | |
| Property Basic Profile | `/property/basicprofile` | | ✅ | |
| Property Expanded Profile | `/property/expandedprofile` | ✅ | | Sole ATTOM call in Opsy — `attomLookupService.js` |
| Property Building Permits | `/property/buildingpermits` | | ✅ | |

### Assessment

| Endpoint | Path | Using | Not using | Notes |
| --- | --- | --- | --- | --- |
| Assessment Detail | `/assessment/detail` | | ✅ | |
| Assessment Snapshot | `/assessment/snapshot` | | ✅ | |
| Assessment History Detail | `/assessmenthistory/detail` | | ✅ | |

### AVM / valuation

| Endpoint | Path | Using | Not using | Notes |
| --- | --- | --- | --- | --- |
| ATTOM AVM Detail | `/attomavm/detail` | | ✅ | |
| AVM Snapshot | `/avm/snapshot` | | ✅ | |
| AVM History Detail | `/avmhistory/detail` | | ✅ | |
| Rental AVM | `/valuation/rentalavm` | | ✅ | |
| Home Equity | `/valuation/homeequity` | | ✅ | |

### Sale / sales history / sales trend

| Endpoint | Path | Using | Not using | Notes |
| --- | --- | --- | --- | --- |
| Sale Detail | `/sale/detail` | | ✅ | |
| Sale Snapshot | `/sale/snapshot` | | ✅ | |
| Sales History Detail | `/saleshistory/detail` | | ✅ | |
| Sales History Snapshot | `/saleshistory/snapshot` | | ✅ | |
| Sales History Basic History | `/saleshistory/basichistory` | | ✅ | |
| Sales History Expanded History | `/saleshistory/expandedhistory` | | ✅ | |
| Sales Trend Snapshot | `/salestrend/snapshot` | | ✅ | |
| Transaction Sales Trend | `/transaction/salestrend` | | ✅ | |
| Sales Comparables | `/salescomparables` | | ✅ | |

### School

| Endpoint | Path | Using | Not using | Notes |
| --- | --- | --- | --- | --- |
| School District | `/school/district` | | ✅ | School names on expanded profile are mapped in Opsy; this dedicated endpoint is not called |
| School Profile | `/school/profile` | | ✅ | |
| School Search | `/school/search` | | ✅ | |

### All events / foreclosure

| Endpoint | Path | Using | Not using | Notes |
| --- | --- | --- | --- | --- |
| All Events Detail | `/allevents/detail` | | ✅ | |
| All Events Snapshot | `/allevents/snapshot` | | ✅ | |
| Foreclosure Details | `/preforeclosuredetails` | | ✅ | |

### Geo / hierarchy lookups (Property API)

| Endpoint | Path | Using | Not using | Notes |
| --- | --- | --- | --- | --- |
| CBSA Lookup | `/cbsa/lookup` | | ✅ | |
| County Lookup | `/county/lookup` | | ✅ | |
| Geo ID Lookup | `/geoid/lookup` | | ✅ | |
| Hierarchy Lookup | `/hierarchy/lookup` | | ✅ | |
| State Lookup | `/state/lookup` | | ✅ | |

---

## Area API

| Endpoint | Path | Using | Not using | Notes |
| --- | --- | --- | --- | --- |
| Area Hierarchy Lookup | `/areaapi/area/hierarchy/lookup` | | ✅ | Also documented under v4 as `/areaapi/v4/hierarchy/lookup` |
| Area State Lookup | `/areaapi/area/state/lookup` | | ✅ | |
| Area Boundary Detail | `/areaapi/area/boundary/detail` | | ✅ | |
| Area GeoID Lookup | `/areaapi/area/geoId/Lookup` | | ✅ | |
| Area GeoCode (legacy) Lookup | `/areaapi/area/geoId/legacyLookup` | | ✅ | |

---

## Community / POI / Location (v4)

Paths relative to `https://api.gateway.attomdata.com/v4` (or as documented on the developer platform).

| Endpoint | Path | Using | Not using | Notes |
| --- | --- | --- | --- | --- |
| Neighborhood Community | `/neighborhood/community` | | ✅ | |
| Neighborhood POI | `/neighborhood/poi` | | ✅ | |
| Neighborhood POI Category Lookup | `/neighborhood/poi/categorylookup` | | ✅ | |
| Location Lookup | `/location/lookup` | | ✅ | |
| Line Of Business Lookup | `/LOB/lookup` | | ✅ | |
| Geography | `/POI/geography` | | ✅ | |

---

## Parcel Tiles API

| Endpoint | Path | Using | Not using | Notes |
| --- | --- | --- | --- | --- |
| Parcel Tiles (PNG) | `/parceltiles/{z}/{x}/{y}.png` | | ✅ | Zoom levels 14–18; `apikey` may be passed as a query param for map SDKs |
