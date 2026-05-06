import type {RenderAdapter, RenderRequest, RenderResult} from "./render-adapter";

export class LegacyRemotionRenderAdapter implements RenderAdapter {
  public async render(_request: RenderRequest): Promise<RenderResult> {
    throw new Error("LegacyRemotionRenderAdapter is quarantined and disabled.");
  }
}
