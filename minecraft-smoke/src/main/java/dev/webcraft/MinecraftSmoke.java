package dev.webcraft;

import net.minecraft.util.ARGB;
import org.teavm.jso.JSExport;

/** Calls original game bytecode; no copied or reimplemented game methods. */
public final class MinecraftSmoke {
    public static void main(String[] args) {
        System.out.println("Minecraft 26.3 ARGB probe ready");
    }

    @JSExport
    public static int pack(int alpha, int red, int green, int blue) {
        return ARGB.color(alpha, red, green, blue);
    }

    @JSExport
    public static int component(int color, int channel) {
        return switch (channel) {
            case 0 -> ARGB.alpha(color);
            case 1 -> ARGB.red(color);
            case 2 -> ARGB.green(color);
            case 3 -> ARGB.blue(color);
            default -> throw new IllegalArgumentException("channel must be 0..3");
        };
    }
}
