import React from "react";

import {
  ProjectScopedMotionComposition,
  type ProjectScopedMotionCompositionProps
} from "./ProjectScopedMotionComposition";

export type ProjectScopedPreviewCompositionProps = ProjectScopedMotionCompositionProps;

export const PROJECT_SCOPED_PREVIEW_COMPOSITION_ID = "project-scoped-preview";

export const ProjectScopedPreviewComposition: React.FC<ProjectScopedPreviewCompositionProps> = (props) => {
  return <ProjectScopedMotionComposition {...props} />;
};

ProjectScopedPreviewComposition.displayName = "ProjectScopedPreviewComposition";
