// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces

import type { AuthContext, Session, User } from '$lib/types';

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      auth: AuthContext;
      session: Session | null;
      user: User | null;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
