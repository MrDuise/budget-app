import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) return null;

        const membership = await db.householdMember.findFirst({
          where: { userId: user.id },
          orderBy: { joinedAt: "asc" },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          householdId: membership?.householdId ?? null,
          memberId: membership?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.householdId = (user as any).householdId;
        token.memberId = (user as any).memberId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      (session as any).householdId = token.householdId;
      (session as any).memberId = token.memberId;
      return session;
    },
  },
});
