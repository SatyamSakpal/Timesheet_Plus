import { createApp } from "./app";
import { env } from "./config/env";
import { initFirebase } from "./config/firebase";

function bootstrap() {
  if (env.DATA_PROVIDER === "firestore" || !env.MOCK_AUTH_ENABLED) {
    initFirebase();
  }
  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(
      `TimesheetPlus API listening on port ${env.PORT} (provider=${env.DATA_PROVIDER}${env.FIREBASE_PROJECT_ID ? `, project=${env.FIREBASE_PROJECT_ID}` : ""})`
    );
  });
}

bootstrap();
