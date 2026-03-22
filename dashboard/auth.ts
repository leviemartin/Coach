import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const authEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.AUTH_SECRET);

const nextAuth = NextAuth({
  providers: authEnabled
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : [],
  callbacks: {
    signIn({ profile }) {
      if (!authEnabled) return true;
      return profile?.email === process.env.ALLOWED_EMAIL;
    },
  },
  pages: {
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});

export const { handlers, auth, signIn, signOut } = nextAuth;
