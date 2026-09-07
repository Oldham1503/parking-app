import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("parking register source replaces the starter preview", async () => {
  const [page, layout, app, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/parking-register.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /ParkingRegister/);
  assert.match(layout, /Parking Bay Register/);
  assert.match(app, /Bay \{bay\.bayNumber\}/);
  assert.match(app, /Start time/);
  assert.match(app, /Staff details/);
  assert.match(app, /parkingRegister\.staffDetails/);
  assert.doesNotMatch(page + layout + app + packageJson, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});
