import React, {Suspense} from "react";
import {lazyWithRetry as lazy} from "../../utils/lazyWithRetry";
import {
  Routes,
  Route,
  Navigate,
  useParams,
  useLocation,
} from "react-router-dom";
import "../../css/style.css";

import {Loader2} from "lucide-react";
import {useAuth} from "../../context/AuthContext";
import {isDemoSite} from "../../utils/demoSite";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./AdminRoute";
import SuperAdminRoute from "./SuperAdminRoute";
import PublicRoute from "./PublicRoute";
import OnboardingRoute from "./OnboardingRoute";
import AppChromeFallback from "../../partials/AppChromeFallback";
import {
  contactsListImport,
  propertiesListImport,
  prePurchaseDashboardImport,
} from "./routePrefetch";

// Auth/public entry pages are kept eager so the sign-in flow stays instant
// (these are small and on the critical path for unauthenticated users).
import Signin from "../auth/Signin";
import Signup from "../auth/Signup";
import AuthCallback from "../auth/AuthCallback";
import ForgotPassword from "../auth/ForgotPassword";
import ResetPassword from "../auth/ResetPassword";
import VerifyEmail from "../auth/VerifyEmail";
import PageNotFound from "../utility/PageNotFound";

// Everything below is route-level lazy-loaded so the initial JS bundle only
// contains the auth/public shell. Each page (and its heavy dependencies like
// charts, rich-text editors and spreadsheet parsers) is fetched on demand.
const OnboardingWizard = lazy(() => import("../onboarding/OnboardingWizard"));
const ContractorReportPage = lazy(() => import("../properties/ContractorReportPage"));
const PrivacyPolicy = lazy(() => import("../legal/PrivacyPolicy"));
const TermsOfService = lazy(() => import("../legal/TermsOfService"));

const Account = lazy(() => import("../accountSettings/Account"));
const Databases = lazy(() => import("../accountSettings/Databases"));
const Main = lazy(() => import("../Main"));
const ContactList = lazy(contactsListImport);
const UsersList = lazy(() => import("../users/UsersList"));
const User = lazy(() => import("../users/User"));
const UsersImport = lazy(() => import("../users/usersImport"));
const Contact = lazy(() => import("../contacts/Contact"));
const PropertiesList = lazy(propertiesListImport);
const PropertiesImport = lazy(() => import("../properties/propertiesImport"));
const BulkOnboardWizard = lazy(() => import("../properties/BulkOnboardWizard"));
const Property = lazy(() => import("../properties/Property"));
const PrePurchaseDashboard = lazy(prePurchaseDashboardImport);
const PrePurchaseNewAnalysis = lazy(() => import("../pre-purchase/PrePurchaseNewAnalysis"));
const PrePurchaseAnalysisPage = lazy(() => import("../pre-purchase/PrePurchaseAnalysisPage"));
const AssistantsList = lazy(() => import("../assistants/AssistantsList"));
const AssistantFormContainer = lazy(() => import("../assistants/AssistantFormContainer"));
const UserConfirmationEmail = lazy(() => import("../users/UserConfirmationEmail"));
const MaintenanceRecordPage = lazy(() => import("../properties/MaintenanceRecordPage"));
const PdfFileExample = lazy(() => import("../pdfFileExample"));
const ContactsImport = lazy(() => import("../contacts/contactsImport"));
const SubscriptionsList = lazy(() => import("../subscriptions/SubscriptionsList"));
const Subscription = lazy(() => import("../subscriptions/Subscription"));
const SubscriptionProductsList = lazy(() => import("../subscriptions/SubscriptionProductsList"));
const SubscriptionProduct = lazy(() => import("../subscriptions/SubscriptionProduct"));
const SystemRecommendationsList = lazy(() => import("../superadmin/systemRecommendations/SystemRecommendationsList"));
const CouponsList = lazy(() => import("../coupons/CouponsList"));
const EmailDeliveryPage = lazy(() => import("../emailDelivery/EmailDeliveryPage"));
const CustomizationList = lazy(() => import("../customization/CustomizationList"));
const CustomizationPage = lazy(() => import("../customization/CustomizationPage"));
const CouponForm = lazy(() => import("../coupons/CouponForm"));
const ProfessionalDirectory = lazy(() => import("../professionals/ProfessionalDirectory"));
const ProfessionalsDirectorySample = lazy(() => import("../professionals/ProfessionalsDirectorySample"));
const CategoryDirectoryPage = lazy(() => import("../professionals/CategoryDirectoryPage"));
const CategoryDirectoryPageSample = lazy(() => import("../professionals/CategoryDirectoryPageSample"));
const MyProfessionals = lazy(() => import("../professionals/MyProfessionals"));
const MyProfessionalsSample = lazy(() => import("../professionals/MyProfessionalsSample"));
const ProfessionalProfile = lazy(() => import("../professionals/ProfessionalProfile"));
const ProfessionalFormContainer = lazy(() => import("../professionals/ProfessionalFormContainer"));
const ProfessionalsList = lazy(() => import("../professionals/ProfessionalsList"));
const ProfessionalsImport = lazy(() => import("../professionals/professionalsImport"));
const CategoriesList = lazy(() => import("../professionals/categories/CategoriesList"));
const CategoriesImport = lazy(() => import("../professionals/categories/categoriesImport"));
const CategoryFormContainer = lazy(() => import("../professionals/categories/CategoryFormContainer"));
const DashboardOverview = lazy(() => import("../dashboard/DashboardOverview"));
const AccountAnalytics = lazy(() => import("../dashboard/AccountAnalytics"));
const AgentAnalytics = lazy(() => import("../dashboard/AgentAnalytics"));
const PropertyAnalytics = lazy(() => import("../dashboard/PropertyAnalytics"));
const CostAnalytics = lazy(() => import("../dashboard/CostAnalytics"));
const UnitCostDashboard = lazy(() => import("../dashboard/UnitCostDashboard"));
const DemoSalesDashboard = lazy(() => import("../dashboard/DemoSalesDashboard"));
const EngagementDashboard = lazy(() => import("../dashboard/EngagementDashboard"));
const GrowthDashboard = lazy(() => import("../dashboard/GrowthDashboard"));
const InvitationsList = lazy(() => import("../invitations/InvitationsList"));
const BillingPage = lazy(() => import("../settings/BillingPage"));
const UpgradePlanPage = lazy(() => import("../settings/UpgradePlanPage"));
const BillingSuccess = lazy(() => import("../billing/BillingSuccess"));
const ConfigurationPage = lazy(() => import("../settings/ConfigurationPage"));
const SupportList = lazy(() => import("../support/SupportList"));
const SupportNew = lazy(() => import("../support/SupportNew"));
const SupportTicket = lazy(() => import("../support/SupportTicket"));
const DataAdjustmentRequest = lazy(() => import("../support/DataAdjustmentRequest"));
const SupportManagement = lazy(() => import("../support/SupportManagement"));
const FeedbackManagement = lazy(() => import("../support/FeedbackManagement"));
const DataAdjustmentManagement = lazy(() => import("../support/DataAdjustmentManagement"));
const TicketDetailPage = lazy(() => import("../support/TicketDetailPage"));
const HelpdeskPage = lazy(() => import("../support/HelpdeskPage"));
const InspectionReviewQueue = lazy(() => import("../inspectionReviews/InspectionReviewQueue"));
const InspectionReviewDetail = lazy(() => import("../inspectionReviews/InspectionReviewDetail"));
const ResourcesManagement = lazy(() => import("../resources/ResourcesManagement"));
const Resource = lazy(() => import("../resources/Resource"));
const ResourceViewerPage = lazy(() => import("../resources/ResourceViewerPage"));
const ResourcePreviewPage = lazy(() => import("../resources/ResourcePreviewPage"));
const CommunicationsList = lazy(() => import("../communications/CommunicationsList"));
const CommunicationComposer = lazy(() => import("../communications/CommunicationComposer"));
const CommunicationViewerPage = lazy(() => import("../communications/CommunicationViewerPage"));
const ClientMessages = lazy(() => import("../network/ClientMessages"));
const AgenciesAdminHub = lazy(() => import("../agencies/AgenciesAdminHub"));
const AgencyFormContainer = lazy(() => import("../agencies/AgencyFormContainer"));
const AgenciesImport = lazy(() => import("../agencies/AgenciesImport"));
const Calendar = lazy(() => import("../calendar/Calendar"));
const ComingSoon = lazy(() => import("../ComingSoon"));

function BillingPlansRedirect() {
  const {accountUrl} = useParams();
  return <Navigate to={`/${accountUrl}/subscription-products`} replace />;
}

function HelpdeskLegacyRedirect({to}) {
  const {accountUrl, ticketId} = useParams();
  const suffix = ticketId ? `/${ticketId}` : "";
  return <Navigate to={`/${accountUrl}/${to}${suffix}`} replace />;
}

function UpgradeRedirect() {
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name;
  if (accountUrl) {
    return <Navigate to={`/${accountUrl}/settings/upgrade`} replace />;
  }
  return <Navigate to="/settings/accounts" replace />;
}

function RoutesList() {
  const {currentUser, isLoading} = useAuth();
  const {currentAccount} = useCurrentAccount();
  const location = useLocation();

  // Let the OAuth callback render immediately — it has its own loading UI.
  // Legal pages render without waiting so logged-in users (e.g. onboarding) can open them.
  // All other routes wait for AuthContext to finish initialising.
  if (
    isLoading &&
    location.pathname !== "/auth/callback" &&
    location.pathname !== "/verify-email" &&
    location.pathname !== "/privacy-policy" &&
    location.pathname !== "/terms-of-service"
  ) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
      </div>
    );
  }

  // Public routes: no sidebar/navbar; redirect logged-in users to app
  const publicRoutes = (
    <>
      <Route
        path="/signin"
        element={
          <PublicRoute>
            <Signin />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          isDemoSite() ? (
            <Navigate
              to="/signin"
              replace
              state={{demoSignupDisabled: true}}
            />
          ) : (
            <PublicRoute>
              <Signup />
            </PublicRoute>
          )
        }
      />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicRoute>
            <ResetPassword />
          </PublicRoute>
        }
      />
      <Route
        path="/verify-email"
        element={
          <PublicRoute>
            <VerifyEmail />
          </PublicRoute>
        }
      />
      {/* No PublicRoute: that wrapper redirects logged-in users to app home, which
          sends incomplete onboarding back here — so Terms/Privacy would never show. */}
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      {/* Public contractor report page — accessed via token link, no auth needed */}
      <Route path="/contractor-report" element={<ContractorReportPage />} />
      {/* Invite confirmation: allow both logged-in and logged-out users (invitee may be testing while logged in) */}
      <Route
        path="/:accountUrl/invite/:invitation"
        element={<UserConfirmationEmail />}
      />
      <Route
        path="/onboarding"
        element={
          <OnboardingRoute>
            <OnboardingWizard />
          </OnboardingRoute>
        }
      />
      <Route
        path="/billing/success"
        element={
          <ProtectedRoute>
            <BillingSuccess />
          </ProtectedRoute>
        }
      />
    </>
  );

  // Private routes: require auth; redirect to /signin with return URL if not logged in
  const privateRoutes = (
    <>
      <Route
        path="/settings/account"
        element={
          <ProtectedRoute>
            <Account />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/accounts"
        element={
          <ProtectedRoute>
            <Databases />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/upgrade"
        element={
          <ProtectedRoute>
            <UpgradeRedirect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/home"
        element={
          <ProtectedRoute>
            <Main />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/dashboard"
        element={
          <ProtectedRoute>
            <DashboardOverview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/dashboard/accounts"
        element={
          <ProtectedRoute>
            <AccountAnalytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/dashboard/agent-analytics"
        element={
          <AdminRoute>
            <AgentAnalytics />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/dashboard/properties"
        element={
          <AdminRoute>
            <PropertyAnalytics />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/dashboard/unit-cost"
        element={
          <AdminRoute>
            <UnitCostDashboard />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/dashboard/demo-sales"
        element={
          <SuperAdminRoute>
            <DemoSalesDashboard />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/:accountUrl/dashboard/costs"
        element={
          <ProtectedRoute>
            <CostAnalytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/dashboard/engagement"
        element={
          <ProtectedRoute>
            <EngagementDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/dashboard/growth"
        element={
          <ProtectedRoute>
            <GrowthDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/invitations"
        element={
          <ProtectedRoute>
            <InvitationsList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/settings/billing"
        element={
          <ProtectedRoute>
            <BillingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/settings/upgrade"
        element={
          <ProtectedRoute>
            <UpgradePlanPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/settings/configuration"
        element={
          <ProtectedRoute>
            <ConfigurationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/settings/support/new"
        element={
          <ProtectedRoute>
            <SupportNew />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/settings/support/data-adjustment"
        element={
          <ProtectedRoute>
            <DataAdjustmentRequest />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/settings/support/:ticketId"
        element={
          <ProtectedRoute>
            <SupportTicket />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/settings/support"
        element={
          <ProtectedRoute>
            <SupportList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/contacts"
        element={
          <ProtectedRoute>
            <ContactList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/contacts/import"
        element={
          <ProtectedRoute>
            <ContactsImport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/contacts/new"
        element={
          <ProtectedRoute>
            <Contact />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/contacts/:id"
        element={
          <ProtectedRoute>
            <Contact />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/users"
        element={
          <AdminRoute>
            <UsersList />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/users/import"
        element={
          <AdminRoute>
            <UsersImport />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/users/:id"
        element={
          <AdminRoute>
            <User />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/properties"
        element={
          <ProtectedRoute>
            <PropertiesList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/assistants"
        element={
          <AdminRoute allowedRoles={["super_admin", "admin", "agent"]}>
            <AssistantsList />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/assistants/new"
        element={
          <AdminRoute allowedRoles={["super_admin", "admin", "agent"]}>
            <AssistantFormContainer />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/assistants/:id"
        element={
          <AdminRoute allowedRoles={["super_admin", "admin", "agent"]}>
            <AssistantFormContainer />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/pre-purchase"
        element={
          <AdminRoute allowedRoles={["super_admin", "admin", "agent", "assistant"]}>
            <PrePurchaseDashboard />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/pre-purchase/new"
        element={
          <AdminRoute allowedRoles={["super_admin", "admin", "agent", "assistant"]}>
            <PrePurchaseNewAnalysis />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/pre-purchase/:analysisId"
        element={
          <AdminRoute allowedRoles={["super_admin", "admin", "agent", "assistant"]}>
            <PrePurchaseAnalysisPage />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/properties/import"
        element={
          <AdminRoute>
            <PropertiesImport />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/properties/bulk-onboard"
        element={
          <AdminRoute>
            <BulkOnboardWizard />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/calendar"
        element={
          <ProtectedRoute>
            <Calendar />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/properties/:uid"
        element={
          <ProtectedRoute>
            <Property />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/properties/:uid/maintenance/:systemId/:recordId"
        element={
          <ProtectedRoute>
            <MaintenanceRecordPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/professionals"
        element={
          <ProtectedRoute>
            <ProfessionalDirectory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coming-soon"
        element={
          <ProtectedRoute>
            <ComingSoon />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/coming-soon"
        element={
          <ProtectedRoute>
            <ComingSoon />
          </ProtectedRoute>
        }
      />
      <Route
        path="/professionals-sample"
        element={
          <ProtectedRoute>
            <ProfessionalsDirectorySample />
          </ProtectedRoute>
        }
      />
      <Route
        path="/professionals-sample/search"
        element={
          <ProtectedRoute>
            <CategoryDirectoryPageSample />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/professionals-sample"
        element={
          <ProtectedRoute>
            <ProfessionalsDirectorySample />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/professionals-sample/search"
        element={
          <ProtectedRoute>
            <CategoryDirectoryPageSample />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/professionals/search"
        element={
          <ProtectedRoute>
            <CategoryDirectoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/professionals/manage"
        element={
          <ProtectedRoute>
            <ProfessionalsList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/professionals/import"
        element={
          <ProtectedRoute>
            <ProfessionalsImport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/professionals/manage/new"
        element={
          <ProtectedRoute>
            <ProfessionalFormContainer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/professionals/manage/:professionalId"
        element={
          <ProtectedRoute>
            <ProfessionalFormContainer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/professionals/categories"
        element={
          <ProtectedRoute>
            <CategoriesList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/professionals/categories/import"
        element={
          <ProtectedRoute>
            <CategoriesImport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/professionals/categories/:categoryId"
        element={
          <ProtectedRoute>
            <CategoryFormContainer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/professionals/:proId"
        element={
          <ProtectedRoute>
            <ProfessionalProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/my-professionals"
        element={
          <ProtectedRoute>
            <MyProfessionals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-professionals-sample"
        element={
          <ProtectedRoute>
            <MyProfessionalsSample />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/my-professionals-sample"
        element={
          <ProtectedRoute>
            <MyProfessionalsSample />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/subscriptions"
        element={
          <AdminRoute>
            <SubscriptionsList />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/subscriptions/new"
        element={
          <AdminRoute>
            <Subscription />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/subscriptions/:id"
        element={
          <AdminRoute>
            <Subscription />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/billing-plans"
        element={<BillingPlansRedirect />}
      />
      <Route
        path="/:accountUrl/subscription-products"
        element={
          <SuperAdminRoute>
            <SubscriptionProductsList />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/:accountUrl/system-recommendations"
        element={
          <SuperAdminRoute>
            <SystemRecommendationsList />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/:accountUrl/subscription-products/new"
        element={
          <SuperAdminRoute>
            <SubscriptionProduct />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/:accountUrl/subscription-products/:id"
        element={
          <SuperAdminRoute>
            <SubscriptionProduct />
          </SuperAdminRoute>
        }
      />
      {/* Coupons (Super Admin) */}
      <Route
        path="/:accountUrl/coupons"
        element={
          <SuperAdminRoute>
            <CouponsList />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/:accountUrl/coupons/new"
        element={
          <SuperAdminRoute>
            <CouponForm />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/:accountUrl/coupons/:id"
        element={
          <SuperAdminRoute>
            <CouponForm />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/:accountUrl/email-delivery"
        element={
          <SuperAdminRoute>
            <EmailDeliveryPage />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/:accountUrl/customization"
        element={
          <AdminRoute>
            <CustomizationList />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/customization/agency/:agencyId"
        element={
          <AdminRoute>
            <CustomizationPage />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/customization/team/:teamId"
        element={
          <AdminRoute>
            <CustomizationPage />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/customization/:accountId"
        element={
          <AdminRoute>
            <CustomizationPage />
          </AdminRoute>
        }
      />
      {/* Helpdesk unified module */}
      <Route
        path="/:accountUrl/helpdesk"
        element={
          <AdminRoute>
            <HelpdeskPage />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/helpdesk/inspection-reviews"
        element={
          <SuperAdminRoute>
            <InspectionReviewQueue />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/:accountUrl/helpdesk/inspection-reviews/:reviewId"
        element={
          <SuperAdminRoute>
            <InspectionReviewDetail />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/:accountUrl/helpdesk/support/:ticketId"
        element={
          <AdminRoute>
            <TicketDetailPage variant="support" />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/helpdesk/support"
        element={
          <AdminRoute>
            <SupportManagement />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/helpdesk/feedback/:ticketId"
        element={
          <AdminRoute>
            <TicketDetailPage variant="feedback" />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/helpdesk/feedback"
        element={
          <AdminRoute>
            <FeedbackManagement />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/helpdesk/data-adjustments/:ticketId"
        element={
          <AdminRoute>
            <TicketDetailPage variant="data_adjustment" />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/helpdesk/data-adjustments"
        element={
          <AdminRoute>
            <DataAdjustmentManagement />
          </AdminRoute>
        }
      />
      {/* Legacy redirects for old bookmark/direct links */}
      <Route
        path="/:accountUrl/support-management/:ticketId"
        element={<HelpdeskLegacyRedirect to="helpdesk/support" />}
      />
      <Route
        path="/:accountUrl/support-management"
        element={<HelpdeskLegacyRedirect to="helpdesk/support" />}
      />
      <Route
        path="/:accountUrl/resources/new"
        element={
          <AdminRoute allowedRoles={["super_admin", "admin", "agent", "assistant"]}>
            <Resource />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/resources/:id/preview"
        element={
          <AdminRoute allowedRoles={["super_admin", "admin", "agent", "assistant"]}>
            <ResourcePreviewPage />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/resources/:id/view"
        element={
          <ProtectedRoute>
            <ResourceViewerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/resources/:id"
        element={
          <AdminRoute allowedRoles={["super_admin", "admin", "agent", "assistant"]}>
            <Resource />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/resources"
        element={
          <AdminRoute allowedRoles={["super_admin", "admin", "agent", "assistant"]}>
            <ResourcesManagement />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/communications/new"
        element={
          <AdminRoute allowedRoles={["super_admin", "admin", "agent", "assistant"]}>
            <CommunicationComposer />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/communications/:id/view"
        element={
          <ProtectedRoute>
            <CommunicationViewerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/communications/:id"
        element={
          <AdminRoute allowedRoles={["super_admin", "admin", "agent", "assistant"]}>
            <CommunicationComposer />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/communications"
        element={
          <AdminRoute allowedRoles={["super_admin", "admin", "agent", "assistant"]}>
            <CommunicationsList />
          </AdminRoute>
        }
      />
      <Route
        path="/:accountUrl/homeowner-messages"
        element={
          <ProtectedRoute>
            <ClientMessages />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:accountUrl/agencies/agents"
        element={
          <SuperAdminRoute>
            <AgenciesAdminHub activeTab="agents" />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/:accountUrl/agencies/requests"
        element={
          <SuperAdminRoute>
            <AgenciesAdminHub activeTab="requests" />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/:accountUrl/agencies/manage/new"
        element={
          <SuperAdminRoute>
            <AgencyFormContainer />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/:accountUrl/agencies/manage/:agencyId"
        element={
          <SuperAdminRoute>
            <AgencyFormContainer />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/:accountUrl/agencies/manage"
        element={
          <SuperAdminRoute>
            <AgenciesAdminHub activeTab="manage" />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/:accountUrl/agencies/import"
        element={
          <SuperAdminRoute>
            <AgenciesImport />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/:accountUrl/feedback-management/:ticketId"
        element={<HelpdeskLegacyRedirect to="helpdesk/feedback" />}
      />
      <Route
        path="/:accountUrl/feedback-management"
        element={<HelpdeskLegacyRedirect to="helpdesk/feedback" />}
      />
      <Route
        path="/:accountUrl/data-adjustment-management/:ticketId"
        element={<HelpdeskLegacyRedirect to="helpdesk/data-adjustments" />}
      />
      <Route
        path="/:accountUrl/data-adjustment-management"
        element={<HelpdeskLegacyRedirect to="helpdesk/data-adjustments" />}
      />
      <Route
        path="/:accountUrl/pdfexample"
        element={
          <ProtectedRoute>
            <PdfFileExample />
          </ProtectedRoute>
        }
      />
    </>
  );

  return (
    <Suspense
      fallback={
        currentUser ? (
          <AppChromeFallback />
        ) : (
          <div className="flex justify-center items-center h-screen">
            <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
          </div>
        )
      }
    >
      <Routes>
      <Route
        path="/"
        element={
          currentUser ? (
            currentUser.onboardingCompleted === false ? (
              <Navigate to="/onboarding" replace />
            ) : currentAccount?.url ? (
              <Navigate to={`/${currentAccount.url}/home`} replace />
            ) : (
              <div>
                <h1>No account selected!</h1>
                <p>
                  Choose one from <a href="/settings/accounts">Accounts</a> or
                  create new.
                </p>
              </div>
            )
          ) : (
            <Navigate to="/signin" replace />
          )
        }
      />
      {/* Always include both sets of routes */}
      {publicRoutes}
      {privateRoutes}

      {/* Dynamic fallback based on auth state */}
      <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
}

export default RoutesList;
