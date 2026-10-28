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

## Isolated registry bootstrap result

On 2026-10-27, commit affae583e966b568f466bffd3b9f75800af176fb added `browser-bootstrap/src/main/java/dev/webcraft/browser/RegistryBootstrap.java`.

This is a custom port entry point, invoking original `SharedConstants.tryDetectVersion()` then `Bootstrap.bootStrap()`, without `net.minecraft.client.main.Main`.

Verified run: https://github.com/shin5968/Web-craft/actions/runs/40462293804

| Check | Actual result |
| --- | --- |
| Java 25 compilation of custom entry point | Passed |
| Original registry initialization on JVM | Passed, process exit 0 |
| Original block registry size | 1286 |
| Air / stone / water numeric IDs | 0 / 1 / 37 |
| Same entry point compiled with TeaVM Wasm GC | compile-failed |
| Browser execution | Not reached |

The JVM baseline checks the original names of all three blocks as well as the nonempty registry. It does not create a window, log in, download assets, or load a saved world. These IDs are a measured result for this pinned version, not a general stable block ID mapping.

Actual compiler errors include `Util$makeIoExecutor$lambda$_20_0` extending missing `ThreadFactory`, missing `ExecutorService`/`ForkJoinPool`, `ScopedValue`, `StackWalker`, `ReentrantLock`, resource loading and `Unsafe` paths. The full list is in registry-bootstrap-report/compile.log; the JSON summary is truncated to its first 200 matching lines. Optional library references may be mixed with mandatory dependencies.

The custom entry point alone therefore does not solve the class-library boundary. Next work should trace and isolate the shared Util initialization/executor boundary, along with required library adaptations, using this JVM baseline as the reference. Required scheduling and locking behavior needs a real browser implementation or a deliberately tested execution model, not success-returning stubs.

To reproduce in Codespaces:

```bash
python3 tools/probe_minecraft_startup.py --target registry
```

Results are written to ignored `reports/registry-probe/`. The existing Main probe remains available without `--target registry`. Neither command changes the WebGPU viewer.

## Lazy executor boundary port

Verified run: https://github.com/shin5968/Web-craft/actions/runs/40465201497
Source commit: e1c6142a3b1e35bab44ebb55b3548d929c090cc4.

`--target registry-lazy` builds an experimental transformed client **in ignored reports only**. It does not change the hash-pinned original client, the normal Main/registry probes, or the browser viewer. The transformation changes only Util: it moves BACKGROUND_EXECUTOR, IO_POOL and DOWNLOAD_POOL factory calls out of the class initializer into private synchronized lazy accessors, rewrites Util's field reads and clears final on those three private fields. Factory bodies, arguments and executor implementations remain original. Bytecode structure and the expected three initialization sequences are checked; a mismatch stops the transformation. The original client SHA-256 is verified before transformation; both original and patched hashes are recorded.

The transformer uses explicitly pinned ASM 9.11.1 from Maven, supports Java 25 class files, and runs only during the build. Generated getters remain ordinary Java; this is not an implementation of browser threads or a replacement task scheduler. Desktop task execution timing now begins at first use of each pool instead of Util class initialization. Lazy accessors synchronize first use and return one retained instance per pool. Applications relying on eager startup timing need separate review.

Actual checks passed:

- Calling Util.getMillis initializes Util without constructing any of the three pools (JVM reflection check).
- Each accessor constructs a non-null pool, and repeated calls return the same object.
- A submitted task runs and completes within the timeout on each original pool; the test shuts down the executors afterward.
- Both unmodified and lazy-patched clients execute the registry bootstrap with exit 0.
- Both produce exactly the same measured result: 1286 blocks; air 0, stone 1, water 37.

TeaVM Wasm GC compilation still fails. Actual remaining diagnostics include ScopedValue, StackWalker, atomic array types, Guava lock paths, ClassLoader resource loading, Unsafe, and other missing APIs. Do not interpret the green probe workflow or successful JVM checks as Wasm compilation or browser execution success. Result JSON and compile/JVM/executor logs are in the registry-lazy-report artifact for 14 days. No original or transformed JAR/Wasm is published.

Reproduce in Codespaces:

```bash
python3 tools/probe_minecraft_startup.py --target registry-lazy
```

Next boundary: trace the ScopedValue/StackWalker context paths and the shared library lock/resource dependencies, preserving the same original-vs-port JVM checks. Required semantics must be implemented and tested, not skipped to make compiler errors disappear.

## 2026-10-28 API implementation update

The scoped binding, caller-frame, lock and classpath resource boundaries now have a separate compatibility implementation. Java 25 reference tests, mapped JVM execution and isolated Wasm GC execution passed 40 checks; original and ported JVM registry counts and measured IDs match. See [browser API profile, verification evidence and limits](browser-api-port.md). Complete registry Wasm compilation remains a separately measured outcome and must not be inferred from API test success.
