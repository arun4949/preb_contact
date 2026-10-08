/**
 * Splits a profile name for greetings and contact records. The signup trigger
 * falls back to the email's local part when there is no real name; that is
 * not a name to greet anyone with, so it counts as no name.
 */
export function splitName(fullName: string | null | undefined, email: string): { firstName: string; lastName: string } {
  const name = (fullName ?? "").trim();
  if (!name || name.toLowerCase() === email.trim().toLowerCase().split("@")[0]) return { firstName: "", lastName: "" };
  const [firstName, ...rest] = name.split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
}

export function firstNameFor(fullName: string | null | undefined, email: string): string {
  return splitName(fullName, email).firstName;
}
