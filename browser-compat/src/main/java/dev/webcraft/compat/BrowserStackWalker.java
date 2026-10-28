package dev.webcraft.compat;
import java.util.*;
import java.util.function.*;
import java.util.stream.Stream;

/** Walks instrumented application/library frames; JVM/classlib/native frames are unavailable. */
public final class BrowserStackWalker {
    public enum Option {RETAIN_CLASS_REFERENCE,SHOW_REFLECT_FRAMES,SHOW_HIDDEN_FRAMES}
    public interface StackFrame {String getClassName();String getMethodName();Class<?> getDeclaringClass();int getByteCodeIndex();String getFileName();int getLineNumber();boolean isNativeMethod();StackTraceElement toStackTraceElement();String getDescriptor();}
    private final boolean retain;
    private BrowserStackWalker(boolean retain){this.retain=retain;}
    public static BrowserStackWalker getInstance(){return new BrowserStackWalker(false);}
    public static BrowserStackWalker getInstance(Option option){return getInstance(Set.of(Objects.requireNonNull(option)));}
    public static BrowserStackWalker getInstance(Set<Option> options){Objects.requireNonNull(options);
        if(options.contains(Option.SHOW_REFLECT_FRAMES)||options.contains(Option.SHOW_HIDDEN_FRAMES))throw new UnsupportedOperationException("VM reflection/hidden frames are not instrumented");
        return new BrowserStackWalker(options.contains(Option.RETAIN_CLASS_REFERENCE));}
    public static BrowserStackWalker getInstance(Set<Option> options,int depth){if(depth<=0)throw new IllegalArgumentException();return getInstance(options);}
    public Class<?> getCallerClass(){if(!retain)throw new UnsupportedOperationException("RETAIN_CLASS_REFERENCE required");List<BrowserFrames.Entry> frames=BrowserFrames.snapshot();
        if(frames.size()<2)throw new IllegalStateException("No instrumented caller frame");return frames.get(1).type();}
    public <T>T walk(Function<? super Stream<StackFrame>,? extends T> function){Objects.requireNonNull(function);
        try(Stream<StackFrame> stream=BrowserFrames.snapshot().stream().map(entry->new Frame(entry,retain))){return function.apply(stream);}}
    public void forEach(Consumer<? super StackFrame> consumer){Objects.requireNonNull(consumer);walk(stream->{stream.forEach(consumer);return null;});}
    private record Frame(BrowserFrames.Entry entry,boolean retain) implements StackFrame {
        public String getClassName(){return entry.type().getName();}public String getMethodName(){return entry.method();}
        public Class<?> getDeclaringClass(){if(!retain)throw new UnsupportedOperationException("RETAIN_CLASS_REFERENCE required");return entry.type();}
        public int getByteCodeIndex(){return -1;}public String getFileName(){return entry.file();}
        // Entry line, not the current bytecode position; used only as diagnostic metadata.
        public int getLineNumber(){return entry.line();}public boolean isNativeMethod(){return false;}
        public StackTraceElement toStackTraceElement(){return new StackTraceElement(getClassName(),getMethodName(),getFileName(),getLineNumber());}
        public String getDescriptor(){return entry.descriptor();}
    }
}
