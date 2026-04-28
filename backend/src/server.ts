import {createBackendApp} from "./app";

const bootstrap = async (): Promise<void> => {
  const {app, env} = await createBackendApp();
  await app.listen({
    port: env.PORT,
    host: "0.0.0.0"
  });
  console.log(`Backend listening on http://0.0.0.0:${env.PORT}`);
};

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
