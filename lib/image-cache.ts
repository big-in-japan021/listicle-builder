// Cache de imagens IA no IndexedDB do browser, indexado por hash(prompt+size+quality).
// Mesmo prompt = mesma imagem = não regasta tokens da OpenAI.

import { get, set, del } from "idb-keyval";

async function sha1Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", buf);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function cacheKey(
  prompt: string,
  size: string,
  quality: string
): Promise<string> {
  const h = await sha1Hex(`${prompt}|${size}|${quality}`);
  return `img-cache:${h}`;
}

export async function getCachedImage(
  prompt: string,
  size: string,
  quality: string
): Promise<string | undefined> {
  const k = await cacheKey(prompt, size, quality);
  try {
    return (await get(k)) as string | undefined;
  } catch {
    return undefined;
  }
}

export async function setCachedImage(
  prompt: string,
  size: string,
  quality: string,
  dataUrl: string
): Promise<void> {
  const k = await cacheKey(prompt, size, quality);
  try {
    await set(k, dataUrl);
  } catch {
    // quota cheia / privacy mode — segue sem cachear
  }
}

export async function clearCachedImage(
  prompt: string,
  size: string,
  quality: string
): Promise<void> {
  const k = await cacheKey(prompt, size, quality);
  try {
    await del(k);
  } catch {
    // ignora
  }
}
