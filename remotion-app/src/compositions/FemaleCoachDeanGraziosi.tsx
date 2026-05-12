import React from "react";

import {
  ProjectScopedMotionComposition,
  type ProjectScopedMotionCompositionProps
} from "./ProjectScopedMotionComposition";

export type FemaleCoachDeanGraziosiProps = ProjectScopedMotionCompositionProps;

export const FemaleCoachDeanGraziosi: React.FC<FemaleCoachDeanGraziosiProps> = (props) => {
  return <ProjectScopedMotionComposition {...props} />;
};

FemaleCoachDeanGraziosi.displayName = "FemaleCoachDeanGraziosi";
