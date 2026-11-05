export function friendlyDbError(msg: string) {
  if (msg.includes("bookings_no_overlap")) return "That hall is already booked (or on hold) for this time, including setup/cleaning buffer. Check the calendar.";
  if (msg.includes("row-level security") || msg.includes("Not permitted")) return "You do not have permission to do this.";
  if (msg.includes("Only accounts/admin")) return msg;
  return msg;
}
