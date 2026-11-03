// @vitest-environment happy-dom
import { unzipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeLatin1, downloadFile, downloadZip, fetchBytes, formatBytes, saveBlob, type Fetcher,
} from './download';

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);
const ok = (body: Uint8Array): Response => new Response(body as BodyInit, { status: 200 });

/** Captures what would be saved, since a test cannot click through a real download. */
function captureSaves() {
  const saved: { blob: Blob; name: string }[] = [];
  const created: Blob[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    created.push(blob as Blob);
    return `blob:test/${created.length}`;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
    saved.push({ blob: created[Number(this.href.split('/').pop()) - 1] as Blob, name: this.download });
  });
  return saved;
}

describe('downloads', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('saveBlob', () => {
    it('saves under the given name and tidies up the temporary link and address', () => {
      const saved = captureSaves();
      saveBlob(new Blob(['hello']), 'hello.txt');
      expect(saved.map((s) => s.name)).toEqual(['hello.txt']);
      expect(document.querySelector('a[download]')).toBeNull();
      vi.advanceTimersByTime(1000);
      expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    });
  });

  describe('fetchBytes', () => {
    it('returns the bytes of a file', async () => {
      const fetcher: Fetcher = async () => ok(bytes(1, 2, 3));
      expect([...await fetchBytes('https://x.test/a', fetcher)]).toEqual([1, 2, 3]);
    });

    it('names the HTTP status when the host does not have the file', async () => {
      const fetcher: Fetcher = async () => new Response('', { status: 404 });
      await expect(fetchBytes('https://x.test/a', fetcher)).rejects.toThrow('HTTP 404');
    });
  });

  describe('downloadFile', () => {
    it("saves the file's bytes under ECCC's own name and reports its size", async () => {
      const saved = captureSaves();
      const requested: string[] = [];
      const fetcher: Fetcher = async (url) => { requested.push(url); return ok(bytes(9, 8, 7, 6)); };
      const size = await downloadFile({ name: 'idf_v3-40_x.pdf', url: 'https://x.test/idf_v3-40_x.pdf' }, fetcher);
      expect(size).toBe(4);
      expect(requested).toEqual(['https://x.test/idf_v3-40_x.pdf']);
      expect(saved.map((s) => s.name)).toEqual(['idf_v3-40_x.pdf']);
      expect([...new Uint8Array(await saved[0]!.blob.arrayBuffer())]).toEqual([9, 8, 7, 6]);
    });

    it('saves nothing when the file cannot be fetched', async () => {
      const saved = captureSaves();
      const fetcher: Fetcher = async () => new Response('', { status: 500 });
      await expect(downloadFile({ name: 'a.pdf', url: 'https://x.test/a.pdf' }, fetcher)).rejects.toThrow('HTTP 500');
      expect(saved).toHaveLength(0);
    });
  });

  describe('downloadZip', () => {
    const files = [
      { name: 'one.txt', url: 'https://x.test/one.txt' },
      { name: 'two.pdf', url: 'https://x.test/two.pdf' },
      { name: 'three.png', url: 'https://x.test/three.png' },
    ];
    const bodies: Record<string, Uint8Array> = {
      'https://x.test/one.txt': bytes(104, 105),
      'https://x.test/two.pdf': bytes(37, 80, 68, 70),
      'https://x.test/three.png': bytes(137, 80, 78, 71),
    };
    const fetcher: Fetcher = async (url) => ok(bodies[url] as Uint8Array);

    it('packs every file, byte for byte, into one ZIP with the given name', async () => {
      const saved = captureSaves();
      await downloadZip(files, 'station.zip', fetcher);
      expect(saved.map((s) => s.name)).toEqual(['station.zip']);
      const entries = unzipSync(new Uint8Array(await saved[0]!.blob.arrayBuffer()));
      expect(Object.keys(entries)).toEqual(['one.txt', 'two.pdf', 'three.png']);
      for (const file of files) expect([...entries[file.name]!]).toEqual([...bodies[file.url]!]);
    });

    it('reports the size of the ZIP', async () => {
      captureSaves();
      expect(await downloadZip(files, 'station.zip', fetcher)).toBeGreaterThan(30);
    });

    it('saves nothing, and names the missing file, when one cannot be fetched', async () => {
      const saved = captureSaves();
      const broken: Fetcher = async (url) => (url.endsWith('two.pdf') ? new Response('', { status: 404 }) : ok(bodies[url] as Uint8Array));
      await expect(downloadZip(files, 'station.zip', broken)).rejects.toThrow('two.pdf: HTTP 404');
      expect(saved).toHaveLength(0);
    });
  });

  describe('decodeLatin1', () => {
    it("reads ECCC's single-byte accents, which UTF-8 would turn into replacement marks", () => {
      expect(decodeLatin1(bytes(68, 111, 110, 110, 0xE9, 101, 115))).toBe('Données');
      expect(new TextDecoder('utf-8').decode(bytes(68, 0xE9))).toContain('�');
    });
  });

  describe('formatBytes', () => {
    it('uses bytes, kilobytes and megabytes', () => {
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1536)).toBe('1.5 kB');
      expect(formatBytes(48_000)).toBe('48 kB');
      expect(formatBytes(2_500_000)).toBe('2.5 MB');
    });
  });
});
