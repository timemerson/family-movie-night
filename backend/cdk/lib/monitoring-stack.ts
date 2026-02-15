import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApiStack } from "./api-stack.js";

export interface MonitoringStackProps extends cdk.StackProps {
  apiStack: ApiStack;
}

/**
 * Stub — CloudWatch dashboards + error alarms.
 * Will be implemented in Task 08 (Polish & Hardening).
 */
export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);
    this.addDependency(props.apiStack);
  }
}
