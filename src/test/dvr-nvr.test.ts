import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import {
  INITIAL_CAMERAS,
  INITIAL_DISKS,
  INITIAL_AI_EVENTS,
  IpCamera,
  StorageDisk,
} from "@/types/dvr-nvr";

describe("DVR / NVR CCTV Surveillance System", () => {
  describe("Route matching", () => {
    it("successfully matches the /dvr-nvr route", () => {
      const router = createRouter({
        routeTree,
        context: { queryClient: new QueryClient() },
      });
      const matches = router.matchRoutes("/dvr-nvr");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
      expect(matches.at(-1)?.routeId).toContain("dvr-nvr");
    });
  });

  describe("Camera configurations and defaults", () => {
    it("has initial IP cameras with complete RTSP/ONVIF configuration", () => {
      expect(INITIAL_CAMERAS.length).toBeGreaterThanOrEqual(4);

      for (const camera of INITIAL_CAMERAS) {
        expect(camera.id).toBeDefined();
        expect(camera.name).toBeTruthy();
        expect(camera.ip).toMatch(/^192\.168\.\d+\.\d+$/);
        expect(camera.port).toBe(554); // Standard RTSP port
        expect(camera.rtspPath.length).toBeGreaterThan(0);
        expect(["H.265", "H.264", "MJPEG"]).toContain(camera.codec);
        expect(["online", "offline", "connecting"]).toContain(camera.status);
        expect(camera.aiFeatures).toBeDefined();
        expect(typeof camera.aiFeatures.humanDetection).toBe("boolean");
        expect(typeof camera.aiFeatures.vehicleDetection).toBe("boolean");
      }
    });

    it("verifies PTZ cameras include presets and directional controls", () => {
      const ptzCameras = INITIAL_CAMERAS.filter((c) => c.hasPtz);
      expect(ptzCameras.length).toBeGreaterThan(0);

      for (const camera of ptzCameras) {
        expect(camera.presets).toBeDefined();
        expect(camera.presets!.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Storage and Bitrate calculations", () => {
    it("calculates daily storage consumption accurately based on bitrate", () => {
      const onlineCameras = INITIAL_CAMERAS.filter((c) => c.status === "online");
      const totalBitrateKbps = onlineCameras.reduce((acc, c) => acc + c.bitrateKbps, 0);

      // (bitrate kbps / 8) * 86400 / 1024 / 1024 = GB/day
      const dailyGb = (totalBitrateKbps / 8 / 1024 / 1024) * 86400;
      expect(dailyGb).toBeGreaterThan(50); // Typical multi-channel HD/2K camera setup
      expect(dailyGb).toBeLessThan(500);

      const totalStorageBytes = INITIAL_DISKS.reduce((acc, d) => acc + d.totalBytes, 0);
      const usedStorageBytes = INITIAL_DISKS.reduce((acc, d) => acc + d.usedBytes, 0);
      const freeBytes = totalStorageBytes - usedStorageBytes;

      const freeGb = freeBytes / 1_000_000_000;
      const estimatedDaysRemaining = Math.round(freeGb / dailyGb);
      expect(estimatedDaysRemaining).toBeGreaterThan(10);
    });

    it("validates disk health metrics and S.M.A.R.T. status", () => {
      for (const disk of INITIAL_DISKS) {
        expect(disk.totalBytes).toBeGreaterThanOrEqual(1_000_000_000_000); // >= 1TB
        expect(disk.usedBytes).toBeLessThan(disk.totalBytes);
        expect(disk.temperatureCelsius).toBeGreaterThan(20);
        expect(disk.temperatureCelsius).toBeLessThan(55); // Safe HDD operating temp
        expect(disk.smartStatus).toBe("PASSED");
        expect(disk.retentionDays).toBeGreaterThanOrEqual(30);
      }
    });
  });

  describe("AI Detection & Security Events", () => {
    it("contains security event records with valid confidence scores and timestamps", () => {
      expect(INITIAL_AI_EVENTS.length).toBeGreaterThan(0);

      for (const event of INITIAL_AI_EVENTS) {
        expect(event.id).toBeDefined();
        expect(event.confidence).toBeGreaterThanOrEqual(0.8);
        expect(event.confidence).toBeLessThanOrEqual(1.0);
        expect(["human", "vehicle", "motion", "tripwire", "tamper"]).toContain(event.type);
        expect(new Date(event.timestamp).getTime()).not.toBeNaN();
      }
    });
  });
});
