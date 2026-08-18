import React from "react";

import {useAuth} from "../context/AuthContext";

import HomeownerHome from "./home/HomeownerHome";
import AgentHome from "./home/AgentHome";
import SuperAdminHome from "./home/SuperAdminHome";
import WelcomeModal from "../components/WelcomeModal";

/**
 * Authenticated home page. App chrome (sidebar/header) lives in AuthenticatedLayout.
 *
 * Role-based routing:
 *   • homeowner   → HomeownerHome
 *   • super_admin → SuperAdminHome
 *   • agent / assistant / admin → AgentHome
 */
function Main() {
  const {currentUser} = useAuth();
  const role = (currentUser?.role ?? "").toLowerCase();

  const HomeComponent =
    role === "homeowner"
      ? HomeownerHome
      : role === "super_admin"
        ? SuperAdminHome
        : AgentHome;

  return (
    <main className="grow">
      <div className="px-3 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
        <HomeComponent />
      </div>
      {!currentUser?.welcomeModalDismissed && <WelcomeModal />}
    </main>
  );
}

export default Main;
