import { describe, it, expect } from "vitest";
import * as cdk from "aws-cdk-lib";
import { DataStack } from "../../cdk/lib/data-stack.js";
import { AuthStack } from "../../cdk/lib/auth-stack.js";
import { ApiStack } from "../../cdk/lib/api-stack.js";
import { NotificationsStack } from "../../cdk/lib/notifications-stack.js";
import { MonitoringStack } from "../../cdk/lib/monitoring-stack.js";

describe("Full CDK app synthesis", () => {
  it("synthesizes all 5 stacks without error", () => {
    const app = new cdk.App({ context: { env: "dev" } });
    const prefix = "test-FamilyMovieNight";

    const dataStack = new DataStack(app, `${prefix}-Data`);
    const authStack = new AuthStack(app, `${prefix}-Auth`);
    const apiStack = new ApiStack(app, `${prefix}-Api`, {
      dataStack,
      authStack,
    });
    new NotificationsStack(app, `${prefix}-Notifications`);
    new MonitoringStack(app, `${prefix}-Monitoring`, { apiStack });

    const assembly = app.synth();
    expect(assembly.stacks).toHaveLength(5);
  });
});
