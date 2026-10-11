import { test } from "node:test";
import assert from "node:assert/strict";
import { URL_PUBLIQUE_NOVA_PASS, urlCheckin } from "./config.ts";

test("les QR codes pointent vers l'adresse publique", () => {
  assert.equal(URL_PUBLIQUE_NOVA_PASS, "https://novapass.lovable.app");
  assert.equal(urlCheckin(), "https://novapass.lovable.app/checkin");
  assert.equal(urlCheckin(null), "https://novapass.lovable.app/checkin");
  assert.equal(
    urlCheckin("aaaaaaaa-0000-4000-8000-000000000001"),
    "https://novapass.lovable.app/checkin?site=aaaaaaaa-0000-4000-8000-000000000001",
  );
});
