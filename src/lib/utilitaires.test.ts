// Lancer avec : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { bornesParis, heureParisVersUtc } from "./fuseau.ts";
import { echapperHtml, neutraliserFormule } from "./export.ts";

test("heure de Paris → UTC en été (UTC+2)", () => {
  assert.equal(
    heureParisVersUtc("2026-07-14", "09:00:00").toISOString(),
    "2026-07-14T07:00:00.000Z",
  );
});

test("heure de Paris → UTC en hiver (UTC+1)", () => {
  assert.equal(
    heureParisVersUtc("2026-12-01", "00:00:00").toISOString(),
    "2026-11-30T23:00:00.000Z",
  );
});

test("fin de journée de Paris", () => {
  assert.equal(
    heureParisVersUtc("2026-10-06", "23:59:59.999").toISOString(),
    "2026-10-06T21:59:59.999Z",
  );
});

test("échappement HTML de l'e-mail", () => {
  assert.equal(
    echapperHtml(`<a href="https://x">O'Neil & co</a>`),
    "&lt;a href=&quot;https://x&quot;&gt;O&#39;Neil &amp; co&lt;/a&gt;",
  );
});

test("neutralisation des formules CSV", () => {
  for (const v of ["=HYPERLINK(1)", "+1", "-2+3", "@SUM(1)", "\tx"]) {
    assert.equal(neutraliserFormule(v), `'${v}`);
  }
  assert.equal(neutraliserFormule("Dupont"), "Dupont");
  assert.equal(neutraliserFormule("Jean-Pierre"), "Jean-Pierre");
});

test("filtre Du/Au avec heures (Paris)", () => {
  assert.deepEqual(
    bornesParis({ du: "2026-10-09", heureDu: "08:30", au: "2026-10-09", heureAu: "17:45" }),
    {
      debut: "2026-10-09T06:30:00.000Z",
      fin: "2026-10-09T15:45:59.999Z",
    },
  );
});

test("filtre Du/Au sans heure = journées entières", () => {
  assert.deepEqual(bornesParis({ du: "2026-12-01", au: "2026-12-02" }), {
    debut: "2026-11-30T23:00:00.000Z",
    fin: "2026-12-02T22:59:59.999Z",
  });
  assert.deepEqual(bornesParis({}), { debut: undefined, fin: undefined });
});
