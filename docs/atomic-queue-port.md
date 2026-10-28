# Atomic array and FIFO queue profile

This extends the [browser API profile](browser-api-port.md). Original artifacts are hash-verified and transformed only in ignored reports. It does not introduce shared Java GC objects across browser Workers or a full blocking scheduler.

## Implemented types

| Original type | Port behavior |
| --- | --- |
| AtomicIntegerArray | Copied backing array, checked indices, get/set/CAS/exchange, arithmetic, function updates and ordering variants |
| AtomicLongArray | Same operations with Java 64-bit overflow and high-bit preservation |
| AtomicReferenceArray | Object-array copy, identity-based CAS/exchange, null elements, functional updates |
| ConcurrentLinkedQueue | Thread-safe monitor-backed FIFO, null rejection, snapshot iteration, node-identity removal |
| LinkedBlockingQueue | Bounded/unbounded FIFO, remaining capacity, immediate put/take/timed operations and drainTo |

The three atomic array implementations serialize each operation with a monitor. Plain/opaque/acquire/release variants provide the stronger monitor ordering, not a weaker simulated result. User update functions execute outside the monitor and CAS-retry on interference, so side effects must not assume one callback execution. These are not lock-free implementations or evidence of cross-Worker shared-memory atomics.

Atomic reference constructors copy into Object[] even when supplied a String[] or another narrower array. CAS uses object identity rather than equals. Primitive arithmetic wraps according to Java int/long rules. Invalid indices and negative sizes are checked explicitly; source and function null handling is tested as a catchable Java exception.

Both queue types share a base but are separate sibling classes, so LinkedBlockingQueue does not become a ConcurrentLinkedQueue subtype. The standard BlockingQueue interface is retained to preserve JVM constructor and interface boundaries with provided executors/other queue types. Iterator snapshots retain node identity: removing an already-polled node does not remove an equal-valued sibling.

An empty take, a full put, or a positive-duration operation that needs to wait throws UnsupportedOperationException. Immediate success, zero-duration failure and FIFO data operations are implemented; a blocked operation is never reported as successful. These queues do not implement complete JDK waiting, wakeup, fairness or live weak-iterator behavior. Snapshot iteration is the selected bootstrap profile.

## Exception fidelity

The port compiler configuration now enables TeaVM's strict mode for the Wasm GC target. With the default non-strict mode, negative/invalid inputs could produce WebAssembly traps instead of catchable Java exceptions. The differential suite checks bounds, null constructors/functions and negative sizes; successful compilation alone is not enough to pass this check.

## Verification structure

The same test source executes against Java 25 original classes, the mapped JVM classes and mapped Wasm GC. Additional JVM-only stress checks perform 4000 increments/updates per atomic array type across two threads, and 2000 FIFO offers with per-producer ordering checks. This JVM concurrency test does not claim that browser Java Workers or blocking scheduling are available.

Run in Codespaces:

```bash
python3 tools/probe_browser_apis.py
```

The report separates API JVM/Wasm execution, original-versus-port JVM registry comparison and complete registry Wasm compilation. Remaining missing APIs in the game graph are recorded separately from the array/queue implementation checks. Source paths: browser-compat/src/main/java/dev/webcraft/compat, tools/java/PortBrowserApis.java.

## Verified result (2026-10-28)

Source commit: 4c6054b34967e1f09c0a7c5e18dd478c35f5bca3.
Evidence: https://github.com/shin5968/Web-craft/actions/runs/40619677650

- Java 25 original APIs, mapped JVM code and mapped Node 24 Wasm GC code all passed **87 checks**.
- JVM-only stress and profile-limit checks passed: 4000 updates for each atomic array type and 2000 FIFO elements with per-producer order preserved.
- Strict Wasm GC mode passed bounds, null-source/null-function and negative-size exception cases. These cases must throw catchable Java exceptions rather than Wasm traps.
- Original and ported JVM registries both produced 1286 blocks, air ID 0, stone ID 1 and water ID 37.
- Complete registry compiler diagnostics were obtained. Missing atomic-array, ConcurrentLinkedQueue, LinkedBlockingQueue and BlockingQueue symbols: **0**. Earlier scoped value, stack walking, lock and resource categories also remained **0**.
- The full registry Wasm build still failed with 218 error lines (including duplicates and Maven summaries, not 218 distinct missing features). Remaining examples include Date.from, UUID(long,long), HexFormat, InetAddress, native/Unsafe, reflection and optional desktop framework dependencies.

No game-derived Wasm was executed, and this new compatibility suite has not yet been run on iPad Safari. Reports/logs are in browser-api-port-report; game and library JARs are not uploaded.
