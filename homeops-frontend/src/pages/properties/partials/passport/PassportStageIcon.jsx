import React from "react";
import stage1 from "../../../../images/passport-stage-1.png";
import stage2 from "../../../../images/passport-stage-2.png";
import stage3 from "../../../../images/passport-stage-3.png";
import stage4 from "../../../../images/passport-stage-4.png";
import stage5 from "../../../../images/passport-stage-5.png";

const STAGE_IMAGES = [stage1, stage2, stage3, stage4, stage5];

/** Passport completion stage mascot icon for stages 1–5. */
function PassportStageIcon({stage = 1, size = 100, className = ""}) {
  const index = Math.max(1, Math.min(STAGE_IMAGES.length, stage)) - 1;
  const src = STAGE_IMAGES[index];

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={`block shrink-0 ${className}`}
      style={{height: size, width: "auto"}}
    />
  );
}

export default PassportStageIcon;
