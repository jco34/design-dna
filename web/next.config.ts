import type { NextConfig } from "next";
import { join } from "node:path";

/**
 * The app deliberately imports the shared `schema/` module and reads the
 * `library/` folder, both one level up from here, so the workspace root is the
 * repo root rather than `web/`. Pinning it silences Next's multi-lockfile
 * warning and keeps module resolution stable.
 */
const nextConfig: NextConfig = {
  turbopack: {
    root: join(__dirname, ".."),
  },
};

export default nextConfig;
