import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import type { ApiStack } from "./api-stack.js";

export interface MonitoringStackProps extends cdk.StackProps {
  apiStack: ApiStack;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);
    // Placeholder — CloudWatch dashboards and alarms will be added in a later task.
  }
}
