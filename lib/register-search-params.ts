/**
 * Preserve only flow-specific query params on locale switches.
 * Never forward arbitrary tokens globally.
 */
export function buildPreservedLocaleSearch(
  pathname: string,
  search: string,
): string {
  const path = pathname.replace(/\/+$/, "") || "/";
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const current = new URLSearchParams(raw);
  const next = new URLSearchParams();

  if (path === "/firma-eintragen") {
    const invitation = current.get("invitation");
    if (invitation) {
      // Team-invite registration: keep invitation context only.
      next.set("invitation", invitation);
      return next.toString();
    }

    const ref = current.get("ref");
    if (ref) next.set("ref", ref);
    const email = current.get("email");
    if (email) next.set("email", email);
    return next.toString();
  }

  if (path === "/team/einladung") {
    const token = current.get("token");
    if (token) next.set("token", token);
    return next.toString();
  }

  return "";
}
