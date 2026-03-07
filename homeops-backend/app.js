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
const rateLimit = require('express-rate-limit');
const { NotFoundError } = require("./expressError");
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
const subscriptionsRoutes = require("./routes/subscriptions");
const subscriptionProductsRoutes = require("./routes/subscriptionProducts");
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
const inspectionAnalysisRoutes = require("./routes/inspectionAnalysis");
const inspectionChecklistRoutes = require("./routes/inspectionChecklist");
const aiRoutes = require("./routes/ai");
const webhookRoutes = require("./routes/webhooks");
const billingRoutes = require("./routes/billing");

const app = express();

// Trust proxy (Railway, Heroku, nginx, etc.) so X-Forwarded-For is used for rate limiting
app.set('trust proxy', 1);

const corsOptions = {
  origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [
      'http://localhost:5173',
      'http://localhost:5174',
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

// Webhooks MUST use raw body for Stripe signature verification - mount before express.json
app.use("/webhooks", express.raw({ type: "application/json" }), webhookRoutes);

app.use(express.json());

// Public contractor report routes — mounted before authenticateJWT so no token is needed
const contractorReportRoutes = require("./routes/contractorReport");
app.use("/contractor-report", contractorReportRoutes);

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
app.use("/subscriptions", subscriptionsRoutes);
app.use("/subscription-products", subscriptionProductsRoutes);
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
app.use("/inspection-analysis", inspectionAnalysisRoutes);
app.use("/", inspectionChecklistRoutes);
app.use("/ai", aiRoutes);
app.use("/billing", billingRoutes);

// Serve React SPA when frontend build is present (same-origin deployment)
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  // SPA fallback: serve index.html for non-API GET requests
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// 404 for unknown API routes (and non-GET when SPA is served)
app.use(function (req, res, next) {
  throw new NotFoundError();
});

app.use(function (err, req, res, next) {
  if (process.env.NODE_ENV !== "test") console.error(err.stack);

  const status = err.status || 500;
  const message = err.message;

  return res.status(status).json({
    error: { message, status },
  });
});

module.exports = app;
