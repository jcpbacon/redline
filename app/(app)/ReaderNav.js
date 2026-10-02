import { getReader } from "../../lib/supabase/server.js";
import Nav from "./Nav";

/*
 * Nav, told whether a Reader is signed in so it can list the library.
 * Rendered inside <Suspense> by the layout with a signed-out Nav as the
 * fallback, so reading the session doesn't hold back the page.
 */
export default async function ReaderNav() {
  const reader = await getReader();
  return <Nav signedIn={Boolean(reader)} />;
}
