import type { NextAuthConfig } from "next-auth";

// 10-year session — effectively "never expires" for this internal admin tool.
// updateAge=0 means every request re-issues the cookie with a fresh 10-year
// expiry, so an active admin is never logged out (sliding window). The same
// maxAge is applied to the cookie itself so it survives browser restarts.
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const useSecureCookie = process.env.NODE_ENV === "production";
const sessionCookieName = useSecureCookie
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

// Edge-safe subset of the auth config used by middleware.
// No DB imports, no bcrypt — those only live in src/lib/auth.ts.
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: TEN_YEARS, updateAge: 0 },
  cookies: {
    sessionToken: {
      name: sessionCookieName,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookie,
        maxAge: TEN_YEARS,
      },
    },
  },
  pages: { signIn: "/admin/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "admin";
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? "";
        session.user.role = (token.role as string) ?? "admin";
      }
      return session;
    },
  },
};
