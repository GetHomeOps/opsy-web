import React, {useState, useEffect} from "react";
import {useLocation} from "react-router-dom";

import Sidebar from "../partials/Sidebar";
import Header from "../partials/Header";
import {useAuth} from "../context/AuthContext";
import AppApi from "../api/api";

import HomeownerHome from "./home/HomeownerHome";
import AgentHome from "./home/AgentHome";
import SuperAdminHome from "./home/SuperAdminHome";

/**
 * Main — layout shell for the authenticated home page.
 *
 * Role-based routing:
 *   • homeowner   → HomeownerHome
 *   • super_admin → SuperAdminHome
 *   • agent / admin → AgentHome
 *
 * Each home component is responsible for its own data-fetching,
 * scoped to the logged-in user via PropertyContext + AuthContext.
 */
class SidebarErrorBoundary extends React.Component {
  state = {error: null};
  static getDerivedStateFromError(error) {
    return {error};
  }
  componentDidCatch(error, info) {
    console.error("Sidebar crashed:", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 bg-red-900/30 text-red-200 text-sm max-w-xs overflow-auto">
          <p className="font-bold mb-1">Sidebar error</p>
          <pre className="whitespace-pre-wrap">{this.state.error.message}</pre>
          <button
            className="mt-2 underline"
            onClick={() => this.setState({error: null})}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Main() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const {currentUser} = useAuth();
  const role = (currentUser?.role ?? "").toLowerCase();

  useEffect(() => {
    if (currentUser?.id && location?.pathname) {
      AppApi.logEngagementEvent("page_view", {path: location.pathname}).catch(
        () => {},
      );
    }
  }, [location.pathname, currentUser?.id]);

  const HomeComponent =
    role === "homeowner"
      ? HomeownerHome
      : role === "super_admin"
        ? SuperAdminHome
        : AgentHome;

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Sidebar */}
      <SidebarErrorBoundary>
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      </SidebarErrorBoundary>

      {/* Content area */}
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/*  Site header */}
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
            <HomeComponent />
          </div>
        </main>
      </div>
    </div>
  );
}

export default Main;
