"use strict";

const express = require("express");
const { ensureLoggedIn, ensureSuperAdmin } = require("../middleware/auth");
const { BadRequestError } = require("../expressError");
const Agency = require("../models/agency");
const Office = require("../models/office");
const Team = require("../models/team");
const AgentAffiliation = require("../models/agentAffiliation");
const { addPresignedUrlToItem } = require("../helpers/presignedUrls");

const router = express.Router();

function parseRouteId(raw, label = "id") {
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    throw new BadRequestError(`Invalid ${label}`);
  }
  return id;
}

function listQueryFilters(query) {
  return {
    q: query.q,
    status: query.status,
    states: query.state,
    cities: query.city,
  };
}

async function enrichAgency(agency) {
  if (!agency) return agency;
  return addPresignedUrlToItem(agency, "logoUrl", "logoDisplayUrl");
}

/** GET /facets — distinct state/city values for admin filters */
router.get("/facets", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const filters = listQueryFilters(req.query);
    const [states, cities] = await Promise.all([
      Agency.listDistinctStates(filters),
      Agency.listDistinctCities(filters),
    ]);
    return res.json({ states, cities });
  } catch (err) {
    return next(err);
  }
});

/** GET / — paginated agency list (super admin; logos presigned client-side) */
router.get("/", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const filters = listQueryFilters(req.query);
    const [agencies, total] = await Promise.all([
      Agency.listAll({
        ...filters,
        sortBy: req.query.sortBy,
        sortDir: req.query.sortDir,
        limit: req.query.limit,
        offset: req.query.offset,
      }),
      Agency.countAll(filters),
    ]);
    return res.json({ agencies, total });
  } catch (err) {
    return next(err);
  }
});

/** POST / — create a single approved agency (+ default office) */
router.post("/", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) throw new BadRequestError("name is required");

    const existing = await Agency.findApprovedByName(name);
    if (existing) {
      throw new BadRequestError(`An approved agency named "${name}" already exists`);
    }

    const result = await Agency.createApprovedWithDefaultOffice({
      name,
      legalName: req.body.legalName || req.body.legal_name || null,
      website: req.body.website || null,
      addressLine1: req.body.addressLine1 || req.body.address_line1 || null,
      city: req.body.city || null,
      state: req.body.state || null,
      phone: req.body.phone || null,
      logoUrl: req.body.logoUrl || req.body.logo_url || null,
      officeName: req.body.officeName || req.body.office_name || null,
    });
    return res.status(201).json({
      agency: await enrichAgency(result.agency),
      office: result.office,
    });
  } catch (err) {
    return next(err);
  }
});

function agentListFilters(query) {
  return {
    q: query.q || "",
    agencies: query.agency,
    offices: query.office,
    teams: query.team,
  };
}

/** GET /agents/facets — distinct agency/office/team options for agent filters */
router.get("/agents/facets", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const filters = agentListFilters(req.query);
    const [agencies, offices, teams] = await Promise.all([
      AgentAffiliation.listDistinctAgenciesForAdmin(filters),
      AgentAffiliation.listDistinctOfficesForAdmin(filters),
      AgentAffiliation.listDistinctTeamsForAdmin(filters),
    ]);
    return res.json({ agencies, offices, teams });
  } catch (err) {
    return next(err);
  }
});

/** GET /agents — list agents with active agency/office/team affiliations */
router.get("/agents", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const limit = req.query.limit;
    const offset = req.query.offset;
    const filters = agentListFilters(req.query);
    const [agents, total] = await Promise.all([
      AgentAffiliation.listAgentsForAdmin({
        ...filters,
        limit,
        offset,
        sortBy: req.query.sortBy,
        sortDir: req.query.sortDir,
      }),
      AgentAffiliation.countAgentsForAdmin(filters),
    ]);
    return res.json({ agents, total });
  } catch (err) {
    return next(err);
  }
});

/** POST /import — bulk create approved agencies from parsed rows */
router.post("/import", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const rows = req.body.agencies;
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestError("agencies array is required");
    }
    if (rows.length > 500) {
      throw new BadRequestError("Maximum 500 agencies per import");
    }

    const created = [];
    const skipped = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const name = String(row.name || "").trim();
      if (!name) {
        errors.push({ row: i + 1, message: "name is required" });
        continue;
      }
      try {
        const existing = await Agency.findApprovedByName(name);
        if (existing) {
          skipped.push({ row: i + 1, name, reason: "already exists", agencyId: existing.id });
          continue;
        }
        const result = await Agency.createApprovedWithDefaultOffice({
          name,
          legalName: row.legalName || row.legal_name || null,
          website: row.website || null,
          addressLine1: row.addressLine1 || row.address_line1 || null,
          city: row.city || null,
          state: row.state || null,
          phone: row.phone || null,
          logoUrl: row.logoUrl || row.logo_url || null,
          officeName: row.officeName || row.office_name || null,
        });
        created.push({ row: i + 1, name, agencyId: result.agency.id, officeId: result.office.id });
      } catch (err) {
        errors.push({ row: i + 1, name, message: err.message || "Failed to create agency" });
      }
    }

    return res.json({
      summary: {
        total: rows.length,
        created: created.length,
        skipped: skipped.length,
        errors: errors.length,
      },
      created,
      skipped,
      errors,
    });
  } catch (err) {
    return next(err);
  }
});

/** GET /:id/offices — list offices for agency */
router.get("/:id/offices", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const agencyId = parseRouteId(req.params.id, "agency id");
    await Agency.getById(agencyId);
    const offices = await Office.listApprovedByAgency(agencyId);
    return res.json({ offices });
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/offices — add office to agency */
router.post("/:id/offices", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const agencyId = parseRouteId(req.params.id, "agency id");
    await Agency.getById(agencyId);
    const name = String(req.body.name || "").trim();
    if (!name) throw new BadRequestError("name is required");

    const existing = await Office.findApprovedByName(agencyId, name);
    if (existing) {
      throw new BadRequestError(`An office named "${name}" already exists for this agency`);
    }

    const office = await Office.createApproved({
      agencyId,
      name,
      addressLine1: req.body.addressLine1 || req.body.address_line1 || null,
      city: req.body.city || null,
      state: req.body.state || null,
      zip: req.body.zip || null,
      phone: req.body.phone || null,
    });
    return res.status(201).json({ office });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /:id/offices/:officeId — update office */
router.patch("/:id/offices/:officeId", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const agencyId = parseRouteId(req.params.id, "agency id");
    const officeId = parseRouteId(req.params.officeId, "office id");
    await Agency.getById(agencyId);
    const office = await Office.getById(officeId);
    if (Number(office.agencyId) !== agencyId) {
      throw new BadRequestError("Office does not belong to this agency");
    }

    const body = req.body || {};
    const updates = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) throw new BadRequestError("name cannot be empty");
      if (name.toLowerCase() !== (office.name || "").trim().toLowerCase()) {
        const existing = await Office.findApprovedByName(agencyId, name);
        if (existing && existing.id !== officeId) {
          throw new BadRequestError(`An office named "${name}" already exists for this agency`);
        }
      }
      updates.name = name;
    }
    if (body.addressLine1 !== undefined || body.address_line1 !== undefined) {
      const v = body.addressLine1 ?? body.address_line1;
      updates.addressLine1 = v != null && String(v).trim() ? String(v).trim() : null;
    }
    if (body.city !== undefined) {
      updates.city = body.city != null && String(body.city).trim() ? String(body.city).trim() : null;
    }
    if (body.state !== undefined) {
      updates.state = body.state != null && String(body.state).trim() ? String(body.state).trim() : null;
    }
    if (body.zip !== undefined) {
      updates.zip = body.zip != null && String(body.zip).trim() ? String(body.zip).trim() : null;
    }
    if (body.phone !== undefined) {
      updates.phone = body.phone != null && String(body.phone).trim() ? String(body.phone).trim() : null;
    }

    const updated = await Office.update(officeId, updates);
    return res.json({ office: updated });
  } catch (err) {
    return next(err);
  }
});

/** GET /:id/teams — list teams across all offices for agency */
router.get("/:id/teams", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const agencyId = parseRouteId(req.params.id, "agency id");
    await Agency.getById(agencyId);
    const teams = await Team.listApprovedByAgency(agencyId, { q: req.query.q });
    return res.json({ teams });
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/teams — add team to an office */
router.post("/:id/teams", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const agencyId = Number(req.params.id);
    const officeId = Number(req.body.officeId || req.body.office_id);
    const name = String(req.body.name || "").trim();
    if (!officeId) throw new BadRequestError("officeId is required");
    if (!name) throw new BadRequestError("name is required");

    const office = await Office.getById(officeId);
    if (Number(office.agencyId) !== agencyId) {
      throw new BadRequestError("Office does not belong to this agency");
    }

    const existing = await Team.findApprovedByName(officeId, name);
    if (existing) {
      throw new BadRequestError(`A team named "${name}" already exists for this office`);
    }

    const team = await Team.createApproved({ officeId, name });
    return res.status(201).json({ team: { ...team, officeName: office.name } });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /:id/teams/:teamId — update team */
router.patch("/:id/teams/:teamId", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const agencyId = parseRouteId(req.params.id, "agency id");
    const teamId = parseRouteId(req.params.teamId, "team id");
    await Agency.getById(agencyId);
    const team = await Team.getById(teamId);
    const currentOffice = await Office.getById(team.officeId);
    if (Number(currentOffice.agencyId) !== agencyId) {
      throw new BadRequestError("Team does not belong to this agency");
    }

    const body = req.body || {};
    const updates = {};
    let targetOfficeId = team.officeId;

    if (body.officeId !== undefined || body.office_id !== undefined) {
      targetOfficeId = Number(body.officeId ?? body.office_id);
      if (!targetOfficeId) throw new BadRequestError("officeId is required");
      const targetOffice = await Office.getById(targetOfficeId);
      if (Number(targetOffice.agencyId) !== agencyId) {
        throw new BadRequestError("Office does not belong to this agency");
      }
      updates.officeId = targetOfficeId;
    }

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) throw new BadRequestError("name cannot be empty");
      if (name.toLowerCase() !== (team.name || "").trim().toLowerCase()) {
        const existing = await Team.findApprovedByName(targetOfficeId, name);
        if (existing && existing.id !== teamId) {
          throw new BadRequestError(`A team named "${name}" already exists for this office`);
        }
      }
      updates.name = name;
    }

    const updated = await Team.update(teamId, updates);
    return res.json({ team: updated });
  } catch (err) {
    return next(err);
  }
});

/** GET /:id — single agency */
router.get("/:id", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const agency = await Agency.getById(parseRouteId(req.params.id, "agency id"));
    return res.json({ agency: await enrichAgency(agency) });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /:id — update agency fields (including logo S3 key or URL) */
router.patch("/:id", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const id = parseRouteId(req.params.id, "agency id");
    const body = req.body || {};
    const updates = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) throw new BadRequestError("name cannot be empty");
      updates.name = name;
    }
    if (body.legalName !== undefined || body.legal_name !== undefined) {
      const v = body.legalName ?? body.legal_name;
      updates.legalName = v != null && String(v).trim() ? String(v).trim() : null;
    }
    if (body.website !== undefined) {
      updates.website = body.website != null && String(body.website).trim()
        ? String(body.website).trim()
        : null;
    }
    if (body.addressLine1 !== undefined || body.address_line1 !== undefined) {
      const v = body.addressLine1 ?? body.address_line1;
      updates.addressLine1 = v != null && String(v).trim() ? String(v).trim() : null;
    }
    if (body.city !== undefined) {
      updates.city = body.city != null && String(body.city).trim() ? String(body.city).trim() : null;
    }
    if (body.state !== undefined) {
      updates.state = body.state != null && String(body.state).trim()
        ? String(body.state).trim()
        : null;
    }
    if (body.phone !== undefined) {
      updates.phone = body.phone != null && String(body.phone).trim()
        ? String(body.phone).trim()
        : null;
    }
    if (body.logoUrl !== undefined || body.logo_url !== undefined) {
      const v = body.logoUrl ?? body.logo_url;
      updates.logoUrl = v != null && String(v).trim() ? String(v).trim() : null;
    }

    const agency = await Agency.update(id, updates);
    return res.json({ agency: await enrichAgency(agency) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
