"use strict";

const express = require("express");
const { ensureLoggedIn } = require("../middleware/auth");
const { BadRequestError } = require("../expressError");

const router = new express.Router();

// ----- RentCast (commented out - using ATTOM for now) -----
// const RENTCAST_API_KEY = process.env.RENTCAST_API_KEY;
// const RENTCAST_BASE_URL = "https://api.rentcast.io/v1";

// /**
//  * Map the RentCast property response into the flat field schema
//  * the frontend expects.
//  */
// function mapRentCastToFields(prop) {
//   const features = prop.features ?? {};
//   const owner = prop.owner ?? {};
//   const mailingAddr = owner.mailingAddress ?? {};
//   const taxAssessments = prop.taxAssessments ?? {};
//
//   // Get latest tax assessment value for estimatedValue
//   const assessmentYears = Object.keys(taxAssessments)
//     .filter((k) => /^\d{4}$/.test(k))
//     .map(Number)
//     .sort((a, b) => b - a);
//   const latestYear = assessmentYears[0];
//   const latestAssessment = latestYear ? taxAssessments[String(latestYear)] : null;
//   const estimatedValue = latestAssessment?.value ?? null;
//
//   // Owner names from RentCast owner.names array
//   const ownerNames = owner.names ?? [];
//   const owner1Name = ownerNames[0] ?? "";
//   const owner2Name = ownerNames[1] ?? "";
//
//   // Lot size: RentCast returns sq ft as number; format as "X sf"
//   const lotSizeSqFt = prop.lotSize;
//   let lotSize = "";
//   if (lotSizeSqFt != null && Number.isFinite(Number(lotSizeSqFt))) {
//     lotSize = `${Number(lotSizeSqFt).toLocaleString()} sf`;
//   }
//
//   // Parking: RentCast has garageSpaces and garageType
//   const garageSpaces = features.garageSpaces != null ? parseInt(features.garageSpaces, 10) : null;
//   const garageType = features.garageType ?? "";
//   let parkingType = garageType;
//   if (garageType && garageSpaces) {
//     parkingType = `${garageType} (${garageSpaces} spaces)`;
//   }
//
//   // Basement: RentCast has foundationType which may indicate basement
//   const foundationType = features.foundationType ?? "";
//   const basement = foundationType || "";
//
//   // Fireplace: RentCast has boolean fireplace and fireplaceType
//   const hasFireplace = features.fireplace === true;
//   const fireplaces = hasFireplace ? 1 : null;
//   const fireplaceTypes = features.fireplaceType ?? "";
//
//   return {
//     ownerName: owner1Name || "",
//     ownerName2: owner2Name || "",
//     ownerCity: mailingAddr.city ?? "",
//     taxId: prop.assessorID ?? "",
//     addressLine2: prop.addressLine2 ?? "",
//     propertyType: prop.propertyType ?? "",
//     subType: prop.subdivision ?? "",
//     roofType: features.roofType ?? "",
//     yearBuilt: prop.yearBuilt ?? null,
//     sqFtTotal: prop.squareFootage ?? null,
//     sqFtFinished: prop.squareFootage ?? null,
//     sqFtUnfinished: null,
//     garageSqFt: null,
//     totalDwellingSqFt: prop.squareFootage ?? null,
//     lotSize,
//     bedCount: prop.bedrooms ?? null,
//     bathCount: prop.bathrooms ?? null,
//     fullBaths: null,
//     threeQuarterBaths: null,
//     halfBaths: null,
//     numberOfShowers: null,
//     numberOfBathtubs: null,
//     fireplaces,
//     fireplaceTypes,
//     basement,
//     parkingType,
//     totalCoveredParking: garageSpaces,
//     totalUncoveredParking: null,
//     schoolDistrict: "",
//     elementarySchool: "",
//     juniorHighSchool: "",
//     seniorHighSchool: "",
//     estimatedValue,
//     county: prop.county ?? "",
//   };
// }

// ----- ATTOM API (active) -----
const ATTOM_API_KEY = process.env.ATTOM_API_KEY;
const ATTOM_BASE_URL = "https://api.gateway.attomdata.com/propertyapi/v1.0.0";

/** Pick first non-null value from obj[key1], obj[key2], ... (case-insensitive keys) */
function pickFirst(obj, ...keys) {
  if (!obj || typeof obj !== "object") return null;
  for (const k of keys) {
    const val = obj[k];
    if (val !== undefined && val !== null && val !== "") return val;
  }
  // Try lowercase variants
  const lower = Object.fromEntries(
    Object.entries(obj).map(([key, v]) => [key.toLowerCase(), v])
  );
  for (const k of keys) {
    const val = lower[k?.toLowerCase?.() ?? k];
    if (val !== undefined && val !== null && val !== "") return val;
  }
  return null;
}

/**
 * Map the ATTOM property response into the flat field schema
 * the frontend expects. Tries multiple key variants (ATTOM docs vary by endpoint/version).
 * @param {Object} prop - Property object from data.property[0]
 * @param {Object} [fullData] - Full API response (owner may be at root level, not inside property)
 */
function mapAttomToFields(prop, fullData) {
  const identifier = prop.identifier ?? {};
  const address = prop.address ?? {};
  const lot = prop.lot ?? {};
  const area = prop.area ?? {};
  const summary = prop.summary ?? {};
  const building = prop.building ?? {};
  const rooms = building?.rooms ?? {};
  const size = building?.size ?? {};
  const interior = building?.interior ?? {};
  const parking = building?.parking ?? {};
  const assessment = prop.assessment ?? {};
  const tax = prop.tax ?? {};
  // Owner can appear in multiple places depending on ATTOM endpoint/version.
  // In your payload it's under assessment.owner.
  const owner = prop.owner ?? prop.assessment?.owner ?? fullData?.owner ?? fullData?.assessment?.owner ?? {};
  const sale = prop.sale ?? {};
  const school = prop.school ?? {};

  // Lot size: lotSize1=acres, lotSize2=sq ft (try both casings)
  const lotSize1 = pickFirst(lot, "lotSize1", "lotsize1");
  const lotSize2 = pickFirst(lot, "lotSize2", "lotsize2");
  const lotSizeSqFt = lotSize2 ?? (lotSize1 != null ? Math.round(Number(lotSize1) * 43560) : null);
  let lotSize = "";
  if (lotSizeSqFt != null && Number.isFinite(Number(lotSizeSqFt))) {
    lotSize = `${Number(lotSizeSqFt).toLocaleString()} sf`;
  } else if (lotSize1 != null) {
    lotSize = `${lotSize1} acres`;
  }

  // Parking: try various ATTOM structures
  const garageSpaces =
    pickFirst(parking, "garages", "garageSpaces", "garage") ??
    pickFirst(building?.summary, "garages");
  const garageType = pickFirst(parking, "type", "parkingType") ?? "";
  let parkingType = garageType;
  if (garageType && garageSpaces) {
    parkingType = `${garageType} (${garageSpaces} spaces)`;
  } else if (garageSpaces) {
    parkingType = `${garageSpaces} garage`;
  }

  // Basement
  const basementSqFt = pickFirst(interior, "basementsqft", "basementSqFt");
  const basement =
    basementSqFt != null && Number(basementSqFt) > 0
      ? "Yes"
      : pickFirst(interior, "basement", "hasBasement") || "";

  // Fireplace
  const fireplaces = pickFirst(interior, "fireplaces", "fireplaceCount") ?? null;
  const fireplaceTypes =
    pickFirst(interior, "fireplacetype", "fireplaceType", "fireplaceDesc") ?? "";

  // Estimated/value: assessment, tax, sale
  const estimatedValue =
    pickFirst(assessment, "assessedvalue", "assessedValue", "avm") ??
    pickFirst(tax, "assessedvalue", "assessedValue") ??
    pickFirst(sale, "amount", "saleAmount", "price") ??
    null;

  // County: area.countrysecsubd often = "County Name"
  const county = pickFirst(area, "county", "countrysecsubd", "countyName", "munname") ?? "";

  // Owner: ATTOM uses owner1, owner2, owner3 with fullName (owner2 empty → use owner3 for owner2)
  const getOwnerName = (o) => {
    if (!o || typeof o !== "object") return "";
    const name =
      pickFirst(o, "fullName", "fullname") ??
      [o.firstNameAndMi, o.firstnameandmi, o.lastName, o.lastname].filter(Boolean).join(" ").trim();
    return name ? String(name).trim() : "";
  };
  const owner1 = pickFirst(owner, "owner1", "Owner1");
  const owner2 = pickFirst(owner, "owner2", "Owner2");
  const owner3 = pickFirst(owner, "owner3", "Owner3");
  const owner1Name =
    getOwnerName(owner1) ||
    (Array.isArray(owner?.names) ? owner.names[0] : null) ||
    pickFirst(owner, "name", "ownerName") ||
    "";
  const owner2Name =
    getOwnerName(owner2) || getOwnerName(owner3) || (Array.isArray(owner?.names) ? owner.names[1] : null) || "";
  const ownerCity = pickFirst(owner?.mailingAddress ?? owner, "city", "locality") ?? "";

  // Debug: log extracted owner values
  if (owner1Name || owner2Name) {
    console.log("=== ATTOM owner extraction ===", { owner1Name, owner2Name, ownerCity });
  }

  // Schools (basicprofile may have limited; try school section)
  const schoolDistrict = pickFirst(school, "district", "districtName", "name") ?? "";
  const elementarySchool = pickFirst(school, "elementary", "elementaryName") ?? "";
  const juniorHighSchool = pickFirst(school, "juniorHigh", "middleSchool", "juniorHighName") ?? "";
  const seniorHighSchool = pickFirst(school, "seniorHigh", "highSchool", "seniorHighName") ?? "";

  return {
    ownerName: String(owner1Name || "").trim(),
    ownerName2: String(owner2Name || "").trim(),
    ownerCity: String(ownerCity || "").trim(),
    taxId: pickFirst(identifier, "apn", "apnOrig", "apnUnformatted") ?? "",
    addressLine2: pickFirst(address, "line2", "lineTwo") ?? "",
    propertyType: pickFirst(summary, "propclass", "proptype", "propType", "propertyType") ?? "",
    subType: pickFirst(summary, "propsubtype", "propSubtype", "subtype") ?? "",
    roofType:
      pickFirst(building?.construction, "rooftype", "roofType", "roof") ??
      pickFirst(building?.utilities, "rooftype") ??
      "",
    yearBuilt:
      pickFirst(summary, "yearbuilt", "yearBuilt", "yearConstructed") ?? null,
    sqFtTotal:
      pickFirst(size, "universalsize", "universalSize", "bldgsize", "livingsize", "grosssize") ?? null,
    sqFtFinished:
      pickFirst(size, "livingsize", "livingSize", "universalsize", "bldgsize") ?? null,
    sqFtUnfinished: pickFirst(size, "unfinishedsqft", "unfinishedSqFt") ?? null,
    garageSqFt:
      pickFirst(size, "garagesqft", "garageSqFt") ??
      pickFirst(parking, "prkgSize", "prkgsize") ??
      null,
    totalDwellingSqFt:
      pickFirst(size, "universalsize", "bldgsize", "livingsize", "grosssize") ?? null,
    lotSize,
    bedCount: pickFirst(rooms, "beds", "bedrooms", "bedCount") ?? null,
    bathCount: pickFirst(rooms, "bathstotal", "bathsTotal", "bathrooms", "bathCount") ?? null,
    fullBaths: pickFirst(rooms, "bathsfull", "fullBaths") ?? null,
    threeQuarterBaths: pickFirst(rooms, "baths3qtr", "threeQuarterBaths") ?? null,
    halfBaths: pickFirst(rooms, "bathshalf", "halfBaths") ?? null,
    numberOfShowers: null,
    numberOfBathtubs: null,
    fireplaces,
    fireplaceTypes,
    basement,
    parkingType,
    totalCoveredParking: garageSpaces,
    totalUncoveredParking: pickFirst(parking, "uncovered", "openSpaces") ?? null,
    schoolDistrict,
    elementarySchool,
    juniorHighSchool,
    seniorHighSchool,
    estimatedValue,
    county,
  };
}

/** POST /property-details — Look up property details from ATTOM public records. */
router.post("/property-details", ensureLoggedIn, async function (req, res, next) {
  try {
    if (!ATTOM_API_KEY) {
      throw new BadRequestError("ATTOM API key is not configured");
    }

    const { address, addressLine1, city, state, zip } = req.body ?? {};

    const streetAddress = (addressLine1 || address || "").trim();
    if (!streetAddress) {
      throw new BadRequestError("Street address is required (address or addressLine1)");
    }

    let cityStateZip = "";
    if (city && state) {
      cityStateZip = zip ? `${city}, ${state}, ${zip}` : `${city}, ${state}`;
    } else if (zip) {
      cityStateZip = zip;
    }
    if (!cityStateZip) {
      throw new BadRequestError("City/State or ZIP is required");
    }

    // ATTOM expects: "Street, City, State" or full address
    const fullAddress = `${streetAddress}, ${cityStateZip}`;
    const params = new URLSearchParams({ address: fullAddress });
    const url = `${ATTOM_BASE_URL}/property/basicprofile?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        apikey: ATTOM_API_KEY,
      },
    });

    const data = await response.json().catch(() => ({}));
    const status = data?.status ?? {};
    const properties = data?.property ?? [];

    if (!response.ok) {
      const errorBody = JSON.stringify(data);
      console.error("ATTOM API error:", response.status, errorBody);

      if (response.status === 400 && (status.code === 1 || status.msg === "SuccessWithoutResult")) {
        throw new BadRequestError(
          "Property could not be found. Please verify the address and try again."
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new BadRequestError("ATTOM API authentication failed. Please contact support.");
      }
      if (response.status === 429) {
        throw new BadRequestError("ATTOM API rate limit reached. Please try again in a few minutes.");
      }
      throw new BadRequestError(
        "Property could not be found. Please verify the address and try again."
      );
    }

    if (!Array.isArray(properties) || properties.length === 0) {
      throw new BadRequestError(
        "Property could not be found. Please verify the address and try again."
      );
    }

    const rawProperty = properties[0];

    const prediction = mapAttomToFields(rawProperty);

    return res.json({
      prediction,
      source: "attom",
    });
  } catch (err) {
    if (err instanceof BadRequestError) return next(err);
    console.error("ATTOM property lookup error:", err);
    return next(new BadRequestError("Property could not be found. Please verify the address and try again."));
  }
});

module.exports = router;
