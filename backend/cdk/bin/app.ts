#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DataStack } from "../lib/data-stack.js";
import { AuthStack } from "../lib/auth-stack.js";
import { ApiStack } from "../lib/api-stack.js";
import { NotificationsStack } from "../lib/notifications-stack.js";
import { MonitoringStack } from "../lib/monitoring-stack.js";

const app = new cdk.App();
const env = app.node.tryGetContext("env") || "dev";
const prefix = `${env}-FamilyMovieNight`;

const dataStack = new DataStack(app, `${prefix}-Data`);
const authStack = new AuthStack(app, `${prefix}-Auth`);
const apiStack = new ApiStack(app, `${prefix}-Api`, {
  dataStack,
  authStack,
});
new NotificationsStack(app, `${prefix}-Notifications`);
new MonitoringStack(app, `${prefix}-Monitoring`, { apiStack });
