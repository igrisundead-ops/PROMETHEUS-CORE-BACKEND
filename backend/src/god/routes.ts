import type {FastifyInstance} from "fastify";
import {z} from "zod";

import {
  godGenerateRequestSchema,
  godReviewUpdateSchema,
  godSceneContextSchema
} from "./types";
import type {GodService} from "./service";

const variationRequestSchema = z.object({
  context: godSceneContextSchema.partial().optional(),
  forceGeneration: z.boolean().default(true)
});

const approveRequestSchema = godReviewUpdateSchema;

export const registerGodRoutes = async (
  app: FastifyInstance,
  service: GodService
): Promise<void> => {
  app.get("/api/god/assets", async (req) => {
    const query = req.query as {scope?: string};
    const payload = await service.listAssets();

    if (query.scope === "approved") {
      return {
        approved: payload.approved,
        summary: payload.summary
      };
    }

    if (query.scope === "reviews") {
      return {
        reviews: payload.reviews,
        summary: payload.summary
      };
    }

    return payload;
  });

  app.get("/api/god/assets/:id", async (req, reply) => {
    try {
      const params = req.params as {id: string};
      const asset = await service.getAsset(params.id);
      if (!asset) {
        reply.code(404);
        return {error: "GOD asset not found."};
      }
      return asset;
    } catch (error) {
      reply.code(404);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.post("/api/god/evaluate", async (req, reply) => {
    try {
      const context = godSceneContextSchema.parse(req.body ?? {});
      const assessment = await service.assessScene(context);
      reply.code(200);
      return assessment;
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.post("/api/god/generate", async (req, reply) => {
    try {
      const payload = godGenerateRequestSchema.parse(req.body ?? {});
      const result = await service.prepareGeneration({
        context: payload,
        forceGeneration: payload.forceGeneration
      });
      reply.code(result.record ? 202 : 200);
      return result;
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.post("/api/god/assets/:reviewId/approve", async (req, reply) => {
    try {
      const params = req.params as {reviewId: string};
      const payload = approveRequestSchema.parse(req.body ?? {});
      const record = await service.approveReview(params.reviewId, payload);
      reply.code(202);
      return record;
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.post("/api/god/assets/:reviewId/reject", async (req, reply) => {
    try {
      const params = req.params as {reviewId: string};
      const payload = z.object({
        notes: z.string().trim().optional()
      }).parse(req.body ?? {});
      const record = await service.rejectReview(params.reviewId, payload.notes);
      reply.code(202);
      return record;
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.post("/api/god/assets/:reviewId/variation", async (req, reply) => {
    try {
      const params = req.params as {reviewId: string};
      const payload = variationRequestSchema.parse(req.body ?? {});
      const current = await service.getReview(params.reviewId);
      const result = await service.requestVariation({
        reviewId: params.reviewId,
        context: {
          ...current.context,
          ...payload.context,
          variationRequested: true
        },
        forceGeneration: payload.forceGeneration
      });
      reply.code(result.record ? 202 : 200);
      return result;
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
};

