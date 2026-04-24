"use strict";

/**
 * ATTOM Property Lookup Service
 *
 * Centralized ATTOM Public Records fetch + response mapping. Used by:
 *  - routes/propertyPredict.js   (synchronous, interactive lookup from SystemsSetupModal)
 *  - services/attomLookupQueue.js (background jobs for bulk import + manual refresh)
 *
 * The service owns:
 *  - fetchAttomBasicProfile: the HTTP call + classified error status
 *  - mapAttomToFields:       converts ATTOM response into flat camelCase fields
 *  - ATTOM_LOOKUP_FIELDS:    allowlist of camelCase keys the backend is allowed to
 *                            persist onto a property (mirrors the frontend
 *                            AI_FIELD_GROUPS used by SystemsSetupModal)
 *  - CAMEL_TO_SNAKE:         camelCase -> properties.* column name mapping
 *  - runAttomLookupJob:      worker entry point that reads a job row, runs the
 *                            lookup, non-destructively merges the result onto
 *                            the property, and marks the job row terminal.
 */

const db = require("../db");
const AttomLookupJob = require("../models/attomLookupJob");

const ATTOM_API_KEY = process.env.ATTOM_API_KEY;
const ATTOM_BASE_URL = "https://api.gateway.attomdata.com/propertyapi/v1.0.0";

/**
 * Allowlist of camelCase fields the worker may write onto a property.
 * Mirrors AI_FIELD_GROUPS in homeops-frontend/src/pages/properties/partials/SystemsSetupModal.jsx.
 * Keep the two in sync when either changes.
 */
const ATTOM_LOOKUP_FIELDS = [
  "taxId",
  "county",
  "ownerName",
  "ownerName2",
  "ownerCity",
  "propertyType",
  "subType",
  "roofType",
  "yearBuilt",
  "sqFtTotal",
  "sqFtFinished",
  "garageSqFt",
  "totalDwellingSqFt",
  "lotSize",
  "bedCount",
  "bathCount",
  "fullBaths",
  "threeQuarterBaths",
  "halfBaths",
  "numberOfShowers",
  "numberOfBathtubs",
  "fireplaces",
  "fireplaceTypes",
  "basement",
  "parkingType",
  "totalCoveredParking",
  "totalUncoveredParking",
  "schoolDistrict",
  "elementarySchool",
  "juniorHighSchool",
  "seniorHighSchool",
];

const ATTOM_LOOKUP_FIELDS_SET = new Set(ATTOM_LOOKUP_FIELDS);

/** camelCase API field -> properties.<column> snake_case column name. */
const CAMEL_TO_SNAKE_COLUMN = {
  taxId: "tax_id",
  county: "county",
  ownerName: "owner_name",
  ownerName2: "owner_name_2",
  ownerCity: "owner_city",
  propertyType: "property_type",
  subType: "sub_type",
  roofType: "roof_type",
  yearBuilt: "year_built",
  sqFtTotal: "sq_ft_total",
  sqFtFinished: "sq_ft_finished",
  garageSqFt: "garage_sq_ft",
  totalDwellingSqFt: "total_dwelling_sq_ft",
  lotSize: "lot_size",
  bedCount: "bed_count",
  bathCount: "bath_count",
  fullBaths: "full_baths",
  threeQuarterBaths: "three_quarter_baths",
  halfBaths: "half_baths",
  numberOfShowers: "number_of_showers",
  numberOfBathtubs: "number_of_bathtubs",
  fireplaces: "fireplaces",
  fireplaceTypes: "fireplace_types",
  basement: "basement",
  parkingType: "parking_type",
  totalCoveredParking: "total_covered_parking",
  totalUncoveredParking: "total_uncovered_parking",
  schoolDistrict: "school_district",
  elementarySchool: "elementary_school",
  juniorHighSchool: "junior_high_school",
  seniorHighSchool: "senior_high_school",
};

/** Integer columns — coerced to Math.floor(Number(v)). */
const INTEGER_COLUMNS = new Set([
  "year_built",
  "bed_count",
  "bath_count",
  "full_baths",
  "three_quarter_baths",
  "half_baths",
  "number_of_showers",
  "number_of_bathtubs",
  "fireplaces",
  "total_covered_parking",
  "total_uncovered_parking",
]);

/** Numeric (decimal) columns — coerced to Number(v). */
const NUMBER_COLUMNS = new Set([
  "sq_ft_total",
  "sq_ft_finished",
  "garage_sq_ft",
  "total_dwelling_sq_ft",
]);

/** Pick first non-null value from obj[key1], obj[key2], ... (case-insensitive keys) */
function pickFirst(obj, ...keys) {
  if (!obj || typeof obj !== "object") return null;
  for (const k of keys) {
    const val = obj[k];
    if (val !== undefined && val !== null && val !== "") return val;
  }
  const lower = Object.fromEntries(
    Object.entries(obj).map(([key, v]) => [key.toLowerCase(), v])
  );
  for (const k of keys) {
    const val = lower[k?.toLowerCase?.() ?? k];
    if (val !== undefined && val !== null && val !== "") return val;
  }
  return null;
}

/** Best-effort street-line extraction from a stored address string. */
function deriveStreetLine1(addressLike) {
  if (typeof addressLike !== "string") return "";
  const trimmed = addressLike.trim();
  if (!trimmed) return "";
  return trimmed.split(",")[0].trim();
}

/** Persist `address_line_1` before ATTOM lookup when older imports only stored `address`. */
async function backfillPropertyStreetLine1(property) {
  if (!property?.id) return property;

  const existingStreet =
    typeof property.address_line_1 === "string"
      ? property.address_line_1.trim()
      : "";
  if (existingStreet) return property;

  const derivedStreet =
    deriveStreetLine1(property.address) ||
    deriveStreetLine1(property.full_address);
  if (!derivedStreet) return property;

  const result = await db.query(
    `UPDATE properties
     SET address_line_1 = $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [derivedStreet, property.id]
  );

  return result.rows[0] || { ...property, address_line_1: derivedStreet };
}

/**
 * Map the ATTOM property response into the flat field schema the frontend expects.
 * Tries multiple key variants (ATTOM docs vary by endpoint/version).
 *
 * @param {Object} prop      Property object from data.property[0]
 * @param {Object} [fullData] Full API response (owner may be at root level)
 * @returns {Object}         Flat camelCase field map (see ATTOM_LOOKUP_FIELDS + estimatedValue)
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
  const owner =
    prop.owner ??
    prop.assessment?.owner ??
    fullData?.owner ??
    fullData?.assessment?.owner ??
    {};
  const sale = prop.sale ?? {};
  const school = prop.school ?? {};

  const lotSize1 = pickFirst(lot, "lotSize1", "lotsize1");
  const lotSize2 = pickFirst(lot, "lotSize2", "lotsize2");
  const lotSizeSqFt =
    lotSize2 ?? (lotSize1 != null ? Math.round(Number(lotSize1) * 43560) : null);
  let lotSize = "";
  if (lotSizeSqFt != null && Number.isFinite(Number(lotSizeSqFt))) {
    lotSize = `${Number(lotSizeSqFt).toLocaleString()} sf`;
  } else if (lotSize1 != null) {
    lotSize = `${lotSize1} acres`;
  }

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

  const basementSqFt = pickFirst(interior, "basementsqft", "basementSqFt");
  const basement =
    basementSqFt != null && Number(basementSqFt) > 0
      ? "Yes"
      : pickFirst(interior, "basement", "hasBasement") || "";

  const fireplaces = pickFirst(interior, "fireplaces", "fireplaceCount") ?? null;
  const fireplaceTypes =
    pickFirst(interior, "fireplacetype", "fireplaceType", "fireplaceDesc") ?? "";

  const estimatedValue =
    pickFirst(assessment, "assessedvalue", "assessedValue", "avm") ??
    pickFirst(tax, "assessedvalue", "assessedValue") ??
    pickFirst(sale, "amount", "saleAmount", "price") ??
    null;

  const county =
    pickFirst(area, "county", "countrysecsubd", "countyName", "munname") ?? "";

  const getOwnerName = (o) => {
    if (!o || typeof o !== "object") return "";
    const name =
      pickFirst(o, "fullName", "fullname") ??
      [o.firstNameAndMi, o.firstnameandmi, o.lastName, o.lastname]
        .filter(Boolean)
        .join(" ")
        .trim();
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
    getOwnerName(owner2) ||
    getOwnerName(owner3) ||
    (Array.isArray(owner?.names) ? owner.names[1] : null) ||
    "";
  const ownerCity =
    pickFirst(owner?.mailingAddress ?? owner, "city", "locality") ?? "";

  const schoolDistrict = pickFirst(school, "district", "districtName", "name") ?? "";
  const elementarySchool =
    pickFirst(school, "elementary", "elementaryName") ?? "";
  const juniorHighSchool =
    pickFirst(school, "juniorHigh", "middleSchool", "juniorHighName") ?? "";
  const seniorHighSchool =
    pickFirst(school, "seniorHigh", "highSchool", "seniorHighName") ?? "";

  return {
    ownerName: String(owner1Name || "").trim(),
    ownerName2: String(owner2Name || "").trim(),
    ownerCity: String(ownerCity || "").trim(),
    taxId: pickFirst(identifier, "apn", "apnOrig", "apnUnformatted") ?? "",
    addressLine2: pickFirst(address, "line2", "lineTwo") ?? "",
    propertyType:
      pickFirst(summary, "propclass", "proptype", "propType", "propertyType") ??
      "",
    subType: pickFirst(summary, "propsubtype", "propSubtype", "subtype") ?? "",
    roofType:
      pickFirst(building?.construction, "rooftype", "roofType", "roof") ??
      pickFirst(building?.utilities, "rooftype") ??
      "",
    yearBuilt:
      pickFirst(summary, "yearbuilt", "yearBuilt", "yearConstructed") ?? null,
    sqFtTotal:
      pickFirst(
        size,
        "universalsize",
        "universalSize",
        "bldgsize",
        "livingsize",
        "grosssize"
      ) ?? null,
    sqFtFinished:
      pickFirst(size, "livingsize", "livingSize", "universalsize", "bldgsize") ??
      null,
    sqFtUnfinished: pickFirst(size, "unfinishedsqft", "unfinishedSqFt") ?? null,
    garageSqFt:
      pickFirst(size, "garagesqft", "garageSqFt") ??
      pickFirst(parking, "prkgSize", "prkgsize") ??
      null,
    totalDwellingSqFt:
      pickFirst(size, "universalsize", "bldgsize", "livingsize", "grosssize") ??
      null,
    lotSize,
    bedCount: pickFirst(rooms, "beds", "bedrooms", "bedCount") ?? null,
    bathCount:
      pickFirst(rooms, "bathstotal", "bathsTotal", "bathrooms", "bathCount") ??
      null,
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

/**
 * Call ATTOM's /property/basicprofile endpoint.
 *
 * Returns a classified result shape (never throws) so the route and the background
 * worker can both inspect `.status` and decide what to do (retry, fail, surface).
 *
 * @param {{ address?: string, addressLine1?: string, city?: string, state?: string, zip?: string }} input
 * @returns {Promise<{
 *   status: 'success' | 'not_found' | 'rate_limited' | 'auth_error' | 'missing_config' | 'invalid_input' | 'error',
 *   httpStatus?: number,
 *   rawProperty?: Object,
 *   fullData?: Object,
 *   message?: string,
 * }>}
 */
async function fetchAttomBasicProfile(input) {
  if (!ATTOM_API_KEY) {
    return { status: "missing_config", message: "ATTOM API key is not configured" };
  }

  const { address, addressLine1, city, state, zip } = input ?? {};
  const streetAddress = (addressLine1 || address || "").trim();
  if (!streetAddress) {
    return {
      status: "invalid_input",
      message: "Street address is required (address or addressLine1)",
    };
  }

  let cityStateZip = "";
  if (city && state) {
    cityStateZip = zip ? `${city}, ${state}, ${zip}` : `${city}, ${state}`;
  } else if (zip) {
    cityStateZip = zip;
  }
  if (!cityStateZip) {
    return { status: "invalid_input", message: "City/State or ZIP is required" };
  }

  const fullAddress = `${streetAddress}, ${cityStateZip}`;
  const params = new URLSearchParams({ address: fullAddress });
  const url = `${ATTOM_BASE_URL}/property/basicprofile?${params.toString()}`;

  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        apikey: ATTOM_API_KEY,
      },
    });
  } catch (netErr) {
    return {
      status: "error",
      message: `ATTOM network error: ${netErr?.message || "unknown"}`,
    };
  }

  const data = await response.json().catch(() => ({}));
  const apiStatus = data?.status ?? {};
  const properties = data?.property ?? [];

  if (!response.ok) {
    if (
      response.status === 400 &&
      (apiStatus.code === 1 || apiStatus.msg === "SuccessWithoutResult")
    ) {
      return {
        status: "not_found",
        httpStatus: response.status,
        message:
          "Property could not be found. Please verify the address and try again.",
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        status: "auth_error",
        httpStatus: response.status,
        message: "ATTOM API authentication failed. Please contact support.",
      };
    }
    if (response.status === 429) {
      return {
        status: "rate_limited",
        httpStatus: response.status,
        message:
          "ATTOM API rate limit reached. Please try again in a few minutes.",
      };
    }
    return {
      status: "error",
      httpStatus: response.status,
      message: `ATTOM API error (${response.status})`,
    };
  }

  if (!Array.isArray(properties) || properties.length === 0) {
    return {
      status: "not_found",
      httpStatus: response.status,
      message:
        "Property could not be found. Please verify the address and try again.",
    };
  }

  return {
    status: "success",
    httpStatus: response.status,
    rawProperty: properties[0],
    fullData: data,
  };
}

/** Coerce a raw field value into the type required by the target DB column. */
function coerceForColumn(column, value) {
  if (value === undefined || value === null || value === "") return null;
  if (INTEGER_COLUMNS.has(column)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.floor(n);
  }
  if (NUMBER_COLUMNS.has(column)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n;
  }
  const str = String(value).trim();
  return str === "" ? null : str;
}

/**
 * From a flat camelCase prediction, build the snake_case column map the worker
 * will merge onto a property. Applies ATTOM_LOOKUP_FIELDS allowlist + per-column
 * type coercion. Returns columns with non-null values only.
 *
 * @param {Object} prediction Output of mapAttomToFields
 * @returns {{ columnValues: Record<string, string|number>, populatedKeys: string[] }}
 */
function buildColumnUpdatesFromPrediction(prediction) {
  const columnValues = {};
  const populatedKeys = [];
  for (const key of ATTOM_LOOKUP_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(prediction, key)) continue;
    const column = CAMEL_TO_SNAKE_COLUMN[key];
    if (!column) continue;
    const coerced = coerceForColumn(column, prediction[key]);
    if (coerced === null || coerced === undefined) continue;
    columnValues[column] = coerced;
    populatedKeys.push(key);
  }
  return { columnValues, populatedKeys };
}

/**
 * Non-destructive merge: only writes ATTOM values into columns that are currently
 * NULL or empty on the property. Preserves user edits and treats the refresh
 * button as a "fill in the blanks" action.
 *
 * Returns the columns/keys that were actually written (after filtering), plus
 * the prior identity_lookup_populated_keys so the caller can persist a union.
 *
 * @param {Object} property       Existing properties row
 * @param {Object} columnValues   Proposed snake_case column updates
 * @param {string[]} populatedKeys Keys backing those columns (camelCase)
 * @returns {{
 *   writableColumns: Record<string, string|number>,
 *   writableCamelKeys: string[],
 *   mergedPopulatedKeys: string[],
 * }}
 */
function filterWritableUpdates(property, columnValues, populatedKeys) {
  const writableColumns = {};
  const writableCamelKeys = [];
  for (const camelKey of populatedKeys) {
    const column = CAMEL_TO_SNAKE_COLUMN[camelKey];
    if (!column) continue;
    const existing = property?.[column];
    const isEmpty =
      existing === null ||
      existing === undefined ||
      existing === "" ||
      (INTEGER_COLUMNS.has(column) && Number(existing) === 0) ||
      (NUMBER_COLUMNS.has(column) && Number(existing) === 0);
    if (!isEmpty) continue;
    writableColumns[column] = columnValues[column];
    writableCamelKeys.push(camelKey);
  }

  const priorKeysRaw = property?.identity_lookup_populated_keys;
  let priorKeys = [];
  if (Array.isArray(priorKeysRaw)) {
    priorKeys = priorKeysRaw;
  } else if (typeof priorKeysRaw === "string" && priorKeysRaw.trim() !== "") {
    try {
      const parsed = JSON.parse(priorKeysRaw);
      if (Array.isArray(parsed)) priorKeys = parsed;
    } catch {
      priorKeys = [];
    }
  }
  const mergedPopulatedKeys = Array.from(
    new Set([...priorKeys.filter((k) => typeof k === "string"), ...writableCamelKeys])
  );

  return { writableColumns, writableCamelKeys, mergedPopulatedKeys };
}

/** Persist merged ATTOM updates onto the property row. */
async function applyAttomUpdateToProperty({
  propertyId,
  columns,
  mergedPopulatedKeys,
}) {
  const columnKeys = Object.keys(columns);
  const setFragments = columnKeys.map(
    (col, i) => `"${col}" = $${i + 1}`
  );
  const values = columnKeys.map((col) => columns[col]);

  setFragments.push(
    `identity_data_source = $${columnKeys.length + 1}`,
    `identity_lookup_populated_keys = $${columnKeys.length + 2}::jsonb`,
    `updated_at = NOW()`
  );
  values.push("attom", JSON.stringify(mergedPopulatedKeys));
  values.push(propertyId);

  const sql = `UPDATE properties SET ${setFragments.join(", ")} WHERE id = $${
    values.length
  } RETURNING id`;

  await db.query(sql, values);
}

/**
 * Worker entry point: execute one ATTOM lookup job by id.
 *
 * Lifecycle:
 *   queued -> processing -> (completed | failed)
 *
 * For transient failures (rate_limited, generic error), the caller (queue) will
 * re-enqueue with increasing run_after until max_attempts is reached.
 *
 * Return shape signals to the queue whether to retry:
 *   { terminal: true, status: 'completed' | 'failed' }  -> done, do not retry
 *   { terminal: false, retryAfterMs: number, reason }   -> try again later
 */
async function runAttomLookupJob(jobId) {
  let job;
  try {
    job = await AttomLookupJob.get(jobId);
  } catch (err) {
    console.error("[attomLookupService] job not found:", jobId, err?.message);
    return { terminal: true, status: "failed" };
  }

  if (job.status === "completed" || job.status === "failed") {
    return { terminal: true, status: job.status };
  }

  await AttomLookupJob.markProcessing(jobId);

  const propRes = await db.query(
    `SELECT * FROM properties WHERE id = $1`,
    [job.property_id]
  );
  let property = propRes.rows[0];
  if (!property) {
    await AttomLookupJob.markFailed(jobId, {
      error_code: "property_missing",
      error_message: "Property no longer exists.",
    });
    return { terminal: true, status: "failed" };
  }

  property = await backfillPropertyStreetLine1(property);

  const lookup = await fetchAttomBasicProfile({
    addressLine1: property.address_line_1,
    address: property.address,
    city: property.city,
    state: property.state,
    zip: property.zip,
  });

  if (lookup.status === "rate_limited") {
    return {
      terminal: false,
      retryAfterMs: 60_000,
      reason: "rate_limited",
      message: lookup.message,
    };
  }

  if (lookup.status === "error") {
    return {
      terminal: false,
      retryAfterMs: 30_000,
      reason: "transient_error",
      message: lookup.message,
    };
  }

  if (lookup.status !== "success") {
    await AttomLookupJob.markFailed(jobId, {
      error_code: lookup.status,
      error_message: lookup.message || "ATTOM lookup failed",
    });
    return { terminal: true, status: "failed" };
  }

  const prediction = mapAttomToFields(lookup.rawProperty, lookup.fullData);
  const { columnValues, populatedKeys } =
    buildColumnUpdatesFromPrediction(prediction);
  const { writableColumns, writableCamelKeys, mergedPopulatedKeys } =
    filterWritableUpdates(property, columnValues, populatedKeys);

  if (Object.keys(writableColumns).length > 0) {
    await applyAttomUpdateToProperty({
      propertyId: job.property_id,
      columns: writableColumns,
      mergedPopulatedKeys,
    });
  } else {
    // Nothing to write (all target columns were already populated). Still record
    // that ATTOM responded for this property so the UI can reflect the source.
    const propHasExistingKeys = Array.isArray(property.identity_lookup_populated_keys)
      || (typeof property.identity_lookup_populated_keys === "string"
          && property.identity_lookup_populated_keys.trim() !== "");
    if (!property.identity_data_source || !propHasExistingKeys) {
      await db.query(
        `UPDATE properties
         SET identity_data_source = COALESCE(identity_data_source, $1),
             identity_lookup_populated_keys = COALESCE(identity_lookup_populated_keys, $2::jsonb),
             updated_at = NOW()
         WHERE id = $3`,
        ["attom", JSON.stringify(mergedPopulatedKeys), job.property_id]
      );
    }
  }

  await AttomLookupJob.markCompleted(jobId, {
    populated_keys: writableCamelKeys,
  });
  return { terminal: true, status: "completed", populatedKeys: writableCamelKeys };
}

module.exports = {
  ATTOM_LOOKUP_FIELDS,
  ATTOM_LOOKUP_FIELDS_SET,
  CAMEL_TO_SNAKE_COLUMN,
  deriveStreetLine1,
  fetchAttomBasicProfile,
  mapAttomToFields,
  buildColumnUpdatesFromPrediction,
  backfillPropertyStreetLine1,
  filterWritableUpdates,
  runAttomLookupJob,
};
