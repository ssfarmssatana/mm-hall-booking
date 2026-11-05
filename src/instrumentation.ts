export async function register() {
  // All dates in the office are Indian Standard Time, whatever region the server runs in.
  process.env.TZ = process.env.TZ || "Asia/Kolkata";
}
