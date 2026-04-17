"use strict";

/**
 * Export / import professional category tree including S3 image_key values.
 * Import upserts by (parent name) and (parent + child name); does not delete missing categories.
 */

const { BadRequestError } = require("../expressError");
const ProfessionalCategory = require("../models/professionalCategory");

const FORMAT = "opsy-professional-categories";

function stripCategoryForExport(row) {
  if (!row) return null;
  return {
    name: row.name,
    description: row.description ?? null,
    icon: row.icon ?? null,
    image_key: row.image_key ?? null,
    sort_order: row.sort_order ?? 0,
    is_active: row.is_active !== false,
  };
}

async function buildExportDocument() {
  const hierarchy = await ProfessionalCategory.getHierarchy();
  const categories = hierarchy.map((parent) => ({
    ...stripCategoryForExport(parent),
    children: (parent.children || []).map((c) => stripCategoryForExport(c)),
  }));
  return {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    categories,
  };
}

function coerceBool(v, defaultVal = true) {
  if (v === undefined || v === null) return defaultVal;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["false", "0", "no"].includes(s)) return false;
  if (["true", "1", "yes"].includes(s)) return true;
  return defaultVal;
}

function numOr(v, d) {
  if (v === undefined || v === null || v === "") return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function normStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function normalizeImportedParent(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim();
  if (!name) return null;
  return {
    name,
    description: normStr(raw.description),
    icon: normStr(raw.icon),
    image_key: normStr(raw.image_key),
    sort_order: numOr(raw.sort_order, 0),
    is_active: coerceBool(raw.is_active, true),
    children: Array.isArray(raw.children) ? raw.children : [],
  };
}

function normalizeImportedChild(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim();
  if (!name) return null;
  return {
    name,
    description: normStr(raw.description),
    icon: normStr(raw.icon),
    image_key: normStr(raw.image_key),
    sort_order: numOr(raw.sort_order, 0),
    is_active: coerceBool(raw.is_active, true),
  };
}

function normalizePayload(payload) {
  if (payload == null) {
    throw new BadRequestError("Import payload must be a JSON object or array");
  }
  if (Array.isArray(payload)) {
    const parents = [];
    for (const item of payload) {
      const p = normalizeImportedParent(item);
      if (!p) throw new BadRequestError("Each parent category must have a non-empty name");
      parents.push(p);
    }
    return parents;
  }
  if (typeof payload !== "object") {
    throw new BadRequestError("Import payload must be a JSON object or array");
  }
  const body = { ...payload };
  delete body.mergeMissingOnly;
  let rawList = body.categories;
  if (!rawList && Array.isArray(body.hierarchy)) rawList = body.hierarchy;
  if (!rawList || !Array.isArray(rawList)) {
    throw new BadRequestError('Expected a "categories" array or "hierarchy"');
  }
  const parents = [];
  for (const item of rawList) {
    const p = normalizeImportedParent(item);
    if (!p) throw new BadRequestError("Each parent category must have a non-empty name");
    parents.push(p);
  }
  return parents;
}

function isDbTextEmpty(v) {
  return v == null || String(v).trim() === "";
}

/** For existing rows: only fill string columns that are empty in DB when import has a value. */
function buildMergePatchForExisting(existing, incoming) {
  const patch = {};
  const desc = mergeTextField(existing.description, incoming.description);
  if (desc !== undefined) patch.description = desc;
  const icon = mergeTextField(existing.icon, incoming.icon);
  if (icon !== undefined) patch.icon = icon;
  const imageKey = mergeTextField(existing.image_key, incoming.image_key);
  if (imageKey !== undefined) patch.image_key = imageKey;
  return patch;
}

function mergeTextField(dbVal, importVal) {
  if (!isDbTextEmpty(dbVal)) return undefined;
  const n = normStr(importVal);
  if (n == null) return undefined;
  return n;
}

function fullParentUpdateFields(p) {
  return {
    description: p.description,
    icon: p.icon,
    image_key: p.image_key,
    sort_order: p.sort_order,
    is_active: p.is_active,
  };
}

function fullChildUpdateFields(c, parentId) {
  return {
    description: c.description,
    icon: c.icon,
    image_key: c.image_key,
    sort_order: c.sort_order,
    is_active: c.is_active,
    parent_id: parentId,
    type: "child",
  };
}

/**
 * @param {object|Array} payload — export document, seed-style array, or { categories: [...] }
 * @param {{ mergeMissingOnly?: boolean }} [options] — when true (default), existing categories only get empty description/icon/image_key filled from import
 * @returns {{ created: number, updated: number, unchanged: number }}
 */
async function importCategories(payload, options = {}) {
  const mergeMissingOnly = options.mergeMissingOnly !== false;
  const parents = normalizePayload(payload);
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const p of parents) {
    const parentRow = await ProfessionalCategory.findParentByNameInsensitive(p.name);

    let parentId;
    if (parentRow) {
      parentId = parentRow.id;
      if (mergeMissingOnly) {
        const patch = buildMergePatchForExisting(parentRow, p);
        if (Object.keys(patch).length > 0) {
          await ProfessionalCategory.update(parentRow.id, patch);
          updated++;
        } else {
          unchanged++;
        }
      } else {
        await ProfessionalCategory.update(parentRow.id, fullParentUpdateFields(p));
        updated++;
      }
    } else {
      const row = await ProfessionalCategory.create({
        name: p.name,
        description: p.description,
        type: "parent",
        parent_id: null,
        icon: p.icon,
        image_key: p.image_key,
        sort_order: p.sort_order,
        is_active: p.is_active,
      });
      parentId = row.id;
      created++;
    }

    for (const cRaw of p.children) {
      const c = normalizeImportedChild(cRaw);
      if (!c) throw new BadRequestError("Each subcategory must have a non-empty name");

      const childRow = await ProfessionalCategory.findChildByParentAndNameInsensitive(parentId, c.name);

      if (childRow) {
        if (mergeMissingOnly) {
          const patch = buildMergePatchForExisting(childRow, c);
          if (Object.keys(patch).length > 0) {
            await ProfessionalCategory.update(childRow.id, patch);
            updated++;
          } else {
            unchanged++;
          }
        } else {
          await ProfessionalCategory.update(childRow.id, fullChildUpdateFields(c, parentId));
          updated++;
        }
      } else {
        await ProfessionalCategory.create({
          name: c.name,
          description: c.description,
          type: "child",
          parent_id: parentId,
          icon: c.icon,
          image_key: c.image_key,
          sort_order: c.sort_order,
          is_active: c.is_active,
        });
        created++;
      }
    }
  }

  return { created, updated, unchanged };
}

module.exports = {
  FORMAT,
  buildExportDocument,
  importCategories,
};
