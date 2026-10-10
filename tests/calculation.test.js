import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDesignSummary,
  calculateConcreteMaterialProperties,
  calculateInPlaneSectionChecks,
  calculateOutOfPlaneDesign,
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

test("OOP seismic action uses the entered part period and ductility", () => {
  const result = calculateOutOfPlaneDesign({
    ...DEFAULT_INPUTS,
    partPeriod: 1.0,
    partDuctility: 1.25,
  });

  assert.equal(result.partSeismic.partPeriod, 1.0);
  assert.equal(result.partSeismic.partPeriodSource, "user input");
  assert.equal(result.partSeismic.partCph, 0.85);
  assert.ok(Number.isFinite(result.partSeismic.Fp_panel));
});

test("unsupported welded connection type is not accepted by dowel checks", () => {
  const result = calculatePrecastPanelDesign({
    ...DEFAULT_INPUTS,
    baseConnectionType: "Welded Connection",
  });

  assert.equal(result.connection.connectionTypeSupported, false);
  assert.equal(result.connection.checks.overallPass, false);
  assert.equal(result.summary.connectionPass, false);
  assert.ok(result.connection.warnings.length > 0);
});


test("shared concrete material properties follow the adopted NZS 3101 equations", () => {
  const input = { fc: 40, concreteDensity: 24, Es: 200000 };
  const material = calculateConcreteMaterialProperties(input);
  const rho = 24 * 1000 / 9.81;
  const lambda = Math.min(0.4 + 0.6 * rho / 2200, 1.0);

  assert.ok(Math.abs(material.rhoConcrete - rho) < 1e-9);
  assert.ok(Math.abs(material.Ec - 4700 * Math.sqrt(40) * Math.pow(rho / 2300, 1.5)) < 1e-6);
  assert.ok(Math.abs(material.EcSls - 4700 * Math.sqrt(50) * Math.pow(rho / 2300, 1.5)) < 1e-6);
  assert.ok(Math.abs(material.lambdaConcrete - lambda) < 1e-9);
  assert.ok(Math.abs(material.fr - 0.6 * lambda * Math.sqrt(40)) < 1e-9);
});

test("crack control reports separate in-plane and OOP directions without false confirmation", () => {
  const result = calculatePrecastPanelDesign({ ...DEFAULT_INPUTS });
  const cc = result.crackControl;

  assert.ok(cc);
  assert.ok(Number.isFinite(cc.inPlane.Mcr0));
  assert.ok(Number.isFinite(cc.inPlane.McrAxial));
  assert.ok(Number.isFinite(cc.outOfPlane.Mcr0));
  assert.ok(Number.isFinite(cc.outOfPlane.McrAxial));
  assert.ok(Number.isFinite(cc.inPlane.Icr) && cc.inPlane.Icr > 0);
  assert.ok(Number.isFinite(cc.inPlane.Ie) && cc.inPlane.Ie > 0);
  assert.ok(Number.isFinite(cc.outOfPlane.Icr) && cc.outOfPlane.Icr > 0);
  assert.ok(Number.isFinite(cc.outOfPlane.Ie) && cc.outOfPlane.Ie > 0);
  assert.equal(cc.inPlane.checks.actionConfirmed, false);
  assert.equal(cc.outOfPlane.checks.actionConfirmed, false);
  assert.equal(cc.checks.overallPass, false);
  assert.ok(cc.warnings.some((warning) => warning.includes("SLS moment and SLS axial force")));
});

test("manual SLS moments and axial forces activate both crack-width calculations", () => {
  const result = calculatePrecastPanelDesign({
    ...DEFAULT_INPUTS,
    crackSlsMomentInPlane: 1500,
    crackSlsAxialInPlane: 200,
    crackSlsMomentOutOfPlane: 100,
    crackSlsAxialOutOfPlane: 20,
  });
  const ip = result.crackControl.inPlane;
  const oop = result.crackControl.outOfPlane;

  assert.equal(ip.momentInputConfirmed, true);
  assert.equal(ip.checks.actionConfirmed, true);
  assert.equal(ip.axialSource, "User-entered governing SLS axial force");
  assert.equal(oop.momentInputConfirmed, true);
  assert.equal(oop.checks.actionConfirmed, true);
  assert.equal(oop.axialSource, "User-entered governing SLS axial force per metre");
  assert.equal(ip.cracked, true);
  assert.equal(oop.cracked, true);
  assert.ok(Number.isFinite(ip.crackWidth) && ip.crackWidth >= 0);
  assert.ok(Number.isFinite(oop.crackWidth) && oop.crackWidth >= 0);
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
