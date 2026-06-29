/**
 * Express Application
 *
 * Configures the main Express app: CORS, compression, JSON parsing,
 * JWT authentication, and route mounting. All API routes are mounted
 * under their respective paths. 404 and error handlers at the end.
 *
 * Route prefixes:
 * - /auth, /users, /accounts, /contacts, /properties
 * - /systems, /maintenance, /documents, /propertyDocuments
 * - /subscriptions, /subscription-products, /invitations
 * - /engagement, /analytics, /predict
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require("multer");
const { NotFoundError } = require("./expressError");
const { documentFileTooLargeMessage } = require("./constants/documentUpload");
const { authenticateJWT, ensureLoggedIn } = require("./middleware/auth");

const authRoutes = require("./routes/auth");
const mfaRoutes = require("./routes/mfa");
const usersRoutes = require("./routes/users");
const accountsRoutes = require("./routes/accounts");
const contactsRoutes = require("./routes/contacts");
const propertiesRoutes = require("./routes/properties");
const systemsRoutes = require("./routes/systems");
const maintenanceRecordsRoutes = require("./routes/maintenanceRecords");
const documentsRoutes = require("./routes/documents");
const propertyDocumentsRoutes = require("./routes/propertyDocuments");
const propertyNotesRoutes = require("./routes/propertyNotes");
const stagedDocumentsRoutes = require("./routes/stagedDocuments");
const subscriptionsRoutes = require("./routes/subscriptions");
const subscriptionProductsRoutes = require("./routes/subscriptionProducts");
const systemRecommendationTemplatesRoutes = require("./routes/systemRecommendationTemplates");
const invitationsRoutes = require("./routes/invitations");
const platformEngagementRoutes = require("./routes/platformEngagement");
const platformAnalyticsRoutes = require("./routes/platformAnalytics");
const propertyPredictRoutes = require("./routes/propertyPredict");
const professionalCategoriesRoutes = require("./routes/professionalCategories");
const professionalsRoutes = require("./routes/professionals");
const maintenanceEventsRoutes = require("./routes/maintenanceEvents");
const savedProfessionalsRoutes = require("./routes/savedProfessionals");
const supportTicketsRoutes = require("./routes/supportTickets");
const resourcesRoutes = require("./routes/resources");
const communicationsRoutes = require("./routes/communications");
const notificationsRoutes = require("./routes/notifications");
const homeownerAgentInquiriesRoutes = require("./routes/homeownerAgentInquiries");
const conversationsRoutes = require("./routes/conversations");
const inspectionAnalysisRoutes = require("./routes/inspectionAnalysis");
const inspectionReviewRoutes = require("./routes/inspectionReviews");
const documentAnalysisRoutes = require("./routes/documentAnalysis");
const inspectionChecklistRoutes = require("./routes/inspectionChecklist");
const aiRoutes = require("./routes/ai");
const webhookRoutes = require("./routes/webhooks");
const billingRoutes = require("./routes/billing");
const couponRoutes = require("./routes/coupons");
const calendarIntegrationsRoutes = require("./routes/calendarIntegrations");
const emailDeliveryRoutes = require("./routes/emailDelivery");
const affiliationsRoutes = require("./routes/affiliations");
const affiliationRequestsRoutes = require("./routes/affiliationRequests");
const agenciesAdminRoutes = require("./routes/agenciesAdmin");

const app = express();

// Trust proxy (Railway, Heroku, nginx, Cloudflare, etc.) so X-Forwarded-For is used for rate limiting
app.set('trust proxy', 1);

// Security headers: HSTS, X-Frame-Options, etc.
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable strict CSP for now; enable with custom policy if needed
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'sameorigin' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

const corsOptions = {
  origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://app.heyopsy.com',
      'https://homeops-frontend2-production.up.railway.app'
    ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

app.use(compression());
app.use(cookieParser());

// Webhooks MUST use raw body for signature verification - mount before express.json.
// Stripe sends application/json; SNS notifications for SES inbound mail send
// text/plain (a JSON document with a separate cryptographic signature). Both
// need the unparsed bytes, so the raw parser accepts either content type.
// SNS HTTPS deliveries can be up to ~256 KB; the default raw() limit is 100 KB,
// which caused PayloadTooLargeError and dropped inbound-mail processing.
app.use(
  "/webhooks",
  express.raw({
    type: ["application/json", "text/plain"],
    limit: process.env.WEBHOOK_RAW_BODY_LIMIT || "512kb",
  }),
  webhookRoutes,
);

app.use(express.json());

// Public contractor report routes — mounted before authenticateJWT so no token is needed
const contractorReportRoutes = require("./routes/contractorReport");
app.use("/contractor-report", contractorReportRoutes);

// Public avatar redirect — stable image URLs for emails (no session). Mounted before authenticateJWT.
const publicAvatarRoutes = require("./routes/publicAvatars");
app.use("/public", publicAvatarRoutes);

// API health check (keep before SPA fallback)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.use(authenticateJWT);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many requests, please try again later.", status: 429 } },
  // Skip rate limit for critical post-Stripe activation flow (user just paid, must not fail).
  // Also skip refresh so expired tokens after Stripe redirect don't hit 429.
  skip: (req) => {
    const p = req.path;
    return p === "/auth/complete-onboarding" || p === "/complete-onboarding" || p === "/auth/refresh" || p === "/refresh";
  },
});

const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many MFA attempts, please try again later.", status: 429 } },
  skip: (req) => req.method === "GET" && req.path === "/status",
});

app.use("/auth", authLimiter, authRoutes);
app.use("/mfa", mfaLimiter, ensureLoggedIn, mfaRoutes);
app.use("/users", usersRoutes);
app.use("/accounts", accountsRoutes);
app.use("/contacts", contactsRoutes);
app.use("/properties", propertiesRoutes);
app.use("/systems", systemsRoutes);
app.use("/maintenance", maintenanceRecordsRoutes);
app.use("/documents", documentsRoutes);
app.use("/propertyDocuments", propertyDocumentsRoutes);
app.use("/property-notes", propertyNotesRoutes);
app.use("/stagedDocuments", stagedDocumentsRoutes);
app.use("/subscriptions", subscriptionsRoutes);
app.use("/subscription-products", subscriptionProductsRoutes);
app.use("/system-recommendation-templates", systemRecommendationTemplatesRoutes);
app.use("/invitations", invitationsRoutes);
app.use("/engagement", platformEngagementRoutes);
app.use("/analytics", platformAnalyticsRoutes);
app.use("/predict", propertyPredictRoutes);
app.use("/professional-categories", professionalCategoriesRoutes);
app.use("/professionals", professionalsRoutes);
app.use("/maintenance-events", maintenanceEventsRoutes);
app.use("/saved-professionals", savedProfessionalsRoutes);
app.use("/support-tickets", supportTicketsRoutes);
app.use("/resources", resourcesRoutes);
app.use("/communications", communicationsRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/homeowner-agent-inquiries", homeownerAgentInquiriesRoutes);
app.use("/conversations", conversationsRoutes);
app.use("/inspection-analysis", inspectionAnalysisRoutes);
app.use("/inspection-reviews", inspectionReviewRoutes);
app.use("/document-analysis", documentAnalysisRoutes);
app.use("/", inspectionChecklistRoutes);
app.use("/ai", aiRoutes);
app.use("/billing", billingRoutes);
app.use("/coupons", couponRoutes);
app.use("/calendar-integrations", calendarIntegrationsRoutes);
app.use("/email-delivery", emailDeliveryRoutes);
app.use("/affiliations", affiliationsRoutes);
app.use("/affiliation-requests", affiliationRequestsRoutes);
app.use("/agencies-admin", agenciesAdminRoutes);

// Serve React SPA when frontend build is present (same-origin deployment)
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
  app.use(
    express.static(publicPath, {
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          // Fingerprinted build assets are content-hashed, so a URL never changes
          // meaning — cache them aggressively.
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (
          filePath.endsWith('index.html') ||
          filePath.endsWith('sw.js') ||
          filePath.endsWith('manifest.webmanifest')
        ) {
          // The app shell + service worker must always revalidate so a new deploy's
          // hashed asset references are picked up immediately instead of a stale shell
          // pointing at deleted bundles.
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );
  // SPA fallback: only serve index.html for actual navigations. Requests that look
  // like a static file (have an extension) must fall through to a real 404 when the
  // file is missing — otherwise a stale client asking for a deleted hashed bundle
  // gets index.html back and throws "MIME type text/html" / shows a blank screen.
  app.get('*', (req, res, next) => {
    if (path.extname(req.path)) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Missing hashed bundles must not be edge-cached (Cloudflare was caching 404s for hours).
app.use(function (req, res, next) {
  if (req.path.startsWith('/assets/')) {
    res.set('Cache-Control', 'no-store');
  }
  next();
});

// 404 for unknown API routes (and non-GET when SPA is served)
app.use(function (req, res, next) {
  throw new NotFoundError();
});

app.use(function (err, req, res, next) {
  if (process.env.NODE_ENV !== "test") console.error(err.stack);

  let status = err.status || 500;
  let message = err.message;

  if (err instanceof multer.MulterError) {
    status = 400;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? documentFileTooLargeMessage()
        : err.message;
  }

  return res.status(status).json({
    error: {
      message,
      status,
      ...(typeof err.code === "string" && err.code ? { code: err.code } : {}),
    },
  });
});

module.exports = app;
