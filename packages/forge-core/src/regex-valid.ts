/** True if `new RegExp(pattern, flags)` does not throw. */
export function isValidRegExp(pattern: string, flags = ""): boolean {
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern, flags);
    return true;
  } catch {
    return false;
  }
}
