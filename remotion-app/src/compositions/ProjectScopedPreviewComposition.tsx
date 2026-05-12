import React from "react";

import {
  FemaleCoachDeanGraziosi,
  type FemaleCoachDeanGraziosiProps
} from "./FemaleCoachDeanGraziosi";

export type ProjectScopedPreviewCompositionProps = FemaleCoachDeanGraziosiProps;

export const PROJECT_SCOPED_PREVIEW_COMPOSITION_ID = "ProjectScopedPreview";

export const ProjectScopedPreviewComposition: React.FC<ProjectScopedPreviewCompositionProps> = (props) => {
  return <FemaleCoachDeanGraziosi {...props} />;
};

ProjectScopedPreviewComposition.displayName = "ProjectScopedPreviewComposition";
