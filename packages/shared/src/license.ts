/** mailto: link that asks Nial-Tech for a licence, pre-filled with the installation ID. */
export function licenseRequestMailto(contact: string, subject: string, body: string): string {
  return `mailto:${contact}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
