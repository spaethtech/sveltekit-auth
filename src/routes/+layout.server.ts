/**
 * Root layout server load function
 *
 * This passes the session data to all pages, enabling
 * server-side rendering with authentication state.
 */

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    session: locals.session,
    user: locals.user
  };
};
