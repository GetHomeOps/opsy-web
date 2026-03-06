import React, {useState} from "react";
import {Link, Navigate} from "react-router-dom";

import {useAuth} from "../../context/AuthContext";
import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";

import NotFoundImage from "../../images/404-illustration.svg";
import NotFoundImageDark from "../../images/404-illustration-dark.svg";

/**
 * 404 page. Does not show sidebar or navbar for non-logged-in users.
 * Users who haven't completed onboarding are redirected to /onboarding instead.
 */
function PageNotFound() {
  const {currentUser} = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Users who haven't finished onboarding should complete it first, not see the 404 with sidebar
  if (currentUser?.onboardingCompleted === false) {
    return <Navigate to="/onboarding" replace />;
  }

  const content = (
    <div className="max-w-2xl m-auto mt-16">
      <div className="text-center px-4">
        <div className="inline-flex mb-8">
          <img
            className="dark:hidden"
            src={NotFoundImage}
            width="176"
            height="176"
            alt="404 illustration"
          />
          <img
            className="hidden dark:block"
            src={NotFoundImageDark}
            width="176"
            height="176"
            alt="404 illustration dark"
          />
        </div>
        <div className="mb-6">
          Hmm...this page doesn't exist. Try searching for something else!
        </div>
        <Link
          to={currentUser ? "/" : "/signin"}
          className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white"
        >
          {currentUser ? "Back To Dashboard" : "Go To Sign In"}
        </Link>
      </div>
    </div>
  );

  // Non-logged-in: minimal layout, no sidebar or navbar
  if (!currentUser) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-white dark:bg-gray-900 px-4">
        {content}
      </div>
    );
  }

  // Logged-in: full app shell so user can navigate
  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        variant="v2"
      />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-900">
        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          variant="v3"
        />
        <main className="grow">
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
            {content}
          </div>
        </main>
      </div>
    </div>
  );
}

export default PageNotFound;
