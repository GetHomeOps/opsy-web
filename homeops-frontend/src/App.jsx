import React from "react";
import {useLocation} from "react-router-dom";
import RoutesList from "./pages/routes-nav/RoutesList";
import {AuthProvider, useAuth} from "./context/AuthContext";
import {ContactProvider} from "./context/ContactContext";
import {UserProvider} from "./context/UserContext";
import {PropertyProvider} from "./context/PropertyContext";
import {AgencyProvider} from "./context/AgencyContext";
import {AccountBrandingProvider} from "./context/AccountBrandingContext";
import TierLimitBanner from "./components/TierLimitBanner";
import SponsorshipOfferWatcher from "./components/SponsorshipOfferWatcher";
import PageViewTracker from "./components/PageViewTracker";
import GoogleAnalyticsTracker from "./components/GoogleAnalyticsTracker";

import "./css/style.css";

/** Remount the branding provider whenever the logged-in identity or
 * impersonation state changes, so a customized shell (logo, colors, "Powered
 * by") from an impersonated account cannot linger after returning to the admin. */
function BrandingBoundary({children}) {
  const {currentUser, impersonation} = useAuth();
  const brandingKey = `${currentUser?.id ?? "none"}-${
    impersonation?.active ? "impersonating" : "self"
  }`;
  return (
    <AccountBrandingProvider key={brandingKey}>
      {children}
    </AccountBrandingProvider>
  );
}

function App() {
  const location = useLocation();

  React.useEffect(() => {
    document.querySelector("html").style.scrollBehavior = "auto";
    window.scroll({top: 0});
    document.querySelector("html").style.scrollBehavior = "";
  }, [location.pathname]); // triggered on route change

  return (
    <AuthProvider>
      <BrandingBoundary>
        <ContactProvider>
          <UserProvider>
            <PropertyProvider>
              <AgencyProvider>
                <TierLimitBanner />
                <SponsorshipOfferWatcher />
                <GoogleAnalyticsTracker />
                <PageViewTracker />
                <RoutesList />
              </AgencyProvider>
            </PropertyProvider>
          </UserProvider>
        </ContactProvider>
      </BrandingBoundary>
    </AuthProvider>
  );
}

export default App;
