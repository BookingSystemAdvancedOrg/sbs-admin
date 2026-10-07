// Operator sign-in: Cognito hosted login (authorization code + PKCE, MFA
// enforced by the pool). The API needs the ACCESS token - it carries the
// platform/admin scope the API Gateway authorizer checks.
import { User, UserManager, WebStorageStateStore } from "oidc-client-ts";

const origin = window.location.origin;

export const userManager = new UserManager({
  authority: import.meta.env.VITE_COGNITO_AUTHORITY,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirect_uri: `${origin}/auth/callback`,
  post_logout_redirect_uri: `${origin}/`,
  response_type: "code",
  scope: "openid email profile platform/admin",
  // sessionStorage: gone when the tab closes; refresh token lives 8 h.
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  automaticSilentRenew: false,
});

export async function currentUser(): Promise<User | null> {
  const user = await userManager.getUser();
  if (!user) return null;
  if (!user.expired) return user;
  if (user.refresh_token) {
    try {
      return await userManager.signinSilent();
    } catch {
      /* refresh token expired - sign in again */
    }
  }
  await userManager.removeUser();
  return null;
}

export async function accessToken(): Promise<string> {
  const user = await currentUser();
  if (!user) {
    await signIn();
    throw new Error("redirecting to sign-in");
  }
  return user.access_token;
}

export function signIn(): Promise<void> {
  sessionStorage.setItem("sbs.returnTo", window.location.pathname + window.location.search);
  return userManager.signinRedirect();
}

export async function signOut(): Promise<void> {
  await userManager.removeUser();
  // Cognito has no OIDC end_session endpoint - use its own /logout.
  const url = new URL("/logout", import.meta.env.VITE_COGNITO_DOMAIN);
  url.searchParams.set("client_id", import.meta.env.VITE_COGNITO_CLIENT_ID);
  url.searchParams.set("logout_uri", `${origin}/`);
  window.location.assign(url.toString());
}

export function takeReturnTo(): string {
  const to = sessionStorage.getItem("sbs.returnTo") || "/";
  sessionStorage.removeItem("sbs.returnTo");
  return to.startsWith("/auth") ? "/" : to;
}
