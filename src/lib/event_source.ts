export type httpMethod = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT"

export interface EventSource{
  "body": string,
  "resource": string,
  "requestContext": {
    "resourceId": string,
    "apiId": string,
    "resourcePath": string,
    "httpMethod": httpMethod,
    "requestId": string,
    "accountId": string,
    "identity": { // check when needed
      "apiKey": any,
      "userArn": any,
      "cognitoAuthenticationType": any,
      "caller": any,
      "userAgent": any,
      "user": any,
      "cognitoIdentityPoolId": any,
      "cognitoIdentityId": any,
      "cognitoAuthenticationProvider": any,
      "sourceIp": any,
      "accountId": any
    },
    "stage": string
  },
  "queryStringParameters": {
    [key: string]: string
  },
  "headers": {
    [key: string]: string
  },
  "pathParameters": {
    "proxy": string
  },
  "httpMethod": httpMethod,
  "stageVariables": {
    [key: string]: string
  },
  "path": string
}