import type {FastifyInstance} from "fastify";

import {AssetRetrievalService} from "./service";
import {VectorRetrievalService} from "./vector-service";

export const registerAssetRoutes = (
  app: FastifyInstance,
  service: AssetRetrievalService,
  vectorService?: VectorRetrievalService
): void => {
  app.post("/api/assets/retrieve", async (request, reply) => {
    try {
      return await service.retrieve(request.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(/does not exist|enabled=false/i.test(message) ? 503 : 400);
      return {
        error: message
      };
    }
  });

  if (!vectorService) {
    return;
  }

  app.post("/api/assets/vector-retrieve", async (request, reply) => {
    try {
      return await vectorService.retrieve(request.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(/does not exist|enabled=false/i.test(message) ? 503 : 400);
      return {
        error: message
      };
    }
  });
};
