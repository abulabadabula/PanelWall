import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDesignSummary,
  calculateInPlaneSectionChecks,
  calculatePrecastPanelDesign,
} from "../feature/PrecastPanelCalculation-revised.js";
import { DEFAULT_INPUTS } from "../feature/PrecastPanelConfig.js";

test("default model never advertises a complete code-compliant design", () => {
  const result = calculatePrecastPanelDesign({ ...DEFAULT_INPUTS });

  assert.equal(result.summary.designComplete, false);
  assert.equal(result.summary.overallPass, false);
  assert.equal(result.summary.reviewRequired, true);
  assert.ok(result.summary.reviewItems.length > 0);
});

test("N-M section solver fails closed when axial equilibrium has no root", () => {
  const result = calculateInPlaneSectionChecks(
    {
      wallWidth: 3,
      wallThickness: 0.15,
      fc: 40,
      fy: 500,
      Es: 200000,
      phiFlexure: 0.85,
      cover: 30,
      VbarDia: 12,
      VbarSpace: 250,
      boundaryBarCount: 0,
      boundaryBarDiameter: 0,
      boundaryWidth: 0,
    },
    {
      geometry: {
        bwall: 3,
        twall: 0.15,
        Ag: 450000,
        Zg: 225000000,
        I: 337500000000,
      },
      gravity: { Ngravity: 0 },
      sectionActions: {
        Ntotal: 1e9,
        Mtotal: 100,
        Vtotal: 0,
      },
      elasticStress: {
        eccentricity: 0,
        sigmaN: 0,
        sigmaM: 0,
        sigmaMax: 0,
        sigmaMin: 0,
      },
    },
  );

  assert.equal(result.neutralAxisConverged, false);
  assert.equal(result.sectionCheckPass, false);
  assert.equal(result.momentRatio, Infinity);
  assert.equal(result.interactionRatio, Infinity);
});

test("missing connection and foundation results are not counted as PASS", () => {
  const summary = buildDesignSummary(
    {
      checks: {
        stressCompressionPass: true,
        bearingPass: true,
        interactionPass: true,
        sectionCheckPass: true,
        shearPass: true,
        tensionPass: true,
        boundaryNMPass: true,
        sectionSizeOK: true,
        minSteelOK: true,
        spacingOK: true,
        verticalRatioOK: true,
        slendernessWarning: false,
      },
    },
    {
      overallOK: true,
      hroofValidation: { hroofValid: true, hroofMax: 3.4 },
      pDeltaStable: true,
      stability: { allOK: true },
    },
    null,
    null,
    { errors: [], warnings: [] },
  );

  assert.equal(summary.connectionPass, false);
  assert.equal(summary.foundationPass, false);
  assert.equal(summary.overallPass, false);
});
