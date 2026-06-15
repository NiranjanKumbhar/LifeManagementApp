import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Webhook and Inngest endpoints authenticate themselves (Svix signature /
// Inngest signing key), so they must bypass Clerk's auth.protect() — otherwise
// signed-out machine requests get rewritten to 404.
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/inngest(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files, run on everything else.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
