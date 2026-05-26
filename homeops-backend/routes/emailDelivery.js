"use strict";

const express = require("express");
const jsonschema = require("jsonschema");
const { ensureLoggedIn, ensureSuperAdmin } = require("../middleware/auth");
const { BadRequestError } = require("../expressError");
const { EMAIL_BRAND_NAME } = require("../config");
const PlatformEmailSettings = require("../models/platformEmailSettings");
const EmailTemplateConfig = require("../models/emailTemplateConfig");
const emailProviderRouter = require("../services/emailProviderRouter");
const customerIoProvider = require("../services/emailProviders/customerIoProvider");
const sesProvider = require("../services/emailProviders/sesProvider");
const {
  getDefaultSesTemplate,
  getSampleMergeData,
} = require("../data/emailTemplateDefaults");
const {
  renderTemplate,
  enrichMergeData,
  stripUnusedMergeTags,
} = require("../services/emailTemplateRenderer");
const { wrapEmailHtml } = require("../services/emailComposer");
const { toPreviewHtml, toStorageHtml, getFooterPreviewUrl } = require("../services/emailPreviewHtml");
const settingsUpdateSchema = require("../schemas/emailDeliverySettingsUpdate.json");
const templateUpdateSchema = require("../schemas/emailTemplateConfigUpdate.json");

const router = express.Router();

function resolveActiveProvider(template, settings) {
  return template.provider === "inherit" ? settings.defaultProvider : template.provider;
}

function configStatus(template, settings) {
  const provider = resolveActiveProvider(template, settings);
  if (provider === "ses") {
    return sesProvider.isSesConfigured() ? "ready" : "ses_not_configured";
  }
  if (!customerIoProvider.isCustomerIoConfigured()) {
    return "customer_io_not_configured";
  }
  const mode = template.customerIoMode || "event";
  if (mode === "transactional" && !template.customerIoTransactionalId) {
    return "missing_transactional_id";
  }
  if (mode === "event" && !template.customerIoEventName) {
    return "missing_event_name";
  }
  if (mode === "both") {
    if (!template.customerIoTransactionalId || !template.customerIoEventName) {
      return "missing_customer_io_config";
    }
  }
  return "ready";
}

function previewFooterImageUrl(template) {
  if (template.footerImageUrl && String(template.footerImageUrl).trim()) {
    return String(template.footerImageUrl).trim();
  }
  return getFooterPreviewUrl();
}

/** GET /settings — global email delivery settings */
router.get("/settings", ensureLoggedIn, ensureSuperAdmin, async (req, res, next) => {
  try {
    const settings = await PlatformEmailSettings.get();
    return res.json({
      settings,
      customerIoConfigured: customerIoProvider.isCustomerIoConfigured(),
      sesConfigured: sesProvider.isSesConfigured(),
      customerIoWorkspaceUrl: customerIoProvider.getCustomerIoWorkspaceUrl(),
      fallbackToSes: process.env.EMAIL_FALLBACK_TO_SES !== "false",
    });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /settings — update global default provider */
router.patch("/settings", ensureLoggedIn, ensureSuperAdmin, async (req, res, next) => {
  try {
    const validator = jsonschema.validate(req.body, settingsUpdateSchema);
    if (!validator.valid) {
      throw new BadRequestError(validator.errors.map((e) => e.stack));
    }
    const settings = await PlatformEmailSettings.update({
      defaultProvider: req.body.defaultProvider,
      updatedBy: res.locals.user?.id,
    });
    emailProviderRouter.invalidateCache();
    return res.json({ settings });
  } catch (err) {
    return next(err);
  }
});

/** GET /templates — list all email template configs */
router.get("/templates", ensureLoggedIn, ensureSuperAdmin, async (req, res, next) => {
  try {
    const [settings, templates] = await Promise.all([
      PlatformEmailSettings.get(),
      EmailTemplateConfig.listAll(),
    ]);
    const enriched = templates.map((t) => ({
      ...t,
      activeProvider: resolveActiveProvider(t, settings),
      status: configStatus(t, settings),
    }));
    return res.json({ templates: enriched, settings });
  } catch (err) {
    return next(err);
  }
});

/** GET /templates/:emailType — single template config + preview */
router.get("/templates/:emailType", ensureLoggedIn, ensureSuperAdmin, async (req, res, next) => {
  try {
    const [settings, template] = await Promise.all([
      PlatformEmailSettings.get(),
      EmailTemplateConfig.getByType(req.params.emailType),
    ]);
    const sampleMergeData = enrichMergeData(getSampleMergeData(req.params.emailType));
    const defaults = getDefaultSesTemplate(req.params.emailType) || {};
    const rawSubject = template.sesSubject || defaults.subject || "";
    const rawBody = template.sesHtmlBody || defaults.htmlBody || "";

    const renderedSubject = renderTemplate(rawSubject, sampleMergeData);
    const renderedBody = stripUnusedMergeTags(renderTemplate(rawBody, sampleMergeData));
    const previewHtml = wrapEmailHtml(renderedBody, {
      showFooter: template.showFooter !== false,
      footerImageUrl: previewFooterImageUrl(template),
      footerLinkUrl: process.env.EMAIL_FOOTER_LINK_URL || "https://heyopsy.com",
      brandName: EMAIL_BRAND_NAME,
    });

    return res.json({
      template: {
        ...template,
        activeProvider: resolveActiveProvider(template, settings),
        status: configStatus(template, settings),
      },
      rawTemplate: { subject: rawSubject, body: rawBody },
      sampleMergeData,
      preview: { subject: renderedSubject, html: previewHtml },
      defaults: { subject: defaults.subject || "", body: defaults.htmlBody || "" },
    });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /templates/:emailType — update template config */
router.patch("/templates/:emailType", ensureLoggedIn, ensureSuperAdmin, async (req, res, next) => {
  try {
    const validator = jsonschema.validate(req.body, templateUpdateSchema);
    if (!validator.valid) {
      throw new BadRequestError(validator.errors.map((e) => e.stack));
    }
    const template = await EmailTemplateConfig.update(req.params.emailType, {
      ...req.body,
      ...(req.body.sesHtmlBody !== undefined
        ? { sesHtmlBody: toStorageHtml(req.body.sesHtmlBody) }
        : {}),
      ...(req.body.footerImageUrl !== undefined
        ? {
            footerImageUrl:
              req.body.footerImageUrl == null ||
              String(req.body.footerImageUrl).trim() === ""
                ? null
                : String(req.body.footerImageUrl).trim(),
          }
        : {}),
    });
    emailProviderRouter.invalidateCache();
    const settings = await PlatformEmailSettings.get();
    return res.json({
      template: {
        ...template,
        activeProvider: resolveActiveProvider(template, settings),
        status: configStatus(template, settings),
      },
    });
  } catch (err) {
    return next(err);
  }
});

/** POST /templates/:emailType/reset — reset SES template to defaults */
router.post("/templates/:emailType/reset", ensureLoggedIn, ensureSuperAdmin, async (req, res, next) => {
  try {
    const template = await EmailTemplateConfig.resetSesTemplate(req.params.emailType);
    emailProviderRouter.invalidateCache();
    return res.json({ template });
  } catch (err) {
    return next(err);
  }
});

/** POST /templates/:emailType/test — send test email */
router.post("/templates/:emailType/test", ensureLoggedIn, ensureSuperAdmin, async (req, res, next) => {
  try {
    const testSendSchema = require("../schemas/emailDeliveryTestSend.json");
    const validator = jsonschema.validate(req.body, testSendSchema);
    if (!validator.valid) {
      throw new BadRequestError(validator.errors.map((e) => e.stack));
    }
    const emailType = req.params.emailType;
    const to = String(req.body.to || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      throw new BadRequestError("A valid recipient email is required.");
    }
    const sampleMergeData = enrichMergeData(getSampleMergeData(emailType));
    const defaults = getDefaultSesTemplate(emailType);
    const template = await EmailTemplateConfig.getByType(emailType);
    const subject = renderTemplate(
      template.sesSubject || defaults?.subject || "Test email",
      sampleMergeData
    );
    const html = stripUnusedMergeTags(
      renderTemplate(template.sesHtmlBody || defaults?.htmlBody || "<p>Test</p>", sampleMergeData)
    );

    const result = await emailProviderRouter.deliver({
      emailType,
      to,
      subject,
      html,
      mergeData: sampleMergeData,
      usage: undefined,
    });
    return res.json({ success: true, result, sentTo: to });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /templates/:emailType/test-customer-io-event
 * Identify + track the template's Customer.io event with sample merge data (journey testing).
 * Does not use the active email provider — useful when the type is on SES but you test a CIO flow.
 */
router.post(
  "/templates/:emailType/test-customer-io-event",
  ensureLoggedIn,
  ensureSuperAdmin,
  async (req, res, next) => {
    try {
      const testSendSchema = require("../schemas/emailDeliveryTestSend.json");
      const validator = jsonschema.validate(req.body, testSendSchema);
      if (!validator.valid) {
        throw new BadRequestError(validator.errors.map((e) => e.stack));
      }
      if (!customerIoProvider.isCustomerIoConfigured()) {
        throw new BadRequestError("Customer.io is not configured for this environment.");
      }
      const emailType = req.params.emailType;
      const to = String(req.body.to || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        throw new BadRequestError("A valid recipient email is required.");
      }

      const template = await EmailTemplateConfig.getByType(emailType);
      const eventName = String(template.customerIoEventName || "").trim();
      if (!eventName) {
        throw new BadRequestError(
          "Configure an Event name for this template (Customer.io mode) before sending a test event."
        );
      }

      const sampleMergeData = enrichMergeData(getSampleMergeData(emailType));

      await customerIoProvider.identifyPerson({
        email: to,
        attributes: {
          ...(sampleMergeData.inviteeName || sampleMergeData.userName
            ? { name: sampleMergeData.inviteeName || sampleMergeData.userName }
            : {}),
        },
      });
      await customerIoProvider.trackEvent({
        email: to,
        eventName,
        data: sampleMergeData,
      });

      return res.json({ success: true, sentTo: to, eventName });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
