import type {RenderAdapter, RenderRequest, RenderResult} from "./render-adapter";

export class VastHyperFramesRenderAdapter implements RenderAdapter {
  public async render(_request: RenderRequest): Promise<RenderResult> {
    throw new Error("VastHyperFramesRenderAdapter is not implemented yet.");
  }
}
