/**
 * `dna add --paste`: take the image off the clipboard.
 *
 * The point of this is that screenshotting a design and saving it to a folder so
 * you can type the folder's path is three steps to accomplish nothing. Win+Shift+S
 * then `dna add --paste` is one step, and the file it produces is a temp file that
 * nobody has to name or clean up.
 *
 * Windows only, and deliberately so rather than by omission. There is no portable
 * clipboard-image API in Node, and the alternatives are a native module or
 * shelling out to a per-platform tool (`pbpaste` cannot do images, `xclip` and
 * `wl-paste` differ). This project is a single-user local tool on Windows 11, so
 * one PowerShell call is the honest implementation. `bestEffortPlatformHint()`
 * exists so the failure on another platform names the reason.
 *
 * Two clipboard shapes are handled, because both are things you actually do:
 *
 *   a bitmap        Win+Shift+S, or Copy Image in a browser. Saved as PNG.
 *   a file drop     Ctrl+C on an image file in Explorer. Used in place, no copy.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import path from 'node:path';
import { isAcceptedImage } from './png.js';

const exec = promisify(execFile);

/**
 * Exit codes are the protocol, because stdout from PowerShell is unreliable to
 * parse across profiles and encodings.
 *
 *   0  wrote a PNG to the path we passed in
 *   3  the clipboard holds no image and no image file
 */
const SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$target = $args[0]

# A bitmap first: Win+Shift+S and "Copy Image" both land here.
$img = Get-Clipboard -Format Image
if ($null -ne $img) {
  $img.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  $img.Dispose()
  Write-Output "bitmap"
  exit 0
}

# Then a file copied in Explorer, which is a path rather than pixels.
$files = Get-Clipboard -Format FileDropList
if ($null -ne $files -and $files.Count -gt 0) {
  Write-Output "file"
  Write-Output $files[0]
  exit 0
}

exit 3
`;

export interface PastedImage {
  /** The image on disk. A temp file for a bitmap, the original for a file drop. */
  readonly file: string;
  /** How it arrived, for the run header. */
  readonly kind: 'bitmap' | 'file';
  /** Call when finished. A no-op for a file drop: never delete the user's file. */
  readonly cleanup: () => Promise<void>;
}

export function bestEffortPlatformHint(): string {
  return (
    `--paste reads the Windows clipboard through PowerShell and this is ${process.platform}. ` +
    `Save the image and pass its path instead.`
  );
}

export async function readClipboardImage(): Promise<PastedImage> {
  if (process.platform !== 'win32') throw new Error(bestEffortPlatformHint());

  const dir = await mkdtemp(path.join(tmpdir(), 'dna-paste-'));
  const scriptFile = path.join(dir, 'paste.ps1');
  const target = path.join(dir, 'clipboard.png');
  await writeFile(scriptFile, SCRIPT, 'utf8');

  const discard = async () => {
    await rm(dir, { recursive: true, force: true });
  };

  let stdout: string;
  try {
    // `-File` rather than `-Command`, so the script is never subjected to two
    // rounds of quoting. `-NoProfile` because a user profile that prints a banner
    // would end up in the output we parse.
    const result = await exec(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptFile, target],
      { windowsHide: true, maxBuffer: 1024 * 1024 },
    );
    stdout = result.stdout;
  } catch (error) {
    await discard();
    const code = (error as { code?: number }).code;
    if (code === 3) {
      throw new Error(
        'the clipboard holds no image. Take a screenshot with Win+Shift+S, or copy an ' +
          'image file in Explorer, then run this again.',
      );
    }
    throw new Error(`could not read the clipboard: ${(error as Error).message}`);
  }

  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '');

  if (lines[0] === 'file') {
    const original = lines[1];
    await discard();
    if (original === undefined) throw new Error('the clipboard named a file but gave no path');
    if (!isAcceptedImage(original)) {
      throw new Error(
        `the clipboard holds "${path.basename(original)}", which is not a .png, .jpg, .jpeg or .webp`,
      );
    }
    // Never a temp copy and never deleted: this is a file the user already owns,
    // and `add` records its real path as the Source's `originalPath`.
    return { file: original, kind: 'file', cleanup: async () => {} };
  }

  return { file: target, kind: 'bitmap', cleanup: discard };
}
