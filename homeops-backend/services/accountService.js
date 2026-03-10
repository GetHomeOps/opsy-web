"use strict";

/**
 * Account Service
 *
 * Generates unique account URLs from names. Used when creating new accounts
 * to ensure URL uniqueness (e.g., "john doe" -> "johndoe" or "johndoe1").
 *
 * Exports: generateAccountUrl
 */

const db = require("../db");

async function generateAccountUrl(name) {
  const baseUrl = name.trim().toLowerCase().split(/\s+/).join("").replace(/[^a-z0-9]/g, "");

  const result = await db.query(
    `SELECT url FROM accounts WHERE url = $1 OR url ~ ('^' || $2 || '[0-9]+$')`,
    [baseUrl, baseUrl]
  );

  if (result.rows.length === 0) return baseUrl;

  const taken = new Set(result.rows.map((r) => r.url));
  if (!taken.has(baseUrl)) return baseUrl;

  let counter = 1;
  while (taken.has(`${baseUrl}${counter}`)) counter++;
  return `${baseUrl}${counter}`;
}

module.exports = { generateAccountUrl };
