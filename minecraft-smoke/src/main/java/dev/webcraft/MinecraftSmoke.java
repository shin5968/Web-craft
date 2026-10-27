package dev.webcraft;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import net.minecraft.util.FastBufferedInputStream;
import net.minecraft.util.BitStorage;
import net.minecraft.util.SimpleBitStorage;
import org.teavm.jso.JSExport;

/** Calls original game bytecode; no copied or reimplemented game methods. */
public final class MinecraftSmoke {
    private static BitStorage storage;
    private static BitStorage snapshot;

    @JSExport
    public static void storageInit(int bits, int size) {
        storage = new SimpleBitStorage(bits, size);
        snapshot = null;
    }

    @JSExport
    public static int storageGet(int index) { return storage.get(index); }

    @JSExport
    public static void storageSet(int index, int value) { storage.set(index, value); }

    @JSExport
    public static int storageSwap(int index, int value) { return storage.getAndSet(index, value); }

    @JSExport
    public static void storageFill(int value) { storage.fill(value); }

    @JSExport
    public static void storageCopy() { snapshot = storage.copy(); }

    @JSExport
    public static int storageCopyGet(int index) { return snapshot.get(index); }

    @JSExport
    public static int storageWordCount() { return storage.getRaw().length; }

    @JSExport
    public static int storageWordLow(int index) { return (int) storage.getRaw()[index]; }

    @JSExport
    public static int storageWordHigh(int index) { return (int) (storage.getRaw()[index] >>> 32); }

    @JSExport
    public static void storageReload() {
        storage = new SimpleBitStorage(storage.getBits(), storage.getSize(), storage.getRaw().clone());
    }

    public static void main(String[] args) {
        System.out.println("Minecraft 26.3 buffered stream probe ready");
    }

    private static byte[] data(int size) {
        byte[] data = new byte[size];
        for (int i = 0; i < size; i++) data[i] = (byte) (i * 17 + 3);
        return data;
    }

    @JSExport
    public static int readChecksum(int size, int capacity) throws IOException {
        try (var input = new FastBufferedInputStream(new ByteArrayInputStream(data(size)), capacity)) {
            int hash = 0;
            int value;
            while ((value = input.read()) != -1) hash = hash * 31 + value;
            return hash;
        }
    }

    @JSExport
    public static int bulkChecksum(int size, int capacity) throws IOException {
        try (var input = new FastBufferedInputStream(new ByteArrayInputStream(data(size)), capacity)) {
            byte[] block = new byte[13];
            int hash = 0;
            int count;
            while ((count = input.read(block, 0, block.length)) != -1) {
                if (count == 0) throw new IOException("unexpected zero-byte read");
                for (int i = 0; i < count; i++) hash = hash * 31 + Byte.toUnsignedInt(block[i]);
            }
            return hash;
        }
    }

    @JSExport
    public static int skipProbe() throws IOException {
        try (var input = new FastBufferedInputStream(new ByteArrayInputStream(data(200)), 7)) {
            if (input.read() != 3) return -1;
            long skipped = 0;
            while (skipped < 122) {
                long step = input.skip(122 - skipped);
                if (step <= 0) return -1;
                skipped += step;
            }
            int value = input.read();
            int available = input.available();
            return skipped == 122 && value == ((123 * 17 + 3) & 255) && available == 76 ? 1 : -1;
        }
    }
}
