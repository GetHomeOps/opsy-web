import React from "react";
import AuthMarketingPanel from "./AuthMarketingPanel";

function AuthLayout({children}) {
  return (
    <main className="min-h-[100dvh] flex flex-col lg:flex-row bg-white text-[#2D4A44] font-inter">
      <AuthMarketingPanel />

      {/* Auth card panel */}
      <section className="flex-1 flex flex-col items-center justify-center px-5 py-10 sm:px-8 md:px-10 lg:px-16">
        <div className="w-full max-w-[420px]">{children}</div>
      </section>
    </main>
  );
}

export default AuthLayout;
