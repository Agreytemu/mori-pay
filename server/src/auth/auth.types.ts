/** Identity attached to a request once the access token is verified. */
export type AuthenticatedUser = {
  userId: string;
  sessionId: string;
};
