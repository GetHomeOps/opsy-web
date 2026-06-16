import React from "react";
import authMarketingHero from "../../images/auth-marketing-hero.png";
import authIconLock from "../../images/auth-icon-lock.png";
import authIconHandshake from "../../images/auth-icon-handshake.png";
import authIconSpaceNeedle from "../../images/auth-icon-space-needle.png";

const TRUST_FEATURES = [
  {
    icon: authIconLock,
    text: "Your data is yours - export and share who only you see fit.",
  },
  {
    icon: authIconHandshake,
    text: "We never sell your information",
  },
  {
    icon: authIconSpaceNeedle,
    text: "Built in the Pacific Northwest by HomeOps.",
  },
];

function AuthFeatureIcon({src, className = "h-7 w-7"}) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

function MarketingOverlayContent({compact = false}) {
  if (compact) {
    return (
      <div className="relative z-10 flex h-full flex-col justify-center px-6 py-8 font-auth-serif">
        <p className="text-[0.8125rem] tracking-[0.22em] uppercase text-[#D6B36A]">
          Built on trust
        </p>
        <h2 className="my-5 text-[1.75rem] font-medium leading-[1.15] text-white sm:text-[2rem]">
          This is how you home.
        </h2>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex h-full flex-col px-10 py-12 font-auth-serif lg:px-14 lg:py-16 xl:px-16">
      <div>
        <p className="text-[1.25rem] tracking-[0.18em] uppercase text-[#D6B36A]">
          Built on trust
        </p>
        <h2 className="my-8 text-[3.25rem] font-medium leading-[1.08] text-white lg:text-[3.75rem]">
          This is how you home.
        </h2>
        <p className="max-w-[42rem] text-[1.625rem] leading-[1.5] text-[#D6B36A] lg:text-[1.75rem]">
          Opsy keeps everything your home is and needs in one calm place - and
          you own all of it. Your home&apos;s story stays yours: export it
          anytime and we&apos;ll never sell a word of it.
        </p>

        <ul className="mt-20 space-y-4 lg:mt-24">
          {TRUST_FEATURES.map(({icon, text}) => (
            <li key={text} className="flex items-center gap-4">
              <AuthFeatureIcon
                src={icon}
                className="h-7 w-7 lg:h-8 lg:w-8"
              />
              <span className="text-[1.5rem] leading-[1.5] text-white lg:text-[1.625rem]">
                {text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-auto pt-10 text-[1.4375rem] leading-[1.5] text-[#D6B36A]">
        Lets be Good Ancestors. Lets Move Home Forward.
      </p>
    </div>
  );
}

function AuthMarketingPanel() {
  return (
    <>
      <section
        className="relative h-44 shrink-0 overflow-hidden lg:hidden"
        aria-label="About Opsy"
      >
        <img
          src={authMarketingHero}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-105 object-cover object-[70%_center] blur-[6px]"
        />
        <div className="absolute inset-0 bg-[#2D4A44]/68" aria-hidden="true" />
        <MarketingOverlayContent compact />
      </section>

      <section
        className="relative hidden min-h-[100dvh] overflow-hidden lg:block lg:w-[54%] xl:w-[56%]"
        aria-label="About Opsy"
      >
        <img
          src={authMarketingHero}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-105 object-cover object-[72%_center] blur-[6px]"
        />
        <div className="absolute inset-0 bg-[#2D4A44]/68" aria-hidden="true" />
        <MarketingOverlayContent />
      </section>
    </>
  );
}

export default AuthMarketingPanel;
