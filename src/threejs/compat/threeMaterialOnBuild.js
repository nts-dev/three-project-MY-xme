import { Material } from "three";

export function installThreeMaterialOnBuildCompat() {
    if (typeof Material.prototype.onBuild === "function") return;

    Object.defineProperty(Material.prototype, "onBuild", {
        configurable: true,
        writable: true,
        value() {},
    });
}
