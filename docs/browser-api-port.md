# Browser API compatibility profile

This is a port of a defined execution profile, not a complete implementation of Java 25 or a JVM. `tools/probe_browser_apis.py` builds transformed copies in ignored `reports/browser-api-probe/`. The original downloaded client SHA-256 is verified before transformation. Normal Main, registry and lazy-executor probes remain separate baselines. The WebGPU viewer does not load this experimental registry port.

## Implemented boundaries

| Boundary | Behavior | Limits |
| --- | --- | --- |
| ScopedValue | Per-thread dynamic bindings, immutable carriers, nested rebinding, duplicate-key precedence, null values, checked calls, and restoration in finally | No StructuredTaskScope inheritance or asynchronous scope propagation |
| StackWalker | Explicit instrumentation records application/library method entry and exit; walk, forEach and retained caller classes operate on snapshots | Does not expose VM, native, reflection or hidden frames; source line is method entry line; bytecode index is unknown (-1) |
| Logger caller | Direct LogUtils.getLogger calls are lowered to LoggerFactory.getLogger with their real calling class name | General dynamic reflection does not become available through this lowering |
| ReentrantLock | Ownership, hold counts, reentrancy, tryLock, interruption checks, correct ownership errors | Contended blocking acquisition and condition waits throw UnsupportedOperationException; no worker scheduler |
| ReentrantReadWriteLock | Reader ownership/counts, writer reentrancy, downgrade, and failed read-to-write tryLock | Contended blocking/upgrade waits and write conditions require a scheduler |
| Resources | Read-only byte streams and URLs, duplicate resource enumeration in classpath order, relative Class lookups, known provider class lookup | One bundled loader namespace; metadata only; no disk/network lookup or arbitrary dynamic class loading |

The scope and lock implementations use Thread.currentThread / ThreadLocal for ownership and isolation. These checks do not prove support for shared-memory Java threads. A fair-lock flag is retained, but there is no contended scheduling or fairness policy in this execution profile. Condition signals validate ownership and succeed when no waiters exist; waiting never returns a fabricated success.

Stack frames are pushed by the bytecode transformation and removed on normal return and uncaught exceptions, including constructors after superclass initialization. The compatibility runtime itself is excluded from instrumentation. Snapshot streams are closed after walk callbacks, and declaring-class access requires RETAIN_CLASS_REFERENCE. SHOW_REFLECT_FRAMES and SHOW_HIDDEN_FRAMES are explicitly unsupported. Class names are measured frame classes, not a default or guessed logger name.

The resource bundle includes version.json, pack.mcmeta, the original default en_us translations and deprecated-key JSON required by language initialization, META-INF/services entries, .properties, .xml and explicit test fixtures, with a 12 MiB cap. Original resource bytes and duplicate service descriptors are retained. Public service provider classes are registered explicitly; inaccessible provider classes are listed as excluded in the report. Unbundled resource names return no resource. Unknown dynamic class names throw ClassNotFoundException. This does not include Minecraft textures, models, world saves, or arbitrary asset loading.

## Reproduce

In Codespaces with JDK 25, Maven, Node 24 and Python:

```bash
git pull --ff-only
python3 tools/probe_browser_apis.py
```

The `Verify browser API port and original registry` workflow runs the same command. It compares a single Java test source against the original Java 25 APIs, runs the mapped test on JVM and Wasm GC, then compares original and ported registry results before attempting registry Wasm compilation. Compatibility assertion failures fail the workflow. A game compiler failure is captured separately as registryWasm.status=compile-failed and does not mean the compatibility checks failed or that the game runs.

Only logs and result.json are uploaded. Original or transformed game/library JARs and game-derived Wasm are not published.

## Verified result (2026-10-28)

Source/library check: https://github.com/shin5968/Web-craft/actions/runs/40609037254 (source 53eb3ffd9e60bf68bf15b16163ac8927c813700d).

- Original Java 25 API source, mapped JVM source and Wasm GC execution all completed the same **40 checks**.
- The checks cover nested/duplicate/null scoped bindings, checked exceptions and restoration, lock ownership/reentrancy/downgrade, condition ownership errors, resource URL/stream lookup and duplicate enumeration, retained caller classes, frame ordering and exceptional frame cleanup.
- Separate JVM tests verify thread-local scope isolation, rejection of contended blocking acquisition and unsupported waits, plus a legacy Java 1.4 class transformed and loaded by the JVM verifier.
- Original and mapped registry bootstraps both completed with **1286 blocks**, air ID 0, stone ID 1 and water ID 37; logger caller-name validation also passed.
- The metadata bundle contained **141 entries / 1,188,640 bytes**, including original language initialization data.
- **The complete game registry Wasm compilation did not complete within its 240-second limit.** This is not a compiler success and does not prove the absence of all requested API errors in the complete game dependency graph. The isolated Wasm API checks are independent evidence, not evidence that the game runs.

After this measurement, build-only annotation processors were excluded from the dynamic runtime class registry (their service resource bytes remain present). The game compiler probe has a 480-second limit and records timeout separately. `diagnosticsComplete=false` and `requestedApiDiagnostics=null` mean that the full compiler diagnostics were not obtained; zero errors must not be inferred from a partial log. The report retains actual compiler output and separate API, JVM-registry and Wasm-registry outcomes.

The registry's completion value is read through a JVM-only host harness, independently of Bootstrap's redirected logging, and is exported from the mapped Wasm entry point for future execution checks. The JVM harness's file-descriptor output is not an implemented browser file API and is not a Wasm entry point.

Build source references: [Java 25 ScopedValue](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/ScopedValue.html), [Java 25 ReentrantLock](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/locks/ReentrantLock.html). The profile limits above are deliberate deviations from complete Java concurrency/VM behavior.
