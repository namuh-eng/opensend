import { templateRepo } from "@opensend/core";
import type { templates } from "@opensend/core";
import {
  type StoredTemplateRenderVariableResolution,
  StoredTemplateRendererConfigError,
  getStoredTemplateRendererConfig,
  renderStoredTemplateContent,
  resolveStoredTemplateRenderVariables,
} from "./stored-renderer";

type TemplateRow = typeof templates.$inferSelect;

export type TemplatePreviewRendering =
  | { kind: "legacy"; template_key: null }
  | { kind: "react_email"; template_key: string };

export type TemplatePreviewResult = {
  object: "template_preview";
  id: string;
  rendering: TemplatePreviewRendering;
  subject: string;
  html: string;
  text: string;
  variables: StoredTemplateRenderVariableResolution[];
  warnings: string[];
};

export type TemplatePreviewRepository = {
  findByIdForPreview(input: {
    id: string;
    userId?: string;
  }): Promise<TemplateRow | undefined>;
};

type TemplatePreviewOptions = {
  userId?: string;
};

export type TemplatePreviewServiceDependencies = {
  repository?: TemplatePreviewRepository;
};

export class TemplatePreviewServiceError extends Error {
  constructor(
    readonly code: "not_found",
    message: string,
  ) {
    super(message);
    this.name = "TemplatePreviewServiceError";
  }
}

const defaultTemplatePreviewRepository: TemplatePreviewRepository = {
  async findByIdForPreview({ id, userId }) {
    return await templateRepo.findByIdForUser(id, userId);
  },
};

function previewRenderingResponse(
  rendererConfig: ReturnType<typeof getStoredTemplateRendererConfig>,
): TemplatePreviewRendering {
  return rendererConfig.kind === "react_email"
    ? { kind: "react_email", template_key: rendererConfig.templateKey }
    : { kind: "legacy", template_key: null };
}

export function createTemplatePreviewService({
  repository = defaultTemplatePreviewRepository,
}: TemplatePreviewServiceDependencies = {}) {
  return {
    async renderPreview(
      id: string,
      options: TemplatePreviewOptions = {},
    ): Promise<TemplatePreviewResult> {
      const template = await repository.findByIdForPreview({
        id,
        userId: options.userId,
      });

      if (!template) {
        throw new TemplatePreviewServiceError(
          "not_found",
          "Template not found",
        );
      }

      const rendererConfig = getStoredTemplateRendererConfig(template.document);
      const variableResult = resolveStoredTemplateRenderVariables({
        storedVariables: template.variables,
        mode: "preview",
      });
      const storedSubject =
        typeof template.subject === "string" && template.subject.length > 0
          ? template.subject
          : null;
      const rendered = await renderStoredTemplateContent({
        template,
        subject:
          storedSubject ??
          (rendererConfig.kind === "legacy"
            ? (template.subject ?? "")
            : undefined),
        variables: variableResult.variables,
      });

      return {
        object: "template_preview",
        id: template.id,
        rendering: previewRenderingResponse(rendererConfig),
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        variables: variableResult.resolutions,
        warnings: variableResult.warnings,
      };
    },
  };
}

export { StoredTemplateRendererConfigError };
