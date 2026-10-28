package dev.webcraft.browser;

import net.minecraft.SharedConstants;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.server.Bootstrap;
import net.minecraft.world.level.block.Blocks;

/** Port entry point: original registry bootstrap, no desktop client launcher. */
public final class RegistryBootstrap {
    private static String completedResult;
    public static String registryResult() { return completedResult; }
    public static void main(String[] args) {
        if (!com.mojang.logging.LogUtils.getLogger().getName().equals(RegistryBootstrap.class.getName())) {
            throw new IllegalStateException("Logger caller attribution changed");
        }
        SharedConstants.tryDetectVersion();
        Bootstrap.bootStrap();
        int count = BuiltInRegistries.BLOCK.keySet().size();
        String air = BuiltInRegistries.BLOCK.getKey(Blocks.AIR).toString();
        String stone = BuiltInRegistries.BLOCK.getKey(Blocks.STONE).toString();
        String water = BuiltInRegistries.BLOCK.getKey(Blocks.WATER).toString();
        if (count <= 0 || !air.equals("minecraft:air")
                || !stone.equals("minecraft:stone") || !water.equals("minecraft:water")) {
            throw new IllegalStateException("Original block registry validation failed");
        }
        // Marker allows the runner to distinguish completion from logging output.
        completedResult = "{\"blockCount\":" + count
                + ",\"airId\":" + BuiltInRegistries.BLOCK.getId(Blocks.AIR)
                + ",\"stoneId\":" + BuiltInRegistries.BLOCK.getId(Blocks.STONE)
                + ",\"waterId\":" + BuiltInRegistries.BLOCK.getId(Blocks.WATER) + "}";
        System.out.println("WEBCRAFT_REGISTRY_OK "+completedResult);
    }
}
