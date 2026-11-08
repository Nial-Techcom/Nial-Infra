import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes a text file to the cache and opens the system share sheet (save to Files, mail, AirDrop...). */
export async function shareText(name: string, text: string, mime = 'text/plain'): Promise<boolean> {
  const safe = name.replace(/[^A-Za-z0-9_.-]+/g, '_');
  const uri = `${FileSystem.cacheDirectory}${safe}`;
  await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: safe });
  return true;
}

export async function pickText(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (r.canceled || !r.assets[0]) return null;
  return FileSystem.readAsStringAsync(r.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
}
