import React from "react";
import OpsyHeader from "../../images/OpsyHeader.png";

function AuthCardShell({title, children, footer}) {
  return (
    <div className="w-full">
      <div className="flex justify-center mb-8">
        <img
          src={OpsyHeader}
          alt="Opsy — Powered by HomeOps"
          className="h-auto w-full max-w-[280px]"
        />
      </div>

      {title ? (
        <h1 className="font-auth-serif text-[2rem] leading-tight text-[#2D4A44] text-center mb-8">
          {title}
        </h1>
      ) : null}

      {children}

      {footer ? <div className="mt-8">{footer}</div> : null}
    </div>
  );
}

export default AuthCardShell;
