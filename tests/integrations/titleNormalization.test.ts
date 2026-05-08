import assert from "node:assert/strict";
import test from "node:test";
import { parseTitleNormalizationResponse } from "../../lib/title-normalization";

test("parseTitleNormalizationResponse maps ids and falls back to original titles", () => {
  const results = parseTitleNormalizationResponse(
    JSON.stringify({
      items: [
        { id: "rec-1", revisedTitle: "CEO" },
        { id: "rec-2", revisedTitle: '"Founder"' },
      ],
    }),
    [
      { id: "rec-1", title: "Chief Executive Officer" },
      { id: "rec-2", title: "Founder/Owner" },
      { id: "rec-3", title: "VP of Operations" },
    ]
  );

  assert.deepEqual(results, [
    { id: "rec-1", revisedTitle: "CEO" },
    { id: "rec-2", revisedTitle: "Founder" },
    { id: "rec-3", revisedTitle: "VP of Operations" },
  ]);
});
