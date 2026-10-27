# Original client startup probe

Verified on 2026-10-27, source commit ad62ab4980408c534f1696be137686795ad641ee.

- Target: official Minecraft 26.3, class format 69, Java 25.
- Entry: `net.minecraft.client.main.Main`, directly supplied to TeaVM 0.16.0, WEBASSEMBLY_GC.
- Official client SHA-256: `4508d006323f24fa02876310c192d739af56516eb259000ac50f0909a68c9a2d`.
- Official declared library artifacts included, including OS-specific artifacts without filtering; native binaries are not executed or translated by this inclusion.
- No platform substitutions, assets, authentication or game execution.
- Result: **compile-failed**, not a working game build. The workflow completed successfully because it captured the expected failed experiment.

Evidence: https://github.com/shin5968/Web-craft/actions/runs/40459640508
Artifact: startup-compilation-report (result.json and compile.log). JSON diagnostics are limited to the first 200 matching lines; the complete compiler log is retained in the artifact for 14 days.

## Observed missing API examples

| Area | Examples from actual compiler diagnostics |
| --- | --- |
| Concurrency | CompletableFuture, Executors, ForkJoinPool, ReentrantLock, ScopedValue |
| Files | FileChannel, FileLock, Channels, File.toPath |
| Networking | Proxy, Authenticator |
| Native loading | System.load, System.loadLibrary, System.mapLibraryName, UnsatisfiedLinkError |
| JVM facilities | FlightRecorder, StackWalker, ManagementFactory, Runtime.addShutdownHook |
| Reflection and low-level memory | MethodHandles.lookup, ClassLoader resource APIs, sun.misc.Unsafe |

These are missing in the selected TeaVM target/class library, not missing from the installed JDK 25. Supplying more desktop JARs cannot by itself implement these browser runtime semantics. The log also includes optional logging API references; do not treat every missing class as an independent mandatory game feature.

## Next implementation order

1. Build a separate browser bootstrap with explicit platform boundaries. Keep the untouched Main probe as a baseline; an alternative bootstrap is a port, not execution of the original launcher unchanged.
2. Isolate desktop native initialization, shutdown hooks and diagnostic/profiling initialization. Optional facilities can be disabled explicitly; required behavior must not be replaced with silent no-ops.
3. Prove original registry/block initialization through a small new entry point and inspect its actual reachable dependencies before expanding further.
4. Implement and test required concurrency, file/resource and networking semantics, then connect graphics/input/audio to browser APIs.
5. Reach resource loading and a real game tick before claiming title-screen or world execution.

SharedArrayBuffer availability alone does not provide Java threads. WebGPU availability alone does not implement the original graphics backend. The existing MCA viewer remains a separate custom rendering experiment.

## Reproduce in Codespaces

```bash
git pull --ff-only
python3 tools/probe_minecraft_startup.py
```

Requires JDK 25, Maven and network access. It downloads the pinned client and official libraries to ignored reports/startup-probe, then runs the compiler with a 240-second timeout. It does not change the browser app or upload binaries. A timeout is recorded as timeout, not compilation failure or success.
