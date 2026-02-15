import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { DataStack } from "./data-stack.js";
import { AuthStack } from "./auth-stack.js";

export interface ApiStackProps extends cdk.StackProps {
  dataStack: DataStack;
  authStack: AuthStack;
}

/**
 * Stub — Lambda + API Gateway HTTP API + JWT authorizer.
 * Will be implemented in Task 02 (Auth end-to-end).
 */
export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    this.addDependency(props.dataStack);
    this.addDependency(props.authStack);
  }
}
