/**
 * Converts a Date object to a string format compatible with datetime-local inputs
 * (YYYY-MM-DDTHH:mm) using the local timezone.
 */
export function toLocalInputString(date: Date): string {
    const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
}
