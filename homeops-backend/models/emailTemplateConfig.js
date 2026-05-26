"use strict";

const db = require("../db");
const { NotFoundError, BadRequestError } = require("../expressError");
const { SWITCHABLE_EMAIL_TYPES, EMAIL_TYPE_KEYS } = require("../constants/emailTypes");
const {
  getDefaultSesTemplate,
  isLegacySesTemplate,
} = require("../data/emailTemplateDefaults");

const COLS = `email_type AS "emailType", provider, is_switchable AS "isSwitchable",
  label, description,
  ses_subject AS "sesSubject", ses_html_body AS "sesHtmlBody",
  show_footer AS "showFooter", footer_image_url AS "footerImageUrl",
  customer_io_mode AS "customerIoMode",
  customer_io_transactional_id AS "customerIoTransactionalId",
  customer_io_event_name AS "customerIoEventName",
  merge_variables AS "mergeVariables",
  updated_at AS "updatedAt"`;

function mapRow(row) {
  if (!row) return row;
  return {
    ...row,
    mergeVariables: row.mergeVariables || [],
    showFooter: row.showFooter !== false,
  };
}

let schemaReady = false;
let seededOnce = false;

async function ensureSchema() {
  if (schemaReady) return;
  await db.query(
    `ALTER TABLE email_template_configs
       ADD COLUMN IF NOT EXISTS show_footer BOOLEAN NOT NULL DEFAULT true`
  );
  await db.query(
    `ALTER TABLE email_template_configs
       ADD COLUMN IF NOT EXISTS footer_image_url TEXT`
  );
  schemaReady = true;
}

class EmailTemplateConfig {
  static async ensureSeeded() {
    await ensureSchema();
    if (seededOnce) return;
    for (const emailType of EMAIL_TYPE_KEYS) {
      const meta = SWITCHABLE_EMAIL_TYPES[emailType];
      const defaults = getDefaultSesTemplate(emailType);
      await db.query(
        `INSERT INTO email_template_configs (
           email_type, provider, is_switchable, label, description,
           ses_subject, ses_html_body, customer_io_mode, customer_io_event_name,
           merge_variables
         )
         VALUES ($1, 'inherit', true, $2, $3, $4, $5, 'event', $6, $7::jsonb)
         ON CONFLICT (email_type) DO NOTHING`,
        [
          emailType,
          meta.label,
          meta.description,
          defaults.subject,
          defaults.htmlBody,
          meta.customerIoDefaultEvent,
          JSON.stringify(meta.mergeVariables),
        ]
      );
      // Always keep label/description/merge variable docs in sync.
      await db.query(
        `UPDATE email_template_configs
           SET label = $2,
               description = $3,
               merge_variables = $4::jsonb
         WHERE email_type = $1`,
        [emailType, meta.label, meta.description, JSON.stringify(meta.mergeVariables)]
      );

      // One-time upgrade: replace legacy body+footer templates with the new
      // body-only defaults so the rich editor has clean content to work with.
      const existing = await db.query(
        `SELECT ses_html_body FROM email_template_configs WHERE email_type = $1`,
        [emailType]
      );
      const storedHtml = existing.rows[0]?.ses_html_body;
      if (isLegacySesTemplate(emailType, storedHtml)) {
        await db.query(
          `UPDATE email_template_configs
             SET ses_subject = $2,
                 ses_html_body = $3,
                 show_footer = true,
                 footer_image_url = NULL,
                 updated_at = NOW()
           WHERE email_type = $1`,
          [emailType, defaults.subject, defaults.htmlBody]
        );
      }
    }
    seededOnce = true;
  }

  /** Force re-running the seed + legacy upgrade pass (used after manual edits). */
  static resetSeedCache() {
    seededOnce = false;
  }

  static async listAll() {
    await this.ensureSeeded();
    const result = await db.query(
      `SELECT ${COLS} FROM email_template_configs ORDER BY label`
    );
    return result.rows.map(mapRow);
  }

  static async getByType(emailType) {
    await this.ensureSeeded();
    const result = await db.query(
      `SELECT ${COLS} FROM email_template_configs WHERE email_type = $1`,
      [emailType]
    );
    if (!result.rows[0]) {
      throw new NotFoundError(`Email template config not found: ${emailType}`);
    }
    return mapRow(result.rows[0]);
  }

  static async update(emailType, data) {
    if (!EMAIL_TYPE_KEYS.includes(emailType)) {
      throw new BadRequestError(`Unknown email type: ${emailType}`);
    }

    const allowed = {
      provider: "provider",
      sesSubject: "ses_subject",
      sesHtmlBody: "ses_html_body",
      showFooter: "show_footer",
      footerImageUrl: "footer_image_url",
      customerIoMode: "customer_io_mode",
      customerIoTransactionalId: "customer_io_transactional_id",
      customerIoEventName: "customer_io_event_name",
    };

    const sets = [];
    const values = [];
    let idx = 1;

    for (const [camel, col] of Object.entries(allowed)) {
      if (data[camel] !== undefined) {
        sets.push(`${col} = $${idx}`);
        values.push(data[camel]);
        idx++;
      }
    }

    if (sets.length === 0) {
      throw new BadRequestError("No data to update");
    }

    sets.push("updated_at = NOW()");
    values.push(emailType);

    const result = await db.query(
      `UPDATE email_template_configs SET ${sets.join(", ")}
       WHERE email_type = $${idx}
       RETURNING ${COLS}`,
      values
    );
    if (!result.rows[0]) {
      throw new NotFoundError(`Email template config not found: ${emailType}`);
    }
    return mapRow(result.rows[0]);
  }

  static async resetSesTemplate(emailType) {
    const defaults = getDefaultSesTemplate(emailType);
    if (!defaults) {
      throw new BadRequestError(`No default template for: ${emailType}`);
    }
    return this.update(emailType, {
      sesSubject: defaults.subject,
      sesHtmlBody: defaults.htmlBody,
      showFooter: true,
      footerImageUrl: null,
    });
  }
}

module.exports = EmailTemplateConfig;
