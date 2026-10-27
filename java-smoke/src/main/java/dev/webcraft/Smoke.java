package dev.webcraft;

import org.teavm.jso.JSExport;

/** Original test code. Does not contain or load Minecraft classes. */
public final class Smoke {
    private record Cell(int value) {}

    public static void main(String[] args) {
        System.out.println("Web-craft Java smoke ready");
    }

    @JSExport
    public static int checksum(int seed) {
        Cell[] cells = new Cell[4096];
        for (int i = 0; i < cells.length; i++) {
            cells[i] = new Cell(((i * 31 + seed) ^ (i >>> 2)) & 255);
        }
        int sum = 0;
        for (Cell cell : cells) {
            sum += cell.value();
        }
        return sum;
    }

    @JSExport
    public static int exceptionCheck(int value) {
        try {
            if (value < 0) throw new IllegalArgumentException("negative seed");
            return value;
        } catch (IllegalArgumentException expected) {
            return -42;
        }
    }
}
