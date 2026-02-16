import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class NotificationsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // Placeholder — SNS platform application for APNs will be added in a later task.
  }
}
