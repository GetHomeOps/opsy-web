import React from "react";
import {useLocation} from "react-router-dom";
import RoutesList from "./pages/routes-nav/RoutesList";
import {ContactProvider} from "./context/ContactContext";
import {UserProvider} from "./context/UserContext";
import {PropertyProvider} from "./context/PropertyContext";
import TierLimitBanner from "./components/TierLimitBanner";

import "./css/style.css";

function App() {
  const location = useLocation();

  React.useEffect(() => {
    document.querySelector("html").style.scrollBehavior = "auto";
    window.scroll({top: 0});
    document.querySelector("html").style.scrollBehavior = "";
  }, [location.pathname]); // triggered on route change

  return (
    <ContactProvider>
      <UserProvider>
        <PropertyProvider>
          <TierLimitBanner />
          <RoutesList />
        </PropertyProvider>
      </UserProvider>
    </ContactProvider>
  );
}

export default App;
